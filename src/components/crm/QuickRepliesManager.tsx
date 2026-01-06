import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit, Zap, Loader2, Save, Image, Video, Music, FileText, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';

interface QuickReply {
  id: string;
  shortcut: string;
  content: string | null;
  description: string | null;
  type: string;
  media_url: string | null;
  media_filename: string | null;
  order_index: number;
}

const DEFAULT_QUICK_REPLIES = [
  { shortcut: '/ola', content: 'Olá! Como posso ajudar você hoje?', description: 'Saudação', type: 'text', order_index: 0 },
  { shortcut: '/info', content: 'Obrigado pelo interesse! Posso enviar mais informações sobre nossos planos de proteção veicular?', description: 'Informação', type: 'text', order_index: 1 },
  { shortcut: '/agendar', content: 'Perfeito! Vou agendar uma apresentação para você. Qual o melhor horário?', description: 'Agendar', type: 'text', order_index: 2 },
  { shortcut: '/preco', content: 'Nossos valores variam de acordo com o veículo. Posso fazer uma cotação personalizada para você?', description: 'Preço', type: 'text', order_index: 3 },
];

export function QuickRepliesManager() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video' | 'audio' | 'document'>('text');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado global de ativação das respostas rápidas
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);

  useEffect(() => {
    loadQuickReplies();
    loadGlobalSetting();
  }, []);

  async function loadGlobalSetting() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData) return;

      const { data } = await supabase
        .from('crm_settings')
        .select('quick_replies_enabled')
        .eq('user_id', userData.id)
        .maybeSingle();

      setGlobalEnabled(data?.quick_replies_enabled ?? true);
    } catch (error) {
      console.error('Erro ao carregar configuração global:', error);
    }
  }

  async function handleGlobalToggle(enabled: boolean) {
    setSavingGlobal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: userData } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData) throw new Error('Usuário não encontrado');

      const { error } = await supabase
        .from('crm_settings')
        .upsert({
          user_id: userData.id,
          organization_id: userData.organization_id,
          quick_replies_enabled: enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      setGlobalEnabled(enabled);
      toast.success(enabled ? 'Respostas rápidas ativadas' : 'Respostas rápidas desativadas');
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingGlobal(false);
    }
  }

  async function loadQuickReplies() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('crm_quick_replies')
        .select('id, shortcut, content, description, type, media_url, media_filename, order_index')
        .order('order_index');

      if (error) throw error;
      
      // Se não houver respostas, criar as padrão
      if (!data || data.length === 0) {
        await createDefaultReplies();
        return;
      }
      
      // Map para garantir que order_index existe
      const mappedData = data.map((reply, index) => ({
        ...reply,
        order_index: reply.order_index ?? index,
      }));
      
      setQuickReplies(mappedData);
    } catch (error) {
      console.error('Error loading quick replies:', error);
      toast.error('Erro ao carregar respostas rápidas');
    } finally {
      setIsLoading(false);
    }
  }

  async function createDefaultReplies() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('Usuário não autenticado');
        toast.error('Erro: usuário não autenticado');
        setIsLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userError || !userData) {
        console.error('Erro ao buscar usuário:', userError);
        toast.error('Erro ao carregar dados do usuário');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('crm_quick_replies')
        .insert(
          DEFAULT_QUICK_REPLIES.map(reply => ({
            ...reply,
            user_id: userData.id,
            organization_id: userData.organization_id,
          }))
        )
        .select('id, shortcut, content, description, type, media_url, media_filename, order_index');

      if (error) {
        console.error('Erro ao criar respostas:', error);
        toast.error('Erro ao criar respostas padrão');
        throw error;
      }
      
      const mappedData = (data || []).map((reply, index) => ({
        ...reply,
        order_index: reply.order_index ?? index,
      }));
      
      setQuickReplies(mappedData);
      toast.success('Respostas rápidas padrão criadas!');
    } catch (error) {
      console.error('Error creating default replies:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function openNewDialog() {
    setEditingReply(null);
    setShortcut('/');
    setContent('');
    setDescription('');
    setMediaType('text');
    setMediaFile(null);
    setMediaUrl('');
    setShowDialog(true);
  }

  function openEditDialog(reply: QuickReply) {
    setEditingReply(reply);
    setShortcut(reply.shortcut);
    setContent(reply.content || '');
    setDescription(reply.description || '');
    setMediaType((reply.type as any) || 'text');
    setMediaUrl(reply.media_url || '');
    setMediaFile(null);
    setShowDialog(true);
  }

  async function handleSave() {
    if (!shortcut.startsWith('/')) {
      toast.error('O atalho deve começar com /');
      return;
    }
    if (mediaType === 'text' && !content.trim()) {
      toast.error('O conteúdo é obrigatório para mensagens de texto');
      return;
    }
    if (mediaType !== 'text' && !mediaFile && !mediaUrl) {
      toast.error('Selecione um arquivo para upload');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userError || !userData) throw new Error('User not found');

      let uploadedMediaUrl = mediaUrl;
      let mediaFilename = '';

      if (mediaFile) {
        const fileName = `quick-replies/${Date.now()}_${mediaFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('crm-media')
          .upload(fileName, mediaFile);

        if (uploadError) {
          toast.error('Erro ao fazer upload do arquivo');
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('crm-media')
          .getPublicUrl(fileName);

        uploadedMediaUrl = publicUrl;
        mediaFilename = mediaFile.name;
      }

      if (editingReply) {
        const { error } = await supabase
          .from('crm_quick_replies')
          .update({
            shortcut: shortcut.toLowerCase(),
            content: mediaType === 'text' ? content : content || null,
            description: description || null,
            type: mediaType,
            media_url: mediaType !== 'text' ? uploadedMediaUrl : null,
            media_filename: mediaType !== 'text' ? mediaFilename || editingReply.media_filename : null,
          })
          .eq('id', editingReply.id);

        if (error) throw error;
        toast.success('Resposta atualizada!');
      } else {
        const maxOrder = quickReplies.length > 0 
          ? Math.max(...quickReplies.map(r => r.order_index)) 
          : -1;
        
        const { error } = await supabase
          .from('crm_quick_replies')
          .insert({
            shortcut: shortcut.toLowerCase(),
            content: mediaType === 'text' ? content : content || null,
            description: description || null,
            type: mediaType,
            media_url: mediaType !== 'text' ? uploadedMediaUrl : null,
            media_filename: mediaType !== 'text' ? mediaFilename : null,
            user_id: userData.id,
            organization_id: userData.organization_id,
            order_index: maxOrder + 1,
          });

        if (error) throw error;
        toast.success('Resposta criada!');
      }

      setShowDialog(false);
      loadQuickReplies();
    } catch (error: any) {
      console.error('Error saving quick reply:', error);
      toast.error(error.message || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta resposta rápida?')) return;

    try {
      const { error } = await supabase
        .from('crm_quick_replies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Resposta excluída!');
      loadQuickReplies();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir');
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;

    const reordered = Array.from(quickReplies);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);
    
    const updated = reordered.map((item, index) => ({
      ...item,
      order_index: index,
    }));
    
    setQuickReplies(updated);

    try {
      const updates = updated.map(item => 
        supabase
          .from('crm_quick_replies')
          .update({ order_index: item.order_index })
          .eq('id', item.id)
      );
      
      await Promise.all(updates);
      toast.success('Ordem atualizada!');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Erro ao atualizar ordem');
      loadQuickReplies();
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  }

  // Componente de Card arrastável com Portal para corrigir offset
  const DraggableCard = ({ reply, index }: { reply: QuickReply; index: number }) => (
    <Draggable key={reply.id} draggableId={reply.id} index={index}>
      {(provided, snapshot) => {
        const cardContent = (
          <Card 
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`glass p-4 transition-all ${
              snapshot.isDragging ? 'shadow-lg ring-2 ring-primary bg-card' : ''
            }`}
            style={provided.draggableProps.style}
          >
            <div className="flex items-start gap-3">
              <div 
                {...provided.dragHandleProps}
                className="cursor-grab active:cursor-grabbing mt-1"
              >
                <GripVertical className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="text-primary border-primary/30">
                    {getTypeIcon(reply.type)}
                    <span className="ml-1">{reply.shortcut}</span>
                  </Badge>
                  {reply.description && (
                    <span className="text-xs text-muted-foreground">{reply.description}</span>
                  )}
                  {reply.type !== 'text' && (
                    <Badge variant="secondary" className="text-xs">
                      {reply.type === 'image' ? '🖼️ Imagem' :
                       reply.type === 'video' ? '🎥 Vídeo' :
                       reply.type === 'audio' ? '🎵 Áudio' : '📄 Documento'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-2">
                  {reply.content || reply.media_filename || 'Arquivo de mídia'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(reply)}
                  className="hover:bg-primary/20 h-8 w-8 p-0"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(reply.id)}
                  className="hover:bg-destructive/20 hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        );

        // Usar portal quando arrastando para corrigir offset
        if (snapshot.isDragging) {
          return createPortal(cardContent, document.body);
        }

        return cardContent;
      }}
    </Draggable>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Switch Global */}
      <Card className="glass p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="global-toggle" className="text-base font-medium">
              Respostas Rápidas
            </Label>
            <p className="text-sm text-muted-foreground">
              {globalEnabled ? 'Ativadas no CRM' : 'Desativadas no CRM'}
            </p>
          </div>
          <Switch
            id="global-toggle"
            checked={globalEnabled}
            onCheckedChange={handleGlobalToggle}
            disabled={savingGlobal}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Gerenciar Respostas</h3>
          <p className="text-sm text-muted-foreground">
            Arraste para reordenar. Use o botão de lixeira para excluir.
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nova Resposta
        </Button>
      </div>

      {quickReplies.length === 0 ? (
        <Card className="glass p-8 text-center">
          <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhuma resposta rápida configurada</p>
          <Button variant="outline" className="mt-4" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira
          </Button>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="quick-replies">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="space-y-3"
              >
                {quickReplies.map((reply, index) => (
                  <DraggableCard key={reply.id} reply={reply} index={index} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="glass-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida'}
            </DialogTitle>
            <DialogDescription>
              Configure uma resposta rápida que pode ser acionada digitando o atalho no chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shortcut">Atalho</Label>
                <Input
                  id="shortcut"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value.toLowerCase())}
                  placeholder="/atalho"
                  className="glass"
                />
                <p className="text-xs text-muted-foreground">Começa com /</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Saudação"
                  className="glass"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Conteúdo</Label>
              <Select value={mediaType} onValueChange={(v: any) => setMediaType(v)}>
                <SelectTrigger className="glass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">📝 Texto</SelectItem>
                  <SelectItem value="image">🖼️ Imagem</SelectItem>
                  <SelectItem value="video">🎥 Vídeo</SelectItem>
                  <SelectItem value="audio">🎵 Áudio</SelectItem>
                  <SelectItem value="document">📄 Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                {mediaType === 'text' ? 'Conteúdo da Mensagem' : 'Legenda (opcional)'}
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={mediaType === 'text' 
                  ? "Digite o texto da resposta rápida..."
                  : "Legenda para a mídia (opcional)..."
                }
                className="glass min-h-[100px]"
              />
            </div>

            {mediaType !== 'text' && (
              <div className="space-y-2">
                <Label>Arquivo de Mídia</Label>
                <Input
                  type="file"
                  accept={
                    mediaType === 'image' ? 'image/*' :
                    mediaType === 'video' ? 'video/*' :
                    mediaType === 'audio' ? 'audio/*' : '*'
                  }
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="glass"
                />
                {editingReply?.media_url && !mediaFile && (
                  <p className="text-xs text-muted-foreground">
                    ✓ Arquivo atual: {editingReply.media_filename || 'mídia'}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
