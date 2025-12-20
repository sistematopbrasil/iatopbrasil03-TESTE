import { Phone, Calendar, MessageCircle, Flame, TrendingUp, Snowflake, GripVertical, Car, CreditCard, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import type { LeadTemperature } from '@/lib/lead-scoring';

interface LeadCardProps {
  lead: {
    id: string;
    name: string | null;
    phone: string | null;
    location: string | null;
    lead_score: number | null;
    temperature: LeadTemperature | null;
    created_at: string;
    utm_source: string | null;
    has_vehicle?: string | null;
    has_driver_license?: string | null;
    sales_experience?: string | null;
  };
  onWhatsAppClick?: (phone: string) => void;
  onOpenConversation?: (lead: any) => void;
  onClick?: () => void;
}

export function LeadCard({ lead, onWhatsAppClick, onOpenConversation, onClick }: LeadCardProps) {
  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenConversation) {
      onOpenConversation(lead);
    } else if (lead.phone && onWhatsAppClick) {
      onWhatsAppClick(lead.phone);
    }
  };
  
  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  // ✅ USAR TEMPERATURA DO BANCO (não calcular baseado em score)
  const getTemperatureColor = (temp: string | null) => {
    if (temp === 'hot') return 'from-orange-500 to-red-500';
    if (temp === 'warm') return 'from-yellow-500 to-orange-500';
    return 'from-blue-400 to-cyan-500';
  };

  const getTemperatureIcon = (temp: string | null) => {
    if (temp === 'hot') return <Flame className="w-3.5 h-3.5" />;
    if (temp === 'warm') return <TrendingUp className="w-3.5 h-3.5" />;
    return <Snowflake className="w-3.5 h-3.5" />;
  };

  const getTemperatureLabel = (temp: string | null) => {
    if (temp === 'hot') return 'Quente';
    if (temp === 'warm') return 'Morno';
    return 'Frio';
  };

  // Check qualification criteria
  const hasVehicle = lead.has_vehicle && lead.has_vehicle !== 'Não tenho veículo';
  const hasLicense = lead.has_driver_license?.toLowerCase().includes('sim');
  const hasExperience = lead.sales_experience?.toLowerCase().includes('já trabalho') || lead.sales_experience?.toLowerCase().includes('já trabalhei');

  return (
    <div 
      className="group relative bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing"
      onClick={handleCardClick}
    >
      {/* Glassmorphism hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-transparent rounded-xl opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
      
      <div className="relative space-y-3">
        {/* Header with drag indicator */}
        <div className="flex items-start gap-2">
          <div className="opacity-0 group-hover:opacity-50 transition-opacity pt-1">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {lead.name || 'Sem nome'}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(lead.created_at), "dd 'de' MMM", { locale: ptBR })}
                </p>
              </div>
              
              {/* Temperature badge - USANDO TEMPERATURA DO BANCO */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r ${getTemperatureColor(lead.temperature)} text-white text-xs font-medium shadow-sm`}>
                {getTemperatureIcon(lead.temperature)}
                <span>{getTemperatureLabel(lead.temperature)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Criteria - 3 most relevant */}
        <div className="space-y-1.5 pl-6 text-xs">
          <div className="flex items-center gap-2">
            <Car className={`w-3.5 h-3.5 ${hasVehicle ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className={hasVehicle ? 'text-foreground' : 'text-muted-foreground'}>
              {hasVehicle ? 'Possui veículo' : 'Sem veículo'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className={`w-3.5 h-3.5 ${hasLicense ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className={hasLicense ? 'text-foreground' : 'text-muted-foreground'}>
              {hasLicense ? 'Possui CNH' : 'Sem CNH'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className={`w-3.5 h-3.5 ${hasExperience ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className={hasExperience ? 'text-foreground' : 'text-muted-foreground'}>
              {hasExperience ? 'Exp. em vendas' : 'Sem experiência'}
            </span>
          </div>
        </div>

        {/* Conversation Button */}
        {lead.phone && (onOpenConversation || onWhatsAppClick) && (
          <div className="pl-6 pt-2 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              className="w-full group/btn hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all"
              onClick={handleButtonClick}
            >
              <MessageCircle className="w-4 h-4 mr-2 text-primary group-hover/btn:scale-110 transition-transform" />
              Abrir conversa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
