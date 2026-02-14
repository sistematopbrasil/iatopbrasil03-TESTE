import { formatRelativeTime } from "@/lib/instagram-utils";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface Props {
  date: string;
}

export function LastUpdatedBadge({ date }: Props) {
  const relative = formatRelativeTime(date);
  
  return (
    <Badge variant="outline" className="gap-1 text-xs font-normal">
      <Clock className="h-3 w-3" />
      Atualizado {relative}
    </Badge>
  );
}
