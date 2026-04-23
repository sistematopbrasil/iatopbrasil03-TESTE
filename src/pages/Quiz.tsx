import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getQuizDataBySlug } from '@/lib/organization-service';
import { QuizContainer } from '@/components/quiz/QuizContainer';
import { Loader2 } from 'lucide-react';

export default function QuizPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: quizData, isLoading } = useQuery({
    queryKey: ['quiz-data', slug],
    queryFn: () => getQuizDataBySlug(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando quiz...</p>
        </div>
      </div>
    );
  }

  if (!quizData?.organization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">😕</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Quiz não encontrado
          </h1>
          <p className="text-muted-foreground mb-6">
            O link que você acessou não é válido ou está temporariamente inativo.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Voltar para o início
          </a>
        </div>
      </div>
    );
  }

  // Gate: o quiz pode estar desativado para o funil que ele alimenta
  if (quizData.consultant) {
    const funnel = quizData.consultant.quiz_funnel_type || 'consultor';
    const enabled = funnel === 'associado'
      ? (quizData.consultant.quiz_enabled_associado ?? false)
      : (quizData.consultant.quiz_enabled_consultor ?? true);

    if (!enabled) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⏸️</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Quiz indisponível
            </h1>
            <p className="text-muted-foreground mb-6">
              Este quiz está temporariamente desativado. Entre em contato pelo WhatsApp para mais informações.
            </p>
          </div>
        </div>
      );
    }
  }

  return (
    <QuizContainer
      organization={quizData.organization}
      config={quizData.config}
      consultantId={quizData.consultant?.id}
    />
  );
}
