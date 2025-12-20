import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, getQuizUrl } from '@/lib/consultant-context';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Copy, ExternalLink, Upload, Trash2, Check, User } from 'lucide-react';
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
      setFormData({
        quiz_slug: consultant.quiz_slug || '',
        quiz_cover_image: (consultant as any).quiz_cover_image || '',
        quiz_image_position: (consultant as any).quiz_image_position || 'center',
        quiz_image_size: (consultant as any).quiz_image_size || 'medium',
        quiz_image_shape: (consultant as any).quiz_image_shape || 'rounded',
        whatsapp_button_url: (consultant as any).whatsapp_button_url || '',
        pixel_id: (consultant as any).pixel_id || '',
        username: (consultant as any).username || '',
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
      queryClient.invalidateQueries({ queryKey: ['current-consultant-settings'] });
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
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden w-full max-w-full box-border">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Personalize seu quiz e tracking</p>
      </div>

      <Tabs defaultValue="quiz" className="space-y-6 w-full overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 max-w-full overflow-hidden">
          <TabsTrigger value="quiz" className="text-xs sm:text-sm px-2 sm:px-4 truncate">Quiz</TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs sm:text-sm px-2 sm:px-4 truncate">Tracking</TabsTrigger>
          <TabsTrigger value="account" className="text-xs sm:text-sm px-2 sm:px-4 truncate">Conta</TabsTrigger>
        </TabsList>

        {/* Tab: Quiz */}
        <TabsContent value="quiz">
          <Card>
            <CardHeader>
              <CardTitle>Personalizar Quiz</CardTitle>
              <CardDescription>Configure seu quiz personalizado para capturar leads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                    {getQuizUrl(formData.quiz_slug || 'seu-slug')}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyQuizLink} disabled={!formData.quiz_slug}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={openQuizLink} disabled={!formData.quiz_slug}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
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
                  Link exibido após o lead completar o quiz (deixe em branco para usar o padrão)
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

        {/* Tab: Tracking */}
        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle>Tracking & Pixel</CardTitle>
              <CardDescription>Configure seu pixel para rastrear conversões</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
        </TabsContent>

        {/* Tab: Conta */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Conta</CardTitle>
              <CardDescription>Dados do seu perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Foto de Perfil */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Foto de Perfil</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {(consultant as any)?.profile_photo ? (
                      <img 
                        src={(consultant as any).profile_photo} 
                        alt="Foto de perfil"
                        className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                        key={(consultant as any).profile_photo}
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
                      {(consultant as any)?.profile_photo && (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
