# TODO - Migração da base legada

## Etapas de implementação

- [x] 1. Ler o arquivo de instruções e entender o sistema
- [x] 2. Ajustar `models/Cruzado.js` (campos opcionais + índices parciais)
- [x] 3. Ajustar `models/EmailVerificationToken.js` (suporte a numeroCruzado)
- [x] 4. Ajustar `utils/legacyImport.js` (validação leniente, dataAprovacao, dedupe por numeroCruzado)
- [x] 5. Ajustar `routes/cruzados.js` (busca por numeroCruzado, schema flexível de atualização, rotas legado)
- [x] 6. Ajustar `routes/emailVerification.js` (request/verify por numeroCruzado, fluxo sem email)
- [x] 7. Ajustar `middleware/verifyEditToken.js` (aceitar numeroCruzado)
- [x] 8. Ajustar `server.js` (corrigir índice único antigo do CPF)
- [x] 9. Ajustar `public/atualizar.html` (busca por CPF/número + fluxo sem e-mail)
- [x] 10. Ajustar `public/editar.js` (busca por numeroCruzado, fluxo legado)
- [x] 11. Ajustar `public/admin.js` (alertas de importação) + contador `withoutCpf` no summary
- [ ] 12. Testar importação, busca e atualização

## Critérios de aceite
- Importar a base antiga pelo botão do admin.
- Gravar direto na collection `cruzados` (mesma do cadastro novo).
- Aceitar campos ausentes como `null`/vazios.
- Buscar e atualizar registros legados por `numeroCruzado`.
- Não quebrar o cadastro novo.

