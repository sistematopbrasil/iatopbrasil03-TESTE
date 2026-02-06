import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Pause, Play, XCircle } from 'lucide-react';
import { useAIConversationState } from '@/hooks/useAIConversationState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface AIStatusBadgeProps {
  conversationId: string | null;
  aiEnabled: boolean;
}

export function AIStatusBadge({ conversationId, aiEnabled }: AIStatusBadgeProps) {
  const { status, pause, resume, disable, isPending } = useAIConversationState(conversationId);

  if (!aiEnabled || status === 'none') return null;

  const statusConfig = {
    active: { label: 'IA Ativa', variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700 text-white border-0' },
    paused: { label: 'IA Pausada', variant: 'secondary' as const, className: 'bg-yellow-600 hover:bg-yellow-700 text-white border-0' },
    disabled: { label: 'IA Off', variant: 'outline' as const, className: 'text-muted-foreground' },
  };

  const cfg = statusConfig[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-0" disabled={isPending}>
          <Badge variant={cfg.variant} className={`text-[10px] cursor-pointer ${cfg.className}`}>
            <Bot className="w-3 h-3 mr-1" />
            {cfg.label}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {status !== 'active' && (
          <DropdownMenuItem onClick={resume}>
            <Play className="w-4 h-4 mr-2" />
            Reativar IA
          </DropdownMenuItem>
        )}
        {status === 'active' && (
          <>
            <DropdownMenuItem onClick={() => pause(30)}>
              <Pause className="w-4 h-4 mr-2" />
              Pausar 30 min
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pause(120)}>
              <Pause className="w-4 h-4 mr-2" />
              Pausar 2 horas
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {status !== 'disabled' && (
          <DropdownMenuItem onClick={disable} className="text-destructive focus:text-destructive">
            <XCircle className="w-4 h-4 mr-2" />
            Desativar nesta conversa
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
