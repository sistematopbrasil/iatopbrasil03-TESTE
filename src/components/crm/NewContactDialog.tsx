import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageSquare, Loader2, CheckCircle, User, Flame, ThermometerSun, Snowflake } from 'lucide-react';
import { normalizePhone, getPhoneVariants } from '@/lib/phone-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId?: string;
  userId?: string;
  organizationId?: string;
  onConversationCreated: (conversationId: string) => void;
}

interface LeadData {
  id: string;
  name: string | null;
  phone: string | null;
  age: number | null;
  location: string | null;
  temperature: 'hot' | 'warm' | 'cold' | null;
  lead_score: number | null;
  created_at: string;
}

export function NewContactDialog({ 
  open,
  onOpenChange,
  instanceId, 
  userId, 
  organizationId,
  onConversationCreated 
}: NewContactDialogProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [leadData, setLeadData] = useState<LeadData | null>(null);

  // Format phone with Brazilian mask
  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  }

  // Search for lead when phone changes
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      searchLead(digits);
    } else {
      setLeadData(null);
    }
  }, [phone]);

  async function searchLead(digits: string) {
    setIsSearching(true);
    try {
      // Format phone for search (with country code)
      const phoneWithCountry = digits.length === 11 ? `55${digits}` : digits;
      const phoneWithoutCountry = digits.length === 13 ? digits.slice(2) : digits;

      const { data, error } = await supabase
        .from('quiz_submissions_new')
        .select('id, name, phone, age, location, temperature, lead_score, created_at')
        .or(`phone.eq.${phoneWithCountry},phone.eq.${phoneWithoutCountry},phone.eq.${digits}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setLeadData(data as LeadData);
        if (data.name && !name) {
          setName(data.name);
        }
      } else {
        setLeadData(null);
      }
    } catch (error) {
      console.error('Error searching lead:', error);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreateContact() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Número de telefone inválido');
      return;
    }

    setIsCreating(true);
    try {
      // Normalizar telefone (sempre 13 dígitos com 55 + DDD + 9 + número)
      const formattedPhone = normalizePhone(digits);
      
      // Gerar variantes para busca (com e sem 9)
      const phoneVariants = getPhoneVariants(digits);

      // Check if conversation already exists (buscar por variantes)
      const { data: existingConv } = await supabase
        .from('crm_conversations')
        .select('id')
        .in('contact_phone', phoneVariants)
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (existingConv) {
        toast.info('Conversa já existe com este contato');
        onConversationCreated(existingConv.id);
        onOpenChange(false);
        resetForm();
        return;
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('crm_conversations')
        .insert({
          instance_id: instanceId,
          user_id: userId,
          organization_id: organizationId,
          contact_phone: formattedPhone,
          contact_name: name || null,
          lead_id: leadData?.id || null,
          status: 'open',
          unread_count: 0,
        })
        .select('id')
        .single();

      if (convError) throw convError;

      // Send initial message if provided
      if (initialMessage.trim() && newConv) {
        const { error: msgError } = await supabase.functions.invoke('crm-send-message', {
          body: {
            conversation_id: newConv.id,
            type: 'text',
            content: initialMessage.trim(),
          },
        });

        if (msgError) {
          console.error('Error sending initial message:', msgError);
          toast.warning('Conversa criada, mas erro ao enviar mensagem inicial');
        }
      }

      toast.success('Conversa criada com sucesso!');
      onConversationCreated(newConv.id);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast.error(error.message || 'Erro ao criar contato');
    } finally {
      setIsCreating(false);
    }
  }

  function resetForm() {
    setPhone('');
    setName('');
    setInitialMessage('');
    setLeadData(null);
  }

  function getTemperatureIcon(temp: string | null) {
    switch (temp) {
      case 'hot': return <Flame className="w-4 h-4 text-red-500" />;
      case 'warm': return <ThermometerSun className="w-4 h-4 text-amber-500" />;
      case 'cold': return <Snowflake className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  }

  function getTemperatureLabel(temp: string | null) {
    switch (temp) {
      case 'hot': return 'Quente';
      case 'warm': return 'Morno';
      case 'cold': return 'Frio';
      default: return '';
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Iniciar Nova Conversa
          </DialogTitle>
          <DialogDescription>
            Digite o número do WhatsApp para iniciar uma conversa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Input */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp *</Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={handlePhoneChange}
                className="glass border-border focus:border-primary pr-10"
                maxLength={16}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Contato (opcional)</Label>
            <Input
              id="name"
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass border-border focus:border-primary"
            />
          </div>

          {/* Lead Found Preview */}
          {leadData && (
            <Card className="glass p-4 border-success/30 bg-success/5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-success font-semibold text-sm">Lead Encontrado!</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{leadData.name || 'Sem nome'}</span>
                </div>
                {leadData.age && (
                  <p className="text-muted-foreground pl-6">{leadData.age} anos</p>
                )}
                {leadData.location && (
                  <p className="text-muted-foreground pl-6">{leadData.location}</p>
                )}
                <div className="flex items-center gap-2 pl-6">
                  {leadData.temperature && (
                    <Badge variant="outline" className="text-xs">
                      {getTemperatureIcon(leadData.temperature)}
                      <span className="ml-1">{getTemperatureLabel(leadData.temperature)}</span>
                    </Badge>
                  )}
                  {leadData.lead_score && (
                    <Badge variant="outline" className="text-xs">
                      {leadData.lead_score} pts
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pl-6 mt-2">
                  Quiz respondido {formatDistanceToNow(new Date(leadData.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
            </Card>
          )}

          {/* Initial Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem Inicial (opcional)</Label>
            <Textarea
              id="message"
              placeholder="Olá! Vi que você tem interesse em proteção veicular..."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="glass border-border focus:border-primary resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => { onOpenChange(false); resetForm(); }}
            className="glass"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreateContact}
            disabled={phone.replace(/\D/g, '').length < 10 || isCreating}
            className="bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Iniciar Conversa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
