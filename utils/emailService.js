// Serviço de envio de e-mail via GMAIL API (HTTP Puro) - Corrigido para o Render
const { google } = require('googleapis');

// Função auxiliar para inicializar o cliente da API do Gmail
const getGmailClient = () => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const user = process.env.GMAIL_USER;

  if (!clientId || !clientSecret || !refreshToken || !user) {
    return null;
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  // Retorna a instância da API autenticada
  return google.gmail({ version: 'v1', auth: oAuth2Client });
};

// Mantido apenas para não quebrar compatibilidade caso alguma rota use diretamente
const getEmailTransporter = () => {
  return getGmailClient();
};

// Envia um e-mail gerando o formato RFC 2822 exigido pela API do Gmail
const sendEmail = async ({ to, subject, text, html }) => {
  const gmail = getGmailClient();
  if (!gmail) {
    throw new Error('Gmail API não configurado. Defina GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN e GMAIL_USER.');
  }

  const sender = process.env.GMAIL_USER;

  // Monta o cabeçalho e corpo do e-mail manualmente no formato padrão MIME
  const parts = [
    `From: ${sender}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`, // Trata acentos no assunto
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="boundary_cruzada"',
    '',
    '--boundary_cruzada',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text).toString('base64'),
    '',
    '--boundary_cruzada',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
    '',
    '--boundary_cruzada--'
  ];

  const rawMessage = parts.join('\n');

  // A API do Gmail exige que a string seja encodada em Base64 de formato Web (Safe URL)
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Envia através da requisição HTTP POST oficial da API
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });
};

// Alerta ao secretário sobre novo cadastro/voluntário pendente.
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
