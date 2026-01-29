const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Cruzado = require('../models/Cruzado');
const CruzadoTemp = require('../models/CruzadoTemp');
const { authenticate, authorize } = require('../middleware/auth');
const Joi = require('joi');

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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB por arquivo
}).fields([
  { name: 'foto', maxCount: 1 },
  { name: 'certificadoIndicacao', maxCount: 1 }
]);

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
  encarnado: Joi.boolean().required()
});

// Submeter formulário
router.post('/register', upload, async (req, res) => {
  try {
    const { error } = cruzadoSchema.validate(req.body);
    if (error) {
      const field = error.details[0].context.label || error.details[0].path[0];
      return res.status(400).json({ message: `Campo inválido: ${field}. ${error.details[0].message}` });
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

    const cruzadoData = {
      ...req.body,
      foto: fotoId,
      certificadoIndicacao: certificadoId
    };

    const cruzado = new CruzadoTemp(cruzadoData);
    await cruzado.save();
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

// Listar registros pendentes (admin)
router.get('/pending', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  try {
    const pendentes = await CruzadoTemp.find({ status: 'pendente' });
    res.json(pendentes);
  } catch (err) {
    console.error('Erro ao listar pendentes:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Aprovar/rejeitar
router.put('/:id/status', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  const { status } = req.body; // 'aprovado' ou 'rejeitado'
  
  if (!status || !['aprovado', 'rejeitado'].includes(status)) {
    return res.status(400).json({ message: 'Status inválido! Use "aprovado" ou "rejeitado".' });
  }

  try {
    const tempCruzado = await CruzadoTemp.findById(req.params.id);
    if (!tempCruzado) return res.status(404).json({ message: 'Registro não encontrado!' });

    if (status === 'aprovado') {
      // Mover para coleção permanente
      const permanentCruzado = new Cruzado({
        ...tempCruzado.toObject(),
        status: 'aprovado',
        updatedAt: Date.now()
      });
      await permanentCruzado.save();
      // Remover da temporária
      await CruzadoTemp.findByIdAndDelete(req.params.id);
      res.json({ message: 'Registro aprovado e movido para banco permanente!' });
    } else if (status === 'rejeitado') {
      // Apenas marcar como rejeitado na temporária (será deletado pelo TTL)
      await CruzadoTemp.findByIdAndUpdate(req.params.id, { status: 'rejeitado', updatedAt: Date.now() });
      res.json({ message: 'Registro rejeitado com sucesso!' });
    }
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Não foi possível aprovar: CPF ou Email já existe no banco permanente!' });
    }
    res.status(500).json({ message: 'Erro ao atualizar status. Tente novamente.' });
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

// Servir imagem do GridFS
router.get('/image/:id', async (req, res) => {
  try {
    if (!req.params.id || req.params.id.length !== 24) {
      return res.status(400).json({ message: 'ID de arquivo inválido!' });
    }

    const bucket = getGridFSBucket();
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

module.exports = router;
