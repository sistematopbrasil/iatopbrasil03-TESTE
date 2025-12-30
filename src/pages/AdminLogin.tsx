import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import logoTopBrasil from "@/assets/logo-top-brasil.png";
import { queryClient } from "@/App";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('auth_user_id', session.user.id)
            .single();

          if (user?.role === 'super_admin') {
            navigate('/admin/super', { replace: true });
          } else if (user?.role === 'admin' || user?.role === 'consultor') {
            navigate('/admin/dashboard', { replace: true });
          }
        }
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Logout e limpa cache antes de novo login
      await supabase.auth.signOut();
      queryClient.clear();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Buscar role do usuário
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('auth_user_id', data.user.id)
        .single();

      const allowedRoles = ['admin', 'super_admin', 'consultor'];
      const hasAccess = user?.role && allowedRoles.includes(user.role);

      if (userError || !hasAccess) {
        await supabase.auth.signOut();
        queryClient.clear();
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "Você não tem permissão para acessar o painel."
        });
        return;
      }

      // Redirecionar diretamente para a página correta
      if (user.role === 'super_admin') {
        navigate('/admin/super', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: error.message || "Verifique suas credenciais e tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading enquanto verifica sessão
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient background effect */}
      <div className="absolute inset-0 bg-gradient-radial opacity-50"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-primary/10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={logoTopBrasil} alt="TOP Brasil" className="h-16 w-auto" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-foreground mb-2">
            Painel Administrativo
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            Faça login para acessar o sistema
          </p>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@topbrasil.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-background border-border focus:border-primary focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 bg-background border-border focus:border-primary focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-muted-foreground mt-6 text-sm">
          TOP Brasil - Sistema Administrativo © 2026
        </p>
      </div>
    </div>
  );
}