const mongoose = require('mongoose');

const cruzadoCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nextNumeroCruzado: { type: Number, required: true, default: 8000 }
});

module.exports = mongoose.model('CruzadoCounter', cruzadoCounterSchema, 'cruzado_counters');

