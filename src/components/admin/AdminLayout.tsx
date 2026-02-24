import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, Menu, Settings, BarChart3, Kanban, CalendarDays, Trophy, Target, MessageSquare, PieChart, Bot, Instagram, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RoleBasedRedirect } from "@/components/RoleBasedRedirect";
import { useTheme } from "next-themes";
import logoLight from "@/assets/logo-top-brasil-dark.png";
import logoDark from "@/assets/logo-top-brasil.png";
import { queryClient } from "@/App";
import { usePrefetchAdminData } from "@/hooks/usePrefetchAdminData";


interface AdminLayoutProps {
  children: ReactNode;
  disableVerticalScroll?: boolean;
}

export const AdminLayout = ({ children, disableVerticalScroll = false }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { theme, resolvedTheme } = useTheme();

  usePrefetchAdminData();

  const effectiveTheme = resolvedTheme || theme || 'light';
  const isLightMode = effectiveTheme === 'light';
  const logoSrc = isLightMode ? logoLight : logoDark;

  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['current-user-layout'],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    toast({
      title: "Logout realizado",
      description: "Você saiu do painel administrativo.",
    });
    navigate('/login');
  };

  const superAdminNavItems = [
    { path: '/admin/super', icon: BarChart3, label: 'Dashboard' },
    { path: '/admin/consultants', icon: Users, label: 'Consultores' },
    { path: '/admin/ranking', icon: Trophy, label: 'Ranking' },
    { path: '/admin/instagram', icon: Instagram, label: 'Instagram' },
    { path: '/admin/traffic', icon: Megaphone, label: 'Tráfego' },
    { path: '/admin/settings', icon: Settings, label: 'Configurações' },
  ];

  const consultantNavItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/leads', icon: Target, label: 'Leads' },
    { path: '/admin/pipeline', icon: Kanban, label: 'Pipeline' },
    { path: '/admin/crm', icon: MessageSquare, label: 'CRM WhatsApp' },
    ...(currentUser?.ai_enabled ? [{ path: '/admin/ai-config', icon: Bot, label: 'Agente IA' }] : []),
    { path: '/admin/analytics', icon: PieChart, label: 'Analytics' },
    { path: '/admin/ranking', icon: Trophy, label: 'Ranking' },
    { path: '/admin/settings', icon: Settings, label: 'Configurações' },
  ];

  const userRole = currentUser?.role;
  const isUserSuperAdmin = userRole ? isSuperAdmin(userRole) : null;
  
  const navItems = isUserSuperAdmin === true
    ? superAdminNavItems
    : isUserSuperAdmin === false
    ? consultantNavItems
    : [];

  const roleLabel = isUserSuperAdmin ? 'Super Admin' : 'Consultor';
  const roleColorClass = isUserSuperAdmin 
    ? 'bg-primary/10 text-primary' 
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

  // Render nav buttons inline (not as component to avoid remount)
  const renderNavButtons = () => navItems.map((item) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Button
        key={item.path}
        variant={isActive ? "default" : "ghost"}
        className={`w-full justify-start ${!isActive ? 'hover:bg-muted hover:text-foreground' : ''}`}
        onClick={() => navigate(item.path)}
      >
        <Icon className="mr-2 h-5 w-5" />
        {item.label}
      </Button>
    );
  });

  const renderUserInfo = () => currentUser ? (
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
  ) : null;

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <RoleBasedRedirect />
      <div className={`bg-background flex ${disableVerticalScroll ? 'h-dvh overflow-hidden' : 'min-h-screen overflow-x-hidden'}`}>
        {/* Desktop Sidebar - inline JSX */}
        <aside className="hidden md:block w-64 fixed inset-y-0 left-0 z-50">
          <div className="h-full bg-card border-r border-border flex flex-col">
            <div className="p-6 border-b border-border">
              <img src={logoSrc} alt="TOP Brasil" className="h-12 w-auto mx-auto" loading="eager" />
            </div>
            <nav className="flex-1 p-4 space-y-2">
              {renderNavButtons()}
            </nav>
            <div className="p-4 border-t border-border space-y-3">
              {renderUserInfo()}
              <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="mr-2 h-5 w-5" />
                Sair
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64">
          {/* Mobile Header */}
          <header className="md:hidden border-b border-border sticky top-0 z-50 bg-background">
            <div className="flex items-center justify-between p-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                  <div className="h-full bg-card flex flex-col">
                    <div className="p-6 border-b border-border">
                      <img src={logoSrc} alt="TOP Brasil" className="h-10 w-auto mx-auto" loading="eager" />
                    </div>
                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                      {renderNavButtons()}
                    </nav>
                    <div className="p-4 border-t border-border space-y-3">
                      {renderUserInfo()}
                      <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                        <LogOut className="mr-2 h-5 w-5" />
                        Sair
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <img src={logoSrc} alt="TOP Brasil" className="h-8 w-auto" loading="eager" />
              <div className="w-10" />
            </div>
          </header>

          <div 
            className={`h-[calc(100dvh-64px)] md:h-dvh ${
            disableVerticalScroll 
                ? 'overflow-hidden' 
                : 'overflow-y-auto overflow-x-hidden overscroll-x-none'
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </>
  );
};
