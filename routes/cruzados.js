const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
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

// Exportar para Excel
router.get('/export/excel', authenticate, authorize('admin', 'secretario'), async (req, res) => {
  try {
    // Buscar todos os Cruzados aprovados
    const cruzados = await Cruzado.find({ status: 'aprovado' }).sort({ createdAt: -1 });

    if (cruzados.length === 0) {
      return res.status(400).json({ message: 'Nenhum registro aprovado para exportar!' });
    }

    // Calcular idade a partir da data de nascimento
    const calcularIdade = (dataNascimento) => {
      const hoje = new Date();
      const nascimento = new Date(dataNascimento);
      let idade = hoje.getFullYear() - nascimento.getFullYear();
      const mes = hoje.getMonth() - nascimento.getMonth();
      if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
        idade--;
      }
      return idade;
    };

    // Formatar CPF
    const formatarCPF = (cpf) => {
      const cpfLimpo = cpf.replace(/\D/g, '');
      return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    // Preparar dados para exportação (removido 'Status' e adicionadas colunas solicitadas)
    const dadosExportacao = cruzados.map((cruzado, index) => ({
      '#': index + 1,
      'Nome': cruzado.nome,
      'CPF': formatarCPF(cruzado.cpf),
      'Email': cruzado.email,
      'Celular': cruzado.celular,
      'Idade': calcularIdade(cruzado.dataNascimento),
      'Sexo': cruzado.sexo || '',
      'Estado': cruzado.estado || '',
      'Número Cruzado': cruzado.numeroCruzado || '',
      'Encarnado': cruzado.encarnado ? 'Sim' : 'Não',
      'Contribui': cruzado.desejaContribuir ? 'Sim' : 'Não',
      'Valor Contribuição': cruzado.valorContribuicao != null ? cruzado.valorContribuicao : '',
      'Consignado': cruzado.consignacao ? 'Sim' : 'Não',
      'Vínculo Profissional': cruzado.vinculoProfissional || '',
      'Núcleo/GEDE': cruzado.nucleoOuGede || ''
    }));

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);

    // Definir largura das colunas (ajustado para novas colunas)
    const colWidths = [
      { wch: 5 },   // #
      { wch: 30 },  // Nome
      { wch: 15 },  // CPF
      { wch: 30 },  // Email
      { wch: 16 },  // Celular
      { wch: 8 },   // Idade
      { wch: 10 },  // Sexo
      { wch: 8 },   // Estado
      { wch: 15 },  // Número Cruzado
      { wch: 10 },  // Encarnado
      { wch: 14 },  // Deseja Contribuir
      { wch: 18 },  // Valor Contribuição
      { wch: 12 },  // Consignação
      { wch: 25 },  // Vínculo Profissional
      { wch: 20 }   // Núcleo/GEDE
    ];
    worksheet['!cols'] = colWidths;

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

// Buscar Cruzado por CPF (para edição)
router.get('/buscar', async (req, res) => {
  try {
    const cpfQuery = req.query.cpf;

    if (!cpfQuery) {
      return res.status(400).json({ message: 'CPF inválido!' });
    }

    // 1) Tentar busca EXATA pelo valor salvo (útil se o banco guarda CPF formatado)
    let cruzado = await Cruzado.findOne({ cpf: cpfQuery });
    if (cruzado) return res.json(cruzado);

    // 2) Tentar buscar por versão sem formatação (somente dígitos)
    const cpfLimpo = cpfQuery.replace(/\D/g, '');
    if (cpfLimpo && cpfLimpo.length === 11) {
      cruzado = await Cruzado.findOne({ cpf: cpfLimpo });
      if (cruzado) return res.json(cruzado);
    }

    // 3) Fallback mais robusto: comparar removendo non-digits do campo no DB (se disponível)
    try {
      cruzado = await Cruzado.findOne({
        $expr: { $eq: [ { $regexReplace: { input: '$cpf', regex: '\\D', replacement: '' } }, cpfLimpo ] }
      });
      if (cruzado) return res.json(cruzado);
    } catch (e) {
      // Ignorar; já tentamos os casos exatos e sem formatação
    }

    return res.status(404).json({ message: 'Cadastro não encontrado!' });

    res.json(cruzado);
  } catch (err) {
    console.error('Erro ao buscar Cruzado:', err);
    res.status(500).json({ message: 'Erro ao buscar cadastro. Tente novamente.' });
  }
});

// Atualizar Cruzado por ID (para edição do usuário)
router.put('/atualizar/:id', upload, async (req, res) => {
  try {
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

    // Validar dados
    const { error } = cruzadoSchema.validate(req.body);
    if (error) {
      const field = error.details[0].context.label || error.details[0].path[0];
      return res.status(400).json({ message: `Campo inválido: ${field}. ${error.details[0].message}` });
    }

    // Buscar Cruzado existente
    const cruzadoExistente = await Cruzado.findById(cruzadoId);
    if (!cruzadoExistente) {
      return res.status(404).json({ message: 'Cadastro não encontrado!' });
    }

    // Verificar se novo CPF já existe (se foi alterado)
    if (req.body.cpf !== cruzadoExistente.cpf) {
      const cpfJaExiste = await Cruzado.findOne({ cpf: req.body.cpf });
      if (cpfJaExiste) {
        return res.status(400).json({ message: 'CPF já cadastrado no sistema!' });
      }
    }

    // Verificar se novo email já existe (se foi alterado)
    if (req.body.email !== cruzadoExistente.email) {
      const emailJaExiste = await Cruzado.findOne({ email: req.body.email });
      if (emailJaExiste) {
        return res.status(400).json({ message: 'Email já cadastrado no sistema!' });
      }
    }

    // Processar novos arquivos se enviados
    let novaFotoId = cruzadoExistente.foto;
    let novocertificadoId = cruzadoExistente.certificadoIndicacao;

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

    // Preparar dados para atualização
    const dadosAtualizacao = {
      ...req.body,
      foto: novaFotoId,
      certificadoIndicacao: novocertificadoId,
      updatedAt: Date.now()
    };

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
