import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Pause, Play, XCircle, Clock, Zap, Send } from 'lucide-react';
import { useAIConversationState } from '@/hooks/useAIConversationState';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface AIStatusBadgeProps {
  conversationId: string | null;
  aiEnabled: boolean;
}

function formatTimeRemaining(pausedUntil: string | null): string | null {
  if (!pausedUntil) return null;
  const diff = new Date(pausedUntil).getTime() - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

export function AIStatusBadge({ conversationId, aiEnabled }: AIStatusBadgeProps) {
  const { state, status, pause, resume, disable, activate, activateSilent, isPending } = useAIConversationState(conversationId);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'paused' || !state?.paused_until) {
      setTimeLeft(null);
      return;
    }
    const update = () => setTimeLeft(formatTimeRemaining(state.paused_until));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [status, state?.paused_until]);

  if (!aiEnabled) return null;

  // Determine effective status: when AI is globally enabled and no per-conversation state exists, treat as active
  const effectiveStatus = status === 'none' ? 'active' : status;

  const pauseOptions = [
    { label: '30 minutos', minutes: 30 },
    { label: '1 hora', minutes: 60 },
    { label: '2 horas', minutes: 120 },
    { label: '4 horas', minutes: 240 },
    { label: '8 horas', minutes: 480 },
    { label: '24 horas', minutes: 1440 },
  ];

  const statusConfig = {
    active: { label: 'IA Ativa', variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700 text-white border-0' },
    paused: { label: timeLeft ? `IA Pausada (${timeLeft})` : 'IA Pausada', variant: 'secondary' as const, className: 'bg-yellow-600 hover:bg-yellow-700 text-white border-0' },
    disabled: { label: 'IA Off', variant: 'outline' as const, className: 'text-muted-foreground' },
  };

  const cfg = statusConfig[effectiveStatus];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-0" disabled={isPending}>
          <Badge variant={cfg.variant} className={`text-[10px] cursor-pointer ${cfg.className}`}>
            {effectiveStatus === 'paused' ? <Clock className="w-3 h-3 mr-1" /> : <Bot className="w-3 h-3 mr-1" />}
            {cfg.label}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* Trigger AI now - always available when active or globally enabled */}
        {effectiveStatus === 'active' && (
          <>
            <DropdownMenuItem onClick={activate}>
              <Send className="w-4 h-4 mr-2" />
              Disparar IA agora
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Pausar IA</DropdownMenuLabel>
            {pauseOptions.map((opt) => (
              <DropdownMenuItem key={opt.minutes} onClick={() => pause(opt.minutes)}>
                <Pause className="w-4 h-4 mr-2" />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {effectiveStatus !== 'active' && (
          <>
            <DropdownMenuItem onClick={activate}>
              <Send className="w-4 h-4 mr-2" />
              Ativar e enviar mensagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={activateSilent}>
              <Play className="w-4 h-4 mr-2" />
              Ativar sem enviar
            </DropdownMenuItem>
          </>
        )}

        {effectiveStatus === 'paused' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Alterar pausa</DropdownMenuLabel>
            {pauseOptions.map((opt) => (
              <DropdownMenuItem key={opt.minutes} onClick={() => pause(opt.minutes)}>
                <Pause className="w-4 h-4 mr-2" />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        {effectiveStatus !== 'disabled' && (
          <DropdownMenuItem onClick={disable} className="text-destructive focus:text-destructive">
            <XCircle className="w-4 h-4 mr-2" />
            Desativar nesta conversa
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
