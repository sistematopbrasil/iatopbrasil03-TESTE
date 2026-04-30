import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROFILE_CATEGORIES, type InstaProfile } from "@/lib/instagram-utils";

interface Props {
  profile: InstaProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE_VALUE = "__none__";

export function EditProfileDialog({ profile, open, onOpenChange }: Props) {
  const { updateProfile } = useInstagramProfiles();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [category, setCategory] = useState(profile.category || "");
  const [notes, setNotes] = useState(profile.notes || "");
  const [consultantId, setConsultantId] = useState<string>(profile.consultant_id || NONE_VALUE);

  useEffect(() => {
    setUsername(profile.username);
    setDisplayName(profile.display_name || "");
    setCategory(profile.category || "");
    setNotes(profile.notes || "");
    setConsultantId(profile.consultant_id || NONE_VALUE);
  }, [profile]);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-edit-insta"],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
  });
  const showConsultantSelect = !!currentUser?.role && isSuperAdmin(currentUser.role);

  const { data: consultants } = useQuery({
    queryKey: ["org-consultants-for-link", (currentUser as any)?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("organization_id", (currentUser as any).organization_id)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
    enabled: showConsultantSelect && !!(currentUser as any)?.organization_id,
    staleTime: 5 * 60 * 1000,
  });

  const handleSave = () => {
    const cleanUsername = username.trim().replace(/^@/, "");
    const updates: any = {
      id: profile.id,
      username: cleanUsername,
      display_name: displayName || null,
      category: category || null,
      notes: notes || null,
      profile_url: `https://instagram.com/${cleanUsername}`,
    };
    if (showConsultantSelect) {
      updates.consultant_id = consultantId === NONE_VALUE ? null : consultantId;
    }
    updateProfile.mutate(updates);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Username (@)</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" />
          </div>
          <div className="space-y-2">
            <Label>Nome de Exibição</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {PROFILE_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showConsultantSelect && (
            <div className="space-y-2">
              <Label>Vincular a consultor</Label>
              <Select value={consultantId} onValueChange={setConsultantId}>
                <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem vínculo</SelectItem>
                  {consultants?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Quando vinculado, o consultor verá este perfil na aba Instagram dele.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!username.trim() || updateProfile.isPending}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
