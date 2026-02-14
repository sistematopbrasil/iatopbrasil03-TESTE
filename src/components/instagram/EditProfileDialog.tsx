import { useState } from "react";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
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

export function EditProfileDialog({ profile, open, onOpenChange }: Props) {
  const { updateProfile } = useInstagramProfiles();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [category, setCategory] = useState(profile.category || "");
  const [notes, setNotes] = useState(profile.notes || "");

  const handleSave = () => {
    const cleanUsername = username.trim().replace(/^@/, "");
    updateProfile.mutate({
      id: profile.id,
      username: cleanUsername,
      display_name: displayName || null,
      category: category || null,
      notes: notes || null,
      profile_url: `https://instagram.com/${cleanUsername}`,
    });
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
