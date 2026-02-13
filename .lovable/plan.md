

# Pendencia: Habilitar Realtime no Pipeline

## O que ja foi feito (3 de 4 itens)

- Modelos de IA: opcoes limpas, somente Gemini 3 Flash e Gemini 2.5 Flash na lista gratuita
- Descarte automatico: regra deterministica por palavras-chave implementada no ai-agent-respond
- Scroll vertical: removido do pipeline, agora so scroll horizontal

## O que falta (1 item)

### Migracao SQL para habilitar realtime

A tabela `quiz_submissions_new` precisa ser adicionada a publicacao `supabase_realtime` para que mudancas feitas pelo edge function (como mover lead de quadro) sejam refletidas automaticamente no pipeline sem recarregar a pagina.

**Migracao necessaria:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_submissions_new;
```

Esta e uma operacao simples e segura que apenas habilita a transmissao de eventos de mudanca para os clientes conectados. A subscription no frontend (`PipelineBoard.tsx`) ja existe e esta configurada corretamente -- so precisa que a tabela esteja na publicacao para funcionar.

## Resumo

| Item | Status |
|---|---|
| Limpar modelos IA | Concluido |
| Descarte automatico por palavras-chave | Concluido |
| Remover scroll vertical do pipeline | Concluido |
| Pipeline realtime (migracao SQL) | Pendente aprovacao |

