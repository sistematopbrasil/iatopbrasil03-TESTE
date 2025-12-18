import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Note {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

interface NotesSectionProps {
  conversationId: string;
}

export function NotesSection({ conversationId }: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [conversationId]);

  async function loadNotes() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('crm_notes')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;

    try {
      setIsAdding(true);
      
      // Get current user from auth
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error('User not authenticated');

      // Get user id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (!userData) throw new Error('User not found');

      const { error } = await supabase
        .from('crm_notes')
        .insert({
          conversation_id: conversationId,
          user_id: userData.id,
          content: newNote.trim(),
        });

      if (error) throw error;

      toast.success('Nota adicionada!');
      setNewNote('');
      await loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Erro ao adicionar nota');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Excluir esta nota?')) return;

    try {
      const { error } = await supabase
        .from('crm_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success('Nota excluída!');
      await loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Erro ao excluir nota');
    }
  }

  return (
    <div className="space-y-3">
      <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        Notas Internas
      </h5>

      {/* Notes List */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4">
            <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma nota adicionada ainda
          </p>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className="glass p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteNote(note.id)}
                  className="h-5 w-5 p-0 hover:bg-destructive/20 text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
            </Card>
          ))
        )}
      </div>

      {/* Add Note */}
      <div className="space-y-2">
        <Textarea
          placeholder="Adicionar nota sobre este lead..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="glass border-border focus:border-primary min-h-[60px] text-sm"
        />
        <Button
          onClick={handleAddNote}
          disabled={!newNote.trim() || isAdding}
          size="sm"
          className="w-full bg-primary"
        >
          {isAdding ? (
            <>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 mr-2" />
              Adicionar Nota
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
