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
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  
  // Refs para métricas (evita re-renders durante drag)
  const metricsRef = useRef({
    thumbWidth: 0,
    maxScrollLeft: 0,
    maxThumbLeft: 0,
    trackWidth: 0,
  });
  
  // Estado apenas para visibilidade
  const [hasOverflow, setHasOverflow] = useState(false);
  const [thumbWidth, setThumbWidth] = useState(0);

  // Atualiza métricas e posição do thumb
  const updateScrollbar = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!container || !track || !thumb) return;

    const { scrollWidth, clientWidth, scrollLeft: containerScrollLeft } = container;
    const trackWidth = track.clientWidth;

    const overflow = scrollWidth > clientWidth + 1;
    setHasOverflow(overflow);

    if (!overflow) {
      setThumbWidth(trackWidth);
      thumb.style.transform = 'translateX(0px)';
      thumb.style.width = '100%';
      metricsRef.current = { thumbWidth: trackWidth, maxScrollLeft: 0, maxThumbLeft: 0, trackWidth };
      return;
    }

    const ratio = clientWidth / scrollWidth;
    const newThumbWidth = Math.max(Math.round(ratio * trackWidth), 60);
    const maxScrollLeft = scrollWidth - clientWidth;
    const maxThumbLeft = trackWidth - newThumbWidth;
    const scrollRatio = maxScrollLeft > 0 ? containerScrollLeft / maxScrollLeft : 0;
    const newThumbLeft = Math.round(scrollRatio * maxThumbLeft);

    // Atualiza estado para largura (só quando muda)
    setThumbWidth(newThumbWidth);
    
    // Atualiza DOM diretamente para posição (sem delay)
    thumb.style.width = `${newThumbWidth}px`;
    thumb.style.transform = `translateX(${Math.max(0, Math.min(newThumbLeft, maxThumbLeft))}px)`;

    // Guarda métricas em ref
    metricsRef.current = { thumbWidth: newThumbWidth, maxScrollLeft, maxThumbLeft, trackWidth };
  }, []);

  // Observa mudanças
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const track = trackRef.current;
    if (!container) return;

    const handleScroll = () => updateScrollbar();
    container.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollbar());
    resizeObserver.observe(container);
    if (content) resizeObserver.observe(content);
    if (track) resizeObserver.observe(track);

    const mutationObserver = new MutationObserver(() => updateScrollbar());
    if (content) {
      mutationObserver.observe(content, { childList: true, subtree: true });
    }

    // ✅ Atualiza já no mount (evita estado inicial “sem barra”)
    updateScrollbar();

    // Reforços iniciais (conteúdo pode renderizar em etapas)
    const timers = [100, 300, 600].map((delay) => setTimeout(updateScrollbar, delay));

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [updateScrollbar]);

  // Drag no thumb usando Pointer Events (sem delay)
  const handleThumbPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasOverflow) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const thumb = thumbRef.current;
    const container = containerRef.current;
    const track = trackRef.current;
    if (!thumb || !container || !track) return;

    // Captura o pointer
    thumb.setPointerCapture(e.pointerId);
    thumb.style.cursor = 'grabbing';

    const startX = e.clientX;
    const startScrollLeft = container.scrollLeft;
    const { maxScrollLeft, maxThumbLeft, thumbWidth: tw } = metricsRef.current;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      
      // Calcula nova posição do scroll
      const scrollPerPixel = maxThumbLeft > 0 ? maxScrollLeft / maxThumbLeft : 0;
      const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, startScrollLeft + deltaX * scrollPerPixel));
      
      // Aplica scroll
      container.scrollLeft = newScrollLeft;
      
      // Calcula e aplica posição do thumb diretamente no DOM
      const scrollRatio = maxScrollLeft > 0 ? newScrollLeft / maxScrollLeft : 0;
      const newThumbLeft = Math.round(scrollRatio * maxThumbLeft);
      thumb.style.transform = `translateX(${Math.max(0, Math.min(newThumbLeft, maxThumbLeft))}px)`;
    };

    const handlePointerUp = () => {
      thumb.releasePointerCapture(e.pointerId);
      thumb.style.cursor = 'grab';
      thumb.removeEventListener('pointermove', handlePointerMove);
      thumb.removeEventListener('pointerup', handlePointerUp);
      thumb.removeEventListener('pointercancel', handlePointerUp);
    };

    thumb.addEventListener('pointermove', handlePointerMove);
    thumb.addEventListener('pointerup', handlePointerUp);
    thumb.addEventListener('pointercancel', handlePointerUp);
  }, [hasOverflow]);

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-64px)] w-full max-w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Pipeline de Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
              Arraste os leads entre as colunas • Arraste a barra para navegar
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

        {/* Pipeline Board - Container com scroll horizontal */}
        <div 
          ref={containerRef}
          className="pipeline-scroll-container flex-1 min-h-0 px-4 md:px-6 pb-2"
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div 
            ref={contentRef}
            className="inline-flex gap-3 md:gap-4 h-full pb-2"
            style={{ minWidth: 'max-content' }}
          >
            <PipelineBoard />
            {/* Spacer para garantir que o último quadro apareça completo */}
            <div className="w-4 md:w-6 shrink-0" aria-hidden="true" />
          </div>
        </div>

        {/* Custom Scrollbar */}
        <div 
          data-pipeline-scrollbar="true"
          className="flex-shrink-0 px-4 md:px-6 pb-4"
        >
          <div 
            ref={trackRef}
            className={`relative h-3 rounded-full border border-border/60 transition-colors ${
              hasOverflow 
                ? 'bg-muted/50' 
                : 'bg-muted/40'
            }`}
          >
            <div
              ref={thumbRef}
              data-scrollbar-thumb="true"
              onPointerDown={handleThumbPointerDown}
              className={`absolute left-0 top-0 h-full rounded-full shadow-sm ${
                !hasOverflow 
                  ? 'bg-muted/50 cursor-default'
                  : 'bg-primary/80 hover:bg-primary cursor-grab'
              }`}
              style={{
                width: hasOverflow ? `${thumbWidth}px` : '100%',
                minWidth: hasOverflow ? '60px' : undefined,
                touchAction: 'none',
              }}
            />
          </div>
        </div>

        {/* Esconde a scrollbar nativa */}
        <style>{`
          .pipeline-scroll-container::-webkit-scrollbar {
            display: none;
          }
          .pipeline-scroll-container {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          html, body, #root {
            overflow-x: hidden;
            max-width: 100vw;
          }
        `}</style>
      </div>
    </AdminLayout>
  );
}
