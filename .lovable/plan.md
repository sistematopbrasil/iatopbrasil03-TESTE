
## Plano: Fix Pipeline, Melhorar Captura e Otimizar Pre-carregamento

### 1. Pipeline - Causa raiz do erro

**Problema encontrado**: A tabela `pipeline_stages` esta **VAZIA**. O codigo `PipelineBoard.tsx` usa DEFAULT_STAGES com IDs como `'default-novo'`, `'default-contatado'` - que **nao sao UUIDs validos**. A coluna `pipeline_stage_id` e do tipo UUID com FK para `pipeline_stages(id)`. Ao arrastar um lead, o UPDATE tenta setar um valor invalido e o PostgreSQL rejeita.

**Solucao**: Migracao SQL para inserir os stages padrao na tabela `pipeline_stages` para cada organizacao existente. Isso garante que os IDs sejam UUIDs validos e o drag-and-drop funcione. Tambem atualizar `PipelineBoard.tsx` para nunca usar DEFAULT_STAGES com IDs falsos - em vez disso, criar os stages no banco se nao existirem.

**Migracao:**
```sql
INSERT INTO pipeline_stages (organization_id, name, color, icon, order_index)
SELECT o.id, s.name, s.color, s.icon, s.order_index
FROM organizations o
CROSS JOIN (VALUES
  ('Novos Leads', '#3B82F6', 'trending-up', 0),
  ('Contato Inicial', '#8B5CF6', 'phone', 1),
  ('Qualificados', '#F59E0B', 'sparkles', 2),
  ('Convertidos', '#10B981', 'check-circle', 3),
  ('Descartados', '#EF4444', 'x-circle', 4)
) AS s(name, color, icon, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps WHERE ps.organization_id = o.id
);
```

**PipelineBoard.tsx**: Remover fallback DEFAULT_STAGES. Se `customStages` estiver vazio, mostrar mensagem orientando o usuario a configurar os quadros. Nao permitir drag com IDs invalidos.

---

### 2. Pagina de Captura - Campos maiores e visual melhorado

**Mudancas em `CapturePage.tsx`:**
- Aumentar altura dos inputs de `h-13` para `h-14` (56px) - campos mais confortaveis
- Aumentar tamanho do texto dos inputs de `text-[15px]` para `text-base`
- Aumentar `max-w-md` para `max-w-lg` para o container principal ter mais largura
- Aumentar padding do form card de `p-7` para `p-8`
- Espacamento entre campos de `space-y-5` para `space-y-6`
- Icones dos campos de `w-4.5 h-4.5` para `w-5 h-5`
- Step numbers de `w-5 h-5` para `w-6 h-6` com texto maior
- Botao CTA de `h-14` para `h-16` com fonte maior
- Progress bar com cor dinamica usando style inline (nao depender de CSS variable)
- Badge de seguranca mais elegante com borda mais visivel

---

### 3. Pre-carregamento otimizado

O `usePrefetchAdminData.ts` ja existe e pre-carrega bastante dados. Melhorias:
- Adicionar prefetch de **eventos** (tabela events)
- Adicionar prefetch de **dashboard stats** (contagens de leads por periodo)
- Garantir que o `staleTime` das queries individuais nas paginas seja compativel com o cache do prefetch (nao refetch se dados ja estao no cache)
- Mover o hook para executar apenas UMA VEZ (nao em cada render do AdminLayout) usando um ref de controle

---

### Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Inserir pipeline_stages padrao para organizacoes existentes |
| `src/components/crm/PipelineBoard.tsx` | Remover DEFAULT_STAGES falsos, tratar estado vazio |
| `src/pages/CapturePage.tsx` | Campos maiores, visual refinado |
| `src/hooks/usePrefetchAdminData.ts` | Adicionar prefetch de eventos e dashboard, controle de execucao unica |

### Ordem
1. Migracao SQL (criar stages reais)
2. PipelineBoard (remover IDs falsos)
3. CapturePage (visual)
4. Prefetch (otimizar)
