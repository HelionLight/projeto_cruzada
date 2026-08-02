const mongoose = require('mongoose');

const emailVerificationTokenSchema = new mongoose.Schema({
  cpf: { type: String, default: null },
  numeroCruzado: { type: String, default: null },
  nome: { type: String, default: null },
  cruzadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cruzado', default: null },
  tokenId: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date, default: null }
});

// Índice para busca por CPF
emailVerificationTokenSchema.index({ cpf: 1 });
// Índice para busca por numeroCruzado (fluxo legado sem CPF)
emailVerificationTokenSchema.index({ numeroCruzado: 1 });
// Índice para busca por cruzadoId
emailVerificationTokenSchema.index({ cruzadoId: 1 });

// TTL opcional (se o Mongo estiver configurado para TTL por índice)
// note: index funciona se expiresAt for Date
emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerificationToken', emailVerificationTokenSchema, 'email_verification_tokens');

