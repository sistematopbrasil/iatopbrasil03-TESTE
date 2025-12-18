import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassCard({
  children,
  className,
  hover = true,
  glow = false,
  padding = "md",
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        "bg-card/80 backdrop-blur-md",
        "border border-border/50",
        hover && [
          "transition-all duration-300",
          "hover:border-primary/30",
          "hover:shadow-lg",
          "hover:-translate-y-0.5",
        ],
        glow && "shadow-glow-sm",
        paddingStyles[padding],
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-subtle opacity-50 pointer-events-none" />
      
      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}

// Header variant for card sections
export function GlassCardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between pb-4 mb-4 border-b border-border/50",
        className
      )}
    >
      {children}
    </div>
  );
}

// Title for glass cards
export function GlassCardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-lg font-semibold text-foreground", className)}>
      {children}
    </h3>
  );
}

// Description for glass cards
export function GlassCardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  );
}
