# Instruções para outra IA - Migração da base legada

## Objetivo
Adaptar o sistema para importar a base antiga sem criar outra collection, mantendo os cadastros reais já existentes e permitindo que registros incompletos sejam gravados no MongoDB com campos ausentes como `null` ou vazios quando necessário.

## Contexto importante
- O projeto já possui um importador de Excel no botão da administração.
- A base antiga não segue o mesmo padrão do cadastro novo.
- Alguns registros não têm CPF, e não é possível recuperá-lo para todos.
- Existem cadastros reais de pessoas vivas, então a solução não pode depender de CPF fictício repetido como `00000000000`.
- O sistema atual ainda usa CPF em várias partes, então a alteração deve ser planejada para não quebrar os cadastros normais caso eles voltem a existir.

## Resultado esperado
Após a implementação:
- a planilha antiga deve ser importável pelo botão do admin;
- a importação deve gravar direto na mesma collection do MongoDB;
- os campos ausentes devem ser aceitos e salvos como `null` ou vazios;
- os registros legados devem poder ser encontrados e atualizados pela tela de atualização;
- a busca por `numeroCruzado` deve funcionar para os registros antigos;
- o sistema não deve depender da rota de novo cadastro para essa base.

## Regras de implementação
1. Não criar outra collection.
2. Não usar CPF falso repetido para resolver ausência de CPF.
3. Não bloquear a importação inteira por falta de campos que não existem na base antiga.
4. Preservar os cadastros reais já existentes no banco.
5. A importação antiga deve ser tratada como um fluxo legado, separado do cadastro novo.
6. Sempre que um campo não existir, o sistema deve aceitar `null`, vazio ou ausência do campo, conforme for mais seguro no schema.
7. A busca e a atualização devem considerar `numeroCruzado` como chave principal dos registros legados quando CPF não existir.

## Arquivos que provavelmente precisam ser alterados
- `utils/legacyImport.js`
- `routes/cruzados.js`
- `models/Cruzado.js`
- `public/admin.js`
- `public/editar.js` ou a página de atualização equivalente
- `public/atualizar.html` ou a página de atualização equivalente
- possivelmente algum arquivo de validação de busca por CPF / número de cruzado

## Etapas exatas que a outra IA deve seguir

### 1. Ajustar o modelo do banco
- Verificar quais campos ainda estão obrigatórios no schema de `Cruzado`.
- Remover a exigência de CPF para os registros legados, ou permitir CPF ausente apenas no fluxo de importação antiga.
- Avaliar se `cpf` ainda está com `unique: true` e corrigir isso para não quebrar registros sem CPF.
- Se necessário, usar índice parcial ou outra estratégia segura para evitar conflito com múltiplos valores ausentes.

### 2. Ajustar o importador
- Fazer o botão de importação aceitar a planilha base antiga.
- Mapear os campos que já existem na planilha adaptada.
- Para campos que não existirem, gravar `null`, vazio ou omitir o campo.
- Não rejeitar a linha apenas porque um campo antigo está faltando.
- Priorizar `nome`, `numeroCruzado`, `celular`, `estado`, `cidade`, `endereco` e `dataAprovacao` quando existirem.
- Permitir linhas sem CPF.
- Permitir linhas sem email.
- Permitir linhas sem outros campos não recuperáveis.

### 3. Ajustar a lógica de gravação
- Fazer a importação gravar na mesma collection do MongoDB.
- Garantir que o fluxo legado não passe pela validação rígida do cadastro novo.
- Se um registro já existir, atualizar em vez de duplicar, quando isso fizer sentido.
- Evitar que o importador falhe por causa do `unique` de CPF.

### 4. Ajustar a tela de atualização
- Permitir busca por `numeroCruzado`.
- Se CPF não localizar o registro, tentar `numeroCruzado`.
- Garantir que os registros legados sejam encontráveis mesmo sem email ou CPF.
- Se não houver email, criar um caminho alternativo para liberar o acesso à atualização com validação por nome completo + número de cruzado.

### 5. Ajustar o fluxo de recuperação
- Se o registro existir mas não tiver email, permitir a entrada do nome completo e do número de cruzado.
- Validar se ambos batem com o registro da base.
- Se baterem, liberar a atualização do email.
- Depois disso, enviar o token normalmente e abrir a página de atualização.

### 6. Testar com a planilha legada
- Rodar primeiro com poucos registros.
- Conferir se os dados foram para o MongoDB.
- Confirmar se os campos faltantes ficaram como `null` ou vazios.
- Verificar se a busca por `numeroCruzado` funciona.
- Verificar se registros sem CPF não travam a importação.

### 7. Validar a segurança do sistema
- Confirmar que o cadastro normal não foi quebrado.
- Confirmar que os registros legados não interferem nos cadastros novos.
- Confirmar que o sistema não duplica dados com CPF vazio.
- Confirmar que não existe conflito entre registros antigos e novos.

## Critério de aceite
A implementação só deve ser considerada concluída se:
- a base antiga puder ser importada;
- a importação aceitar campos faltantes;
- o MongoDB armazenar os dados na mesma collection;
- os registros legados puderem ser localizados pela página de atualização;
- o sistema continuar estável sem criar uma segunda collection;
- os cadastros reais não forem sobrescritos ou corrompidos.

## Observação final para a IA
Se houver conflito entre o cadastro novo e a base antiga, priorizar o funcionamento da migração legada sem comprometer os dados reais já existentes. O foco aqui é adaptar o sistema para absorver a base antiga com o mínimo de risco possível.
