import { LevelBadge } from './LevelBadge';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RankingUser {
  id: string;
  total_points: number | null;
  consultant: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface RankingTableProps {
  ranking: RankingUser[];
  currentUserId?: string;
}

export function RankingTable({ ranking, currentUserId }: RankingTableProps) {
  const getMedalEmoji = (position: number) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
    return null;
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Top Consultores
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Posição
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Consultor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Nível
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                Pontos
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranking.map((entry, index) => {
              const isCurrentUser = entry.consultant?.id === currentUserId;
              const medal = getMedalEmoji(index);
              const points = entry.total_points || 0;

              return (
                <tr
                  key={entry.id}
                  className={cn(
                    'transition-colors hover:bg-muted/50',
                    isCurrentUser && 'bg-primary/5'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {medal && <span className="text-2xl">{medal}</span>}
                      <span className={cn(
                        'font-semibold',
                        index < 3 ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        #{index + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'font-medium',
                      isCurrentUser ? 'text-primary' : 'text-foreground'
                    )}>
                      {entry.consultant?.full_name || 'Usuário'}
                      {isCurrentUser && ' (Você)'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <LevelBadge points={points} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-foreground">
                      {points.toLocaleString('pt-BR')} pts
                    </span>
                  </td>
                </tr>
              );
            })}

            {ranking.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum dado de ranking disponível
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
