require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Conectado ao MongoDB');

    // Corrigir índices únicos antigos que impediriam múltiplos registros sem CPF.
    // O schema atual usa índice parcial (cpf preenchido), mas a collection pode
    // ter o índice único antigo (cpf_1) criado pela versão anterior do schema.
    try {
      const collection = mongoose.connection.collection('cruzados');
      const indexes = await collection.indexes();
      const cpfUniqueOld = indexes.find((idx) => {
        const keys = idx.key;
        return keys && Object.prototype.hasOwnProperty.call(keys, 'cpf') && idx.unique === true;
      });

      if (cpfUniqueOld) {
        await collection.dropIndex(cpfUniqueOld.name);
        console.log('Índice único antigo de CPF removido:', cpfUniqueOld.name);
      }

      // Reindexar com base no schema atual (índices parciais)
      await mongoose.model('Cruzado').syncIndexes();
      console.log('Índices do modelo Cruzado sincronizados.');
    } catch (err) {
      console.warn('Aviso ao ajustar índices do Cruzado:', err.message);
    }
  })
  .catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1); // Encerra o processo se não conseguir conectar
  });

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cruzados', require('./routes/cruzados'));
app.use('/api/auth/email-verification', require('./routes/emailVerification'));
app.use('/api/validacao', require('./routes/validacao'));

// Servir frontend estático (se houver)
// Servir logo na raiz (arquivo em project root)
app.get('/logo_cruzada.jpeg', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo_cruzada.jpeg'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Rota padrão
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para painel admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
