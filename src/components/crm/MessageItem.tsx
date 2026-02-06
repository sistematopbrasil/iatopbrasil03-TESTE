import { useState } from 'react';
import { Message } from '@/lib/crm-service';
import { Check, CheckCheck, Clock, AlertCircle, Download, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AudioPlayer } from './AudioPlayer';
import { ImageModal } from './ImageModal';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isOutgoing = message.direction === 'outgoing';
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  const handleImageClick = (url: string) => {
    setSelectedImage(url);
    setImageModalOpen(true);
  };

  return (
    <>
      <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
        <div
          className={`
            max-w-[70%] rounded-2xl p-3 shadow-sm
            ${isOutgoing
              ? 'bg-gradient-to-br from-primary to-primary-light text-primary-foreground rounded-br-md'
              : 'bg-card border border-border text-foreground rounded-bl-md'
            }
          `}
        >
          {/* Text Content */}
          {message.type === 'text' && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
          )}

          {/* Image Content - Limite de tamanho 300x300 */}
          {message.type === 'image' && message.media_url && (
            <div className="space-y-2">
              <img
                src={message.media_url}
                alt="Imagem"
                className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxWidth: '300px', maxHeight: '300px', objectFit: 'cover' }}
                onClick={() => handleImageClick(message.media_url!)}
              />
              {message.content && (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          )}

          {/* Video Content - Limite de tamanho 400x300 */}
          {message.type === 'video' && message.media_url && (
            <div className="space-y-2">
              <video
                src={message.media_url}
                controls
                className="rounded-lg"
                style={{ maxWidth: '400px', maxHeight: '300px' }}
              />
              {message.content && (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          )}

          {/* Audio Content - Using AudioPlayer */}
          {message.type === 'audio' && message.media_url && (
            <AudioPlayer src={message.media_url} isOutgoing={isOutgoing} />
          )}

          {/* Document Content */}
          {message.type === 'document' && message.media_url && (
            <a
              href={message.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                flex items-center gap-3 p-2 rounded-lg transition-colors
                ${isOutgoing ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80'}
              `}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOutgoing ? 'bg-white/20' : 'bg-primary/10'}`}>
                <Download className={`w-5 h-5 ${isOutgoing ? 'text-white' : 'text-primary'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {message.media_filename || 'Documento'}
                </p>
                {message.media_size && (
                  <p className={`text-xs ${isOutgoing ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {formatFileSize(message.media_size)}
                  </p>
                )}
              </div>
            </a>
          )}

          {/* Sticker */}
          {message.type === 'sticker' && message.media_url && (
            <img
              src={message.media_url}
              alt="Figurinha"
              className="w-32 h-32 object-contain"
            />
          )}

          {/* Location */}
          {message.type === 'location' && (
            <div className="flex items-center gap-2">
              <span>📍</span>
              <span className="text-sm">Localização compartilhada</span>
            </div>
          )}

          {/* Contact */}
          {message.type === 'contact' && (
            <div className="flex items-center gap-2">
              <span>👤</span>
              <span className="text-sm">Contato compartilhado</span>
            </div>
          )}

          {/* Footer with time and status */}
          <div className={`flex items-center justify-end gap-1.5 mt-1.5 ${isOutgoing ? 'text-white/70' : 'text-muted-foreground'}`}>
            {isOutgoing && message.metadata?.sent_by_ai && (
              <span className="flex items-center gap-0.5 text-[10px] opacity-80">
                <Bot className="w-3 h-3" />
                IA
              </span>
            )}
            <span className="text-[10px]">
              {format(new Date(message.timestamp), 'HH:mm', { locale: ptBR })}
            </span>

            {isOutgoing && (
              <span className="flex items-center">
                {message.status === 'sending' && (
                  <Clock className="w-3 h-3" />
                )}
                {message.status === 'sent' && (
                  <Check className="w-3 h-3" />
                )}
                {message.status === 'delivered' && (
                  <CheckCheck className="w-3 h-3" />
                )}
                {message.status === 'read' && (
                  <CheckCheck className="w-3 h-3 text-info" />
                )}
                {message.status === 'error' && (
                  <AlertCircle className="w-3 h-3 text-destructive" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modal de imagem */}
      <ImageModal
        imageUrl={selectedImage}
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
      />
    </>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
