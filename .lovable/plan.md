

## Plano: Corrigir Pipeline + Melhorar Quiz Welcome + Redesign Captura

### 1. Corrigir erro "Erro ao mover lead" no Pipeline

**Causa raiz**: O trigger `update_temperature_on_pipeline_move` define `NEW.temperature := 'cold'` sem fazer cast para o tipo enum `lead_temperature`. O PostgreSQL nao consegue converter implicitamente e o UPDATE falha.

**Correcao**: Migracao SQL para recriar o trigger com cast explicito:
```sql
NEW.temperature := 'cold'::lead_temperature;
NEW.temperature := 'warm'::lead_temperature;
NEW.temperature := 'hot'::lead_temperature;
```

Tambem aplicar o mesmo fix no `calculate_lead_score` trigger que ja tem o cast correto (confirmar consistencia).

---

### 2. Quiz Welcome Screen sem foto

**Problema**: Quando o consultor nao configura foto, aparece um placeholder cinza com icone generico que prejudica a aparencia.

**Solucao**: Remover o placeholder visual quando nao ha foto. A pagina deve fluir naturalmente sem a imagem - titulo, subtitulo e botao ficam centralizados sem o bloco de imagem vazio. O componente `ConsultantImage` retorna `null` quando `quiz_cover_image` e null/vazio.

**Mudanca em `QuizContainer.tsx` (linhas ~670-711)**:
- Se `consultant?.quiz_cover_image` for falsy, `ConsultantImage` retorna `null`
- Sem placeholder, sem bloco vazio - a pagina fica limpa com logo + titulo + subtitulo + botao

---

### 3. Pagina de Captura - Design mais moderno e interativo

**Mudancas em `CapturePage.tsx`**:

- **Particulas/orbs animados no fundo**: Adicionar 2-3 orbs com animacao CSS de flutuacao lenta (keyframes float) para dar vida ao background
- **Glassmorphism mais forte no card do form**: Aumentar o blur, adicionar borda com gradiente sutil
- **Animacao de entrada escalonada**: Cada campo do form aparece com delay progressivo (0.1s, 0.2s, 0.3s)
- **Efeito de hover no botao CTA**: Adicionar shimmer/brilho animado que passa pelo botao
- **Indicador de progresso nos campos**: Barra fina abaixo do form que preenche conforme campos sao validados (0/3, 1/3, 2/3, 3/3)
- **Step numbers nos campos**: Numeracao sutil (1, 2, 3) ao lado de cada campo para guiar o usuario
- **Tipografia melhorada**: Titulo com gradient text (branco para cinza claro), peso mais forte
- **Footer com selo de seguranca mais elegante**: Icone de cadeado com borda e fundo sutil

---

### Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Fix cast enum no trigger `update_temperature_on_pipeline_move` |
| `src/components/quiz/QuizContainer.tsx` | Remover placeholder de imagem, retornar null quando sem foto |
| `src/pages/CapturePage.tsx` | Redesign com animacoes, orbs, glassmorphism, progress bar, shimmer |

### Ordem
1. Migracao SQL (fix pipeline)
2. QuizContainer (welcome sem foto)
3. CapturePage (redesign visual)

