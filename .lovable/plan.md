

## Plano: Refinar movimentação automática do pipeline pela IA

### Problema
1. A IA move leads para o quadro "Consultor" — isso deve ser exclusivo do atendente humano.
2. A IA move para "Descartado" na primeira objeção — deve só mover quando o lead deixar **muito claro** que não quer.

### Mudanças (arquivo único)

**`supabase/functions/ai-agent-respond/index.ts`** — seção de auto-pipeline (linhas 696-811):

1. **Bloquear quadro "Consultor"**: Adicionar `'consultor'` à lista `blockedKeywords` (linha 697). Atualmente só bloqueia "novos consultores" e "convertido". Com essa mudança, qualquer quadro cujo nome contenha "consultor" será bloqueado para movimentação automática.

2. **Descarte mais criterioso**: Atualmente basta UMA keyword nas últimas 5 mensagens. Mudanças:
   - Exigir que o lead tenha repetido rejeição em pelo menos **2 mensagens diferentes** (não apenas 1 ocorrência em 1 mensagem).
   - Ou que a rejeição apareça após o consultor/IA ter insistido (ou seja, não na primeira interação).

3. **Refinar prompt de classificação da IA** (linhas 770-784): Adicionar regra explícita no prompt:
   - "NUNCA mova para quadros que contenham 'consultor' no nome"
   - "Para Descartado: o lead deve ter deixado MUITO claro em mais de uma mensagem que não quer participar. Uma única objeção ou hesitação NÃO é suficiente."
   - "Para Qualificado: o lead demonstrou interesse REAL e ativo, não apenas respondeu perguntas."

### Detalhes técnicos

```text
blockedKeywords (antes):
  ['novos consultores', 'convertido', 'convertidos']

blockedKeywords (depois):
  ['consultor', 'convertido', 'convertidos']
  // 'consultor' já cobre 'novos consultores'
```

Para descarte determinístico: em vez de checar se QUALQUER keyword aparece no texto concatenado das últimas 5 msgs, verificar se keywords aparecem em **2+ mensagens distintas** do lead.

