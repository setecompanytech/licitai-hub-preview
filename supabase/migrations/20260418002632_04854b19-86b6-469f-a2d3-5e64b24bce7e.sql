-- ════════════════════════════════════════════════════════════════
-- FASE 1: Reparo da ingestão de editais
-- ════════════════════════════════════════════════════════════════

-- 1) Desativa cron do comprasnet-sync legado (API descontinuada — retorna HTML)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job
           WHERE jobname ILIKE '%comprasnet%' OR jobname ILIKE '%crawler-pncp%'
  LOOP
    PERFORM cron.unschedule(r.jobname);
    RAISE NOTICE 'Cron desativado: %', r.jobname;
  END LOOP;
END $$;

-- 2) Garante schedules corretos do pncp-sync-diario (orquestrador paralelo)
--    03h05 BRT = 06h05 UTC | 12h05 BRT = 15h05 UTC
DO $$
BEGIN
  -- Remove schedules antigos se existirem
  PERFORM cron.unschedule('pncp-sync-madrugada') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pncp-sync-madrugada');
  PERFORM cron.unschedule('pncp-sync-meiodia')   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pncp-sync-meiodia');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'pncp-sync-madrugada',
  '5 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/pncp-sync-diario',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmxvdmlneWlmdnJrZ3NvYWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTI5MzUsImV4cCI6MjA4NzI4ODkzNX0.IAI8PmpKVKNuME8j9Otoq7htk-O4pjcM55og7ZZGVmU"}'::jsonb,
    body := '{"modo":"diario_madrugada","dias_para_tras":1}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'pncp-sync-meiodia',
  '5 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/pncp-sync-diario',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmxvdmlneWlmdnJrZ3NvYWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTI5MzUsImV4cCI6MjA4NzI4ODkzNX0.IAI8PmpKVKNuME8j9Otoq7htk-O4pjcM55og7ZZGVmU"}'::jsonb,
    body := '{"modo":"diario_meiodia","dias_para_tras":0}'::jsonb
  );
  $$
);

-- ════════════════════════════════════════════════════════════════
-- FASE 2: Diários Oficiais (DOU + 6 estados principais)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.diarios_oficiais_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte         text NOT NULL,                    -- 'DOU', 'DOE-PA', 'DOE-SP', etc.
  fonte_id      text NOT NULL,                    -- id único do diário (urlId, slug, hash)
  data_publicacao date NOT NULL,
  edicao        text,
  secao         text,                             -- '1','2','3','EXTRA'
  uf            text,                             -- UF da publicação (NULL para DOU federal)
  municipio     text,
  orgao         text,
  tipo_publicacao text,                           -- 'aviso_licitacao','homologacao','dispensa','contrato', etc.
  modalidade    text,
  numero_processo text,
  objeto        text,
  valor_estimado numeric,
  texto_completo text,                            -- conteúdo extraído da matéria
  link_html     text,                             -- URL pública da matéria
  link_pdf      text,                             -- PDF do diário (quando disponível)
  cnpj_orgao    text,
  hash_conteudo text,                             -- detecta alteração entre runs
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(fonte, fonte_id)
);

CREATE INDEX IF NOT EXISTS idx_diarios_data ON public.diarios_oficiais_cache(data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_diarios_uf_data ON public.diarios_oficiais_cache(uf, data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_diarios_fonte_data ON public.diarios_oficiais_cache(fonte, data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_diarios_tipo ON public.diarios_oficiais_cache(tipo_publicacao);

-- FTS para busca full-text
ALTER TABLE public.diarios_oficiais_cache
  ADD COLUMN IF NOT EXISTS texto_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      COALESCE(objeto,'') || ' ' || COALESCE(orgao,'') || ' ' ||
      COALESCE(numero_processo,'') || ' ' || COALESCE(left(texto_completo, 5000), '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_diarios_tsv ON public.diarios_oficiais_cache USING GIN(texto_tsv);

ALTER TABLE public.diarios_oficiais_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Diários acessíveis a usuários autenticados" ON public.diarios_oficiais_cache;
CREATE POLICY "Diários acessíveis a usuários autenticados"
  ON public.diarios_oficiais_cache
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role pode escrever diários" ON public.diarios_oficiais_cache;
CREATE POLICY "Service role pode escrever diários"
  ON public.diarios_oficiais_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Tabela de configuração dos portais de diários
CREATE TABLE IF NOT EXISTS public.diarios_portais_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte       text NOT NULL UNIQUE,
  uf          text,
  url_base    text NOT NULL,
  metodo      text NOT NULL,                      -- 'api_in_gov','firecrawl_search','firecrawl_crawl'
  ativo       boolean DEFAULT true,
  config      jsonb DEFAULT '{}'::jsonb,
  ultima_sync timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.diarios_portais_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Diários portais leitura autenticado" ON public.diarios_portais_config;
CREATE POLICY "Diários portais leitura autenticado"
  ON public.diarios_portais_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Diários portais admin" ON public.diarios_portais_config;
CREATE POLICY "Diários portais admin"
  ON public.diarios_portais_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed inicial: DOU + 6 estados principais
INSERT INTO public.diarios_portais_config (fonte, uf, url_base, metodo, config) VALUES
  ('DOU', NULL, 'https://www.in.gov.br', 'api_in_gov',
    '{"secoes":["do3"],"termos":["aviso de licita","aviso de pregão","aviso de dispensa","extrato de contrato","resultado de licita"]}'::jsonb),
  ('DOE-PA', 'PA', 'https://www.ioepa.com.br', 'firecrawl_search',
    '{"termos":["aviso de licita","aviso de pregão","extrato de contrato"]}'::jsonb),
  ('DOE-SP', 'SP', 'https://www.imprensaoficial.com.br', 'firecrawl_search', '{}'::jsonb),
  ('DOE-RJ', 'RJ', 'https://www.ioerj.com.br', 'firecrawl_search', '{}'::jsonb),
  ('DOE-MG', 'MG', 'https://www.iof.mg.gov.br', 'firecrawl_search', '{}'::jsonb),
  ('DOE-RS', 'RS', 'https://www.diariooficial.rs.gov.br', 'firecrawl_search', '{}'::jsonb),
  ('DOE-BA', 'BA', 'https://www.egba.ba.gov.br', 'firecrawl_search', '{}'::jsonb)
ON CONFLICT (fonte) DO NOTHING;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_diarios_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_diarios_updated_at ON public.diarios_oficiais_cache;
CREATE TRIGGER trg_diarios_updated_at
  BEFORE UPDATE ON public.diarios_oficiais_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_diarios_updated_at();

-- RPC de busca instantânea nos diários (espelha busca_editais_instantanea)
CREATE OR REPLACE FUNCTION public.busca_diarios_instantanea(
  p_q text DEFAULT NULL,
  p_fonte text DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_pagina int DEFAULT 1,
  p_tamanho int DEFAULT 20
)
RETURNS TABLE(
  id uuid, fonte text, data_publicacao date, edicao text, secao text,
  uf text, municipio text, orgao text, tipo_publicacao text, modalidade text,
  numero_processo text, objeto text, valor_estimado numeric,
  link_html text, link_pdf text, total_count bigint, rank_busca real
)
LANGUAGE plpgsql STABLE SET search_path = 'public' AS $$
DECLARE v_offset int := (p_pagina - 1) * p_tamanho;
BEGIN
  RETURN QUERY
  WITH r AS (
    SELECT
      d.id, d.fonte, d.data_publicacao, d.edicao, d.secao, d.uf, d.municipio,
      d.orgao, d.tipo_publicacao, d.modalidade, d.numero_processo, d.objeto,
      d.valor_estimado, d.link_html, d.link_pdf,
      COUNT(*) OVER() AS total_count,
      CASE WHEN p_q IS NOT NULL AND p_q != ''
        THEN ts_rank(d.texto_tsv, plainto_tsquery('portuguese', p_q))
        ELSE 0.0 END AS rank_busca
    FROM public.diarios_oficiais_cache d
    WHERE
      (p_q IS NULL OR p_q = '' OR d.texto_tsv @@ plainto_tsquery('portuguese', p_q))
      AND (p_fonte IS NULL OR d.fonte = p_fonte)
      AND (p_uf IS NULL OR d.uf = p_uf)
      AND (p_tipo IS NULL OR d.tipo_publicacao = p_tipo)
      AND (p_data_inicio IS NULL OR d.data_publicacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR d.data_publicacao <= p_data_fim)
  )
  SELECT r.id, r.fonte, r.data_publicacao, r.edicao, r.secao, r.uf, r.municipio,
    r.orgao, r.tipo_publicacao, r.modalidade, r.numero_processo, r.objeto,
    r.valor_estimado, r.link_html, r.link_pdf, r.total_count, r.rank_busca::REAL
  FROM r
  ORDER BY
    CASE WHEN p_q IS NOT NULL AND p_q != '' THEN r.rank_busca END DESC NULLS LAST,
    r.data_publicacao DESC
  LIMIT p_tamanho OFFSET v_offset;
END; $$;

-- Status consolidado dos diários (espelha pncp_status_sincronizacao)
CREATE OR REPLACE FUNCTION public.diarios_status_sincronizacao()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT jsonb_build_object(
    'total_diarios', (SELECT count(*) FROM public.diarios_oficiais_cache),
    'por_fonte', (
      SELECT jsonb_object_agg(fonte, total)
      FROM (SELECT fonte, count(*) total FROM public.diarios_oficiais_cache GROUP BY fonte) s
    ),
    'ultima_atualizacao', (SELECT max(updated_at) FROM public.diarios_oficiais_cache),
    'mais_recente', (SELECT max(data_publicacao) FROM public.diarios_oficiais_cache)
  );
$$;