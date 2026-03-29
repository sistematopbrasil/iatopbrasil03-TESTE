import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Download, Calendar as CalendarIcon, MessageCircle, Trash2, RefreshCw, Filter, X, Flame, Thermometer, Snowflake } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { TemperatureBadge } from "@/components/ui/temperature-badge";
import { LeadScoreDisplay } from "@/components/leads/LeadScoreDisplay";
import type { LeadTemperature } from "@/lib/lead-scoring";

interface Lead {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  relationship_status: string | null;
  location: string | null;
  has_vehicle: string | null;
  has_driver_license: string | null;
  employment_status: string | null;
  current_job: string | null;
  sales_experience: string | null;
  vehicle_protection_experience: string | null;
  current_income: string | null;
  desired_income: string | null;
  motivation: string | null;
  completion_percentage: number;
  lead_score: number | null;
  temperature: LeadTemperature | null;
  lead_source: string;
  extra_answers?: any;
  pipeline_stage_id?: string | null;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

interface CrmTag {
  id: string;
  name: string;
  color: string;
}

type TemperatureFilter = 'all' | 'hot' | 'warm' | 'cold';
type SourceFilter = 'all' | 'quiz' | 'capture' | 'whatsapp' | 'recruitment';

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'capture': return 'Captura';
    case 'recruitment': return 'Recrutamento';
    case 'whatsapp': return 'WhatsApp';
    default: return 'Quiz';
  }
};

const getSourceBadgeClass = (source: string) => {
  switch (source) {
    case 'capture': return 'border-[#EB6608]/40 text-[#EB6608]';
    case 'recruitment': return 'border-blue-500/40 text-blue-500';
    case 'whatsapp': return 'border-green-500/40 text-green-500';
    default: return 'border-purple-500/40 text-purple-500';
  }
};

const isQuizLead = (source: string) => source === 'quiz';

export default function AdminLeads() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [temperatureFilter, setTemperatureFilter] = useState<TemperatureFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [cnh, setCnh] = useState("all");
  const [vehicle, setVehicle] = useState("all");
  const [employmentStatus, setEmploymentStatus] = useState("all");
  const [salesExperience, setSalesExperience] = useState("all");
  const [incomeRange, setIncomeRange] = useState("all");
  const [pipelineStageFilter, setPipelineStageFilter] = useState("all");
  const { toast } = useToast();

  // Buscar usuário atual com cache
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Buscar pipeline stages com cache
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser?.organization_id) return [];
      const { data } = await supabase
        .from('pipeline_stages')
        .select('id, name, color')
        .eq('organization_id', currentUser.organization_id)
        .order('order_index', { ascending: true });
      return data || [];
    },
    enabled: !!currentUser?.organization_id,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Buscar leads com useQuery e cache agressivo
  const { data: leads = [], isLoading: loading, refetch: fetchLeads } = useQuery({
    queryKey: ['leads', currentUser?.id, currentUser?.role, currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];
      
      let query = supabase
        .from('quiz_submissions_new')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtrar por consultant_id se não for super admin
      if (!isSuperAdmin(currentUser.role)) {
        query = query.eq('consultant_id', currentUser.id);
      } else {
        query = query.eq('organization_id', currentUser.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
    staleTime: 30 * 1000, // 30 segundos - mantém dados frescos por 30s
    gcTime: 5 * 60 * 1000, // 5 minutos no cache
    placeholderData: (previousData) => previousData, // Mantém dados antigos enquanto carrega
  });

  // ✅ REALTIME: Atualizar leads automaticamente quando novos chegarem
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_submissions_new',
        },
        (payload) => {
          console.log('📢 Lead atualizado em tempo real:', payload.eventType);
          // ✅ Invalidar todas as variantes da query de leads
          queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
          // ✅ Refetch explícito para garantir atualização imediata
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, queryClient, fetchLeads]);

  // ✅ Refetch ao montar a página para garantir dados atualizados
  useEffect(() => {
    if (currentUser) {
      fetchLeads();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrar leads usando useMemo para performance
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(lead =>
        lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.includes(searchQuery) ||
        lead.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(lead =>
        statusFilter === "complete" ? lead.completion_percentage === 100 : lead.completion_percentage < 100
      );
    }

    // Temperature filter
    if (temperatureFilter !== "all") {
      filtered = filtered.filter(lead => lead.temperature === temperatureFilter);
    }

    // Source filter
    if (sourceFilter !== "all") {
      filtered = filtered.filter(lead => (lead as any).lead_source === sourceFilter);
    }

    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter(lead => new Date(lead.created_at) >= dateRange.from!);
    }
    if (dateRange?.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(lead => new Date(lead.created_at) <= toDate);
    }

    // Advanced filters - usando includes() para match parcial
    if (cnh !== "all") {
      filtered = filtered.filter(lead => {
        const value = lead.has_driver_license?.toLowerCase() || '';
        if (cnh === "Sim") return value.includes('sim');
        if (cnh === "Não") return value.includes('não') || value === '';
        return true;
      });
    }
    if (vehicle !== "all") {
      filtered = filtered.filter(lead => {
        const value = lead.has_vehicle?.toLowerCase() || '';
        if (vehicle === "Carro") return value.includes('carro') && !value.includes('ambos');
        if (vehicle === "Moto") return value.includes('moto') && !value.includes('ambos');
        if (vehicle === "Ambos") return value.includes('ambos');
        if (vehicle === "Não") return value.includes('não') || value === '';
        return true;
      });
    }
    if (employmentStatus !== "all") {
      filtered = filtered.filter(lead => {
        const value = lead.employment_status?.toLowerCase() || '';
        if (employmentStatus === "CLT") return value.includes('clt') || value.includes('registrado');
        if (employmentStatus === "Autônomo") return value.includes('autônomo');
        if (employmentStatus === "Desempregado") return value.includes('desempregado');
        if (employmentStatus === "Empresário") return value.includes('negócio') || value.includes('próprio');
        if (employmentStatus === "Estudante") return value.includes('estudante');
        return true;
      });
    }
    if (salesExperience !== "all") {
      filtered = filtered.filter(lead => {
        const value = lead.sales_experience?.toLowerCase() || '';
        if (salesExperience === "Sim, trabalha") return value.includes('já trabalho') || value.includes('trabalho com vendas');
        if (salesExperience === "Já trabalhou") return value.includes('já trabalhei');
        if (salesExperience === "Nunca trabalhou") return value.includes('nunca');
        if (salesExperience === "Tem interesse") return value.includes('interesse');
        return true;
      });
    }
    if (incomeRange !== "all") {
      filtered = filtered.filter(lead => {
        const value = lead.current_income?.toLowerCase() || '';
        if (incomeRange === "Até R$1.500") return value.includes('menos') || value.includes('até') || value.includes('1.000') || value.includes('1.500');
        if (incomeRange === "R$1.500-R$3.000") return value.includes('1.500') && value.includes('3.000');
        if (incomeRange === "R$3.000-R$5.000") return value.includes('3.000') && value.includes('5.000');
        if (incomeRange === "Acima de R$5.000") return value.includes('acima') || value.includes('5.000');
        return true;
      });
    }

    // Pipeline stage filter
    if (pipelineStageFilter !== "all") {
      filtered = filtered.filter(lead => lead.pipeline_stage_id === pipelineStageFilter);
    }

    return filtered;
  }, [leads, searchQuery, statusFilter, temperatureFilter, sourceFilter, dateRange, cnh, vehicle, employmentStatus, salesExperience, incomeRange, pipelineStageFilter]);

  const setPreset = (days: number) => {
    if (days === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      setDateRange({ from: today, to: todayEnd });
    } else if (days === 1) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      setDateRange({ from: yesterday, to: yesterdayEnd });
    } else {
      setDateRange({
        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        to: new Date(),
      });
    }
  };

  const clearAdvancedFilters = () => {
    setCnh("all");
    setVehicle("all");
    setEmploymentStatus("all");
    setSalesExperience("all");
    setIncomeRange("all");
    setPipelineStageFilter("all");
  };

  const activeFiltersCount = [cnh, vehicle, employmentStatus, salesExperience, incomeRange, pipelineStageFilter].filter(f => f !== "all").length;

  // Abrir CRM com dados do lead
  const handleOpenCRM = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    
    if (!lead.phone) return;
    
    navigate('/admin/crm', { 
      state: { 
        openConversation: true, 
        phone: lead.phone, 
        leadData: lead 
      } 
    });
  };

  const handleDeleteLead = async () => {
    if (!deleteLeadId) return;
    
    try {
      const { error } = await supabase
        .from('quiz_submissions_new')
        .delete()
        .eq('id', deleteLeadId);

      if (error) throw error;

      toast({
        title: "Lead excluído",
        description: "O lead foi removido com sucesso.",
      });

      fetchLeads();
      setDeleteLeadId(null);
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Não foi possível excluir o lead. Tente novamente.",
      });
    }
  };

  // Funções de seleção em massa
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(filteredLeads.map(l => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum lead selecionado",
        description: "Selecione pelo menos um lead para excluir.",
      });
      return;
    }

    setDeletingMultiple(true);
    try {
      const { error } = await supabase
        .from('quiz_submissions_new')
        .delete()
        .in('id', selectedLeads);

      if (error) throw error;

      toast({
        title: "Leads excluídos",
        description: `${selectedLeads.length} leads foram removidos com sucesso.`,
      });

      setSelectedLeads([]);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Não foi possível excluir os leads. Tente novamente.",
      });
    } finally {
      setDeletingMultiple(false);
    }
  };

  const exportToCSV = () => {
    // Get pipeline stage names map
    const stageMap = new Map(pipelineStages.map(s => [s.id, s.name]));
    
    const headers = [
      'Nome',
      'Telefone',
      'Email',
      'Origem',
      'Idade',
      'Estado Civil',
      'Localização',
      'Possui Veículo',
      'Possui CNH',
      'Situação Profissional',
      'Trabalho Atual',
      'Experiência em Vendas',
      'Experiência com Proteção Veicular',
      'Renda Atual',
      'Renda Desejada',
      'Motivação',
      'Temperatura',
      'Quadro Pipeline',
      '% Conclusão',
      'Data'
    ];
    
    const rows = filteredLeads.map(lead => [
      lead.name || '',
      lead.phone || '',
      (lead as any).email || '',
      getSourceLabel(lead.lead_source),
      lead.age || '',
      lead.relationship_status || '',
      lead.location || '',
      lead.has_vehicle || '',
      lead.has_driver_license || '',
      lead.employment_status || '',
      lead.current_job || '',
      lead.sales_experience || '',
      lead.vehicle_protection_experience || '',
      lead.current_income || '',
      lead.desired_income || '',
      lead.motivation || '',
      lead.temperature === 'hot' ? 'Quente' : lead.temperature === 'warm' ? 'Morno' : lead.temperature === 'cold' ? 'Frio' : '',
      lead.pipeline_stage_id ? (stageMap.get(lead.pipeline_stage_id) || '') : '',
      lead.completion_percentage,
      format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    ]);

    // Use semicolon as separator for better Excel pt-BR compatibility
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Count leads by temperature
  const tempCounts = {
    hot: leads.filter(l => l.temperature === 'hot').length,
    warm: leads.filter(l => l.temperature === 'warm').length,
    cold: leads.filter(l => l.temperature === 'cold').length,
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden max-w-full">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os seus leads
          </p>
        </div>

        {/* Temperature Filter Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={temperatureFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTemperatureFilter('all')}
            >
              Todos ({leads.length})
            </Button>
            <Button
              variant={temperatureFilter === 'hot' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTemperatureFilter('hot')}
              className={temperatureFilter === 'hot' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              <Flame className="w-4 h-4 mr-1" />
              Quentes ({tempCounts.hot})
            </Button>
            <Button
              variant={temperatureFilter === 'warm' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTemperatureFilter('warm')}
              className={temperatureFilter === 'warm' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
            >
              <Thermometer className="w-4 h-4 mr-1" />
              Mornos ({tempCounts.warm})
            </Button>
            <Button
              variant={temperatureFilter === 'cold' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTemperatureFilter('cold')}
              className={temperatureFilter === 'cold' ? 'bg-blue-500 hover:bg-blue-600' : ''}
            >
              <Snowflake className="w-4 h-4 mr-1" />
              Frios ({tempCounts.cold})
          </Button>
          </div>

          {/* Source filter */}
          <div className="flex flex-wrap gap-2 border-l border-border pl-3 ml-1">
            <Button variant={sourceFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSourceFilter('all')}>
              Todas Origens
            </Button>
            <Button variant={sourceFilter === 'quiz' ? 'default' : 'outline'} size="sm" onClick={() => setSourceFilter('quiz')}
              className={sourceFilter === 'quiz' ? 'bg-purple-500 hover:bg-purple-600' : ''}>
              Quiz
            </Button>
            <Button variant={sourceFilter === 'capture' ? 'default' : 'outline'} size="sm" onClick={() => setSourceFilter('capture')}
              className={sourceFilter === 'capture' ? 'bg-[#EB6608] hover:bg-[#d45a07]' : ''}>
              Captura
            </Button>
            <Button variant={sourceFilter === 'whatsapp' ? 'default' : 'outline'} size="sm" onClick={() => setSourceFilter('whatsapp')}
              className={sourceFilter === 'whatsapp' ? 'bg-green-500 hover:bg-green-600' : ''}>
              WhatsApp
            </Button>
          </div>

          {/* Botão de exclusão em massa */}
          {selectedLeads.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={deletingMultiple}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir {selectedLeads.length} selecionados
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou localização..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Date presets */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreset(0)} className="flex-1 sm:flex-none">
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(1)} className="flex-1 sm:flex-none">
              Ontem
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(7)} className="flex-1 sm:flex-none">
              7 dias
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(30)} className="flex-1 sm:flex-none">
              30 dias
            </Button>
          </div>

          {/* Filters row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="complete">Completos</SelectItem>
                <SelectItem value="incomplete">Incompletos</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="truncate">
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      "Filtrar por data"
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={isMobile ? 1 : 2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Advanced Filters */}
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros Avançados
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select value={cnh} onValueChange={setCnh}>
                  <SelectTrigger>
                    <SelectValue placeholder="CNH" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">CNH: Todos</SelectItem>
                    <SelectItem value="Sim">Possui CNH</SelectItem>
                    <SelectItem value="Não">Não possui CNH</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={vehicle} onValueChange={setVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Veículo: Todos</SelectItem>
                    <SelectItem value="Carro">Carro</SelectItem>
                    <SelectItem value="Moto">Moto</SelectItem>
                    <SelectItem value="Ambos">Ambos</SelectItem>
                    <SelectItem value="Não">Não tem</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Situação Profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Situação: Todos</SelectItem>
                    <SelectItem value="CLT">CLT</SelectItem>
                    <SelectItem value="Autônomo">Autônomo</SelectItem>
                    <SelectItem value="Desempregado">Desempregado</SelectItem>
                    <SelectItem value="Empresário">Empresário</SelectItem>
                    <SelectItem value="Estudante">Estudante</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={salesExperience} onValueChange={setSalesExperience}>
                  <SelectTrigger>
                    <SelectValue placeholder="Experiência em Vendas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Experiência: Todos</SelectItem>
                    <SelectItem value="Sim, trabalha">Sim, trabalha</SelectItem>
                    <SelectItem value="Já trabalhou">Já trabalhou</SelectItem>
                    <SelectItem value="Nunca trabalhou">Nunca trabalhou</SelectItem>
                    <SelectItem value="Tem interesse">Tem interesse</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={incomeRange} onValueChange={setIncomeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Faixa de Renda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Renda: Todos</SelectItem>
                    <SelectItem value="Até R$1.500">Até R$1.500</SelectItem>
                    <SelectItem value="R$1.500-R$3.000">R$1.500 - R$3.000</SelectItem>
                    <SelectItem value="R$3.000-R$5.000">R$3.000 - R$5.000</SelectItem>
                    <SelectItem value="Acima de R$5.000">Acima de R$5.000</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={pipelineStageFilter} onValueChange={setPipelineStageFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Quadro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Quadro: Todos</SelectItem>
                    {pipelineStages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAdvancedFilters}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtros
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Action buttons row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => fetchLeads()} variant="outline" disabled={loading} className="w-full sm:w-auto">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button onClick={exportToCSV} variant="outline" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {filteredLeads.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">Nenhum lead encontrado</p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <div 
                key={lead.id}
                className={`bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors ${selectedLeads.includes(lead.id) ? 'border-primary bg-primary/5' : ''}`}
                onClick={() => setSelectedLead(lead)}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground break-words">
                        {lead.name || 'Sem nome'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 break-all">
                        📱 {lead.phone || 'Sem telefone'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {lead.temperature && (
                      <TemperatureBadge temperature={lead.temperature} size="sm" />
                    )}
                    <Badge variant="outline" className={`text-[10px] ${
                      (lead as any).lead_source === 'capture' ? 'border-[#EB6608]/40 text-[#EB6608]' :
                      (lead as any).lead_source === 'whatsapp' ? 'border-green-500/40 text-green-500' :
                      'border-purple-500/40 text-purple-500'
                    }`}>
                      {(lead as any).lead_source === 'capture' ? 'Captura' : (lead as any).lead_source === 'whatsapp' ? 'WhatsApp' : 'Quiz'}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    📅 {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  <div className="flex gap-2">
                    {lead.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                        onClick={(e) => handleOpenCRM(e, lead)}
                      >
                        <MessageCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteLeadId(lead.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="w-12 px-4">
                    <Checkbox
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                  </TableHead>
                  <TableHead className="px-4">Nome</TableHead>
                  <TableHead className="px-4">Telefone</TableHead>
                  <TableHead className="text-center px-4">Origem</TableHead>
                  <TableHead className="text-center px-4">Temp.</TableHead>
                  <TableHead className="text-center px-4">% Conclusão</TableHead>
                  <TableHead className="px-4">Data</TableHead>
                  <TableHead className="text-center px-4">WhatsApp</TableHead>
                  <TableHead className="text-center px-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className={`cursor-pointer border-border hover:bg-muted/50 ${selectedLeads.includes(lead.id) ? 'bg-muted/30' : ''}`}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeads.includes(lead.id)}
                          onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium px-4 max-w-[200px] truncate">
                        {lead.name || '-'}
                      </TableCell>
                      <TableCell className="px-4 text-sm">
                        {lead.phone || '-'}
                      </TableCell>
                      <TableCell className="text-center px-4">
                        <Badge variant="outline" className={`text-[10px] ${
                          (lead as any).lead_source === 'capture' ? 'border-[#EB6608]/40 text-[#EB6608]' :
                          (lead as any).lead_source === 'whatsapp' ? 'border-green-500/40 text-green-500' :
                          'border-purple-500/40 text-purple-500'
                        }`}>
                          {(lead as any).lead_source === 'capture' ? 'Captura' : (lead as any).lead_source === 'whatsapp' ? 'WhatsApp' : 'Quiz'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-4">
                        {lead.temperature ? (
                          <TemperatureBadge temperature={lead.temperature} size="sm" showLabel={false} />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          lead.completion_percentage === 100 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {lead.completion_percentage}%
                        </span>
                      </TableCell>
                      <TableCell className="px-4 text-sm">
                        {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center px-4">
                        {lead.phone && (
                          <button
                            onClick={(e) => handleOpenCRM(e, lead)}
                            className="inline-flex items-center justify-center p-2 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-all hover:scale-110"
                            title="Abrir conversa no CRM"
                          >
                            <MessageCircle className="h-5 w-5" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-center px-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteLeadId(lead.id);
                          }}
                          className="inline-flex items-center justify-center p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all hover:scale-110"
                          title="Excluir lead"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Lead Details Modal */}
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Lead</DialogTitle>
            </DialogHeader>
            {selectedLead && (
              <div className="space-y-4">
                {/* Lead Source & Email */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`${
                    (selectedLead as any).lead_source === 'capture' ? 'border-[#EB6608]/40 text-[#EB6608]' :
                    (selectedLead as any).lead_source === 'whatsapp' ? 'border-green-500/40 text-green-500' :
                    'border-purple-500/40 text-purple-500'
                  }`}>
                    Origem: {(selectedLead as any).lead_source === 'capture' ? 'Captura' : (selectedLead as any).lead_source === 'whatsapp' ? 'WhatsApp' : 'Quiz'}
                  </Badge>
                  {(selectedLead as any).email && (
                    <span className="text-sm text-muted-foreground">📧 {(selectedLead as any).email}</span>
                  )}
                </div>

                {/* Pipeline Stage Badge */}
                {selectedLead.pipeline_stage_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Quadro:</span>
                    {(() => {
                      const stage = pipelineStages.find(s => s.id === selectedLead.pipeline_stage_id);
                      if (!stage) return <span className="text-sm">-</span>;
                      return (
                        <Badge 
                          style={{ backgroundColor: `${stage.color}20`, color: stage.color, borderColor: stage.color }}
                          className="border"
                        >
                          <div 
                            className="w-2 h-2 rounded-full mr-1.5" 
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </Badge>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium break-words">{selectedLead.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium break-words">{selectedLead.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Idade</p>
                    <p className="font-medium">{selectedLead.age || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado Civil</p>
                    <p className="font-medium break-words">{selectedLead.relationship_status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Localização</p>
                    <p className="font-medium break-words">{selectedLead.location || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Possui Veículo</p>
                    <p className="font-medium break-words">{selectedLead.has_vehicle || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Possui CNH</p>
                    <p className="font-medium break-words">{selectedLead.has_driver_license || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Situação Profissional</p>
                    <p className="font-medium break-words">{selectedLead.employment_status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trabalho Atual</p>
                    <p className="font-medium break-words">{selectedLead.current_job || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Experiência em Vendas</p>
                    <p className="font-medium break-words">{selectedLead.sales_experience || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Experiência com Proteção Veicular</p>
                    <p className="font-medium break-words">{selectedLead.vehicle_protection_experience || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Renda Atual</p>
                    <p className="font-medium break-words">{selectedLead.current_income || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Renda Desejada</p>
                    <p className="font-medium break-words">{selectedLead.desired_income || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Motivação</p>
                  <p className="text-sm bg-muted p-3 rounded break-words">{selectedLead.motivation || '-'}</p>
                </div>

                {/* Respostas Adicionais (perguntas dinâmicas) */}
                {selectedLead.extra_answers && typeof selectedLead.extra_answers === 'object' && Object.keys(selectedLead.extra_answers).length > 0 && (
                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-semibold text-foreground mb-3">Respostas Adicionais</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(selectedLead.extra_answers)
                        .sort((a, b) => ((a[1] as any)?.order_index || 0) - ((b[1] as any)?.order_index || 0))
                        .map(([key, value]: [string, any]) => (
                          <div key={key}>
                            <p className="text-sm text-muted-foreground">{value?.question || key}</p>
                            <p className="font-medium break-words">{value?.answer || '-'}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Data de Submissão</p>
                  <p className="font-medium">
                    {format(new Date(selectedLead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteLeadId} onOpenChange={() => setDeleteLeadId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O lead será permanentemente excluído do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteLead} className="bg-red-500 hover:bg-red-600">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
