

## Plano: Melhorias na Pagina de Captura, Settings e Dashboard Realtime

### Problemas Identificados

1. **Settings de Captura**: Sem upload de imagem (so URL), sem preview ao vivo, sem editar link, copy muito focada em consultores
2. **Thank You Page**: Sem botao WhatsApp quando link configurado
3. **Dashboard Realtime**: A subscription existe mas o filtro `consultant_id=eq.${currentUser.id}` pode falhar porque o RLS bloqueia o SELECT no realtime para rows que ainda nao tem consultant_id no momento do INSERT. Alem disso, o canal no `AdminDashboard.tsx` (pai) tambem faz invalidate mas sem filtro de consultant, podendo conflitar.

---

### Mudancas

#### 1. `src/components/consultant/ConsultantSettings.tsx` - CaptureSettingsTab

**Adicionar:**
- Upload de imagem hero (reutilizar logica existente do quiz cover com `quiz-images` bucket)
- Preview ao vivo da pagina de captura (mini iframe ou componente visual que mostra como ficara)
- Campo editavel para o link da pagina (permitir adicionar parametros UTM etc)
- Default copy mais generalista: `"Descubra uma oportunidade unica!"` / `"Preencha seus dados e saiba como comecar."`
- Campo de link WhatsApp para o botao da pagina de obrigado (reutilizar `whatsapp_button_url` do consultor ou campo dedicado)

**Preview visual**: Componente inline que renderiza um mini mockup da pagina com titulo, subtitulo, imagem, botao com a cor escolhida - atualiza em tempo real conforme o consultor edita.

#### 2. `src/pages/CapturePage.tsx` - Thank You Screen

**Mudar a tela de submitted:**
- Se `whatsapp_button_url` do consultor estiver configurado, mostrar botao "Falar no WhatsApp" que redireciona para `wa.me/{numero}?text={mensagem}`
- Se nao tiver configurado, mostrar apenas a mensagem de obrigado (sem botao)
- Atualizar default copy para ser mais generalista

#### 3. `src/components/consultant/ConsultantDashboard.tsx` - Realtime Fix

**Problema**: O canal com filtro `consultant_id=eq.${currentUser.id}` pode nao disparar corretamente porque o Supabase Realtime com RLS + filtros tem limitacoes. O canal no `AdminDashboard.tsx` tambem faz invalidate mas para ALL events sem filtro de usuario.

**Solucao**: Remover o filtro do canal realtime e deixar o RLS fazer o trabalho. O callback so faz `invalidateQueries` entao nao ha risco de seguranca - a query refetch vai respeitar o RLS automaticamente.

---

### Arquivos a Editar

| Arquivo | Mudanca |
|---|---|
| `src/components/consultant/ConsultantSettings.tsx` | Upload imagem, preview, link editavel, copy generalista |
| `src/pages/CapturePage.tsx` | Thank you com botao WhatsApp, copy generalista |
| `src/components/consultant/ConsultantDashboard.tsx` | Fix realtime removendo filtro do canal |

### Ordem
1. ConsultantSettings (upload + preview + link editavel)
2. CapturePage (thank you + copy)
3. ConsultantDashboard (fix realtime)

