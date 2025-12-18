import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
}

type TemperatureFilter = 'all' | 'hot' | 'warm' | 'cold';

export default function AdminLeads() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [temperatureFilter, setTemperatureFilter] = useState<TemperatureFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [cnh, setCnh] = useState("all");
  const [vehicle, setVehicle] = useState("all");
  const [employmentStatus, setEmploymentStatus] = useState("all");
  const [salesExperience, setSalesExperience] = useState("all");
  const [incomeRange, setIncomeRange] = useState("all");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const user = await getCurrentConsultant();
      setCurrentUser(user);
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchLeads();
    }
  }, [currentUser]);

  useEffect(() => {
    filterLeads();
  }, [searchQuery, statusFilter, temperatureFilter, dateRange, leads, cnh, vehicle, employmentStatus, salesExperience, incomeRange]);

  const fetchLeads = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('quiz_submissions_new')
        .select('*')
        .eq('completion_percentage', 100) // Filtrar apenas leads finalizados (não drafts)
        .order('created_at', { ascending: false });

      // Filtrar por consultant_id se não for super admin
      if (!isSuperAdmin(currentUser.role)) {
        query = query.eq('consultant_id', currentUser.id);
      } else {
        query = query.eq('organization_id', currentUser.organization_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
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

    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter(lead => new Date(lead.created_at) >= dateRange.from!);
    }
    if (dateRange?.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(lead => new Date(lead.created_at) <= toDate);
    }

    // Advanced filters
    if (cnh !== "all") {
      filtered = filtered.filter(lead => lead.has_driver_license === cnh);
    }
    if (vehicle !== "all") {
      filtered = filtered.filter(lead => lead.has_vehicle === vehicle);
    }
    if (employmentStatus !== "all") {
      filtered = filtered.filter(lead => lead.employment_status === employmentStatus);
    }
    if (salesExperience !== "all") {
      filtered = filtered.filter(lead => lead.sales_experience === salesExperience);
    }
    if (incomeRange !== "all") {
      filtered = filtered.filter(lead => lead.current_income === incomeRange);
    }

    setFilteredLeads(filtered);
  };

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
  };

  const activeFiltersCount = [cnh, vehicle, employmentStatus, salesExperience, incomeRange].filter(f => f !== "all").length;

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
    const headers = ['Nome', 'Telefone', 'Idade', 'Estado Civil', 'Localização', 'Possui Veículo', 'Possui CNH', 'Situação Profissional', 'Trabalho Atual', 'Experiência em Vendas', 'Experiência com Proteção Veicular', 'Renda Atual', 'Renda Desejada', 'Motivação', 'Score', 'Temperatura', '% Conclusão', 'Data'];
    const rows = filteredLeads.map(lead => [
      lead.name || '',
      lead.phone || '',
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
      lead.lead_score || 0,
      lead.temperature || '',
      lead.completion_percentage,
      format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
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
            Gerencie todos os leads do quiz
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
              🔥 Quentes ({tempCounts.hot})
            </Button>
            <Button
              variant={temperatureFilter === 'warm' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTemperatureFilter('warm')}
              className={temperatureFilter === 'warm' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
            >
              <Thermometer className="w-4 h-4 mr-1" />
              🌡️ Mornos ({tempCounts.warm})
            </Button>
            <Button
              variant={temperatureFilter === 'cold' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTemperatureFilter('cold')}
              className={temperatureFilter === 'cold' ? 'bg-blue-500 hover:bg-blue-600' : ''}
            >
              <Snowflake className="w-4 h-4 mr-1" />
            ❄️ Frios ({tempCounts.cold})
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
                    <SelectItem value="Sim, já trabalho com vendas">Sim, trabalha</SelectItem>
                    <SelectItem value="Já trabalhei">Já trabalhou</SelectItem>
                    <SelectItem value="Nunca trabalhei com vendas">Nunca trabalhou</SelectItem>
                    <SelectItem value="Tenho interesse em aprender">Tem interesse</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={incomeRange} onValueChange={setIncomeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Faixa de Renda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Renda: Todos</SelectItem>
                    <SelectItem value="Até R$1.500">Até R$1.500</SelectItem>
                    <SelectItem value="De R$1.500 a R$3.000">R$1.500 - R$3.000</SelectItem>
                    <SelectItem value="De R$3.000 a R$5.000">R$3.000 - R$5.000</SelectItem>
                    <SelectItem value="Acima de R$5.000">Acima de R$5.000</SelectItem>
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
            <Button onClick={fetchLeads} variant="outline" disabled={loading} className="w-full sm:w-auto">
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
                        className="h-8 px-2"
                        onClick={(e) => handleOpenCRM(e, lead)}
                      >
                        <MessageCircle className="h-4 w-4 text-primary" />
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
                    <TableCell colSpan={8} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                            className="inline-flex items-center justify-center p-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all hover:scale-110"
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
