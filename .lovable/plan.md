
# Plano de correções — funis, edição de consultores, tráfego e visão separada no Super Admin

Nada de rota, slug ou funcionalidade existente será removido. As correções são pontuais e aditivas.

## 1. Corrigir o toggle de funil aparecendo em contas com apenas 1 funil

### Problema real
O comportamento incorreto não está no banco. Os consultores recém-criados já estão salvos corretamente com:
- `allowed_funnels = {associado}` quando só associado foi marcado
- `default_funnel = associado` quando só associado foi marcado

O erro está no estado do frontend:
- o `FunnelProvider` inicializa apenas uma vez
- ao trocar de usuário na mesma sessão, ele pode manter estado do login anterior
- por isso um consultor com 1 funil pode herdar o toggle visível de uma conta anterior que tinha 2 funis ou perfil super admin

### Implementação
- Refatorar `src/contexts/FunnelContext.tsx` para reinicializar quando a sessão/usuário mudar.
- Validar o valor salvo em `localStorage` contra o usuário atual:
  - se o usuário tem só 1 funil, forçar `activeFunnel` para esse funil
  - remover qualquer valor inválido herdado (`all`, `consultor` ou `associado` que não pertença ao usuário)
- Garantir que:
  - 1 funil ativo => sem toggle
  - 2 funis ativos => toggle entre os dois
  - super admin com 2 funis => toggle com `Consultor | Associado | Todos`

## 2. Liberar edição de funis também na aba “Consultores”

### Problema real
Hoje a edição de funis está visível no dashboard do super admin, mas a página `/admin/consultants` ainda não expõe essa ação.

### Implementação
- Integrar `EditConsultantFunnelDialog` também em `src/pages/ConsultantsManagement.tsx`.
- Fazer a listagem da aba de consultores carregar e exibir:
  - `allowed_funnels`
  - `default_funnel`
- Adicionar na tabela:
  - coluna/indicador visual de funis
  - ação direta “Editar funis de acesso”
  - badges clicáveis ou item no menu de ações, igual ao dashboard
- Reutilizar o mesmo diálogo já existente, sem criar fluxo paralelo.

### Resultado esperado
Será possível editar contas já existentes e novas contas:
- no dashboard do super admin
- na aba de consultores

## 3. Garantir regra correta de criação/edição dos funis

### Regra que ficará garantida
- Se marcar só **Associados**:
  - a conta entra apenas com `associado`
  - sem toggle
  - `default_funnel = associado`
- Se marcar só **Consultores**:
  - a conta entra apenas com `consultor`
  - sem toggle
  - `default_funnel = consultor`
- Se marcar os dois:
  - a conta entra com os dois
  - com toggle
  - com funil padrão configurável

### Implementação
- Revisar consistência entre:
  - `CreateConsultantDialog`
  - `create-consultant`
  - `EditConsultantFunnelDialog`
  - `update-consultant-funnel-access`
- Manter retrocompatibilidade dos usuários atuais, sem regravar contas já corretas.

## 4. Mostrar no painel Super Admin os dados separados por funil

### Problema real
Hoje o painel super admin (`/admin/super`) usa métricas agregadas/mistas. Você pediu duas visões:
- dados do funil de consultores
- dados do funil de associados

### Implementação
- Atualizar `AdminSuperAdmin.tsx` e `SuperAdminCharts.tsx` para mostrar dados separados por funil.
- Estruturar a tela com duas áreas claras:
  - **Funil de Consultores**
  - **Funil de Associados**
- Separar:
  - cards de métricas
  - gráficos
  - totais por funil
- Manter visão geral consolidada onde fizer sentido, mas com blocos distintos por funil.

### Ajuste necessário no backend/hook
Há um desalinhamento entre o retorno do `ranking-get` em modo `all` e o que `useRankingData` espera hoje.
Vou corrigir isso para suportar corretamente:
- dados agrupados por funil
- totais por funil
- consumo consistente em ranking e super admin

## 5. Corrigir a atualização incompleta do módulo de tráfego

### Problemas identificados
Há vários pontos causando atualização parcial:

1. `useAdAccounts` não filtra por `organization_id` ao ler contas  
   Isso pode misturar contas fora da organização atual.

2. `useTrafficMetrics` não filtra por `organization_id` ao ler métricas  
   Isso pode trazer métricas incompletas ou misturadas.

3. `sync-history` hoje sincroniza só `last_30d`, não 90 dias.

4. `list-meta-ad-accounts` pega apenas a primeira página do Meta  
   então, se existirem muitas contas, nem todas são importadas.

5. A UI informa sincronização automática diária, mas preciso validar/alinhar a implementação real para garantir o comportamento prometido.

### Implementação
- Corrigir `src/hooks/useAdAccounts.ts` para sempre filtrar por `organization_id`.
- Corrigir `src/hooks/useTrafficMetrics.ts` para sempre filtrar por `organization_id`.
- Atualizar `supabase/functions/sync-history/index.ts` para sincronizar 90 dias.
- Melhorar `supabase/functions/sync-all-accounts/index.ts` para:
  - atualizar todas as contas monitoradas da organização correta
  - fazer backfill inicial de 90 dias
  - depois manter incremental eficiente
  - retornar resultado por conta, não só contagem inflada por múltiplas chamadas
- Atualizar `supabase/functions/list-meta-ad-accounts/index.ts` para buscar todas as páginas do Meta.
- Revisar `TrafficDashboard`, `TrafficAccounts` e `TrafficAccountDetail` para expor melhor:
  - sincronização completa de 90 dias
  - status de atualização
  - comportamento previsível por conta

### Resultado esperado
- atualização mais completa
- cobertura mínima dos últimos 90 dias
- mais contas sincronizadas corretamente
- sem mistura de dados entre organizações

## 6. Arquivos principais envolvidos

### Frontend
- `src/contexts/FunnelContext.tsx`
- `src/pages/ConsultantsManagement.tsx`
- `src/components/super-admin/EditConsultantFunnelDialog.tsx`
- `src/components/super-admin/ConsultantsTable.tsx`
- `src/pages/AdminSuperAdmin.tsx`
- `src/components/super-admin/SuperAdminCharts.tsx`
- `src/hooks/useRankingData.ts`
- `src/hooks/useAdAccounts.ts`
- `src/hooks/useTrafficMetrics.ts`
- `src/components/traffic/TrafficDashboard.tsx`
- `src/components/traffic/TrafficAccounts.tsx`
- `src/components/traffic/TrafficAccountDetail.tsx`

### Backend
- `supabase/functions/ranking-get/index.ts`
- `supabase/functions/list-meta-ad-accounts/index.ts`
- `supabase/functions/sync-history/index.ts`
- `supabase/functions/sync-all-accounts/index.ts`

## 7. Escopo de segurança e compatibilidade

- Nenhuma rota será alterada.
- Nenhum slug será alterado.
- Nenhuma configuração já salva da Meta será apagada.
- Nenhuma conta existente será quebrada.
- Não há necessidade de mudar schema do banco para essas correções principais; o foco é ajuste de frontend, hooks e edge functions.
- Se eu confirmar ausência do agendamento automático real, implemento o agendamento corretamente sem afetar os dados existentes.

## 8. Ordem de execução

1. Corrigir `FunnelContext` para eliminar toggle indevido entre logins.
2. Levar “Editar funis” para a aba `/admin/consultants`.
3. Garantir regra final de exibição do toggle conforme 1 ou 2 funis.
4. Corrigir `ranking-get` + `useRankingData` para suportar agrupamento por funil.
5. Atualizar `/admin/super` para exibir consultor vs associado separadamente.
6. Corrigir hooks e edge functions do tráfego para filtro por organização, 90 dias e paginação completa.
7. Validar tudo sem quebrar dashboard, ranking, consultores e tráfego já existentes.
