import { Button } from "@/components/ui/button";
import logoTopBrasil from "@/assets/logo-top-brasil.png";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { Organization, QuizConfig } from "@/lib/organization-service";

interface WelcomeScreenProps {
  onStart: () => void;
  organization?: Organization | null;
  config?: QuizConfig | null;
}

export const WelcomeScreen = ({ onStart, organization, config }: WelcomeScreenProps) => {
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [imagePosition, setImagePosition] = useState("center center");
  const [imageAspectRatio, setImageAspectRatio] = useState("auto");

  // Determine logo to display
  const logoUrl = config?.custom_logo_url || organization?.logo_url || logoTopBrasil;
  const welcomeMessage = config?.custom_welcome_message;

  useEffect(() => {
    const fetchImageSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['quiz_hero_image_url', 'quiz_image_position', 'quiz_image_aspect_ratio']);

        if (error) throw error;

        if (data) {
          data.forEach(setting => {
            if (setting.setting_key === 'quiz_hero_image_url' && setting.setting_value && setting.setting_value.trim() !== '') {
              const imageUrl = setting.setting_value;
              const cacheBuster = `?t=${Date.now()}`;
              const finalUrl = imageUrl.includes('?') ? `${imageUrl}&cb=${Date.now()}` : `${imageUrl}${cacheBuster}`;
              setHeroImageUrl(finalUrl);
            } else if (setting.setting_key === 'quiz_image_position') {
              const positions: Record<string, string> = {
                top: 'center top',
                center: 'center center',
                bottom: 'center bottom',
              };
              setImagePosition(positions[setting.setting_value] || 'center center');
            } else if (setting.setting_key === 'quiz_image_aspect_ratio') {
              const ratios: Record<string, string> = {
                free: 'auto',
                square: '1 / 1',
                '4:3': '4 / 3',
                '16:9': '16 / 9',
              };
              setImageAspectRatio(ratios[setting.setting_value] || 'auto');
            }
          });
        }
      } catch (error) {
        console.error('Error fetching image settings:', error);
      }
    };

    fetchImageSettings();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Radial gradient background effect */}
      <div className="absolute inset-0 bg-gradient-radial opacity-60"></div>
      
      <div className="w-full max-w-3xl relative z-10 animate-slide-in-up">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={logoUrl} 
            alt={organization?.name || "TOP Brasil"} 
            className="h-24 w-auto"
          />
        </div>

        {/* Main Content Card */}
        <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-2xl shadow-primary/20">
          {/* Headline */}
          {welcomeMessage ? (
            <h1 className="text-3xl md:text-5xl font-bold text-center mb-4 text-foreground leading-tight">
              {welcomeMessage}
            </h1>
          ) : (
            <h1 className="text-3xl md:text-5xl font-bold text-center mb-4 text-foreground leading-tight">
              Você Tem o Perfil Para Ser um Consultor
              <span className="text-primary"> TOP Brasil?</span>
            </h1>
          )}
          
          <p className="text-center text-lg text-muted-foreground mb-10">
            Descubra em menos de 60 segundos se você tem o que é preciso para transformar sua carreira
          </p>

          {/* Hero Image */}
          {heroImageUrl && (
            <div className="mb-10 relative group max-w-md mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-3xl opacity-30 blur-xl group-hover:opacity-40 transition duration-500"></div>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/30 border border-primary/20 bg-gradient-to-b from-primary/10 to-background">
                <img 
                  key={heroImageUrl}
                  src={heroImageUrl} 
                  alt="Consultor TOP Brasil" 
                  className="w-full h-auto object-cover max-h-[400px] md:max-h-[450px]"
                  style={{
                    objectPosition: imagePosition,
                    aspectRatio: imageAspectRatio,
                  }}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            </div>
          )}

          {/* CTA Button */}
          <Button
            onClick={onStart}
            size="lg"
            className="w-full text-lg py-6 shadow-glow hover:shadow-glow-sm"
          >
            Começar Avaliação Agora
          </Button>
        </div>
      </div>
    </div>
  );
};
