-- ═══════════════════════════════════════════════════════════════════════════
-- 20260908000008 · nfe_entradas — o acervo de NF-e de ENTRADA por empresa (08/09)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- (Nome nfe_entradas porque nfe_recebidas já existia: legado do Lovable no
-- módulo Compras, com outro desenho e SEM empresa_id.)
--
-- Fase 1 da recepção automática de NF-e contra o CNPJ da empresa: terceiro
-- emite, o provedor de DFe entrega por webhook, o Praefectus guarda — e o
-- Financeiro gera a Conta a Pagar com o XML já anexado. Enquanto o provedor
-- não está contratado, a importação manual de XML alimenta a MESMA tabela
-- (origem distinta, mesmo fluxo). Chave única por empresa: reentrega de
-- webhook não duplica.

CREATE TABLE IF NOT EXISTS public.nfe_entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave text NOT NULL,
  emitente_cnpj text,
  emitente_nome text,
  destinatario_cnpj text,
  numero text,
  serie text,
  valor_total numeric,
  data_emissao date,
  natureza_operacao text,
  -- autorizada | cancelada | resumo (resNFe sem XML completo ainda)
  situacao text NOT NULL DEFAULT 'autorizada',
  -- webhook | importada
  origem text NOT NULL DEFAULT 'webhook',
  xml text,
  -- ciencia | confirmada | desconhecida | nao_realizada
  manifestacao text,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  recebida_em timestamptz NOT NULL DEFAULT now(),
  payload jsonb,
  UNIQUE (empresa_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_nfe_entradas_empresa
  ON public.nfe_entradas(empresa_id, data_emissao DESC);

ALTER TABLE public.nfe_entradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nfe_entradas_membros_leem ON public.nfe_entradas;
CREATE POLICY nfe_entradas_membros_leem ON public.nfe_entradas
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS nfe_entradas_membros_inserem ON public.nfe_entradas;
CREATE POLICY nfe_entradas_membros_inserem ON public.nfe_entradas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS nfe_entradas_membros_atualizam ON public.nfe_entradas;
CREATE POLICY nfe_entradas_membros_atualizam ON public.nfe_entradas
  FOR UPDATE TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS nfe_entradas_admin_apaga ON public.nfe_entradas;
CREATE POLICY nfe_entradas_admin_apaga ON public.nfe_entradas
  FOR DELETE TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- Nota nova aparece na tela sem F5 — a lição da publicação realtime de hoje.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'nfe_entradas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.nfe_entradas';
  END IF;
END $$;
