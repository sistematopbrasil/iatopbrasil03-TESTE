CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: attendee_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendee_status AS ENUM (
    'convidado',
    'confirmado',
    'presente',
    'ausente'
);


--
-- Name: event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_status AS ENUM (
    'planejado',
    'confirmado',
    'realizado',
    'cancelado'
);


--
-- Name: lead_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_stage AS ENUM (
    'novo',
    'contatado',
    'qualificado',
    'convertido',
    'descartado'
);


--
-- Name: lead_temperature; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_temperature AS ENUM (
    'hot',
    'warm',
    'cold'
);


--
-- Name: recruit_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recruit_status AS ENUM (
    'prospecto',
    'em_analise',
    'aprovado',
    'ativo',
    'inativo'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'admin',
    'consultor',
    'viewer'
);


--
-- Name: assign_admin_on_signup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_admin_on_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Email do novo admin
  IF NEW.email = 'brenotopbrasil@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: calculate_lead_score(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_lead_score() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    score integer := 0;
BEGIN
    -- Idade (10 pontos)
    IF NEW.age BETWEEN 26 AND 35 THEN score := score + 10;
    ELSIF NEW.age BETWEEN 36 AND 45 THEN score := score + 8;
    ELSIF NEW.age BETWEEN 18 AND 25 THEN score := score + 5;
    ELSIF NEW.age >= 46 THEN score := score + 5;
    END IF;
    
    -- Possui veículo (15 pontos)
    IF NEW.has_vehicle = 'Ambos' THEN score := score + 15;
    ELSIF NEW.has_vehicle = 'Carro' THEN score := score + 10;
    ELSIF NEW.has_vehicle = 'Moto' THEN score := score + 8;
    END IF;
    
    -- Possui CNH (10 pontos)
    IF NEW.has_driver_license = 'Sim' THEN score := score + 10;
    END IF;
    
    -- Situação profissional (15 pontos)
    IF NEW.employment_status = 'Desempregado' THEN score := score + 15;
    ELSIF NEW.employment_status = 'Autônomo' THEN score := score + 12;
    ELSIF NEW.employment_status = 'Empresário' THEN score := score + 10;
    ELSIF NEW.employment_status = 'Empregado' THEN score := score + 8;
    ELSIF NEW.employment_status = 'Aposentado' THEN score := score + 5;
    END IF;
    
    -- Experiência em vendas (20 pontos)
    IF NEW.sales_experience LIKE '%mais de 2 anos%' THEN score := score + 20;
    ELSIF NEW.sales_experience LIKE '%menos de 2 anos%' THEN score := score + 15;
    ELSIF NEW.sales_experience LIKE '%interesse%' THEN score := score + 10;
    ELSE score := score + 5;
    END IF;
    
    -- Experiência em proteção veicular (15 pontos)
    IF NEW.vehicle_protection_experience = 'Sim' THEN score := score + 15;
    ELSE score := score + 5;
    END IF;
    
    -- Renda desejada (15 pontos)
    IF NEW.desired_income LIKE '%5.000%10.000%' THEN score := score + 15;
    ELSIF NEW.desired_income LIKE '%Acima%10.000%' THEN score := score + 12;
    ELSIF NEW.desired_income LIKE '%3.000%5.000%' THEN score := score + 10;
    ELSE score := score + 5;
    END IF;
    
    -- Atribuir score e temperatura
    NEW.lead_score := score;
    
    IF score >= 80 THEN NEW.temperature := 'hot';
    ELSIF score >= 50 THEN NEW.temperature := 'warm';
    ELSE NEW.temperature := 'cold';
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: create_admin_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_admin_user() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Try to find existing user by email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = 'brenotopbrasil@gmail.com';

  -- If user doesn't exist, we'll need to create via signup
  IF user_id IS NULL THEN
    RAISE NOTICE 'User does not exist yet. Please sign up with brenotopbrasil@gmail.com first.';
  ELSE
    -- User exists, assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role assigned to user %', user_id;
  END IF;
END;
$$;


--
-- Name: create_audit_log(uuid, uuid, text, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_audit_log(p_user_id uuid, p_organization_id uuid, p_action text, p_resource_type text, p_resource_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.crm_audit_logs (
    user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;


--
-- Name: generate_quiz_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quiz_slug(full_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 1;
BEGIN
  -- Remover acentos e caracteres especiais
  -- IMPORTANTE: Usar TRIM antes de processar para evitar problemas
  base_slug := lower(regexp_replace(
    unaccent(TRIM(COALESCE(full_name, 'consultor'))),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  
  -- Remover hífens no início e fim
  base_slug := trim(both '-' from base_slug);
  
  -- Log para debug
  RAISE NOTICE 'Nome original: %, Slug base: %', full_name, base_slug;
  
  final_slug := base_slug;
  
  -- Verificar se slug já existe e adicionar número se necessário
  WHILE EXISTS (SELECT 1 FROM users WHERE quiz_slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$;


--
-- Name: generate_unique_instance_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_instance_name(base_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  final_name TEXT;
  counter INTEGER := 1;
BEGIN
  final_name := LOWER(REGEXP_REPLACE(base_name, '[^a-zA-Z0-9]', '', 'g'));

  WHILE EXISTS (SELECT 1 FROM public.whatsapp_instances WHERE instance_name = final_name) LOOP
    counter := counter + 1;
    final_name := LOWER(REGEXP_REPLACE(base_name, '[^a-zA-Z0-9]', '', 'g')) || '-' || counter;
  END LOOP;

  RETURN final_name;
END;
$$;


--
-- Name: get_consultant_ranking_dynamic(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_consultant_ranking_dynamic(period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, period_end timestamp with time zone DEFAULT now()) RETURNS TABLE(consultant_id uuid, full_name text, quiz_slug text, total_leads bigint, hot_leads bigint, warm_leads bigint, cold_leads bigint, conversion_rate numeric, last_lead_date timestamp with time zone, ranking_position bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH ranked_consultants AS (
    SELECT 
      u.id as cid,
      u.full_name as fname,
      u.quiz_slug as qslug,
      COUNT(l.id) as tleads,
      COUNT(l.id) FILTER (WHERE l.temperature = 'hot') as hleads,
      COUNT(l.id) FILTER (WHERE l.temperature = 'warm') as wleads,
      COUNT(l.id) FILTER (WHERE l.temperature = 'cold') as cleads,
      ROUND(
        COALESCE(
          (COUNT(l.id) FILTER (WHERE l.temperature = 'hot')::NUMERIC / 
           NULLIF(COUNT(l.id), 0) * 100), 
          0
        ),
        1
      ) as crate,
      MAX(l.created_at) as ldate
    FROM users u
    LEFT JOIN quiz_submissions_new l ON l.consultant_id = u.id 
      AND l.completion_percentage = 100
      AND (period_start IS NULL OR l.created_at >= period_start)
      AND l.created_at <= period_end
    WHERE u.role IN ('admin', 'consultor')
      AND u.is_active = true
    GROUP BY u.id, u.full_name, u.quiz_slug
  )
  SELECT 
    rc.cid,
    rc.fname,
    rc.qslug,
    rc.tleads,
    rc.hleads,
    rc.wleads,
    rc.cleads,
    rc.crate,
    rc.ldate,
    ROW_NUMBER() OVER (ORDER BY rc.tleads DESC, rc.hleads DESC, rc.crate DESC)
  FROM ranked_consultants rc;
END;
$$;


--
-- Name: get_current_consultant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_consultant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


--
-- Name: get_default_pipeline_stage_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_default_pipeline_stage_id(org_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.pipeline_stages 
  WHERE organization_id = org_id 
  ORDER BY order_index ASC 
  LIMIT 1;
$$;


--
-- Name: get_user_organization_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_organization_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin'
  );
$$;


--
-- Name: map_stage_enum_to_uuid(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.map_stage_enum_to_uuid(stage_name text, org_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  stage_id UUID;
  name_mapping TEXT;
BEGIN
  name_mapping := CASE stage_name
    WHEN 'novo' THEN 'Novos Leads'
    WHEN 'contatado' THEN 'Contato Inicial'
    WHEN 'qualificado' THEN 'Qualificados'
    WHEN 'convertido' THEN 'Convertidos'
    WHEN 'descartado' THEN 'Descartados'
    ELSE 'Novos Leads'
  END;
  
  SELECT id INTO stage_id
  FROM public.pipeline_stages
  WHERE organization_id = org_id
    AND (name = name_mapping OR LOWER(name) LIKE '%' || LOWER(stage_name) || '%')
  LIMIT 1;
  
  IF stage_id IS NULL THEN
    SELECT id INTO stage_id
    FROM public.pipeline_stages
    WHERE organization_id = org_id
    ORDER BY order_index ASC
    LIMIT 1;
  END IF;
  
  RETURN stage_id;
END;
$$;


--
-- Name: set_quiz_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_quiz_slug() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- SE O USUÁRIO PREENCHEU O SLUG MANUALMENTE (UPDATE), validar duplicidade
  IF TG_OP = 'UPDATE' AND NEW.quiz_slug IS NOT NULL AND NEW.quiz_slug != '' AND NEW.quiz_slug IS DISTINCT FROM OLD.quiz_slug THEN
    -- Verificar se o novo slug já existe em outro usuário
    IF EXISTS (SELECT 1 FROM users WHERE quiz_slug = NEW.quiz_slug AND id != NEW.id) THEN
      RAISE EXCEPTION 'Este slug já está em uso. Por favor, escolha outro.' USING ERRCODE = '23505';
    END IF;
    -- Slug manual validado, retornar
    RETURN NEW;
  END IF;

  -- Só gerar slug automático se for INSERT e slug for nulo
  IF TG_OP = 'INSERT' AND (NEW.quiz_slug IS NULL OR NEW.quiz_slug = '') AND NEW.role IN ('admin', 'consultor') THEN
    NEW.quiz_slug := public.generate_quiz_slug(NEW.full_name);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.crm_conversations
  SET 
    last_message_at = NEW.timestamp,
    last_message_preview = CASE 
      WHEN NEW.type = 'text' THEN LEFT(COALESCE(NEW.content, ''), 100)
      WHEN NEW.type = 'audio' THEN '🎤 Áudio'
      WHEN NEW.type = 'image' THEN '📷 Imagem'
      WHEN NEW.type = 'video' THEN '🎥 Vídeo'
      WHEN NEW.type = 'document' THEN '📄 ' || COALESCE(NEW.media_filename, 'Documento')
      WHEN NEW.type = 'sticker' THEN '🎨 Figurinha'
      WHEN NEW.type = 'location' THEN '📍 Localização'
      WHEN NEW.type = 'contact' THEN '👤 Contato'
      ELSE 'Mensagem'
    END,
    unread_count = CASE 
      WHEN NEW.direction = 'incoming' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consultant_recruits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultant_recruits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    recruited_by uuid,
    submission_id uuid,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    status public.recruit_status DEFAULT 'prospecto'::public.recruit_status NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    activated_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_conversation_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_conversation_tags (
    conversation_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    lead_id uuid,
    contact_phone text NOT NULL,
    contact_name text,
    contact_avatar text,
    status text DEFAULT 'open'::text,
    unread_count integer DEFAULT 0,
    last_message_at timestamp with time zone,
    last_message_preview text,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: crm_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    message_id text NOT NULL,
    direction text NOT NULL,
    type text NOT NULL,
    content text,
    media_url text,
    media_mimetype text,
    media_filename text,
    media_size integer,
    status text DEFAULT 'sent'::text,
    error_message text,
    "timestamp" timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text]))),
    CONSTRAINT crm_messages_status_check CHECK ((status = ANY (ARRAY['sending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'error'::text]))),
    CONSTRAINT crm_messages_type_check CHECK ((type = ANY (ARRAY['text'::text, 'audio'::text, 'image'::text, 'video'::text, 'document'::text, 'sticker'::text, 'location'::text, 'contact'::text])))
);


--
-- Name: crm_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_quick_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_quick_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    shortcut text NOT NULL,
    type text NOT NULL,
    content text,
    media_url text,
    media_filename text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_quick_replies_type_check CHECK ((type = ANY (ARRAY['text'::text, 'audio'::text, 'image'::text, 'video'::text, 'document'::text])))
);


--
-- Name: crm_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#EB6608'::text NOT NULL,
    icon text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: event_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    status public.attendee_status DEFAULT 'convidado'::public.attendee_status NOT NULL,
    checked_in_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    event_date timestamp with time zone NOT NULL,
    location text,
    max_attendees integer,
    status public.event_status DEFAULT 'planejado'::public.event_status NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    consultant_id uuid,
    CONSTRAINT max_attendees_positive CHECK (((max_attendees IS NULL) OR (max_attendees > 0)))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    whatsapp_number text,
    meta_pixel_id text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT slug_format CHECK ((slug ~ '^[a-z0-9-]+$'::text)),
    CONSTRAINT whatsapp_format CHECK (((whatsapp_number IS NULL) OR (whatsapp_number ~ '^\+?[0-9]{10,15}$'::text)))
);


--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    icon text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: quiz_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    custom_welcome_message text,
    custom_thank_you_message text,
    custom_colors jsonb DEFAULT '{"primary": "#EB6608", "secondary": "#0D0D0D"}'::jsonb,
    custom_logo_url text,
    redirect_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultant_id uuid NOT NULL,
    question_text text NOT NULL,
    question_type text NOT NULL,
    options jsonb,
    order_index integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quiz_questions_question_type_check CHECK ((question_type = ANY (ARRAY['multiple_choice'::text, 'open_text'::text, 'yes_no'::text])))
);


--
-- Name: quiz_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    phone text,
    age integer,
    relationship_status text,
    location text,
    employment_status text,
    current_job text,
    sales_experience text,
    current_income text,
    desired_income text,
    motivation text,
    completion_percentage integer DEFAULT 0 NOT NULL,
    ip_address text,
    user_agent text,
    has_vehicle text,
    has_driver_license text,
    vehicle_protection_experience text
);


--
-- Name: quiz_submissions_new; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_submissions_new (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text,
    phone text,
    email text,
    age integer,
    relationship_status text,
    location text,
    employment_status text,
    current_job text,
    sales_experience text,
    current_income text,
    desired_income text,
    motivation text,
    has_vehicle text,
    has_driver_license text,
    vehicle_protection_experience text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    referrer text,
    landing_page text,
    device_type text,
    browser text,
    os text,
    ip_address text,
    user_agent text,
    session_id uuid,
    stage public.lead_stage DEFAULT 'novo'::public.lead_stage NOT NULL,
    temperature public.lead_temperature,
    lead_score integer DEFAULT 0,
    assigned_to uuid,
    last_contact_at timestamp with time zone,
    notes text,
    completion_percentage integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    consultant_id uuid,
    pipeline_stage_id uuid,
    CONSTRAINT age_range CHECK (((age IS NULL) OR ((age >= 18) AND (age <= 100)))),
    CONSTRAINT completion_range CHECK (((completion_percentage >= 0) AND (completion_percentage <= 100))),
    CONSTRAINT email_format CHECK (((email IS NULL) OR (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text))),
    CONSTRAINT lead_score_range CHECK (((lead_score >= 0) AND (lead_score <= 100))),
    CONSTRAINT phone_format CHECK (((phone IS NULL) OR (phone ~ '^[0-9\s\(\)\-\+]+$'::text)))
);


--
-- Name: ranking_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    consultant_id uuid NOT NULL,
    leads_captured integer DEFAULT 0 NOT NULL,
    leads_contacted integer DEFAULT 0 NOT NULL,
    leads_qualified integer DEFAULT 0 NOT NULL,
    leads_converted integer DEFAULT 0 NOT NULL,
    consultants_recruited integer DEFAULT 0 NOT NULL,
    events_hosted integer DEFAULT 0 NOT NULL,
    total_points integer GENERATED ALWAYS AS (((((((leads_captured * 1) + (leads_contacted * 2)) + (leads_qualified * 5)) + (leads_converted * 10)) + (consultants_recruited * 50)) + (events_hosted * 20))) STORED,
    period_start date NOT NULL,
    period_end date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT period_valid CHECK ((period_end >= period_start))
);


--
-- Name: tracking_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracking_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    session_id uuid NOT NULL,
    submission_id uuid,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    referrer text,
    landing_page text,
    device_type text,
    browser text,
    os text,
    ip_address text,
    user_agent text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role public.user_role DEFAULT 'consultor'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quiz_slug text,
    pixel_id text,
    whatsapp_button_url text,
    quiz_cover_image text,
    quiz_image_position text DEFAULT 'center'::text,
    quiz_image_size text DEFAULT 'medium'::text,
    quiz_image_shape text DEFAULT 'rounded'::text,
    profile_photo text
);


--
-- Name: whatsapp_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    instance_name text NOT NULL,
    instance_key text NOT NULL,
    status text DEFAULT 'disconnected'::text,
    qr_code text,
    phone_number text,
    webhook_url text,
    connection_state jsonb DEFAULT '{}'::jsonb,
    last_connected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT whatsapp_instances_status_check CHECK ((status = ANY (ARRAY['disconnected'::text, 'connecting'::text, 'connected'::text, 'error'::text])))
);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: consultant_recruits consultant_recruits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_recruits
    ADD CONSTRAINT consultant_recruits_pkey PRIMARY KEY (id);


--
-- Name: crm_audit_logs crm_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_audit_logs
    ADD CONSTRAINT crm_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: crm_conversation_tags crm_conversation_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversation_tags
    ADD CONSTRAINT crm_conversation_tags_pkey PRIMARY KEY (conversation_id, tag_id);


--
-- Name: crm_conversations crm_conversations_instance_id_contact_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversations
    ADD CONSTRAINT crm_conversations_instance_id_contact_phone_key UNIQUE (instance_id, contact_phone);


--
-- Name: crm_conversations crm_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversations
    ADD CONSTRAINT crm_conversations_pkey PRIMARY KEY (id);


--
-- Name: crm_messages crm_messages_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_messages
    ADD CONSTRAINT crm_messages_message_id_key UNIQUE (message_id);


--
-- Name: crm_messages crm_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_messages
    ADD CONSTRAINT crm_messages_pkey PRIMARY KEY (id);


--
-- Name: crm_notes crm_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_notes
    ADD CONSTRAINT crm_notes_pkey PRIMARY KEY (id);


--
-- Name: crm_quick_replies crm_quick_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quick_replies
    ADD CONSTRAINT crm_quick_replies_pkey PRIMARY KEY (id);


--
-- Name: crm_quick_replies crm_quick_replies_user_id_organization_id_shortcut_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quick_replies
    ADD CONSTRAINT crm_quick_replies_user_id_organization_id_shortcut_key UNIQUE (user_id, organization_id, shortcut);


--
-- Name: crm_tags crm_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tags
    ADD CONSTRAINT crm_tags_pkey PRIMARY KEY (id);


--
-- Name: crm_tags crm_tags_user_id_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tags
    ADD CONSTRAINT crm_tags_user_id_organization_id_name_key UNIQUE (user_id, organization_id, name);


--
-- Name: event_attendees event_attendees_event_submission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_event_submission_key UNIQUE (event_id, submission_id);


--
-- Name: event_attendees event_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: quiz_configurations quiz_configurations_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_configurations
    ADD CONSTRAINT quiz_configurations_organization_id_key UNIQUE (organization_id);


--
-- Name: quiz_configurations quiz_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_configurations
    ADD CONSTRAINT quiz_configurations_pkey PRIMARY KEY (id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: quiz_submissions_new quiz_submissions_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_submissions_new
    ADD CONSTRAINT quiz_submissions_new_pkey PRIMARY KEY (id);


--
-- Name: quiz_submissions quiz_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_submissions
    ADD CONSTRAINT quiz_submissions_pkey PRIMARY KEY (id);


--
-- Name: ranking_scores ranking_scores_org_user_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_scores
    ADD CONSTRAINT ranking_scores_org_user_period_key UNIQUE (organization_id, consultant_id, period_start, period_end);


--
-- Name: ranking_scores ranking_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_scores
    ADD CONSTRAINT ranking_scores_pkey PRIMARY KEY (id);


--
-- Name: tracking_sessions tracking_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_sessions
    ADD CONSTRAINT tracking_sessions_pkey PRIMARY KEY (id);


--
-- Name: tracking_sessions tracking_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_sessions
    ADD CONSTRAINT tracking_sessions_session_id_key UNIQUE (session_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: users users_email_organization_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_organization_key UNIQUE (email, organization_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_quiz_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_quiz_slug_key UNIQUE (quiz_slug);


--
-- Name: whatsapp_instances whatsapp_instances_instance_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_instance_name_key UNIQUE (instance_name);


--
-- Name: whatsapp_instances whatsapp_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_instances whatsapp_instances_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: idx_attendees_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendees_event_id ON public.event_attendees USING btree (event_id);


--
-- Name: idx_attendees_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendees_submission_id ON public.event_attendees USING btree (submission_id);


--
-- Name: idx_crm_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_audit_logs_created ON public.crm_audit_logs USING btree (created_at DESC);


--
-- Name: idx_crm_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_audit_logs_user ON public.crm_audit_logs USING btree (user_id);


--
-- Name: idx_crm_conversations_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conversations_instance ON public.crm_conversations USING btree (instance_id);


--
-- Name: idx_crm_conversations_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conversations_last_message ON public.crm_conversations USING btree (last_message_at DESC);


--
-- Name: idx_crm_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conversations_status ON public.crm_conversations USING btree (status);


--
-- Name: idx_crm_conversations_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conversations_unread ON public.crm_conversations USING btree (unread_count) WHERE (unread_count > 0);


--
-- Name: idx_crm_conversations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conversations_user ON public.crm_conversations USING btree (user_id);


--
-- Name: idx_crm_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_messages_conversation ON public.crm_messages USING btree (conversation_id);


--
-- Name: idx_crm_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_messages_status ON public.crm_messages USING btree (status);


--
-- Name: idx_crm_messages_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_messages_timestamp ON public.crm_messages USING btree ("timestamp" DESC);


--
-- Name: idx_crm_quick_replies_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_quick_replies_user ON public.crm_quick_replies USING btree (user_id);


--
-- Name: idx_crm_tags_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tags_user ON public.crm_tags USING btree (user_id);


--
-- Name: idx_events_consultant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_consultant ON public.events USING btree (consultant_id);


--
-- Name: idx_events_event_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_event_date ON public.events USING btree (event_date);


--
-- Name: idx_events_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_organization_id ON public.events USING btree (organization_id);


--
-- Name: idx_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_status ON public.events USING btree (status);


--
-- Name: idx_organizations_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_is_active ON public.organizations USING btree (is_active);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_quiz_questions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_questions_active ON public.quiz_questions USING btree (is_active);


--
-- Name: idx_quiz_questions_consultant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_questions_consultant ON public.quiz_questions USING btree (consultant_id);


--
-- Name: idx_quiz_questions_consultant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_questions_consultant_active ON public.quiz_questions USING btree (consultant_id, is_active, order_index);


--
-- Name: idx_quiz_submissions_consultant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_submissions_consultant ON public.quiz_submissions_new USING btree (consultant_id);


--
-- Name: idx_quiz_submissions_pipeline_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_submissions_pipeline_stage ON public.quiz_submissions_new USING btree (pipeline_stage_id);


--
-- Name: idx_ranking_consultant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_consultant ON public.ranking_scores USING btree (consultant_id);


--
-- Name: idx_ranking_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_organization_id ON public.ranking_scores USING btree (organization_id);


--
-- Name: idx_ranking_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_period ON public.ranking_scores USING btree (period_start, period_end);


--
-- Name: idx_ranking_total_points; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_total_points ON public.ranking_scores USING btree (total_points DESC);


--
-- Name: idx_ranking_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_user_id ON public.ranking_scores USING btree (consultant_id);


--
-- Name: idx_recruits_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recruits_organization_id ON public.consultant_recruits USING btree (organization_id);


--
-- Name: idx_recruits_recruited_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recruits_recruited_by ON public.consultant_recruits USING btree (recruited_by);


--
-- Name: idx_recruits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recruits_status ON public.consultant_recruits USING btree (status);


--
-- Name: idx_submissions_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_assigned_to ON public.quiz_submissions_new USING btree (assigned_to);


--
-- Name: idx_submissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_created_at ON public.quiz_submissions_new USING btree (created_at DESC);


--
-- Name: idx_submissions_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_email ON public.quiz_submissions_new USING btree (email);


--
-- Name: idx_submissions_lead_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_lead_score ON public.quiz_submissions_new USING btree (lead_score DESC);


--
-- Name: idx_submissions_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_organization_id ON public.quiz_submissions_new USING btree (organization_id);


--
-- Name: idx_submissions_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_phone ON public.quiz_submissions_new USING btree (phone);


--
-- Name: idx_submissions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_session_id ON public.quiz_submissions_new USING btree (session_id);


--
-- Name: idx_submissions_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_stage ON public.quiz_submissions_new USING btree (stage);


--
-- Name: idx_submissions_temperature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_temperature ON public.quiz_submissions_new USING btree (temperature);


--
-- Name: idx_submissions_utm_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_utm_campaign ON public.quiz_submissions_new USING btree (utm_campaign);


--
-- Name: idx_submissions_utm_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_utm_source ON public.quiz_submissions_new USING btree (utm_source);


--
-- Name: idx_tracking_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracking_organization_id ON public.tracking_sessions USING btree (organization_id);


--
-- Name: idx_tracking_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracking_session_id ON public.tracking_sessions USING btree (session_id);


--
-- Name: idx_tracking_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracking_submission_id ON public.tracking_sessions USING btree (submission_id);


--
-- Name: idx_users_auth_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_user_id ON public.users USING btree (auth_user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: idx_users_quiz_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_quiz_slug ON public.users USING btree (quiz_slug);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_whatsapp_instances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_instances_status ON public.whatsapp_instances USING btree (status);


--
-- Name: idx_whatsapp_instances_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_instances_user ON public.whatsapp_instances USING btree (user_id);


--
-- Name: quiz_submissions_new calculate_lead_score_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER calculate_lead_score_trigger BEFORE INSERT OR UPDATE ON public.quiz_submissions_new FOR EACH ROW EXECUTE FUNCTION public.calculate_lead_score();


--
-- Name: users set_quiz_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quiz_slug BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW WHEN ((new.role = ANY (ARRAY['admin'::public.user_role, 'consultor'::public.user_role]))) EXECUTE FUNCTION public.set_quiz_slug();


--
-- Name: crm_conversations trigger_crm_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_crm_conversations_updated_at BEFORE UPDATE ON public.crm_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: crm_notes trigger_crm_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_crm_notes_updated_at BEFORE UPDATE ON public.crm_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: crm_quick_replies trigger_crm_quick_replies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_crm_quick_replies_updated_at BEFORE UPDATE ON public.crm_quick_replies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: crm_tags trigger_crm_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_crm_tags_updated_at BEFORE UPDATE ON public.crm_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users trigger_set_quiz_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_quiz_slug BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_quiz_slug();


--
-- Name: crm_messages trigger_update_conversation_last_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_last_message AFTER INSERT ON public.crm_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: whatsapp_instances trigger_whatsapp_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_settings update_app_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consultant_recruits update_consultant_recruits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_consultant_recruits_updated_at BEFORE UPDATE ON public.consultant_recruits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: event_attendees update_event_attendees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_event_attendees_updated_at BEFORE UPDATE ON public.event_attendees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quiz_configurations update_quiz_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quiz_configurations_updated_at BEFORE UPDATE ON public.quiz_configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quiz_questions update_quiz_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quiz_questions_updated_at BEFORE UPDATE ON public.quiz_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quiz_submissions update_quiz_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quiz_submissions_updated_at BEFORE UPDATE ON public.quiz_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quiz_submissions_new update_quiz_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quiz_submissions_updated_at BEFORE UPDATE ON public.quiz_submissions_new FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ranking_scores update_ranking_scores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ranking_scores_updated_at BEFORE UPDATE ON public.ranking_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consultant_recruits consultant_recruits_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_recruits
    ADD CONSTRAINT consultant_recruits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: consultant_recruits consultant_recruits_recruited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_recruits
    ADD CONSTRAINT consultant_recruits_recruited_by_fkey FOREIGN KEY (recruited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: consultant_recruits consultant_recruits_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_recruits
    ADD CONSTRAINT consultant_recruits_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.quiz_submissions_new(id) ON DELETE SET NULL;


--
-- Name: crm_audit_logs crm_audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_audit_logs
    ADD CONSTRAINT crm_audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: crm_audit_logs crm_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_audit_logs
    ADD CONSTRAINT crm_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: crm_conversation_tags crm_conversation_tags_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversation_tags
    ADD CONSTRAINT crm_conversation_tags_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.crm_conversations(id) ON DELETE CASCADE;


--
-- Name: crm_conversation_tags crm_conversation_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversation_tags
    ADD CONSTRAINT crm_conversation_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.crm_tags(id) ON DELETE CASCADE;


--
-- Name: crm_conversations crm_conversations_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversations
    ADD CONSTRAINT crm_conversations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;


--
-- Name: crm_conversations crm_conversations_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversations
    ADD CONSTRAINT crm_conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.quiz_submissions_new(id) ON DELETE SET NULL;


--
-- Name: crm_conversations crm_conversations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversations
    ADD CONSTRAINT crm_conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: crm_conversations crm_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversations
    ADD CONSTRAINT crm_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: crm_messages crm_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_messages
    ADD CONSTRAINT crm_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.crm_conversations(id) ON DELETE CASCADE;


--
-- Name: crm_notes crm_notes_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_notes
    ADD CONSTRAINT crm_notes_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.crm_conversations(id) ON DELETE CASCADE;


--
-- Name: crm_notes crm_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_notes
    ADD CONSTRAINT crm_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: crm_quick_replies crm_quick_replies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quick_replies
    ADD CONSTRAINT crm_quick_replies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: crm_quick_replies crm_quick_replies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_quick_replies
    ADD CONSTRAINT crm_quick_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: crm_tags crm_tags_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tags
    ADD CONSTRAINT crm_tags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: crm_tags crm_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tags
    ADD CONSTRAINT crm_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_attendees event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_attendees event_attendees_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.quiz_submissions_new(id) ON DELETE CASCADE;


--
-- Name: events events_consultant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_consultant_id_fkey FOREIGN KEY (consultant_id) REFERENCES public.users(id);


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: events events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: pipeline_stages pipeline_stages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: quiz_configurations quiz_configurations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_configurations
    ADD CONSTRAINT quiz_configurations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: quiz_questions quiz_questions_consultant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_consultant_id_fkey FOREIGN KEY (consultant_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: quiz_submissions_new quiz_submissions_new_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_submissions_new
    ADD CONSTRAINT quiz_submissions_new_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: quiz_submissions_new quiz_submissions_new_consultant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_submissions_new
    ADD CONSTRAINT quiz_submissions_new_consultant_id_fkey FOREIGN KEY (consultant_id) REFERENCES public.users(id);


--
-- Name: quiz_submissions_new quiz_submissions_new_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_submissions_new
    ADD CONSTRAINT quiz_submissions_new_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: quiz_submissions_new quiz_submissions_new_pipeline_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_submissions_new
    ADD CONSTRAINT quiz_submissions_new_pipeline_stage_id_fkey FOREIGN KEY (pipeline_stage_id) REFERENCES public.pipeline_stages(id);


--
-- Name: ranking_scores ranking_scores_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_scores
    ADD CONSTRAINT ranking_scores_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ranking_scores ranking_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_scores
    ADD CONSTRAINT ranking_scores_user_id_fkey FOREIGN KEY (consultant_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tracking_sessions tracking_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_sessions
    ADD CONSTRAINT tracking_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tracking_sessions tracking_sessions_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_sessions
    ADD CONSTRAINT tracking_sessions_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.quiz_submissions_new(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users users_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_instances whatsapp_instances_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_instances whatsapp_instances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: quiz_submissions Anyone can insert quiz submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert quiz submissions" ON public.quiz_submissions FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: app_settings Anyone can read public settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read public settings" ON public.app_settings FOR SELECT TO authenticated, anon USING ((setting_key = ANY (ARRAY['quiz_hero_image_url'::text, 'whatsapp_thank_you_link'::text, 'meta_pixel_id'::text, 'quiz_image_position'::text, 'quiz_image_aspect_ratio'::text])));


--
-- Name: quiz_submissions Anyone can select recent quiz submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can select recent quiz submissions" ON public.quiz_submissions FOR SELECT TO authenticated, anon USING ((created_at > (now() - '24:00:00'::interval)));


--
-- Name: quiz_submissions Anyone can update recent quiz submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update recent quiz submissions" ON public.quiz_submissions FOR UPDATE TO authenticated, anon USING ((created_at > (now() - '24:00:00'::interval))) WITH CHECK (true);


--
-- Name: events Consultants can create events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can create events" ON public.events FOR INSERT WITH CHECK (((organization_id = public.get_user_organization_id()) AND ((consultant_id IS NULL) OR (consultant_id = public.get_current_consultant_id()))));


--
-- Name: quiz_questions Consultants can create questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can create questions" ON public.quiz_questions FOR INSERT WITH CHECK ((consultant_id = public.get_current_consultant_id()));


--
-- Name: quiz_questions Consultants can delete their questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can delete their questions" ON public.quiz_questions FOR DELETE USING ((consultant_id = public.get_current_consultant_id()));


--
-- Name: quiz_questions Consultants can update their questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can update their questions" ON public.quiz_questions FOR UPDATE USING ((consultant_id = public.get_current_consultant_id()));


--
-- Name: events Consultants can view their events or super admin sees all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can view their events or super admin sees all" ON public.events FOR SELECT USING (((consultant_id = public.get_current_consultant_id()) OR public.is_super_admin() OR (organization_id = public.get_user_organization_id())));


--
-- Name: quiz_questions Consultants can view their questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can view their questions" ON public.quiz_questions FOR SELECT USING (((consultant_id = public.get_current_consultant_id()) OR public.is_super_admin()));


--
-- Name: ranking_scores Consultants can view their ranking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can view their ranking" ON public.ranking_scores FOR SELECT USING (((consultant_id = public.get_current_consultant_id()) OR public.is_super_admin()));


--
-- Name: quiz_submissions_new Consultants can view their submissions or super admin sees all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Consultants can view their submissions or super admin sees all" ON public.quiz_submissions_new FOR SELECT USING (((consultant_id = public.get_current_consultant_id()) OR public.is_super_admin() OR (created_at > (now() - '01:00:00'::interval))));


--
-- Name: quiz_submissions_new Public can insert submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert submissions" ON public.quiz_submissions_new FOR INSERT WITH CHECK (true);


--
-- Name: tracking_sessions Public can insert tracking sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert tracking sessions" ON public.tracking_sessions FOR INSERT WITH CHECK (true);


--
-- Name: organizations Public can read active organizations by slug; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active organizations by slug" ON public.organizations FOR SELECT USING ((is_active = true));


--
-- Name: quiz_questions Public can read active questions by consultant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active questions by consultant" ON public.quiz_questions FOR SELECT USING ((is_active = true));


--
-- Name: quiz_configurations Public can read active quiz configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active quiz configs" ON public.quiz_configurations FOR SELECT USING ((is_active = true));


--
-- Name: users Public can read consultants by quiz slug; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read consultants by quiz slug" ON public.users FOR SELECT USING (((is_active = true) AND (quiz_slug IS NOT NULL)));


--
-- Name: quiz_submissions_new Public can update incomplete submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can update incomplete submissions" ON public.quiz_submissions_new FOR UPDATE USING (((completion_percentage < 100) AND (created_at > (now() - '01:00:00'::interval)))) WITH CHECK (true);


--
-- Name: users Super Admin can create consultants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super Admin can create consultants" ON public.users FOR INSERT WITH CHECK ((public.is_super_admin() AND (organization_id = public.get_user_organization_id())));


--
-- Name: users Super Admin can delete consultants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super Admin can delete consultants" ON public.users FOR DELETE USING ((public.is_super_admin() AND (organization_id = public.get_user_organization_id())));


--
-- Name: users Super Admin can update consultants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super Admin can update consultants" ON public.users FOR UPDATE USING ((public.is_super_admin() AND (organization_id = public.get_user_organization_id())));


--
-- Name: consultant_recruits Users can create recruits in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create recruits in their organization" ON public.consultant_recruits FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: quiz_submissions_new Users can delete leads in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete leads in their organization" ON public.quiz_submissions_new FOR DELETE USING (((organization_id = public.get_user_organization_id()) OR public.is_super_admin()));


--
-- Name: crm_conversations Users can delete own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own conversations" ON public.crm_conversations FOR DELETE USING ((user_id = public.get_current_consultant_id()));


--
-- Name: whatsapp_instances Users can delete own instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own instances" ON public.whatsapp_instances FOR DELETE USING ((user_id = public.get_current_consultant_id()));


--
-- Name: crm_audit_logs Users can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert audit logs" ON public.crm_audit_logs FOR INSERT WITH CHECK ((user_id = public.get_current_consultant_id()));


--
-- Name: crm_messages Users can insert messages in own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert messages in own conversations" ON public.crm_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.crm_conversations
  WHERE ((crm_conversations.id = crm_messages.conversation_id) AND (crm_conversations.user_id = public.get_current_consultant_id())))));


--
-- Name: crm_conversations Users can insert own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own conversations" ON public.crm_conversations FOR INSERT WITH CHECK ((user_id = public.get_current_consultant_id()));


--
-- Name: whatsapp_instances Users can insert own instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own instances" ON public.whatsapp_instances FOR INSERT WITH CHECK ((user_id = public.get_current_consultant_id()));


--
-- Name: event_attendees Users can manage attendees in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage attendees in their organization" ON public.event_attendees USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_attendees.event_id) AND (events.organization_id = public.get_user_organization_id())))));


--
-- Name: crm_notes Users can manage own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own notes" ON public.crm_notes USING ((user_id = public.get_current_consultant_id()));


--
-- Name: crm_quick_replies Users can manage own quick replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own quick replies" ON public.crm_quick_replies USING (((user_id = public.get_current_consultant_id()) OR public.is_super_admin()));


--
-- Name: crm_tags Users can manage own tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own tags" ON public.crm_tags USING (((user_id = public.get_current_consultant_id()) OR public.is_super_admin()));


--
-- Name: crm_conversation_tags Users can manage tags on own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage tags on own conversations" ON public.crm_conversation_tags USING ((EXISTS ( SELECT 1
   FROM public.crm_conversations
  WHERE ((crm_conversations.id = crm_conversation_tags.conversation_id) AND (crm_conversations.user_id = public.get_current_consultant_id())))));


--
-- Name: events Users can update events in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update events in their organization" ON public.events FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: crm_conversations Users can update own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own conversations" ON public.crm_conversations FOR UPDATE USING ((user_id = public.get_current_consultant_id()));


--
-- Name: whatsapp_instances Users can update own instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own instances" ON public.whatsapp_instances FOR UPDATE USING ((user_id = public.get_current_consultant_id()));


--
-- Name: crm_messages Users can update own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own messages" ON public.crm_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.crm_conversations
  WHERE ((crm_conversations.id = crm_messages.conversation_id) AND (crm_conversations.user_id = public.get_current_consultant_id())))));


--
-- Name: consultant_recruits Users can update recruits in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update recruits in their organization" ON public.consultant_recruits FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: quiz_submissions_new Users can update submissions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update submissions in their organization" ON public.quiz_submissions_new FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: quiz_configurations Users can update their organization config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their organization config" ON public.quiz_configurations FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: organizations Users can update their own organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own organization" ON public.organizations FOR UPDATE USING ((id = public.get_user_organization_id()));


--
-- Name: users Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));


--
-- Name: event_attendees Users can view attendees in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view attendees in their organization" ON public.event_attendees FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_attendees.event_id) AND (events.organization_id = public.get_user_organization_id())))));


--
-- Name: crm_messages Users can view messages from own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages from own conversations" ON public.crm_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.crm_conversations
  WHERE ((crm_conversations.id = crm_messages.conversation_id) AND ((crm_conversations.user_id = public.get_current_consultant_id()) OR public.is_super_admin())))));


--
-- Name: crm_audit_logs Users can view own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own audit logs" ON public.crm_audit_logs FOR SELECT USING (((user_id = public.get_current_consultant_id()) OR public.is_super_admin()));


--
-- Name: crm_conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own conversations" ON public.crm_conversations FOR SELECT USING (((user_id = public.get_current_consultant_id()) OR public.is_super_admin()));


--
-- Name: whatsapp_instances Users can view own instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own instances" ON public.whatsapp_instances FOR SELECT USING (((user_id = public.get_current_consultant_id()) OR public.is_super_admin()));


--
-- Name: consultant_recruits Users can view recruits in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view recruits in their organization" ON public.consultant_recruits FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: quiz_configurations Users can view their organization config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their organization config" ON public.quiz_configurations FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: organizations Users can view their own organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own organization" ON public.organizations FOR SELECT USING ((id = public.get_user_organization_id()));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: tracking_sessions Users can view tracking in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tracking in their organization" ON public.tracking_sessions FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: users Users can view users in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view users in their organization" ON public.users FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: consultant_recruits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consultant_recruits ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_conversation_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_conversation_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_quick_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_quick_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stages delete_own_org_stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delete_own_org_stages ON public.pipeline_stages FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: event_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stages insert_own_org_stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_own_org_stages ON public.pipeline_stages FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_submissions_new; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_submissions_new ENABLE ROW LEVEL SECURITY;

--
-- Name: ranking_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ranking_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: tracking_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stages update_own_org_stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY update_own_org_stages ON public.pipeline_stages FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stages view_own_org_stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY view_own_org_stages ON public.pipeline_stages FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: whatsapp_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


