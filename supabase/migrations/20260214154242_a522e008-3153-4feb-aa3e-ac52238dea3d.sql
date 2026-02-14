
-- Tabela de contas de anúncio Meta
CREATE TABLE public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'active',
  is_monitored boolean DEFAULT true,
  meta_status text,
  timezone text,
  currency text,
  page_id text,
  page_name text,
  instagram_user_id text,
  instagram_username text,
  last_synced_at timestamptz,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ad_account_id, organization_id)
);

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage ad_accounts" ON public.ad_accounts
  FOR ALL USING (is_super_admin());

-- Tabela de métricas diárias
CREATE TABLE public.ad_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id text NOT NULL,
  date date NOT NULL,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  ctr numeric DEFAULT 0,
  reach bigint DEFAULT 0,
  frequency numeric DEFAULT 0,
  profile_visits bigint DEFAULT 0,
  cost_per_visit numeric DEFAULT 0,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ad_account_id, date, organization_id)
);

ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage ad_metrics" ON public.ad_metrics
  FOR ALL USING (is_super_admin());

-- Tabela de configurações do módulo de tráfego
CREATE TABLE public.traffic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) UNIQUE,
  ai_enabled boolean DEFAULT false,
  meta_token_configured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.traffic_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage traffic_settings" ON public.traffic_settings
  FOR ALL USING (is_super_admin());

-- Triggers de updated_at
CREATE TRIGGER update_ad_accounts_updated_at BEFORE UPDATE ON public.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_metrics_updated_at BEFORE UPDATE ON public.ad_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_traffic_settings_updated_at BEFORE UPDATE ON public.traffic_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
