import { useState } from "react";
import { format, startOfDay, subDays, startOfYesterday, endOfYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type DatePeriodPreset = "today" | "yesterday" | "7d" | "30d" | "total" | "custom";

export interface DatePeriodValue {
  preset: DatePeriodPreset;
  from: Date | null;
  to: Date | null;
}

const PRESETS: { label: string; value: DatePeriodPreset }[] = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Total", value: "total" },
  { label: "Personalizado", value: "custom" },
];

function getPresetRange(preset: DatePeriodPreset): { from: Date | null; to: Date | null } {
  const today = startOfDay(new Date());
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: startOfYesterday(), to: endOfYesterday() };
    case "7d":
      return { from: subDays(today, 6), to: today };
    case "30d":
      return { from: subDays(today, 29), to: today };
    case "total":
      return { from: null, to: null };
    default:
      return { from: null, to: null };
  }
}

interface Props {
  value: DatePeriodValue;
  onChange: (value: DatePeriodValue) => void;
  className?: string;
}

export function DatePeriodFilter({ value, onChange, className }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePresetChange = (preset: string) => {
    const p = preset as DatePeriodPreset;
    if (p === "custom") {
      onChange({ preset: "custom", from: value.from, to: value.to });
      return;
    }
    const range = getPresetRange(p);
    onChange({ preset: p, ...range });
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    onChange({
      preset: "custom",
      from: range?.from || null,
      to: range?.to || null,
    });
    if (range?.from && range?.to) {
      setCalendarOpen(false);
    }
  };

  const customLabel = value.preset === "custom" && value.from && value.to
    ? `${format(value.from, "dd/MM", { locale: ptBR })} - ${format(value.to, "dd/MM", { locale: ptBR })}`
    : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={value.preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === "custom" && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {customLabel || "Selecionar período"}
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
      )}
    </div>
  );
}

export function filterMetricsByDatePeriod<T extends { recorded_date: string }>(
  metrics: T[],
  period: DatePeriodValue
): T[] {
  if (period.preset === "total" || (!period.from && !period.to)) return metrics;
  return metrics.filter(m => {
    const date = m.recorded_date;
    if (period.from) {
      const fromStr = format(period.from, "yyyy-MM-dd");
      if (date < fromStr) return false;
    }
    if (period.to) {
      const toStr = format(period.to, "yyyy-MM-dd");
      if (date > toStr) return false;
    }
    return true;
  });
}
