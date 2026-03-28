import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { createPortal } from 'react-dom';
import { useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, User, Mail, Phone, Shield, Check, Lock, ChevronDown, ChevronRight, X } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const captureSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  phone: z.string().trim().min(10, 'Telefone inválido').max(20),
});

interface CustomQuestion {
  question: string;
  type: 'text' | 'choice';
  required: boolean;
  options: string[];
}

interface GalleryImage {
  type?: 'image' | 'video';
  url: string;
  caption?: string;
  media_format?: 'square' | 'video' | 'portrait' | 'auto';
}

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
  email_enabled: boolean;
  custom_questions: CustomQuestion[];
  template_type: 'standard' | 'landing';
  gallery_images: GalleryImage[];
  gallery_title: string;
  logo_image?: string | null;
  logo_position?: string;
  logo_size?: string;
  compare_enabled?: boolean;
  compare_title?: string;
  compare_traditional_items?: string[];
  compare_topbrasil_items?: string[];
}

interface ConsultantData {
  id: string;
  full_name: string;
  organization_id: string;
  whatsapp_button_url: string | null;
  pixel_id: string | null;
}

const DEFAULT_CONFIG: CaptureConfig = {
  title: 'Seu carro protegido do jeito certo.\nSem burocracia. Sem pegadinhas.',
  subtitle: 'A Top Brasil Campinas oferece proteção veicular completa com assistência 24h, cobertura contra roubo, furto e colisão, tudo com atendimento ágil e verdadeiro.',
  button_text: 'Quero proteger meu veículo agora →',
  button_color: '#EB6608',
  hero_image: '',
  hero_image_size: 'medium',
  hero_image_position: 'top',
  hero_image_shape: 'rounded',
  redirect_type: 'thank_you',
  redirect_url: '',
  whatsapp_message: 'Olá!',
  whatsapp_number: '',
  email_enabled: true,
  custom_questions: [],
  template_type: 'standard',
  gallery_images: [],
  gallery_title: 'Veja nossos resultados',
  logo_image: '',
  compare_enabled: false,
  compare_title: 'Por que pagar caro no seguro se você pode pagar muito menos?',
  compare_traditional_items: [
    'Consulta de crédito', 'Processo burocrático', 'Atendimento demorado', 'Preço varia pelo seu perfil', 'Franquia obrigatória', 'Renovação anual forçada'
  ],
  compare_topbrasil_items: [
    'Sem consulta de crédito', 'Aprovação na hora', 'Assistência 24h inclusa', 'Preço justo pra todos', 'Sem franquia surpresa', 'Atendimento humanizado'
  ]
};

/* ─── Country data ─── */
const COUNTRIES = [
  { code: 'BR', dial: '55', flag: '🇧🇷', name: 'Brasil', mask: '(##) #####-####', maxDigits: 11 },
  { code: 'US', dial: '1', flag: '🇺🇸', name: 'EUA', mask: '(###) ###-####', maxDigits: 10 },
  { code: 'PT', dial: '351', flag: '🇵🇹', name: 'Portugal', mask: '### ### ###', maxDigits: 9 },
  { code: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina', mask: '## ####-####', maxDigits: 10 },
  { code: 'PY', dial: '595', flag: '🇵🇾', name: 'Paraguai', mask: '### ### ###', maxDigits: 9 },
  { code: 'UY', dial: '598', flag: '🇺🇾', name: 'Uruguai', mask: '## ### ###', maxDigits: 8 },
  { code: 'CO', dial: '57', flag: '🇨🇴', name: 'Colômbia', mask: '### ### ####', maxDigits: 10 },
  { code: 'MX', dial: '52', flag: '🇲🇽', name: 'México', mask: '## #### ####', maxDigits: 10 },
  { code: 'CL', dial: '56', flag: '🇨🇱', name: 'Chile', mask: '# #### ####', maxDigits: 9 },
  { code: 'PE', dial: '51', flag: '🇵🇪', name: 'Peru', mask: '### ### ###', maxDigits: 9 },
  { code: 'VE', dial: '58', flag: '🇻🇪', name: 'Venezuela', mask: '### ### ####', maxDigits: 10 },
  { code: 'EC', dial: '593', flag: '🇪🇨', name: 'Equador', mask: '## ### ####', maxDigits: 9 },
  { code: 'BO', dial: '591', flag: '🇧🇴', name: 'Bolívia', mask: '#### ####', maxDigits: 8 },
  { code: 'CR', dial: '506', flag: '🇨🇷', name: 'Costa Rica', mask: '#### ####', maxDigits: 8 },
  { code: 'PA', dial: '507', flag: '🇵🇦', name: 'Panamá', mask: '#### ####', maxDigits: 8 },
  { code: 'DO', dial: '1', flag: '🇩🇴', name: 'Rep. Dominicana', mask: '(###) ###-####', maxDigits: 10 },
  { code: 'GT', dial: '502', flag: '🇬🇹', name: 'Guatemala', mask: '#### ####', maxDigits: 8 },
  { code: 'HN', dial: '504', flag: '🇭🇳', name: 'Honduras', mask: '#### ####', maxDigits: 8 },
  { code: 'SV', dial: '503', flag: '🇸🇻', name: 'El Salvador', mask: '#### ####', maxDigits: 8 },
  { code: 'NI', dial: '505', flag: '🇳🇮', name: 'Nicarágua', mask: '#### ####', maxDigits: 8 },
  { code: 'CU', dial: '53', flag: '🇨🇺', name: 'Cuba', mask: '# ### ####', maxDigits: 8 },
  { code: 'ES', dial: '34', flag: '🇪🇸', name: 'Espanha', mask: '### ## ## ##', maxDigits: 9 },
  { code: 'FR', dial: '33', flag: '🇫🇷', name: 'França', mask: '# ## ## ## ##', maxDigits: 9 },
  { code: 'DE', dial: '49', flag: '🇩🇪', name: 'Alemanha', mask: '### ### ####', maxDigits: 11 },
  { code: 'IT', dial: '39', flag: '🇮🇹', name: 'Itália', mask: '### ### ####', maxDigits: 10 },
  { code: 'GB', dial: '44', flag: '🇬🇧', name: 'Reino Unido', mask: '#### ######', maxDigits: 10 },
  { code: 'JP', dial: '81', flag: '🇯🇵', name: 'Japão', mask: '##-####-####', maxDigits: 10 },
  { code: 'CN', dial: '86', flag: '🇨🇳', name: 'China', mask: '### #### ####', maxDigits: 11 },
  { code: 'IN', dial: '91', flag: '🇮🇳', name: 'Índia', mask: '##### #####', maxDigits: 10 },
  { code: 'AO', dial: '244', flag: '🇦🇴', name: 'Angola', mask: '### ### ###', maxDigits: 9 },
  { code: 'MZ', dial: '258', flag: '🇲🇿', name: 'Moçambique', mask: '## ### ####', maxDigits: 9 },
  { code: 'CV', dial: '238', flag: '🇨🇻', name: 'Cabo Verde', mask: '### ## ##', maxDigits: 7 },
  { code: 'GW', dial: '245', flag: '🇬🇼', name: 'Guiné-Bissau', mask: '### ####', maxDigits: 7 },
  { code: 'ST', dial: '239', flag: '🇸🇹', name: 'São Tomé e Príncipe', mask: '### ####', maxDigits: 7 },
  { code: 'TL', dial: '670', flag: '🇹🇱', name: 'Timor-Leste', mask: '#### ####', maxDigits: 8 },
  { code: 'AU', dial: '61', flag: '🇦🇺', name: 'Austrália', mask: '### ### ###', maxDigits: 9 },
  { code: 'CA', dial: '1', flag: '🇨🇦', name: 'Canadá', mask: '(###) ###-####', maxDigits: 10 },
  { code: 'ZA', dial: '27', flag: '🇿🇦', name: 'África do Sul', mask: '## ### ####', maxDigits: 9 },
  { code: 'IL', dial: '972', flag: '🇮🇱', name: 'Israel', mask: '##-### ####', maxDigits: 9 },
  { code: 'AE', dial: '971', flag: '🇦🇪', name: 'Emirados Árabes', mask: '## ### ####', maxDigits: 9 },
];

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
          <a href={config.redirect_url.match(/^https?:\/\//) ? config.redirect_url : `https://${config.redirect_url}`} target="_blank" rel="noopener noreferrer"
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

/* ─── Scroll Reveal Observer for Landing Page ─── */
function LandingScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    const observe = () => {
      document.querySelectorAll('.lp-reveal').forEach((el) => observer.observe(el));
    };
    observe();
    // Re-observe on DOM changes
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}

/* ─── Hero Image ─── */
function HeroImage({ config }: { config: CaptureConfig }) {
  if (!config.hero_image || config.hero_image_position === 'background') return null;

  const sizeMap: Record<string, string> = {
    small: 'w-32 h-32',
    medium: 'w-56 h-56',
    large: 'w-full max-w-sm h-auto',
    full: 'w-full h-auto',
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
          "object-contain border-2 shadow-lg animate-[fade-in_0.8s_ease-out]",
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

/* ─── Country Selector ─── */
function CountrySelector({ 
  selected, 
  onSelect, 
  buttonColor 
}: { 
  selected: typeof COUNTRIES[0]; 
  onSelect: (country: typeof COUNTRIES[0]) => void;
  buttonColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customDDI, setCustomDDI] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

  // Calculate position when opening
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 420; // approximate max height
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    setPos({
      top: openUp ? rect.top : rect.bottom + 4,
      left: rect.left,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      searchRef.current?.focus();
    }
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.dial.includes(search.replace('+', ''))
  );

  const handleCustomDDI = () => {
    const digits = customDDI.replace(/\D/g, '');
    if (digits.length >= 1 && digits.length <= 4) {
      onSelect({ code: 'OTHER', dial: digits, flag: '🌍', name: `+${digits}`, mask: '### ### #### ####', maxDigits: 15 });
      setOpen(false);
      setSearch('');
      setCustomDDI('');
    }
  };

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed w-72 rounded-xl shadow-2xl z-[9999] animate-[fade-in_0.15s_ease-out] flex flex-col"
      style={{
        top: pos.openUp ? undefined : pos.top,
        bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined,
        left: pos.left,
        maxHeight: 'min(420px, 70vh)',
        backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
      }}
    >
      {/* Search */}
      <div className="p-2.5 border-b border-white/10 shrink-0" style={{ backgroundColor: '#1a1a1a' }}>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar país ou DDI..."
          className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none"
          style={{ backgroundColor: '#252525', border: '1px solid rgba(255,255,255,0.1)' }}
        />
      </div>
      
      {/* Country list */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ backgroundColor: '#1a1a1a' }}>
        {filtered.map((country) => (
          <button
            key={country.code}
            type="button"
            onClick={() => { onSelect(country); setOpen(false); setSearch(''); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
              selected.code === country.code ? "bg-[#2a2a2a]" : "bg-[#1a1a1a] hover:bg-[#222222]"
            )}
          >
            <span className="text-lg">{country.flag}</span>
            <span className="text-white/90 flex-1 truncate">{country.name}</span>
            <span className="text-gray-500 text-xs font-mono">+{country.dial}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500">Nenhum país encontrado.</p>
        )}
      </div>

      {/* Custom DDI */}
      <div className="border-t border-white/10 p-2.5 shrink-0" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={customDDI}
            onChange={(e) => setCustomDDI(e.target.value.replace(/[^\d+]/g, '').slice(0, 5))}
            placeholder="DDI manual (ex: 351)"
            className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none"
            style={{ backgroundColor: '#252525', border: '1px solid rgba(255,255,255,0.1)' }}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomDDI()}
          />
          <button
            type="button"
            onClick={handleCustomDDI}
            className="shrink-0 min-w-[44px] px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: buttonColor }}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 h-full px-3 rounded-l-xl border-r border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] transition-colors"
      >
        <span className="text-lg leading-none">{selected.flag}</span>
        <ChevronDown className="w-3 h-3 text-gray-500" />
      </button>
      {dropdown}
    </div>
  );
}

/* ─── Media format helper ─── */
function getMediaAspectClass(format?: string): string {
  switch (format) {
    case 'square': return 'aspect-square';
    case 'portrait': return 'aspect-[9/16]';
    case 'auto': return '';
    case 'video':
    default: return 'aspect-video';
  }
}

/* ─── Main Page ─── */
export default function CapturePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const isRecruitment = location.pathname.startsWith('/r/');
  const [config, setConfig] = useState<CaptureConfig>(DEFAULT_CONFIG);
  const [consultant, setConsultant] = useState<ConsultantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [customAnswers, setCustomAnswers] = useState<Record<number, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Brasil

  const { trackEvent } = useMetaPixel({ pixelId: consultant?.pixel_id });

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
        pixel_id: consultantData.pixel_id,
      });

      const pagePurpose = isRecruitment ? 'recruitment' : 'protection';
      const { data: captureConfig } = await supabase
        .from('capture_page_configs').select('*')
        .eq('consultant_id', consultantData.id).eq('is_active', true)
        .eq('page_purpose' as any, pagePurpose).maybeSingle();

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
          email_enabled: (captureConfig as any).email_enabled ?? true,
          custom_questions: (captureConfig as any).custom_questions || [],
          template_type: (captureConfig as any).template_type || 'standard',
          gallery_images: (captureConfig as any).gallery_images || [],
          gallery_title: (captureConfig as any).gallery_title || 'Veja nossos resultados',
          logo_image: (captureConfig as any).logo_image || null,
          compare_enabled: (captureConfig as any).compare_enabled ?? DEFAULT_CONFIG.compare_enabled,
          compare_title: (captureConfig as any).compare_title || DEFAULT_CONFIG.compare_title,
          compare_traditional_items: (captureConfig as any).compare_traditional_items || DEFAULT_CONFIG.compare_traditional_items,
          compare_topbrasil_items: (captureConfig as any).compare_topbrasil_items || DEFAULT_CONFIG.compare_topbrasil_items,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar página de captura:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
    // Brazil-specific formatting
    if (selectedCountry.code === 'BR') {
      if (digits.length <= 2) return digits;
      if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    // US formatting
    if (selectedCountry.code === 'US') {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    // Generic: just add spaces every 3 digits
    return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  };

  const isFieldValid = (field: string) => {
    if (!touched[field]) return false;
    const value = form[field as keyof typeof form];
    if (field === 'name') return value.trim().length >= 2;
    if (field === 'email') return config.email_enabled ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : true;
    if (field === 'phone') return value.replace(/\D/g, '').length >= (selectedCountry.maxDigits - 2);
    return false;
  };

  const baseFields = ['name', ...(config.email_enabled ? ['email'] : []), 'phone'];
  const totalFields = baseFields.length + config.custom_questions.filter(q => q.required).length;
  const validBaseCount = baseFields.filter(f => isFieldValid(f)).length;
  const validCustomCount = config.custom_questions.filter((q, i) => q.required && customAnswers[i]?.trim()).length;
  const validCount = validBaseCount + validCustomCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultant) return;
    
    // Validate base fields
    if (form.name.trim().length < 2) {
      setErrors({ name: 'Nome deve ter pelo menos 2 caracteres' });
      setTouched({ name: true, email: true, phone: true });
      return;
    }
    if (config.email_enabled && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrors({ email: 'Email inválido' });
      setTouched({ name: true, email: true, phone: true });
      return;
    }
    if (form.phone.replace(/\D/g, '').length < (selectedCountry.maxDigits - 2)) {
      setErrors({ phone: 'Telefone inválido' });
      setTouched({ name: true, email: true, phone: true });
      return;
    }

    // Validate required custom questions
    const missingRequired = config.custom_questions.findIndex((q, i) => q.required && !customAnswers[i]?.trim());
    if (missingRequired >= 0) {
      setErrors({ [`custom_${missingRequired}`]: 'Campo obrigatório' });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const phoneDigits = selectedCountry.dial + form.phone.replace(/\D/g, '');
      
      // Build extra_answers from custom questions
      const extra_answers: Record<string, string> = {};
      config.custom_questions.forEach((q, i) => {
        if (customAnswers[i]?.trim()) {
          extra_answers[q.question] = customAnswers[i];
        }
      });

      await supabase.from('quiz_submissions_new').insert({
        name: form.name.trim(), 
        email: config.email_enabled && form.email ? form.email.trim() : null, 
        phone: phoneDigits,
        organization_id: consultant.organization_id, consultant_id: consultant.id,
        lead_source: isRecruitment ? 'recruitment' : 'capture', completion_percentage: 100,
        stage: 'novo', temperature: 'cold', lead_score: 0,
        extra_answers: Object.keys(extra_answers).length > 0 ? extra_answers : null,
      } as any);
      trackEvent('Lead', { content_name: consultant.full_name, content_category: 'capture' });
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
    ...(config.email_enabled ? [{ key: 'email', icon: Mail, placeholder: 'Seu melhor email', type: 'email', maxLength: 255, step: 2 }] : []),
  ];
  const phoneStep = config.email_enabled ? 3 : 2;

  // ─── Landing Page Template ───
  if (config.template_type === 'landing') {
    const handleWhatsAppRedirect = () => {
      if (!config.whatsapp_number) {
        toast.error('Número de WhatsApp não configurado.');
        return;
      }
      const txt = encodeURIComponent(config.whatsapp_message || 'Olá!');
      window.location.href = `https://wa.me/${config.whatsapp_number.replace(/\D/g, '')}?text=${txt}`;
    };

    const isYouTubeOrVimeo = (url: string) => 
      url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');

    const renderMedia = (img: any, idx: number) => {
      const aspectClass = getMediaAspectClass(img.media_format);
      if (img.type === 'video') {
        // Native video (uploaded file)
        if (!isYouTubeOrVimeo(img.url)) {
          return (
            <div key={idx} className="lp-reveal group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0a0a0a] transition-all duration-500 hover:border-white/20 hover:shadow-2xl hover:scale-[1.02]">
              <video
                src={img.url + '#t=0.5'}
                controls
                playsInline
                preload="metadata"
                className={cn("w-full object-cover transition-transform duration-700 group-hover:scale-105", aspectClass || "aspect-video")}
                style={{ background: '#000' }}
              />
              {img.caption && (
                <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none z-10">
                  <p className="text-white text-sm md:text-base font-bold drop-shadow-md">{img.caption}</p>
                </div>
              )}
            </div>
          );
        }
        
        // YouTube/Vimeo embed
        let embedUrl = img.url;
        let isVertical = false;
        
        if (img.url.includes('youtube.com/shorts/')) {
          const vidId = img.url.split('shorts/')[1]?.split('?')[0];
          embedUrl = `https://www.youtube.com/embed/${vidId}`;
          isVertical = true;
        } else if (img.url.includes('youtube.com/watch?v=')) {
          embedUrl = img.url.replace('watch?v=', 'embed/').split('&')[0];
        } else if (img.url.includes('youtu.be/')) {
          const vidId = img.url.split('youtu.be/')[1]?.split('?')[0];
          embedUrl = `https://www.youtube.com/embed/${vidId}`;
        }
        
        return (
          <div key={idx} className={cn("lp-reveal group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0a0a0a] shadow-2xl transition-all duration-500 hover:border-white/20 hover:-translate-y-1 mx-auto w-full", isVertical ? "aspect-[9/16] max-w-sm" : (aspectClass || "aspect-video"))}>
            <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            {img.caption && (
              <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none z-10">
                <p className="text-white text-sm md:text-base font-bold drop-shadow-md">{img.caption}</p>
              </div>
            )}
          </div>
        );
      }
      return (
        <div key={idx} className="lp-reveal group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0a0a0a] transition-all duration-500 hover:border-white/20 hover:shadow-2xl hover:scale-[1.02]">
          <img src={img.url} alt={img.caption || `Imagem ${idx + 1}`} className="w-full aspect-video sm:aspect-square object-cover transition-transform duration-700 group-hover:scale-105" />
          {img.caption && (
            <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
              <p className="text-white text-sm md:text-base font-bold drop-shadow-md">{img.caption}</p>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-[#0D0D0D] relative overflow-x-hidden selection:bg-[#EB6608]/30">
        <style>{`
          @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
          @keyframes lp-fade-up { from{opacity:0;transform:translateY(36px)} to{opacity:1;transform:translateY(0)} }
          @keyframes lp-fade-in { from{opacity:0} to{opacity:1} }
          @keyframes mouse-scroll { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
          .lp-hero-title { animation: lp-fade-up 0.9s cubic-bezier(0.22,1,0.36,1) both; }
          .lp-hero-sub { animation: lp-fade-up 0.9s 0.18s cubic-bezier(0.22,1,0.36,1) both; }
          .lp-hero-btn { animation: lp-fade-up 0.9s 0.32s cubic-bezier(0.22,1,0.36,1) both; }
          .lp-logo { animation: lp-fade-in 0.6s ease-out both; }
          .lp-reveal { opacity:0; transform:translateY(30px); transition: opacity 0.75s cubic-bezier(0.22,1,0.36,1), transform 0.75s cubic-bezier(0.22,1,0.36,1); }
          .lp-reveal.visible { opacity:1; transform:translateY(0); }
          .lp-reveal-d1 { transition-delay:0.12s; }
          .lp-reveal-d2 { transition-delay:0.24s; }
          .lp-divider { height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.09),transparent); }
        `}</style>
        <LandingScrollReveal />

        {/* Background ambient */}
        <FloatingOrb color={config.button_color} size={700} top="-20%" left="-15%" delay="0s" />
        <FloatingOrb color={config.button_color} size={450} top="55%" left="65%" delay="2.5s" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0D0D0D]/60 via-transparent to-[#0D0D0D]/80" />

        <div className="relative z-10">
          {/* Header */}
          <header className="absolute top-0 inset-x-0 z-50 px-5 sm:px-10 py-5 pointer-events-none lp-logo">
            <div className={cn(
              "max-w-7xl mx-auto w-full flex",
              config.logo_position === 'center' ? 'justify-center' :
              config.logo_position === 'right' ? 'justify-end' :
              'justify-start'
            )}>
              <img src={config.logo_image || '/top-brasil-logo.png'} alt="Logo" className={cn(
                "w-auto object-contain pointer-events-auto drop-shadow-lg",
                config.logo_size === 'small' ? 'h-7 sm:h-8' :
                config.logo_size === 'large' ? 'h-14 sm:h-16' :
                'h-9 sm:h-12'
              )} />
            </div>
          </header>

          {/* Hero Section */}
          <section className="relative flex flex-col items-center px-5 pt-24 pb-16 md:pt-32 md:pb-24 text-center max-w-5xl mx-auto">
            {config.hero_image && (
              <div className="mb-6 lp-logo"><HeroImage config={config} /></div>
            )}
            <div className="lp-reveal mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs font-semibold text-gray-300 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: config.button_color, boxShadow: `0 0 10px ${config.button_color}` }} />
              PROTEÇÃO VEICULAR | CAMPINAS & REGIÃO
            </div>
            <h1 className="lp-hero-title text-[2rem] leading-[1.1] sm:text-4xl md:text-5xl xl:text-6xl font-extrabold text-white tracking-tight max-w-4xl">
              Seu carro protegido do jeito certo.{' '}
              <span className="block mt-1" style={{ color: config.button_color }}>Sem burocracia. Sem pegadinhas.</span>
            </h1>
            <p className="lp-hero-sub text-gray-400 text-sm sm:text-base md:text-lg mt-5 max-w-2xl leading-relaxed">
              A Top Brasil Campinas oferece proteção veicular completa com assistência 24h, cobertura contra roubo, furto e colisão — tudo com atendimento ágil e de verdade.{' '}
              <span className="text-white font-semibold">Sem consulta de crédito. Aprovação na hora.</span>
            </p>
            <div className="lp-hero-btn mt-8 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' })}
                className="group relative w-full sm:w-auto px-8 py-4 sm:px-10 sm:py-5 rounded-full text-white font-bold text-base sm:text-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.97] overflow-hidden flex items-center justify-center gap-2"
                style={{ backgroundColor: config.button_color, boxShadow: `0 12px 40px -8px ${config.button_color}BB` }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 opacity-25" style={{ background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)', animation:'shimmer 2.5s ease-in-out infinite' }} />
                </div>
                <span className="relative flex items-center justify-center gap-2">
                  {config.button_text} <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                </span>
              </button>
            </div>
            {/* scroll cue */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1 opacity-30">
              <div className="w-6 h-9 rounded-full border-2 border-white/40 flex justify-center pt-2">
                <div className="w-1.5 h-2 bg-white/80 rounded-full" style={{ animation:'mouse-scroll 1.6s ease-in-out infinite' }} />
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="px-5 sm:px-10 pb-14 md:pb-20 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-5">
              {[1,2,3,4,5,6].map((num, idx) => (
                <div key={idx} className="lp-reveal flex items-center justify-center group p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] transition-all duration-500 hover:-translate-y-1" style={{ transitionDelay: `${idx * 0.08}s` }}>
                  <img src={`/benefits/benefit-${num}.png`} alt={`Benefício ${num}`} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
                </div>
              ))}
            </div>
          </section>

          {/* Compare Section */}
          {config.compare_enabled && (
            <section className="px-4 sm:px-6 py-14 md:py-20 max-w-5xl mx-auto w-full">
              <div className="space-y-8 md:space-y-10">
              <div className="text-left space-y-3 max-w-3xl">
                  <p className="lp-reveal text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase" style={{ color: config.button_color }}>Proteção que cabe no bolso</p>
                  <h2 className="lp-reveal text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-[1.15]">
                    {config.compare_title}
                  </h2>
                  <p className="lp-reveal text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">
                    O seguro tradicional cobra até 3x mais pela mesma proteção — e ainda usa seu CPF e seu bairro pra definir o preço. Com a Top Brasil você protege seu veículo com um valor justo, sem consulta de crédito e sem surpresa no bolso.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 lg:gap-5">
                  {/* Tradicional */}
                  <div className="lp-reveal lp-reveal-d1 bg-[#1A1A1A] rounded-2xl p-6 sm:p-8">
                    <p className="text-gray-500 text-[10px] sm:text-xs font-semibold tracking-widest uppercase mb-5">✗ Seguro Tradicional</p>
                    <ul className="space-y-3">
                      {(config.compare_traditional_items || []).map((item: string, i: number) => (
                        <li key={i} className="flex gap-3 text-gray-400 text-sm sm:text-base items-center">
                          <X className="w-4 h-4 text-red-400/60 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Top Brasil */}
                  <div className="lp-reveal lp-reveal-d2 rounded-2xl p-6 sm:p-8 relative shadow-2xl border border-white/10 hover:border-white/20 transition-colors"
                    style={{ background: `linear-gradient(135deg, ${config.button_color}, ${config.button_color}DD)` }}>
                    <div className="absolute top-0 right-3 sm:right-4 -translate-y-1/2">
                      <span className="bg-white text-[9px] sm:text-[10px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg" style={{ color: config.button_color }}>Melhor Escolha</span>
                    </div>
                    <p className="text-white/80 text-[10px] sm:text-xs font-semibold tracking-widest uppercase mb-5">✓ Melhor Escolha — Top Brasil</p>
                    <ul className="space-y-3">
                      {(config.compare_topbrasil_items || []).map((item: string, i: number) => (
                        <li key={i} className="flex gap-3 text-white text-sm sm:text-base items-center font-medium">
                          <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── Formulário Section ─── */}
          <section id="formulario" className="px-4 sm:px-6 py-14 md:py-20 max-w-2xl mx-auto w-full scroll-mt-8">
            <div className="lp-reveal rounded-3xl p-6 sm:p-10 border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-8 leading-tight">
                Descubra o plano ideal para o seu veículo!
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome completo</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => { setForm({ ...form, name: e.target.value }); setTouched({ ...touched, name: true }); }}
                      placeholder="Seu nome completo"
                      maxLength={100}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 transition-colors text-sm sm:text-base"
                    />
                  </div>
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">WhatsApp</label>
                  <div className="flex rounded-xl bg-white/[0.06] border border-white/10 focus-within:border-white/30 transition-colors overflow-hidden">
                    <CountrySelector selected={selectedCountry} onSelect={setSelectedCountry} buttonColor={config.button_color} />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => { setForm({ ...form, phone: formatPhone(e.target.value) }); setTouched({ ...touched, phone: true }); }}
                      placeholder={selectedCountry.mask}
                      className="flex-1 px-4 py-3.5 bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-sm sm:text-base"
                    />
                  </div>
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>

                {/* Custom Questions */}
                {config.custom_questions.length > 0 && config.custom_questions.map((q, idx) => (
                  <div key={idx}>
                    <label className="block text-sm font-medium text-gray-300 mb-2.5">
                      {idx + 1}. {q.question}
                      {q.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {q.type === 'choice' && q.options?.length > 0 ? (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <label
                            key={oi}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all text-sm sm:text-base",
                              customAnswers[idx] === opt
                                ? "border-white/30 bg-white/10 text-white"
                                : "border-white/[0.07] bg-white/[0.02] text-gray-400 hover:bg-white/[0.05] hover:border-white/15"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              customAnswers[idx] === opt ? "border-white" : "border-gray-600"
                            )}>
                              {customAnswers[idx] === opt && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span>{opt}</span>
                            <input
                              type="radio"
                              name={`q_${idx}`}
                              value={opt}
                              checked={customAnswers[idx] === opt}
                              onChange={() => setCustomAnswers({ ...customAnswers, [idx]: opt })}
                              className="sr-only"
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={customAnswers[idx] || ''}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [idx]: e.target.value })}
                        placeholder="Digite sua resposta..."
                        className="w-full px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 transition-colors text-sm sm:text-base"
                      />
                    )}
                    {errors[`custom_${idx}`] && <p className="text-red-400 text-xs mt-1">{errors[`custom_${idx}`]}</p>}
                  </div>
                ))}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative w-full py-4 sm:py-5 rounded-full text-white font-bold text-base sm:text-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: config.button_color, boxShadow: `0 12px 40px -8px ${config.button_color}BB` }}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 opacity-25" style={{ background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)', animation:'shimmer 2.5s ease-in-out infinite' }} />
                  </div>
                  <span className="relative flex items-center gap-2">
                    {submitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                    ) : (
                      <>Quero minha proteção agora <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </span>
                </button>
              </form>
            </div>
          </section>

          {/* Gallery Section */}
          {config.gallery_images.length > 0 && (
            <section className="px-4 sm:px-6 py-14 md:py-20 max-w-6xl mx-auto w-full">
              <h2 className="lp-reveal text-2xl sm:text-3xl md:text-4xl font-extrabold text-white text-center mb-8 md:mb-12">{config.gallery_title}</h2>
              <div className={cn(
                "grid gap-4",
                config.gallery_images.length === 1 ? "grid-cols-1 max-w-2xl mx-auto" :
                config.gallery_images.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto" :
                "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}>
                {config.gallery_images.map((img, idx) => renderMedia(img, idx))}
              </div>
            </section>
          )}

          {/* Social Proof Section */}
          <section className="px-4 sm:px-6 py-14 md:py-20 text-center max-w-3xl mx-auto">
            <div className="lp-reveal space-y-5">
              <p className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-none">
                +75.000
              </p>
              <p className="text-base sm:text-lg font-semibold text-gray-300">
                veículos protegidos em todo o Brasil
              </p>
              <div className="flex justify-center gap-1 text-2xl">
                {['⭐','⭐','⭐','⭐','⭐'].map((s, i) => <span key={i}>{s}</span>)}
              </div>
              <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                Junte-se a mais de 75.000 associados que já protegem seu veículo com tranquilidade.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' })}
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-bold text-base sm:text-lg transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.97]"
                style={{ backgroundColor: config.button_color, boxShadow: `0 12px 40px -8px ${config.button_color}BB` }}
              >
                Quero fazer parte agora <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </section>

        </div>

      </div>
    );
  }

  // ─── Standard Template ───
  return (
    <div className="min-h-screen bg-[#0D0D0D] relative overflow-hidden">
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

      {isBackground && (
        <div className="absolute inset-0">
          <img src={config.hero_image!} alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0D0D0D]/80 via-[#0D0D0D]/90 to-[#0D0D0D]" />
        </div>
      )}

      <FloatingOrb color={config.button_color} size={500} top="-10%" left="-5%" delay="0s" />
      <FloatingOrb color={config.button_color} size={350} top="60%" left="75%" delay="2s" />
      <FloatingOrb color="#ffffff" size={200} top="30%" left="50%" delay="4s" />

      <div className="absolute inset-0 bg-gradient-to-br from-[#EB6608]/5 via-transparent to-[#EB6608]/3" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-12">
        <div className={cn("w-full max-w-lg space-y-8", isLeft && "max-w-xl")}>
          
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


          {/* Form Card */}
          <form onSubmit={handleSubmit} className="space-y-6 animate-[fade-in_0.6s_0.4s_ease-out_both]">
            <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.10] rounded-3xl p-8 sm:p-10 space-y-7 shadow-2xl"
              style={{ boxShadow: `0 25px 60px -12px ${config.button_color}15, 0 0 0 1px ${config.button_color}10` }}>
              
              {/* Name & Email fields */}
              {fields.map((field, i) => {
                const Icon = field.icon;
                return (
                  <div key={field.key} className="space-y-1.5" style={{ animationDelay: `${0.5 + i * 0.1}s`, animation: 'fade-in 0.5s ease-out both' }}>
                    <div className="relative">
                      <div className="absolute -left-3.5 -top-3.5 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center z-10 transition-colors duration-300"
                        style={{
                          backgroundColor: isFieldValid(field.key) ? '#22c55e' : `${config.button_color}30`,
                          color: isFieldValid(field.key) ? 'white' : config.button_color,
                        }}>
                        {isFieldValid(field.key) ? <Check className="w-3.5 h-3.5" /> : field.step}
                      </div>
                      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 transition-colors duration-300" />
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={form[field.key as keyof typeof form]}
                        onChange={(e) => {
                          setForm({ ...form, [field.key]: e.target.value });
                          setTouched(t => ({ ...t, [field.key]: true }));
                        }}
                        className="w-full h-[60px] pl-12 pr-10 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder:text-gray-500/70 focus:outline-none transition-all duration-300 text-[17px]"
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
                        <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400 animate-[scale-in_0.2s_ease-out]" />
                      )}
                    </div>
                    {errors[field.key] && <p className="text-xs text-red-400 pl-1">{errors[field.key]}</p>}
                  </div>
                );
              })}

              {/* Phone field with country selector */}
              <div className="space-y-1.5" style={{ animationDelay: '0.7s', animation: 'fade-in 0.5s ease-out both' }}>
                <div className="relative">
                  <div className="absolute -left-3.5 -top-3.5 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center z-10 transition-colors duration-300"
                    style={{
                      backgroundColor: isFieldValid('phone') ? '#22c55e' : `${config.button_color}30`,
                      color: isFieldValid('phone') ? 'white' : config.button_color,
                    }}>
                    {isFieldValid('phone') ? <Check className="w-3.5 h-3.5" /> : phoneStep}
                  </div>
                  <div className="flex h-[60px] bg-white/[0.05] border border-white/[0.08] rounded-xl transition-all duration-300"
                    id="phone-container">
                    <CountrySelector 
                      selected={selectedCountry} 
                      onSelect={(c) => { 
                        setSelectedCountry(c); 
                        setForm(f => ({ ...f, phone: '' })); 
                      }}
                      buttonColor={config.button_color}
                    />
                    <input
                      type="tel"
                      placeholder={selectedCountry.code === 'BR' ? '(00) 00000-0000' : selectedCountry.mask.replace(/#/g, '0')}
                      value={form.phone}
                      onChange={(e) => {
                        const val = formatPhone(e.target.value);
                        setForm({ ...form, phone: val });
                        setTouched(t => ({ ...t, phone: true }));
                      }}
                      className="flex-1 h-full pl-3 pr-10 bg-transparent text-white placeholder:text-gray-500/70 focus:outline-none transition-all duration-300 text-[17px]"
                      onFocus={() => {
                        const el = document.getElementById('phone-container');
                        if (el) {
                          el.style.boxShadow = `0 0 0 2px ${focusRingColor}40, 0 0 30px ${focusRingColor}10`;
                          el.style.borderColor = `${focusRingColor}40`;
                          el.style.background = `rgba(255,255,255,0.07)`;
                        }
                      }}
                      onBlur={() => {
                        const el = document.getElementById('phone-container');
                        if (el) {
                          el.style.boxShadow = 'none';
                          el.style.borderColor = 'rgba(255,255,255,0.08)';
                          el.style.background = 'rgba(255,255,255,0.05)';
                        }
                      }}
                      maxLength={16}
                    />
                    {isFieldValid('phone') && (
                      <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400 animate-[scale-in_0.2s_ease-out]" />
                    )}
                  </div>
                </div>
              {errors.phone && <p className="text-xs text-red-400 pl-1">{errors.phone}</p>}
              </div>

              {/* Custom Questions - inside the card */}
              {config.custom_questions.length > 0 && config.custom_questions.map((q, idx) => {
                const customStep = phoneStep + 1 + idx;
                const isCustomValid = !!customAnswers[idx]?.trim();
                return (
                <div key={idx} className="space-y-1.5" style={{ animation: 'fade-in 0.5s ease-out both' }}>
                  <div className="relative">
                    <div className="absolute -left-3.5 -top-3.5 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center z-10 transition-colors duration-300"
                      style={{
                        backgroundColor: isCustomValid ? '#22c55e' : `${config.button_color}30`,
                        color: isCustomValid ? 'white' : config.button_color,
                      }}>
                      {isCustomValid ? <Check className="w-3.5 h-3.5" /> : customStep}
                    </div>
                    <label className="text-sm text-gray-400 pl-1">{q.question}{q.required && <span className="text-red-400 ml-1">*</span>}</label>
                  </div>
                  {q.type === 'choice' ? (
                    <div className="space-y-2">
                      {q.options.filter(o => o.trim()).map((opt, optIdx) => (
                        <label key={optIdx} className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200",
                          customAnswers[idx] === opt 
                            ? "border-opacity-50 bg-white/[0.08]" 
                            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                        )} style={customAnswers[idx] === opt ? { borderColor: `${config.button_color}60` } : {}}>
                          <input type="radio" name={`custom_${idx}`} value={opt} checked={customAnswers[idx] === opt}
                            onChange={() => setCustomAnswers(prev => ({ ...prev, [idx]: opt }))}
                            className="sr-only" />
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                            customAnswers[idx] === opt ? "border-current" : "border-gray-500"
                          )} style={customAnswers[idx] === opt ? { borderColor: config.button_color } : {}}>
                            {customAnswers[idx] === opt && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.button_color }} />}
                          </div>
                          <span className="text-white text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input type="text" value={customAnswers[idx] || ''} 
                      onChange={(e) => setCustomAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                      placeholder="Sua resposta"
                      className="w-full h-[52px] px-4 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder:text-gray-500/70 focus:outline-none transition-all duration-300 text-[16px]"
                      style={{ boxShadow: 'none' }}
                      onFocus={(e) => { e.target.style.boxShadow = `0 0 0 2px ${focusRingColor}40`; e.target.style.borderColor = `${focusRingColor}40`; }}
                      onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      maxLength={300} />
                  )}
                  {errors[`custom_${idx}`] && <p className="text-xs text-red-400 pl-1">{errors[`custom_${idx}`]}</p>}
                </div>
                );
              })}
            </div>

            <button type="submit" disabled={submitting}
              className="relative w-full h-16 rounded-2xl text-white font-bold text-xl shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
              style={{ backgroundColor: config.button_color, boxShadow: `0 8px 30px ${config.button_color}40` }}>
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
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
              <Shield className="w-4 h-4 text-green-500/70" />
              <p className="text-xs text-gray-400 font-medium">
                Seus dados estão protegidos e não serão compartilhados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

