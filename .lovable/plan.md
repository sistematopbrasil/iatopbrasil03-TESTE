

## Plano: Renomear Stage, Melhorar Captura e Adicionar Seletor de País

### 1. Pipeline - Renomear "Convertidos" para "Consultor" + Ajustar Lógica de Pontuação

**Migração SQL:**
- Renomear stage "Convertidos" para "Consultor" em todas as organizações
- Atualizar a função `get_novos_consultores_stage_id` para detectar stages com nome "consultor" (sem exigir "novos")
- A lógica fica: `lower(name) LIKE '%consultor%'` (remove a exigência de conter "novos")

**PipelineBoard.tsx:**
- Atualizar `isNovosConsultoresStage` para detectar simplesmente `consultor` no nome (sem exigir "novo")
- Ajustar mensagem de feedback: "Lead se tornou consultor!" em vez de "convertido em consultor"

### 2. Página de Captura - Campos maiores + Seletor de País no telefone

**CapturePage.tsx - Campos maiores e mais espaço:**
- Aumentar `h-14` para `h-[60px]` nos inputs (mais altura)
- Aumentar `space-y-6` para `space-y-7` dentro do form card (mais espaço entre campos)
- Aumentar padding do card de `p-8` para `p-8 sm:p-10`
- Ajustar `text-base` para `text-[17px]` nos inputs
- Mobile: garantir `px-5` no container principal, inputs responsivos

**Seletor de País no campo telefone:**
- Adicionar dropdown com bandeira do país ao lado esquerdo do campo de telefone
- Brasil 🇧🇷 (+55) por padrão
- Lista de países mais comuns: Brasil, EUA, Portugal, Argentina, Paraguai, Uruguai, Colômbia, México, Chile
- Ao trocar país, ajusta a máscara de formatação do telefone
- Bandeirinha clicável que abre um dropdown compacto
- Salvar o código do país junto com o número ao enviar

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| Migração SQL | Renomear "Convertidos" → "Consultor", atualizar função de detecção |
| `src/components/crm/PipelineBoard.tsx` | Ajustar `isNovosConsultoresStage` para detectar "consultor" |
| `src/pages/CapturePage.tsx` | Campos maiores, mais espaço, seletor de país com bandeiras |

### Ordem
1. Migração SQL
2. PipelineBoard (lógica de detecção)
3. CapturePage (visual + seletor de país)

