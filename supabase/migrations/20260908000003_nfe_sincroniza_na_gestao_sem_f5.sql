-- ─────────────────────────────────────────────────────────────────────────────
-- 20260908000003 · A NF-e anexada no Financeiro aparece na Gestão sem F5
--
-- A aba Pedidos assina mudanças em `financeiro_documentos_fiscais` para
-- atualizar a coluna NF-e na hora — mas a tabela NUNCA entrou na publicação
-- `supabase_realtime`. O canal assinava, o Supabase aceitava a assinatura, e
-- nenhum evento chegava: falha silenciosa clássica. `financeiro_lancamentos`
-- entrou na publicação em 05/2026 (20260504202003); a de documentos ficou
-- para trás porque nenhuma tela a escutava até 08/09.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'financeiro_documentos_fiscais'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_documentos_fiscais';
  END IF;

  -- Cinto e suspensório: a migration de 05/2026 já adiciona lançamentos, mas
  -- ambiente com drift (publicação recriada) deixaria o canal mudo de novo.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'financeiro_lancamentos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_lancamentos';
  END IF;
END $$;
