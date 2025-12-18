import { getUserLevel, getProgressToNextLevel, getNextLevel } from '@/lib/ranking-service';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LevelBadgeProps {
  points: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelBadge({ points, showProgress = false, size = 'md' }: LevelBadgeProps) {
  const level = getUserLevel(points);
  const nextLevel = getNextLevel(points);
  const progress = getProgressToNextLevel(points);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const badgeSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className="space-y-2">
      <div className={cn('flex items-center gap-2', sizeClasses[size])}>
        <span className={badgeSizes[size]}>{level.badge}</span>
        <span className={cn('font-semibold', level.color)}>{level.level}</span>
      </div>
      
      {showProgress && nextLevel && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {nextLevel.minPoints - points} pts para {nextLevel.badge} {nextLevel.level}
          </p>
        </div>
      )}
    </div>
  );
}
