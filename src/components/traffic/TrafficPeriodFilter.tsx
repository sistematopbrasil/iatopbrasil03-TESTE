import { useState } from "react";
import { format, startOfDay, subDays, startOfYesterday, endOfYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DatePeriodValue } from "@/components/instagram/DatePeriodFilter";
import type { DateRange } from "react-day-picker";

const PRESETS = [
  { label: "Hoje", preset: "1d", days: 0 },
  { label: "Ontem", preset: "yesterday", days: null },
  { label: "7 dias", preset: "7d", days: 6 },
  { label: "14 dias", preset: "14d", days: 13 },
  { label: "30 dias", preset: "30d", days: 29 },
  { label: "Total", preset: "total", days: null },
] as const;

interface Props {
  value: DatePeriodValue;
  onChange: (v: DatePeriodValue) => void;
}

export function TrafficPeriodFilter({ value, onChange }: Props) {
  const today = startOfDay(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isCustom = value.preset === "custom";

  const customLabel = isCustom && value.from && value.to
    ? `${format(value.from, "dd/MM", { locale: ptBR })} - ${format(value.to, "dd/MM", { locale: ptBR })}`
    : null;

  const handleRangeSelect = (range: DateRange | undefined) => {
    onChange({
      preset: "custom" as any,
      from: range?.from || null,
      to: range?.to || null,
    });
    if (range?.from && range?.to) {
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => {
        const isActive = value.preset === p.preset;
        return (
          <Button
            key={p.preset}
            size="sm"
            variant={isActive ? "default" : "outline"}
            className={`h-8 px-3 text-xs font-medium transition-all ${isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => {
              if (p.preset === "yesterday") {
                onChange({
                  preset: "yesterday" as any,
                  from: startOfYesterday(),
                  to: endOfYesterday(),
                });
              } else {
                onChange({
                  preset: p.preset as any,
                  from: p.days !== null ? subDays(today, p.days) : undefined,
                  to: p.days !== null ? today : undefined,
                });
              }
            }}
          >
            {p.label}
          </Button>
        );
      })}

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={isCustom ? "default" : "outline"}
            className={`h-8 px-3 text-xs font-medium gap-1.5 transition-all ${isCustom ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {customLabel || "Personalizado"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value.from ? { from: value.from, to: value.to ?? undefined } : undefined}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
            disabled={(date) => date > new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
