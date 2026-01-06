import { cn } from "@/lib/utils";
import { Flame, Thermometer, Snowflake } from "lucide-react";

type Temperature = "hot" | "warm" | "cold";

interface TemperatureBadgeProps {
  temperature: Temperature;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const temperatureConfig: Record<
  Temperature,
  {
    label: string;
    icon: typeof Flame;
    bgClass: string;
    textClass: string;
    borderClass: string;
    glowClass: string;
  }
> = {
  hot: {
    label: "Quente",
    icon: Flame,
    bgClass: "bg-temperature-hot/10",
    textClass: "text-temperature-hot",
    borderClass: "border-temperature-hot/30",
    glowClass: "shadow-[0_0_10px_hsl(var(--temp-hot)/0.3)]",
  },
  warm: {
    label: "Morno",
    icon: Thermometer,
    bgClass: "bg-temperature-warm/10",
    textClass: "text-temperature-warm",
    borderClass: "border-temperature-warm/30",
    glowClass: "shadow-[0_0_10px_hsl(var(--temp-warm)/0.3)]",
  },
  cold: {
    label: "Frio",
    icon: Snowflake,
    bgClass: "bg-temperature-cold/10",
    textClass: "text-temperature-cold",
    borderClass: "border-temperature-cold/30",
    glowClass: "shadow-[0_0_10px_hsl(var(--temp-cold)/0.3)]",
  },
};

const sizeStyles = {
  sm: {
    badge: "px-2 py-0.5 text-xs gap-1",
    icon: "h-3 w-3",
  },
  md: {
    badge: "px-2.5 py-1 text-sm gap-1.5",
    icon: "h-4 w-4",
  },
  lg: {
    badge: "px-3 py-1.5 text-base gap-2",
    icon: "h-5 w-5",
  },
};

export function TemperatureBadge({
  temperature,
  showIcon = true,
  showLabel = true,
  size = "md",
  className,
}: TemperatureBadgeProps) {
  const config = temperatureConfig[temperature];
  const sizeStyle = sizeStyles[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium border transition-all duration-200",
        config.bgClass,
        config.textClass,
        config.borderClass,
        "hover:scale-105",
        sizeStyle.badge,
        className
      )}
    >
      {showIcon && <Icon className={cn(sizeStyle.icon, "flex-shrink-0")} />}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

// Compact version showing just the icon with tooltip
export function TemperatureIndicator({
  temperature,
  className,
}: {
  temperature: Temperature;
  className?: string;
}) {
  const config = temperatureConfig[temperature];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
        config.bgClass,
        config.borderClass,
        "border",
        "hover:scale-110",
        config.glowClass,
        className
      )}
      title={config.label}
    >
      <Icon className={cn("h-4 w-4", config.textClass)} />
    </div>
  );
}
