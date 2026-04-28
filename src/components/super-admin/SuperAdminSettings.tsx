import { useQuery } from '@tanstack/react-query';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Crown, Shield } from 'lucide-react';
import { RankingResetCard } from './RankingResetCard';

export function SuperAdminSettings() {
  const { data: consultant, isLoading } = useQuery({
    queryKey: ['current-consultant-settings'],
    queryFn: getCurrentConsultant,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden max-w-full">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Configurações do Super Admin</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>Informações da Conta</CardTitle>
              <CardDescription>Dados do seu perfil de administrador</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={consultant?.full_name || ''} disabled />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={consultant?.email || ''} disabled />
          </div>

          <div className="space-y-2">
            <Label>Função</Label>
            <div className="flex items-center gap-2">
              <Input 
                value="Super Admin" 
                disabled 
                className="text-primary font-semibold"
              />
              <Shield className="w-5 h-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Acesso Total ao Sistema</p>
              <p className="text-sm text-muted-foreground mt-1">
                Como Super Admin, você tem acesso total a todas as funcionalidades do sistema,
                incluindo gerenciamento de consultores, visualização de todas as métricas e
                configurações globais da organização.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
