import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ imageUrl, isOpen, onClose }: ImageModalProps) {
  const [zoom, setZoom] = useState(1);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `imagem_${Date.now()}.jpg`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const handleClose = () => {
    setZoom(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-full p-0 bg-background/95 backdrop-blur-sm border-border">
        {/* Botões de ação */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="bg-background/50 hover:bg-background/70"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="bg-background/50 hover:bg-background/70"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDownload}
            className="bg-background/50 hover:bg-background/70"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose}
            className="bg-background/50 hover:bg-background/70"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Imagem com zoom */}
        <div className="flex items-center justify-center min-h-[60vh] max-h-[80vh] overflow-auto p-4">
          <img
            src={imageUrl}
            alt="Imagem ampliada"
            className="max-w-full h-auto transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
