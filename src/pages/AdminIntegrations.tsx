import { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Plug, CheckCircle2, XCircle, MessageCircle, Megaphone, Instagram } from 'lucide-react';
import {
  INTEGRATION_KEYS,
  IntegrationCategory,
  testIntegration,
  useIntegrationSettings,
} from '@/hooks/useIntegrationSettings';
import { IntegrationField } from '@/components/admin/integrations/IntegrationField';
import { useQuery } from '@tanstack/react-query';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { Navigate } from 'react-router-dom';

interface TestState {
  loading: boolean;
  result?: { ok: boolean; latency_ms: number; message: string };
}

const CATEGORIES: Array<{
  id: IntegrationCategory;
  label: string;
  icon: any;
  description: string;
}> = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    description: 'Evolution API e webhook do CRM.',
  },
  {
    id: 'meta_ads',
    label: 'Meta Ads',
    icon: Megaphone,
    description: 'Token, app e versão da Graph API.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    description: 'Apify (scrape de perfis).',
  },
];

const AdminIntegrations = () => {
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user-integrations'],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
  });

  const { data: metadata, isLoading } = useIntegrationSettings();
  const [tests, setTests] = useState<Record<IntegrationCategory, TestState>>({
    whatsapp: { loading: false },
    meta_ads: { loading: false },
    instagram: { loading: false },
  });

  const metadataByKey = useMemo(() => {
    const map = new Map<string, (typeof metadata)[number]>();
    (metadata ?? []).forEach((m) => map.set(m.key, m));
    return map;
  }, [metadata]);

  const groupedKeys = useMemo(() => {
    const groups: Record<IntegrationCategory, typeof INTEGRATION_KEYS> = {
      whatsapp: [],
      meta_ads: [],
      instagram: [],
    };
    INTEGRATION_KEYS.forEach((k) => groups[k.category].push(k));
    return groups;
  }, []);

  const handleTest = async (cat: IntegrationCategory) => {
    setTests((s) => ({ ...s, [cat]: { loading: true } }));
    try {
      const result = await testIntegration(cat);
      setTests((s) => ({ ...s, [cat]: { loading: false, result } }));
    } catch (e: any) {
      setTests((s) => ({
        ...s,
        [cat]: {
          loading: false,
          result: { ok: false, latency_ms: 0, message: e.message },
        },
      }));
    }
  };

  if (loadingUser) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!currentUser?.role || !isSuperAdmin(currentUser.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AdminLayout>
      <div className="container max-w-5xl mx-auto py-6 px-4 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie chaves, tokens e URLs das integrações globais. Valores salvos no banco
            substituem as variáveis de ambiente automaticamente — se um campo estiver vazio,
            o sistema continua usando o valor padrão do ambiente.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="whatsapp" className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full md:w-auto">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{cat.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {CATEGORIES.map((cat) => {
              const test = tests[cat.id];
              return (
                <TabsContent key={cat.id} value={cat.id}>
                  <Card className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">{cat.label}</h2>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {test.result && (
                          <div
                            className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 ${
                              test.result.ok
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-destructive/10 text-destructive'
                            }`}
                          >
                            {test.result.ok ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {test.result.message} · {test.result.latency_ms}ms
                            </span>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(cat.id)}
                          disabled={test.loading}
                          className="gap-1"
                        >
                          {test.loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plug className="h-4 w-4" />
                          )}
                          Testar conexão
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {groupedKeys[cat.id].map((def) => (
                        <IntegrationField
                          key={def.key}
                          definition={def}
                          metadata={metadataByKey.get(def.key)}
                        />
                      ))}
                    </div>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminIntegrations;
