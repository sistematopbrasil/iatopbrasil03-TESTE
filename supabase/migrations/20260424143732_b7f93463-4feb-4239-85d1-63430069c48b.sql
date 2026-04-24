-- Cron jobs para sincronização automática de tráfego (Meta Ads)
-- 08:00 BRT = 11:00 UTC (manhã)
-- 23:50 BRT = 02:50 UTC (noite — dia seguinte em UTC)

-- Garantir extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover jobs antigos com nomes equivalentes (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('traffic-sync-morning');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('traffic-sync-night');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Cron 08:00 BRT (11:00 UTC) — sincronização matinal
SELECT cron.schedule(
  'traffic-sync-morning',
  '0 11 * * *',
  $cron$
  SELECT net.http_post(
    url:='https://dmqnvpyqmyjwhgiczdpe.supabase.co/functions/v1/sync-all-accounts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcW52cHlxbXlqd2hnaWN6ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDI0OTgsImV4cCI6MjA4NzYxODQ5OH0.8O429XgVM4ln_v7QY_QLpEqEJ9Otte27aOFtxHdpOgs"}'::jsonb,
    body:='{"trigger": "cron-morning"}'::jsonb
  ) AS request_id;
  $cron$
);

-- Cron 23:50 BRT (02:50 UTC) — sincronização noturna
SELECT cron.schedule(
  'traffic-sync-night',
  '50 2 * * *',
  $cron$
  SELECT net.http_post(
    url:='https://dmqnvpyqmyjwhgiczdpe.supabase.co/functions/v1/sync-all-accounts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcW52cHlxbXlqd2hnaWN6ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDI0OTgsImV4cCI6MjA4NzYxODQ5OH0.8O429XgVM4ln_v7QY_QLpEqEJ9Otte27aOFtxHdpOgs"}'::jsonb,
    body:='{"trigger": "cron-night"}'::jsonb
  ) AS request_id;
  $cron$
);