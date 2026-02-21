import { format, subDays, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface InstaProfile {
  id: string;
  organization_id: string;
  username: string;
  display_name: string | null;
  profile_picture: string | null;
  profile_url: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstaMetric {
  id: string;
  profile_id: string;
  follower_count: number;
  following_count: number;
  posts_count: number;
  daily_change: number;
  growth_rate: number;
  recorded_at: string;
  recorded_date: string;
}

export interface InstaCampaignNote {
  id: string;
  profile_id: string;
  note_text: string;
  note_type: string;
  created_at: string;
}

export function parseInstagramUsername(input: string): string {
  return input
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/\/$/, "")
    .split("?")[0];
}

export function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR");
}

export function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return sign + change.toLocaleString("pt-BR");
}

export function formatPercentage(value: number): string {
  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(2) + "%";
}

export function filterMetricsByPeriod(metrics: InstaMetric[], days: number | null): InstaMetric[] {
  if (!days) return metrics;
  const cutoff = subDays(new Date(), days);
  return metrics.filter(m => isAfter(parseISO(m.recorded_date), cutoff));
}

export function calculateAverage(metrics: InstaMetric[], field: "daily_change" | "growth_rate", days: number): number {
  const filtered = filterMetricsByPeriod(metrics, days);
  if (filtered.length === 0) return 0;
  const sum = filtered.reduce((acc, m) => acc + (m[field] || 0), 0);
  return sum / filtered.length;
}

export function getLatestMetric(metrics: InstaMetric[]): InstaMetric | null {
  if (!metrics.length) return null;
  return metrics.reduce((latest, m) =>
    m.recorded_date > latest.recorded_date ? m : latest
  );
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export const PROFILE_CATEGORIES = [
  "Consultor",
  "Embaixador",
  "Líder",
  "Gerente",
  "Diretor",
  "Outro",
];
