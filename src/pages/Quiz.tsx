import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrganizationBySlug, getOrganizationById, getQuizConfig, getConsultantBySlug } from '@/lib/organization-service';
import { QuizContainer } from '@/components/quiz/QuizContainer';
import { Loader2 } from 'lucide-react';

export default function QuizPage() {
  const { slug } = useParams<{ slug: string }>();

  // Primeiro, tentar buscar como consultor (novo sistema)
  const { data: consultant, isLoading: loadingConsultant } = useQuery({
    queryKey: ['consultant', slug],
    queryFn: () => getConsultantBySlug(slug!),
    enabled: !!slug,
    retry: false,
  });

  // Se não encontrou consultor, buscar como organização (sistema legado)
  const { data: organizationBySlug, isLoading: loadingOrgBySlug } = useQuery({
    queryKey: ['organization-slug', slug],
    queryFn: () => getOrganizationBySlug(slug!),
    enabled: !!slug && !consultant,
    retry: false,
  });

  // Se encontrou consultor, buscar a organização dele
  const { data: organizationById, isLoading: loadingOrgById } = useQuery({
    queryKey: ['organization-id', consultant?.organization_id],
    queryFn: () => getOrganizationById(consultant!.organization_id),
    enabled: !!consultant?.organization_id,
    retry: false,
  });

  // Determinar qual organização usar
  const organization = consultant ? organizationById : organizationBySlug;

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['quiz-config', organization?.id],
    queryFn: () => getQuizConfig(organization!.id),
    enabled: !!organization?.id,
    retry: false,
  });

  // Loading state
  const isLoading = loadingConsultant || loadingOrgBySlug || loadingOrgById || (organization && loadingConfig);
  
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

  // Organização não encontrada ou inativa
  if (!organization) {
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

  // Renderizar quiz personalizado
  return (
    <QuizContainer
      organization={organization}
      config={config}
      consultantId={consultant?.id}
    />
  );
}
