## Problema

A rota `/r/:slug` (Recrutamento de Consultores) carrega configurações próprias do banco (`page_purpose='recruitment'`), mas o template visual em `src/pages/CapturePage.tsx` tem **vários textos hardcoded** que falam de "proteção veicular", "veículo protegido", "75.000 associados", etc. Mesmo que o consultor configure título/subtítulo, esses blocos fixos continuam vendendo proteção para associados — o que descaracteriza a página de recrutamento.

Além disso, o `DEFAULT_CONFIG` (fallback quando ainda não há configuração salva) está sempre falando de proteção veicular, independente da rota.

## Objetivo

Quando a página for renderizada em modo recrutamento (`isRecruitment === true`, rota `/r/:slug`):
- Toda a copy hardcoded deve falar com **candidatos a consultor** (renda, oportunidade, time, carreira).
- O `DEFAULT_CONFIG` deve ter fallback de recrutamento.
- Os textos editáveis pelo consultor (título, subtítulo, botão, comparativo, etc.) continuam funcionando normalmente — apenas os pedaços fixos do template mudam.

## Mudanças

### 1. `src/pages/CapturePage.tsx`

**a) DEFAULT_CONFIG dinâmico por rota**
Transformar `DEFAULT_CONFIG` em função `getDefaultConfig(isRecruitment)` e usar no `useState` inicial. Para recrutamento:
- `title`: "Quer uma renda extra ou mudar de vida?"
- `subtitle`: "Faça parte do nosso time de consultores Top Brasil e tenha liberdade financeira vendendo proteção veicular com a maior referência da região."
- `button_text`: "Quero fazer parte do time →"
- `compare_title`: "Por que ser consultor Top Brasil é melhor que um emprego comum?"
- `compare_traditional_items`: ["Salário fixo limitado", "Horário rígido", "Sem crescimento real", "Chefe no pé", "Bater meta dos outros", "Demissão a qualquer momento"]
- `compare_topbrasil_items`: ["Comissões sem teto", "Horário flexível", "Plano de carreira claro", "Você é seu chefe", "Trabalhe pelos seus sonhos", "Estabilidade do seu jeito"]

**b) Textos hardcoded no template "landing" — condicionais por `isRecruitment`**

| Linha | Atual (proteção) | Novo (recrutamento) |
|---|---|---|
| 768 — badge | `PROTEÇÃO VEICULAR \| CAMPINAS & REGIÃO` | `OPORTUNIDADE DE CARREIRA \| TOP BRASIL` |
| 771-772 — H1 segunda linha | `Sem burocracia. Sem pegadinhas.` | usar quebra de linha do título configurado, sem segundo span fixo (renderizar `config.title` inteiro) |
| 775-776 — sub fallback | "A Top Brasil Campinas oferece proteção veicular completa…" | "Faça parte do time que mais cresce em proteção veicular. Comissões agressivas, treinamento completo e liberdade pra construir sua renda." (apenas quando subtítulo padrão) |
| 817 — eyebrow comparativo | `Proteção que cabe no bolso` | `Sua nova carreira começa aqui` |
| 822 — explicação comparativo | "O seguro tradicional cobra até 3x mais…" | "Empregos comuns te limitam. Como consultor Top Brasil você define quanto ganha, quando trabalha e até onde quer chegar — com produto que vende sozinho e suporte de quem é referência no mercado." |
| 865 — H2 do formulário | `Descubra o plano ideal para o seu veículo!` | `Cadastre-se e fale com nosso recrutador!` |
| 965 — texto botão submit | `Quero minha proteção agora` | `Quero entrar no time agora` |
| 989-1011 — Social proof | "+75.000 / veículos protegidos / Junte-se a mais de 75.000 associados…" / "Quero fazer parte agora" | "+75.000 / clientes atendidos pelo time Top Brasil / Faça parte do time que já transformou centenas de carreiras vendendo proteção veicular." / "Quero ser consultor agora" |

Implementação: criar pequenos objetos/constantes no início do bloco `if (config.template_type === 'landing')` com os textos por modo, ex.:

```ts
const copy = isRecruitment
  ? { badge: 'OPORTUNIDADE DE CARREIRA | TOP BRASIL', formHeading: 'Cadastre-se e fale com nosso recrutador!', submitCta: 'Quero entrar no time agora', /* ... */ }
  : { badge: 'PROTEÇÃO VEICULAR | CAMPINAS & REGIÃO',  formHeading: 'Descubra o plano ideal para o seu veículo!', submitCta: 'Quero minha proteção agora', /* ... */ };
```

E substituir cada string hardcoded pela referência ao `copy`.

**c) Hero — H1 com segundo span**
Hoje o template renderiza: `Seu carro protegido do jeito certo. <br> [span] Sem burocracia. Sem pegadinhas. [/span]`. Mas a string fixa `"Seu carro protegido do jeito certo."` ignora o `config.title` do consultor. Vou trocar por renderizar `config.title` quebrado por `\n` (já é a convenção de DEFAULT_CONFIG), com a última linha em destaque na cor do botão. Funciona para os dois modos e respeita o que o consultor configurou.

**d) ThankYouPage** (linha 153)
`buttonText` fallback `'Falar com um Consultor'` → quando recrutamento, fallback `'Falar com nosso recrutador'`. Passar `isRecruitment` como prop.

### 2. `src/components/consultant/ConsultantSettings.tsx`

Atualizar `getDefaults('recruitment')` para incluir também os defaults de comparativo coerentes com recrutamento (hoje só preenche título/subtítulo/botão/perguntas):

```ts
compare_enabled: true,
compare_title: 'Por que ser consultor Top Brasil é melhor que um emprego comum?',
compare_traditional_items: [...],
compare_topbrasil_items: [...],
```

E ajustar o `useEffect` que monta `captureForm` para usar esses defaults quando `pagePurpose === 'recruitment'` e o registro ainda não tem valores salvos.

## O que NÃO muda

- Estrutura visual, animações, layout, cores e branding (Top Brasil / laranja `#EB6608`).
- Lógica de envio, integração com Pixel, redirecionamento WhatsApp/URL/Thank You.
- Página `/c/:slug` (Captação de Associados) continua exatamente igual.
- Possibilidade do consultor sobrescrever todos os textos pelo painel.

## Arquivos editados

- `src/pages/CapturePage.tsx`
- `src/components/consultant/ConsultantSettings.tsx`

Sem migrações de banco, sem mudanças em edge functions.
