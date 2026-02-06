

# Corrigir erro "Rendered more hooks than during the previous render" na pagina Agente IA

## Problema

Na pagina `AdminAIConfig.tsx`, existe um `useQuery` (linha 96) que busca estatisticas de uso da IA, porem ele esta posicionado **depois** de dois `return` antecipados (linhas 63-71 e 74-93). Isso viola as regras do React: hooks devem ser chamados sempre na mesma ordem em todos os renders. Quando o consultor nao tem IA habilitada, o componente retorna antes de chegar ao `useQuery`, mas quando a IA e habilitada, o hook executa, causando o erro.

## Solucao

Mover o `useQuery` do `aiStats` para **antes** dos early returns, junto com os outros hooks no topo do componente. O parametro `enabled` ja garante que a query so executa quando `ai_enabled` e verdadeiro, entao nao ha impacto funcional.

## Arquivo alterado

- `src/pages/AdminAIConfig.tsx`

## Detalhes tecnicos

1. Recortar o bloco `useQuery` das linhas 96-113 (o `aiStats`)
2. Colar logo apos o `useEffect` que sincroniza `config` com `formData` (por volta da linha 57), antes de qualquer `if (...) return`
3. Tambem mover as declaracoes de `modelOptions` e `currentModels` (linhas 117-141) para dentro do bloco de renderizacao principal (apos os early returns), ja que nao sao hooks e podem ficar onde estao — o importante e que nenhum hook fique depois de um return condicional

Resultado: o componente sempre chamara o mesmo numero de hooks em toda renderizacao, eliminando o erro.
