# Página de Registro - Cruzada (Opção 2: Node.js/Express/MongoDB)

Esta é uma aplicação web para registro de "Cruzados" baseada nos parâmetros do documento Word e no fluxo do PDF. Usa Node.js, Express, MongoDB para backend, e HTML/CSS/JS para frontend.

## Funcionalidades
- Formulário de registro com todos os campos obrigatórios.
- Upload de foto (armazenada no MongoDB via GridFS).
- Validação de dados.
- Workflow de aprovações (pendente/aprovado/rejeitado).
- Painel admin para gerenciar registros.
- Autenticação JWT para admins.

## Pré-requisitos
- Node.js instalado.
- MongoDB instalado e rodando (local ou Atlas).
- Conta no MongoDB Atlas (opcional para produção).

## Instalação
1. Clone ou baixe os arquivos na pasta `opção 2`.
2. Instale dependências: `npm install`.
3. Configure `.env`:
   - `MONGO_URI`: URL do MongoDB (ex.: mongodb://localhost:27017/cruzada).
   - `JWT_SECRET`: Chave secreta para JWT.
5. Instale MongoDB se necessário (para Windows, use MongoDB Community Server).

## Execução
1. Inicie MongoDB.
2. Rode o servidor: `npm start` ou `npm run dev` (com nodemon).
3. Acesse http://localhost:3000.

## Uso
- Página principal: Formulário de registro.
- Para aprovações: Use Postman ou crie um painel admin (não incluído, mas APIs prontas em `/api/cruzados`).

## APIs
- POST /api/cruzados/register: Enviar formulário.
- GET /api/cruzados/pending: Listar pendentes (autenticado).
- PUT /api/cruzados/:id/status: Aprovar/rejeitar.
- PUT /api/cruzados/:numeroCruzado: Atualizar.
- DELETE /api/cruzados/:numeroCruzado: Excluir.
- GET /api/cruzados/image/:id: Servir imagem do GridFS.

## Melhorias Implementadas
- Segurança: Removido endpoint inseguro, tratamento de erros robusto.
- Robustez: Try-catch em todas as rotas, middleware de erro global.
- Consistência: Sub-schema para padrinhos, validações consistentes.
- UX: Validações básicas no frontend, painel admin funcional.
- Performance: Índices MongoDB para queries frequentes.
- Configuração: Arquivo .env.example para facilitar setup.

## Próximos Passos (Você Faz)
- Hospedar: Use Vercel/Netlify para frontend, Heroku/Render para backend, MongoDB Atlas.
- Melhorar frontend: Responsividade, validações avançadas (CPF real).
- Segurança: HTTPS, rate limiting, validação de uploads.
- Testes: Adicionar testes unitários e de integração.
- Link no WordPress: Adicione um link no WP para http://seudominio.com.

## Estrutura de Arquivos
- `server.js`: Servidor principal.
- `models/`: Schemas MongoDB.
- `routes/`: APIs.
- `middleware/`: Autenticação.
- `public/`: Frontend.
- `.env`: Configurações.
