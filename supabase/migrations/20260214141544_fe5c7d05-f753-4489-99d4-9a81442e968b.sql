
-- =============================================
-- MÓDULO INSTAGRAM INSIGHTS - Tabelas Isoladas
-- =============================================

-- Tabela: insta_profiles
CREATE TABLE public.insta_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  username text NOT NULL,
  display_name text,
  profile_picture text,
  profile_url text,
  category text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insta_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insta profiles in their org"
  ON public.insta_profiles FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert insta profiles in their org"
  ON public.insta_profiles FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update insta profiles in their org"
  ON public.insta_profiles FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete insta profiles in their org"
  ON public.insta_profiles FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Trigger updated_at
CREATE TRIGGER update_insta_profiles_updated_at
  BEFORE UPDATE ON public.insta_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: insta_follower_metrics
CREATE TABLE public.insta_follower_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insta_profiles(id) ON DELETE CASCADE,
  follower_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  daily_change integer DEFAULT 0,
  growth_rate numeric DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_date date NOT NULL,
  UNIQUE(profile_id, recorded_date)
);

ALTER TABLE public.insta_follower_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insta metrics in their org"
  ON public.insta_follower_metrics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.insta_profiles
    WHERE insta_profiles.id = insta_follower_metrics.profile_id
      AND insta_profiles.organization_id = get_user_organization_id()
  ));

CREATE POLICY "Users can insert insta metrics in their org"
  ON public.insta_follower_metrics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.insta_profiles
    WHERE insta_profiles.id = insta_follower_metrics.profile_id
      AND insta_profiles.organization_id = get_user_organization_id()
  ));

CREATE POLICY "Users can update insta metrics in their org"
  ON public.insta_follower_metrics FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.insta_profiles
    WHERE insta_profiles.id = insta_follower_metrics.profile_id
      AND insta_profiles.organization_id = get_user_organization_id()
  ));

CREATE POLICY "Users can delete insta metrics in their org"
  ON public.insta_follower_metrics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.insta_profiles
    WHERE insta_profiles.id = insta_follower_metrics.profile_id
      AND insta_profiles.organization_id = get_user_organization_id()
  ));

-- Index para performance
CREATE INDEX idx_insta_metrics_profile_date ON public.insta_follower_metrics(profile_id, recorded_date DESC);

-- Tabela: insta_campaign_notes
CREATE TABLE public.insta_campaign_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insta_profiles(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  note_type text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insta_campaign_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insta notes in their org"
  ON public.insta_campaign_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.insta_profiles
    WHERE insta_profiles.id = insta_campaign_notes.profile_id
      AND insta_profiles.organization_id = get_user_organization_id()
  ));

CREATE POLICY "Users can insert insta notes in their org"
  ON public.insta_campaign_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.insta_profiles
    WHERE insta_profiles.id = insta_campaign_notes.profile_id
      AND insta_profiles.organization_id = get_user_organization_id()
  ));

CREATE POLICY "Users can delete insta notes in their org"
  ON public.insta_campaign_notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.insta_profiles
    WHERE insta_profiles.id = insta_campaign_notes.profile_id
      AND insta_profiles.organization_id = get_user_organization_id()
  ));

-- Storage bucket para fotos de perfil
INSERT INTO storage.buckets (id, name, public) VALUES ('insta-profile-pictures', 'insta-profile-pictures', true);

CREATE POLICY "Public can view insta profile pictures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'insta-profile-pictures');

CREATE POLICY "Authenticated can upload insta profile pictures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'insta-profile-pictures');

CREATE POLICY "Authenticated can update insta profile pictures"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'insta-profile-pictures');

-- Realtime para métricas
ALTER PUBLICATION supabase_realtime ADD TABLE public.insta_follower_metrics;
