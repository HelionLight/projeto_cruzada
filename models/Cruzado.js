const mongoose = require('mongoose');

const cruzadoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  cpf: { type: String, default: null },
  celular: { type: String, default: null },
  email: { type: String, default: null },
  estado: { type: String, default: null },
  cidade: { type: String, default: null },
  endereco: { type: String, default: null },
  cep: { type: String, default: null },
  sexo: { type: String, enum: ['masculino', 'feminino', null], default: null },
  dataNascimento: { type: Date, default: null },
  foto: { type: mongoose.Schema.Types.ObjectId }, // ID do arquivo no GridFS
  vinculoProfissional: {
    type: String,
    enum: ['Marinha', 'Exército', 'Força Aérea', 'Polícia Militar', 'Corpo de Bombeiros Militar', 'Civil', 'Outros', null],
    default: null
  },
  especificarVinculo: { type: String }, // Para "Outros" ou militares
  situacaoProfissional: {
    type: String,
    enum: ['Ativa', 'Reserva', 'Reformado', 'Aposentado', 'Pensionista', 'Outros', null],
    default: null
  },
  especificarSituacao: { type: String }, // Para "Outros"
  formacao: {
    type: String,
    enum: ['fundamental', 'medio', 'superior', 'mestre', 'doutor', null],
    default: null
  },
  nucleoOuGede: { type: String, default: null },
  nomeResponsavelIndicacao: { type: String },
  cpfResponsavelIndicacao: { type: String },
  certificadoIndicacao: { type: mongoose.Schema.Types.ObjectId }, // ID do arquivo no GridFS
  desejaContribuir: { type: Boolean, default: null },
  valorContribuicao: { type: Number },
  consignacao: { type: Boolean }, // Apenas para Marinha/Exército
  documentoConsignacao: { type: mongoose.Schema.Types.ObjectId }, // ID do arquivo no GridFS
  numeroCruzado: { type: String }, // Chave principal dos registros legados
  encarnado: { type: Boolean, default: null },
  trabalharVoluntario: { type: Boolean, default: false },
  documentoVoluntario: { type: mongoose.Schema.Types.ObjectId }, // ID do arquivo no GridFS
  status: { type: String, enum: ['pendente', 'aguardando_documentos', 'aprovado', 'rejeitado'], default: 'pendente' },
  dataAprovacao: { type: Date },
  origem: { type: String, enum: ['novo', 'legado'], default: 'novo' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índice parcial único: numeroCruzado como chave principal (quando presente)
// Permite múltiplos documentos sem numeroCruzado, mas evita duplicidade nos legados.
cruzadoSchema.index(
  { numeroCruzado: 1 },
  { unique: true, partialFilterExpression: { numeroCruzado: { $type: 'string', $gt: '' } } }
);

// Índice parcial único: CPF somente quando preenchido
// Permite múltiplos registros sem CPF (null/vazio) sem conflito de unique.
cruzadoSchema.index(
  { cpf: 1 },
  { unique: true, partialFilterExpression: { cpf: { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.model('Cruzado', cruzadoSchema);

