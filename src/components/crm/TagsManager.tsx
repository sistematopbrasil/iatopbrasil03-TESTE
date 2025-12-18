import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Tag, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CRMTag {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

const PRESET_COLORS = [
  '#EB6608', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#84CC16'
];

export function TagsManager() {
  const [tags, setTags] = useState<CRMTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<CRMTag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('crm_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('Erro ao carregar tags');
    } finally {
      setIsLoading(false);
    }
  }

  function openNewDialog() {
    setEditingTag(null);
    setName('');
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setShowDialog(true);
  }

  function openEditDialog(tag: CRMTag) {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setShowDialog(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Obter usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsSaving(false);
        return;
      }

      // 2. Buscar dados na tabela users pelo auth_user_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userError || !userData) {
        console.error('Erro ao buscar usuário:', userError);
        toast.error('Erro ao carregar dados do usuário');
        setIsSaving(false);
        return;
      }

      if (editingTag) {
        const { error } = await supabase
          .from('crm_tags')
          .update({ name, color })
          .eq('id', editingTag.id);

        if (error) throw error;
        toast.success('Tag atualizada!');
      } else {
        const { error } = await supabase
          .from('crm_tags')
          .insert({
            name,
            color,
            user_id: userData.id,
            organization_id: userData.organization_id,
          });

        if (error) throw error;
        toast.success('Tag criada!');
      }

      setShowDialog(false);
      loadTags();
    } catch (error: any) {
      console.error('Error saving tag:', error);
      toast.error(error.message || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta tag?')) return;

    try {
      const { error } = await supabase
        .from('crm_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Tag excluída!');
      loadTags();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Tags</h3>
          <p className="text-sm text-muted-foreground">
            Crie tags para organizar seus leads e conversas
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nova Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <Card className="glass p-8 text-center">
          <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhuma tag criada</p>
          <Button variant="outline" className="mt-4" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira
          </Button>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <Card key={tag.id} className="glass p-3 flex items-center gap-3">
              <Badge
                style={{ backgroundColor: tag.color }}
                className="text-white"
              >
                {tag.name}
              </Badge>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(tag)}
                  className="h-7 w-7 p-0 hover:bg-primary/20"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tag.id)}
                  className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Editar Tag' : 'Nova Tag'}
            </DialogTitle>
            <DialogDescription>
              Escolha um nome e cor para a tag
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Tag</Label>
              <Input
                placeholder="Ex: VIP, Urgente, Interessado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs">Personalizada:</Label>
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preview</Label>
              <Badge style={{ backgroundColor: color }} className="text-white">
                {name || 'Nome da tag'}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary">
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export a hook to use tags elsewhere
export function useTags() {
  const [tags, setTags] = useState<CRMTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    try {
      const { data, error } = await supabase
        .from('crm_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return { tags, isLoading, refresh: loadTags };
}
