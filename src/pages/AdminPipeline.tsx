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
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Custom scrollbar state
  const [thumbWidth, setThumbWidth] = useState(0);
  const [thumbLeft, setThumbLeft] = useState(0);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Atualiza o thumb da scrollbar custom
  const updateScrollbar = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const { scrollWidth, clientWidth, scrollLeft: containerScrollLeft } = container;
    const trackWidth = track.clientWidth;

    // Verifica se há overflow
    const overflow = scrollWidth > clientWidth + 1;
    setHasOverflow(overflow);

    if (!overflow) {
      setThumbWidth(trackWidth);
      setThumbLeft(0);
      return;
    }

    const ratio = clientWidth / scrollWidth;
    const newThumbWidth = Math.max(Math.round(ratio * trackWidth), 60); // mínimo 60px
    const maxScrollLeft = scrollWidth - clientWidth;
    
    // ✅ Cálculo preciso do thumbLeft para ir até o final
    const maxThumbLeft = trackWidth - newThumbWidth;
    const scrollRatio = maxScrollLeft > 0 ? containerScrollLeft / maxScrollLeft : 0;
    const newThumbLeft = Math.round(scrollRatio * maxThumbLeft);

    setThumbWidth(newThumbWidth);
    setThumbLeft(Math.max(0, Math.min(newThumbLeft, maxThumbLeft)));
  }, []);

  // Observa mudanças no scroll, tamanho do container E do conteúdo
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const track = trackRef.current;
    if (!container) return;

    const handleScroll = () => updateScrollbar();
    container.addEventListener('scroll', handleScroll);
    
    // ResizeObserver para detectar mudanças de tamanho em todos os elementos relevantes
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateScrollbar);
    });
    
    resizeObserver.observe(container);
    if (content) resizeObserver.observe(content);
    if (track) resizeObserver.observe(track);

    // MutationObserver para detectar quando filhos são adicionados/removidos (stages carregando)
    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(updateScrollbar);
    });
    
    if (content) {
      mutationObserver.observe(content, { childList: true, subtree: true });
    }

    // Atualiza inicial com delays progressivos para garantir que o conteúdo carregou
    const timers = [100, 300, 600, 1000].map(delay => 
      setTimeout(updateScrollbar, delay)
    );

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [updateScrollbar]);

  // Wheel handler - scroll vertical APENAS dentro dos quadros
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      
      // ✅ Se o mouse está dentro de um quadro, NÃO INTERCEPTA NADA
      // Deixa o scroll vertical do quadro funcionar normalmente
      const verticalScrollArea = target.closest('[data-pipeline-vertical-scroll="true"]');
      if (verticalScrollArea) {
        return; // Não faz nada, deixa o ScrollArea do quadro lidar com o scroll
      }
      
      // ✅ APENAS fora dos quadros: converte scroll vertical para horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    
    document.body.style.overflow = 'hidden';
    return () => {
      container.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = '';
    };
  }, []);

  // Drag no container do pipeline (arrastar o fundo)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    // Não inicia drag se clicando em card arrastável ou na scrollbar custom
    if ((e.target as HTMLElement).closest('[data-rbd-draggable-id]')) return;
    if ((e.target as HTMLElement).closest('[data-pipeline-scrollbar]')) return;
    
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Drag no thumb da scrollbar custom
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingThumb(true);
    setDragStartX(e.clientX);
    setDragStartScrollLeft(containerRef.current?.scrollLeft || 0);
  };

  useEffect(() => {
    if (!isDraggingThumb) return;

    const handleMove = (e: MouseEvent) => {
      const container = containerRef.current;
      const track = trackRef.current;
      if (!container || !track) return;

      const trackWidth = track.clientWidth;
      const { scrollWidth, clientWidth } = container;
      const maxScrollLeft = scrollWidth - clientWidth;
      
      // Guard clauses - evita divisão por zero
      if (maxScrollLeft <= 0) return;
      if (trackWidth - thumbWidth <= 0) return;

      const deltaX = e.clientX - dragStartX;
      
      // Calcula a proporção do movimento no track para o scroll
      const scrollPerPixel = maxScrollLeft / (trackWidth - thumbWidth);
      const newScrollLeft = dragStartScrollLeft + (deltaX * scrollPerPixel);
      
      container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));
    };

    const handleUp = () => {
      setIsDraggingThumb(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingThumb, dragStartX, dragStartScrollLeft, thumbWidth]);

  // Click no track (pula para a posição)
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    
    // Não processa se clicou no thumb
    if ((e.target as HTMLElement).closest('[data-scrollbar-thumb]')) return;

    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = track.clientWidth;
    const { scrollWidth, clientWidth } = container;
    const maxScrollLeft = scrollWidth - clientWidth;
    
    // Calcula a posição do scroll baseado no click
    const targetScrollLeft = (clickX / trackWidth) * maxScrollLeft;
    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  };

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-64px)] w-full max-w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Pipeline de Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
              Arraste os leads entre as colunas • Use scroll ou arraste para navegar
            </p>
          </div>
          
          {/* Botão para gerenciar quadros */}
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 min-h-0 px-4 md:px-6 pb-2 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            width: '100%',
            maxWidth: '100vw',
            position: 'relative',
          }}
        >
          <div 
            ref={contentRef}
            className="inline-flex gap-3 md:gap-4 h-full pb-2"
            style={{ minWidth: 'max-content' }}
          >
            <PipelineBoard />
          </div>
        </div>

        {/* Custom Scrollbar - Sempre visível */}
        <div 
          data-pipeline-scrollbar="true"
          className="flex-shrink-0 px-4 md:px-6 pb-4"
        >
          <div 
            ref={trackRef}
            onClick={handleTrackClick}
            className={`relative h-3 rounded-full transition-colors ${
              hasOverflow 
                ? 'bg-muted/50 cursor-pointer hover:bg-muted/70' 
                : 'bg-muted/30 cursor-default'
            }`}
          >
            <div
              data-scrollbar-thumb="true"
              onMouseDown={hasOverflow ? handleThumbMouseDown : undefined}
              className={`absolute top-0 h-full rounded-full transition-all ${
                !hasOverflow 
                  ? 'bg-muted/40 cursor-default'
                  : isDraggingThumb 
                    ? 'bg-primary cursor-grabbing' 
                    : 'bg-primary/70 hover:bg-primary cursor-grab'
              }`}
              style={{
                width: hasOverflow ? `${thumbWidth}px` : '100%',
                left: `${thumbLeft}px`,
                minWidth: hasOverflow ? '60px' : undefined,
              }}
            />
          </div>
        </div>

        {/* Esconde a scrollbar nativa do webkit */}
        <style>{`
          [data-pipeline-container]::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </AdminLayout>
  );
}
