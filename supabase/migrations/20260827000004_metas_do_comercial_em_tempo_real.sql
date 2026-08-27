-- ═══════════════════════════════════════════════════════════════════════════
-- Metas do Comercial: a alteração do administrador chega a quem está olhando
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Até aqui a tela tinha apenas `invalidateQueries`: ao salvar um valor-alvo, o
-- cache era refeito NA SESSÃO DE QUEM SALVOU. O vendedor com a página aberta
-- continuava vendo o alvo antigo até recarregar — e nada ali sugeria que
-- devesse.
--
-- Numa tela que anuncia "Risco crítico — 0% da meta com 2 dias úteis
-- restantes", isso não é detalhe de conforto: o número que decide se alguém
-- corre atrás de proposta hoje pode ter mudado há uma hora.
--
-- ── Por que isto é migration, e não só código ───────────────────────────────
-- O canal do cliente (`postgres_changes`) só recebe eventos de tabelas que
-- estão na publicação `supabase_realtime`. Sem esta linha, o `subscribe()` do
-- front conecta, não dá erro nenhum, e nunca dispara — o pior tipo de falha:
-- a que parece estar funcionando.

DO $$
BEGIN
  -- `ADD TABLE` é erro se a tabela já estiver na publicação, e este arquivo
  -- precisa poder ser colado de novo sem quebrar.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'comercial_valores_alvo'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_valores_alvo;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'comercial_metas_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_metas_config;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'comercial_metas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_metas;
  END IF;
END $$;

-- `REPLICA IDENTITY FULL` faz o evento carregar a linha ANTIGA além da nova.
-- Sem isso, um UPDATE chega sem os valores anteriores e o filtro por
-- `empresa_id` não se aplica a eles — uma alteração que MUDE de empresa
-- escaparia do canal de quem deveria ser notificado.
ALTER TABLE public.comercial_valores_alvo REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_metas_config REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_metas        REPLICA IDENTITY FULL;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- As três precisam aparecer aqui, senão o canal do front nunca dispara.
--   SELECT schemaname, tablename
--     FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime'
--      AND tablename LIKE 'comercial_%'
--    ORDER BY tablename;
