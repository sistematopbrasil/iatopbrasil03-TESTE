import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, TrendingUp, Users, Calendar, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { calculateLeadPoints, NOVOS_CONSULTORES_BONUS } from '@/lib/ranking-service';

interface RankingEntry {
  consultant_id: string;
  full_name: string;
  quiz_slug: string;
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  conversion_rate: number;
  last_lead_date: string | null;
  ranking_position: number;
  profile_photo?: string | null;
  consultants_recruited?: number;
  total_points?: number;
}

export default function AdminRanking() {
  const [period, setPeriod] = useState('all');

  // Get current user to check if super admin
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-ranking'],
    queryFn: getCurrentConsultant,
  });

  const isAdmin = currentUser && isSuperAdmin(currentUser.role);

  // Get period dates
  const getPeriodDates = () => {
    const now = new Date();
    let periodStart: string | null = null;

    if (period === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      periodStart = start.toISOString();
    } else if (period === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      periodStart = start.toISOString();
    } else if (period === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      periodStart = start.toISOString();
    }

    return { periodStart, periodEnd: now.toISOString() };
  };

  const { data: ranking, isLoading } = useQuery({
    queryKey: ['consultant-ranking-dynamic', period],
    queryFn: async () => {
      const { periodStart, periodEnd } = getPeriodDates();
      
      // Get ranking data from leads
      const { data: rankingData, error } = await supabase.rpc('get_consultant_ranking_dynamic', {
        period_start: periodStart,
        period_end: periodEnd,
      });

      if (error) {
        console.error('Error fetching ranking:', error);
        throw error;
      }

      // Fetch profile photos for all consultants
      const consultantIds = (rankingData || []).map((r: any) => r.consultant_id);
      
      if (consultantIds.length === 0) {
        return [] as RankingEntry[];
      }

      // Fetch photos and organization_id
      const { data: usersData } = await supabase
        .from('users')
        .select('id, profile_photo, organization_id')
        .in('id', consultantIds);

      const photoMap = new Map(usersData?.map(u => [u.id, u.profile_photo]) || []);
      const orgId = usersData?.[0]?.organization_id;

      // Get Novos Consultores stage ID
      let novosConsultoresStageId: string | null = null;
      if (orgId) {
        const { data: stageId } = await supabase.rpc('get_novos_consultores_stage_id', {
          org_id: orgId
        });
        novosConsultoresStageId = stageId;
      }

      // Count actual leads in Novos Consultores stage per consultant (source of truth)
      const recruitsMap = new Map<string, number>();
      if (novosConsultoresStageId) {
        const { data: recruits } = await supabase
          .from('quiz_submissions_new')
          .select('consultant_id')
          .eq('pipeline_stage_id', novosConsultoresStageId)
          .in('consultant_id', consultantIds);

        recruits?.forEach(r => {
          if (r.consultant_id) {
            recruitsMap.set(r.consultant_id, (recruitsMap.get(r.consultant_id) || 0) + 1);
          }
        });
      }

      // Calculate final points using actual pipeline data
      const enrichedRanking = (rankingData || []).map((r: any) => {
        const recruited = recruitsMap.get(r.consultant_id) || 0;
        
        // Leads in "Novos Consultores" should NOT count toward temperature points
        // Subtract recruited from hot leads to avoid double counting
        const adjustedHot = Math.max(0, Number(r.hot_leads || 0) - recruited);
        
        // Lead temperature points (excluding those in Novos Consultores)
        const leadPoints = calculateLeadPoints(
          adjustedHot,
          Number(r.warm_leads || 0),
          Number(r.cold_leads || 0)
        );
        
        // Recruited consultants bonus (100 pts each)
        const novosConsultoresPoints = recruited * NOVOS_CONSULTORES_BONUS;
        const totalPoints = leadPoints + novosConsultoresPoints;

        return {
          ...r,
          profile_photo: photoMap.get(r.consultant_id) || null,
          consultants_recruited: recruited,
          total_points: totalPoints,
        };
      }) as RankingEntry[];

      // Sort by total_points descending and update ranking_position
      enrichedRanking.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
      enrichedRanking.forEach((entry, index) => {
        entry.ranking_position = index + 1;
      });

      return enrichedRanking;
    },
  });

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

  // Calculate totals
  const totals = ranking?.reduce(
    (acc, c) => ({
      leads: acc.leads + Number(c.total_leads || 0),
      hot: acc.hot + Number(c.hot_leads || 0),
      warm: acc.warm + Number(c.warm_leads || 0),
      cold: acc.cold + Number(c.cold_leads || 0),
      points: acc.points + (c.total_points || 0),
    }),
    { leads: 0, hot: 0, warm: 0, cold: 0, points: 0 }
  ) || { leads: 0, hot: 0, warm: 0, cold: 0, points: 0 };

  // Get current consultant's points
  const myPoints = ranking?.find(r => r.consultant_id === currentUser?.id)?.total_points || 0;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <h1 className="text-3xl font-bold text-foreground">Ranking de Consultores</h1>
              <p className="text-muted-foreground">
                {isAdmin ? 'Desempenho detalhado dos consultores' : 'Classificação por pontuação'}
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
              <Star className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {isAdmin ? 'Pontuação Total' : 'Sua Pontuação'}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {isAdmin ? totals.points.toLocaleString() : myPoints.toLocaleString()} pts
                </p>
              </div>
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
        <Card className="p-4 md:p-6 overflow-hidden">
          <h2 className="text-xl font-semibold text-foreground mb-4">Classificação</h2>
          
          {ranking && ranking.length > 0 ? (
            <>
              {/* Mobile: Cards */}
              <div className="md:hidden space-y-3">
                {ranking.map((consultant) => (
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
                        {(consultant.consultants_recruited || 0) > 0 && (
                          <span className="text-muted-foreground text-xs">
                            (+{consultant.consultants_recruited} consultores)
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
                      <th className="text-center py-4 px-4 text-muted-foreground font-medium">Último Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((consultant) => (
                      <tr 
                        key={consultant.consultant_id}
                        className={cn(
                          "border-b border-border hover:bg-muted/50 transition-colors",
                          consultant.consultant_id === currentUser?.id && "bg-primary/5"
                        )}
                      >
                        {/* Position */}
                        <td className="py-4 px-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white",
                            getMedalColor(consultant.ranking_position)
                          )}>
                            {getMedalIcon(consultant.ranking_position)}
                          </div>
                        </td>

                        {/* Name with Photo */}
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
                            {/* Points - Added for super admin */}
                            <td className="text-center py-4 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-5 h-5 text-primary" />
                                <span className="text-xl font-bold text-foreground">
                                  {(consultant.total_points || 0).toLocaleString()}
                                </span>
                              </div>
                            </td>

                            {/* Total Leads */}
                            <td className="text-center py-4 px-4">
                              <span className="text-xl font-bold text-foreground">{consultant.total_leads}</span>
                            </td>

                            {/* Hot Leads */}
                            <td className="text-center py-4 px-4">
                              <span className="text-lg font-semibold text-red-500">{consultant.hot_leads}</span>
                            </td>

                            {/* Warm Leads */}
                            <td className="text-center py-4 px-4">
                              <span className="text-lg font-semibold text-yellow-500">{consultant.warm_leads}</span>
                            </td>

                            {/* Cold Leads */}
                            <td className="text-center py-4 px-4">
                              <span className="text-lg font-semibold text-blue-500">{consultant.cold_leads}</span>
                            </td>

                            {/* Consultores Recrutados */}
                            <td className="text-center py-4 px-4">
                              <span className="text-lg font-semibold text-purple-500">
                                {consultant.consultants_recruited || 0}
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
                              <span className="text-sm text-muted-foreground">pts</span>
                            </div>
                          </td>
                        )}

                        {/* Last Lead */}
                        <td className="text-center py-4 px-4 text-sm text-muted-foreground">
                          {consultant.last_lead_date 
                            ? format(new Date(consultant.last_lead_date), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado de ranking disponível ainda.</p>
              <p className="text-sm">Os consultores aparecerão aqui quando tiverem leads.</p>
            </div>
          )}
        </Card>

        {/* Points Legend - Only for consultants (minimal version) - Ascending order */}
        {!isAdmin && (
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 py-3 px-4 bg-muted/30 rounded-lg text-sm w-full overflow-hidden">
            <span className="text-muted-foreground text-center">Pontuação:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-foreground font-medium text-xs sm:text-sm">❄️ 5pts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 flex-shrink-0" />
              <span className="text-foreground font-medium text-xs sm:text-sm">🌡️ 15pts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-foreground font-medium text-xs sm:text-sm">🔥 30pts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" />
              <span className="text-foreground font-medium text-xs sm:text-sm">👥 100pts</span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
