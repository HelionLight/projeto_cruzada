const mongoose = require('mongoose');

const emailVerificationTokenSchema = new mongoose.Schema({
  cpf: { type: String, required: true, index: true },
  tokenId: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date, default: null }
});

// TTL opcional (se o Mongo estiver configurado para TTL por índice)
// note: index funciona se expiresAt for Date
emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerificationToken', emailVerificationTokenSchema, 'email_verification_tokens');

