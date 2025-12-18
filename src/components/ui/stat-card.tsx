import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "info";
  className?: string;
}

const variantStyles = {
  default: {
    card: "border-border bg-card",
    icon: "bg-muted text-muted-foreground",
    trend: "text-muted-foreground",
  },
  primary: {
    card: "border-primary/20 bg-primary/5",
    icon: "bg-primary/10 text-primary",
    trend: "text-primary",
  },
  success: {
    card: "border-success/20 bg-success/5",
    icon: "bg-success/10 text-success",
    trend: "text-success",
  },
  warning: {
    card: "border-warning/20 bg-warning/5",
    icon: "bg-warning/10 text-warning",
    trend: "text-warning",
  },
  info: {
    card: "border-info/20 bg-info/5",
    icon: "bg-info/10 text-info",
    trend: "text-info",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-6 transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30",
        styles.card,
        className
      )}
    >
      {/* Background Glow Effect */}
      <div className="absolute inset-0 bg-gradient-radial opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 text-sm">
              <span
                className={cn(
                  "font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}
              >
                {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
              </span>
              <span className="text-muted-foreground">vs. período anterior</span>
            </div>
          )}
        </div>
        
        {Icon && (
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
              styles.icon
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}
