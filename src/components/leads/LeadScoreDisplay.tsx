import { cn } from "@/lib/utils";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import type { LeadTemperature, ScoreBreakdown } from "@/lib/lead-scoring";

interface LeadScoreDisplayProps {
  score: number;
  maxScore?: number;
  temperature: LeadTemperature;
  breakdown?: ScoreBreakdown;
  showBreakdown?: boolean;
  className?: string;
}

const temperatureConfig = {
  hot: {
    icon: Flame,
    label: "Quente",
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
    borderClass: "border-destructive/30",
  },
  warm: {
    icon: Thermometer,
    label: "Morno",
    bgClass: "bg-warning/10",
    textClass: "text-warning",
    borderClass: "border-warning/30",
  },
  cold: {
    icon: Snowflake,
    label: "Frio",
    bgClass: "bg-primary/10",
    textClass: "text-primary",
    borderClass: "border-primary/30",
  },
};

const breakdownLabels: Record<keyof ScoreBreakdown, string> = {
  age: "Idade",
  maritalStatus: "Estado civil",
  vehicle: "Veículo",
  cnh: "CNH",
  employment: "Emprego",
  sales: "Exp. Vendas",
  vehicleProtection: "Proteção Veicular",
  currentIncome: "Renda atual",
  desiredIncome: "Renda desejada",
};

export function LeadScoreDisplay({
  score,
  maxScore = 185,
  temperature,
  breakdown,
  showBreakdown = false,
  className,
}: LeadScoreDisplayProps) {
  const percentage = Math.round((score / maxScore) * 100);
  const config = temperatureConfig[temperature];
  const Icon = config.icon;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Score e Temperature */}
      <div className="flex items-center gap-3">
        {/* Score Badge */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg",
              config.bgClass,
              config.textClass
            )}
          >
            {score}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{percentage}%</span>
            <span className="text-xs ml-1">/{maxScore}</span>
          </div>
        </div>

        {/* Temperature Badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
            config.bgClass,
            config.textClass,
            config.borderClass
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              temperature === "hot" && "bg-destructive",
              temperature === "warm" && "bg-warning",
              temperature === "cold" && "bg-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      {showBreakdown && breakdown && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground">Detalhamento:</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {Object.entries(breakdown).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">
                  {breakdownLabels[key as keyof ScoreBreakdown]}:
                </span>
                <span className="font-medium text-foreground">{value} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for tables/lists
export function LeadScoreCompact({
  score,
  temperature,
  className,
}: {
  score: number;
  temperature: LeadTemperature;
  className?: string;
}) {
  const config = temperatureConfig[temperature];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="font-semibold text-foreground">{score}</span>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
          config.bgClass,
          config.textClass
        )}
      >
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </div>
    </div>
  );
}
