export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { 
  findManagerEmail, 
  sendPendingLeavesDigestEmail, 
  isEmailConfigured 
} from '../../../../lib/emailService';

/**
 * Endpoint CRON pour envoyer automatiquement un récapitulatif par email des demandes en attente.
 * Accessible en GET ou POST (Vercel Cron ou déclenchement manuel).
 */
async function handleNotifyPending(req) {
  // 1. Vérification de sécurité CRON_SECRET si défini
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('secret');
  const authHeader = req.headers.get('authorization');

  if (cronSecret) {
    const isAuthorized = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
    if (!isAuthorized) {
      console.warn('[Cron:NotifyPending] Requête non autorisée (secret CRON invalide).');
      return NextResponse.json({ error: 'Non autorisé : secret CRON invalide.' }, { status: 401 });
    }
  }

  // 2. Vérifier si l'email est configuré
  if (!isEmailConfigured()) {
    console.warn('[Cron:NotifyPending] Variables SMTP Google non configurées (EMAIL_USER / EMAIL_PASS).');
    return NextResponse.json({ 
      success: false, 
      warning: 'Le service email n\'est pas encore configuré (EMAIL_USER et EMAIL_PASS manquants).' 
    }, { status: 200 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 3. Récupérer toutes les demandes en attente
    const { data: pendingRequests, error: reqError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'En attente')
      .order('created_at', { ascending: true });

    if (reqError) {
      throw reqError;
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Aucune demande en attente de validation.'
      });
    }

    // 4. Récupérer tous les membres pour la correspondance des managers et services
    const { data: members, error: memError } = await supabase
      .from('leave_balances')
      .select('*');

    if (memError) {
      throw memError;
    }

    const membersMap = new Map((members || []).map(m => [m.employee_id, m]));
    const hrAndDirectors = (members || []).filter(m => ['hr', 'director'].includes(m.role));

    // 5. Regrouper les demandes par destinataire (Manager ou RH)
    // Structure: recipientEmail -> { recipientName, recipientEmail, requests: [] }
    const groupedByRecipient = new Map();

    for (const reqItem of pendingRequests) {
      const employeeProfile = membersMap.get(reqItem.employee_id);
      const managerName = employeeProfile?.manager_name || '';
      const service = employeeProfile?.service || '';

      const enrichedReq = {
        ...reqItem,
        service: service || 'Équipe',
        employee_name: employeeProfile ? `${employeeProfile.employee_first_name || ''} ${employeeProfile.employee_name || ''}`.trim() || reqItem.employee_name : reqItem.employee_name
      };

      const managerEmail = findManagerEmail(managerName, members || []);

      if (managerEmail) {
        if (!groupedByRecipient.has(managerEmail)) {
          groupedByRecipient.set(managerEmail, {
            recipientEmail: managerEmail,
            recipientName: managerName,
            requests: []
          });
        }
        groupedByRecipient.get(managerEmail).requests.push(enrichedReq);
      } else {
        // Si aucun manager spécifique n'est trouvé, notifier l'équipe RH / Direction
        for (const hr of hrAndDirectors) {
          if (hr.employee_email) {
            if (!groupedByRecipient.has(hr.employee_email)) {
              groupedByRecipient.set(hr.employee_email, {
                recipientEmail: hr.employee_email,
                recipientName: `${hr.employee_first_name || ''} ${hr.employee_name || ''}`.trim() || 'Ressources Humaines',
                requests: []
              });
            }
            groupedByRecipient.get(hr.employee_email).requests.push(enrichedReq);
          }
        }
      }
    }

    // 6. Envoyer les emails récapitulatifs à chaque destinataire
    const sendResults = [];

    for (const [email, data] of groupedByRecipient.entries()) {
      const result = await sendPendingLeavesDigestEmail({
        recipientEmail: email,
        recipientName: data.recipientName,
        isManager: true,
        pendingRequests: data.requests
      });

      sendResults.push({
        recipient: email,
        recipientName: data.recipientName,
        requestsCount: data.requests.length,
        success: result.success,
        error: result.error || null
      });
    }

    return NextResponse.json({
      success: true,
      totalPendingRequests: pendingRequests.length,
      notificationsSentCount: sendResults.filter(r => r.success).length,
      details: sendResults
    });

  } catch (error) {
    console.error('[Cron:NotifyPending] Erreur lors de l\'envoi des récapitulatifs :', error);
    return NextResponse.json({
      error: 'Erreur interne lors de l\'envoi des notifications de rappel.',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET(req) {
  return handleNotifyPending(req);
}

export async function POST(req) {
  return handleNotifyPending(req);
}
