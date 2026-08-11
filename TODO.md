# TODO - Configurar envio de e-mail via Gmail API (OAuth2)

> **IMPORTANTE:** O código do projeto já está 100% migrado para a Gmail API. Não existe mais configuração de SMTP. Porém, o envio só funciona se você criar as credenciais OAuth2 do Gmail e colocar no arquivo `.env`. Siga o passo a passo abaixo.

---

## Passo 1 — Criar o arquivo `.env` (se ainda não existir)

Na pasta raiz do projeto (`projeto_cruzada`), crie um arquivo chamado `.env` (sem extensão).

Ele já deve conter outras variáveis (como `MONGO_URI`, `JWT_SECRET`, `PORT`). Se não existir, crie um novo com todas elas.

---

## Passo 2 — Criar um projeto no Google Cloud

1. Acesse <https://console.cloud.google.com/>
2. Faça login com a conta Google que será usada para enviar os e-mails.
3. No topo, clique no seletor de projeto e depois em **"Novo Projeto"**.
4. Dê um nome (ex.: `cruzada-email`) e clique em **Criar**.
5. Selecione o projeto criado no seletor do topo.

---

## Passo 3 — Ativar a Gmail API

1. No menu lateral esquerdo, vá em **"APIs e serviços"** → **"Biblioteca"** (Library).
2. Na busca, digite `Gmail API`.
3. Clique em **Gmail API** e depois no botão **Ativar**.

---

## Passo 4 — Criar a tela de consentimento (OAuth)

1. No menu lateral, vá em **"APIs e serviços"** → **"Tela de consentimento OAuth"**.
2. Escolha o tipo **Externo** e clique em **Criar**.
3. Preencha:
   - **Nome do app:** qualquer nome (ex.: `Cruzada`)
   - **E-mail de suporte:** seu e-mail
   - **E-mail para contato:** seu e-mail
4. Clique em **Salvar e continuar** nas etapas de "Escopos" e "Usuários de teste" (pode deixar os padrões).
5. Clique em **Salvar e continuar** até concluir.

---

## Passo 5 — Criar as credenciais OAuth2 (Client ID)

1. No menu lateral, vá em **"APIs e serviços"** → **"Credenciais"**.
2. Clique em **"+ Criar credenciais"** → **"ID do cliente OAuth"**.
3. Em **Tipo de aplicativo**, escolha **"App para computador"**.
4. Clique em **Criar**.
5. Vai aparecer uma janela com o **Client ID** e o **Client Secret**.
6. Copie esses dois valores e guarde (você usará no Passo 7).

---

## Passo 6 — Gerar o Refresh Token

O projeto usa Node.js com `googleapis`. Para gerar o **refresh token**, você pode usar um pequeno script. Crie um arquivo temporário `gerar_token.js` na raiz com o conteúdo abaixo:

```js
const { google } = require('googleapis');
const readline = require('readline');
const CLIENT_ID = 'SEU_CLIENT_ID';
const CLIENT_SECRET = 'SEU_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost';
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const url = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});
console.log('Abra este link no navegador e autorize:', url);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Cole o código da URL aqui: ', (code) => {
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Erro ao obter token:', err);
    console.log('REFRESH_TOKEN=', token.refresh_token);
    rl.close();
  });
});
```

Depois:

1. Substitua `CLIENT_ID` e `CLIENT_SECRET` pelos valores do Passo 5.
2. Rode: `node gerar_token.js`
3. Abra o link que aparecer no terminal, faça login com a conta Gmail e autorize.
4. Copie o código final da URL (após `code=`) e cole no terminal.
5. O terminal vai exibir o **REFRESH_TOKEN**. Copie e guarde.
6. Apague o arquivo `gerar_token.js` (não deixe credenciais versionadas).

---

## Passo 7 — Preencher o `.env`

Abra o `.env` e adicione/complete estas variáveis:

```
GMAIL_CLIENT_ID=SEU_CLIENT_ID
GMAIL_CLIENT_SECRET=SEU_CLIENT_SECRET
GMAIL_REFRESH_TOKEN=SEU_REFRESH_TOKEN
GMAIL_USER=seuemail@gmail.com
SECRETARIO_EMAIL=emaildosecretario@gmail.com
EMAIL_ALERT_ENABLED=true
```

- `GMAIL_USER` — o e-mail Gmail que enviará as mensagens (o mesmo usado no OAuth).
- `SECRETARIO_EMAIL` — para onde vai o alerta de novo cadastro (opcional).
- `EMAIL_ALERT_ENABLED` — `true` para enviar alertas ao secretário, `false` para desligar.

---

## Passo 8 — Reiniciar o servidor

1. Suba o servidor normalmente: `npm start` (ou `node server.js`).
2. Teste o envio criando um cadastro ou solicitando um código de verificação na página "Atualizar Cadastro".
3. Se o e-mail chegar, está tudo funcionando.

---

## Verificação rápida

Se o e-mail **não** for enviado, confira:

- [ ] O `.env` existe e está na raiz do projeto.
- [ ] As 4 variáveis `GMAIL_*` estão preenchidas (sem espaços e sem aspas).
- [ ] O `GMAIL_USER` é o mesmo e-mail autorizado no OAuth.
- [ ] O refresh token foi gerado com o escopo `gmail.send`.
- [ ] O servidor foi reiniciado **depois** de editar o `.env`.

---

## Passo 9 — Liberar o app para conta de Google Workspace (@cme.org.br) — resolve o erro 535

> Use este passo se o `GMAIL_USER` for uma conta de domínio corporativo (ex.: `cnc@cme.org.br`) e o envio falhar com `535 BadCredentials / AUTH XOAUTH2`, mesmo com o token OAuth válido.

### 9.1 — Adicionar a conta como usuário de teste (Google Cloud)
1. Acesse <https://console.cloud.google.com/> com o projeto da Gmail API.
2. **APIs e serviços → Tela de consentimento OAuth**.
3. Vá para a aba **"Público-alvo"** (Audience).
4. Confirme que o status de publicação é **"Em teste"** (se estiver "Em produção", mude para "Em teste" ou publique após liberar).
5. Em **"Usuários de teste"**, clique em **"Adicionar usuários"**.
6. Adicione o e-mail do `GMAIL_USER` (ex.: `cnc@cme.org.br`) e salve.

### 9.2 — Ativar o Gmail na conta (Admin Console)
1. Acesse <https://admin.google.com> com a **conta administradora** do domínio `cme.org.br`.
2. **Diretório → Usuários**.
3. Clique em `cnc@cme.org.br`.
4. Confirme que o serviço **Gmail** está **ativado** (se não, ative).
5. Salvar.

### 9.3 — Liberar o app como Confiável no Workspace (Admin Console)
1. No Admin Console, **Segurança → Controle de acesso e dados → Controle de APIs**.
2. **Gerenciar acesso de aplicativos de terceiros**.
3. **Adicionar app → ID do cliente OAuth**.
4. Cole o Client ID: `330994696163-c50oa9r1hvert5fdsenes1iqks4iv41g.apps.googleusercontent.com`
5. Selecione o app e defina o acesso como **"Confiável"** (Trusted) ou pelo menos **"Permitido"**.
6. Salvar.

### 9.4 — Regenerar o refresh token e testar
1. Crie o `gerar_token.js` (conteúdo do Passo 6) e rode `node gerar_token.js`.
2. Autorize com `cnc@cme.org.br` (a mesma do `GMAIL_USER`).
3. Copie o novo `REFRESH_TOKEN` e atualize o `GMAIL_REFRESH_TOKEN` no `.env`.
4. Reinicie o servidor (`npm start`).
5. (Opcional) Crie o `testar_email.js` para validar o envio antes de reiniciar o app.

> ⚠️ Contas Workspace **recém-criadas** podem demorar de algumas horas a 24h para liberar o envio. Se o 535 persistir mesmo após os passos 9.1–9.4, aguarde e tente de novo mais tarde, ou use um Gmail pessoal `@gmail.com` como `GMAIL_USER`.

---

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

