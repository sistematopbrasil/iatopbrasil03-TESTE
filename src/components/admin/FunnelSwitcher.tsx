import { useFunnel, ActiveFunnel } from '@/contexts/FunnelContext';
import { cn } from '@/lib/utils';
import { FUNNEL_LABELS } from '@/lib/funnel-types';
import { Layers } from 'lucide-react';

interface FunnelSwitcherProps {
  variant?: 'sidebar' | 'compact';
  className?: string;
}

/**
 * Pill segmentado para alternar entre funis.
 * Esconde se o usuário tem acesso a apenas 1 funil (e não é super admin).
 */
export function FunnelSwitcher({ variant = 'sidebar', className }: FunnelSwitcherProps) {
  const { activeFunnel, availableFunnels, canSeeAll, setActiveFunnel } = useFunnel();

  // Esconder se só tem 1 funil disponível e não é super admin
  if (availableFunnels.length <= 1 && !canSeeAll) return null;

  const options: Array<{ value: ActiveFunnel; label: string }> = [
    ...availableFunnels.map((f) => ({ value: f as ActiveFunnel, label: FUNNEL_LABELS[f] })),
  ];

  // Super admin recebe opção "Todos" se tem acesso a mais de 1
  if (canSeeAll && availableFunnels.length > 1) {
    options.push({ value: 'all', label: 'Todos' });
  }

  if (options.length <= 1) return null;

  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1 rounded-full bg-muted/60 p-0.5', className)}>
        {options.map((opt) => {
          const isActive = activeFunnel === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActiveFunnel(opt.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <Layers className="w-3 h-3" />
        Funil ativo
      </div>
      <div className="inline-flex w-full items-stretch rounded-lg bg-muted/60 p-0.5 border border-border/40">
        {options.map((opt) => {
          const isActive = activeFunnel === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActiveFunnel(opt.value)}
              className={cn(
                'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
