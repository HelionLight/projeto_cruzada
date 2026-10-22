const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const Cruzado = require('../models/Cruzado');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const { authenticate, authorize } = require('../middleware/auth');

const { sendEmail } = require('../utils/emailService');

const router = express.Router();

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

const findActiveToken = async ({ cpf, numeroCruzado }) => {
  const filter = numeroCruzado
    ? { numeroCruzado }
    : { cpf };

  return EmailVerificationToken.findOne({
    ...filter,
    usedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ tokenId: -1 });
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

const adminRequestSchema = Joi.object({
  cpf: Joi.string().required()
});

router.post('/admin-request', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { error } = adminRequestSchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'Informe o CPF do cadastro.' });

    const cpf = normalizeCpf(req.body.cpf);
    if (cpf.length !== 11) return res.status(400).json({ message: 'CPF inválido.' });

    const { cruzado } = await findCruzado({ cpf });
    if (!cruzado) return res.status(404).json({ message: 'Cadastro não encontrado.' });
    if (!process.env.SECRETARIO_EMAIL) {
      return res.status(500).json({ message: 'SECRETARIO_EMAIL não está configurado.' });
    }

    const code = formatarCodeLikeDigits(Math.floor(10000000 + Math.random() * 90000000));
    const tokenId = `admin_${Date.now()}_${code}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await EmailVerificationToken.deleteMany({
      cruzadoId: cruzado._id,
      purpose: 'admin_edit',
      usedAt: null
    });

    await EmailVerificationToken.create({
      cpf: cruzado.cpf ? normalizeCpf(cruzado.cpf) : null,
      numeroCruzado: cruzado.numeroCruzado || null,
      nome: cruzado.nome,
      cruzadoId: cruzado._id,
      purpose: 'admin_edit',
      tokenId,
      expiresAt,
      verificationAttempts: 0
    });

    await sendEmail({
      to: process.env.SECRETARIO_EMAIL,
      subject: 'Código para edição administrativa de cadastro - Cruzada',
      text: `Código para liberar a edição administrativa do cadastro de ${cruzado.nome}: ${code}.\n\nVálido por 10 minutos.`,
      html: `<div style="font-family: Arial, sans-serif;"><h3>Edição administrativa</h3><p>Cadastro: <strong>${cruzado.nome}</strong></p><p>CPF: <strong>${cpf}</strong></p><p style="font-size: 24px; font-weight: bold;">${code}</p><p>Válido por 10 minutos.</p></div>`
    });

    return res.json({
      message: 'Código enviado ao e-mail do secretário.',
      cruzado: { _id: cruzado._id, nome: cruzado.nome, numeroCruzado: cruzado.numeroCruzado || null }
    });
  } catch (err) {
    console.error('Erro ao solicitar código administrativo:', err);
    return res.status(500).json({ message: err.message || 'Erro ao enviar código administrativo.' });
  }
});

const adminVerifySchema = Joi.object({
  cpf: Joi.string().required(),
  code: Joi.string().required()
});

router.post('/admin-verify', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { error } = adminVerifySchema.validate(req.body);
    if (error) return res.status(400).json({ message: 'CPF e código são obrigatórios.' });

    const cpf = normalizeCpf(req.body.cpf);
    const code = formatarCodeLikeDigits(req.body.code);
    const token = await EmailVerificationToken.findOne({
      cpf,
      purpose: 'admin_edit',
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).sort({ tokenId: -1 });

    if (!token) return res.status(400).json({ message: 'Código inválido ou expirado.' });
    if (token.verificationAttempts >= 3) return res.status(429).json({ message: 'Limite de 3 tentativas excedido.' });

    if (token.tokenId.split('_').pop() !== code) {
      token.verificationAttempts += 1;
      await token.save();
      return res.status(400).json({ message: 'Código inválido.' });
    }

    token.usedAt = new Date();
    await token.save();

    const editJwt = jwt.sign(
      { cpf: token.cpf, numeroCruzado: token.numeroCruzado, cruzadoId: token.cruzadoId, scope: 'admin-edit', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({ token: editJwt, cruzadoId: token.cruzadoId });
  } catch (err) {
    console.error('Erro ao validar código administrativo:', err);
    return res.status(500).json({ message: err.message || 'Erro ao validar código administrativo.' });
  }
});

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
      usedAt: null,
      verificationAttempts: 0
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

    const token = await findActiveToken({
      cpf: cpfNormalizado,
      numeroCruzado
    });
    if (!token) return res.status(400).json({ message: 'Código inválido ou expirado.' });

    if (token.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Código expirado.' });
    }

    if (token.usedAt) {
      return res.status(400).json({ message: 'Código já utilizado.' });
    }

    const tokenCode = token.tokenId.split('_').pop();
    if (token.verificationAttempts >= 3) {
      return res.status(429).json({ message: 'Limite de 3 tentativas excedido. Solicite um novo código.' });
    }

    if (tokenCode !== code) {
      token.verificationAttempts += 1;
      await token.save();
      const remaining = 3 - token.verificationAttempts;
      return res.status(400).json({
        message: remaining > 0
          ? `Código inválido. Restam ${remaining} tentativa(s).`
          : 'Limite de 3 tentativas excedido. Solicite um novo código.'
      });
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
