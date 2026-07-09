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

const formatarCodeLikeDigits = (s) => {
  // Garantir que o code não inclua caracteres estranhos (mantém simples)
  // Observação: aqui usamos um número aleatório como código.
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

const requestSchema = Joi.object({
  cpf: Joi.string().required()
});

router.post('/request', async (req, res) => {
  try {
    const { error } = requestSchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'CPF é obrigatório.' });

    const cpfNormalizado = normalizeCpf(req.body.cpf);
    if (!cpfNormalizado || cpfNormalizado.length !== 11) {
      return res.status(400).json({ message: 'CPF inválido!' });
    }

    // Buscar cadastro permanente pelo CPF (normalização via backend existente pode existir; aqui repetimos abordagem)
    let cruzado = await Cruzado.findOne({ cpf: req.body.cpf });
    if (!cruzado) {
      cruzado = await Cruzado.findOne({ cpf: cpfNormalizado });
    }
    if (!cruzado) {
      cruzado = await Cruzado.findOne({
        $expr: { $eq: [ { $regexReplace: { input: '$cpf', regex: '\\D', replacement: '' } }, cpfNormalizado ] }
      });
    }

    if (!cruzado) return res.status(404).json({ message: 'Cadastro não encontrado!' });

    const code = formatarCodeLikeDigits(Math.floor(Math.random() * 1000000000));
    const tokenId = new Date().toISOString().replace(/[-:.TZ]/g, '') + '_' + code;

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Recriar token para o CPF (garantir uso único por token)
    await EmailVerificationToken.deleteMany({ cpf: cpfNormalizado, usedAt: null }).catch(() => {});

    const record = await EmailVerificationToken.create({
      cpf: cpfNormalizado,
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

const verifySchema = Joi.object({
  cpf: Joi.string().required(),
  code: Joi.string().required()
});

router.post('/verify', async (req, res) => {
  try {
    const { error } = verifySchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'CPF e código são obrigatórios.' });

    const cpfNormalizado = normalizeCpf(req.body.cpf);
    if (!cpfNormalizado || cpfNormalizado.length !== 11) {
      return res.status(400).json({ message: 'CPF inválido!' });
    }

    const code = formatarCodeLikeDigits(req.body.code);
    if (!code) return res.status(400).json({ message: 'Código inválido!' });

    // tokenId foi criado com _ + code no final, usamos isso como matching.
    // (Se quiser depois, trocamos para salvar o code explicitamente no model.)
    const token = await EmailVerificationToken.findOne({
      cpf: cpfNormalizado,
      tokenId: new RegExp(`.*_${code}$`)
    });

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
      { cpf: cpfNormalizado, scope: 'edit' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({ token: editJwt });
  } catch (err) {
    console.error('Erro verify email verification:', err);
    return res.status(500).json({ message: err.message || 'Erro ao validar código.' });
  }
});

module.exports = router;

