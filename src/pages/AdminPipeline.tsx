// Pipeline page - v2
import { AdminLayout } from '@/components/admin/AdminLayout';
import { PipelineBoard } from '@/components/crm/PipelineBoard';
import { PipelineStageManager } from '@/components/crm/PipelineStageManager';
import { Button } from '@/components/ui/button';
import { Settings2, Info } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { useFunnel } from '@/contexts/FunnelContext';
import { FUNNEL_LABELS } from '@/lib/funnel-types';

export default function AdminPipeline() {
  const scrollRef = useHorizontalDragScroll<HTMLDivElement>();
  const { activeFunnel, resolvedFunnel, setActiveFunnel, availableFunnels } = useFunnel();
  const isAllMode = activeFunnel === 'all';

  return (
    <AdminLayout disableVerticalScroll>
      <div className="h-full w-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-2 md:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Pipeline de Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
              Arraste os leads entre as colunas para atualizar o status
            </p>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 self-start sm:self-auto">
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Gerenciar Quadros</span>
                <span className="sm:hidden">Quadros</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[320px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Configurações do Pipeline</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <PipelineStageManager />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Banner em modo "Todos" — Pipeline mostra apenas 1 funil */}
        {isAllMode && (
          <div className="flex-shrink-0 mx-4 md:mx-6 mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-start sm:items-center gap-2 text-xs sm:text-sm">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-foreground flex-1">
              Pipeline mostra apenas o funil <strong>{FUNNEL_LABELS[resolvedFunnel]}</strong>. Use o seletor para trocar.
            </span>
            {availableFunnels.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={f === resolvedFunnel ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setActiveFunnel(f)}
              >
                {FUNNEL_LABELS[f]}
              </Button>
            ))}
          </div>
        )}

        {/* Pipeline Board - scrollbar nativa estilizada */}
        <div 
          ref={scrollRef}
          className="flex-1 min-h-0 px-4 md:px-6 pb-3 pipeline-scroll cursor-grab active:cursor-grabbing"
        >
          <div 
            className="inline-flex gap-3 md:gap-4"
            style={{ minWidth: 'max-content', height: '100%' }}
          >
            <PipelineBoard />
            <div className="w-4 md:w-6 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
