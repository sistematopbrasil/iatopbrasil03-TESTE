import { Phone, Calendar, MessageCircle, Flame, TrendingUp, Snowflake, GripVertical, Car, CreditCard, Briefcase, Shield, FileText, Globe, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { FunnelBadge } from '@/components/leads/FunnelBadge';
import type { LeadTemperature } from '@/lib/lead-scoring';
import type { FunnelType } from '@/lib/funnel-types';

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
    lead_source?: string;
    funnel_type?: FunnelType;
    has_vehicle?: string | null;
    has_driver_license?: string | null;
    sales_experience?: string | null;
    vehicle_protection_experience?: string | null;
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
  const hasProtectionExp = lead.vehicle_protection_experience?.toLowerCase() === 'sim';

  return (
    <div 
      className="group relative bg-card rounded-lg border border-border/80 p-2.5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-grab active:cursor-grabbing"
      onClick={handleCardClick}
    >
      <div className="relative space-y-1.5">
        {/* Header compacto */}
        <div className="flex items-start gap-1.5">
          <div className="opacity-0 group-hover:opacity-50 transition-opacity pt-0.5">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                  {lead.name || 'Sem nome'}
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(lead.created_at), "dd 'de' MMM", { locale: ptBR })}
                </p>
              </div>
              
              <div className="flex items-center gap-1 flex-wrap justify-end max-w-[60%]">
                {/* Funnel badge (compact para caber no card estreito do pipeline) */}
                <FunnelBadge funnel={lead.funnel_type} size="xs" compact />
                {/* Source badge */}
                {lead.lead_source && lead.lead_source !== 'quiz' && (
                  <span className={`text-[9px] px-1 py-0.5 rounded ${
                    lead.lead_source === 'capture' ? 'bg-[#EB6608]/20 text-[#EB6608]' : 'bg-green-500/20 text-green-500'
                  }`}>
                    {lead.lead_source === 'capture' ? 'Cap' : 'WA'}
                  </span>
                )}
                {/* Temperature badge compacto */}
                <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r ${getTemperatureColor(lead.temperature)} text-white text-[10px] font-medium`}>
                  {getTemperatureIcon(lead.temperature)}
                  <span>{getTemperatureLabel(lead.temperature)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Criteria compacto */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-4 text-[10px]">
          <div className="flex items-center gap-1">
            <Car className={`w-3 h-3 ${hasVehicle ? 'text-green-500' : 'text-muted-foreground/60'}`} />
            <span className={hasVehicle ? 'text-foreground' : 'text-muted-foreground/60'}>
              {hasVehicle ? 'Veículo' : 'S/ veículo'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <CreditCard className={`w-3 h-3 ${hasLicense ? 'text-green-500' : 'text-muted-foreground/60'}`} />
            <span className={hasLicense ? 'text-foreground' : 'text-muted-foreground/60'}>
              {hasLicense ? 'CNH' : 'S/ CNH'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Briefcase className={`w-3 h-3 ${hasExperience ? 'text-green-500' : 'text-muted-foreground/60'}`} />
            <span className={hasExperience ? 'text-foreground' : 'text-muted-foreground/60'}>
              {hasExperience ? 'Exp.' : 'S/ exp.'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className={`w-3 h-3 ${hasProtectionExp ? 'text-green-500' : 'text-muted-foreground/60'}`} />
            <span className={hasProtectionExp ? 'text-foreground' : 'text-muted-foreground/60'}>
              {hasProtectionExp ? 'Proteção' : 'S/ prot.'}
            </span>
          </div>
        </div>

        {/* Botão compacto */}
        {lead.phone && (onOpenConversation || onWhatsAppClick) && (
          <div className="pl-4 pt-1.5 border-t border-border/50">
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-6 text-[10px] hover:bg-primary/10 hover:text-primary"
              onClick={handleButtonClick}
            >
              <MessageCircle className="w-3 h-3 mr-1 text-primary" />
              Conversa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
