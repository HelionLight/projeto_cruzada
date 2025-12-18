const mongoose = require('mongoose');

const cruzadoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  cpf: { type: String, required: true, unique: true },
  celular: { type: String, required: true },
  email: { type: String, required: true },
  estado: { type: String, required: true },
  cidade: { type: String, required: true },
  endereco: { type: String, required: true },
  cep: { type: String, required: true },
  sexo: { type: String, enum: ['masculino', 'feminino'], required: true },
  dataNascimento: { type: Date, required: true },
  foto: { type: mongoose.Schema.Types.ObjectId }, // ID do arquivo no GridFS
  vinculoProfissional: {
    type: String,
    enum: ['Marinha', 'Exército', 'Força Aérea', 'Polícia Militar', 'Corpo de Bombeiros Militar', 'Civil', 'Outros'],
    required: true
  },
  especificarVinculo: { type: String }, // Para "Outros" ou militares
  situacaoProfissional: {
    type: String,
    enum: ['Ativa', 'Reserva', 'Reformado', 'Aposentado', 'Pensionista', 'Outros'],
    required: true
  },
  especificarSituacao: { type: String }, // Para "Outros"
  formacao: {
    type: String,
    enum: ['fundamental', 'medio', 'superior', 'mestre', 'doutor'],
    required: true
  },
  nucleoOuGede: { type: String, required: true },
  nomeResponsavelIndicacao: { type: String },
  cpfResponsavelIndicacao: { type: String },
  certificadoIndicacao: { type: mongoose.Schema.Types.ObjectId }, // ID do arquivo no GridFS
  desejaContribuir: { type: Boolean, required: true },
  valorContribuicao: { type: Number },
  consignacao: { type: Boolean }, // Apenas para Marinha/Exército
  numeroCruzado: { type: String }, // Para alteração/exclusão
  encarnado: { type: Boolean, required: true },
  status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado'], default: 'pendente' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cruzado', cruzadoSchema);
