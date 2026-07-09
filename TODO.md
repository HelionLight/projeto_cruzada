# TODO - Atualização Cruzada (2.2 e 2.4 + número 8000 + e-mails + deleção na recusa)

## Passo 1: Documentos obrigatórios (2.2)
- [x] Atualizar `routes/cruzados.js` em `POST /api/cruzados/register`:
  - [x] Verificar presença de `certificadoIndicacao` (obrigatório sempre) antes de salvar.
  - [x] Verificar `documentoVoluntario` se `trabalharVoluntario===true`.
  - [x] Verificar `documentoConsignacao` se `consignacao===true`.
  - [ ] (Opcional) Validar `mimetype` = `application/pdf` nos PDFs obrigatórios.
  - [x] Retornar 400 com mensagem clara quando faltar.


## Passo 2: Token/código por e-mail + verificação (2.4)
- [x] Criar `models/EmailVerificationToken.js` com campos necessários (cpf, tokenId/jti, expiresAt, usedAt).
- [x] Adicionar rotas no backend:
  - [x] `POST /api/auth/email-verification/request`
  - [x] `POST /api/auth/email-verification/verify`
  - [x] Gerar código/identificador de token com expiração 10 min e uso único.
  - [x] Enviar e-mail para o candidato via nodemailer usando SMTP já existente.

## Passo 3: Proteger a atualização do cadastro (2.4)
- [x] Alterar `PUT /api/cruzados/atualizar/:id` para exigir autenticação por JWT temporário.
- [x] Validar que o token liberado pertence ao CPF do cadastro sendo atualizado.
- [x] Garantir que CPF é normalizado/formatado corretamente ao persistir.



## Passo 4: Numeração automática 8000 + e-mails candidato (3.1/3.2)
- [x] Implementar contador atômico para `numeroCruzado` começando em 8000.
- [x] No `PUT /api/cruzados/:id/status`:
  - [x] Quando `status==='aprovado'` e cadastro entra em `Cruzado` (sem cair em `aguardando_documentos`):
    - [x] atribuir `numeroCruzado` via contador
    - [x] enviar e-mail de aprovado (placeholder carteirinha)
  - [x] Quando `status==='rejeitado'`:
    - [x] enviar e-mail de recusa
    - [x] deletar imediatamente `CruzadoTemp` (em vez de esperar TTL)

## Passo 5: Frontend (ajuste do fluxo de atualização)
- [x] Atualizar `public/atualizar.html` e `public/editar.js` para:
  - [x] solicitar código (CPF)
  - [x] tela de digitação do código
  - [x] habilitar edição apenas após validação
  - [x] ao enviar a atualização, incluir `Authorization: Bearer <token>` no header


## Passo 6: Revisão final e documentação
- [ ] Atualizar mensagens/erros do frontend e backend.
- [ ] Conferir que CPF é normalizado para lógica e formatado no retorno.
- [ ] Conferir que documentos obrigatórios impedem envio quando faltar.

