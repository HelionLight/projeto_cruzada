const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
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

    if (!decoded || decoded.scope !== 'edit') {
      return res.status(403).json({ message: 'Token inválido ou sem permissão de edição.' });
    }

    // Armazenar identificadores no request
    req.editCpf = normalizeCpf(decoded.cpf);
    req.editNumeroCruzado = decoded.numeroCruzado || null;
    req.editCruzadoId = decoded.cruzadoId || null;

    // Validar se o token corresponde ao cadastro sendo atualizado
    const cruzadoId = req.params.id;
    if (cruzadoId) {
      if (!mongoose.Types.ObjectId.isValid(cruzadoId)) {
        return res.status(400).json({ message: 'ID inválido!' });
      }

      const cruzado = await Cruzado.findById(cruzadoId).select('cpf numeroCruzado');
      if (!cruzado) return res.status(404).json({ message: 'Cadastro não encontrado!' });

      // Se o token contém cruzadoId, deve bater com o cadastro
      if (req.editCruzadoId && String(req.editCruzadoId) !== String(cruzado._id)) {
        return res.status(403).json({ message: 'Token não corresponde ao cadastro.' });
      }

      // Fallback: se não há cruzadoId, validar por CPF ou numeroCruzado
      const cruzadoCpfNorm = normalizeCpf(cruzado.cpf);
      const matchesCpf = req.editCpf && cruzadoCpfNorm && req.editCpf === cruzadoCpfNorm;
      const matchesNumero = req.editNumeroCruzado && cruzado.numeroCruzado && String(req.editNumeroCruzado) === String(cruzado.numeroCruzado);

      if (!req.editCruzadoId && !matchesCpf && !matchesNumero) {
        return res.status(403).json({ message: 'Token não corresponde ao CPF/número do cadastro.' });
      }
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
};

module.exports = verifyEditToken;

