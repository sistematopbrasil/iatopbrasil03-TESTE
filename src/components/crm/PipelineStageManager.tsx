import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Loader2, GripVertical } from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  order_index: number;
}

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#84CC16', '#EB6608'
];

export function PipelineStageManager() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState(PRESET_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  // Buscar stages do banco
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as PipelineStage[];
    },
  });

  // Mutation para salvar stage
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData) throw new Error('Usuário não encontrado');

      if (editingStage) {
        // Editar existente
        const { error } = await supabase
          .from('pipeline_stages')
          .update({ name: stageName, color: stageColor })
          .eq('id', editingStage.id);
        if (error) throw error;
      } else {
        // Criar novo
        const maxOrder = stages.length > 0 
          ? Math.max(...stages.map(s => s.order_index)) 
          : 0;
        
        const { error } = await supabase
          .from('pipeline_stages')
          .insert({
            name: stageName,
            color: stageColor,
            order_index: maxOrder + 1,
            organization_id: userData.organization_id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingStage ? 'Quadro atualizado!' : 'Quadro criado!');
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      closeDialog();
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar quadro');
    },
  });

  // Mutation para excluir stage
  const deleteMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stageId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Quadro excluído!');
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
    },
    onError: () => {
      toast.error('Erro ao excluir quadro');
    },
  });

  const openNewDialog = () => {
    setEditingStage(null);
    setStageName('');
    setStageColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setShowDialog(true);
  };

  const openEditDialog = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageColor(stage.color);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingStage(null);
    setStageName('');
    setStageColor(PRESET_COLORS[0]);
  };

  const handleDelete = (stage: PipelineStage) => {
    if (confirm(`Tem certeza que deseja excluir o quadro "${stage.name}"?`)) {
      deleteMutation.mutate(stage.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Carregando quadros...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Quadros do Pipeline</h3>
          <p className="text-sm text-muted-foreground">
            Personalize os quadros do seu pipeline de vendas
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-primary gap-2">
          <Plus className="w-4 h-4" />
          Novo Quadro
        </Button>
      </div>

      {/* Lista de stages */}
      <div className="flex flex-wrap gap-3">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-sm font-medium text-foreground">{stage.name}</span>
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(stage)}
                className="h-7 w-7 p-0 hover:bg-primary/20"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(stage)}
                className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {stages.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">Nenhum quadro criado</p>
          <Button variant="outline" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Criar primeiro quadro
          </Button>
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>
              {editingStage ? 'Editar Quadro' : 'Novo Quadro'}
            </DialogTitle>
            <DialogDescription>
              Configure o nome e cor do quadro
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Quadro</Label>
              <Input
                placeholder="Ex: Leads Quentes, Em Negociação..."
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
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
                    onClick={() => setStageColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      stageColor === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs">Personalizada:</Label>
                <Input
                  type="color"
                  value={stageColor}
                  onChange={(e) => setStageColor(e.target.value)}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preview</Label>
              <Badge 
                style={{ backgroundColor: stageColor }} 
                className="text-white"
              >
                {stageName || 'Nome do quadro'}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={() => saveMutation.mutate()} 
              disabled={!stageName.trim() || saveMutation.isPending}
              className="bg-primary"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Hook para usar stages em outros componentes
export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as PipelineStage[];
    },
  });
}
