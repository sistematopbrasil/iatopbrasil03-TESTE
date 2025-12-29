import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  Send, Paperclip, Mic, Image, Video, FileText, 
  Loader2, Zap, X, Music, Settings 
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MessageInputProps {
  conversationId: string;
  onSend: (
    type: 'text' | 'audio' | 'image' | 'video' | 'document',
    content: string,
    mediaUrl?: string,
    fileName?: string
  ) => Promise<boolean | { success: boolean; needsReconnect?: boolean }>;
  isSending: boolean;
  onOpenSettings?: () => void;
}

interface FilePreview {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  file: File;
  name: string;
}

interface QuickReply {
  id: string;
  shortcut: string;
  content: string | null;
  description: string | null;
  type: string;
  media_url: string | null;
  media_filename: string | null;
}

interface PendingMediaSend {
  type: 'image' | 'video' | 'audio' | 'document';
  content: string;
  mediaUrl: string;
  fileName: string | null;
  shortcut: string;
}

export function MessageInput({ conversationId, onSend, isSending, onOpenSettings }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [caption, setCaption] = useState('');
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [pendingMediaSend, setPendingMediaSend] = useState<PendingMediaSend | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<QuickReply[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load quick replies from database
  useEffect(() => {
    loadQuickReplies();
  }, []);

  async function loadQuickReplies() {
    try {
      const { data, error } = await supabase
        .from('crm_quick_replies')
        .select('id, shortcut, content, description, type, media_url, media_filename')
        .order('shortcut');

      if (error) throw error;
      setQuickReplies(data || []);
    } catch (error) {
      console.error('Error loading quick replies:', error);
    }
  }

  async function handleSend() {
    if (!message.trim() || isSending) return;

    const success = await onSend('text', message.trim());
    if (success) {
      setMessage('');
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // ESC para fechar sugestões
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  // Detectar digitação de / para sugestões
  function handleMessageChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setMessage(value);

    // Verificar se está digitando um atalho (começa com /)
    if (value.startsWith('/') && value.length >= 2) {
      const searchTerm = value.toLowerCase();
      const matches = quickReplies.filter(qr => 
        qr.shortcut.toLowerCase().includes(searchTerm)
      );
      setFilteredSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
      setFilteredSuggestions([]);
    }
  }

  function handleSelectSuggestion(qr: QuickReply) {
    if (qr.type !== 'text' && qr.media_url) {
      setPendingMediaSend({
        type: qr.type as any,
        content: qr.content || '',
        mediaUrl: qr.media_url,
        fileName: qr.media_filename,
        shortcut: qr.shortcut,
      });
      setMessage('');
    } else {
      setMessage(qr.content || '');
    }
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    textareaRef.current?.focus();
  }

  function handleFileSelect(type: 'image' | 'video' | 'audio' | 'document') {
    const input = document.createElement('input');
    input.type = 'file';

    switch (type) {
      case 'image':
        input.accept = 'image/jpeg,image/png,image/gif,image/webp';
        break;
      case 'video':
        input.accept = 'video/mp4,video/quicktime,video/3gpp';
        break;
      case 'audio':
        input.accept = 'audio/mpeg,audio/ogg,audio/wav,audio/mp4';
        break;
      case 'document':
        input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';
        break;
    }

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 16 * 1024 * 1024) {
        toast.error('Arquivo muito grande! Máximo 16MB');
        return;
      }

      const url = URL.createObjectURL(file);
      setFilePreview({ type, url, file, name: file.name });
      setCaption('');
    };

    input.click();
  }

  async function handleSendFile() {
    if (!filePreview || isUploading) return;

    setIsUploading(true);
    try {
      const fileExt = filePreview.file.name.split('.').pop();
      const fileName = `${conversationId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('crm-media')
        .upload(fileName, filePreview.file, {
          contentType: filePreview.file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('crm-media')
        .getPublicUrl(fileName);

      const success = await onSend(
        filePreview.type,
        caption.trim() || '',
        urlData.publicUrl,
        filePreview.name
      );

      if (success) {
        toast.success('Arquivo enviado!');
        clearFilePreview();
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Erro ao enviar arquivo');
    } finally {
      setIsUploading(false);
    }
  }

  function clearFilePreview() {
    if (filePreview?.url) {
      URL.revokeObjectURL(filePreview.url);
    }
    setFilePreview(null);
    setCaption('');
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon() {
    switch (filePreview?.type) {
      case 'audio':
        return <Music className="w-8 h-8 text-primary" />;
      case 'document':
        return <FileText className="w-8 h-8 text-primary" />;
      default:
        return null;
    }
  }

  function getMediaTypeLabel(type: string) {
    switch (type) {
      case 'image': return 'imagem';
      case 'video': return 'vídeo';
      case 'audio': return 'áudio';
      case 'document': return 'documento';
      default: return 'arquivo';
    }
  }

  async function handleConfirmMediaSend() {
    if (!pendingMediaSend) return;
    
    const success = await onSend(
      pendingMediaSend.type,
      pendingMediaSend.content,
      pendingMediaSend.mediaUrl,
      pendingMediaSend.fileName || undefined
    );
    
    if (success) {
      toast.success('Mídia enviada!');
    }
    
    setPendingMediaSend(null);
  }

    return (
    <div className="p-4 border-t border-border bg-card/50 relative">
      {/* File Preview */}
      {filePreview && (
        <Card className="glass p-4 mb-3 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              {filePreview.type === 'image' && (
                <img 
                  src={filePreview.url} 
                  alt="Preview" 
                  className="w-full h-full object-cover" 
                />
              )}
              {filePreview.type === 'video' && (
                <video 
                  src={filePreview.url} 
                  className="w-full h-full object-cover" 
                />
              )}
              {(filePreview.type === 'audio' || filePreview.type === 'document') && getFileIcon()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {filePreview.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(filePreview.file.size)}
              </p>

              {/* Mostrar campo de legenda apenas para imagem e vídeo */}
              {(filePreview.type === 'image' || filePreview.type === 'video') && (
                <Input
                  placeholder="Adicionar legenda (opcional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="mt-2 glass text-sm h-8"
                />
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilePreview}
              className="hover:bg-destructive/20 hover:text-destructive h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <Button
            onClick={handleSendFile}
            disabled={isUploading || isSending}
            className="w-full mt-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar {filePreview.type === 'image' ? 'Imagem' :
                        filePreview.type === 'video' ? 'Vídeo' :
                        filePreview.type === 'audio' ? 'Áudio' : 'Documento'}
              </>
            )}
          </Button>
        </Card>
      )}

      {/* Quick Reply Suggestions while typing */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <Card className="absolute bottom-full left-0 right-0 mb-2 p-2 z-10 border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
          <div className="space-y-1">
            {filteredSuggestions.map((qr) => (
              <button
                key={qr.id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-primary/20 transition-colors flex items-center gap-2"
                onClick={() => handleSelectSuggestion(qr)}
              >
                <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{qr.shortcut}</span>
                  {qr.description && (
                    <span className="text-xs text-muted-foreground ml-2">{qr.description}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Replies - Horizontal scroll */}
      <div className="mb-3 overflow-hidden">
        <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {quickReplies.map((qr) => (
            <Badge
              key={qr.id}
              variant="outline"
              className="cursor-pointer hover:bg-primary/20 hover:border-primary transition-all text-xs whitespace-nowrap flex-shrink-0"
              onClick={async () => {
                if (qr.type !== 'text' && qr.media_url) {
                  setPendingMediaSend({
                    type: qr.type as any,
                    content: qr.content || '',
                    mediaUrl: qr.media_url,
                    fileName: qr.media_filename,
                    shortcut: qr.shortcut,
                  });
                } else {
                  setMessage(qr.content || '');
                }
              }}
              title={qr.description || qr.shortcut}
            >
              <Zap className="w-3 h-3 mr-1 text-primary" />
              {qr.shortcut}
            </Badge>
          ))}
          {onOpenSettings && (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted/50 transition-all text-xs whitespace-nowrap flex-shrink-0"
              onClick={onOpenSettings}
            >
              <Settings className="w-3 h-3 mr-1" />
              Configurar
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2">
        {/* Quick Actions */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFileSelect('image')}
            disabled={isSending || !!filePreview}
            className="hover:bg-primary/20 hover:text-primary"
            title="Enviar imagem"
          >
            <Image className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFileSelect('video')}
            disabled={isSending || !!filePreview}
            className="hover:bg-primary/20 hover:text-primary"
            title="Enviar vídeo"
          >
            <Video className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFileSelect('audio')}
            disabled={isSending || !!filePreview}
            className="hover:bg-primary/20 hover:text-primary"
            title="Enviar áudio"
          >
            <Mic className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFileSelect('document')}
            disabled={isSending || !!filePreview}
            className="hover:bg-primary/20 hover:text-primary"
            title="Enviar documento"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
        </div>

        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyPress}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Digite sua mensagem... (Enter para enviar, / para atalhos)"
          className="flex-1 min-h-[44px] max-h-[120px] resize-none glass border-border focus:border-primary transition-all"
          disabled={isSending || !!filePreview}
        />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending || !!filePreview}
          className="bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90 transition-all shadow-glow-sm h-[44px] px-5"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Media Confirmation Dialog */}
      <AlertDialog open={!!pendingMediaSend} onOpenChange={(open) => !open && setPendingMediaSend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja enviar a {getMediaTypeLabel(pendingMediaSend?.type || '')} "{pendingMediaSend?.shortcut}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMediaSend}>
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
