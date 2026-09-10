import nodemailer from 'nodemailer';

/**
 * Normalise et nettoie le mot de passe d'application Google (supprime les espaces éventuels).
 */
function cleanPassword(pass) {
  if (!pass) return '';
  return pass.replace(/\s+/g, '');
}

/**
 * Vérifie si les variables d'environnement SMTP Google sont configurées.
 */
export function isEmailConfigured() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  return Boolean(user && user.trim() && pass && pass.trim());
}

/**
 * Crée et retourne une instance de transporteur Nodemailer configurée pour Gmail SMTP.
 */
let cachedTransporter = null;

export function getEmailTransporter() {
  const user = process.env.EMAIL_USER;
  const rawPass = process.env.EMAIL_PASS;

  if (!user || !rawPass) {
    return null;
  }

  const pass = cleanPassword(rawPass);

  // Configuration optimisée pour Google Gmail SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: user.trim(),
      pass: pass
    },
    tls: {
      rejectUnauthorized: true
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50
  });

  return transporter;
}

/**
 * Helper de base pour envoyer un email HTML avec fallback texte.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    console.warn(`[EmailService] Configuration SMTP manquante (EMAIL_USER / EMAIL_PASS). L'email vers "${to}" n'a pas été envoyé.`);
    return { 
      success: false, 
      skipped: true, 
      error: 'Variables EMAIL_USER ou EMAIL_PASS non configurées dans .env.local.' 
    };
  }

  try {
    const transporter = getEmailTransporter();
    if (!transporter) {
      throw new Error('Impossible d\'initialiser le transporteur SMTP.');
    }

    const fromAddress = process.env.EMAIL_FROM || `"ERP Step-Up RH" <${process.env.EMAIL_USER.trim()}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || '',
      html
    });

    console.log(`[EmailService] Email envoyé avec succès à ${to} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Erreur lors de l'envoi de l'email à ${to}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Modèle de mise en page HTML de base moderne et responsive pour Step-Up.
 */
function renderBaseTemplate({ title, badge, contentHtml, ctaUrl, ctaText }) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const finalCtaUrl = ctaUrl || appUrl;
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 30px 15px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 24px 30px;
      text-align: center;
      border-bottom: 3px solid #3b82f6;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 4px 0 0 0;
      color: #94a3b8;
      font-size: 13px;
    }
    .badge-container {
      margin-top: 15px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-pending {
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .badge-approved {
      background-color: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .badge-rejected {
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .badge-info {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .content {
      padding: 30px;
      line-height: 1.6;
      font-size: 15px;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 14px;
    }
    .card-row:last-child {
      border-bottom: none;
    }
    .label {
      color: #64748b;
      font-weight: 500;
    }
    .value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .table-recap {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }
    .table-recap th {
      background-color: #f1f5f9;
      color: #475569;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #cbd5e1;
    }
    .table-recap td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .table-recap tr:hover td {
      background-color: #f8fafc;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 10px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>ERP STEP-UP</h1>
        <p>Portail Ressources Humaines & Congés</p>
        ${badge ? `<div class="badge-container">${badge}</div>` : ''}
      </div>
      <div class="content">
        ${contentHtml}
        ${ctaText ? `
          <div class="btn-container">
            <a href="${finalCtaUrl}" class="btn" target="_blank">${ctaText}</a>
          </div>
        ` : ''}
      </div>
      <div class="footer">
        <p>Ce message est généré automatiquement par l'ERP Step-Up.</p>
        <p>© ${currentYear} Step-Up. Tous droits réservés.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Formate une date ISO (YYYY-MM-DD) au format français (ex: 15 mai 2026).
 */
export function formatDateFr(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Recherche l'adresse email du N+1 (Manager) d'un employé parmi la liste des membres.
 */
export function findManagerEmail(managerName, allMembers = []) {
  if (!managerName || managerName.trim().toLowerCase() === 'aucun') {
    return null;
  }

  const cleanQuery = managerName.trim().toLowerCase();

  const found = allMembers.find(m => {
    const firstName = (m.employee_first_name || '').trim().toLowerCase();
    const lastName = (m.employee_name || '').trim().toLowerCase();
    const fullName1 = `${firstName} ${lastName}`.trim();
    const fullName2 = `${lastName} ${firstName}`.trim();

    return (
      cleanQuery === firstName ||
      cleanQuery === lastName ||
      cleanQuery === fullName1 ||
      cleanQuery === fullName2
    );
  });

  return found ? found.employee_email : null;
}

/**
 * 1. NOTIFICATION AU MANAGER LORS D'UNE NOUVELLE SOUMISSION
 */
export async function sendNewLeaveNotificationToManager({
  managerEmail,
  managerName,
  employeeName,
  employeeService,
  leaveType,
  startDate,
  endDate,
  businessDays,
  createdDate,
  requestId
}) {
  if (!managerEmail) return { success: false, reason: 'no_manager_email' };

  const durationStr = businessDays < 1 
    ? `${businessDays * 8} heure(s)`
    : `${businessDays} jour(s) ouvré(s)`;

  const formattedStart = formatDateFr(startDate);
  const formattedEnd = formatDateFr(endDate);
  const dateRange = startDate === endDate ? formattedStart : `Du ${formattedStart} au ${formattedEnd}`;

  const badge = `<span class="badge badge-pending">⏳ En attente de validation</span>`;
  const subject = `[ERP Step-Up] 🔔 Nouvelle demande de congé/permission : ${employeeName}`;

  const contentHtml = `
    <p>Bonjour <strong>${managerName || 'Manager'}</strong>,</p>
    <p>Une nouvelle demande d'absence a été déposée par un collaborateur de votre équipe et requiert votre validation :</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 6px 0;">Collaborateur :</td>
          <td class="value" style="padding: 6px 0;">${employeeName}</td>
        </tr>
        ${employeeService ? `
        <tr>
          <td class="label" style="padding: 6px 0;">Département / Service :</td>
          <td class="value" style="padding: 6px 0;">${employeeService}</td>
        </tr>` : ''}
        <tr>
          <td class="label" style="padding: 6px 0;">Type d'absence :</td>
          <td class="value" style="padding: 6px 0;"><span style="color: #2563eb;">${leaveType}</span></td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Période demandée :</td>
          <td class="value" style="padding: 6px 0;">${dateRange}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Durée :</td>
          <td class="value" style="padding: 6px 0;"><strong>${durationStr}</strong></td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Date de soumission :</td>
          <td class="value" style="padding: 6px 0;">${formatDateFr(createdDate || new Date().toISOString())}</td>
        </tr>
      </table>
    </div>

    <p style="margin-top: 20px;">Veuillez vous connecter à votre espace manager pour approuver ou refuser cette demande.</p>
  `;

  const html = renderBaseTemplate({
    title: subject,
    badge,
    contentHtml,
    ctaText: "Accéder à l'Espace de Validation",
    ctaUrl: `${process.env.APP_URL || 'http://localhost:3000'}`
  });

  return await sendEmail({
    to: managerEmail,
    subject,
    html,
    text: `Nouvelle demande de congé en attente pour ${employeeName} (${leaveType}, ${dateRange}, ${durationStr}). Connectez-vous sur l'ERP pour la valider.`
  });
}

/**
 * 2. NOTIFICATION DE CONFIRMATION À L'EMPLOYÉ LORS DE LA SOUMISSION
 */
export async function sendLeaveSubmissionConfirmationToEmployee({
  employeeEmail,
  employeeName,
  leaveType,
  startDate,
  endDate,
  businessDays,
  managerName
}) {
  if (!employeeEmail) return { success: false, reason: 'no_employee_email' };

  const durationStr = businessDays < 1 
    ? `${businessDays * 8} heure(s)`
    : `${businessDays} jour(s) ouvré(s)`;

  const formattedStart = formatDateFr(startDate);
  const formattedEnd = formatDateFr(endDate);
  const dateRange = startDate === endDate ? formattedStart : `Du ${formattedStart} au ${formattedEnd}`;

  const badge = `<span class="badge badge-info">📩 Demande enregistrée</span>`;
  const subject = `[ERP Step-Up] Confirmation de votre demande d'absence (${leaveType})`;

  const contentHtml = `
    <p>Bonjour <strong>${employeeName}</strong>,</p>
    <p>Votre demande d'absence a bien été enregistrée et transmise pour validation :</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 6px 0;">Type d'absence :</td>
          <td class="value" style="padding: 6px 0;"><span style="color: #2563eb;">${leaveType}</span></td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Période :</td>
          <td class="value" style="padding: 6px 0;">${dateRange}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Durée :</td>
          <td class="value" style="padding: 6px 0;"><strong>${durationStr}</strong></td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Validateur référent :</td>
          <td class="value" style="padding: 6px 0;">${managerName || 'Responsable RH'}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Statut :</td>
          <td class="value" style="padding: 6px 0;"><span style="color: #d97706; font-weight: 700;">En attente de validation</span></td>
        </tr>
      </table>
    </div>

    <p>Vous recevrez une notification par email dès que votre responsable aura traité votre demande.</p>
  `;

  const html = renderBaseTemplate({
    title: subject,
    badge,
    contentHtml,
    ctaText: "Voir mon tableau de bord",
    ctaUrl: `${process.env.APP_URL || 'http://localhost:3000'}`
  });

  return await sendEmail({
    to: employeeEmail,
    subject,
    html,
    text: `Votre demande de congé (${leaveType}, ${dateRange}, ${durationStr}) a bien été transmise à votre manager et est en attente de validation.`
  });
}

/**
 * 3. NOTIFICATION À L'EMPLOYÉ LORS DE LA DÉCISION DU MANAGER (APPROUVÉ / REFUSÉ)
 */
export async function sendLeaveDecisionToEmployee({
  employeeEmail,
  employeeName,
  leaveType,
  startDate,
  endDate,
  businessDays,
  status,
  hrComment,
  remainingBalance,
  remainingPerm
}) {
  if (!employeeEmail) return { success: false, reason: 'no_employee_email' };

  const isApproved = status === 'Approuvé';
  const durationStr = businessDays < 1 
    ? `${businessDays * 8} heure(s)`
    : `${businessDays} jour(s) ouvré(s)`;

  const formattedStart = formatDateFr(startDate);
  const formattedEnd = formatDateFr(endDate);
  const dateRange = startDate === endDate ? formattedStart : `Du ${formattedStart} au ${formattedEnd}`;

  const badge = isApproved 
    ? `<span class="badge badge-approved">✅ Demande approuvée</span>`
    : `<span class="badge badge-rejected">❌ Demande refusée</span>`;

  const subject = `[ERP Step-Up] Votre demande de congé a été ${isApproved ? 'approuvée' : 'refusée'}`;

  const isPermission = leaveType.toLowerCase().includes('perm');
  const relevantBalance = isPermission ? remainingPerm : remainingBalance;

  const contentHtml = `
    <p>Bonjour <strong>${employeeName}</strong>,</p>
    <p>Votre demande d'absence a été examinée par votre responsable :</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 6px 0;">Type d'absence :</td>
          <td class="value" style="padding: 6px 0;">${leaveType}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Période :</td>
          <td class="value" style="padding: 6px 0;">${dateRange}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Durée :</td>
          <td class="value" style="padding: 6px 0;"><strong>${durationStr}</strong></td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Décision :</td>
          <td class="value" style="padding: 6px 0;">
            <strong style="color: ${isApproved ? '#16a34a' : '#dc2626'};">${status}</strong>
          </td>
        </tr>
        ${hrComment ? `
        <tr>
          <td class="label" style="padding: 6px 0;">Commentaire :</td>
          <td class="value" style="padding: 6px 0; font-style: italic; color: #475569;">"${hrComment}"</td>
        </tr>` : ''}
        ${isApproved && relevantBalance !== undefined ? `
        <tr>
          <td class="label" style="padding: 6px 0;">Nouveau solde restant :</td>
          <td class="value" style="padding: 6px 0; color: #0284c7; font-weight: 700;">${relevantBalance} j</td>
        </tr>` : ''}
      </table>
    </div>
  `;

  const html = renderBaseTemplate({
    title: subject,
    badge,
    contentHtml,
    ctaText: "Accéder à mon espace",
    ctaUrl: `${process.env.APP_URL || 'http://localhost:3000'}`
  });

  return await sendEmail({
    to: employeeEmail,
    subject,
    html,
    text: `Votre demande de congé (${leaveType}, ${dateRange}) a été ${status}. Commentaire: ${hrComment || 'Aucun'}`
  });
}

/**
 * 4. RÉCAPITULATIF PÉRIODIQUE (DIGEST) DES DEMANDES EN ATTENTE
 */
export async function sendPendingLeavesDigestEmail({
  recipientEmail,
  recipientName,
  isManager = true,
  pendingRequests = []
}) {
  if (!recipientEmail || pendingRequests.length === 0) {
    return { success: false, reason: 'no_recipient_or_no_requests' };
  }

  const count = pendingRequests.length;
  const badge = `<span class="badge badge-pending">⏳ ${count} demande${count > 1 ? 's' : ''} en attente</span>`;
  const subject = `[ERP Step-Up] 📋 Récapitulatif : ${count} demande${count > 1 ? 's' : ''} de congé en attente de validation`;

  const rowsHtml = pendingRequests.map((req, idx) => {
    const formattedStart = formatDateFr(req.start_date);
    const formattedEnd = formatDateFr(req.end_date);
    const dateRange = req.start_date === req.end_date ? formattedStart : `${formattedStart} - ${formattedEnd}`;
    const duration = Number(req.business_days || 0);
    const durationText = duration < 1 ? `${duration * 8}h` : `${duration}j`;

    return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
          <strong>${req.employee_name}</strong>
          ${req.service ? `<br><small style="color: #64748b;">${req.service}</small>` : ''}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #2563eb;">${req.leave_type}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${dateRange}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${durationText}</td>
      </tr>
    `;
  }).join('');

  const contentHtml = `
    <p>Bonjour <strong>${recipientName || 'Responsable'}</strong>,</p>
    <p>Voici le récapitulatif automatique des demandes d'absence en attente de votre validation :</p>
    
    <div style="overflow-x: auto; margin: 20px 0;">
      <table class="table-recap" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #475569; border-bottom: 2px solid #cbd5e1;">Collaborateur</th>
            <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #475569; border-bottom: 2px solid #cbd5e1;">Type</th>
            <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #475569; border-bottom: 2px solid #cbd5e1;">Période</th>
            <th style="padding: 10px 8px; text-align: center; font-size: 12px; color: #475569; border-bottom: 2px solid #cbd5e1;">Durée</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <p style="margin-top: 15px;">Merci de vous connecter à l'ERP Step-Up pour traiter ces demandes dans les meilleurs délais.</p>
  `;

  const html = renderBaseTemplate({
    title: subject,
    badge,
    contentHtml,
    ctaText: "Accéder à l'Espace Manager pour Traiter",
    ctaUrl: `${process.env.APP_URL || 'http://localhost:3000'}`
  });

  return await sendEmail({
    to: recipientEmail,
    subject,
    html,
    text: `Vous avez ${count} demande(s) de congé en attente de validation. Connectez-vous sur l'ERP pour les examiner.`
  });
}

/**
 * 5. TEST DE CONFIGURATION SMTP
 */
export async function sendTestEmail({ toEmail }) {
  const subject = `[ERP Step-Up] 🧪 Test de configuration Email SMTP réussi !`;
  const badge = `<span class="badge badge-approved">✅ Configuration Opérationnelle</span>`;

  const contentHtml = `
    <p>Bonjour,</p>
    <p>Ce message confirme que votre configuration <strong>Google Mail SMTP</strong> fonctionne parfaitement avec l'ERP Step-Up.</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 6px 0;">Expéditeur configuré :</td>
          <td class="value" style="padding: 6px 0;">${process.env.EMAIL_USER}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Date et heure du test :</td>
          <td class="value" style="padding: 6px 0;">${new Date().toLocaleString('fr-FR')}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 6px 0;">Système :</td>
          <td class="value" style="padding: 6px 0;">ERP Step-Up RH Notifications</td>
        </tr>
      </table>
    </div>

    <p>Les notifications automatiques pour les demandes de validation de congé et permission sont prêtes à être envoyées.</p>
  `;

  const html = renderBaseTemplate({
    title: subject,
    badge,
    contentHtml,
    ctaText: "Ouvrir l'ERP Step-Up",
    ctaUrl: `${process.env.APP_URL || 'http://localhost:3000'}`
  });

  return await sendEmail({
    to: toEmail,
    subject,
    html,
    text: `Test de configuration Google SMTP réussi sur l'ERP Step-Up.`
  });
}
