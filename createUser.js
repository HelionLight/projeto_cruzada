require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Conectado ao MongoDB');

    const user = new User({
      username: 'secretaria@cme.org.br',
      password: 'cruzada#44',  // Será hashada automaticamente
      role: 'admin'
    });

    await user.save();
    console.log('Usuário criado com sucesso!');
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    mongoose.connection.close();
  }
}

createUser();
