# Projeto Cruzada

Sistema web de cadastro, aprovação e validação de Cruzados, desenvolvido com Node.js, Express e MongoDB.

## Visão geral

A aplicação atualmente inclui:

- cadastro público de novos Cruzados;
- upload de foto e documentos em PDF;
- fluxo de aprovação e rejeição no painel administrativo;
- revisão de documentos de voluntariado e consignação;
- atualização de cadastro com verificação por código enviado por e-mail;
- carteirinha digital com QR Code e página de validação online;
- importação de base antiga via planilha Excel;
- exportação de cadastros aprovados para Excel;
- autenticação de administrador por JWT.

## Funcionalidades principais

### Cadastro
- Formulário público em `public/index.html`.
- Upload de foto, certificado de indicação, termo de voluntariado e termo de consignação.
- Validações no backend e no frontend.

### Painel administrativo
- Painel em `public/admin.html`.
- Listagem de pendentes.
- Aprovação/rejeição de cadastros.
- Visualização de fotos e documentos.
- Exportação para Excel.
- Importação de planilha Excel para o banco.

### Atualização de cadastro
- Fluxo protegido por e-mail e código temporário.
- O usuário informa CPF, recebe um código e libera a edição por tempo limitado.

### Carteirinha digital
- Página em `public/carteirinha.html`.
- QR Code aponta para a página de validação.
- Página de validação em `public/validar.html`.
- A validação consulta o banco para verificar se o cadastro ainda está ativo/aprovado.

### Importação da base antiga
- Script em `scripts/import-base-antiga.js`.
- Utilitário compartilhado em `utils/legacyImport.js`.
- Também disponível no admin por botão de upload.
- Se o CPF já existir, o cadastro é atualizado.

## Requisitos

- Node.js 18+.
- MongoDB local ou MongoDB Atlas.
- Conta SMTP para envio de e-mails.

## Instalação

```bash
npm install
```

## Configuração do `.env`

Exemplo de variáveis usadas pelo projeto:

```env
MONGO_URI=mongodb://localhost:27017/cruzada
JWT_SECRET=uma_chave_forte_aqui
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_email@exemplo.com
SMTP_PASS=sua_senha
SMTP_FROM=seu_email@exemplo.com
SECRETARIO_EMAIL=secretaria@exemplo.com
APP_BASE_URL=https://seu-dominio-publico.com
```

## Execução

```bash
npm start
```

Ou em modo desenvolvimento:

```bash
npm run dev
```

A aplicação fica disponível em:

- `http://localhost:3000`
- painel admin: `http://localhost:3000/admin`
- carteirinha: `http://localhost:3000/carteirinha.html?numeroCruzado=8001`
- validação: `http://localhost:3000/validar.html?numeroCruzado=8001`

## Scripts úteis

### Importar base antiga

```bash
npm run import:legacy -- --file="C:\caminho\para\base.xlsx"
```

Opções:

- `--sheet=NomeDaPlanilha`
- `--target=temp` ou `--target=permanent`
- `--dry-run`

### Observação sobre importação

- Por padrão, a importação grava em `permanent`.
- Se o CPF já existir, o registro é atualizado com os dados da planilha.
- Campos não enviados pela planilha são preservados no banco.

## Rotas principais da API

### Auth
- `POST /api/auth/login`
- `POST /api/auth/email-verification/request`
- `POST /api/auth/email-verification/verify`

### Cruzados
- `POST /api/cruzados/register`
- `GET /api/cruzados/pending`
- `GET /api/cruzados/pending/voluntarios`
- `GET /api/cruzados/consignacao`
- `GET /api/cruzados/export/excel`
- `POST /api/cruzados/import/excel`
- `GET /api/cruzados/image/:id`
- `GET /api/cruzados/carteirinha/:numeroCruzado`
- `GET /api/cruzados/buscar?cpf=...`
- `PUT /api/cruzados/:id/status`
- `PUT /api/cruzados/atualizar/:id`
- `PUT /api/cruzados/:numeroCruzado`
- `DELETE /api/cruzados/:numeroCruzado`

### Validação
- `GET /api/validacao/:numeroCruzado`

## Estrutura do projeto

- `server.js` - servidor principal.
- `models/` - schemas do MongoDB.
- `routes/` - rotas da API.
- `middleware/` - autenticação e autorização.
- `public/` - páginas HTML/CSS/JS.
- `scripts/` - utilitários de manutenção/importação.
- `utils/` - lógica compartilhada.

## Observações

- O projeto usa GridFS para armazenar arquivos enviados.
- A carteirinha digital depende de `APP_BASE_URL` para gerar o link público correto.
- O fluxo de validação foi desenhado para uso online, não apenas local.
- Para produção, é recomendável revisar custo de banco/arquivos conforme a quantidade de cadastros e anexos.
