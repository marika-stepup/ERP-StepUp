import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { sendTestEmail, isEmailConfigured } from '../../../../lib/emailService';

export async function POST(req) {
  // Authenticate user (HR, Manager, Director)
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      error: 'Le service email n\'est pas encore configuré. Renseignez EMAIL_USER et EMAIL_PASS dans .env.local.'
    }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const recipientEmail = body.email || auth.user.email;

    if (!recipientEmail) {
      return NextResponse.json({
        error: 'Adresse email destinataire manquante.'
      }, { status: 400 });
    }

    const result = await sendTestEmail({ toEmail: recipientEmail });

    if (!result.success) {
      return NextResponse.json({
        error: `Échec de l'envoi du test : ${result.error}`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Email de test envoyé avec succès à ${recipientEmail} !`
    });
  } catch (error) {
    console.error('Error in test-email route:', error);
    return NextResponse.json({
      error: 'Erreur interne du serveur lors du test email : ' + error.message
    }, { status: 500 });
  }
}
