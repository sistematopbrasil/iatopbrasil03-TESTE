import { useState, useEffect } from "react";
import { CheckCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logoTopBrasil from "@/assets/logo-top-brasil.png";
import type { Organization, QuizConfig } from "@/lib/organization-service";

interface ThankYouScreenProps {
  organization?: Organization | null;
  config?: QuizConfig | null;
}

export const ThankYouScreen = ({ organization, config }: ThankYouScreenProps) => {
  const [whatsappLink, setWhatsappLink] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Determine logo to display
  const logoUrl = config?.custom_logo_url || organization?.logo_url || logoTopBrasil;
  const thankYouMessage = config?.custom_thank_you_message || "Obrigado Por Participar!";

  useEffect(() => {
    const fetchWhatsAppLink = async () => {
      // First check if organization has a WhatsApp number
      if (organization?.whatsapp_number) {
        const phone = organization.whatsapp_number.replace(/\D/g, '');
        setWhatsappLink(`https://wa.me/${phone}?text=Quero%20participar!`);
        setIsLoading(false);
        return;
      }

      // Fall back to app_settings
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'whatsapp_thank_you_link')
          .maybeSingle();

        if (error) {
          console.error('Error fetching WhatsApp link:', error);
          // Fallback: Instagram da Top Brasil
          setWhatsappLink('https://www.instagram.com/topbrasilprotecao/');
          return;
        }
        
        if (data?.setting_value && data.setting_value.trim() !== '') {
          setWhatsappLink(data.setting_value);
        } else {
          // Fallback: Instagram da Top Brasil
          setWhatsappLink('https://www.instagram.com/topbrasilprotecao/');
        }
      } catch (error) {
        console.error('Error fetching WhatsApp link:', error);
        // Fallback: Instagram da Top Brasil
        setWhatsappLink('https://www.instagram.com/topbrasilprotecao/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWhatsAppLink();
  }, [organization]);

  const handleWhatsApp = () => {
    // Check for redirect URL first
    if (config?.redirect_url) {
      window.open(config.redirect_url, '_blank');
      return;
    }
    window.open(whatsappLink, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial opacity-60"></div>

      <div className="w-full max-w-2xl relative z-10 animate-slide-in-up">
        {/* Success Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary rounded-full blur-2xl opacity-50 animate-pulse-glow"></div>
            <CheckCircle className="h-20 w-20 text-primary relative z-10" />
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-2xl shadow-primary/20 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={logoUrl} alt={organization?.name || "TOP Brasil"} className="h-16 w-auto" />
          </div>

          {/* Thank You Message */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {thankYouMessage}
          </h1>

          <p className="text-lg text-muted-foreground mb-8">
            Sua avaliação foi concluída com sucesso.
          </p>

          {/* CTA Button */}
          <Button
            size="lg"
            onClick={handleWhatsApp}
            className="w-full text-lg py-6 shadow-glow hover:shadow-glow-sm"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Falar com um Consultor Agora
          </Button>

          <p className="text-sm text-muted-foreground mt-6">
            Dúvidas? Entre em contato através do WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
};
