import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FUNNEL_LABELS, FunnelType, isFunnelType } from '@/lib/funnel-types';

interface FunnelBadgeProps {
  funnel: FunnelType | string | null | undefined;
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * Badge visual indicando de qual funil o lead pertence.
 * Consultores: laranja Top Brasil. Associados: azul.
 */
export function FunnelBadge({ funnel, size = 'sm', className }: FunnelBadgeProps) {
  const f: FunnelType = isFunnelType(funnel) ? funnel : 'consultor';

  const sizeClass = size === 'xs' ? 'text-[9px] px-1.5 py-0' : 'text-[10px] px-2 py-0.5';

  const colorClass =
    f === 'consultor'
      ? 'border-[#EB6608]/40 bg-[#EB6608]/10 text-[#EB6608]'
      : 'border-blue-500/40 bg-blue-500/10 text-blue-500';

  return (
    <Badge variant="outline" className={cn('font-medium border', colorClass, sizeClass, className)}>
      {FUNNEL_LABELS[f]}
    </Badge>
  );
}
