import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramUpdate } from "@/hooks/useInstagramUpdate";
import { parseInstagramUsername, formatNumber, PROFILE_CATEGORIES } from "@/lib/instagram-utils";
import { Search, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProfileModal({ open, onOpenChange }: Props) {
  const [usernameInput, setUsernameInput] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const { addProfile } = useInstagramProfiles();
  const { fetchPreview } = useInstagramUpdate();

  // Get current user's org
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-layout"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("users")
        .select("organization_id")
        .eq("auth_user_id", user.id)
        .single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = () => {
    const username = parseInstagramUsername(usernameInput);
    if (!username) return;
    fetchPreview.mutate(username, {
      onSuccess: (data) => setPreview(data),
    });
  };

  const handleAdd = () => {
    if (!preview || !currentUser?.organization_id) return;
    addProfile.mutate(
      {
        username: preview.username,
        display_name: preview.displayName,
        profile_picture: preview.profilePicture,
        category: category || undefined,
        notes: notes || undefined,
        organization_id: currentUser.organization_id,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setUsernameInput("");
          setPreview(null);
          setCategory("");
          setNotes("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Perfil do Instagram</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="@usuario ou URL do Instagram"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={!usernameInput.trim() || fetchPreview.isPending}
              size="icon"
            >
              {fetchPreview.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {fetchPreview.isError && (
            <p className="text-sm text-destructive">Erro ao buscar perfil. Verifique o username.</p>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={preview.profilePicture} />
                  <AvatarFallback>{preview.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">@{preview.username}</p>
                  <p className="text-sm text-muted-foreground truncate">{preview.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(preview.followerCount)} seguidores
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
              </div>

              <div>
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

              <div>
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre o perfil..."
                  rows={2}
                />
              </div>

              <Button onClick={handleAdd} disabled={addProfile.isPending} className="w-full">
                {addProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Adicionar Perfil
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
