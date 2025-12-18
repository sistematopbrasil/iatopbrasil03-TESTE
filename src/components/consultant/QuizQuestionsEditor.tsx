import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Edit2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type QuestionType = 'multiple_choice' | 'open_text' | 'yes_no';

interface Question {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[];
  order_index: number;
  is_active: boolean;
}

export function QuizQuestionsEditor() {
  const queryClient = useQueryClient();
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: consultant } = useQuery({
    queryKey: ['current-consultant-questions'],
    queryFn: getCurrentConsultant,
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ['quiz-questions', consultant?.id],
    queryFn: async () => {
      if (!consultant?.id) return [];
      
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('consultant_id', consultant.id)
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      return data as Question[];
    },
    enabled: !!consultant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (question: Partial<Question>) => {
      if (!consultant?.id) throw new Error('Usuário não encontrado');

      if (question.id) {
        const { error } = await supabase
          .from('quiz_questions')
          .update({
            question_text: question.question_text,
            question_type: question.question_type,
            options: question.options,
          })
          .eq('id', question.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('quiz_questions')
          .insert({
            consultant_id: consultant.id,
            question_text: question.question_text,
            question_type: question.question_type,
            options: question.options,
            order_index: (questions?.length || 0) + 1,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions'] });
      toast.success('Pergunta salva!');
      setIsDialogOpen(false);
      setEditingQuestion(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quiz_questions')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions'] });
      toast.success('Pergunta removida!');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Perguntas do Quiz</CardTitle>
            <CardDescription>Personalize as perguntas do seu quiz</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingQuestion(null)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Pergunta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
                </DialogTitle>
              </DialogHeader>
              <QuestionForm
                question={editingQuestion}
                onSave={(q) => saveMutation.mutate(q)}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingQuestion(null);
                }}
                isPending={saveMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {questions && questions.length > 0 ? (
          <div className="space-y-3">
            {questions.map((q, index) => (
              <div
                key={q.id}
                className="p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground mb-2">
                      {q.question_text}
                    </p>
                    
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                      <span className="bg-muted px-2 py-1 rounded text-xs">
                        {q.question_type === 'multiple_choice' ? '📋 Múltipla Escolha' :
                         q.question_type === 'yes_no' ? '✓ Sim/Não' :
                         '✍️ Texto Aberto'}
                      </span>
                      {q.options && (
                        <span className="text-xs">
                          {(q.options as string[]).length} opções
                        </span>
                      )}
                    </div>

                    {q.options && (q.options as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(q.options as string[]).map((opt, i) => (
                          <span
                            key={i}
                            className="text-xs bg-background border border-border px-3 py-1 rounded-full"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingQuestion(q);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir esta pergunta?')) {
                            deleteMutation.mutate(q.id);
                          }
                        }}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma pergunta cadastrada.</p>
            <p className="text-sm mt-2">Clique em "Nova Pergunta" para começar.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionForm({ 
  question, 
  onSave, 
  onCancel,
  isPending,
}: { 
  question: Question | null; 
  onSave: (q: Partial<Question>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    question_text: question?.question_text || '',
    question_type: question?.question_type || 'multiple_choice' as QuestionType,
    options: (question?.options as string[]) || [''],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.question_text.trim()) {
      toast.error('Digite a pergunta');
      return;
    }

    if (formData.question_type !== 'open_text' && formData.options.filter(o => o.trim()).length < 2) {
      toast.error('Adicione pelo menos 2 opções');
      return;
    }

    onSave({
      id: question?.id,
      question_text: formData.question_text,
      question_type: formData.question_type,
      options: formData.question_type === 'open_text' 
        ? undefined 
        : formData.options.filter(o => o.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Pergunta</Label>
        <Input
          value={formData.question_text}
          onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
          placeholder="Digite a pergunta..."
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de Pergunta</Label>
        <Select
          value={formData.question_type}
          onValueChange={(value: QuestionType) => 
            setFormData({ ...formData, question_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple_choice">Múltipla Escolha</SelectItem>
            <SelectItem value="yes_no">Sim/Não</SelectItem>
            <SelectItem value="open_text">Texto Aberto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.question_type !== 'open_text' && (
        <div className="space-y-2">
          <Label>Opções</Label>
          {formData.options.map((opt, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={opt}
                onChange={(e) => {
                  const newOptions = [...formData.options];
                  newOptions[index] = e.target.value;
                  setFormData({ ...formData, options: newOptions });
                }}
                placeholder={`Opção ${index + 1}`}
              />
              {formData.options.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newOptions = formData.options.filter((_, i) => i !== index);
                    setFormData({ ...formData, options: newOptions });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFormData({ ...formData, options: [...formData.options, ''] })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Opção
          </Button>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}