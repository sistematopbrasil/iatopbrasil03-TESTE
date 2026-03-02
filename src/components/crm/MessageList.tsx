import { useEffect, useRef, useState, useMemo } from 'react';
import { Message } from '@/lib/crm-service';
import { MessageItem } from './MessageItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  conversationId?: string;
  isTyping?: boolean;
}

export function MessageList({ messages, conversationId, isTyping = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setShouldAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll && messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    setShouldAutoScroll(true);
    // Wait for messages to render before scrolling
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [conversationId]);

  // Parse timestamp correctly considering it might be UTC
  const parseMessageDate = (timestamp: string): Date => {
    // If timestamp doesn't have timezone info, treat as UTC and convert to local
    if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('-', 10)) {
      // Append Z to indicate UTC if no timezone present
      return new Date(timestamp + 'Z');
    }
    return new Date(timestamp);
  };

  const groupedMessages = useMemo(() => {
    const groups: Record<string, Message[]> = {};

    messages.forEach((msg) => {
      const msgDate = parseMessageDate(msg.timestamp);
      const date = format(msgDate, 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });

    return groups;
  }, [messages]);

  function formatDateHeader(dateStr: string): string {
    // Parse the date string as local date
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.getTime() === today.getTime()) return 'Hoje';
    if (date.getTime() === yesterday.getTime()) return 'Ontem';
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2"
      >
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            {/* Date Separator */}
            <div className="flex items-center justify-center my-4 sticky top-0 z-10">
              <Badge 
                variant="outline" 
                className="bg-muted/80 backdrop-blur-sm text-muted-foreground border-border text-xs px-3 py-1 shadow-sm"
              >
                {formatDateHeader(date)}
              </Badge>
            </div>

            {/* Messages for this date */}
            <div className="space-y-1">
              {msgs.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 px-4 py-2 ml-2">
            <div className="flex gap-1 bg-muted rounded-full px-3 py-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-muted-foreground">digitando...</span>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Scroll to bottom button */}
      {!shouldAutoScroll && (
        <Button
          onClick={() => scrollToBottom('smooth')}
          size="icon"
          className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-primary shadow-lg hover:scale-110 transition-transform z-20"
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
