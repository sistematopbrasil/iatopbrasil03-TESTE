import { useRef, useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { PipelineBoard } from '@/components/crm/PipelineBoard';
import { PipelineStageManager } from '@/components/crm/PipelineStageManager';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export default function AdminPipeline() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollMetrics, setScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });

  // Atualiza métricas do scroll
  const updateScrollMetrics = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    setScrollMetrics({
      scrollLeft: container.scrollLeft,
      scrollWidth: container.scrollWidth,
      clientWidth: container.clientWidth,
    });
  }, []);

  // Listener de scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollMetrics();
    container.addEventListener('scroll', updateScrollMetrics);
    
    // ResizeObserver para recalcular quando o conteúdo muda
    const resizeObserver = new ResizeObserver(updateScrollMetrics);
    resizeObserver.observe(container);
    
    // Observa também o conteúdo interno
    const innerContent = container.firstElementChild;
    if (innerContent) {
      resizeObserver.observe(innerContent);
    }

    return () => {
      container.removeEventListener('scroll', updateScrollMetrics);
      resizeObserver.disconnect();
    };
  }, [updateScrollMetrics]);

  // Calcula se há overflow e tamanho do thumb
  const hasOverflow = scrollMetrics.scrollWidth > scrollMetrics.clientWidth;
  const thumbWidth = hasOverflow 
    ? Math.max(40, (scrollMetrics.clientWidth / scrollMetrics.scrollWidth) * 100)
    : 100;
  const thumbPosition = hasOverflow
    ? (scrollMetrics.scrollLeft / (scrollMetrics.scrollWidth - scrollMetrics.clientWidth)) * (100 - thumbWidth)
    : 0;

  // Handler para clique no track da scrollbar
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const maxScroll = scrollMetrics.scrollWidth - scrollMetrics.clientWidth;
    
    container.scrollTo({
      left: clickPosition * maxScroll,
      behavior: 'smooth',
    });
  };

  // Handler para drag do thumb
  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const container = scrollContainerRef.current;
    if (!container) return;

    const startX = e.clientX;
    const startScrollLeft = container.scrollLeft;
    const trackWidth = e.currentTarget.parentElement?.clientWidth || 1;
    const maxScroll = scrollMetrics.scrollWidth - scrollMetrics.clientWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const scrollDelta = (deltaX / trackWidth) * maxScroll;
      container.scrollLeft = startScrollLeft + scrollDelta;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <AdminLayout>
      <div className="h-full w-full max-w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

        {/* Pipeline Board - Container sem scrollbar nativa visível */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 px-4 md:px-6 overflow-x-auto overflow-y-hidden scrollbar-none"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div 
            className="inline-flex gap-3 md:gap-4 h-full"
            style={{ minWidth: 'max-content' }}
          >
            <PipelineBoard />
            {/* Spacer para garantir que o último quadro apareça completo */}
            <div className="w-4 md:w-6 shrink-0" aria-hidden="true" />
          </div>
        </div>

        {/* Custom Scrollbar - Fixa abaixo dos quadros */}
        {hasOverflow && (
          <div className="flex-shrink-0 px-4 md:px-6 py-3">
            <div 
              className="relative h-2 bg-muted rounded-full cursor-pointer"
              onClick={handleTrackClick}
            >
              <div 
                className="absolute top-0 h-full bg-primary/60 hover:bg-primary/80 rounded-full cursor-grab active:cursor-grabbing transition-colors"
                style={{ 
                  width: `${thumbWidth}%`,
                  left: `${thumbPosition}%`,
                }}
                onMouseDown={handleThumbMouseDown}
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
