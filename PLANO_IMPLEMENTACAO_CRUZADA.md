# Plano de Implementação - Sistema de Cadastro da Cruzada

Este documento organiza as próximas etapas do projeto, separando o que pode ser feito automaticamente pela equipe de desenvolvimento e o que depende da sua decisão, do cliente ou do ambiente.

## 1. O que já existe hoje

O projeto já possui um fluxo inicial funcional para:
- cadastro de novo cruzado;
- upload de foto e documentos;
- aprovação/rejeição de cadastros pelo painel administrativo;
- atualização cadastral;
- exportação de registros aprovados para Excel;
- login de usuários administrativos.

## 2. O que ainda precisa ser feito

### 2.1 Carteirinha digital com QR Code

O que pode ser feito:
- gerar uma carteirinha digital após a aprovação do cadastro;
- incluir nome, número de cruzado, foto e dados básicos;
- gerar um QR Code associado ao cadastro;
- criar uma página de validação ao ler o QR Code;
- permitir o download da carteirinha em PDF.

O que depende de você:
- definir o layout exato da carteirinha;
- confirmar se a carteirinha será apenas digital ou se também precisará de versão impressa;
- confirmar o conteúdo que deve aparecer na validação do QR Code.

### 2.2 Fluxo de documentos e validação

O que pode ser feito:
- exigir PDF para indicação e termo de voluntariado;
- validar tamanho e tipo do arquivo;
- melhorar a organização dos documentos no painel administrativo;
- deixar a revisão final manual pela secretaria.

O que depende de você:
- confirmar quais documentos são obrigatórios em cada situação;
- informar se há algum modelo oficial que deve ser seguido.

### 2.3 Consignação em folha (implementado)

O que foi feito:
- adicionado no formulário uma seção para consignação em folha;
- ao marcar “Sim”, o formulário mostra a opção de baixar o termo e enviar o PDF;
- o PDF enviado é salvo no sistema e fica associado ao cadastro;
- criado no painel administrativo uma nova tabela para visualizar os registros de consignação e baixar o PDF enviado;
- adicionados botões de aprovar/rejeitar na tabela de consignação após a revisão do documento.

O que depende de você:
- fornecer o modelo oficial do termo de consignação em folha para ser colocado na pasta futura;
- validar o fluxo com alguns testes reais.

### 2.4 Alertas para a secretaria

O que pode ser feito:
- criar alertas para novos cadastros;
- criar alertas para alterações importantes, como voluntariado e contribuição;
- mostrar essas pendências em uma área administrativa.

O que depende de você:
- decidir se o alerta será por e-mail, WhatsApp, Telegram ou painel interno;
- definir quem deve receber os alertas.

### 2.5 Importação da base antiga

O que pode ser feito:
- criar um script para importar dados da planilha atual;
- normalizar os dados;
- carregar registros no banco;
- marcar inconsistências para revisão manual.

O que depende de você:
- fornecer a planilha com os dados completos;
- validar se a importação deve incluir todos os registros antigos ou apenas um subconjunto inicial.

### 2.5 Páginas públicas e links do site

O que pode ser feito:
- criar páginas informativas sobre o cadastro;
- criar links para formulário de indicação, voluntariado e consignação em folha;
- organizar melhor a experiência do usuário no site.

O que depende de você:
- definir os textos oficiais e os links que devem aparecer;
- confirmar se esses conteúdos serão publicados em outro site ou dentro desta aplicação.

### 2.6 Backup e segurança dos dados

O que pode ser feito:
- configurar backup do banco de dados;
- configurar backup dos arquivos enviados;
- documentar o processo de recuperação.

O que depende de você:
- definir a estratégia de armazenamento e custos;
- decidir se o backup será feito em nuvem, HD externo ou outro meio.

## 3. O que eu posso fazer

Eu posso implementar diretamente no projeto:
- melhorias no backend;
- novas rotas e regras de negócio;
- integração com o banco de dados;
- painel administrativo;
- upload e armazenamento de arquivos;
- geração de carteirinha digital básica;
- páginas públicas do sistema;
- importação inicial de dados a partir de planilha;
- validação de documentos e alertas básicos.

## 4. O que precisa ser feito por você ou pelo cliente

Você ou o cliente precisam definir:
- layout final da carteirinha;
- conteúdo exato da página de validação do QR Code;
- regras de aprovação e revisão da secretaria;
- quais documentos são obrigatórios;
- qual canal de alerta será usado;
- se a importação deve incluir todos os cadastros antigos;
- qual é a estratégia de backup e armazenamento.

## 5. Proposta de implementação por etapas

### Etapa 1 — Estabilizar o fluxo atual
- revisar cadastro, atualização e aprovação;
- garantir que tudo funcione sem falhas.

### Etapa 2 — Carteirinha digital
- gerar PDF da carteirinha;
- incluir QR Code;
- criar validação.

### Etapa 3 — Melhorar documentos e revisão
- validar arquivos;
- melhorar painel administrativo;
- padronizar documentos.

### Etapa 4 — Alertas e notificações
- notificar a secretaria sobre alterações importantes.

### Etapa 5 — Migração da base antiga
- importar e revisar registros antigos.

### Etapa 6 — Páginas públicas e backup
- completar a parte de comunicação e segurança.

## 6. Recomendação prática

A melhor forma de avançar é implementar primeiro:
1. a carteirinha digital;
2. o fluxo de documentos;
3. os alertas;
4. a importação da base antiga.

Essas são as funcionalidades que mais se aproximam do pedido do cliente e trazem maior valor ao sistema.
