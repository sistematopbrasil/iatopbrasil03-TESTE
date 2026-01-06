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

interface QuickReply {
  id: string;
  shortcut: string;
  content: string | null;
  description: string | null;
  type: string;
  media_url: string | null;
  media_filename: string | null;
  is_enabled: boolean;
  order_index: number;
}

const DEFAULT_QUICK_REPLIES = [
  { shortcut: '/ola', content: 'Olá! Como posso ajudar você hoje?', description: 'Saudação', type: 'text', is_enabled: true, order_index: 0 },
  { shortcut: '/info', content: 'Obrigado pelo interesse! Posso enviar mais informações sobre nossos planos de proteção veicular?', description: 'Informação', type: 'text', is_enabled: true, order_index: 1 },
  { shortcut: '/agendar', content: 'Perfeito! Vou agendar uma apresentação para você. Qual o melhor horário?', description: 'Agendar', type: 'text', is_enabled: true, order_index: 2 },
  { shortcut: '/preco', content: 'Nossos valores variam de acordo com o veículo. Posso fazer uma cotação personalizada para você?', description: 'Preço', type: 'text', is_enabled: true, order_index: 3 },
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

  useEffect(() => {
    loadQuickReplies();
  }, []);

  async function loadQuickReplies() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('crm_quick_replies')
        .select('*')
        .order('order_index');

      if (error) throw error;
      
      // Se não houver respostas, criar as padrão
      if (!data || data.length === 0) {
        await createDefaultReplies();
        return;
      }
      
      // Map para garantir que is_enabled e order_index existem
      const mappedData = data.map((reply, index) => ({
        ...reply,
        is_enabled: reply.is_enabled ?? true,
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
      // Usar auth.getUser() que é mais confiável
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('Usuário não autenticado');
        toast.error('Erro: usuário não autenticado');
        setIsLoading(false);
        return;
      }

      // Buscar dados do usuário
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

      // Inserir respostas padrão
      const { data, error } = await supabase
        .from('crm_quick_replies')
        .insert(
          DEFAULT_QUICK_REPLIES.map(reply => ({
            ...reply,
            user_id: userData.id,
            organization_id: userData.organization_id,
          }))
        )
        .select();

      if (error) {
        console.error('Erro ao criar respostas:', error);
        toast.error('Erro ao criar respostas padrão');
        throw error;
      }
      
      const mappedData = (data || []).map((reply, index) => ({
        ...reply,
        is_enabled: reply.is_enabled ?? true,
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
      // Usar auth.getUser()
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

      // Se tiver arquivo, fazer upload
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
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
        // Update
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
        // Create - add at the end
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
            is_enabled: true,
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

  async function handleToggleEnabled(id: string, enabled: boolean) {
    try {
      const { error } = await supabase
        .from('crm_quick_replies')
        .update({ is_enabled: enabled })
        .eq('id', id);

      if (error) throw error;
      
      setQuickReplies(prev => 
        prev.map(r => r.id === id ? { ...r, is_enabled: enabled } : r)
      );
      
      toast.success(enabled ? 'Resposta ativada!' : 'Resposta desativada!');
    } catch (error) {
      console.error('Error toggling:', error);
      toast.error('Erro ao alterar status');
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;

    // Reorder locally first for immediate feedback
    const reordered = Array.from(quickReplies);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);
    
    // Update order_index for each item
    const updated = reordered.map((item, index) => ({
      ...item,
      order_index: index,
    }));
    
    setQuickReplies(updated);

    // Update in database
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
      loadQuickReplies(); // Revert on error
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
          <h3 className="font-semibold text-foreground">Respostas Rápidas</h3>
          <p className="text-sm text-muted-foreground">
            Configure atalhos para enviar mensagens frequentes. Arraste para reordenar.
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
                  <Draggable key={reply.id} draggableId={reply.id} index={index}>
                    {(provided, snapshot) => (
                      <Card 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`glass p-4 transition-all ${
                          snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                        } ${!reply.is_enabled ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Drag Handle */}
                          <div 
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing mt-1"
                          >
                            <GripVertical className="w-5 h-5 text-muted-foreground" />
                          </div>

                          {/* Content */}
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

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={reply.is_enabled}
                              onCheckedChange={(checked) => handleToggleEnabled(reply.id, checked)}
                              aria-label="Ativar/desativar resposta"
                            />
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
                    )}
                  </Draggable>
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
              Configure um atalho para enviar mensagens ou arquivos rapidamente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Atalho</Label>
                <Input
                  placeholder="/ola"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="glass font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Resposta</Label>
                <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
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
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Saudação inicial"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="glass"
              />
            </div>

            {mediaType !== 'text' && (
              <div className="space-y-2">
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  accept={
                    mediaType === 'image' ? 'image/*' :
                    mediaType === 'video' ? 'video/*' :
                    mediaType === 'audio' ? 'audio/*' :
                    '.pdf,.doc,.docx,.xls,.xlsx,.txt'
                  }
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="glass"
                />
                {mediaUrl && !mediaFile && (
                  <p className="text-xs text-muted-foreground">
                    Arquivo atual: {editingReply?.media_filename || 'arquivo anexado'}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{mediaType === 'text' ? 'Conteúdo da Mensagem' : 'Legenda (opcional)'}</Label>
              <Textarea
                placeholder={mediaType === 'text' ? 'Digite a mensagem que será enviada...' : 'Adicione uma legenda para o arquivo...'}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="glass min-h-[100px]"
              />
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