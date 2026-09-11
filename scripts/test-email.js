import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// Parse .env.local
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[match[1].trim()] = value.trim();
    }
  });
}

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '';
const emailFrom = process.env.EMAIL_FROM || `"ERP Step-Up RH" <${emailUser}>`;
const targetEmail = process.argv[2] || emailUser;

console.log('====================================================');
console.log('🧪 TEST D\'ENVOI D\'EMAIL VIA GOOGLE SMTP (GMAIL)');
console.log('====================================================');
console.log(`- EMAIL_USER : ${emailUser || 'NON DÉFINI'}`);
console.log(`- EMAIL_PASS : ${emailPass ? '******** (' + emailPass.length + ' caractères)' : 'NON DÉFINI'}`);
console.log(`- Destinataire test : ${targetEmail || 'NON DÉFINI'}`);
console.log('----------------------------------------------------');

if (!emailUser || !emailPass) {
  console.error('\n❌ ERREUR: EMAIL_USER ou EMAIL_PASS n\'est pas configuré dans .env.local.');
  console.log('\nPour configurer Google Gmail :');
  console.log('1. Rendez-vous sur votre compte Google : https://myaccount.google.com/');
  console.log('2. Allez dans "Sécurité" > "Validation en deux étapes"');
  console.log('3. Descendez jusqu\'à "Mots de passe des applications"');
  console.log('4. Créez un mot de passe (ex: nom "ERP Step-Up")');
  console.log('5. Copiez le mot de passe de 16 caractères dans EMAIL_PASS du fichier .env.local\n');
  process.exit(1);
}

if (!targetEmail) {
  console.error('\n❌ ERREUR: Veuillez spécifier une adresse email destinataire :');
  console.log('Usage: node scripts/test-email.js votre-email@domaine.com\n');
  process.exit(1);
}

async function testEmail() {
  console.log('Connexion au serveur SMTP de Google (smtp.gmail.com:465)...');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  try {
    console.log('Vérification des identifiants SMTP...');
    await transporter.verify();
    console.log('✅ Authentification SMTP réussie !');

    console.log(`Envoi d'un email de test à ${targetEmail}...`);
    const logoPath = path.join(process.cwd(), 'public', 'Logo Step Up.png');
    const defaultAttachments = fs.existsSync(logoPath) ? [
      {
        filename: 'Logo Step Up.png',
        path: logoPath,
        cid: 'stepup_logo'
      }
    ] : [];

    const info = await transporter.sendMail({
      from: emailFrom,
      to: targetEmail,
      subject: '[ERP Step Up] 🚀 Test de notification par email réussi !',
      text: 'Félicitations ! Le système de notification automatique par email de l\'ERP Step Up est correctement configuré et opérationnel.',
      attachments: defaultAttachments,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 25px;">
          <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="background-color: #EFEFEF; padding: 20px; text-align: center; border-bottom: 3px solid #E06900;">
              <img src="cid:stepup_logo" alt="Step Up" style="height: 38px; width: auto; max-width: 170px; display: inline-block; vertical-align: middle;" />
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 13px;">Portail Ressources Humaines & Congés</p>
            </div>
            <div style="padding: 25px; color: #334155; line-height: 1.6;">
              <div style="display: inline-block; background-color: #dcfce7; color: #338855; padding: 5px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-bottom: 15px;">
                ✅ CONFIGURATION VALIDE
              </div>
              <p>Bonjour,</p>
              <p>Ce message confirme que votre adresse Google et votre mot de passe d'application fonctionnent parfaitement pour envoyer les notifications de l'ERP Step Up.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; margin: 15px 0; font-size: 13px;">
                <strong>Expéditeur :</strong> ${emailUser}<br>
                <strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="display: inline-block; background-color: #E06900; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: 600; font-size: 14px;">Accéder à l'application</a>
              </div>
            </div>
          </div>
        </div>
      `
    });

    console.log(`\n🎉 SUCCÈS ! Email envoyé avec succès !`);
    console.log(`ID du message : ${info.messageId}`);
    console.log(`Vérifiez votre boîte de réception (${targetEmail}).`);
  } catch (error) {
    console.error('\n❌ ÉCHEC DE L\'ENVOI DE L\'EMAIL :');
    console.error(error.message);
    if (error.response) {
      console.error('Détails du serveur :', error.response);
    }
  }
}

testEmail();
