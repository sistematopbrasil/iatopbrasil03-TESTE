import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, TrendingUp, Users, Calendar, Star, UserPlus } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/page-skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isSuperAdmin } from '@/lib/consultant-context';
import { useRankingData, type ConsultantRankingData } from '@/hooks/useRankingData';
import { useFunnel } from '@/contexts/FunnelContext';

export default function AdminRanking() {
  const [period, setPeriod] = useState('all');

  // Memoizar periodStart e periodEnd para evitar re-renders que invalidam o queryKey
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    let start: string | null = null;
    let end: string | null = null;

    if (period === 'today') {
      const s = new Date(now);
      s.setHours(0, 0, 0, 0);
      start = s.toISOString();
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      end = e.toISOString();
    } else if (period === 'week') {
      const s = new Date(now);
      s.setDate(s.getDate() - 7);
      start = s.toISOString();
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      end = e.toISOString();
    } else if (period === 'month') {
      const s = new Date(now);
      s.setMonth(s.getMonth() - 1);
      start = s.toISOString();
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      end = e.toISOString();
    }
    // period === 'all' → both null → queryKey matches prefetch
    return { periodStart: start, periodEnd: end };
  }, [period]);

  // Usar hook centralizado com queryKey estável (dados pré-carregados em usePrefetchAdminData)
  const { ranking, grouped, isLoading, error, currentUser, currentUserRole, totals, myData, refetch } = useRankingData({
    periodStart,
    periodEnd,
  });
  const { activeFunnel } = useFunnel();

  const queryClient = useQueryClient();

  // Dados já são pré-carregados pelo usePrefetchAdminData com a mesma queryKey

  // ✅ Se já tem dados no cache, não mostrar loading
  const showLoading = isLoading && !ranking;

  // Usar currentUserRole diretamente (funciona para super admin que não está no array)
  const isAdmin = currentUserRole ? isSuperAdmin(currentUserRole) : false;

  const getMedalIcon = (position: number) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return position;
  };

  const getMedalColor = (position: number) => {
    if (position === 1) return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    if (position === 2) return 'bg-gradient-to-r from-gray-400 to-gray-500';
    if (position === 3) return 'bg-gradient-to-r from-orange-600 to-orange-700';
    return 'bg-muted';
  };

  // ✅ Só mostrar loading se realmente não tem dados (evita flash)
  if (showLoading) {
    return (
      <AdminLayout>
        <TableSkeleton rows={8} />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-muted-foreground">Erro ao carregar ranking</p>
          <button 
            onClick={() => refetch()} 
            className="text-primary underline hover:text-primary/80"
          >
            Tentar novamente
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden w-full max-w-full box-border">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {activeFunnel === 'associado'
                  ? 'Ranking de Associados'
                  : activeFunnel === 'all'
                  ? 'Ranking Geral'
                  : 'Ranking de Consultores'}
              </h1>
              <p className="text-muted-foreground">
                {isAdmin
                  ? (activeFunnel === 'associado' ? 'Desempenho no funil de Associados' : 'Desempenho detalhado dos consultores')
                  : 'Classificação por pontuação'}
              </p>
            </div>
          </div>

          {/* Period Filter */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Consultores</p>
                <p className="text-2xl font-bold text-foreground">{ranking?.length || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              {isAdmin ? (
                <>
                  <UserPlus className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Novos Consultores</p>
                    <p className="text-2xl font-bold text-foreground">
                      {totals.novosConsultores}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Star className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Sua Pontuação</p>
                    <p className="text-2xl font-bold text-foreground">
                      {(myData?.total_points || 0).toLocaleString()} pts
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {isAdmin ? 'Total de Leads' : 'Média por Consultor'}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {isAdmin 
                    ? totals.leads 
                    : Math.round(totals.points / (ranking?.length || 1)).toLocaleString() + ' pts'
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Ranking - Mobile Cards / Desktop Table */}
        {(() => {
          const renderTable = (items: ConsultantRankingData[] | undefined) => (
            items && items.length > 0 ? (
              <>
                {/* Mobile: Cards */}
                <div className="md:hidden space-y-3">
                  {items.map((consultant) => (
                    <div
                      key={consultant.consultant_id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border border-border bg-card",
                        consultant.consultant_id === currentUser?.id && "ring-2 ring-primary"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0",
                        getMedalColor(consultant.ranking_position)
                      )}>
                        {getMedalIcon(consultant.ranking_position)}
                      </div>
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={consultant.profile_photo || undefined} alt={consultant.full_name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {consultant.full_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {consultant.full_name}
                          {consultant.consultant_id === currentUser?.id && ' (Você)'}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-primary font-bold">
                            {(consultant.total_points || 0).toLocaleString()} pts
                          </span>
                          {(consultant.novos_consultores_count || 0) > 0 && (
                            <span className="text-muted-foreground text-xs">
                              (+{consultant.novos_consultores_count} consultores)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-4 px-4 text-muted-foreground font-medium">Posição</th>
                        <th className="text-left py-4 px-4 text-muted-foreground font-medium">Consultor</th>
                        {isAdmin ? (
                          <>
                            <th className="text-center py-4 px-4 text-muted-foreground font-medium">Pontuação</th>
                            <th className="text-center py-4 px-4 text-muted-foreground font-medium">Total Leads</th>
                            <th className="text-center py-4 px-4 text-muted-foreground font-medium">Quentes</th>
                            <th className="text-center py-4 px-4 text-muted-foreground font-medium">Mornos</th>
                            <th className="text-center py-4 px-4 text-muted-foreground font-medium">Frios</th>
                            <th className="text-center py-4 px-4 text-muted-foreground font-medium">Novos Cons.</th>
                          </>
                        ) : (
                          <th className="text-center py-4 px-4 text-muted-foreground font-medium">Pontuação</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((consultant) => (
                        <tr
                          key={consultant.consultant_id}
                          className={cn(
                            "border-b border-border hover:bg-muted/50 transition-colors",
                            consultant.consultant_id === currentUser?.id && "bg-primary/5"
                          )}
                        >
                          <td className="py-4 px-4">
                            <div className={cn(
                              "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white",
                              getMedalColor(consultant.ranking_position)
                            )}>
                              {getMedalIcon(consultant.ranking_position)}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={consultant.profile_photo || undefined} alt={consultant.full_name} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                  {consultant.full_name?.[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {consultant.full_name}
                                  {consultant.consultant_id === currentUser?.id && ' (Você)'}
                                </p>
                                <p className="text-sm text-muted-foreground">@{consultant.quiz_slug}</p>
                              </div>
                            </div>
                          </td>
                          {isAdmin ? (
                            <>
                              <td className="text-center py-4 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="w-5 h-5 text-primary" />
                                  <span className="text-xl font-bold text-foreground">
                                    {(consultant.total_points || 0).toLocaleString()}
                                  </span>
                                </div>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className="text-xl font-bold text-foreground">{consultant.total_leads}</span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className="text-lg font-semibold text-red-500">{consultant.hot_leads}</span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className="text-lg font-semibold text-yellow-500">{consultant.warm_leads}</span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className="text-lg font-semibold text-blue-500">{consultant.cold_leads}</span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className="text-lg font-semibold text-purple-500">
                                  {consultant.novos_consultores_count || 0}
                                </span>
                              </td>
                            </>
                          ) : (
                            <td className="text-center py-4 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-5 h-5 text-primary" />
                                <span className="text-xl font-bold text-foreground">
                                  {(consultant.total_points || 0).toLocaleString()}
                                </span>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">
                  Nenhum dado de ranking disponível
                </p>
              </div>
            )
          );

          // Modo "Todos" do super admin: mostra Tabs com Consultores / Associados se há grouped
          if (activeFunnel === 'all' && grouped) {
            return (
              <Card className="p-4 md:p-6 overflow-hidden">
                <h2 className="text-xl font-semibold text-foreground mb-4">Classificação</h2>
                <Tabs defaultValue="consultor" className="w-full">
                  <TabsList>
                    <TabsTrigger value="consultor">Consultores</TabsTrigger>
                    <TabsTrigger value="associado">Associados</TabsTrigger>
                  </TabsList>
                  <TabsContent value="consultor" className="mt-4">
                    {renderTable(grouped.consultor)}
                  </TabsContent>
                  <TabsContent value="associado" className="mt-4">
                    {renderTable(grouped.associado)}
                  </TabsContent>
                </Tabs>
              </Card>
            );
          }

          return (
            <Card className="p-4 md:p-6 overflow-hidden">
              <h2 className="text-xl font-semibold text-foreground mb-4">Classificação</h2>
              {renderTable(ranking)}
            </Card>
          );
        })()}

        {/* Points Legend - Only for consultants */}
        {!isAdmin && (
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">📊 Como os Pontos são Calculados</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-red-500/10 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-500">+30</p>
                <p className="text-sm text-muted-foreground">Lead Quente 🔥</p>
              </div>
              <div className="bg-yellow-500/10 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-500">+15</p>
                <p className="text-sm text-muted-foreground">Lead Morno 🌡️</p>
              </div>
              <div className="bg-blue-500/10 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-500">+5</p>
                <p className="text-sm text-muted-foreground">Lead Frio ❄️</p>
              </div>
              <div className="bg-purple-500/10 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-500">+100</p>
                <p className="text-sm text-muted-foreground">Novo Consultor 👥</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
