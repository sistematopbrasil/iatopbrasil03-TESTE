import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTracking } from "@/hooks/useTracking";
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
  const { trackingData, getSessionId } = useTracking();

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

  // Fetch consultant by slug
  const { data: consultant, isLoading: loadingConsultant } = useQuery({
    queryKey: ["consultant-by-slug", slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, organization_id, quiz_slug, whatsapp_button_url, quiz_cover_image, quiz_image_position, quiz_image_size, quiz_image_shape")
        .eq("quiz_slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch ALL questions for the consultant (order_index 1-14)
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
  });

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
    
    let orgId = organizationId;
    if (!orgId && consultant?.organization_id) {
      orgId = consultant.organization_id;
    }
    
    if (!orgId) {
      console.error("Organization ID not available");
      return null;
    }

    isCreatingLead.current = true;
    const sessionId = getSessionId();
    
    try {
      // Buscar o primeiro estágio do pipeline para auto-assign
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', orgId)
        .order('order_index', { ascending: true })
        .limit(1);

      const firstStageId = stages?.[0]?.id || null;

      const submissionData = {
        organization_id: orgId,
        consultant_id: consultant?.id || propConsultantId || null,
        name,
        lead_score: 0,
        temperature: 'cold' as const,
        stage: "novo" as const,
        pipeline_stage_id: firstStageId, // Auto-assign to first stage
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

      const { data, error } = await supabase
        .from("quiz_submissions_new")
        .insert(submissionData)
        .select("id")
        .single();

      if (error) {
        console.error("Erro ao criar lead:", error);
        isCreatingLead.current = false;
        return null;
      }

      sessionStorage.setItem("quiz_lead_id", data.id);
      leadIdRef.current = data.id;
      setCurrentLeadId(data.id);
      
      if (data.id) {
        await linkTrackingToSubmission(sessionId, data.id);
      }

      isCreatingLead.current = false;
      return data.id;
    } catch (err) {
      console.error("Erro ao criar lead:", err);
      isCreatingLead.current = false;
      return null;
    }
  };

  // ATUALIZAR LEAD a cada resposta
  const updateLeadProgress = async (questionOrderIndex: number, value: string) => {
    const leadId = currentLeadId || leadIdRef.current;
    if (!leadId) return;

    const totalQuestions = questions?.length || 14;
    const progressPercentage = Math.round((questionOrderIndex / totalQuestions) * 99);

    const updateData: Record<string, unknown> = {
      completion_percentage: progressPercentage,
      updated_at: new Date().toISOString(),
    };

    // Map answer to correct field
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
    }

    try {
      await supabase
        .from("quiz_submissions_new")
        .update(updateData)
        .eq("id", leadId);
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
    }
  };

  // FINALIZAR LEAD - Buscar dados reais do banco para calcular temperatura correta
  const finalizeLead = async () => {
    const leadId = currentLeadId || leadIdRef.current;
    if (!leadId) return false;

    try {
      // IMPORTANTE: Buscar os dados REAIS do lead no banco para calcular a temperatura
      const { data: currentLead, error: fetchError } = await supabase
        .from("quiz_submissions_new")
        .select("*")
        .eq("id", leadId)
        .single();

      if (fetchError || !currentLead) {
        console.error("Erro ao buscar dados do lead:", fetchError);
        return false;
      }

      // Importar função para calcular temperatura com dados do banco
      const { calculateTemperatureFromDbData, calculateLeadScore: calcScore, mapQuizDataToScoring: mapData } = await import("@/lib/lead-scoring");
      
      // Calcular temperatura usando dados REAIS do banco (não do state local)
      const temperature = calculateTemperatureFromDbData({
        completion_percentage: 100,
        vehicle_protection_experience: currentLead.vehicle_protection_experience,
        relationship_status: currentLead.relationship_status,
        has_vehicle: currentLead.has_vehicle,
        has_driver_license: currentLead.has_driver_license,
        sales_experience: currentLead.sales_experience,
      });

      // Calcular score também
      const scoreResult = calculateScoreFromAnswers();

      console.log("🔵 Finalizando lead:", {
        leadId,
        temperature,
        score: scoreResult.total_score,
        vehicleProtection: currentLead.vehicle_protection_experience,
        relationshipStatus: currentLead.relationship_status,
        hasVehicle: currentLead.has_vehicle,
        hasCNH: currentLead.has_driver_license,
        salesExp: currentLead.sales_experience,
      });

      console.log("🔵 [UPDATE] Tentando atualizar lead:", {
        leadId,
        temperature,
        score: scoreResult.total_score,
      });

      const { data: updatedData, error } = await supabase
        .from("quiz_submissions_new")
        .update({
          lead_score: scoreResult.total_score,
          temperature: temperature, // Usar temperatura calculada com dados reais
          completion_percentage: 100,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .select('id, temperature, lead_score');

      if (error) {
        console.error("❌ [UPDATE] Erro ao finalizar lead:", error);
        console.error("❌ [UPDATE] Detalhes do erro:", JSON.stringify(error, null, 2));
        return false;
      }

      console.log("✅ [UPDATE] Lead atualizado com sucesso:", updatedData);
      console.log("✅ Lead finalizado com temperatura:", temperature);

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
      // Atualizar lead com a resposta
      await updateLeadProgress(currentQuestion.order_index, value);
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
    const phone = consultant?.whatsapp_button_url || "5531996308591";
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent("Olá! Acabei de completar o quiz de perfil. Gostaria de saber mais sobre ser consultor TOP Brasil.");
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
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
              className="w-full text-lg py-6 bg-[#EB6608] hover:bg-[#EB6608]/90 text-white shadow-lg shadow-[#EB6608]/30"
            >
              Começar Avaliação Agora
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
            <Button
              variant="outline"
              onClick={handleBack}
              className="px-6 border-[#2A2A2A] text-gray-300 hover:text-white hover:bg-[#2A2A2A] hover:border-[#EB6608]/50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            
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
