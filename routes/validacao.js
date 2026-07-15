const express = require('express');
const Cruzado = require('../models/Cruzado');
const router = express.Router();

router.get('/:numeroCruzado', async (req, res) => {
  try {
    const { numeroCruzado } = req.params;
    if (!numeroCruzado) {
      return res.status(400).json({ valid: false, message: 'Número do Cruzado é obrigatório.' });
    }

    const cruzado = await Cruzado.findOne({ numeroCruzado });
    if (!cruzado) {
      // Não expor detalhes para evitar instruções sobre falsificação
      return res.status(404).json({ valid: false, message: 'Cadastro inválido ou não localizado.' });
    }

    if (cruzado.status !== 'aprovado') {
      // Retornar mensagem genérica sem PII
      return res.status(200).json({ valid: false, message: 'Cadastro inválido.' });
    }

    // Quando válido, retornar apenas campos mínimos necessários
    res.json({ valid: true, nome: cruzado.nome, numeroCruzado: cruzado.numeroCruzado, nucleoOuGede: cruzado.nucleoOuGede, status: cruzado.status });
  } catch (err) {
    console.error('Erro na validação do cadastro:', err);
    res.status(500).json({ valid: false, message: 'Erro interno ao validar cadastro.' });
  }
});

module.exports = router;
