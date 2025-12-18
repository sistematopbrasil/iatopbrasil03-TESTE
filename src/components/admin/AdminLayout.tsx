import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, Menu, Settings, BarChart3, Kanban, CalendarDays, Trophy, Target, MessageSquare, PieChart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RoleBasedRedirect } from "@/components/RoleBasedRedirect";
import { useTheme } from "next-themes";
import logoTopBrasil from "@/assets/logo-top-brasil.png";

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { theme, resolvedTheme } = useTheme();

  // Determina se está no modo claro
  const isLightMode = resolvedTheme === 'light' || theme === 'light';

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-layout'],
    queryFn: getCurrentConsultant,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você saiu do painel administrativo.",
    });
    navigate('/login');
  };

  // Menu para Super Admin
  const superAdminNavItems = [
    { path: '/admin/super', icon: BarChart3, label: 'Dashboard' },
    { path: '/admin/consultants', icon: Users, label: 'Consultores' },
    { path: '/admin/ranking', icon: Trophy, label: 'Ranking' },
    { path: '/admin/settings', icon: Settings, label: 'Configurações' },
  ];

  // Menu para Consultor (eventos ocultos por enquanto)
  const consultantNavItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/leads', icon: Target, label: 'Leads' },
    { path: '/admin/pipeline', icon: Kanban, label: 'Pipeline' },
    { path: '/admin/crm', icon: MessageSquare, label: 'CRM WhatsApp' },
    { path: '/admin/analytics', icon: PieChart, label: 'Analytics' },
    // { path: '/admin/events', icon: CalendarDays, label: 'Eventos' }, // Oculto temporariamente
    { path: '/admin/ranking', icon: Trophy, label: 'Ranking' },
    { path: '/admin/settings', icon: Settings, label: 'Configurações' },
  ];

  const navItems = currentUser && isSuperAdmin(currentUser.role)
    ? superAdminNavItems
    : consultantNavItems;

  const roleLabel = currentUser && isSuperAdmin(currentUser.role) ? 'Super Admin' : 'Consultor';
  const roleColorClass = currentUser && isSuperAdmin(currentUser.role) 
    ? 'bg-primary/10 text-primary' 
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

  // Sidebar completo para desktop
  const DesktopSidebar = () => (
    <div className="h-full bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <img 
          src={logoTopBrasil} 
          alt="TOP Brasil" 
          className={`h-12 w-auto mx-auto transition-all ${isLightMode ? 'brightness-0' : ''}`} 
        />
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => navigate(item.path)}
            >
              <Icon className="mr-2 h-5 w-5" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        {currentUser && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-2">
              {(currentUser as any).profile_photo ? (
                <img 
                  src={(currentUser as any).profile_photo} 
                  alt={currentUser.full_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {currentUser.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {currentUser.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${roleColorClass}`}>
              {roleLabel}
            </span>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-5 w-5" />
          Sair
        </Button>
      </div>
    </div>
  );

  // Conteúdo do menu mobile (sem header duplicado)
  const MobileMenuContent = () => (
    <div className="h-full bg-card flex flex-col">
      {/* Logo no topo do sheet */}
      <div className="p-6 border-b border-border">
        <img 
          src={logoTopBrasil} 
          alt="TOP Brasil" 
          className={`h-10 w-auto mx-auto transition-all ${isLightMode ? 'brightness-0' : ''}`} 
        />
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => navigate(item.path)}
            >
              <Icon className="mr-2 h-5 w-5" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        {currentUser && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-2">
              {(currentUser as any).profile_photo ? (
                <img 
                  src={(currentUser as any).profile_photo} 
                  alt={currentUser.full_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {currentUser.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {currentUser.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${roleColorClass}`}>
              {roleLabel}
            </span>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-5 w-5" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <RoleBasedRedirect />
      <div className="min-h-screen bg-background flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 fixed inset-y-0 left-0 z-50">
          <DesktopSidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64">
          {/* Mobile Header - Apenas ícone de menu */}
          <header className="md:hidden border-b border-border sticky top-0 z-50 bg-background">
            <div className="flex items-center justify-between p-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                  <MobileMenuContent />
                </SheetContent>
              </Sheet>
              
              {/* Logo centralizada no mobile */}
              <img 
                src={logoTopBrasil} 
                alt="TOP Brasil" 
                className={`h-8 w-auto transition-all ${isLightMode ? 'brightness-0' : ''}`} 
              />
              
              {/* Espaço vazio para centralizar a logo */}
              <div className="w-10" />
            </div>
          </header>

          {/* Page Content */}
          <div className="h-[calc(100vh-64px)] md:h-screen overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </>
  );
};
