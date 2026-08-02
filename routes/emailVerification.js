const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const Cruzado = require('../models/Cruzado');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const { authenticate } = require('../middleware/auth');

const nodemailer = require('nodemailer');

const router = express.Router();

const getEmailTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
};

const normalizeCpf = (cpf) => String(cpf || '').replace(/\D/g, '');

const buildCpfRegex = (cpfDigits) => {
  const digits = String(cpfDigits || '').replace(/\D/g, '');
  const pattern = '^' + digits.split('').map((digit) => `${digit}\\D*`).join('') + '$';
  return new RegExp(pattern);
};

const formatarCodeLikeDigits = (s) => {
  // Garantir que o code não inclua caracteres estranhos (mantém simples)
  return String(s).replace(/\D/g, '').slice(0, 8);
};

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getEmailTransporter();
  if (!transporter) {
    throw new Error('SMTP não configurado. Configure SMTP_HOST/SMTP_USER/SMTP_PASS.');
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });
};

// Localizar cruzado por CPF (com fallbacks) ou numeroCruzado
const findCruzado = async ({ cpf, numeroCruzado }) => {
  const cpfNormalizado = normalizeCpf(cpf);

  if (numeroCruzado) {
    const porNumero = await Cruzado.findOne({ numeroCruzado });
    if (porNumero) return { cruzado: porNumero, by: 'numeroCruzado' };
  }

  if (cpfNormalizado) {
    let cruzado = await Cruzado.findOne({ cpf });
    if (!cruzado) cruzado = await Cruzado.findOne({ cpf: cpfNormalizado });
    if (!cruzado) cruzado = await Cruzado.findOne({ cpf: buildCpfRegex(cpfNormalizado) });
    if (cruzado) return { cruzado, by: 'cpf' };
  }

  return { cruzado: null, by: null };
};

const requestSchema = Joi.object({
  cpf: Joi.string().allow('').optional(),
  numeroCruzado: Joi.string().allow('').optional()
}).or('cpf', 'numeroCruzado');

router.post('/request', async (req, res) => {
  try {
    const { error } = requestSchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'Informe CPF ou Número Cruzado.' });

    const cpfNormalizado = normalizeCpf(req.body.cpf);
    const numeroCruzado = (req.body.numeroCruzado || '').trim();

    const { cruzado } = await findCruzado({ cpf: cpfNormalizado, numeroCruzado });

    if (!cruzado) return res.status(404).json({ message: 'Cadastro não encontrado!' });

    // Se o registro não tem email, retornar código específico para o frontend
    // oferecer o fluxo alternativo (validação por nome completo + numeroCruzado).
    if (!cruzado.email) {
      return res.status(400).json({ code: 'NO_EMAIL', message: 'Este cadastro não possui e-mail cadastrado. Use o fluxo de validação por Nome e Número Cruzado.' });
    }

    const code = formatarCodeLikeDigits(Math.floor(Math.random() * 1000000000));
    const tokenId = new Date().toISOString().replace(/[-:.TZ]/g, '') + '_' + code;

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Recriar token para o CPF ou numeroCruzado (garantir uso único por token)
    if (cruzado.cpf) {
      await EmailVerificationToken.deleteMany({ cpf: normalizeCpf(cruzado.cpf), usedAt: null }).catch(() => {});
    } else if (cruzado.numeroCruzado) {
      await EmailVerificationToken.deleteMany({ numeroCruzado: cruzado.numeroCruzado, usedAt: null }).catch(() => {});
    }

    const record = await EmailVerificationToken.create({
      cpf: cruzado.cpf ? normalizeCpf(cruzado.cpf) : null,
      numeroCruzado: cruzado.numeroCruzado || null,
      cruzadoId: cruzado._id,
      tokenId,
      expiresAt,
      usedAt: null
    });

    const subject = 'Código de verificação - Atualização de Cadastro';
    const text = `Olá! Use este código para liberar a atualização do seu cadastro: ${code}.\n\nVálido por 10 minutos.\n`;
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h3>Código de verificação</h3>
        <p>Olá!</p>
        <p>Use este código para liberar a atualização do seu cadastro:</p>
        <p style="font-size: 24px; font-weight: bold;">${code}</p>
        <p>Válido por 10 minutos.</p>
      </div>
    `;

    await sendEmail({
      to: cruzado.email,
      subject,
      text,
      html
    });

    return res.json({ message: 'Código enviado para seu e-mail.' });
  } catch (err) {
    console.error('Erro request email verification:', err);
    return res.status(500).json({ message: err.message || 'Erro ao solicitar código.' });
  }
});

// Rota alternativa para registro legado sem e-mail:
// valida identidade por nome completo + numeroCruzado e emite token de edição
const requestNoEmailSchema = Joi.object({
  nome: Joi.string().required(),
  numeroCruzado: Joi.string().required()
});

router.post('/request-sem-email', async (req, res) => {
  try {
    const { error } = requestNoEmailSchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'Nome completo e Número Cruzado são obrigatórios.' });

    const nome = String(req.body.nome || '').trim();
    const numeroCruzado = String(req.body.numeroCruzado || '').trim();

    const cruzado = await Cruzado.findOne({ numeroCruzado });
    if (!cruzado) {
      return res.status(404).json({ message: 'Cadastro não encontrado para este número.' });
    }

    // Comparar nome de forma normalizada (sem acentos/caixa, ignorando espaços extras)
    const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9à-úçãõâêô]/gi, '').replace(/\s+/g, ' ');
    if (normalizeName(cruzado.nome) !== normalizeName(nome)) {
      return res.status(400).json({ message: 'Nome não confere com o cadastro.' });
    }

    // Emitir token de edição diretamente (registro legado validado por nome+numero)
    const editJwt = jwt.sign(
      { cpf: cruzado.cpf ? normalizeCpf(cruzado.cpf) : null, numeroCruzado: cruzado.numeroCruzado, cruzadoId: cruzado._id, scope: 'edit' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({ token: editJwt, cruzadoId: cruzado._id });
  } catch (err) {
    console.error('Erro request-sem-email:', err);
    return res.status(500).json({ message: err.message || 'Erro ao validar identidade.' });
  }
});

const verifySchema = Joi.object({
  cpf: Joi.string().allow('').optional(),
  numeroCruzado: Joi.string().allow('').optional(),
  code: Joi.string().required()
}).or('cpf', 'numeroCruzado');

router.post('/verify', async (req, res) => {
  try {
    const { error } = verifySchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'CPF/Número Cruzado e código são obrigatórios.' });

    const cpfNormalizado = normalizeCpf(req.body.cpf);
    const numeroCruzado = (req.body.numeroCruzado || '').trim();
    const code = formatarCodeLikeDigits(req.body.code);
    if (!code) return res.status(400).json({ message: 'Código inválido!' });

    let token;
    if (numeroCruzado) {
      token = await EmailVerificationToken.findOne({
        numeroCruzado,
        tokenId: new RegExp(`.*_${code}$`)
      });
    } else {
      token = await EmailVerificationToken.findOne({
        cpf: cpfNormalizado,
        tokenId: new RegExp(`.*_${code}$`)
      });
    }

    if (!token) return res.status(400).json({ message: 'Código inválido ou expirado.' });

    if (token.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Código expirado.' });
    }

    if (token.usedAt) {
      return res.status(400).json({ message: 'Código já utilizado.' });
    }

    token.usedAt = new Date();
    await token.save();

    const editJwt = jwt.sign(
      { cpf: token.cpf, numeroCruzado: token.numeroCruzado, cruzadoId: token.cruzadoId, scope: 'edit' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({ token: editJwt, cruzadoId: token.cruzadoId });
  } catch (err) {
    console.error('Erro verify email verification:', err);
    return res.status(500).json({ message: err.message || 'Erro ao validar código.' });
  }
});

module.exports = router;

