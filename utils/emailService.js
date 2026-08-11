// Serviço de envio de e-mail via Gmail API (OAuth2)
// Substitui o SMTP do Gmail, que foi descontinuado para apps/uso programático.
//
// Requer variáveis de ambiente (veja TODO.md):
//   GMAIL_CLIENT_ID
//   GMAIL_CLIENT_SECRET
//   GMAIL_REFRESH_TOKEN
//   GMAIL_USER  (o e-mail do remetente, ex.: voce@gmail.com)
//
// Opcional: EMAIL_ALERT_ENABLED (true/false) para alertas ao secretário.

const { google } = require('googleapis');
const nodemailer = require('nodemailer');

// Cria o transporter OAuth2 do Gmail usando o refresh token.
// O access token é gerado/renovado automaticamente pelo googleapis.
const getEmailTransporter = () => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const user = process.env.GMAIL_USER;

  if (!clientId || !clientSecret || !refreshToken || !user) {
    return null;
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);

  // Define o refresh token para que o access token seja obtido automaticamente.
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
      // O access token é resolvido automaticamente pelo nodemailer a partir do
      // refresh token + clientId/clientSecret. Não é necessário preencher aqui.
    }
  });
};

// Envia um e-mail. Retorna true se enviado, false se não configurado.
const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getEmailTransporter();
  if (!transporter) {
    throw new Error('Gmail API não configurado. Defina GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN e GMAIL_USER.');
  }

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html
  });
};

// Alerta ao secretário sobre novo cadastro/voluntário pendente.
// Não lança erro se o e-mail não estiver configurado ou falhar.
const enviarAlertaSecretario = async (qtdPendentes = 0) => {
  const enabled = String(process.env.EMAIL_ALERT_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return;

  const destinatario = process.env.SECRETARIO_EMAIL || process.env.GMAIL_USER || 'secretaria@cme.org.br';

  try {
    const pendentes = qtdPendentes || 0;
    const assunto = `Novo cadastro recebido - ${pendentes} pendente${pendentes === 1 ? '' : 's'}`;
    const texto = `Olá, secretário(a)!\n\nUm novo cadastro foi realizado no sistema da Cruzada.\nAtualmente existem ${pendentes} cadastro(s) pendente(s) aguardando avaliação.\n\nAcesse o painel administrativo para revisar os registros.`;
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Novo cadastro recebido</h2>
        <p>Olá, secretário(a)!</p>
        <p>Um novo cadastro foi realizado no sistema da Cruzada.</p>
        <p>Atualmente existem <strong>${pendentes}</strong> cadastro(s) pendente(s) aguardando avaliação.</p>
        <p>Acesse o painel administrativo para revisar os registros.</p>
      </div>
    `;

    await sendEmail({ to: destinatario, subject: assunto, text: texto, html });
    console.log(`Alerta por e-mail enviado para ${destinatario}`);
  } catch (err) {
    console.error('Erro ao enviar alerta por e-mail:', err);
  }
};

module.exports = { getEmailTransporter, sendEmail, enviarAlertaSecretario };
