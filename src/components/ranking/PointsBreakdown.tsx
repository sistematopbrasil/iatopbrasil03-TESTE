import { 
  Users, 
  Phone, 
  Star, 
  UserPlus 
} from 'lucide-react';

interface PointsBreakdownProps {
  metrics: {
    leads_captured: number;
    leads_contacted: number;
    leads_qualified: number;
    leads_converted: number;
    consultants_recruited: number;
    events_hosted: number;
  } | null;
}

export function PointsBreakdown({ metrics }: PointsBreakdownProps) {
  // Ordenar em ordem crescente de pontos por unidade (5, 15, 30, 100)
  const items = [
    {
      icon: Users,
      label: 'Leads Frios',
      count: 0,
      pointsPer: 5,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Phone,
      label: 'Leads Mornos',
      count: 0,
      pointsPer: 15,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: Star,
      label: 'Leads Quentes',
      count: 0,
      pointsPer: 30,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: UserPlus,
      label: 'Consultores Recrutados',
      count: metrics?.consultants_recruited || 0,
      pointsPer: 100,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Detalhamento de Pontos
      </h3>

      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          const totalPoints = item.count * item.pointsPer;

          return (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <Icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.count} × {item.pointsPer} pts
                  </p>
                </div>
              </div>
              <span className="font-bold text-foreground">
                {totalPoints.toLocaleString('pt-BR')} pts
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
