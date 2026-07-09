const jwt = require('jsonwebtoken');
const Cruzado = require('../models/Cruzado');

const normalizeCpf = (cpf) => String(cpf || '').replace(/\D/g, '');

const verifyEditToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!token) {
      return res.status(401).json({ message: 'Token de verificação é obrigatório para atualizar.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.scope !== 'edit' || !decoded.cpf) {
      return res.status(403).json({ message: 'Token inválido ou sem permissão de edição.' });
    }

    // Armazenar CPF normalizado no request
    req.editCpf = normalizeCpf(decoded.cpf);

    // Opcional: checar se o CPF do token é o mesmo do cadastro sendo atualizado
    const cruzadoId = req.params.id;
    if (cruzadoId) {
      const cruzado = await Cruzado.findById(cruzadoId).select('cpf');
      if (!cruzado) return res.status(404).json({ message: 'Cadastro não encontrado!' });

      const cruzadoCpfNorm = normalizeCpf(cruzado.cpf);
      if (cruzadoCpfNorm !== req.editCpf) {
        return res.status(403).json({ message: 'Token não corresponde ao CPF do cadastro.' });
      }
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
};

module.exports = verifyEditToken;

