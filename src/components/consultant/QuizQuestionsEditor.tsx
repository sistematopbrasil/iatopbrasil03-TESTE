import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
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
  is_default?: boolean;
}

export function QuizQuestionsEditor() {
  const queryClient = useQueryClient();
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: consultant } = useQuery({
    queryKey: ['current-consultant-questions'],
    queryFn: getCurrentConsultant,
  });

  // Fetch all questions (including inactive ones to allow reactivation)
  const { data: questions, isLoading } = useQuery({
    queryKey: ['quiz-questions', consultant?.id],
    queryFn: async () => {
      if (!consultant?.id) return [];
      
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('consultant_id', consultant.id)
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
            is_default: false, // User-created questions are not default
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

  // Toggle question visibility (for default questions)
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('quiz_questions')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions'] });
      toast.success(isActive ? 'Pergunta ativada!' : 'Pergunta ocultada!');
    },
  });

  // Delete mutation (only for non-default questions)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions'] });
      toast.success('Pergunta excluída!');
    },
  });

  // Separate active and inactive questions
  const activeQuestions = questions?.filter(q => q.is_active) || [];
  const inactiveQuestions = questions?.filter(q => !q.is_active) || [];

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
      <CardContent className="space-y-6">
        {/* Active Questions */}
        {activeQuestions.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Perguntas Ativas</h3>
            {activeQuestions.map((q, index) => (
              <div
                key={q.id}
                className="p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-foreground">
                        {q.question_text}
                      </p>
                      {q.is_default && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                    
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
                      
                      {q.is_default ? (
                        // Default questions can only be hidden
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleVisibilityMutation.mutate({ id: q.id, isActive: false })}
                          className="text-yellow-600 hover:bg-yellow-500/10"
                        >
                          <EyeOff className="w-3 h-3 mr-1" />
                          Ocultar
                        </Button>
                      ) : (
                        // Non-default questions can be deleted
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
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma pergunta ativa.</p>
            <p className="text-sm mt-2">Clique em "Nova Pergunta" para começar.</p>
          </div>
        )}

        {/* Inactive/Hidden Questions */}
        {inactiveQuestions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground">Perguntas Ocultas</h3>
            {inactiveQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-lg border border-border bg-muted/50 opacity-70"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold text-sm">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-muted-foreground mb-2">
                      {q.question_text}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleVisibilityMutation.mutate({ id: q.id, isActive: true })}
                        className="text-green-600 hover:bg-green-500/10"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ativar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
  const getInitialOptions = (q: Question | null, type: QuestionType): string[] => {
    if (type === 'yes_no') return ['Sim', 'Não'];
    if (q?.options) return q.options as string[];
    return [''];
  };

  const [formData, setFormData] = useState({
    question_text: question?.question_text || '',
    question_type: question?.question_type || 'multiple_choice' as QuestionType,
    options: getInitialOptions(question, question?.question_type || 'multiple_choice'),
  });

  // Auto-preencher opções quando tipo muda para yes_no
  const handleTypeChange = (newType: QuestionType) => {
    if (newType === 'yes_no') {
      setFormData({ ...formData, question_type: newType, options: ['Sim', 'Não'] });
    } else if (newType === 'open_text') {
      setFormData({ ...formData, question_type: newType, options: [] });
    } else {
      setFormData({ ...formData, question_type: newType, options: formData.options.length > 0 ? formData.options : [''] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.question_text.trim()) {
      toast.error('Digite a pergunta');
      return;
    }

    // Para múltipla escolha, precisa de pelo menos 2 opções
    if (formData.question_type === 'multiple_choice' && formData.options.filter(o => o.trim()).length < 2) {
      toast.error('Adicione pelo menos 2 opções');
      return;
    }

    // Determinar opções a salvar
    let optionsToSave: string[] | undefined;
    if (formData.question_type === 'open_text') {
      optionsToSave = undefined;
    } else if (formData.question_type === 'yes_no') {
      optionsToSave = ['Sim', 'Não']; // Sempre fixo
    } else {
      optionsToSave = formData.options.filter(o => o.trim());
    }

    onSave({
      id: question?.id,
      question_text: formData.question_text,
      question_type: formData.question_type,
      options: optionsToSave,
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
          onValueChange={(value: QuestionType) => handleTypeChange(value)}
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

      {/* Só mostra opções para múltipla escolha - yes_no já tem opções fixas */}
      {formData.question_type === 'multiple_choice' && (
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

      {/* Mostra opções fixas para yes_no (somente visualização) */}
      {formData.question_type === 'yes_no' && (
        <div className="space-y-2">
          <Label>Opções (fixas)</Label>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-sm">Sim</Badge>
            <Badge variant="secondary" className="text-sm">Não</Badge>
          </div>
          <p className="text-xs text-muted-foreground">As opções Sim/Não são fixas para este tipo de pergunta.</p>
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
