import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, getQuizUrl } from '@/lib/consultant-context';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, UserPlus, TrendingUp } from 'lucide-react';
import { getUserLevel } from '@/lib/ranking-service';
import { toast } from 'sonner';
import { useState } from 'react';
import { CreateConsultantDialog } from './CreateConsultantDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ConsultantsTable() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  const { data: consultants, isLoading } = useQuery({
    queryKey: ['all-consultants', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, quiz_slug, role, is_active, created_at')
        .eq('organization_id', currentUser.organization_id)
        .in('role', ['admin', 'consultor'])
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
  });

  // Buscar métricas de leads por consultor
  const { data: consultantMetrics } = useQuery({
    queryKey: ['consultant-metrics-all', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return {};

      const { data, error } = await supabase
        .from('quiz_submissions_new')
        .select('consultant_id, stage, temperature')
        .eq('organization_id', currentUser.organization_id)
        .eq('completion_percentage', 100);

      if (error) throw error;

      // Agregar métricas por consultant_id
      const metrics: Record<string, { total: number; converted: number; hot: number }> = {};
      data?.forEach((lead) => {
        if (lead.consultant_id) {
          if (!metrics[lead.consultant_id]) {
            metrics[lead.consultant_id] = { total: 0, converted: 0, hot: 0 };
          }
          metrics[lead.consultant_id].total++;
          if (lead.stage === 'convertido') {
            metrics[lead.consultant_id].converted++;
          }
          if (lead.temperature === 'hot') {
            metrics[lead.consultant_id].hot++;
          }
        }
      });
      return metrics;
    },
    enabled: !!currentUser,
  });

  const copyQuizLink = (slug: string) => {
    const link = getQuizUrl(slug);
    navigator.clipboard.writeText(link);
    toast.success('Link do quiz copiado!');
  };

  const openQuizLink = (slug: string) => {
    window.open(getQuizUrl(slug), '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Carregando consultores...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">
            👥 Todos os Consultores ({consultants?.length || 0})
          </CardTitle>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-y border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Consultor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Nível
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Leads
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Convertidos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Taxa Conv.
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Quentes 🔥
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Quiz Slug
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {consultants?.map((consultant) => {
                  const metrics = consultantMetrics?.[consultant.id] || { total: 0, converted: 0, hot: 0 };
                  const conversionRate = metrics.total > 0 
                    ? ((metrics.converted / metrics.total) * 100).toFixed(1) 
                    : '0.0';
                  const points = metrics.total * 10; // Simplified scoring
                  const level = getUserLevel(points);

                  return (
                    <tr key={consultant.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {consultant.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {consultant.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${level.color}`}>
                          {level.badge} {level.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-foreground">
                          {metrics.total}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-green-600">
                          {metrics.converted}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{conversionRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-orange-500">
                          {metrics.hot}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {consultant.quiz_slug ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                            /quiz/{consultant.quiz_slug}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {consultant.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {consultant.quiz_slug && (
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyQuizLink(consultant.quiz_slug!)}
                              title="Copiar link do quiz"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openQuizLink(consultant.quiz_slug!)}
                              title="Abrir quiz"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {consultants?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum consultor cadastrado ainda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CreateConsultantDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
      />
    </>
  );
}
