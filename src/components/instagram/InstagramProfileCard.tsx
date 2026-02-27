import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, Trophy } from "lucide-react";
import { formatNumber, formatChange, getLatestMetric, type InstaProfile, type InstaMetric } from "@/lib/instagram-utils";
import { MiniSparkline } from "./MiniSparkline";

interface Props {
  profile: InstaProfile;
  metrics: InstaMetric[];
  onClick?: () => void;
  periodChange?: number;
  rank?: number;
}

export function InstagramProfileCard({ profile, metrics, onClick, periodChange, rank }: Props) {
  const latest = getLatestMetric(metrics);
  const displayChange = periodChange !== undefined ? periodChange : (latest?.daily_change || 0);
  const followers = latest?.follower_count || 0;
  const isPositive = displayChange > 0;
  const isNegative = displayChange < 0;

  const sparklineData = metrics
    .slice(0, 14)
    .reverse()
    .map(m => m.follower_count);

  const getMedal = (pos: number) => {
    if (pos === 1) return "🥇";
    if (pos === 2) return "🥈";
    if (pos === 3) return "🥉";
    return null;
  };

  const medal = rank ? getMedal(rank) : null;

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card ${
        isPositive ? "border-green-500/10 hover:border-green-500/30" : 
        isNegative ? "border-red-500/10 hover:border-red-500/30" : 
        "border-border/50 hover:border-primary/30"
      }`}
      onClick={onClick}
    >
      {/* Subtle gradient overlay on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
        isPositive ? "bg-gradient-to-br from-green-500/3 to-transparent" :
        isNegative ? "bg-gradient-to-br from-red-500/3 to-transparent" :
        "bg-gradient-to-br from-primary/3 to-transparent"
      }`} />

      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <Avatar className="h-11 w-11 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
              <AvatarImage src={profile.profile_picture || undefined} alt={profile.username} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                {profile.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {medal && (
              <span className="absolute -top-1 -right-1 text-sm">{medal}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">@{profile.username}</p>
            {profile.display_name && (
              <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
            )}
          </div>
          {profile.category && (
            <Badge variant="secondary" className="text-[10px] shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">{profile.category}</Badge>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{followers.toLocaleString("pt-BR")}</p>
            <div className={`flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full w-fit ${
              isPositive ? "bg-green-500/10" : isNegative ? "bg-red-500/10" : "bg-muted"
            }`}>
              {isPositive ? (
                <ArrowUp className="h-3 w-3 text-green-500" />
              ) : isNegative ? (
                <ArrowDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={`text-xs font-semibold tabular-nums ${
                isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-muted-foreground"
              }`}>
                {formatChange(displayChange)}
              </span>
            </div>
          </div>
          {sparklineData.length > 1 && (
            <div className="opacity-60 group-hover:opacity-100 transition-opacity">
              <MiniSparkline data={sparklineData} width={80} height={30} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
