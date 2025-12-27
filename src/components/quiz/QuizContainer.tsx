import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { useTracking } from "@/hooks/useTracking";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { 
  saveTrackingSession, 
  linkTrackingToSubmission, 
  getDefaultOrganization 
} from "@/lib/tracking-service";
import { calculateLeadScore, mapQuizDataToScoring } from "@/lib/lead-scoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import logoTopBrasil from "@/assets/logo-top-brasil.png";
import logoIcon from "@/assets/logo-icon.png";
import type { Organization, QuizConfig } from "@/lib/organization-service";

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  order_index: number;
}

interface QuizContainerProps {
  organization?: Organization | null;
  config?: QuizConfig | null;
  consultantId?: string;
}

export const QuizContainer = ({ organization, config, consultantId: propConsultantId }: QuizContainerProps = {}) => {
  const { slug } = useParams<{ slug: string }>();
  // Otimização: não buscar IP no quiz (evita atraso de rede no carregamento)
  const { trackingData, getSessionId } = useTracking({ fetchIP: false });

  // Pixel será inicializado após carregar o consultor (ver useEffect abaixo)

  // Step: -1 = welcome, 0+ = question index
  const [currentStep, setCurrentStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [organizationId, setOrganizationId] = useState<string | null>(organization?.id || null);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Ref para evitar criação duplicada de leads
  const isCreatingLead = useRef(false);
  const leadIdRef = useRef<string | null>(null);

  // Fetch consultant by slug - cache curto para refletir mudanças rápidas
  const { data: consultant, isLoading: loadingConsultant, refetch: refetchConsultant } = useQuery({
    queryKey: ["consultant-by-slug", slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from("users")
        .select(
          "id, full_name, organization_id, quiz_slug, whatsapp_button_url, quiz_cover_image, quiz_image_position, quiz_image_size, quiz_image_shape, pixel_id"
        )
        .eq("quiz_slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    staleTime: 30 * 1000, // 30 segundos - cache curto para refletir mudanças
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnMount: 'always', // Sempre refetch ao montar
    refetchOnWindowFocus: true, // Refetch ao voltar para a aba
  });

  // Escutar atualizações de outras abas (quando admin salva configurações)
  useEffect(() => {
    if (!slug) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `consultant-updated:${slug}` && e.newValue) {
        console.log('🔄 Detectada atualização do consultor, recarregando dados...');
        refetchConsultant();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [slug, refetchConsultant]);

  // Inicializar Meta Pixel do consultor (só quando carregado)
  const { trackEvent } = useMetaPixel({ pixelId: consultant?.pixel_id || undefined });

  // Fetch ALL questions for the consultant - com cache
  const { data: questions, isLoading: loadingQuestions } = useQuery({
    queryKey: ["quiz-questions-public", consultant?.id],
    queryFn: async () => {
      if (!consultant?.id) return [];

      const { data, error } = await supabase
        .from("quiz_questions")
        .select("id, question_text, question_type, options, order_index")
        .eq("consultant_id", consultant.id)
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return (data || []) as QuizQuestion[];
    },
    enabled: !!consultant?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Estado para verificar se tudo está pronto para iniciar
  const isReady = !loadingConsultant && !loadingQuestions && !!consultant && (questions?.length ?? 0) > 0;

  // Disparar evento Lead do Meta Pixel quando quiz for completado
  useEffect(() => {
    if (isComplete && consultant?.pixel_id) {
      trackEvent('Lead');
    }
  }, [isComplete, consultant?.pixel_id, trackEvent]);

  // Initialize organization
  useEffect(() => {
    const init = async () => {
      if (consultant?.organization_id) {
        setOrganizationId(consultant.organization_id);
      } else if (organization?.id) {
        setOrganizationId(organization.id);
      } else {
        const orgId = await getDefaultOrganization();
        if (orgId) setOrganizationId(orgId);
      }

      // Recuperar lead em progresso se existir
      const savedLeadId = sessionStorage.getItem("quiz_lead_id");
      if (savedLeadId) {
        leadIdRef.current = savedLeadId;
        setCurrentLeadId(savedLeadId);
      }
    };
    init();
  }, [consultant?.organization_id, organization?.id]);

  // Save tracking on start
  const saveTracking = useCallback(async () => {
    if (!trackingData || !organizationId) return;
    try {
      await saveTrackingSession(organizationId, trackingData);
    } catch (error) {
      console.error("Error saving tracking:", error);
    }
  }, [trackingData, organizationId]);

  // Calculate score from answers
  const calculateScoreFromAnswers = useCallback(() => {
    const quizDataMapped: Record<number, string> = {};

    questions?.forEach((q) => {
      const answer = answers[q.id];
      if (answer) {
        quizDataMapped[q.order_index] = answer;
      }
    });

    const quizAnswers = mapQuizDataToScoring(quizDataMapped);
    return calculateLeadScore(quizAnswers);
  }, [answers, questions]);

  // CRIAR LEAD ao responder pergunta 1 (nome)
  const createLeadWithName = async (name: string) => {
    if (isCreatingLead.current || leadIdRef.current) {
      return leadIdRef.current;
    }

    // IMPORTANTE: Usar diretamente consultant.organization_id para evitar race condition
    const orgId = consultant?.organization_id || organizationId;

    if (!orgId) {
      console.error("Organization ID not available - consultant:", consultant);
      toast.error("Erro: consultor não encontrado. Recarregue a página.");
      return null;
    }

    isCreatingLead.current = true;
    const sessionId = getSessionId();

    try {
      // Otimização: pegar estágio default via função do backend (evita query extra)
      const { data: defaultStageId, error: stageError } = await supabase.rpc('get_default_pipeline_stage_id', {
        org_id: orgId,
      });
      if (stageError) {
        console.warn('Erro ao obter estágio default:', stageError);
      }

      const leadId = uuidv4();

      const submissionData = {
        id: leadId,
        organization_id: orgId,
        consultant_id: consultant?.id || propConsultantId || null,
        name,
        lead_score: 0,
        temperature: 'cold' as const,
        stage: "novo" as const,
        pipeline_stage_id: defaultStageId || null,
        completion_percentage: 7,
        session_id: sessionId,
        utm_source: trackingData?.utm_source || null,
        utm_medium: trackingData?.utm_medium || null,
        utm_campaign: trackingData?.utm_campaign || null,
        utm_content: trackingData?.utm_content || null,
        utm_term: trackingData?.utm_term || null,
        referrer: trackingData?.referrer || null,
        landing_page: trackingData?.landing_page || null,
        device_type: trackingData?.device_type || null,
        browser: trackingData?.browser || null,
        os: trackingData?.os || null,
        ip_address: trackingData?.ip_address || null,
        user_agent: trackingData?.user_agent || navigator.userAgent,
      };

      // IMPORTANTE: não pedir retorno (RETURNING/SELECT) aqui, pois o RLS de SELECT
      // pode bloquear o retorno mesmo com INSERT público.
      const { error } = await supabase
        .from("quiz_submissions_new")
        .insert(submissionData);

      if (error) {
        console.error("Erro ao criar lead:", error);
        toast.error(`Não foi possível iniciar o quiz: ${error.message}`);
        return null;
      }

      sessionStorage.setItem("quiz_lead_id", leadId);
      leadIdRef.current = leadId;
      setCurrentLeadId(leadId);

      // Não bloquear UX por causa do tracking
      void linkTrackingToSubmission(sessionId, leadId);

      return leadId;
    } catch (err) {
      console.error("Erro ao criar lead:", err);
      toast.error("Não foi possível iniciar o quiz. Tente novamente.");
      return null;
    } finally {
      isCreatingLead.current = false;
    }
  };

  // ATUALIZAR LEAD a cada resposta - NON-BLOCKING (fire-and-forget)
  // Não bloqueia a UI esperando o update, melhora a responsividade em redes lentas
  const updateLeadProgress = useCallback((questionOrderIndex: number, questionId: string, questionText: string, value: string) => {
    const leadId = currentLeadId || leadIdRef.current;
    if (!leadId) return;

    const totalQuestions = questions?.length || 14;
    // Se for a última pergunta, já considerar 100%
    const isLastQuestion = questionOrderIndex >= totalQuestions;
    const progressPercentage = isLastQuestion ? 100 : Math.round((questionOrderIndex / totalQuestions) * 99);

    const updateData: Record<string, unknown> = {
      completion_percentage: progressPercentage,
      updated_at: new Date().toISOString(),
    };

    // Map answer to correct field for standard questions (order_index 1-14)
    switch (questionOrderIndex) {
      case 1:
        updateData.name = value;
        break;
      case 2:
        updateData.phone = value;
        break;
      case 3:
        const age = parseInt(value);
        if (!isNaN(age)) updateData.age = age;
        break;
      case 4:
        updateData.relationship_status = value;
        break;
      case 5:
        updateData.location = value;
        break;
      case 6:
        updateData.has_vehicle = value;
        break;
      case 7:
        updateData.has_driver_license = value;
        break;
      case 8:
        updateData.employment_status = value;
        break;
      case 9:
        updateData.current_job = value;
        break;
      case 10:
        updateData.sales_experience = value;
        break;
      case 11:
        updateData.vehicle_protection_experience = value;
        break;
      case 12:
        updateData.current_income = value;
        break;
      case 13:
        updateData.desired_income = value;
        break;
      case 14:
        updateData.motivation = value;
        break;
      default:
        // Para perguntas extras (order_index > 14), salvar em extra_answers
        if (questionOrderIndex > 14) {
          // Fire-and-forget para extras também
          (async () => {
            try {
              const { data: currentLead } = await supabase
                .from("quiz_submissions_new")
                .select("extra_answers")
                .eq("id", leadId)
                .single();

              const currentExtras = (currentLead?.extra_answers as Record<string, any>) || {};
              
              currentExtras[questionId] = {
                question: questionText,
                answer: value,
                order_index: questionOrderIndex
              };

              await supabase
                .from("quiz_submissions_new")
                .update({ 
                  extra_answers: currentExtras,
                  completion_percentage: progressPercentage,
                  updated_at: new Date().toISOString()
                })
                .eq("id", leadId);
            } catch (err) {
              console.error("Erro ao atualizar extra_answers:", err);
            }
          })();
          return; // Retorna cedo, já tratamos extras acima
        }
        break;
    }

    // Fire-and-forget: não bloquear a UI esperando a resposta
    supabase
      .from("quiz_submissions_new")
      .update(updateData)
      .eq("id", leadId)
      .then(({ error }) => {
        if (error) console.error("Erro ao atualizar lead:", error);
      });
  }, [currentLeadId, questions?.length]);

  // FINALIZAR LEAD - Usa dados locais para evitar problemas de RLS
  const finalizeLead = async () => {
    const leadId = currentLeadId || leadIdRef.current;
    if (!leadId) return false;

    try {
      // Importar função para calcular temperatura
      const { calculateTemperatureFromDbData } = await import("@/lib/lead-scoring");
      
      // Usar dados das respostas locais (answers) para calcular temperatura
      // Isso evita problemas de RLS que impedem SELECT por usuários públicos
      const getAnswerByOrderIndex = (orderIndex: number): string | null => {
        const question = questions?.find(q => q.order_index === orderIndex);
        if (!question) return null;
        return answers[question.id] || null;
      };

      const temperature = calculateTemperatureFromDbData({
        completion_percentage: 100,
        vehicle_protection_experience: getAnswerByOrderIndex(11), // pergunta 11
        relationship_status: getAnswerByOrderIndex(4), // pergunta 4
        has_vehicle: getAnswerByOrderIndex(6), // pergunta 6
        has_driver_license: getAnswerByOrderIndex(7), // pergunta 7
        sales_experience: getAnswerByOrderIndex(10), // pergunta 10
      });

      // Calcular score
      const scoreResult = calculateScoreFromAnswers();

      console.log("🔵 Finalizando lead:", {
        leadId,
        temperature,
        score: scoreResult.total_score,
      });

      // IMPORTANTE: não usar .select() após UPDATE - RLS de SELECT bloqueia usuários públicos
      const { error } = await supabase
        .from("quiz_submissions_new")
        .update({
          lead_score: scoreResult.total_score,
          temperature: temperature,
          completion_percentage: 100,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (error) {
        console.error("❌ Erro ao finalizar lead:", error);
        // Se falhar por tempo (>2h), ainda consideramos sucesso pois os dados foram salvos durante o quiz
        if (error.message?.includes('row-level security')) {
          console.warn("⚠️ RLS bloqueou UPDATE final, mas dados já foram salvos durante o quiz");
          sessionStorage.removeItem("quiz_lead_id");
          leadIdRef.current = null;
          return true; // Considerar sucesso parcial
        }
        return false;
      }

      console.log("✅ Lead finalizado com sucesso");
      sessionStorage.removeItem("quiz_lead_id");
      leadIdRef.current = null;
      return true;
    } catch (err) {
      console.error("Erro ao finalizar lead:", err);
      return false;
    }
  };

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const success = await finalizeLead();
      if (!success) throw new Error("Erro ao finalizar lead");
      return { success: true };
    },
    onSuccess: () => {
      setIsComplete(true);
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Lead");
      }
    },
    onError: (error) => {
      console.error("Error submitting quiz:", error);
      toast.error("Erro ao enviar quiz. Tente novamente.");
    },
  });

  // Handlers
  const handleStartQuiz = async () => {
    // Verificar se dados estão prontos antes de iniciar
    if (!consultant?.organization_id) {
      toast.error("Carregando dados... Aguarde um momento.");
      return;
    }
    await saveTracking();
    setCurrentStep(0);
  };

  const handleAnswer = async (value: string) => {
    const currentQuestion = questions?.[currentStep];
    if (!currentQuestion) return;

    // Validar campo obrigatório
    if (!value.trim()) {
      toast.error("Por favor, responda esta pergunta para continuar.");
      return;
    }

    // Validar telefone na pergunta 2
    if (currentQuestion.order_index === 2) {
      const cleanPhone = value.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        toast.error("Por favor, insira um telefone válido com DDD.");
        return;
      }
    }

    // Salvar resposta
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);
    setInputValue("");

    // Se for pergunta 1 (nome), criar lead
    if (currentQuestion.order_index === 1 && !leadIdRef.current) {
      const leadId = await createLeadWithName(value);
      if (!leadId) {
        toast.error("Erro ao iniciar quiz. Tente novamente.");
        return;
      }
    } else {
      // Atualizar lead com a resposta - fire-and-forget (não bloqueia UI)
      updateLeadProgress(currentQuestion.order_index, currentQuestion.id, currentQuestion.question_text, value);
    }

    // Próxima pergunta ou finalizar
    if (currentStep < (questions?.length || 0) - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      submitMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      const prevQuestion = questions?.[currentStep - 1];
      if (prevQuestion) {
        setInputValue(answers[prevQuestion.id] || "");
      }
    } else if (currentStep === 0) {
      setCurrentStep(-1);
    }
  };

  const handleChoiceClick = (option: string) => {
    handleAnswer(option);
  };

  const handleWhatsAppClick = () => {
    const raw = (consultant?.whatsapp_button_url || "").trim();

    // Se for URL (mesmo sem https://), abrir diretamente
    if (raw) {
      const hasScheme = /^https?:\/\//i.test(raw);
      const looksLikeUrl = /[a-zA-Z]/.test(raw) && (raw.includes(".") || raw.includes("/"));

      if (hasScheme) {
        window.open(raw, "_blank");
        return;
      }

      if (looksLikeUrl) {
        window.open(`https://${raw.replace(/^\/+/, "")}`, "_blank");
        return;
      }
    }

    // Caso contrário, tratar como telefone e abrir WhatsApp
    const fallbackPhone = "5531996308591";
    const digits = (raw || fallbackPhone).replace(/\D/g, "");
    const phone = digits.startsWith("55")
      ? digits
      : digits.length === 10 || digits.length === 11
        ? `55${digits}`
        : fallbackPhone;

    const message = encodeURIComponent(
      "Olá! Acabei de completar o quiz de perfil. Gostaria de saber mais sobre ser consultor TOP Brasil."
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const isLoading = loadingConsultant || loadingQuestions;
  const totalQuestions = questions?.length || 14;
  const currentQuestion = currentStep >= 0 ? questions?.[currentStep] : null;
  const progress = currentStep >= 0 ? ((currentStep + 1) / totalQuestions) * 100 : 0;

  // Determine logo
  const logoUrl = config?.custom_logo_url || organization?.logo_url || logoTopBrasil;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#EB6608] mx-auto mb-4" />
          <p className="text-gray-400">Carregando quiz...</p>
        </div>
      </div>
    );
  }

  // Quiz not found
  if (slug && (!consultant || !questions || questions.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0D0D0D]">
        <div className="text-center max-w-md bg-[#1A1A1A] p-8 rounded-2xl border border-[#EB6608]/20">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Quiz não encontrado
          </h1>
          <p className="text-gray-400">
            Verifique o link e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  // ============ SUCCESS SCREEN ============
  if (isComplete) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#EB6608]/10 via-transparent to-transparent"></div>

        <div className="w-full max-w-2xl relative z-10">
          {/* Success Icon with Glow */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-[#EB6608] rounded-full blur-2xl opacity-50 animate-pulse"></div>
              <CheckCircle className="h-20 w-20 text-[#EB6608] relative z-10" />
            </div>
          </div>

          {/* Content Card */}
          <div className="bg-[#1A1A1A] border border-[#EB6608]/20 rounded-3xl p-8 md:p-12 shadow-2xl shadow-[#EB6608]/10 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src={logoUrl} alt="TOP Brasil" className="h-16 w-auto" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Obrigado Por Participar!
            </h1>

            <p className="text-lg text-gray-400 mb-8">
              Sua avaliação foi concluída com sucesso.
            </p>

            {/* WhatsApp Button */}
            <Button
              size="lg"
              onClick={handleWhatsAppClick}
              className="w-full text-lg py-6 bg-[#EB6608] hover:bg-[#EB6608]/90 text-white shadow-lg shadow-[#EB6608]/30"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Falar com um Consultor Agora
            </Button>

            <p className="text-sm text-gray-500 mt-6">
              Dúvidas? Entre em contato através do WhatsApp
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ WELCOME SCREEN ============
  if (currentStep === -1) {
    // Image customization classes
    const imageSizeClasses: Record<string, string> = {
      small: 'max-w-[200px]',
      medium: 'max-w-[300px]',
      large: 'max-w-[400px]',
    };
    const imageShapeClasses: Record<string, string> = {
      rounded: 'rounded-3xl',
      circle: 'rounded-full aspect-square object-cover',
      square: 'rounded-none',
    };
    const imagePosition = (consultant as any)?.quiz_image_position || 'center';
    const imageSize = (consultant as any)?.quiz_image_size || 'medium';
    const imageShape = (consultant as any)?.quiz_image_shape || 'rounded';

    // Shadow classes that match the image shape
    const shadowShapeClasses: Record<string, string> = {
      rounded: 'rounded-3xl',
      circle: 'rounded-full',
      square: 'rounded-lg',
    };

    const ConsultantImage = () => {
      const sizeClass = imageSizeClasses[imageSize] || imageSizeClasses.medium;
      const shapeClass = imageShapeClasses[imageShape] || imageShapeClasses.rounded;
      const shadowShapeClass = shadowShapeClasses[imageShape] || shadowShapeClasses.rounded;

      return (
        <div className="mb-8 flex justify-center">
          <div className="relative group">
            {consultant?.quiz_cover_image ? (
              <>
                {/* Shadow container - same shape as image */}
                <div 
                  className={`absolute inset-0 bg-[#EB6608] opacity-40 blur-2xl group-hover:opacity-50 transition duration-500 ${shadowShapeClass}`}
                  style={{ transform: 'scale(1.1)' }}
                ></div>
                {/* Image container */}
                <div className={`relative overflow-hidden border-2 border-[#EB6608]/30 ${sizeClass} ${shapeClass}`}>
                  <img 
                    src={consultant.quiz_cover_image} 
                    alt={consultant.full_name || "Consultor TOP Brasil"} 
                    className={`w-full h-full object-cover ${imageShape === 'circle' ? 'aspect-square' : ''}`}
                    onError={(e) => {
                      console.error('Erro ao carregar imagem:', consultant.quiz_cover_image);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </>
            ) : (
              <div className={`relative overflow-hidden bg-[#2A2A2A] border-2 border-[#EB6608]/30 h-48 flex items-center justify-center ${sizeClass} ${shapeClass}`}>
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-[#EB6608]/20 flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <span className="text-gray-400 text-sm">{consultant?.full_name || 'Consultor TOP Brasil'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#EB6608]/10 via-transparent to-transparent"></div>
        
        <div className="w-full max-w-3xl relative z-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src={logoUrl} 
              alt="TOP Brasil" 
              className="h-20 w-auto"
            />
          </div>

          {/* Main Content Card */}
          <div className="bg-[#1A1A1A] border border-[#EB6608]/20 rounded-3xl p-8 md:p-12 shadow-2xl shadow-[#EB6608]/10">
            
            {/* Image at top position */}
            {imagePosition === 'top' && <ConsultantImage />}
            
            {/* Headline */}
            <h1 className="text-3xl md:text-4xl font-bold text-center mb-4 text-white leading-tight">
              Você Tem o Perfil Para Ser um Consultor
              <span className="text-[#EB6608]"> TOP Brasil?</span>
            </h1>
            
            <p className="text-center text-lg text-gray-400 mb-8">
              Descubra em menos de 60 segundos se você tem o que é preciso para transformar sua carreira
            </p>

            {/* Image at center or bottom position */}
            {(imagePosition === 'center' || imagePosition === 'bottom') && <ConsultantImage />}

            {/* CTA Button */}
            <Button
              onClick={handleStartQuiz}
              size="lg"
              disabled={!isReady}
              className="w-full text-lg py-6 bg-[#EB6608] hover:bg-[#EB6608]/90 text-white shadow-lg shadow-[#EB6608]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isReady ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Começar Avaliação Agora'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============ QUESTION SCREEN ============
  if (!currentQuestion) return null;

  const isTextQuestion = currentQuestion.question_type === "open_text";
  const isChoiceQuestion = currentQuestion.question_type === "multiple_choice" || currentQuestion.question_type === "yes_no";

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col p-4 pt-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#EB6608]/5 via-transparent to-transparent"></div>

      <div className="w-full max-w-2xl mx-auto relative z-10 flex flex-col flex-1">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src={logoIcon} alt="TOP Brasil" className="h-10 w-auto" />
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">
              Pergunta {currentStep + 1} de {totalQuestions}
            </span>
            <span className="text-sm font-semibold text-[#EB6608]">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-[#2A2A2A]" />
        </div>

        {/* Question Card - altura dinâmica baseada no tipo */}
        <div className={`bg-[#1A1A1A] border border-[#EB6608]/20 rounded-3xl p-6 md:p-10 shadow-2xl shadow-[#EB6608]/10 flex flex-col ${
          isTextQuestion ? 'min-h-[280px]' : 'min-h-[400px]'
        }`}>
          {/* Question */}
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6 leading-tight">
            {currentQuestion.question_text}
          </h2>

          {/* Text Input */}
          {isTextQuestion && (
            <div className="mb-auto">
              {currentQuestion.order_index === 2 ? (
                // Phone input with mask
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={inputValue}
                  onChange={(e) => {
                    // Only allow numbers
                    const onlyNumbers = e.target.value.replace(/\D/g, '');
                    // Format phone: (XX) XXXXX-XXXX
                    let formatted = onlyNumbers;
                    if (onlyNumbers.length > 0) {
                      formatted = `(${onlyNumbers.slice(0, 2)}`;
                      if (onlyNumbers.length > 2) {
                        formatted += `) ${onlyNumbers.slice(2, 7)}`;
                      }
                      if (onlyNumbers.length > 7) {
                        formatted += `-${onlyNumbers.slice(7, 11)}`;
                      }
                    }
                    setInputValue(formatted);
                  }}
                  placeholder="(00) 00000-0000"
                  maxLength={16}
                  className="text-lg p-5 bg-[#0D0D0D] border-[#EB6608]/30 text-white placeholder:text-gray-500 focus:border-[#EB6608] focus:ring-[#EB6608]/20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAnswer(inputValue);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Digite sua resposta..."
                  className="text-lg p-5 bg-[#0D0D0D] border-[#EB6608]/30 text-white placeholder:text-gray-500 focus:border-[#EB6608] focus:ring-[#EB6608]/20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAnswer(inputValue);
                    }
                  }}
                  autoFocus
                />
              )}
            </div>
          )}

          {/* Choice Options */}
          {isChoiceQuestion && currentQuestion.options && (
            <div className="space-y-2 mb-auto">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(option)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    answers[currentQuestion.id] === option
                      ? "border-[#EB6608] bg-[#EB6608]/10 text-white"
                      : "border-[#2A2A2A] hover:border-[#EB6608]/50 text-gray-300 hover:text-white hover:bg-[#2A2A2A]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Yes/No without options field */}
          {currentQuestion.question_type === "yes_no" && !currentQuestion.options && (
            <div className="grid grid-cols-2 gap-4 mb-auto">
              <button
                onClick={() => handleChoiceClick("Sim")}
                className={`p-4 rounded-xl border-2 transition-all duration-200 font-medium ${
                  answers[currentQuestion.id] === "Sim"
                    ? "border-[#EB6608] bg-[#EB6608]/10 text-white"
                    : "border-[#2A2A2A] hover:border-[#EB6608]/50 text-gray-300 hover:text-white hover:bg-[#2A2A2A]"
                }`}
              >
                Sim
              </button>
              <button
                onClick={() => handleChoiceClick("Não")}
                className={`p-4 rounded-xl border-2 transition-all duration-200 font-medium ${
                  answers[currentQuestion.id] === "Não"
                    ? "border-[#EB6608] bg-[#EB6608]/10 text-white"
                    : "border-[#2A2A2A] hover:border-[#EB6608]/50 text-gray-300 hover:text-white hover:bg-[#2A2A2A]"
                }`}
              >
                Não
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-4">
            {isTextQuestion && (
              <Button
                onClick={() => handleAnswer(inputValue)}
                disabled={!inputValue.trim() || submitMutation.isPending}
                className="flex-1 bg-[#EB6608] hover:bg-[#EB6608]/90 text-white disabled:opacity-50"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : currentStep === totalQuestions - 1 ? (
                  "Finalizar"
                ) : (
                  <>
                    Próxima
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
