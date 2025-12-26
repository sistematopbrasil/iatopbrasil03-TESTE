-- Recriar coluna total_points com nova fórmula (100 pts por consultor recrutado)
-- PostgreSQL não suporta ALTER COLUMN SET GENERATED, então precisamos dropar e recriar

ALTER TABLE public.ranking_scores
DROP COLUMN total_points;

ALTER TABLE public.ranking_scores
ADD COLUMN total_points integer GENERATED ALWAYS AS (
  (leads_captured * 1) +
  (leads_contacted * 2) +
  (leads_qualified * 5) +
  (leads_converted * 10) +
  (consultants_recruited * 100) +
  (events_hosted * 20)
) STORED;