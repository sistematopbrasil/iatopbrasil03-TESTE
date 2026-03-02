

## Atualização automática do Instagram 2x ao dia

### Situação atual
Existe **1 cron job** configurado para rodar às 06:00 UTC (03:00 horário de Brasília), que não corresponde aos horários desejados.

### Plano
Remover o cron atual e criar **2 novos cron jobs**:

- **08:00 BRT** = 11:00 UTC → `0 11 * * *`
- **23:50 BRT** = 02:50 UTC → `50 2 * * *`

### Execução
Será feito via SQL direto no banco (não migration, pois contém dados sensíveis):

1. `SELECT cron.unschedule(1);` — remove o job atual
2. Criar job `insta-update-morning` com schedule `0 11 * * *`
3. Criar job `insta-update-night` com schedule `50 2 * * *`

Ambos chamam a mesma edge function `insta-scheduled-update` que já existe e funciona.

Nenhuma alteração de código é necessária — apenas configuração de cron no banco.

