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
    if (error) return res.status(400).json({ message: error.details[0].message });

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
    res.status(500).json({ message: 'Erro interno do servidor' });
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
  try {
    const tempCruzado = await CruzadoTemp.findById(req.params.id);
    if (!tempCruzado) return res.status(404).json({ message: 'Registro não encontrado' });

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
    } else if (status === 'rejeitado') {
      // Apenas marcar como rejeitado na temporária (será deletado pelo TTL)
      await CruzadoTemp.findByIdAndUpdate(req.params.id, { status: 'rejeitado', updatedAt: Date.now() });
    }
    res.json({ message: 'Status atualizado' });
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualizar registro (se numeroCruzado fornecido)
router.put('/:numeroCruzado', authenticate, authorize('admin'), async (req, res) => {
  try {
    const cruzado = await Cruzado.findOneAndUpdate({ numeroCruzado: req.params.numeroCruzado }, req.body, { new: true });
    if (!cruzado) return res.status(404).json({ message: 'Registro não encontrado' });
    res.json(cruzado);
  } catch (err) {
    console.error('Erro ao atualizar registro:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Excluir registro
router.delete('/:numeroCruzado', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Cruzado.findOneAndDelete({ numeroCruzado: req.params.numeroCruzado });
    res.json({ message: 'Registro excluído' });
  } catch (err) {
    console.error('Erro ao excluir registro:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Servir imagem do GridFS
router.get('/image/:id', async (req, res) => {
  try {
    const bucket = getGridFSBucket();
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(req.params.id));

    downloadStream.on('error', (err) => {
      console.error('Erro ao baixar imagem:', err);
      res.status(404).json({ message: 'Imagem não encontrada' });
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error('Erro ao servir imagem:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

module.exports = router;
