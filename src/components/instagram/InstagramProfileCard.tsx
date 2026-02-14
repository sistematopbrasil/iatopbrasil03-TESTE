import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatNumber, formatChange, getLatestMetric, type InstaProfile, type InstaMetric } from "@/lib/instagram-utils";
import { MiniSparkline } from "./MiniSparkline";

interface Props {
  profile: InstaProfile;
  metrics: InstaMetric[];
  onClick?: () => void;
}

export function InstagramProfileCard({ profile, metrics, onClick }: Props) {
  const latest = getLatestMetric(metrics);
  const dailyChange = latest?.daily_change || 0;
  const followers = latest?.follower_count || 0;

  // Last 14 days of data for sparkline
  const sparklineData = metrics
    .slice(0, 14)
    .reverse()
    .map(m => m.follower_count);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.profile_picture || undefined} alt={profile.username} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {profile.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">@{profile.username}</p>
            {profile.display_name && (
              <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
            )}
          </div>
          {profile.category && (
            <Badge variant="secondary" className="text-xs shrink-0">{profile.category}</Badge>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(followers)}</p>
            <div className="flex items-center gap-1 mt-1">
              {dailyChange > 0 ? (
                <ArrowUp className="h-3 w-3 text-green-500" />
              ) : dailyChange < 0 ? (
                <ArrowDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={`text-xs font-medium tabular-nums ${
                dailyChange > 0 ? "text-green-500" : dailyChange < 0 ? "text-red-500" : "text-muted-foreground"
              }`}>
                {formatChange(dailyChange)}
              </span>
            </div>
          </div>
          {sparklineData.length > 1 && (
            <MiniSparkline data={sparklineData} width={80} height={30} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
