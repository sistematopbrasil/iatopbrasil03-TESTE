import { useState } from "react";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { useInstagramUpdate } from "@/hooks/useInstagramUpdate";
import { InstagramProfileCard } from "./InstagramProfileCard";
import { AddProfileModal } from "./AddProfileModal";
import { InstagramProfileDetail } from "./InstagramProfileDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DatePeriodFilter, filterMetricsByDatePeriod, type DatePeriodValue } from "./DatePeriodFilter";
import { startOfDay, subDays } from "date-fns";

interface InstagramProfilesListProps {
  canManage?: boolean;
}

export function InstagramProfilesList({ canManage = true }: InstagramProfilesListProps = {}) {
  const { data: profiles, isLoading } = useInstagramProfiles();
  const { data: allMetrics } = useInstagramMetrics();
  const { updateAll } = useInstagramUpdate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("growth");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [datePeriod, setDatePeriod] = useState<DatePeriodValue>({
    preset: "7d",
    from: subDays(startOfDay(new Date()), 6),
    to: startOfDay(new Date()),
  });

  const filteredMetrics = filterMetricsByDatePeriod(allMetrics || [], datePeriod);

  let filtered = profiles || [];

  if (filter === "active") filtered = filtered.filter(p => p.is_active);
  else if (filter === "archived") filtered = filtered.filter(p => !p.is_active);

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.username.toLowerCase().includes(q) ||
      p.display_name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }

  if (sort === "alpha") filtered = [...filtered].sort((a, b) => a.username.localeCompare(b.username));
  else if (sort === "recent") filtered = [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at));
  else if (sort === "growth") {
    filtered = [...filtered].sort((a, b) => {
      const aMetrics = filteredMetrics.filter(m => m.profile_id === a.id);
      const bMetrics = filteredMetrics.filter(m => m.profile_id === b.id);
      const aChange = aMetrics.reduce((s, m) => s + (m.daily_change || 0), 0);
      const bChange = bMetrics.reduce((s, m) => s + (m.daily_change || 0), 0);
      return bChange - aChange;
    });
  }

  const selectedProfile = profiles?.find(p => p.id === selectedProfileId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar perfil..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="archived">Arquivados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="growth">Maior Crescimento</SelectItem>
            <SelectItem value="recent">Mais Recentes</SelectItem>
            <SelectItem value="alpha">Alfabético</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => updateAll.mutate({})} disabled={updateAll.isPending}>
          <RefreshCw className={`h-4 w-4 ${updateAll.isPending ? "animate-spin" : ""}`} />
        </Button>
        {canManage && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        )}
      </div>

      <DatePeriodFilter value={datePeriod} onChange={setDatePeriod} />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6 h-32" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {search ? "Nenhum perfil encontrado." : "Nenhum perfil cadastrado. Clique em \"Adicionar\" para começar."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(profile => {
            const profileFilteredMetrics = filteredMetrics.filter(m => m.profile_id === profile.id);
            const periodChange = profileFilteredMetrics.reduce((s, m) => s + (m.daily_change || 0), 0);
            return (
              <InstagramProfileCard
                key={profile.id}
                profile={profile}
                metrics={allMetrics?.filter(m => m.profile_id === profile.id) || []}
                periodChange={periodChange}
                onClick={() => setSelectedProfileId(profile.id)}
              />
            );
          })}
        </div>
      )}

      <AddProfileModal open={showAdd} onOpenChange={setShowAdd} />
      <Sheet open={!!selectedProfileId} onOpenChange={(open) => !open && setSelectedProfileId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {selectedProfile && (
            <InstagramProfileDetail profile={selectedProfile} onClose={() => setSelectedProfileId(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
