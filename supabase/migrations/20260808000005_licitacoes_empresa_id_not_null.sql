-- =============================================================================
-- MIGRATION: licitacoes.empresa_id — NOT NULL
-- Data: 2026-08-08
-- Objetivo: o banco passa a impedir a reincidencia, em vez de depender de cada
--           caminho de insercao lembrar de preencher.
--
-- PRE-REQUISITO: rodar 20260808000004 (backfill) ANTES. Se sobrar qualquer
-- linha com empresa_id nulo, este script para com mensagem explicando quais,
-- em vez de estourar o erro cru do Postgres.
--
-- Levantamento dos caminhos de insercao (08/08/2026) — todos corrigidos no
-- commit que acompanha esta migration:
--   1. src/hooks/useLicitacaoIntegration.ts  → iniciarProcesso
--   2. src/hooks/useProcessoAtivo.ts         → criarProcessoManual ("Processo Manual")
--   3. supabase/functions/api-integracao     → POST /licitacoes (API publica)
--
-- O terceiro e o que justifica o NOT NULL: e uma API externa. Mesmo com todo o
-- front correto, um cliente da API voltaria a criar licitacao orfa, e ninguem
-- perceberia — empresa_id nulo nao quebra nada visivel, so faz o processo
-- sumir silenciosamente do realizado das metas.
-- =============================================================================

DO $$
DECLARE
  v_orfas int;
  v_users text;
BEGIN
  SELECT count(*) INTO v_orfas FROM public.licitacoes WHERE empresa_id IS NULL;

  IF v_orfas > 0 THEN
    SELECT string_agg(DISTINCT user_id::text, ', ')
      INTO v_users
      FROM public.licitacoes
     WHERE empresa_id IS NULL;

    RAISE EXCEPTION
      'Ainda ha % licitacao(oes) sem empresa_id. Rode a migration 20260808000004 primeiro. '
      'Usuarios envolvidos: %. Se ja rodou, esses usuarios sao ambiguos (pertencem a mais de '
      'uma empresa sem empresa ativa valida) e precisam de atribuicao manual antes deste passo.',
      v_orfas, v_users;
  END IF;
END;
$$;

ALTER TABLE public.licitacoes
  ALTER COLUMN empresa_id SET NOT NULL;

-- A FK ja existia; o indice do backfill cobre o filtro da view de realizado.
COMMENT ON COLUMN public.licitacoes.empresa_id IS
  'Empresa dona do processo. NOT NULL desde 2026-08-08: a coluna anulavel '
  'deixou 33 licitacoes orfas, invisiveis ao realizado do modulo de metas.';
