import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, getQuizUrl, getCaptureUrl } from '@/lib/consultant-context';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Copy, ExternalLink, Upload, Trash2, Check, User, Plus, X, GripVertical, ArrowUp, ArrowDown, FileText, Globe, Image } from 'lucide-react';
import { QuizQuestionsEditor } from './QuizQuestionsEditor';
import { cn } from '@/lib/utils';

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="space-y-2">
      <Label>Tema da Interface</Label>
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dark">🌙 Modo Escuro</SelectItem>
          <SelectItem value="light">☀️ Modo Claro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CapturePagePreview({ config }: { config: any }) {
  const isLanding = config.template_type === 'landing';
  const btnColor = config.button_color || '#EB6608';

  if (isLanding) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-lg flex flex-col" style={{ background: '#0D0D0D', minHeight: 600 }}>
        {/* Ambient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#EB6608]/10 via-transparent to-[#EB6608]/5 pointer-events-none" />
        
        {/* Header Logo */}
        <div className="relative flex py-4 px-4 border-b border-white/5">
          <div className={cn(
            "w-full flex",
            config.logo_position === 'center' ? 'justify-center' :
            config.logo_position === 'right' ? 'justify-end' :
            'justify-start'
          )}>
            <img src={config.logo_image || '/top-brasil-logo.png'} alt="Logo" className={cn(
              "w-auto object-contain",
              config.logo_size === 'small' ? 'h-7' :
              config.logo_size === 'large' ? 'h-14' :
              'h-10'
            )} />
          </div>
        </div>

        {/* Hero */}
        <div className="relative flex flex-col items-center justify-center px-4 py-10 text-center gap-4">
          {config.hero_image && (
            <img src={config.hero_image} alt="Hero" className="w-16 h-16 object-cover rounded-full border border-white/20 mb-2" />
          )}
          <h3 className="text-lg font-extrabold text-white leading-tight max-w-[250px]">{config.title || 'Título Hero'}</h3>
          <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed line-clamp-3">{config.subtitle || 'Subtítulo descritivo'}</p>
          <button className="px-6 py-2.5 mt-2 rounded-full text-xs text-white font-bold" style={{ backgroundColor: btnColor, boxShadow: `0 4px 15px -4px ${btnColor}` }}>
            {config.button_text || 'Clique aqui'}
          </button>
        </div>

        {/* Benefits Preview */}
        <div className="relative px-4 py-6 border-t border-white/[0.05]">
          <div className="grid grid-cols-5 gap-1.5 opacity-80 pointer-events-none">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="aspect-square bg-white/5 rounded-md flex items-center justify-center border border-white/10">
                <span className="text-[8px] text-gray-500">Ícone {i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compare Section */}
        {config.compare_enabled && (
          <div className="relative px-4 py-8 bg-white/[0.02] border-t border-white/[0.05] space-y-4">
            <p className="text-xs font-bold text-white text-center">{config.compare_title || 'Comparativo'}</p>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><span className="text-red-400/60">✗</span> Seguro Tradicional</p>
                {(config.compare_traditional_items || []).slice(0, 3).map((item: string, i: number) => (
                  <p key={i} className="text-[9px] text-gray-500 flex items-start gap-1"><span className="text-red-400/50">✗</span><span className="truncate">{item}</span></p>
                ))}
              </div>
              <div className="rounded-xl p-3 space-y-2" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}DD)` }}>
                <p className="text-[10px] font-bold text-white flex items-center gap-1"><span>✓</span> Top Brasil</p>
                {(config.compare_topbrasil_items || []).slice(0, 3).map((item: string, i: number) => (
                  <p key={i} className="text-[9px] text-white flex items-start gap-1"><span>✓</span><span className="truncate">{item}</span></p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Gallery preview */}
        {config.gallery_images.length > 0 && (
          <div className="relative px-4 py-6 border-t border-white/[0.05]">
            <p className="text-xs font-bold text-white mb-3 text-center">{config.gallery_title}</p>
            <div className="grid grid-cols-2 gap-2">
              {config.gallery_images.slice(0, 4).map((img: any, idx: number) => (
                <div key={idx} className="aspect-video rounded-lg bg-white/10 overflow-hidden border border-white/10">
                  {img.type === 'video'
                    ? <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-gray-500 bg-white/5"><span>🎬</span><span>Vídeo</span></div>
                    : <img src={img.url} alt="" className="w-full h-full object-cover" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer sticky CTA simulate */}
        <div className="relative mt-auto pt-8">
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black to-transparent flex justify-center pb-4">
            <button className="w-full max-w-[200px] py-3 rounded-xl text-xs text-white font-bold shadow-lg" style={{ backgroundColor: btnColor }}>
              {config.button_text}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard (form) preview
  const sizeMap: Record<string, number> = { small: 48, medium: 80, large: 120, full: 999 };
  const imgSize = sizeMap[config.hero_image_size] || 80;
  const shapeClass = config.hero_image_shape === 'circle' ? 'rounded-full' : config.hero_image_shape === 'square' ? 'rounded-none' : 'rounded-xl';
  const isBackground = config.hero_image_position === 'background';
  const isLeft = config.hero_image_position === 'left';

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-lg" style={{ background: '#0D0D0D' }}>
      {isBackground && config.hero_image && (
        <div className="absolute inset-0">
          <img src={config.hero_image} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-[#EB6608]/10 via-transparent to-[#EB6608]/5 pointer-events-none" />
      <div className={cn("relative p-4 flex flex-col items-center gap-3", isLeft && config.hero_image && "flex-row items-start")} style={{ minHeight: 320 }}>
        {config.hero_image && !isBackground && (
          <img src={config.hero_image} alt="Hero" className={cn("object-cover border border-[#EB6608]/30", shapeClass)}
            style={{ width: config.hero_image_size === 'full' ? '100%' : imgSize, height: config.hero_image_size === 'full' ? 'auto' : imgSize }} />
        )}
        <div className={cn("flex flex-col items-center gap-3 w-full", isLeft && "items-start")}>
          <h3 className={cn("text-sm font-bold text-white leading-tight", !isLeft && "text-center")}>{config.title || 'Título'}</h3>
          <p className={cn("text-[11px] text-gray-400", !isLeft && "text-center")}>{config.subtitle || 'Subtítulo'}</p>
          <div className="w-full space-y-2 px-2">
            <div className="bg-white/10 rounded-lg h-8 flex items-center px-3"><span className="text-[10px] text-gray-500">Nome completo</span></div>
            {config.email_enabled && (
              <div className="bg-white/10 rounded-lg h-8 flex items-center px-3"><span className="text-[10px] text-gray-500">Seu melhor email</span></div>
            )}
            <div className="bg-white/10 rounded-lg h-8 flex items-center px-3"><span className="text-[10px] text-gray-500">(00) 00000-0000</span></div>
            {config.custom_questions.filter((q: any) => q.question.trim()).map((q: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <span className="text-[9px] text-gray-500 pl-1">{q.question}{q.required && <span className="text-red-400 ml-0.5">*</span>}</span>
                {q.type === 'choice' ? (
                  <div className="space-y-1">
                    {q.options.filter((o: string) => o.trim()).map((opt: string, oi: number) => (
                      <div key={oi} className="bg-white/5 rounded-lg h-6 flex items-center px-3 gap-2">
                        <div className="w-3 h-3 rounded-full border border-gray-600" />
                        <span className="text-[9px] text-gray-500">{opt}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/10 rounded-lg h-7 flex items-center px-3"><span className="text-[9px] text-gray-500">Resposta</span></div>
                )}
              </div>
            ))}
          </div>
          <button className="w-full mx-2 h-9 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: btnColor }}>
            {config.button_text || 'Enviar'}
          </button>
          <p className="text-[9px] text-gray-600 text-center">Seus dados estão protegidos.</p>
        </div>
      </div>
    </div>
  );
}

function CaptureSettingsTab({ consultant }: { consultant: any }) {
  const queryClient = useQueryClient();
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [linkSuffix, setLinkSuffix] = useState('');
  const linkPrefix = `${window.location.origin}/c/`;
  const [captureForm, setCaptureForm] = useState({
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
    whatsapp_message: 'Olá! Vim pela página de captura e quero saber mais.',
    whatsapp_number: '',
    email_enabled: true,
    custom_questions: [] as Array<{ question: string; type: 'text' | 'choice'; required: boolean; options: string[] }>,
    template_type: 'standard' as 'standard' | 'landing',
    gallery_images: [] as Array<{ type?: 'image' | 'video'; url: string; caption?: string }>,
    gallery_title: 'Veja nossos resultados',
    logo_image: '',
    logo_position: 'left',
    logo_size: 'medium',
    compare_enabled: false,
    compare_title: 'Por que pagar caro no seguro se você pode pagar muito menos?',
    compare_traditional_items: [
      'Consulta de crédito',
      'Processo burocrático',
      'Atendimento demorado',
      'Preço varia pelo seu perfil',
      'Franquia obrigatória',
      'Renovação anual forçada'
    ],
    compare_topbrasil_items: [
      'Sem consulta de crédito',
      'Aprovação na hora',
      'Assistência 24h inclusa',
      'Preço justo pra todos',
      'Sem franquia surpresa',
      'Atendimento humanizado'
    ],
  });

  const { data: existingConfig } = useQuery({
    queryKey: ['capture-config', consultant?.id],
    queryFn: async () => {
      if (!consultant?.id) return null;
      const { data } = await supabase
        .from('capture_page_configs')
        .select('*')
        .eq('consultant_id', consultant.id)
        .maybeSingle();
      return data;
    },
    enabled: !!consultant?.id,
  });

  useEffect(() => {
    if (existingConfig) {
      setCaptureForm({
        title: existingConfig.title || captureForm.title,
        subtitle: existingConfig.subtitle || captureForm.subtitle,
        button_text: existingConfig.button_text || captureForm.button_text,
        button_color: existingConfig.button_color || '#EB6608',
        hero_image: existingConfig.hero_image || '',
        hero_image_size: (existingConfig as any).hero_image_size || 'medium',
        hero_image_position: (existingConfig as any).hero_image_position || 'top',
        hero_image_shape: (existingConfig as any).hero_image_shape || 'rounded',
        redirect_type: existingConfig.redirect_type || 'thank_you',
        redirect_url: existingConfig.redirect_url || '',
        whatsapp_message: existingConfig.whatsapp_message || captureForm.whatsapp_message,
        whatsapp_number: (existingConfig as any).whatsapp_number || '',
        email_enabled: (existingConfig as any).email_enabled ?? true,
        custom_questions: (existingConfig as any).custom_questions || [],
        template_type: (existingConfig as any).template_type || 'standard',
        gallery_images: (existingConfig as any).gallery_images || [],
        gallery_title: (existingConfig as any).gallery_title || 'Veja nossos resultados',
        logo_image: (existingConfig as any).logo_image || '',
        logo_position: (existingConfig as any).logo_position || 'left',
        logo_size: (existingConfig as any).logo_size || 'medium',
        compare_enabled: (existingConfig as any).compare_enabled ?? false,
        compare_title: (existingConfig as any).compare_title || 'Por que pagar caro no seguro se você pode pagar muito menos?',
        compare_traditional_items: (existingConfig as any).compare_traditional_items || [
          'Consulta de crédito', 'Processo burocrático', 'Atendimento demorado', 'Preço varia pelo seu perfil', 'Franquia obrigatória', 'Renovação anual forçada'
        ],
        compare_topbrasil_items: (existingConfig as any).compare_topbrasil_items || [
          'Sem consulta de crédito', 'Aprovação na hora', 'Assistência 24h inclusa', 'Preço justo pra todos', 'Sem franquia surpresa', 'Atendimento humanizado'
        ],
      });
    }
  }, [existingConfig]);

  useEffect(() => {
    setLinkSuffix(consultant?.quiz_slug || 'seu-slug');
  }, [consultant?.quiz_slug]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !consultant) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande (máx 5MB)'); return; }
    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `capture-logo-${consultant.id}-${Date.now()}.${fileExt}`;
      const filePath = `capture-logos/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('quiz-images').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('quiz-images').getPublicUrl(filePath);
      setCaptureForm(prev => ({ ...prev, logo_image: data.publicUrl }));
      toast.success('Logo carregada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !consultant) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande (máx 5MB)'); return; }
    setUploadingHero(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `capture-hero-${consultant.id}-${Date.now()}.${fileExt}`;
      const filePath = `capture-heroes/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('quiz-images').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('quiz-images').getPublicUrl(filePath);
      setCaptureForm(prev => ({ ...prev, hero_image: data.publicUrl }));
      toast.success('Imagem carregada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingHero(false);
    }
  };

  const handleSave = async () => {
    if (!consultant) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        consultant_id: consultant.id,
        organization_id: consultant.organization_id,
        title: captureForm.title,
        subtitle: captureForm.subtitle,
        button_text: captureForm.button_text,
        button_color: captureForm.button_color,
        hero_image: captureForm.hero_image || null,
        hero_image_size: captureForm.hero_image_size,
        hero_image_position: captureForm.hero_image_position,
        hero_image_shape: captureForm.hero_image_shape,
        redirect_type: captureForm.redirect_type,
        redirect_url: captureForm.redirect_url || null,
        whatsapp_message: captureForm.whatsapp_message,
        whatsapp_number: captureForm.whatsapp_number || null,
        email_enabled: captureForm.email_enabled,
        custom_questions: captureForm.custom_questions,
        template_type: captureForm.template_type,
        gallery_images: captureForm.gallery_images,
        gallery_title: captureForm.gallery_title,
        logo_image: captureForm.logo_image || null,
        logo_position: captureForm.logo_position,
        logo_size: captureForm.logo_size,
        compare_enabled: captureForm.compare_enabled,
        compare_title: captureForm.compare_title,
        compare_traditional_items: captureForm.compare_traditional_items.filter(Boolean),
        compare_topbrasil_items: captureForm.compare_topbrasil_items.filter(Boolean),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existingConfig) {
        const { error } = await supabase.from('capture_page_configs').update(payload as any).eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('capture_page_configs').insert(payload as any);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['capture-config'] });
      toast.success('Configurações de captura salvas!');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const fullLink = linkPrefix + linkSuffix;

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Página de Captura</CardTitle>
            <CardDescription>Configure sua página de captura de leads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 overflow-x-hidden min-w-0">
            {/* 1. Link da Página (topo) */}
            <div className="space-y-2">
              <Label>Link da Página de Captura</Label>
              <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input whitespace-nowrap select-all">
                  {linkPrefix}
                </span>
                <input
                  value={linkSuffix}
                  onChange={(e) => setLinkSuffix(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-transparent outline-none text-foreground min-w-0"
                  placeholder="seu-slug?utm_source=facebook"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => { navigator.clipboard.writeText(fullLink); toast.success('Link copiado!'); }}>
                  <Copy className="w-4 h-4 mr-2" />Copiar
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => window.open(fullLink, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />Abrir
                </Button>
              </div>
            </div>

            {/* 2. Template Selector */}
            <div className="space-y-2">
              <Label>Tipo de Página</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => setCaptureForm({ ...captureForm, template_type: 'standard' })}
                  className={cn("p-4 rounded-xl border-2 text-left transition-all", captureForm.template_type === 'standard' ? "border-primary bg-primary/10" : "border-border hover:border-primary/30")}>
                  <FileText className="w-5 h-5 mb-2 text-primary" />
                  <p className="text-sm font-semibold">Formulário</p>
                  <p className="text-xs text-muted-foreground">Formulário simples e direto</p>
                </button>
                <button type="button"
                  onClick={() => {
                    const newForm = { ...captureForm, template_type: 'landing' as const };
                    if (captureForm.template_type !== 'landing' && captureForm.custom_questions.length === 0) {
                      newForm.custom_questions = [
                        { question: 'Você trabalha atualmente com carteira assinada?', type: 'choice', required: true, options: ['Sim', 'Não, sou autônomo', 'Estou sem emprego no momento'] },
                        { question: 'Você já teve alguma experiência com vendas?', type: 'choice', required: true, options: ['Sim, já trabalhei com vendas', 'Nunca trabalhei mas tenho interesse', 'Não tenho experiência e não sei se é pra mim'] },
                        { question: 'Você tem veículo próprio?', type: 'choice', required: true, options: ['Sim, carro', 'Sim, moto', 'Não tenho'] },
                      ];
                    }
                    setCaptureForm(newForm);
                  }}
                  className={cn("p-4 rounded-xl border-2 text-left transition-all", captureForm.template_type === 'landing' ? "border-primary bg-primary/10" : "border-border hover:border-primary/30")}>
                  <Globe className="w-5 h-5 mb-2 text-primary" />
                  <p className="text-sm font-semibold">Landing Page</p>
                  <p className="text-xs text-muted-foreground">Hero + galeria + formulário</p>
                </button>
              </div>
            </div>

            {/* 3. Logo (landing only) */}
            {captureForm.template_type === 'landing' && (
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/30">
                <Label>Logo da Landing Page</Label>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                {captureForm.logo_image ? (
                  <div className="flex items-center gap-3">
                    <img src={captureForm.logo_image} alt="Logo" className="h-16 w-auto object-contain p-2 rounded-lg border border-border" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                        {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCaptureForm({ ...captureForm, logo_image: '' })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="w-full">
                    {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Enviar Logo
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Posição da Logo</Label>
                    <Select value={captureForm.logo_position} onValueChange={(v) => setCaptureForm({ ...captureForm, logo_position: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Esquerda</SelectItem>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="right">Direita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tamanho da Logo</Label>
                    <Select value={captureForm.logo_size} onValueChange={(v) => setCaptureForm({ ...captureForm, logo_size: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Pequeno</SelectItem>
                        <SelectItem value="medium">Médio</SelectItem>
                        <SelectItem value="large">Grande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Hero Image */}
            <div className="space-y-2">
              <Label>Imagem Hero (opcional)</Label>
              <input ref={heroInputRef} type="file" accept="image/*" onChange={handleHeroUpload} className="hidden" />
              {captureForm.hero_image ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <img src={captureForm.hero_image} alt="Hero" className="w-16 h-16 object-cover rounded-lg border border-border" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero}>
                        {uploadingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCaptureForm({ ...captureForm, hero_image: '' })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tamanho</Label>
                      <Select value={captureForm.hero_image_size} onValueChange={(v) => setCaptureForm({ ...captureForm, hero_image_size: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Pequeno</SelectItem>
                          <SelectItem value="medium">Médio</SelectItem>
                          <SelectItem value="large">Grande</SelectItem>
                          <SelectItem value="full">Largura total</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Posição</Label>
                      <Select value={captureForm.hero_image_position} onValueChange={(v) => setCaptureForm({ ...captureForm, hero_image_position: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Topo</SelectItem>
                          <SelectItem value="left">Lateral</SelectItem>
                          <SelectItem value="background">Fundo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Formato</Label>
                      <Select value={captureForm.hero_image_shape} onValueChange={(v) => setCaptureForm({ ...captureForm, hero_image_shape: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rounded">Arredondado</SelectItem>
                          <SelectItem value="circle">Circular</SelectItem>
                          <SelectItem value="square">Quadrado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero} className="w-full">
                  {uploadingHero ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Enviar imagem
                </Button>
              )}
            </div>

            {/* 5. Título / Subtítulo / Botão / Cor */}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={captureForm.title} onChange={(e) => setCaptureForm({ ...captureForm, title: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input value={captureForm.subtitle} onChange={(e) => setCaptureForm({ ...captureForm, subtitle: e.target.value })} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input value={captureForm.button_text} onChange={(e) => setCaptureForm({ ...captureForm, button_text: e.target.value })} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Cor do Botão</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={captureForm.button_color} onChange={(e) => setCaptureForm({ ...captureForm, button_color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-border" />
                <Input value={captureForm.button_color} onChange={(e) => setCaptureForm({ ...captureForm, button_color: e.target.value })}
                  className="font-mono w-32" maxLength={7} />
              </div>
            </div>

            {/* 6. Compare section (landing only) */}
            {captureForm.template_type === 'landing' && (
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Seção de Comparação</Label>
                    <p className="text-xs text-muted-foreground">Comparar Seguro Tradicional vs Top Brasil</p>
                  </div>
                  <Switch checked={captureForm.compare_enabled} onCheckedChange={(v) => setCaptureForm({ ...captureForm, compare_enabled: v })} />
                </div>
                {captureForm.compare_enabled && (
                  <div className="space-y-3 mt-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Título da Seção</Label>
                      <Input value={captureForm.compare_title} onChange={(e) => setCaptureForm({ ...captureForm, compare_title: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-red-500">✗ Seguro Tradicional</Label>
                        <textarea
                          value={captureForm.compare_traditional_items.join('\n')}
                          onChange={(e) => setCaptureForm({ ...captureForm, compare_traditional_items: e.target.value.split('\n') })}
                          className="w-full h-32 p-2 rounded-md border border-input bg-background text-sm resize-none"
                          placeholder="Item 1\nItem 2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-green-500">✓ Top Brasil</Label>
                        <textarea
                          value={captureForm.compare_topbrasil_items.join('\n')}
                          onChange={(e) => setCaptureForm({ ...captureForm, compare_topbrasil_items: e.target.value.split('\n') })}
                          className="w-full h-32 p-2 rounded-md border border-input bg-background text-sm resize-none"
                          placeholder="Item 1\nItem 2"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. Gallery config (landing only) */}
            {captureForm.template_type === 'landing' && (
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/30">
                <div className="space-y-2">
                  <Label>Título da Galeria</Label>
                  <Input value={captureForm.gallery_title} onChange={(e) => setCaptureForm({ ...captureForm, gallery_title: e.target.value })} maxLength={100} />
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label>Mídias da Galeria (Imagens ou Vídeos)</Label>
                    <p className="text-xs text-muted-foreground">Até 6 mídias. Suporta imagens (múltiplas de uma vez), vídeos do computador ou links do YouTube.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
                        input.onchange = async (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (!files.length || !consultant) return;
                          const remaining = 6 - captureForm.gallery_images.length;
                          const toUpload = files.slice(0, remaining);
                          if (toUpload.length < files.length) toast.info(`Limite de 6 mídias. Apenas ${toUpload.length} serão adicionadas.`);
                          for (const file of toUpload) {
                            if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: máx 5MB`); continue; }
                            try {
                              const ext = file.name.split('.').pop();
                              const path = `capture-gallery/${consultant.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
                              const { error } = await supabase.storage.from('quiz-images').upload(path, file, { upsert: true });
                              if (error) throw error;
                              const { data } = supabase.storage.from('quiz-images').getPublicUrl(path);
                              setCaptureForm(prev => ({ ...prev, gallery_images: [...prev.gallery_images, { type: 'image', url: data.publicUrl }] }));
                            } catch (err: any) { toast.error(err.message); }
                          }
                          toast.success(`${toUpload.length} imagem(ns) adicionada(s)!`);
                        };
                        input.click();
                      }} disabled={captureForm.gallery_images.length >= 6}>
                        <Image className="w-4 h-4 mr-1" /> Imagens ({captureForm.gallery_images.filter(i => i.type !== 'video').length})
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = 'video/mp4,video/webm,video/ogg';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file || !consultant) return;
                          if (file.size > 50 * 1024 * 1024) { toast.error('Vídeo muito grande (máx 50MB)'); return; }
                          try {
                            const ext = file.name.split('.').pop();
                            const path = `capture-gallery/${consultant.id}-vid-${Date.now()}.${ext}`;
                            const { error } = await supabase.storage.from('quiz-images').upload(path, file, { upsert: true });
                            if (error) throw error;
                            const { data } = supabase.storage.from('quiz-images').getPublicUrl(path);
                            setCaptureForm(prev => ({ ...prev, gallery_images: [...prev.gallery_images, { type: 'video', url: data.publicUrl }] }));
                            toast.success('Vídeo enviado!');
                          } catch (err: any) { toast.error(err.message); }
                        };
                        input.click();
                      }} disabled={captureForm.gallery_images.length >= 6}>
                        <Upload className="w-4 h-4 mr-1" /> Vídeo do PC
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Input value={videoUrlInput} onChange={(e) => setVideoUrlInput(e.target.value)} placeholder="Link YouTube/Vimeo (opcional)" className="h-[36px] text-xs" />
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        if (!videoUrlInput) return;
                        setCaptureForm(prev => ({ ...prev, gallery_images: [...prev.gallery_images, { type: 'video', url: videoUrlInput }] }));
                        setVideoUrlInput('');
                        toast.success('Vídeo adicionado!');
                      }} disabled={captureForm.gallery_images.length >= 6 || !videoUrlInput}>
                        + Link
                      </Button>
                    </div>
                  </div>
                  {captureForm.gallery_images.length > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {captureForm.gallery_images.map((img, idx) => (
                        <div key={idx} className="relative group border border-border rounded-lg bg-background p-1 space-y-1">
                          <div className="absolute z-10 top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {idx > 0 && (
                              <button type="button" onClick={() => {
                                const updated = [...captureForm.gallery_images];
                                [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                                setCaptureForm(prev => ({ ...prev, gallery_images: updated }));
                              }} className="w-6 h-6 rounded-full bg-background/90 border border-border text-foreground flex items-center justify-center">
                                <ArrowUp className="w-3 h-3" />
                              </button>
                            )}
                            {idx < captureForm.gallery_images.length - 1 && (
                              <button type="button" onClick={() => {
                                const updated = [...captureForm.gallery_images];
                                [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                                setCaptureForm(prev => ({ ...prev, gallery_images: updated }));
                              }} className="w-6 h-6 rounded-full bg-background/90 border border-border text-foreground flex items-center justify-center">
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                            <button type="button" onClick={() => setCaptureForm(prev => ({ ...prev, gallery_images: prev.gallery_images.filter((_, i) => i !== idx) }))}
                              className="w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {img.type === 'video' ? (
                            img.url.includes('youtube') || img.url.includes('youtu.be') || img.url.includes('vimeo') ? (
                              <div className="w-full aspect-square bg-muted flex items-center justify-center rounded text-xs text-muted-foreground break-all p-2 text-center overflow-hidden">
                                🎬 Vídeo:<br/><span className="truncate w-full inline-block">{img.url.substring(0, 40)}...</span>
                              </div>
                            ) : (
                              <video src={img.url} className="w-full aspect-square object-cover rounded" muted />
                            )
                          ) : (
                            <img src={img.url} alt="" className="w-full aspect-square object-cover rounded" />
                          )}
                          <Input placeholder="Legenda (opcional)" value={img.caption || ''} onChange={(e) => {
                            const updated = [...captureForm.gallery_images];
                            updated[idx] = { ...updated[idx], caption: e.target.value };
                            setCaptureForm({ ...captureForm, gallery_images: updated });
                          }} className="h-7 text-xs" maxLength={50} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. Redirect type */}
            <div className="space-y-2">
              <Label>Redirecionamento após envio</Label>
              <Select value={captureForm.redirect_type} onValueChange={(v) => setCaptureForm({ ...captureForm, redirect_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="thank_you">Página de obrigado (padrão)</SelectItem>
                  <SelectItem value="url">Link personalizado</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              {captureForm.redirect_type === 'thank_you' && (
                <p className="text-xs text-muted-foreground">Mostra uma página de obrigado informando que a equipe entrará em contato.</p>
              )}
            </div>
            {captureForm.redirect_type === 'url' && (
              <div className="space-y-2">
                <Label>URL de Redirecionamento</Label>
                <Input value={captureForm.redirect_url} onChange={(e) => setCaptureForm({ ...captureForm, redirect_url: e.target.value })}
                  placeholder="https://exemplo.com" maxLength={500} />
                <p className="text-xs text-muted-foreground">A página de obrigado mostrará um botão incentivando o lead a clicar neste link.</p>
              </div>
            )}
            {captureForm.redirect_type === 'whatsapp' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Número do WhatsApp</Label>
                  <Input value={captureForm.whatsapp_number} onChange={(e) => setCaptureForm({ ...captureForm, whatsapp_number: e.target.value })}
                    placeholder="5511999999999" maxLength={20} />
                  <p className="text-xs text-muted-foreground">Número com código do país (ex: 5511999999999)</p>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem padrão</Label>
                  <Input value={captureForm.whatsapp_message} onChange={(e) => setCaptureForm({ ...captureForm, whatsapp_message: e.target.value })}
                    placeholder="Olá! Vim pela página de captura..." maxLength={500} />
                </div>
              </div>
            )}

            {/* Email toggle (standard only) */}
            {captureForm.template_type === 'standard' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label>Campo de Email</Label>
                  <p className="text-xs text-muted-foreground">Mostrar campo de email no formulário</p>
                </div>
                <Switch
                  checked={captureForm.email_enabled}
                  onCheckedChange={(checked) => setCaptureForm({ ...captureForm, email_enabled: checked })}
                />
              </div>
            )}

            {/* Custom Questions (standard only) */}
            {captureForm.template_type === 'standard' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Perguntas Personalizadas</Label>
                    <p className="text-xs text-muted-foreground">Adicione perguntas extras ao formulário</p>
                  </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCaptureForm({
                    ...captureForm,
                    custom_questions: [...captureForm.custom_questions, { question: '', type: 'text', required: false, options: [] }]
                  })}
                >
                  <Plus className="w-4 h-4 mr-1" /> Pergunta
                </Button>
              </div>

              {captureForm.custom_questions.map((q, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border space-y-2 bg-muted/30">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={q.question}
                        onChange={(e) => {
                          const updated = [...captureForm.custom_questions];
                          updated[idx] = { ...updated[idx], question: e.target.value };
                          setCaptureForm({ ...captureForm, custom_questions: updated });
                        }}
                        placeholder="Texto da pergunta"
                        maxLength={200}
                      />
                      <div className="flex items-center gap-3">
                        <Select
                          value={q.type}
                          onValueChange={(v: 'text' | 'choice') => {
                            const updated = [...captureForm.custom_questions];
                            updated[idx] = { ...updated[idx], type: v, options: v === 'choice' ? (q.options.length ? q.options : ['']) : [] };
                            setCaptureForm({ ...captureForm, custom_questions: updated });
                          }}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Texto livre</SelectItem>
                            <SelectItem value="choice">Múltipla escolha</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => {
                              const updated = [...captureForm.custom_questions];
                              updated[idx] = { ...updated[idx], required: e.target.checked };
                              setCaptureForm({ ...captureForm, custom_questions: updated });
                            }}
                            className="rounded"
                          />
                          Obrigatória
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {idx > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                          const updated = [...captureForm.custom_questions];
                          [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                          setCaptureForm({ ...captureForm, custom_questions: updated });
                        }}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                      )}
                      {idx < captureForm.custom_questions.length - 1 && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                          const updated = [...captureForm.custom_questions];
                          [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                          setCaptureForm({ ...captureForm, custom_questions: updated });
                        }}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => {
                        const updated = captureForm.custom_questions.filter((_, i) => i !== idx);
                        setCaptureForm({ ...captureForm, custom_questions: updated });
                      }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {q.type === 'choice' && (
                    <div className="pl-2 space-y-1.5">
                      <Label className="text-xs">Opções</Label>
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const updated = [...captureForm.custom_questions];
                              const newOptions = [...updated[idx].options];
                              newOptions[optIdx] = e.target.value;
                              updated[idx] = { ...updated[idx], options: newOptions };
                              setCaptureForm({ ...captureForm, custom_questions: updated });
                            }}
                            placeholder={`Opção ${optIdx + 1}`}
                            className="h-8 text-xs"
                            maxLength={100}
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                            const updated = [...captureForm.custom_questions];
                            updated[idx] = { ...updated[idx], options: updated[idx].options.filter((_, i) => i !== optIdx) };
                            setCaptureForm({ ...captureForm, custom_questions: updated });
                          }}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                        const updated = [...captureForm.custom_questions];
                        updated[idx] = { ...updated[idx], options: [...updated[idx].options, ''] };
                        setCaptureForm({ ...captureForm, custom_questions: updated });
                      }}>
                        <Plus className="w-3 h-3 mr-1" /> Opção
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Preview</h3>
          <CapturePagePreview config={captureForm} />
        </div>
      </div>
    </div>
  );
}

export function ConsultantSettings() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: consultant, isLoading } = useQuery({
    queryKey: ['current-consultant-settings'],
    queryFn: getCurrentConsultant,
  });
  
  // Função para verificar se o slug está disponível
  const checkSlugAvailability = async (slug: string): Promise<boolean> => {
    if (!slug || !consultant || slug === consultant.quiz_slug) {
      setSlugError(null);
      return true;
    }

    setIsCheckingSlug(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('quiz_slug', slug)
        .neq('id', consultant.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSlugError('Este slug já está em uso. Escolha outro.');
        return false;
      }

      setSlugError(null);
      return true;
    } catch (error) {
      console.error('Erro ao verificar slug:', error);
      return false;
    } finally {
      setIsCheckingSlug(false);
    }
  };

  const [formData, setFormData] = useState({
    quiz_slug: '',
    quiz_cover_image: '',
    quiz_image_position: 'center',
    quiz_image_size: 'medium',
    quiz_image_shape: 'rounded',
    whatsapp_button_url: '',
    pixel_id: '',
    username: '',
  });

  useEffect(() => {
    if (consultant) {
      console.log('🔵 [Settings] Carregando dados do consultor:', {
        quiz_cover_image: consultant.quiz_cover_image,
        username: consultant.username,
      });
      setFormData({
        quiz_slug: consultant.quiz_slug || '',
        quiz_cover_image: consultant.quiz_cover_image || '',
        quiz_image_position: consultant.quiz_image_position || 'center',
        quiz_image_size: consultant.quiz_image_size || 'medium',
        quiz_image_shape: consultant.quiz_image_shape || 'rounded',
        whatsapp_button_url: consultant.whatsapp_button_url || '',
        pixel_id: consultant.pixel_id || '',
        username: consultant.username || '',
      });
    }
  }, [consultant]);

  // Upload de imagem - SALVA AUTOMATICAMENTE NO BANCO
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !consultant) {
      console.error('❌ Upload cancelado: file ou consultant ausente', { file: !!file, consultant: !!consultant });
      return;
    }

    console.log('🔵 Iniciando upload da imagem...', { consultantId: consultant.id });

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }

    setUploading(true);

    try {
      // Gerar nome único
      const fileExt = file.name.split('.').pop();
      const fileName = `${consultant.id}-${Date.now()}.${fileExt}`;
      const filePath = `quiz-covers/${fileName}`;

      console.log('🔵 Fazendo upload para storage:', filePath);

      // Upload para Supabase Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('❌ Erro no upload para storage:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload concluído:', uploadData);

      // Obter URL pública
      const { data } = supabase.storage
        .from('quiz-images')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;
      console.log('🔵 URL pública:', publicUrl);

      // SALVAR AUTOMATICAMENTE NO BANCO DE DADOS
      console.log('🔵 Salvando no banco para usuário:', consultant.id);
      
      const { error: updateError, data: updateData } = await supabase
        .from('users')
        .update({ 
          quiz_cover_image: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', consultant.id)
        .select('id, quiz_cover_image');

      if (updateError) {
        console.error('❌ Erro ao salvar no banco:', updateError);
        throw updateError;
      }

      console.log('✅ Salvo no banco:', updateData);

      // Atualizar state local
      setFormData(prev => ({ ...prev, quiz_cover_image: publicUrl }));
      
      // Invalidar cache para atualizar em todos os lugares
      queryClient.invalidateQueries({ queryKey: ['current-consultant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['consultant-data'] });
      queryClient.invalidateQueries({ queryKey: ['consultant-by-slug'] });
      
      toast.success('Imagem salva automaticamente!');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setFormData({ ...formData, quiz_cover_image: '' });
  };

  // Upload de foto de perfil
  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !consultant) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }

    setUploadingProfilePhoto(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${consultant.id}-${Date.now()}.${fileExt}`;
      const filePath = `profile-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('quiz-images')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          profile_photo: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', consultant.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['current-consultant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-layout'] });
      toast.success('Foto de perfil atualizada!');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(error.message || 'Erro ao enviar foto');
    } finally {
      setUploadingProfilePhoto(false);
    }
  };

  const removeProfilePhoto = async () => {
    if (!consultant) return;
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          profile_photo: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', consultant.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['current-consultant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-layout'] });
      toast.success('Foto de perfil removida!');
    } catch (error: any) {
      toast.error('Erro ao remover foto');
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!consultant) throw new Error('Usuário não encontrado');
      
      // Verificar slug antes de salvar
      if (data.quiz_slug !== consultant.quiz_slug) {
        const slugAvailable = await checkSlugAvailability(data.quiz_slug);
        if (!slugAvailable) {
          throw new Error('Este slug já está em uso. Escolha outro.');
        }
      }
      
      const { error } = await supabase
        .from('users')
        .update({
          quiz_slug: data.quiz_slug,
          quiz_cover_image: data.quiz_cover_image,
          quiz_image_position: data.quiz_image_position,
          quiz_image_size: data.quiz_image_size,
          quiz_image_shape: data.quiz_image_shape,
          whatsapp_button_url: data.whatsapp_button_url,
          pixel_id: data.pixel_id,
          username: data.username || undefined,
        })
        .eq('id', consultant.id);

      if (error) {
        // Tratar erro de slug ou username duplicado
        if (error.code === '23505') {
          if (error.message?.includes('quiz_slug')) {
            setSlugError('Este slug já está em uso.');
            throw new Error('Este slug já está em uso. Escolha outro.');
          }
          if (error.message?.includes('username')) {
            throw new Error('Este nome de usuário já está em uso. Escolha outro.');
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidar todos os caches relacionados ao consultor
      queryClient.invalidateQueries({ queryKey: ['current-consultant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['consultant-by-slug'] });
      queryClient.invalidateQueries({ queryKey: ['consultant'] });
      queryClient.invalidateQueries({ queryKey: ['consultant-data'] });
      
      // Notificar outras abas/janelas sobre a atualização
      if (consultant?.quiz_slug) {
        localStorage.setItem(`consultant-updated:${consultant.quiz_slug}`, Date.now().toString());
      }
      
      toast.success('Configurações atualizadas!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const copyQuizLink = () => {
    if (formData.quiz_slug) {
      navigator.clipboard.writeText(getQuizUrl(formData.quiz_slug));
      toast.success('Link copiado!');
    }
  };

  const openQuizLink = () => {
    if (formData.quiz_slug) {
      window.open(getQuizUrl(formData.quiz_slug), '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="no-x-scroll h-full flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden w-full max-w-full">
        <div className="min-w-0 flex-shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Personalize seu quiz e tracking</p>
        </div>

        <Tabs defaultValue="quiz" className="flex-1 flex flex-col w-full overflow-hidden">
          <TabsList className="w-full overflow-x-auto flex flex-nowrap gap-1 flex-shrink-0">
            <TabsTrigger value="quiz" className="text-xs sm:text-sm px-3 whitespace-nowrap">Quiz</TabsTrigger>
            <TabsTrigger value="capture" className="text-xs sm:text-sm px-3 whitespace-nowrap">Captura</TabsTrigger>
            <TabsTrigger value="tracking" className="text-xs sm:text-sm px-3 whitespace-nowrap">Tracking</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs sm:text-sm px-3 whitespace-nowrap">WhatsApp</TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm px-3 whitespace-nowrap">Conta</TabsTrigger>
          </TabsList>

        {/* Tab: Quiz */}
        <TabsContent value="quiz" className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Personalizar Quiz</CardTitle>
              <CardDescription>Configure seu quiz personalizado para capturar leads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 overflow-x-hidden min-w-0">
              <div className="space-y-2">
                <Label htmlFor="quiz_slug">
                  Slug do Quiz
                  <span className="text-xs text-muted-foreground ml-2">
                    (apenas letras, números e hífens)
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    id="quiz_slug"
                    value={formData.quiz_slug}
                    onChange={(e) => {
                      // Validar: apenas letras minúsculas, números e hífens
                      const slug = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '-')
                        .replace(/--+/g, '-')
                        .replace(/^-+/, '');
                      setFormData({ ...formData, quiz_slug: slug });
                      
                      // Verificar disponibilidade após 500ms
                      if (slugCheckTimeoutRef.current) {
                        clearTimeout(slugCheckTimeoutRef.current);
                      }
                      slugCheckTimeoutRef.current = setTimeout(() => {
                        checkSlugAvailability(slug);
                      }, 500);
                    }}
                    placeholder="seu-nome"
                    className={cn(
                      "font-mono pr-10",
                      slugError && "border-destructive"
                    )}
                  />
                  {isCheckingSlug && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!isCheckingSlug && formData.quiz_slug && !slugError && consultant?.quiz_slug !== formData.quiz_slug && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                </div>
                {slugError && (
                  <p className="text-xs text-destructive">{slugError}</p>
                )}
                <div className="space-y-2">
                  <Label>Link do Quiz</Label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full overflow-x-hidden">
                    <code className="text-xs bg-muted px-3 py-2 rounded flex-1 min-w-0 break-all">
                      {getQuizUrl(formData.quiz_slug || 'seu-slug')}
                    </code>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyQuizLink}
                        disabled={!formData.quiz_slug}
                        className="shrink-0 w-full sm:w-auto"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openQuizLink}
                        disabled={!formData.quiz_slug}
                        className="shrink-0 w-full sm:w-auto"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Image Upload with Live Preview */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Imagem de Capa do Quiz</Label>
                
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
                  {/* Left Column: Upload & Settings */}
                  <div className="space-y-4">
                    {/* Upload Section */}
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex-1"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Fazer Upload
                            </>
                          )}
                        </Button>
                        {formData.quiz_cover_image && (
                          <Button size="icon" variant="destructive" onClick={removeImage}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">ou cole uma URL</span>
                        </div>
                      </div>

                      <Input
                        value={formData.quiz_cover_image}
                        onChange={(e) => setFormData({ ...formData, quiz_cover_image: e.target.value })}
                        placeholder="https://exemplo.com/imagem.jpg"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tamanho recomendado: 400x400px, máximo 5MB
                      </p>
                    </div>

                    {/* Image Customization Options */}
                    {formData.quiz_cover_image && (
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label>Posição da Imagem</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'top', label: 'Acima' },
                              { value: 'center', label: 'Centro' },
                              { value: 'bottom', label: 'Abaixo' }
                            ].map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setFormData({ ...formData, quiz_image_position: value })}
                                className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                                  formData.quiz_image_position === value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-muted-foreground'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Tamanho da Imagem</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'small', label: 'Pequena', size: '200px' },
                              { value: 'medium', label: 'Média', size: '300px' },
                              { value: 'large', label: 'Grande', size: '400px' }
                            ].map(({ value, label, size }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setFormData({ ...formData, quiz_image_size: value })}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                  formData.quiz_image_size === value
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border hover:border-muted-foreground'
                                }`}
                              >
                                <div className="text-sm font-medium">{label}</div>
                                <div className="text-xs text-muted-foreground">{size}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Formato da Imagem</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'rounded', label: 'Arredondada' },
                              { value: 'circle', label: 'Circular' },
                              { value: 'square', label: 'Quadrada' }
                            ].map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setFormData({ ...formData, quiz_image_shape: value })}
                                className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                                  formData.quiz_image_shape === value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-muted-foreground'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Live Preview - Hidden on mobile */}
                  <div className="space-y-2 hidden lg:block">
                    <Label>Preview do Quiz</Label>
                    <div className="bg-[#0D0D0D] border border-border rounded-lg p-4 min-h-[400px] overflow-hidden">
                      <div className="space-y-4 text-center">
                        {/* Logo Preview */}
                        <div className="text-white font-bold text-lg">TOP BRASIL</div>
                        <div className="text-gray-400 text-xs">PROTEÇÃO VEICULAR</div>

                        {/* Image Preview - Position: Top */}
                        {formData.quiz_cover_image && formData.quiz_image_position === 'top' && (
                          <div className="flex justify-center">
                            <div className="relative">
                              {/* Shadow that matches shape */}
                              <div className={`absolute inset-0 bg-[#EB6608] opacity-40 blur-xl ${
                                formData.quiz_image_shape === 'circle' ? 'rounded-full' :
                                formData.quiz_image_shape === 'square' ? 'rounded-lg' : 'rounded-2xl'
                              }`} style={{ transform: 'scale(1.1)' }}></div>
                              <img
                                src={formData.quiz_cover_image}
                                alt="Preview"
                                className={`relative object-cover border-2 border-[#EB6608]/30 ${
                                  formData.quiz_image_size === 'small' ? 'w-24 h-24' :
                                  formData.quiz_image_size === 'large' ? 'w-40 h-40' : 'w-32 h-32'
                                } ${
                                  formData.quiz_image_shape === 'circle' ? 'rounded-full' :
                                  formData.quiz_image_shape === 'square' ? 'rounded-none' : 'rounded-2xl'
                                }`}
                              />
                            </div>
                          </div>
                        )}

                        {/* Title */}
                        <div>
                          <h2 className="text-lg font-bold text-white mb-1">
                            Você Tem o Perfil Para Ser um Consultor{' '}
                            <span className="text-[#EB6608]">TOP Brasil?</span>
                          </h2>
                          <p className="text-gray-400 text-xs">
                            Descubra em menos de 60 segundos...
                          </p>
                        </div>

                        {/* Image Preview - Position: Center */}
                        {formData.quiz_cover_image && formData.quiz_image_position === 'center' && (
                          <div className="flex justify-center">
                            <div className="relative">
                              {/* Shadow that matches shape */}
                              <div className={`absolute inset-0 bg-[#EB6608] opacity-40 blur-xl ${
                                formData.quiz_image_shape === 'circle' ? 'rounded-full' :
                                formData.quiz_image_shape === 'square' ? 'rounded-lg' : 'rounded-2xl'
                              }`} style={{ transform: 'scale(1.1)' }}></div>
                              <img
                                src={formData.quiz_cover_image}
                                alt="Preview"
                                className={`relative object-cover border-2 border-[#EB6608]/30 ${
                                  formData.quiz_image_size === 'small' ? 'w-24 h-24' :
                                  formData.quiz_image_size === 'large' ? 'w-40 h-40' : 'w-32 h-32'
                                } ${
                                  formData.quiz_image_shape === 'circle' ? 'rounded-full' :
                                  formData.quiz_image_shape === 'square' ? 'rounded-none' : 'rounded-2xl'
                                }`}
                              />
                            </div>
                          </div>
                        )}

                        {/* Image Preview - Position: Bottom */}
                        {formData.quiz_cover_image && formData.quiz_image_position === 'bottom' && (
                          <div className="flex justify-center">
                            <div className="relative">
                              {/* Shadow that matches shape */}
                              <div className={`absolute inset-0 bg-[#EB6608] opacity-40 blur-xl ${
                                formData.quiz_image_shape === 'circle' ? 'rounded-full' :
                                formData.quiz_image_shape === 'square' ? 'rounded-lg' : 'rounded-2xl'
                              }`} style={{ transform: 'scale(1.1)' }}></div>
                              <img
                                src={formData.quiz_cover_image}
                                alt="Preview"
                                className={`relative object-cover border-2 border-[#EB6608]/30 ${
                                  formData.quiz_image_size === 'small' ? 'w-24 h-24' :
                                  formData.quiz_image_size === 'large' ? 'w-40 h-40' : 'w-32 h-32'
                                } ${
                                  formData.quiz_image_shape === 'circle' ? 'rounded-full' :
                                  formData.quiz_image_shape === 'square' ? 'rounded-none' : 'rounded-2xl'
                                }`}
                              />
                            </div>
                          </div>
                        )}

                        {/* Placeholder when no image */}
                        {!formData.quiz_cover_image && (
                          <div className="flex justify-center">
                            <div className="w-32 h-32 bg-[#2A2A2A] rounded-2xl flex items-center justify-center border border-[#EB6608]/20">
                              <span className="text-gray-500 text-sm">Sem imagem</span>
                            </div>
                          </div>
                        )}

                        {/* Button Preview */}
                        <button className="w-full bg-[#EB6608] text-white font-semibold py-2 rounded-lg text-sm">
                          Começar Avaliação Agora
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              <div className="space-y-2">
                <Label htmlFor="whatsapp_button_url">Link do Botão WhatsApp</Label>
                <Input
                  id="whatsapp_button_url"
                  value={formData.whatsapp_button_url}
                  onChange={(e) => setFormData({ ...formData, whatsapp_button_url: e.target.value })}
                  placeholder="https://wa.me/5511999999999?text=Olá!"
                />
                <p className="text-xs text-muted-foreground">
                  Cole um link completo (ex: https://wa.me/5511999999999?text=Olá!) ou apenas o número com DDD (ex: 5511999999999).
                  Deixe em branco para usar o padrão.
                </p>
              </div>

              <Button 
                onClick={() => updateMutation.mutate(formData)} 
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>

          {/* Editor de Perguntas */}
          <QuizQuestionsEditor />
        </TabsContent>

        {/* Tab: Captura */}
        <TabsContent value="capture" className="flex-1 overflow-y-auto overflow-x-hidden">
          <CaptureSettingsTab consultant={consultant} />
        </TabsContent>

        {/* Tab: Tracking */}
        <TabsContent value="tracking" className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-full overflow-x-hidden space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Tracking & Pixel</CardTitle>
                <CardDescription>Configure seu pixel para rastrear conversões</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 overflow-x-hidden min-w-0">
                <div className="space-y-2">
                  <Label htmlFor="pixel_id">Meta Pixel ID</Label>
                  <Input
                    id="pixel_id"
                    value={formData.pixel_id}
                    onChange={(e) => setFormData({ ...formData, pixel_id: e.target.value })}
                    placeholder="123456789012345"
                  />
                  <p className="text-xs text-muted-foreground">
                    Seu Pixel ID do Facebook/Meta para tracking de conversões no seu quiz
                  </p>
                </div>

                <Button 
                  onClick={() => updateMutation.mutate(formData)} 
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: WhatsApp */}
        <TabsContent value="whatsapp" className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-full overflow-x-hidden space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Conexão WhatsApp</CardTitle>
                <CardDescription>Configure sua instância do WhatsApp para o CRM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 overflow-x-hidden min-w-0">
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-sm font-medium">Para conectar seu WhatsApp:</span>
                  </div>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-5">
                    <li>Acesse o CRM (menu lateral)</li>
                    <li>Clique em "Conectar WhatsApp"</li>
                    <li>Escaneie o QR Code com seu celular</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <Label>Seu Nome de Usuário (Instância)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">@</span>
                    <Input 
                      value={formData.username || ''} 
                      disabled
                      className="font-mono bg-muted max-w-full"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este é o identificador único da sua instância WhatsApp. 
                    Você pode alterá-lo na aba "Conta".
                  </p>
                </div>

                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/admin/crm'}
                  className="w-full sm:w-auto"
                >
                  Ir para o CRM
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Conta */}
        <TabsContent value="account" className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-full overflow-x-hidden space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Informações da Conta</CardTitle>
                <CardDescription>Dados do seu perfil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 overflow-x-hidden min-w-0">
              {/* Foto de Perfil */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Foto de Perfil</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {consultant?.profile_photo ? (
                      <img 
                        src={consultant.profile_photo} 
                        alt="Foto de perfil"
                        className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                        key={consultant.profile_photo}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/30">
                        <User className="w-8 h-8 text-primary/50" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoUpload}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        disabled={uploadingProfilePhoto}
                      >
                        {uploadingProfilePhoto ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Enviar foto
                          </>
                        )}
                      </Button>
                      {consultant?.profile_photo && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={removeProfilePhoto}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tamanho recomendado: 200x200px, máximo 5MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                {/* Theme Toggle */}
                <ThemeSelector />

                <div className="space-y-2">
                  <Label>Nome de Usuário</Label>
                  <Input 
                    value={formData.username} 
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                    placeholder="seuusuariotopbrasil"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome de usuário único usado para identificar sua instância WhatsApp
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input value={consultant?.full_name || ''} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={consultant?.email || ''} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Função</Label>
                  <Input value={consultant?.role === 'consultor' ? 'Consultor' : consultant?.role || ''} disabled />
                </div>

                <Button 
                  onClick={() => updateMutation.mutate(formData)} 
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </div>
  );
}
