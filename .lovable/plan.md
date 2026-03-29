

## Plano: Corrigir exibição de respostas e origem dos leads da landing page

### Problemas identificados

1. **Origem incorreta nos badges**: O código em `AdminLeads.tsx` só reconhece 3 origens (`capture`, `whatsapp`, `quiz`). Não reconhece `recruitment` e trata tudo que não é capture/whatsapp como "Quiz".

2. **Modal de detalhes mostra campos do quiz para TODOS os leads**: O modal em `AdminLeads.tsx` (linhas 995-1052) sempre mostra Idade, Estado Civil, CNH, Situação Profissional, etc. — campos do quiz que ficam vazios ("-") para leads da landing page.

3. **Respostas extras não aparecem corretamente**: O `CapturePage` salva `extra_answers` como `{ "pergunta": "resposta" }` (string simples), mas o `AdminLeads.tsx` tenta ler como `{ question, answer }` (objeto). Isso faz as respostas não aparecerem.

4. **Leads existentes da landing page já foram salvos com `lead_source: 'capture'`**, então as respostas já estão no banco — o problema é apenas na exibição.

---

### Mudanças

#### 1. `src/pages/AdminLeads.tsx` — Badges de origem (4 locais)

Atualizar a lógica de badges para reconhecer todas as origens:
- `capture` → "Captura" (laranja)
- `recruitment` → "Recrutamento" (azul)
- `whatsapp` → "WhatsApp" (verde)
- `quiz` → "Quiz" (roxo)

Atualizar nos 4 locais: badges da lista mobile, badges da tabela desktop, badge do modal, e exportação CSV.

#### 2. `src/pages/AdminLeads.tsx` — Modal de detalhes dinâmico

Condicionar os campos exibidos por `lead_source`:
- **Quiz**: mostrar todos os campos (idade, estado civil, profissão, etc.)
- **Capture/Recruitment**: mostrar apenas Nome, Telefone, Email + `extra_answers`
- Seção "Respostas do Formulário" aparece para capture/recruitment com as perguntas e respostas da landing

#### 3. `src/pages/AdminLeads.tsx` — Fix formato `extra_answers`

O `extra_answers` salvo pela landing é `{ "pergunta": "resposta" }`. Ajustar o render para aceitar os dois formatos:
- Se `value` for string → label = key, valor = value
- Se `value` for objeto com `.answer` → label = value.question, valor = value.answer

#### 4. `src/pages/AdminLeads.tsx` — Filtro de origem

Adicionar `recruitment` como opção no filtro de origem (se existir).

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/AdminLeads.tsx` | Badges com 4 origens, modal dinâmico por lead_source, fix extra_answers |

Nenhuma mudança no banco — os dados já estão corretos, o problema é apenas na UI.

