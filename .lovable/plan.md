

## Plano: Reestruturar Landing Page — Copy formatada, Formulário integrado, Prova social

### Resumo
A landing page será reestruturada para seguir exatamente a estrutura fornecida:
1. **Hero** com copy formatada corretamente
2. **Benefícios** (ícones — já existe)
3. **Comparação** (já existe, atualizar copy)
4. **Formulário** (NOVO — antes da galeria) com perguntas padrão
5. **Galeria** ("Veja nossos resultados")
6. **Prova Social** (NOVO — seção com "+75.000 veículos protegidos")
7. **CTA final**

O botão do hero rola até o formulário. O botão do formulário envia os dados e redireciona para o WhatsApp.

---

### Mudanças

#### 1. `src/pages/CapturePage.tsx` — Landing Template

**Hero Section (linhas 734-769):**
- Reformatar a copy para ter tipografia hierárquica:
  - Badge: `PROTEÇÃO VEICULAR | CAMPINAS & REGIÃO`
  - Título (h1): `Seu carro protegido do jeito certo. Sem burocracia. Sem pegadinhas.`
  - Subtítulo: `A Top Brasil Campinas oferece proteção veicular completa com assistência 24h, cobertura contra roubo, furto e colisão — tudo com atendimento ágil e de verdade. Sem consulta de crédito. Aprovação na hora.`
- O botão CTA do hero faz **scroll suave** até o formulário (`#formulario`) em vez de ir direto ao WhatsApp

**Comparação (linhas 782-829):**
- Atualizar texto descritivo para: `O seguro tradicional cobra até 3x mais pela mesma proteção — e ainda usa seu CPF e seu bairro pra definir o preço. Com a Top Brasil você protege seu veículo com um valor justo, sem consulta de crédito e sem surpresa no bolso.`
- Labels: `✗ SEGURO TRADICIONAL` e `✓ MELHOR ESCOLHA — TOP BRASIL`

**Formulário (NOVO — entre comparação e galeria):**
- Seção com id `formulario` para scroll anchor
- Título: `Descubra o plano ideal para o seu veículo!`
- Campos: Nome completo, WhatsApp (com country selector existente)
- 3 perguntas de múltipla escolha padrão (usando `config.custom_questions`):
  1. "Seu veículo tem proteção hoje?" — 3 opções
  2. "Qual é o ano do seu veículo?" — 4 opções
  3. "Qual sua maior preocupação com seu veículo?" — 4 opções
- Botão: `Quero minha proteção agora →`
- O submit salva no `quiz_submissions_new` (reusa lógica existente do `handleSubmit`) e redireciona para WhatsApp
- Estilo: glassmorphism card consistente com o resto da page

**Prova Social (NOVO — após galeria):**
- Badge: `+75.000 veículos protegidos em todo o Brasil`
- 5 estrelas (texto/emoji)
- Texto: `Junte-se a mais de 75.000 associados que já protegem seu veículo com tranquilidade.`
- Botão: `Quero fazer parte agora →` (scroll até formulário)

**CTA Final:** Manter mas ajustar texto

**Defaults para custom_questions** quando template é `landing`:
- Mudar os defaults na ConsultantSettings de perguntas de recrutamento para as 3 perguntas de proteção veicular

#### 2. `src/components/consultant/ConsultantSettings.tsx`

- Atualizar os defaults de `custom_questions` quando muda para template `landing` (linhas 450-453):
  - Pergunta 1: "Seu veículo tem proteção hoje?" (choice: 3 opções)
  - Pergunta 2: "Qual é o ano do seu veículo?" (choice: 4 opções)
  - Pergunta 3: "Qual sua maior preocupação com seu veículo?" (choice: 4 opções)

---

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Reformatar hero, adicionar seção formulário, adicionar prova social, hero CTA → scroll |
| `src/components/consultant/ConsultantSettings.tsx` | Atualizar defaults de custom_questions para landing |

Sem migrations necessárias — o formulário usa `custom_questions` (jsonb) e `quiz_submissions_new` já existentes.

