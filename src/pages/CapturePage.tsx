import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, User, Mail, Phone, Shield, Check, Lock } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const captureSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().trim().email('Email inválido').max(255),
  phone: z.string().trim().min(10, 'Telefone inválido').max(20),
});

interface CaptureConfig {
  title: string;
  subtitle: string;
  button_text: string;
  button_color: string;
  hero_image: string | null;
  hero_image_size: string;
  hero_image_position: string;
  hero_image_shape: string;
  redirect_type: string;
  redirect_url: string | null;
  whatsapp_message: string;
  whatsapp_number: string | null;
}

interface ConsultantData {
  id: string;
  full_name: string;
  organization_id: string;
  whatsapp_button_url: string | null;
}

const DEFAULT_CONFIG: CaptureConfig = {
  title: 'Descubra uma oportunidade única!',
  subtitle: 'Preencha seus dados e saiba como começar.',
  button_text: 'Quero saber mais!',
  button_color: '#EB6608',
  hero_image: null,
  hero_image_size: 'medium',
  hero_image_position: 'top',
  hero_image_shape: 'rounded',
  redirect_type: 'thank_you',
  redirect_url: null,
  whatsapp_message: 'Olá! Vim pela página de captura e quero saber mais.',
  whatsapp_number: null,
};

/* ─── Animated Check ─── */
function AnimatedCheck() {
  return (
    <div className="w-24 h-24 mx-auto rounded-full bg-green-500/20 flex items-center justify-center animate-[scale-in_0.5s_ease-out]">
      <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-green-400 animate-[fade-in_0.3s_0.3s_ease-out_both]" />
      </div>
    </div>
  );
}

/* ─── Thank You Page ─── */
function ThankYouPage({ config, form }: { config: CaptureConfig; form: { name: string } }) {
  const firstName = form.name.split(' ')[0];

  if (config.redirect_type === 'url' && config.redirect_url) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md animate-[fade-in_0.6s_ease-out]">
          <AnimatedCheck />
          <h1 className="text-3xl font-bold text-white">Obrigado, {firstName}!</h1>
          <p className="text-gray-400 text-lg">Enquanto aguarda nosso contato, confira o link abaixo:</p>
          <a href={config.redirect_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            style={{ backgroundColor: config.button_color, boxShadow: `0 8px 30px ${config.button_color}40` }}>
            Acessar agora
          </a>
        </div>
      </div>
    );
  }

  if (config.redirect_type === 'whatsapp' && config.whatsapp_number) {
    const phone = config.whatsapp_number.replace(/\D/g, '');
    const message = encodeURIComponent(config.whatsapp_message);
    const whatsappLink = `https://wa.me/${phone}?text=${message}`;
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md animate-[fade-in_0.6s_ease-out]">
          <AnimatedCheck />
          <h1 className="text-3xl font-bold text-white">Obrigado, {firstName}!</h1>
          <p className="text-gray-400 text-lg">Fale diretamente conosco pelo WhatsApp:</p>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            style={{ backgroundColor: '#25D366' }}>
            <Phone className="w-5 h-5" /> Falar no WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md animate-[fade-in_0.6s_ease-out]">
        <AnimatedCheck />
        <h1 className="text-3xl font-bold text-white">Obrigado, {firstName}!</h1>
        <p className="text-gray-400 text-lg">Seus dados foram enviados com sucesso. Nossa equipe entrará em contato em breve!</p>
      </div>
    </div>
  );
}

/* ─── Hero Image ─── */
function HeroImage({ config }: { config: CaptureConfig }) {
  if (!config.hero_image || config.hero_image_position === 'background') return null;

  const sizeMap: Record<string, string> = {
    small: 'w-20 h-20',
    medium: 'w-40 h-40',
    large: 'w-60 h-60',
    full: 'w-full h-auto max-h-64',
  };
  const shapeMap: Record<string, string> = {
    rounded: 'rounded-2xl',
    circle: 'rounded-full',
    square: 'rounded-none',
  };

  return (
    <div className={cn("flex", config.hero_image_position === 'left' ? 'justify-start' : 'justify-center')}>
      <img src={config.hero_image} alt="Hero"
        className={cn(
          "object-cover border-2 shadow-lg animate-[fade-in_0.8s_ease-out]",
          sizeMap[config.hero_image_size] || sizeMap.medium,
          shapeMap[config.hero_image_shape] || shapeMap.rounded,
        )}
        style={{ borderColor: `${config.button_color}30`, boxShadow: `0 8px 30px ${config.button_color}20` }}
      />
    </div>
  );
}

/* ─── Floating Orb ─── */
function FloatingOrb({ color, size, top, left, delay }: { color: string; size: number; top: string; left: string; delay: string }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        top, left,
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        animation: `float ${8 + Math.random() * 4}s ease-in-out ${delay} infinite alternate`,
      }}
    />
  );
}

/* ─── Main Page ─── */
export default function CapturePage() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<CaptureConfig>(DEFAULT_CONFIG);
  const [consultant, setConsultant] = useState<ConsultantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => { if (slug) loadData(); }, [slug]);

  const loadData = async () => {
    try {
      const { data: consultantRows } = await supabase.rpc('get_consultant_by_slug', { p_slug: slug });
      const consultantData = consultantRows?.[0];
      if (!consultantData) { setLoading(false); return; }
      setConsultant({
        id: consultantData.id, full_name: consultantData.full_name,
        organization_id: consultantData.organization_id,
        whatsapp_button_url: consultantData.whatsapp_button_url,
      });

      const { data: captureConfig } = await supabase
        .from('capture_page_configs').select('*')
        .eq('consultant_id', consultantData.id).eq('is_active', true).maybeSingle();

      if (captureConfig) {
        setConfig({
          title: captureConfig.title || DEFAULT_CONFIG.title,
          subtitle: captureConfig.subtitle || DEFAULT_CONFIG.subtitle,
          button_text: captureConfig.button_text || DEFAULT_CONFIG.button_text,
          button_color: captureConfig.button_color || DEFAULT_CONFIG.button_color,
          hero_image: captureConfig.hero_image,
          hero_image_size: captureConfig.hero_image_size || 'medium',
          hero_image_position: captureConfig.hero_image_position || 'top',
          hero_image_shape: captureConfig.hero_image_shape || 'rounded',
          redirect_type: captureConfig.redirect_type || 'thank_you',
          redirect_url: captureConfig.redirect_url,
          whatsapp_message: captureConfig.whatsapp_message || DEFAULT_CONFIG.whatsapp_message,
          whatsapp_number: captureConfig.whatsapp_number || null,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar página de captura:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const isFieldValid = (field: string) => {
    if (!touched[field]) return false;
    const value = form[field as keyof typeof form];
    if (field === 'name') return value.trim().length >= 2;
    if (field === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (field === 'phone') return value.replace(/\D/g, '').length >= 10;
    return false;
  };

  const validCount = useMemo(() =>
    ['name', 'email', 'phone'].filter(f => isFieldValid(f)).length
  , [form, touched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultant) return;
    const result = captureSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => { fieldErrors[issue.path[0] as string] = issue.message; });
      setErrors(fieldErrors);
      setTouched({ name: true, email: true, phone: true });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const phoneDigits = form.phone.replace(/\D/g, '');
      await supabase.from('quiz_submissions_new').insert({
        name: form.name.trim(), email: form.email.trim(), phone: phoneDigits,
        organization_id: consultant.organization_id, consultant_id: consultant.id,
        lead_source: 'capture', completion_percentage: 100,
        stage: 'novo', temperature: 'cold', lead_score: 0,
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Erro ao enviar:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#EB6608]" />
      </div>
    );
  }

  if (!consultant) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Página não encontrada</h1>
          <p className="text-gray-400">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (submitted) return <ThankYouPage config={config} form={form} />;

  const isBackground = config.hero_image_position === 'background' && config.hero_image;
  const isLeft = config.hero_image_position === 'left' && config.hero_image;
  const focusRingColor = config.button_color;

  const fields = [
    { key: 'name', icon: User, placeholder: 'Seu nome completo', type: 'text', maxLength: 100, step: 1 },
    { key: 'email', icon: Mail, placeholder: 'Seu melhor email', type: 'email', maxLength: 255, step: 2 },
    { key: 'phone', icon: Phone, placeholder: '(00) 00000-0000', type: 'tel', maxLength: 16, step: 3 },
  ];

  return (
    <div className="min-h-screen bg-[#0D0D0D] relative overflow-hidden">
      {/* CSS for float animation */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-30px) translateX(15px); }
          100% { transform: translateY(0px) translateX(0px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Background image mode */}
      {isBackground && (
        <div className="absolute inset-0">
          <img src={config.hero_image!} alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0D0D0D]/80 via-[#0D0D0D]/90 to-[#0D0D0D]" />
        </div>
      )}

      {/* Floating orbs */}
      <FloatingOrb color={config.button_color} size={500} top="-10%" left="-5%" delay="0s" />
      <FloatingOrb color={config.button_color} size={350} top="60%" left="75%" delay="2s" />
      <FloatingOrb color="#ffffff" size={200} top="30%" left="50%" delay="4s" />

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#EB6608]/5 via-transparent to-[#EB6608]/3" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className={cn("w-full max-w-md space-y-8", isLeft && "max-w-xl")}>
          
          {isLeft ? (
            <div className="flex gap-6 items-start">
              <HeroImage config={config} />
              <div className="flex-1 space-y-3 animate-[fade-in_0.6s_0.2s_ease-out_both]">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 leading-tight">
                  {config.title}
                </h1>
                <p className="text-gray-400 text-base sm:text-lg">{config.subtitle}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="animate-[fade-in_0.6s_ease-out]">
                <HeroImage config={config} />
              </div>
              <div className="text-center space-y-3 animate-[fade-in_0.6s_0.2s_ease-out_both]">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 leading-tight">
                  {config.title}
                </h1>
                <p className="text-gray-400 text-base sm:text-lg">{config.subtitle}</p>
              </div>
            </>
          )}

          {/* Progress indicator */}
          <div className="animate-[fade-in_0.6s_0.3s_ease-out_both]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">Progresso</span>
              <span className="text-xs font-semibold" style={{ color: config.button_color }}>{validCount}/3 campos</span>
            </div>
            <Progress value={(validCount / 3) * 100} className="h-1.5 bg-white/[0.06]" indicatorClassName="transition-all duration-500" style={{ '--progress-color': config.button_color } as any} />
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="space-y-5 animate-[fade-in_0.6s_0.4s_ease-out_both]">
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-7 space-y-5 shadow-2xl"
              style={{ boxShadow: `0 25px 60px -12px ${config.button_color}10, 0 0 0 1px ${config.button_color}08` }}>
              
              {fields.map((field, i) => {
                const Icon = field.icon;
                return (
                  <div key={field.key} className="space-y-1.5" style={{ animationDelay: `${0.5 + i * 0.1}s`, animation: 'fade-in 0.5s ease-out both' }}>
                    <div className="relative">
                      {/* Step number */}
                      <div className="absolute -left-1 -top-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center z-10 transition-colors duration-300"
                        style={{
                          backgroundColor: isFieldValid(field.key) ? '#22c55e' : `${config.button_color}30`,
                          color: isFieldValid(field.key) ? 'white' : config.button_color,
                        }}>
                        {isFieldValid(field.key) ? <Check className="w-3 h-3" /> : field.step}
                      </div>
                      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500 transition-colors duration-300" />
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={form[field.key as keyof typeof form]}
                        onChange={(e) => {
                          const val = field.key === 'phone' ? formatPhone(e.target.value) : e.target.value;
                          setForm({ ...form, [field.key]: val });
                          setTouched(t => ({ ...t, [field.key]: true }));
                        }}
                        className="w-full h-13 pl-11 pr-10 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder:text-gray-500/70 focus:outline-none transition-all duration-300 text-[15px]"
                        style={{ boxShadow: 'none' }}
                        onFocus={(e) => {
                          e.target.style.boxShadow = `0 0 0 2px ${focusRingColor}40, 0 0 30px ${focusRingColor}10`;
                          e.target.style.borderColor = `${focusRingColor}40`;
                          e.target.style.background = `rgba(255,255,255,0.07)`;
                        }}
                        onBlur={(e) => {
                          e.target.style.boxShadow = 'none';
                          e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                          e.target.style.background = 'rgba(255,255,255,0.05)';
                        }}
                        maxLength={field.maxLength}
                      />
                      {isFieldValid(field.key) && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 animate-[scale-in_0.2s_ease-out]" />
                      )}
                    </div>
                    {errors[field.key] && <p className="text-xs text-red-400 pl-1">{errors[field.key]}</p>}
                  </div>
                );
              })}
            </div>

            {/* CTA Button with shimmer */}
            <button type="submit" disabled={submitting}
              className="relative w-full h-14 rounded-xl text-white font-bold text-lg shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
              style={{ backgroundColor: config.button_color, boxShadow: `0 8px 30px ${config.button_color}40` }}>
              {/* Shimmer effect */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 opacity-20"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                    animation: 'shimmer 3s ease-in-out infinite',
                  }}
                />
              </div>
              <span className="relative z-10 flex items-center gap-2">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : config.button_text}
              </span>
            </button>
          </form>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2.5 animate-[fade-in_0.6s_0.6s_ease-out_both]">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <Lock className="w-3 h-3 text-gray-500" />
              <p className="text-[11px] text-gray-500 font-medium">
                Seus dados estão protegidos e não serão compartilhados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
