import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface LeadScoreBadgeProps {
  score: number;
  showTrend?: boolean;
  previousScore?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getScoreConfig(score: number) {
  if (score >= 80) {
    return {
      label: "Excelente",
      bgClass: "bg-success/10",
      textClass: "text-success",
      borderClass: "border-success/30",
      ringClass: "ring-success/30",
    };
  } else if (score >= 60) {
    return {
      label: "Bom",
      bgClass: "bg-primary/10",
      textClass: "text-primary",
      borderClass: "border-primary/30",
      ringClass: "ring-primary/30",
    };
  } else if (score >= 40) {
    return {
      label: "Regular",
      bgClass: "bg-warning/10",
      textClass: "text-warning",
      borderClass: "border-warning/30",
      ringClass: "ring-warning/30",
    };
  } else {
    return {
      label: "Baixo",
      bgClass: "bg-muted",
      textClass: "text-muted-foreground",
      borderClass: "border-border",
      ringClass: "ring-border",
    };
  }
}

const sizeStyles = {
  sm: {
    container: "h-8 w-8 text-xs",
    ring: "ring-2",
  },
  md: {
    container: "h-10 w-10 text-sm",
    ring: "ring-2",
  },
  lg: {
    container: "h-14 w-14 text-lg",
    ring: "ring-[3px]",
  },
};

export function LeadScoreBadge({
  score,
  showTrend = false,
  previousScore,
  size = "md",
  className,
}: LeadScoreBadgeProps) {
  const config = getScoreConfig(score);
  const sizeStyle = sizeStyles[size];

  const trend =
    showTrend && previousScore !== undefined
      ? score > previousScore
        ? "up"
        : score < previousScore
        ? "down"
        : "neutral"
      : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full font-bold",
          "transition-all duration-300 hover:scale-105",
          config.bgClass,
          config.textClass,
          sizeStyle.container,
          sizeStyle.ring,
          config.ringClass
        )}
        title={`Score: ${score} - ${config.label}`}
      >
        {score}
      </div>

      {trend && (
        <div
          className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            trend === "up" && "text-success",
            trend === "down" && "text-destructive",
            trend === "neutral" && "text-muted-foreground"
          )}
        >
          {trend === "up" && <TrendingUp className="h-3 w-3" />}
          {trend === "down" && <TrendingDown className="h-3 w-3" />}
          {trend === "neutral" && <Minus className="h-3 w-3" />}
          {previousScore !== undefined && (
            <span>
              {trend === "up" ? "+" : trend === "down" ? "-" : ""}
              {Math.abs(score - previousScore)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Progress bar version
export function LeadScoreBar({
  score,
  showLabel = true,
  className,
}: {
  score: number;
  showLabel?: boolean;
  className?: string;
}) {
  const config = getScoreConfig(score);

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-muted-foreground">Lead Score</span>
          <span className={cn("text-sm font-semibold", config.textClass)}>
            {score}/100
          </span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            score >= 80 && "bg-success",
            score >= 60 && score < 80 && "bg-primary",
            score >= 40 && score < 60 && "bg-warning",
            score < 40 && "bg-muted-foreground"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
