-- ============================================================================
-- Base normativa: a lei, o acórdão e o ato oficial que a IA pode citar
-- ============================================================================
--
-- F3 do Apoio Jurídico (27/09/2026, decisão do dono: "tudo que a IA conseguir
-- filtrar, real, sem ilusão"). A regra de ouro do módulo é "a IA nunca cita o
-- que não está na base": esta é a base. Ela é alimentada TODO DIA pela edge
-- `ingestao-normativa`, sem IA nenhuma:
--   • Planalto — texto compilado das leis acompanhadas, artigo por artigo
--     (revogado fora); mudança de redação vira linha em
--     `base_normativa_alteracoes` e aviso aos admins da plataforma;
--   • TCU — acórdãos recentes pela API de dados abertos (sumário, relator,
--     data, link), filtrados por tema de contratação pública;
--   • DOU — atos normativos da seção 1 que citem a Lei 14.133 ou contratação
--     pública (busca oficial do in.gov.br).
-- Leitura: qualquer usuário autenticado (é texto público). Escrita: só a
-- rotina (service role). Teto: 200 documentos novos por execução.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

-- ── 1) As tabelas ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.base_normativa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL CHECK (fonte IN ('planalto', 'tcu', 'dou', 'ioepa', 'manual')),
  tipo text NOT NULL,                       -- lei, lc, decreto, in, portaria, acordao, sumula, ato, outro
  identificador text NOT NULL,              -- "Lei 14.133/2021", "Acórdão 2623/2026-Plenário", "IN SEGES 5/2017"
  dispositivo text,                         -- "art. 92"; nulo = o documento inteiro (ementa/sumário)
  titulo text,
  ementa text,
  texto text NOT NULL,
  url text,
  data_publicacao date,
  versao_hash text NOT NULL,                -- sha-256 do texto: muda → redação mudou
  coletado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true,
  busca tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      coalesce(identificador, '') || ' ' || coalesce(dispositivo, '') || ' ' || coalesce(titulo, '') || ' ' ||
      coalesce(ementa, '') || ' ' || left(coalesce(texto, ''), 200000))
  ) STORED
);
CREATE UNIQUE INDEX IF NOT EXISTS base_normativa_unica
  ON public.base_normativa (fonte, identificador, coalesce(dispositivo, ''));
CREATE INDEX IF NOT EXISTS base_normativa_busca ON public.base_normativa USING gin (busca);
CREATE INDEX IF NOT EXISTS base_normativa_identificador ON public.base_normativa (identificador, dispositivo);

CREATE TABLE IF NOT EXISTS public.base_normativa_coletas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  documentos integer NOT NULL DEFAULT 0,    -- lidos na fonte
  novos integer NOT NULL DEFAULT 0,
  alterados integer NOT NULL DEFAULT 0,
  erros text[] NOT NULL DEFAULT '{}',
  detalhe jsonb
);
CREATE INDEX IF NOT EXISTS base_normativa_coletas_fonte ON public.base_normativa_coletas (fonte, iniciado_em DESC);

CREATE TABLE IF NOT EXISTS public.base_normativa_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norma_id uuid NOT NULL REFERENCES public.base_normativa (id) ON DELETE CASCADE,
  identificador text NOT NULL,
  dispositivo text,
  hash_anterior text NOT NULL,
  hash_novo text NOT NULL,
  texto_anterior text NOT NULL,
  detectado_em timestamptz NOT NULL DEFAULT now()
);

-- ── 2) Leitura pública para quem está logado; escrita só da rotina ─────────
ALTER TABLE public.base_normativa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_normativa_coletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_normativa_alteracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS base_normativa_leitura ON public.base_normativa;
CREATE POLICY base_normativa_leitura ON public.base_normativa FOR SELECT TO authenticated USING (ativo);
DROP POLICY IF EXISTS base_normativa_coletas_leitura ON public.base_normativa_coletas;
CREATE POLICY base_normativa_coletas_leitura ON public.base_normativa_coletas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS base_normativa_alteracoes_leitura ON public.base_normativa_alteracoes;
CREATE POLICY base_normativa_alteracoes_leitura ON public.base_normativa_alteracoes FOR SELECT TO authenticated USING (true);

-- ── 3) Busca e texto literal (a IA e a tela usam as mesmas portas) ─────────
CREATE OR REPLACE FUNCTION public.buscar_base_normativa(p_termo text, p_limite integer DEFAULT 10)
RETURNS TABLE (id uuid, fonte text, tipo text, identificador text, dispositivo text, titulo text, ementa text, trecho text, url text, data_publicacao date, atualizado_em timestamptz, relevancia real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT b.id, b.fonte, b.tipo, b.identificador, b.dispositivo, b.titulo, b.ementa,
         left(b.texto, 1200) AS trecho, b.url, b.data_publicacao, b.atualizado_em,
         ts_rank(b.busca, websearch_to_tsquery('portuguese', p_termo)) AS relevancia
    FROM public.base_normativa b
   WHERE b.ativo AND b.busca @@ websearch_to_tsquery('portuguese', p_termo)
   ORDER BY relevancia DESC, b.atualizado_em DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limite, 10), 1), 50);
$$;

-- "Lei 14.133/2021" + "art. 92" → o artigo inteiro, literal, com a data em
-- que a base o leu. Casa pelo número do diploma e pelo número do artigo.
CREATE OR REPLACE FUNCTION public.texto_da_norma(p_identificador text, p_dispositivo text DEFAULT NULL)
RETURNS TABLE (id uuid, fonte text, identificador text, dispositivo text, texto text, url text, atualizado_em timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH alvo AS (
    SELECT (regexp_match(p_identificador, '(\d{1,2}\.\d{3}|\d{2,5})(?:/\d{4})?'))[1] AS numero,
           (regexp_match(COALESCE(p_dispositivo, ''), 'art\.?\s*(\d+(?:-[A-Za-z])?)', 'i'))[1] AS artigo
  )
  SELECT b.id, b.fonte, b.identificador, b.dispositivo, b.texto, b.url, b.atualizado_em
    FROM public.base_normativa b, alvo
   WHERE b.ativo
     AND alvo.numero IS NOT NULL
     AND b.identificador ILIKE '%' || alvo.numero || '%'
     AND (
       (alvo.artigo IS NULL AND b.dispositivo IS NULL)
       OR (alvo.artigo IS NOT NULL AND lower(b.dispositivo) = 'art. ' || lower(alvo.artigo))
     )
   ORDER BY b.atualizado_em DESC
   LIMIT 3;
$$;

-- ── 4) A rotina diária às 01:30 de Brasília (04:30 UTC), pela edge ─────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingestao-normativa-diaria') THEN
      PERFORM cron.unschedule('ingestao-normativa-diaria');
    END IF;
    PERFORM cron.schedule(
      'ingestao-normativa-diaria',
      '30 4 * * *',
      $job$
  SELECT net.http_post(
    url     := public.supabase_project_url() || '/functions/v1/ingestao-normativa',
    headers := public.cron_auth_header(),
    body    := '{}'::jsonb
  );
      $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron ausente: a ingestão normativa diária não foi agendada.';
  END IF;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'ingestao-normativa-diaria';
--   SELECT fonte, count(*) FROM public.base_normativa GROUP BY 1;   -- depois da 1ª execução
--   SELECT * FROM public.texto_da_norma('Lei 14.133/2021', 'art. 92');
--   SELECT identificador, dispositivo, left(trecho, 80) FROM public.buscar_base_normativa('reajustamento apostila');
