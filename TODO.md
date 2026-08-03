# TODO - Tornar todos os campos editáveis na página Atualizar Cadastro

## 1. `public/atualizar.html`
- [ ] Remover `readonly` do campo CPF
- [ ] Remover `readonly` do campo Data de nascimento
- [ ] Tornar visíveis os campos do responsável pela indicação (nome + CPF)
- [ ] Adicionar campo de upload de `certificadoIndicacao`
- [ ] Adicionar seção "Trabalho Voluntário" (trabalharVoluntario + documentoVoluntario)

## 2. `public/editar.js`
- [ ] Adicionar formatação de CPF para o campo `cpfResponsavelIndicacao`
- [ ] Adicionar lógica condicional de mostrar/ocultar a seção voluntário
- [ ] Atualizar `preencherFormulario` para preencher os novos campos e exibir contêineres condicionais
- [ ] Atualizar `limparFormulario` para resetar a seção voluntário
- [ ] Limpar CPF do responsável na validação de salvamento

## 3. `routes/cruzados.js` (handler `atualizar/:id`)
- [ ] Processar upload de `documentoVoluntario`
- [ ] Salvar `documentoVoluntario` na atualização

