import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, User, Mail, Phone } from 'lucide-react';
import { z } from 'zod';

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
  redirect_type: string;
  redirect_url: string | null;
  whatsapp_message: string;
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
  redirect_type: 'whatsapp',
  redirect_url: null,
  whatsapp_message: 'Olá! Vim pela página de captura e quero saber mais.',
};

export default function CapturePage() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<CaptureConfig>(DEFAULT_CONFIG);
  const [consultant, setConsultant] = useState<ConsultantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (slug) loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      // Buscar consultor via RPC
      const { data: consultantRows } = await supabase.rpc('get_consultant_by_slug', { p_slug: slug });
      const consultantData = consultantRows?.[0];
      
      if (!consultantData) {
        setLoading(false);
        return;
      }
      
      setConsultant({
        id: consultantData.id,
        full_name: consultantData.full_name,
        organization_id: consultantData.organization_id,
        whatsapp_button_url: consultantData.whatsapp_button_url,
      });

      // Buscar config de captura (pode não existir)
      const { data: captureConfig } = await supabase
        .from('capture_page_configs')
        .select('*')
        .eq('consultant_id', consultantData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (captureConfig) {
        setConfig({
          title: captureConfig.title || DEFAULT_CONFIG.title,
          subtitle: captureConfig.subtitle || DEFAULT_CONFIG.subtitle,
          button_text: captureConfig.button_text || DEFAULT_CONFIG.button_text,
          button_color: captureConfig.button_color || DEFAULT_CONFIG.button_color,
          hero_image: captureConfig.hero_image,
          redirect_type: captureConfig.redirect_type || 'whatsapp',
          redirect_url: captureConfig.redirect_url,
          whatsapp_message: captureConfig.whatsapp_message || DEFAULT_CONFIG.whatsapp_message,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultant) return;

    // Validar
    const result = captureSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      // Inserir lead
      const phoneDigits = form.phone.replace(/\D/g, '');
      await supabase
        .from('quiz_submissions_new')
        .insert({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: phoneDigits,
          organization_id: consultant.organization_id,
          consultant_id: consultant.id,
          lead_source: 'capture',
          completion_percentage: 100,
          stage: 'novo',
          temperature: 'cold',
          lead_score: 0,
        });

      // Redirecionar
      if (config.redirect_type === 'whatsapp') {
        const whatsappUrl = consultant.whatsapp_button_url;
        if (whatsappUrl) {
          const phoneFromUrl = whatsappUrl.replace(/\D/g, '');
          const message = encodeURIComponent(config.whatsapp_message);
          window.location.href = `https://wa.me/${phoneFromUrl}?text=${message}`;
        } else {
          setSubmitted(true);
        }
      } else if (config.redirect_type === 'url' && config.redirect_url) {
        window.location.href = config.redirect_url;
      } else {
        setSubmitted(true);
      }
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

  if (submitted) {
    const whatsappUrl = consultant?.whatsapp_button_url;
    const whatsappPhone = whatsappUrl ? whatsappUrl.replace(/\D/g, '') : null;
    const whatsappLink = whatsappPhone
      ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(config.whatsapp_message)}`
      : null;

    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">Obrigado!</h1>
          <p className="text-gray-400 text-lg">
            Seus dados foram enviados com sucesso. Em breve entraremos em contato!
          </p>
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-lg transition-all hover:scale-[1.02] hover:shadow-xl"
              style={{ backgroundColor: '#25D366' }}
            >
              <Phone className="w-5 h-5" />
              Falar no WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#EB6608]/10 via-transparent to-[#EB6608]/5" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#EB6608]/8 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#EB6608]/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/4" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Hero image */}
          {config.hero_image && (
            <div className="flex justify-center">
              <img
                src={config.hero_image}
                alt="Hero"
                className="w-40 h-40 object-cover rounded-2xl border-2 border-[#EB6608]/30 shadow-lg shadow-[#EB6608]/20"
              />
            </div>
          )}

          {/* Title */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              {config.title}
            </h1>
            <p className="text-gray-400 text-base sm:text-lg">
              {config.subtitle}
            </p>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
              {/* Nome */}
              <div className="space-y-1.5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Seu nome completo"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-12 pl-11 pr-4 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#EB6608]/50 focus:border-[#EB6608]/50 transition-all"
                    maxLength={100}
                  />
                </div>
                {errors.name && <p className="text-xs text-red-400 pl-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    placeholder="Seu melhor email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-12 pl-11 pr-4 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#EB6608]/50 focus:border-[#EB6608]/50 transition-all"
                    maxLength={255}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400 pl-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                    className="w-full h-12 pl-11 pr-4 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#EB6608]/50 focus:border-[#EB6608]/50 transition-all"
                    maxLength={16}
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-400 pl-1">{errors.phone}</p>}
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-14 rounded-xl text-white font-bold text-lg shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ 
                backgroundColor: config.button_color,
                boxShadow: `0 8px 30px ${config.button_color}40`,
              }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                config.button_text
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-600">
            Seus dados estão protegidos e não serão compartilhados.
          </p>
        </div>
      </div>
    </div>
  );
}