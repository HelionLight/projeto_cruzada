const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const Cruzado = require('../models/Cruzado');
const User = require('../models/User');
const CruzadoTemp = require('../models/CruzadoTemp');
const { authenticate, authorize } = require('../middleware/auth');
const verifyEditToken = require('../middleware/verifyEditToken');
const Joi = require('joi');
const CruzadoCounter = require('../models/CruzadoCounter');
const { importFromBuffer } = require('../utils/legacyImport');
const { sendEmail, enviarAlertaSecretario } = require('../utils/emailService');

const router = express.Router();

// Configuração do GridFS
let gfs;
mongoose.connection.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Função para obter bucket GridFS
const getGridFSBucket = () => {
  if (!gfs) {
    gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });
  }
  return gfs;
};

// Configuração do multer para upload em memória (para GridFS)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por arquivo
  fileFilter: (req, file, callback) => {
    const isPhoto = file.fieldname === 'foto';
    const allowed = isPhoto
      ? /^image\/(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.mimetype)
      : file.mimetype === 'application/pdf';

    if (!allowed) {
      return callback(new Error(
        isPhoto
          ? 'A foto deve ser um arquivo de imagem (PNG, JPG, JPEG, GIF, WEBP, BMP ou AVIF).'
          : 'Este documento deve ser um arquivo PDF.'
      ));
    }

    callback(null, true);
  }
}).fields([
  { name: 'foto', maxCount: 1 },
  { name: 'certificadoIndicacao', maxCount: 1 },
  { name: 'documentoVoluntario', maxCount: 1 },
  { name: 'documentoConsignacao', maxCount: 1 }
]);

const handleUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message: error.code === 'LIMIT_FILE_SIZE'
          ? 'Cada arquivo pode ter no máximo 10 MB.'
          : error.message || 'Arquivo inválido.'
      });
    }
    next();
  });
};

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
}).single('arquivo');

const validateUploadedContent = (files) => {
  const allFiles = Object.values(files || {}).flat();
  for (const file of allFiles) {
    const isPdf = file.fieldname !== 'foto';
    const isValidPdf = file.buffer.subarray(0, 5).toString() === '%PDF-';
    const isValidImage = file.buffer.length >= 3 && (
      file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
      file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
      file.buffer.subarray(0, 6).toString() === 'GIF87a' ||
      file.buffer.subarray(0, 6).toString() === 'GIF89a' ||
      file.buffer.subarray(0, 4).toString() === 'RIFF'
    );

    if ((isPdf && !isValidPdf) || (!isPdf && !isValidImage)) {
      return isPdf
        ? 'O documento enviado não é um PDF válido.'
        : 'A foto enviada não é uma imagem válida.';
    }
  }
  return null;
};

// Validação do formulário
const cruzadoSchema = Joi.object({
  nome: Joi.string().required(),
  cpf: Joi.string().required(),
  celular: Joi.string().required(),
  email: Joi.string().email().required(),
  estado: Joi.string().required(),
  cidade: Joi.string().required(),
  endereco: Joi.string().required(),
  cep: Joi.string().required(),
  sexo: Joi.string().valid('masculino', 'feminino').required(),
  dataNascimento: Joi.date().required(),
  vinculoProfissional: Joi.string().valid('Marinha', 'Exército', 'Força Aérea', 'Polícia Militar', 'Corpo de Bombeiros Militar', 'Civil', 'Outros').required(),
  especificarVinculo: Joi.string().optional(),
  situacaoProfissional: Joi.string().valid('Ativa', 'Reserva', 'Reformado', 'Aposentado', 'Pensionista', 'Outros').required(),
  especificarSituacao: Joi.string().optional(),
  formacao: Joi.string().valid('fundamental', 'medio', 'superior', 'mestre', 'doutor').required(),
  nucleoOuGede: Joi.string().required(),
  nomeResponsavelIndicacao: Joi.string().required(),
  cpfResponsavelIndicacao: Joi.string().required(),
  desejaContribuir: Joi.boolean().required(),
  valorContribuicao: Joi.number().optional(),
    consignacao: Joi.boolean().optional(),
  numeroCruzado: Joi.string().optional(),
  trabalharVoluntario: Joi.boolean().optional(),
  consentimento: Joi.boolean().valid(true).required()
});

// Schema de atualização flexível (aceita registros legados sem CPF/email)
const cruzadoUpdateSchema = Joi.object({
  nome: Joi.string().allow('').optional(),
  cpf: Joi.string().allow('').optional(),
  celular: Joi.string().allow('').optional(),
  email: Joi.string().email().allow('').optional(),
  estado: Joi.string().allow('').optional(),
  cidade: Joi.string().allow('').optional(),
  endereco: Joi.string().allow('').optional(),
  cep: Joi.string().allow('').optional(),
  sexo: Joi.string().valid('masculino', 'feminino').allow('').optional(),
  dataNascimento: Joi.date().allow('').optional(),
  vinculoProfissional: Joi.string().valid('Marinha', 'Exército', 'Força Aérea', 'Polícia Militar', 'Corpo de Bombeiros Militar', 'Civil', 'Outros').allow('').optional(),
  especificarVinculo: Joi.string().allow('').optional(),
  situacaoProfissional: Joi.string().valid('Ativa', 'Reserva', 'Reformado', 'Aposentado', 'Pensionista', 'Outros').allow('').optional(),
  especificarSituacao: Joi.string().allow('').optional(),
  formacao: Joi.string().valid('fundamental', 'medio', 'superior', 'mestre', 'doutor').allow('').optional(),
  nucleoOuGede: Joi.string().allow('').optional(),
  nomeResponsavelIndicacao: Joi.string().allow('').optional(),
  cpfResponsavelIndicacao: Joi.string().allow('').optional(),
  desejaContribuir: Joi.boolean().optional(),
  valorContribuicao: Joi.number().optional(),
    consignacao: Joi.boolean().optional(),
  numeroCruzado: Joi.string().allow('').optional(),
  trabalharVoluntario: Joi.boolean().optional()
});

// Helpers de normalização de CPF
const normalizeCpf = (cpf) => String(cpf || '').replace(/\D/g, '');
const buildCpfRegex = (cpfDigits) => {
  const digits = String(cpfDigits || '').replace(/\D/g, '');
  const pattern = '^' + digits.split('').map((digit) => `${digit}\\D*`).join('') + '$';
  return new RegExp(pattern);
};

// Submeter formulário
router.post('/register', handleUpload, async (req, res) => {
  try {
    const uploadError = validateUploadedContent(req.files);
    if (uploadError) return res.status(400).json({ message: uploadError });

    // Sanitizar e normalizar campos recebidos (remover strings vazias, converter booleanos/números)
    const sanitize = (body) => {
      Object.keys(body).forEach((key) => {
        const val = body[key];
        if (val === '') {
          delete body[key];
          return;
        }
        if (typeof val === 'string') {
          if (val === 'true') body[key] = true;
          else if (val === 'false') body[key] = false;
          else if (key === 'valorContribuicao') {
            const n = Number(val);
            if (!Number.isNaN(n)) body[key] = n;
            else delete body[key];
          }
        }
      });
    };

    sanitize(req.body);

    const { error } = cruzadoSchema.validate(req.body);
    if (error) {
      const field = error.details[0].context.label || error.details[0].path[0];
      return res.status(400).json({ message: `Campo inválido: ${field}. ${error.details[0].message}` });
    }

    // Validação de documentos obrigatórios (2.2)
    // certificadoIndicacao: obrigatório sempre
    const hasCertificadoIndicacao = Boolean(req.files && req.files.certificadoIndicacao && req.files.certificadoIndicacao[0]);
    if (!hasCertificadoIndicacao) {
      return res.status(400).json({ message: 'Documento de Certificado de Indicação (PDF) é obrigatório!' });
    }

    // documentoVoluntario: obrigatório se trabalharVoluntario === true
    const trabalharVoluntario = Boolean(req.body.trabalharVoluntario);
    const hasDocumentoVoluntario = Boolean(req.files && req.files.documentoVoluntario && req.files.documentoVoluntario[0]);
    if (trabalharVoluntario && !hasDocumentoVoluntario) {
      return res.status(400).json({ message: 'Documento de Termo de Adesão/Voluntário (PDF) é obrigatório quando trabalharVoluntario é Sim!' });
    }

    // documentoConsignacao: obrigatório se consignacao === true
    const consignacao = Boolean(req.body.consignacao);
    const hasDocumentoConsignacao = Boolean(req.files && req.files.documentoConsignacao && req.files.documentoConsignacao[0]);
    if (consignacao && !hasDocumentoConsignacao) {
      return res.status(400).json({ message: 'Documento de Consignação em Folha (PDF) é obrigatório quando consignacao é Sim!' });
    }

    // Verificar CPF duplicado
    const cpfExistente = await CruzadoTemp.findOne({ cpf: req.body.cpf });

    if (cpfExistente) {
      return res.status(400).json({ message: 'CPF já cadastrado no sistema!' });
    }

    // Verificar email duplicado
    const emailExistente = await CruzadoTemp.findOne({ email: req.body.email });
    if (emailExistente) {
      return res.status(400).json({ message: 'Email já cadastrado no sistema!' });
    }

    let fotoId = null;
    let certificadoId = null;
    let documentoVoluntarioId = null;
    let documentoConsignacaoId = null;

    // Se há foto, salvar no GridFS
    if (req.files && req.files.foto && req.files.foto[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.foto[0].originalname, {
        contentType: req.files.foto[0].mimetype
      });

      uploadStream.end(req.files.foto[0].buffer);

      fotoId = uploadStream.id;
    }

    // Se há certificado, salvar no GridFS
    if (req.files && req.files.certificadoIndicacao && req.files.certificadoIndicacao[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.certificadoIndicacao[0].originalname, {
        contentType: req.files.certificadoIndicacao[0].mimetype
      });

      uploadStream.end(req.files.certificadoIndicacao[0].buffer);

      certificadoId = uploadStream.id;
    }

    // Se há documento de voluntário, salvar no GridFS
    if (req.files && req.files.documentoVoluntario && req.files.documentoVoluntario[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.documentoVoluntario[0].originalname, {
        contentType: req.files.documentoVoluntario[0].mimetype
      });

      uploadStream.end(req.files.documentoVoluntario[0].buffer);

      documentoVoluntarioId = uploadStream.id;
    }

    // Se há documento de consignação, salvar no GridFS
    if (req.files && req.files.documentoConsignacao && req.files.documentoConsignacao[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.documentoConsignacao[0].originalname, {
        contentType: req.files.documentoConsignacao[0].mimetype
      });

      uploadStream.end(req.files.documentoConsignacao[0].buffer);

      documentoConsignacaoId = uploadStream.id;
    }

    const cruzadoData = {
      ...req.body,
      foto: fotoId,
      certificadoIndicacao: certificadoId,
      documentoVoluntario: documentoVoluntarioId,
      documentoConsignacao: documentoConsignacaoId,

      // Status dos processos extras, independentes do cadastro principal
      statusConsignacao: consignacao ? 'pendente' : 'nao_solicitada',
      statusVoluntariado: trabalharVoluntario ? 'pendente' : 'nao_solicitado'
    };

    const cruzado = new CruzadoTemp(cruzadoData);
    await cruzado.save();
    const pendentes = await CruzadoTemp.countDocuments({ status: 'pendente' });
    await enviarAlertaSecretario(pendentes);
    res.status(201).json({ message: 'Registro enviado para aprovação' });
  } catch (err) {
    console.error('Erro ao registrar:', err);
    
    // Tratamento de erros específicos do MongoDB
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      if (field === 'cpf') {
        return res.status(400).json({ message: 'CPF já cadastrado no sistema!' });
      } else if (field === 'email') {
        return res.status(400).json({ message: 'Email já cadastrado no sistema!' });
      }
      return res.status(400).json({ message: `${field} já existe no sistema!` });
    }
    
    if (err.name === 'ValidationError') {
      const messages = Object.keys(err.errors).map(key => `${key}: ${err.errors[key].message}`).join('; ');
      return res.status(400).json({ message: `Erro de validação: ${messages}` });
    }

    res.status(500).json({ message: 'Erro ao processar registro. Tente novamente.' });
  }
});

// Listar registros pendentes (admin) - sempre consultando a coleção temporária
router.get('/pending', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  try {
    const pendentes = await CruzadoTemp.find({ status: 'pendente' }).sort({ createdAt: -1 });
    res.json(pendentes);
  } catch (err) {
    console.error('Erro ao listar pendentes:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Listar registros pendentes de voluntários (admin)

router.get('/pending/voluntarios', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  try {
    const [temporarios, permanentes] = await Promise.all([
      CruzadoTemp.find({
        status: 'aguardando_documentos',
        trabalharVoluntario: true,
        statusVoluntariado: 'pendente',
        documentoVoluntario: { $exists: true, $ne: null }
      }),
      Cruzado.find({
        statusVoluntariado: 'pendente',
        trabalharVoluntario: true,
        documentoVoluntario: { $exists: true, $ne: null }
      })
    ]);

    res.json([...temporarios, ...permanentes]);
  } catch (err) {
    console.error('Erro ao listar voluntários:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Aprovar/rejeitar


router.put('/:id/status', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  const { status, processo, motivo } = req.body;

  if (!status || !['aprovado', 'rejeitado'].includes(status)) {
    return res.status(400).json({
      message: 'Status inválido! Use "aprovado" ou "rejeitado".'
    });
  }
  if (!processo && status === 'rejeitado' && (!motivo || !String(motivo).trim())) {
    return res.status(400).json({ message: 'Informe o motivo da rejeição.' });
  }

  try {
    // ==========================================
    // 1. ATUALIZAR VOLUNTARIADO OU CONSIGNAÇÃO
    // ==========================================
    if (processo === 'voluntariado' || processo === 'consignacao') {
      const temp = await CruzadoTemp.findById(req.params.id);
      const permanente = temp
        ? null
        : await Cruzado.findById(req.params.id);

      const cruzado = temp || permanente;

      if (!cruzado) {
        return res.status(404).json({
          message: 'Registro não encontrado.'
        });
      }

      if (processo === 'voluntariado') {
        if (!cruzado.trabalharVoluntario) {
          return res.status(400).json({
            message: 'Este cadastro não solicitou voluntariado.'
          });
        }

        if (!cruzado.documentoVoluntario) {
          return res.status(400).json({
            message: 'Este cadastro não possui documento de voluntariado.'
          });
        }

        cruzado.statusVoluntariado = status;
      }

      if (processo === 'consignacao') {
        if (!cruzado.consignacao) {
          return res.status(400).json({
            message: 'Este cadastro não solicitou consignação.'
          });
        }

        if (!cruzado.documentoConsignacao) {
          return res.status(400).json({
            message: 'Este cadastro não possui documento de consignação.'
          });
        }

        cruzado.statusConsignacao =
          status === 'aprovado' ? 'aprovada' : 'rejeitada';
      }

      cruzado.updatedAt = new Date();
      await cruzado.save();

      if (status === 'aprovado' && cruzado.email) {
        const processoNome = processo === 'voluntariado'
          ? 'Termo de Trabalho Voluntário'
          : 'Consignação em Folha';
        const assunto = processo === 'voluntariado'
          ? 'Termo de voluntariado aprovado - Cruzada'
          : 'Consignação em folha aprovada - Cruzada';
        const texto = processo === 'voluntariado'
          ? `Olá, ${cruzado.nome}!\n\nSeu Termo de Trabalho Voluntário foi APROVADO pela Cruzada.\n\nObrigado!`
          : `Olá, ${cruzado.nome}!\n\nSeu pedido de Consignação em Folha foi APROVADO pela Cruzada.\n\nObrigado!`;
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h3>${processoNome} aprovado</h3>
            <p>Olá, <strong>${cruzado.nome}</strong>!</p>
            <p>Seu <strong>${processoNome}</strong> foi <strong>APROVADO</strong> pela Cruzada.</p>
            <p>Obrigado!</p>
          </div>
        `;

        try {
          await sendEmail({
            to: cruzado.email,
            subject: assunto,
            text: texto,
            html
          });
        } catch (emailError) {
          console.error(`Erro ao enviar aprovação de ${processo}:`, emailError);
        }
      }

      return res.json({
        message: processo === 'voluntariado'
          ? `Voluntariado ${status} com sucesso!`
          : `Consignação ${status === 'aprovado' ? 'aprovada' : 'rejeitada'} com sucesso!`
      });
    }

    // ==========================================
    // 2. APROVAÇÃO/REJEIÇÃO DO CADASTRO PRINCIPAL
    // ==========================================
    const tempCruzado = await CruzadoTemp.findById(req.params.id);

    if (!tempCruzado) {
      return res.status(404).json({
        message: 'Registro temporário não encontrado!'
      });
    }

    if (status === 'aprovado') {
      // Inicializar contador, caso não exista
      await CruzadoCounter.findByIdAndUpdate(
        'cruzado',
        { $setOnInsert: { nextNumeroCruzado: 7999 } },
        { upsert: true, new: true }
      );

      // Incrementar contador
      const counter2 = await CruzadoCounter.findByIdAndUpdate(
        'cruzado',
        { $inc: { nextNumeroCruzado: 1 } },
        { new: true }
      );

      const numeroCruzado = String(counter2.nextNumeroCruzado);

      const permanentCruzado = new Cruzado({
        ...tempCruzado.toObject(),

        numeroCruzado,
        status: 'aprovado',

        // Preservar decisões dos processos extras
        statusConsignacao: tempCruzado.consignacao
          ? (tempCruzado.statusConsignacao || 'pendente')
          : 'nao_solicitada',

        statusVoluntariado: tempCruzado.trabalharVoluntario
          ? (tempCruzado.statusVoluntariado || 'pendente')
          : 'nao_solicitado',

        dataAprovacao: new Date(),
        updatedAt: new Date()
      });

      await permanentCruzado.save();

      // Remover da coleção temporária
      await CruzadoTemp.findByIdAndDelete(req.params.id);

      // E-mails de aprovação do cadastro principal
      try {
        if (tempCruzado.email) {
          const baseUrl = process.env.APP_BASE_URL ||
            `http://localhost:${process.env.PORT || 3000}`;

          const carteirinhaUrl =
            `${baseUrl}/carteirinha.html?numeroCruzado=${numeroCruzado}`;

          const assuntoCandidato = 'Cadastro aprovado - Cruzada';

          const textoCandidato =
            `Olá, ${tempCruzado.nome}!\n\n` +
            `Seu cadastro foi APROVADO.\n\n` +
            `Número Cruzado: ${numeroCruzado}\n\n` +
            `Carteirinha digital: ${carteirinhaUrl}\n\n` +
            `Obrigado!`;

          const htmlCandidato = `
            <div style="font-family: Arial, sans-serif;">
              <h3>Cadastro aprovado</h3>
              <p>Olá, <strong>${tempCruzado.nome}</strong>!</p>
              <p>Seu cadastro foi <strong>APROVADO</strong>.</p>
              <p><strong>Número Cruzado:</strong> ${numeroCruzado}</p>
              <p>Sua carteirinha digital está disponível em:
                <a href="${carteirinhaUrl}">${carteirinhaUrl}</a>
              </p>
              <p>Obrigado!</p>
            </div>
          `;

          await sendEmail({
            to: tempCruzado.email,
            subject: assuntoCandidato,
            text: textoCandidato,
            html: htmlCandidato
          });
        }

      } catch (e) {
        console.error('Erro ao enviar e-mail do candidato (aprovado):', e);
      }

      try {
        if (process.env.SECRETARIO_EMAIL) {
          const assuntoSecretario = 'Cadastro aprovado - Cruzada';
          const textoSecretario =
            `O cadastro de ${tempCruzado.nome} foi aprovado.\n\n` +
            `Número Cruzado: ${numeroCruzado}\n` +
            `E-mail: ${tempCruzado.email || 'não informado'}\n`;
          const htmlSecretario = `
            <div style="font-family: Arial, sans-serif;">
              <h3>Cadastro aprovado</h3>
              <p>O cadastro de <strong>${tempCruzado.nome}</strong> foi aprovado.</p>
              <p><strong>Número Cruzado:</strong> ${numeroCruzado}</p>
              <p><strong>E-mail:</strong> ${tempCruzado.email || 'não informado'}</p>
            </div>
          `;

          await sendEmail({
            to: process.env.SECRETARIO_EMAIL,
            subject: assuntoSecretario,
            text: textoSecretario,
            html: htmlSecretario
          });
        }
      } catch (e) {
        console.error('Erro ao enviar e-mail ao secretário (aprovado):', e);
      }

      return res.json({
        message: 'Registro aprovado e movido para banco permanente!'
      });
    }

    // ==========================================
    // 3. REJEIÇÃO DO CADASTRO PRINCIPAL
    // ==========================================
    if (status === 'rejeitado') {
      try {
        if (tempCruzado.email) {
          const assuntoCandidato = 'Cadastro recusado - Cruzada';
          const motivoRejeicao = String(motivo).trim();

          const textoCandidato =
            `Olá, ${tempCruzado.nome}!\n\n` +
            `Seu cadastro foi RECUSADO pela administração.\n\n` +
            `Motivo: ${motivoRejeicao}\n\n` +
            `Obrigado.`;

          const htmlCandidato = `
            <div style="font-family: Arial, sans-serif;">
              <h3>Cadastro recusado</h3>
              <p>Olá, <strong>${tempCruzado.nome}</strong>!</p>
              <p>Seu cadastro foi <strong>RECUSADO</strong> pela administração.</p>
              <p><strong>Motivo:</strong> ${motivoRejeicao.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
              <p>Obrigado.</p>
            </div>
          `;

          await sendEmail({
            to: tempCruzado.email,
            subject: assuntoCandidato,
            text: textoCandidato,
            html: htmlCandidato
          });
        }
      } catch (e) {
        console.error(
          'Erro ao enviar e-mail do candidato (rejeitado):',
          e
        );
      }

      await CruzadoTemp.findByIdAndDelete(req.params.id);

      return res.json({
        message: 'Registro rejeitado e removido com sucesso!'
      });
    }

  } catch (err) {
    console.error('Erro ao atualizar status:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Não foi possível aprovar: CPF ou Email já existe no banco permanente!'
      });
    }

    return res.status(500).json({
      message: 'Erro ao atualizar status. Tente novamente.'
    });
  }
});
// Atualizar registro (se numeroCruzado fornecido)
router.put('/:numeroCruzado', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (!req.params.numeroCruzado) {
      return res.status(400).json({ message: 'Número do Cruzado é obrigatório!' });
    }

    const cruzado = await Cruzado.findOneAndUpdate({ numeroCruzado: req.params.numeroCruzado }, req.body, { new: true });
    if (!cruzado) return res.status(404).json({ message: 'Registro com número ' + req.params.numeroCruzado + ' não encontrado!' });
    res.json(cruzado);
  } catch (err) {
    console.error('Erro ao atualizar registro:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ message: `${field} já existe no sistema!` });
    }
    res.status(500).json({ message: 'Erro ao atualizar registro. Tente novamente.' });
  }
});

// Excluir registro
router.delete('/:numeroCruzado', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (!req.params.numeroCruzado) {
      return res.status(400).json({ message: 'Número do Cruzado é obrigatório!' });
    }

    const deletado = await Cruzado.findOneAndDelete({ numeroCruzado: req.params.numeroCruzado });
    if (!deletado) {
      return res.status(404).json({ message: 'Registro com número ' + req.params.numeroCruzado + ' não encontrado!' });
    }
    res.json({ message: 'Registro excluído com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir registro:', err);
    res.status(500).json({ message: 'Erro ao excluir registro. Tente novamente.' });
  }
});

// Servir foto pública da carteirinha; documentos exigem autenticação.
router.get('/image/:id', async (req, res) => {
  try {
    if (!req.params.id || req.params.id.length !== 24) {
      return res.status(400).json({ message: 'ID de arquivo inválido!' });
    }

    const bucket = getGridFSBucket();
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(req.params.id) }).toArray();
    const file = files[0];
    if (!file) return res.status(404).json({ message: 'Arquivo não encontrado!' });
    if (!String(file.contentType || '').toLowerCase().startsWith('image/')) {
      return res.status(403).json({ message: 'Acesso ao documento não autorizado.' });
    }

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(req.params.id));

    downloadStream.on('error', (err) => {
      console.error('Erro ao baixar arquivo:', err);
      res.status(404).json({ message: 'Arquivo não encontrado!' });
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error('Erro ao servir arquivo:', err);
    res.status(500).json({ message: 'Erro ao recuperar arquivo. Tente novamente.' });
  }
});

// Servir documentos somente para administradores ou para o titular autenticado.
router.get('/document/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID de arquivo inválido!' });
    }

    const authorization = req.header('Authorization') || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null;
    if (!token) return res.status(401).json({ message: 'Autenticação necessária.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.scope !== 'edit') {
      const user = await User.findById(decoded.id).select('role');
      if (!user || !['admin', 'secretario'].includes(user.role)) {
        return res.status(403).json({ message: 'Acesso não autorizado.' });
      }
    } else {
      const ownsFile = await Cruzado.exists({
        _id: decoded.cruzadoId,
        $or: [
          { certificadoIndicacao: req.params.id },
          { documentoVoluntario: req.params.id },
          { documentoConsignacao: req.params.id }
        ]
      });
      if (!ownsFile) return res.status(403).json({ message: 'Arquivo não pertence ao cadastro.' });
    }

    const bucket = getGridFSBucket();
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files[0]) return res.status(404).json({ message: 'Arquivo não encontrado!' });

    res.setHeader('Content-Type', files[0].contentType || 'application/pdf');
    bucket.openDownloadStream(fileId).on('error', () => {
      if (!res.headersSent) res.status(404).json({ message: 'Arquivo não encontrado!' });
    }).pipe(res);
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido ou acesso não autorizado.' });
  }
});

// Obter dados da carteirinha digital de um Cruzado aprovado
router.get('/carteirinha/:numeroCruzado', async (req, res) => {
  try {
    const { numeroCruzado } = req.params;
    if (!numeroCruzado) {
      return res.status(400).json({ message: 'Número do Cruzado é obrigatório.' });
    }

    const cruzado = await Cruzado.findOne({ numeroCruzado, status: 'aprovado' });
    if (!cruzado) {
      return res.status(404).json({ message: 'Carteirinha não encontrada para este número.' });
    }

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const validationUrl = `${baseUrl}/validar.html?numeroCruzado=${encodeURIComponent(cruzado.numeroCruzado)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, { width: 260 });
    const fotoUrl = cruzado.foto ? `/api/cruzados/image/${cruzado.foto}` : null;

    res.json({
      nome: cruzado.nome,
      numeroCruzado: cruzado.numeroCruzado,
      qrCodeDataUrl,
      fotoUrl
    });
  } catch (err) {
    console.error('Erro ao gerar carteirinha:', err);
    res.status(500).json({ message: 'Erro ao recuperar carteirinha. Tente novamente.' });
  }
});

// Listar registros com documento de consignação em folha

router.get('/consignacao', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  try {
    const [temporarios, permanentes] = await Promise.all([
      CruzadoTemp.find({
        status: 'aguardando_documentos',
        consignacao: true,
        statusConsignacao: 'pendente',
        documentoConsignacao: { $exists: true, $ne: null }
      })
        .sort({ createdAt: -1 })
        .select('nome email cpf numeroCruzado documentoConsignacao _id'),

      Cruzado.find({
        statusConsignacao: 'pendente',
        consignacao: true,
        documentoConsignacao: { $exists: true, $ne: null }
      })
        .sort({ createdAt: -1 })
        .select('nome email cpf numeroCruzado documentoConsignacao _id')
    ]);

    res.json([...temporarios, ...permanentes]);
  } catch (err) {
    console.error('Erro ao listar consignação:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Exportar para Excel
router.get('/export/excel', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  try {
    // Buscar todos os Cruzados aprovados
    const cruzados = await Cruzado.find({ status: 'aprovado' }).sort({ createdAt: -1 });

    if (cruzados.length === 0) {
      return res.status(400).json({ message: 'Nenhum registro aprovado para exportar!' });
    }

    const SEM_DADOS = 'Sem dados';

    const formatarTexto = (valor) => {
      if (valor === null || valor === undefined || String(valor).trim() === '') {
        return SEM_DADOS;
      }
      return String(valor);
    };

    const formatarBooleano = (valor) => {
      if (valor === null || valor === undefined) return SEM_DADOS;
      return valor ? 'Sim' : 'Não';
    };

    const formatarData = (valor) => {
      if (!valor) return SEM_DADOS;
      const data = new Date(valor);
      return Number.isNaN(data.getTime())
        ? SEM_DADOS
        : data.toLocaleDateString('pt-BR');
    };

    const calcularIdade = (dataNascimento) => {
      if (!dataNascimento) return SEM_DADOS;
      const nascimento = new Date(dataNascimento);
      if (Number.isNaN(nascimento.getTime())) return SEM_DADOS;

      const hoje = new Date();
      let idade = hoje.getFullYear() - nascimento.getFullYear();
      const mes = hoje.getMonth() - nascimento.getMonth();
      if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
        idade--;
      }
      return idade;
    };

    const formatarCPF = (cpf) => {
      const cpfLimpo = cpf ? String(cpf).replace(/\D/g, '') : '';
      if (!cpfLimpo) return SEM_DADOS;
      return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    // Exporta somente dados cadastrais. Fotos e PDFs ficam fora da planilha.
    const dadosExportacao = cruzados.map((cruzado, index) => ({
      'Nº': index + 1,
      'Nome': formatarTexto(cruzado.nome),
      'CPF': formatarCPF(cruzado.cpf),
      'Celular': formatarTexto(cruzado.celular),
      'E-mail': formatarTexto(cruzado.email),
      'Estado': formatarTexto(cruzado.estado),
      'Cidade': formatarTexto(cruzado.cidade),
      'Endereço': formatarTexto(cruzado.endereco),
      'CEP': formatarTexto(cruzado.cep),
      'Sexo': formatarTexto(cruzado.sexo),
      'Data de nascimento': formatarData(cruzado.dataNascimento),
      'Idade': calcularIdade(cruzado.dataNascimento),
      'Vínculo profissional': formatarTexto(cruzado.vinculoProfissional),
      'Especificação do vínculo': formatarTexto(cruzado.especificarVinculo),
      'Situação profissional': formatarTexto(cruzado.situacaoProfissional),
      'Especificação da situação': formatarTexto(cruzado.especificarSituacao),
      'Formação': formatarTexto(cruzado.formacao),
      'Núcleo/GEDE': formatarTexto(cruzado.nucleoOuGede),
      'Nome do responsável pela indicação': formatarTexto(cruzado.nomeResponsavelIndicacao),
      'CPF do responsável pela indicação': formatarCPF(cruzado.cpfResponsavelIndicacao),
      'Deseja contribuir': formatarBooleano(cruzado.desejaContribuir),
      'Valor da contribuição': cruzado.valorContribuicao === null || cruzado.valorContribuicao === undefined
        ? SEM_DADOS
        : cruzado.valorContribuicao,
      'Consignação em folha': formatarBooleano(cruzado.consignacao),
      'Número Cruzado': formatarTexto(cruzado.numeroCruzado),
      'Encarnado': formatarBooleano(cruzado.encarnado),
      'Trabalha como voluntário': formatarBooleano(cruzado.trabalharVoluntario),
      'Status do cadastro': formatarTexto(cruzado.status),
      'Status da consignação': formatarTexto(cruzado.statusConsignacao),
      'Status do voluntariado': formatarTexto(cruzado.statusVoluntariado),
      'Data de aprovação': formatarData(cruzado.dataAprovacao),
      'Origem do cadastro': formatarTexto(cruzado.origem),
      'Data de criação': formatarData(cruzado.createdAt),
      'Data de atualização': formatarData(cruzado.updatedAt)
    }));

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);

    worksheet['!cols'] = Object.keys(dadosExportacao[0]).map((header) => ({
      wch: Math.min(Math.max(header.length + 4, 14), 42)
    }));

    // Estilizar cabeçalho
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '366092' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cruzados Aprovados');

    // Gerar arquivo
    const fileName = `Cruzados_Aprovados_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.send(buffer);
  } catch (err) {
    console.error('Erro ao exportar para Excel:', err);
    res.status(500).json({ message: 'Erro ao gerar arquivo Excel. Tente novamente.' });
  }
});

// Importar base antiga a partir de uma planilha Excel
router.post('/import/excel', authenticate, authorize('admin', 'secretario'), (req, res) => {
  uploadExcel(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message || 'Erro ao enviar o arquivo Excel.' });
    }

    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ message: 'Envie um arquivo Excel válido.' });
      }

      const target = req.body.target === 'temp' ? 'temp' : 'permanent';
      const sheetName = req.body.sheet || undefined;
      const dryRun = String(req.body.dryRun || '').toLowerCase() === 'true';

      const summary = await importFromBuffer(req.file.buffer, { sheetName, target, dryRun });

      return res.json({
        message: dryRun ? 'Validação da planilha concluída.' : 'Importação concluída com sucesso.',
        summary,
        dryRun
      });
    } catch (err) {
      console.error('Erro ao importar base antiga:', err);
      return res.status(500).json({ message: err.message || 'Erro ao importar base antiga.' });
    }
  });
});

// Buscar apenas os dados necessários para iniciar a verificação de identidade.
router.get('/buscar', async (req, res) => {
  try {
    const cpfQuery = req.query.cpf;
    const numeroCruzadoQuery = (req.query.numeroCruzado || req.query.numero || '').trim();

    if (!cpfQuery && !numeroCruzadoQuery) {
      return res.status(400).json({ message: 'Informe CPF ou Número Cruzado!' });
    }

    // 1) Buscar por numeroCruzado (chave principal dos registros legados)
    if (numeroCruzadoQuery) {
      const cruzadoPorNumero = await Cruzado.findOne({ numeroCruzado: numeroCruzadoQuery });
      if (cruzadoPorNumero) {
        return res.json({
          _id: cruzadoPorNumero._id,
          nome: cruzadoPorNumero.nome,
          numeroCruzado: cruzadoPorNumero.numeroCruzado,
          possuiEmail: Boolean(cruzadoPorNumero.email)
        });
      }
    }

    if (!cpfQuery) {
      return res.status(404).json({ message: 'Cadastro não encontrado!' });
    }

    // 2) Tentar busca EXATA pelo valor salvo (útil se o banco guarda CPF formatado)
    let cruzado = await Cruzado.findOne({ cpf: cpfQuery });
    if (cruzado) {
      return res.json({
        _id: cruzado._id,
        nome: cruzado.nome,
        numeroCruzado: cruzado.numeroCruzado,
        possuiEmail: Boolean(cruzado.email)
      });
    }

    // 3) Tentar buscar por versão sem formatação (somente dígitos)
    const cpfLimpo = cpfQuery.replace(/\D/g, '');
    if (cpfLimpo && cpfLimpo.length === 11) {
      cruzado = await Cruzado.findOne({ cpf: cpfLimpo });
      if (cruzado) {
        return res.json({
          _id: cruzado._id,
          nome: cruzado.nome,
          numeroCruzado: cruzado.numeroCruzado,
          possuiEmail: Boolean(cruzado.email)
        });
      }
    }

    // 4) Fallback mais robusto: comparar CPF usando regex compatível
    try {
      cruzado = await Cruzado.findOne({ cpf: buildCpfRegex(cpfLimpo) });
      if (cruzado) {
        return res.json({
          _id: cruzado._id,
          nome: cruzado.nome,
          numeroCruzado: cruzado.numeroCruzado,
          possuiEmail: Boolean(cruzado.email)
        });
      }
    } catch (e) {
      // Ignorar; já tentamos os casos exatos e sem formatação
    }

    return res.status(404).json({ message: 'Cadastro não encontrado!' });
  } catch (err) {
    console.error('Erro ao buscar Cruzado:', err);
    res.status(500).json({ message: 'Erro ao buscar cadastro. Tente novamente.' });
  }
});

// Retorna dados completos somente após a validação do token de edição.
router.get('/editar/:id', verifyEditToken, async (req, res) => {
  const cruzado = await Cruzado.findById(req.params.id);
  if (!cruzado) return res.status(404).json({ message: 'Cadastro não encontrado!' });
  res.json(cruzado);
});

// Atualizar Cruzado por ID (para edição do usuário)
router.put('/atualizar/:id', handleUpload, verifyEditToken, async (req, res) => {
  try {
    const uploadError = validateUploadedContent(req.files);
    if (uploadError) return res.status(400).json({ message: uploadError });

    const cruzadoId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cruzadoId)) {
      return res.status(400).json({ message: 'ID inválido!' });
    }

    // Sanitizar e normalizar campos recebidos antes da validação
    const sanitize = (body) => {
      Object.keys(body).forEach((key) => {
        const val = body[key];
        if (val === '') {
          delete body[key];
          return;
        }
        if (typeof val === 'string') {
          if (val === 'true') body[key] = true;
          else if (val === 'false') body[key] = false;
          else if (key === 'valorContribuicao') {
            const n = Number(val);
            if (!Number.isNaN(n)) body[key] = n;
            else delete body[key];
          }
        }
      });
    };

    sanitize(req.body);

    // Validar dados com schema flexível (aceita registros legados sem CPF/email)
    const { error } = cruzadoUpdateSchema.validate(req.body);
    if (error) {
      const field = error.details[0].context.label || error.details[0].path[0];
      return res.status(400).json({ message: `Campo inválido: ${field}. ${error.details[0].message}` });
    }

    // Buscar Cruzado existente
    const cruzadoExistente = await Cruzado.findById(cruzadoId);
    if (!cruzadoExistente) {
      return res.status(404).json({ message: 'Cadastro não encontrado!' });
    }

    // Verificar se novo CPF já existe (se foi alterado) — somente se CPF foi informado
    const cpfNovoLimpo = req.body.cpf ? normalizeCpf(req.body.cpf) : '';
    const cpfExistenteLimpo = cruzadoExistente.cpf ? normalizeCpf(cruzadoExistente.cpf) : '';
    if (cpfNovoLimpo && cpfNovoLimpo !== cpfExistenteLimpo) {
      const cpfJaExiste = await Cruzado.findOne({ cpf: buildCpfRegex(cpfNovoLimpo) });
      if (cpfJaExiste) {
        return res.status(400).json({ message: 'CPF já cadastrado no sistema!' });
      }
    }

    // Verificar se novo email já existe (se foi alterado) — somente se email foi informado
    if (req.body.email && req.body.email !== cruzadoExistente.email) {
      const emailJaExiste = await Cruzado.findOne({ email: req.body.email });
      if (emailJaExiste) {
        return res.status(400).json({ message: 'Email já cadastrado no sistema!' });
      }
    }

    // Processar novos arquivos se enviados
    let novaFotoId = cruzadoExistente.foto;
    let novocertificadoId = cruzadoExistente.certificadoIndicacao;
    let novoDocumentoConsignacaoId = cruzadoExistente.documentoConsignacao;
    let novoDocumentoVoluntarioId = cruzadoExistente.documentoVoluntario;

    const consignacaoSolicitada = req.body.consignacao === true;
    const voluntariadoSolicitado = req.body.trabalharVoluntario === true;
    const temNovoDocumentoConsignacao = Boolean(
      req.files && req.files.documentoConsignacao && req.files.documentoConsignacao[0]
    );
    const temNovoDocumentoVoluntario = Boolean(
      req.files && req.files.documentoVoluntario && req.files.documentoVoluntario[0]
    );

    if (consignacaoSolicitada && !cruzadoExistente.documentoConsignacao && !temNovoDocumentoConsignacao) {
      return res.status(400).json({
        message: 'Envie o termo de consignação em folha (PDF) para solicitar a aprovação.'
      });
    }

    if (voluntariadoSolicitado && !cruzadoExistente.documentoVoluntario && !temNovoDocumentoVoluntario) {
      return res.status(400).json({
        message: 'Envie o termo de voluntariado (PDF) para solicitar a aprovação.'
      });
    }

    if (req.files && req.files.foto && req.files.foto[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.foto[0].originalname, {
        contentType: req.files.foto[0].mimetype
      });
      uploadStream.end(req.files.foto[0].buffer);
      novaFotoId = uploadStream.id;
    }

    if (req.files && req.files.certificadoIndicacao && req.files.certificadoIndicacao[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.certificadoIndicacao[0].originalname, {
        contentType: req.files.certificadoIndicacao[0].mimetype
      });
      uploadStream.end(req.files.certificadoIndicacao[0].buffer);
      novocertificadoId = uploadStream.id;
    }

    if (req.files && req.files.documentoConsignacao && req.files.documentoConsignacao[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.documentoConsignacao[0].originalname, {
        contentType: req.files.documentoConsignacao[0].mimetype
      });
      uploadStream.end(req.files.documentoConsignacao[0].buffer);
      novoDocumentoConsignacaoId = uploadStream.id;
    }

    if (req.files && req.files.documentoVoluntario && req.files.documentoVoluntario[0]) {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(req.files.documentoVoluntario[0].originalname, {
        contentType: req.files.documentoVoluntario[0].mimetype
      });
      uploadStream.end(req.files.documentoVoluntario[0].buffer);
      novoDocumentoVoluntarioId = uploadStream.id;
    }

    // Preparar dados para atualização (não alterar certificadoIndicacao)
    const dadosAtualizacao = {
      ...req.body,
      foto: novaFotoId,
      certificadoIndicacao: novocertificadoId,
      documentoVoluntario: novoDocumentoVoluntarioId,
      updatedAt: Date.now()
    };

    if (novoDocumentoConsignacaoId) {
      dadosAtualizacao.documentoConsignacao = novoDocumentoConsignacaoId;
    }

    if (!consignacaoSolicitada) {
      dadosAtualizacao.statusConsignacao = 'nao_solicitada';
    } else if (temNovoDocumentoConsignacao) {
      dadosAtualizacao.statusConsignacao = 'pendente';
    }

    if (!voluntariadoSolicitado) {
      dadosAtualizacao.statusVoluntariado = 'nao_solicitado';
    } else if (temNovoDocumentoVoluntario) {
      dadosAtualizacao.statusVoluntariado = 'pendente';
    }
    
    // Remover certificadoIndicacao se vier vazio/inválido (manter o original)
    if (!req.files || !req.files.certificadoIndicacao || !req.files.certificadoIndicacao[0]) {
      delete dadosAtualizacao.certificadoIndicacao;
    }

    // Atualizar Cruzado
    const cruzadoAtualizado = await Cruzado.findByIdAndUpdate(cruzadoId, dadosAtualizacao, { new: true });

    res.json({ message: 'Cadastro atualizado com sucesso!', cruzado: cruzadoAtualizado });
  } catch (err) {
    console.error('Erro ao atualizar Cruzado:', err);
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      if (field === 'cpf') {
        return res.status(400).json({ message: 'CPF já cadastrado no sistema!' });
      } else if (field === 'email') {
        return res.status(400).json({ message: 'Email já cadastrado no sistema!' });
      }
      return res.status(400).json({ message: `${field} já existe no sistema!` });
    }

    res.status(500).json({ message: 'Erro ao atualizar cadastro. Tente novamente.' });
  }
});

module.exports = router;
