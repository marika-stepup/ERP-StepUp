import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { 
  findManagerEmail, 
  sendPendingLeavesDigestEmail, 
  isEmailConfigured 
} from '../../../../lib/emailService';

// Helper to compute grouped recipients for pending leaves
async function getGroupedPendingRecipients() {
  const supabase = getSupabaseAdmin();

  const { data: pendingRequests, error: reqError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('status', 'En attente')
    .order('created_at', { ascending: true });

  if (reqError) throw reqError;

  if (!pendingRequests || pendingRequests.length === 0) {
    return { pendingRequests: [], groupedByRecipient: new Map() };
  }

  const { data: members, error: memError } = await supabase
    .from('leave_balances')
    .select('*');

  if (memError) throw memError;

  const membersMap = new Map((members || []).map(m => [m.employee_id, m]));
  const hrAndDirectors = (members || []).filter(m => ['hr', 'director'].includes(m.role));

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

  return { pendingRequests, groupedByRecipient };
}

// GET: Preview recipients and pending requests before sending (Anti-Spam Preview)
export async function GET(req) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const { pendingRequests, groupedByRecipient } = await getGroupedPendingRecipients();

    const recipients = Array.from(groupedByRecipient.values()).map(r => ({
      recipientEmail: r.recipientEmail,
      recipientName: r.recipientName,
      requestsCount: r.requests.length,
      requests: r.requests.map(item => ({
        request_id: item.request_id,
        employee_name: item.employee_name,
        service: item.service,
        leave_type: item.leave_type,
        start_date: item.start_date,
        end_date: item.end_date,
        business_days: item.business_days,
        created_at: item.created_at
      }))
    }));

    return NextResponse.json({
      success: true,
      isConfigured: isEmailConfigured(),
      totalPendingRequests: pendingRequests.length,
      recipientsCount: recipients.length,
      recipients
    });
  } catch (error) {
    console.error('Error fetching preview for pending notifications:', error);
    return NextResponse.json({
      error: 'Erreur lors de la récupération des destinataires : ' + error.message
    }, { status: 500 });
  }
}

// POST: Send consolidated reminder emails (supports filtering by targetEmails for selective anti-spam sending)
export async function POST(req) {
  // 1. Authenticate user - HR, Manager, Director
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      error: 'Le service email n\'est pas encore configuré. Veuillez renseigner EMAIL_USER et EMAIL_PASS dans .env.local.'
    }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetEmails = Array.isArray(body.targetEmails) && body.targetEmails.length > 0 
      ? body.targetEmails.map(e => e.toLowerCase().trim()) 
      : null;

    const { pendingRequests, groupedByRecipient } = await getGroupedPendingRecipients();

    if (!pendingRequests || pendingRequests.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Aucune demande en attente de validation.'
      });
    }

    // Filter recipients if targeted selection is provided
    const entriesToSend = Array.from(groupedByRecipient.entries()).filter(([email]) => {
      if (!targetEmails) return true;
      return targetEmails.includes(email.toLowerCase().trim());
    });

    if (entriesToSend.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Aucun destinataire sélectionné ou valide trouvé parmi les demandes en attente.'
      }, { status: 400 });
    }

    // Send consolidated digest emails
    const sendResults = [];

    for (const [email, data] of entriesToSend) {
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

    const successfulSends = sendResults.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successfulSends} email${successfulSends > 1 ? 's' : ''} récapitulatif${successfulSends > 1 ? 's' : ''} envoyé${successfulSends > 1 ? 's' : ''} avec succès.`,
      totalPendingRequests: pendingRequests.length,
      notificationsSentCount: successfulSends,
      details: sendResults
    });

  } catch (error) {
    console.error('Error sending manual email digest:', error);
    return NextResponse.json({
      error: 'Erreur lors de l\'envoi des rappels par email : ' + error.message
    }, { status: 500 });
  }
}
