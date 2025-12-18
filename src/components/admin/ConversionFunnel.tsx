import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown } from "lucide-react";

interface FunnelStep {
  name: string;
  shortName: string;
  count: number;
  percentage: number;
  dropOff: number;
}

interface ConversionFunnelProps {
  submissions: any[] | undefined;
  isLoading: boolean;
}

// Mapeamento das perguntas do quiz
const QUIZ_QUESTIONS = [
  { id: 1, name: "Nome", field: "name" },
  { id: 2, name: "Telefone", field: "phone" },
  { id: 3, name: "Idade", field: "age" },
  { id: 4, name: "Cidade", field: "location" },
  { id: 5, name: "Estado Civil", field: "relationship_status" },
  { id: 6, name: "Possui Veículo", field: "has_vehicle" },
  { id: 7, name: "Possui CNH", field: "has_driver_license" },
  { id: 8, name: "Situação Profissional", field: "employment_status" },
  { id: 9, name: "Profissão Atual", field: "current_job" },
  { id: 10, name: "Experiência Vendas", field: "sales_experience" },
  { id: 11, name: "Exp. Proteção Veicular", field: "vehicle_protection_experience" },
  { id: 12, name: "Renda Atual", field: "current_income" },
  { id: 13, name: "Renda Desejada", field: "desired_income" },
  { id: 14, name: "Motivação", field: "motivation" },
];

export function ConversionFunnel({ submissions, isLoading }: ConversionFunnelProps) {
  const funnelData = useMemo(() => {
    if (!submissions || submissions.length === 0) return [];

    const total = submissions.length;
    const steps: FunnelStep[] = [];

    // Calcular quantos responderam cada pergunta
    QUIZ_QUESTIONS.forEach((question, index) => {
      const answeredCount = submissions.filter((sub: any) => {
        const value = sub[question.field];
        return value !== null && value !== undefined && value !== "";
      }).length;

      const percentage = (answeredCount / total) * 100;
      const prevCount = index === 0 ? total : steps[index - 1]?.count || total;
      const dropOff = index === 0 ? ((total - answeredCount) / total) * 100 : ((prevCount - answeredCount) / prevCount) * 100;

      steps.push({
        name: question.name,
        shortName: `Q${question.id}`,
        count: answeredCount,
        percentage,
        dropOff: isNaN(dropOff) ? 0 : dropOff,
      });
    });

    // Adicionar etapa final (completo)
    const completed = submissions.filter((s: any) => s.completion_percentage === 100).length;
    const lastStep = steps[steps.length - 1];
    steps.push({
      name: "Quiz Completo",
      shortName: "✓",
      count: completed,
      percentage: (completed / total) * 100,
      dropOff: lastStep ? ((lastStep.count - completed) / lastStep.count) * 100 : 0,
    });

    return steps;
  }, [submissions]);

  const worstDropOff = useMemo((): { step: FunnelStep; index: number } | null => {
    if (funnelData.length === 0) return null;
    let worstIndex = -1;
    let worstStep: FunnelStep | null = null;
    
    funnelData.forEach((step, index) => {
      if (index === 0) return;
      if (step.dropOff > (worstStep?.dropOff || 0)) {
        worstStep = step;
        worstIndex = index;
      }
    });
    
    return worstStep ? { step: worstStep, index: worstIndex } : null;
  }, [funnelData]);

  const getBarColor = (dropOff: number, index: number) => {
    if (index === funnelData.length - 1) return "bg-green-500"; // Final step
    if (dropOff > 15) return "bg-red-500";
    if (dropOff > 8) return "bg-yellow-500";
    return "bg-primary";
  };

  const getBarGradient = (percentage: number) => {
    return `linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) ${percentage}%, transparent ${percentage}%)`;
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            Funil de Conversão
          </CardTitle>
          <CardDescription>Sem dados disponíveis para análise</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              Funil de Conversão
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Onde os usuários abandonam o quiz
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{submissions.length}</p>
            <p className="text-xs text-muted-foreground">total de leads</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-4">
        {funnelData.map((step, index) => {
          const maxCount = funnelData[0]?.count || 1;
          const barWidth = (step.count / maxCount) * 100;
          const isWorst = worstDropOff?.index === index && step.dropOff > 5;
          
          return (
            <div
              key={step.shortName}
              className={`group relative transition-all duration-300 ${
                isWorst ? "scale-[1.02]" : ""
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                {/* Label */}
                <div className="w-28 sm:w-36 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {step.shortName}
                    </span>
                    <span className="text-xs text-foreground font-medium truncate">
                      {step.name}
                    </span>
                  </div>
                </div>

                {/* Bar Container */}
                <div className="flex-1 relative">
                  <div className="h-8 bg-muted/30 rounded-lg overflow-hidden relative">
                    {/* Bar */}
                    <div
                      className={`h-full rounded-lg transition-all duration-700 ease-out ${getBarColor(step.dropOff, index)}`}
                      style={{ 
                        width: `${barWidth}%`,
                        opacity: 0.85 + (step.percentage / 500)
                      }}
                    />
                    
                    {/* Count Label Inside */}
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs font-bold text-foreground drop-shadow-sm">
                        {step.count}
                      </span>
                      <span className="text-xs font-medium text-foreground/80">
                        {step.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Drop-off indicator */}
                  {index > 0 && step.dropOff > 0 && (
                    <div className={`absolute -top-1 right-0 transform translate-x-full ml-2 flex items-center gap-1 ${
                      isWorst ? "animate-pulse" : ""
                    }`}>
                      {isWorst && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      <span className={`text-[10px] font-bold ${
                        step.dropOff > 15 ? "text-red-500" : 
                        step.dropOff > 8 ? "text-yellow-500" : 
                        "text-muted-foreground"
                      }`}>
                        -{step.dropOff.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      </CardContent>
    </Card>
  );
}
