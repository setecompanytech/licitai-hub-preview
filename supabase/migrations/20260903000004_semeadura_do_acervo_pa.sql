-- ═══════════════════════════════════════════════════════════════════════════
-- Semeadura do acervo: Pará, 3 anos, 6 modalidades (03/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O teste de 03/09 mostrou o acervo sem NENHUM edital paraense de água
-- mineral — os órgãos dos contratos da casa (PMPA, CBMPA, FSCMPA) eram
-- desconhecidos do Histórico do órgão. A semeadura varre o PNCP oficial
-- (contratacoes/publicacao, UF=PA) na madrugada, em fatias que respeitam o
-- rate limit, e SE DESLIGA ao concluir (princípio nº 5: rotina temporária
-- nasce com condição de parada).

CREATE TABLE IF NOT EXISTS public.pncp_semeadura_progresso (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uf text NOT NULL,
  modalidade_id integer NOT NULL,
  data_inicial date NOT NULL,
  data_final date NOT NULL,
  pagina_atual integer NOT NULL DEFAULT 1,
  total_paginas integer,
  registros_gravados integer NOT NULL DEFAULT 0,
  concluido boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uf, modalidade_id, data_inicial)
);

-- Tabela de infraestrutura: RLS ligado SEM policies = só service role alcança.
ALTER TABLE public.pncp_semeadura_progresso ENABLE ROW LEVEL SECURITY;

-- 6 modalidades × 3 janelas anuais (o PNCP limita cada consulta a ~1 ano).
INSERT INTO public.pncp_semeadura_progresso (uf, modalidade_id, data_inicial, data_final)
SELECT 'PA', m, j.ini, j.fim
FROM unnest(ARRAY[6, 8, 9, 4, 5, 7]) AS m,
     (VALUES
       (DATE '2023-09-04', DATE '2024-09-03'),
       (DATE '2024-09-04', DATE '2025-09-03'),
       (DATE '2025-09-04', DATE '2026-09-03')
     ) AS j(ini, fim)
ON CONFLICT (uf, modalidade_id, data_inicial) DO NOTHING;

-- A condição de parada: quando tudo concluir, a própria função chama isto.
CREATE OR REPLACE FUNCTION public.pncp_semeadura_finalizar()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pncp_semeadura_progresso WHERE NOT concluido) THEN
    RETURN false;
  END IF;
  PERFORM cron.unschedule('pncp-semeadura-pa')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pncp-semeadura-pa');
  RETURN true;
END;
$$;

-- Madrugada de Brasília (01h00–05h59 BRT), a cada 4 min: ~90 fatias/noite.
SELECT cron.unschedule('pncp-semeadura-pa')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pncp-semeadura-pa');

SELECT cron.schedule(
  'pncp-semeadura-pa',
  '*/4 4-8 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/semear-acervo-pncp',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);

-- Os embeddings acompanham o volume: a janela substitui o lote único das
-- 06h35 (migration 20260903000003) — a cada 10 min na madrugada, parando
-- sozinha quando não há pendentes (lote vazio custa quase nada).
SELECT cron.unschedule('pncp-embeddings-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pncp-embeddings-diario');

SELECT cron.schedule(
  'pncp-embeddings-diario',
  '*/10 4-8 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/pncp-gerar-embeddings',
    headers := public.cron_auth_header(),
    body := '{"limite": 400}'::jsonb
  );
  $$
);
