import { useRef, useState, useEffect } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Habilitar scroll com mouse wheel horizontal
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Converter scroll vertical para horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    // Não iniciar drag se clicando em card arrastável
    if ((e.target as HTMLElement).closest('[data-rbd-draggable-id]')) return;
    
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

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline de Vendas</h1>
            <p className="text-muted-foreground mt-1">
              Arraste os leads entre as colunas • Use scroll ou arraste para navegar
            </p>
          </div>
          
          {/* Botão para gerenciar quadros */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Gerenciar Quadros
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
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
          className={`flex-1 min-h-0 px-6 pb-6 pipeline-scroll select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ 
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div 
            className="inline-flex gap-4 h-full"
            style={{ minWidth: 'max-content' }}
          >
            <PipelineBoard />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
