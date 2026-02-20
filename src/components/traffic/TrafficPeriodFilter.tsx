import { startOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { DatePeriodValue } from "@/components/instagram/DatePeriodFilter";

const PRESETS = [
  { label: "Hoje", preset: "1d", days: 0 },
  { label: "7 dias", preset: "7d", days: 6 },
  { label: "14 dias", preset: "14d", days: 13 },
  { label: "30 dias", preset: "30d", days: 29 },
  { label: "60 dias", preset: "60d", days: 59 },
  { label: "Total", preset: "total", days: null },
] as const;

interface Props {
  value: DatePeriodValue;
  onChange: (v: DatePeriodValue) => void;
}

export function TrafficPeriodFilter({ value, onChange }: Props) {
  const today = startOfDay(new Date());

  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => {
        const isActive = value.preset === p.preset;
        return (
          <Button
            key={p.preset}
            size="sm"
            variant={isActive ? "default" : "outline"}
            className={`h-8 px-3 text-xs font-medium transition-all ${isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() =>
              onChange({
                preset: p.preset as any,
                from: p.days !== null ? subDays(today, p.days) : undefined,
                to: p.days !== null ? today : undefined,
              })
            }
          >
            {p.label}
          </Button>
        );
      })}
    </div>
  );
}
