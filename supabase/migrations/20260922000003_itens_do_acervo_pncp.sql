-- ═══════════════════════════════════════════════════════════════════════════
-- Itens do acervo PNCP: o preço UNITÁRIO ao lado do valor GLOBAL (22/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A aba Preços de Análise de mercado resumia o `valor_total_estimado` de
-- cada edital — o valor GLOBAL do processo, todos os itens juntos — sem
-- dizer que era global. Para "carne moída patinho" no Pará a tela dizia
-- mediana R$ 11.941,25 e faixa de R$ 750 a R$ 871.038; os itens desses
-- mesmos editais, lidos na API pública do PNCP, dizem R$ 35,00 por kg
-- homologado (n=10) e R$ 34,58 estimado (n=16). O acervo não guardava item.
--
-- Esta tabela guarda os itens dos editais que a busca devolve, lidos SOB
-- DEMANDA pela edge `itens-do-acervo-pncp` (cache: um edital lido nunca é
-- lido de novo; o resultado do item é relido enquanto não houver homologação).
-- Dado público do PNCP: leitura a qualquer autenticado; escrita só pela
-- função (service_role), que ignora RLS. Sem `empresa_id` de propósito — o
-- acervo (`pncp_editais_cache`) segue a mesma regra.

CREATE TABLE IF NOT EXISTS public.pncp_editais_itens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- A mesma chave de pncp_editais_cache.pncp_id (cnpj-ano-sequencial).
  pncp_id text NOT NULL,
  cnpj_orgao text NOT NULL,
  ano_compra text NOT NULL,
  sequencial_compra text NOT NULL,
  numero_item integer NOT NULL,
  descricao text NOT NULL DEFAULT '',
  unidade text,
  quantidade numeric,
  -- O que o órgão estimou (edital) — UNITÁRIO e total do item.
  valor_unitario_estimado numeric,
  valor_total_estimado numeric,
  situacao text,
  -- O que o PNCP registrou como resultado — UNITÁRIO homologado ao vencedor.
  tem_resultado boolean NOT NULL DEFAULT false,
  valor_unitario_homologado numeric,
  valor_total_homologado numeric,
  quantidade_homologada numeric,
  fornecedor text,
  cnpj_fornecedor text,
  data_resultado date,
  ncm text,
  categoria text,
  coletado_em timestamptz NOT NULL DEFAULT now(),
  resultado_coletado_em timestamptz,
  CONSTRAINT pncp_editais_itens_unico UNIQUE (pncp_id, numero_item)
);

CREATE INDEX IF NOT EXISTS idx_pncp_editais_itens_pncp_id
  ON public.pncp_editais_itens (pncp_id);

-- Para a próxima etapa (buscar item por produto no cache inteiro), o mesmo
-- índice de trigramas que o acervo usa no nome do órgão.
CREATE INDEX IF NOT EXISTS idx_pncp_editais_itens_descricao_trgm
  ON public.pncp_editais_itens USING gin (descricao gin_trgm_ops);

ALTER TABLE public.pncp_editais_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pncp_editais_itens_leitura_autenticada" ON public.pncp_editais_itens;
CREATE POLICY "pncp_editais_itens_leitura_autenticada"
  ON public.pncp_editais_itens
  FOR SELECT
  TO authenticated
  USING (true);

-- Nenhuma regra de escrita: só a service_role (edge function) grava.
REVOKE ALL ON public.pncp_editais_itens FROM anon;
GRANT SELECT ON public.pncp_editais_itens TO authenticated;
GRANT ALL ON public.pncp_editais_itens TO service_role;

COMMENT ON TABLE public.pncp_editais_itens IS
  'Itens dos editais do acervo lidos na API pública do PNCP sob demanda (22/09/2026): preço unitário estimado e homologado por item, ao lado do valor global do edital em pncp_editais_cache. Gravada só pela edge itens-do-acervo-pncp.';
COMMENT ON COLUMN public.pncp_editais_itens.valor_unitario_estimado IS 'Unitário estimado pelo órgão no edital (natureza: unitário; estágio: estimado).';
COMMENT ON COLUMN public.pncp_editais_itens.valor_unitario_homologado IS 'Unitário homologado ao vencedor, do resultado do item no PNCP (natureza: unitário; estágio: homologado).';

-- Conferência (só leitura), depois da primeira busca na aba Preços:
-- SELECT pncp_id, numero_item, left(descricao, 50), unidade, quantidade,
--        valor_unitario_estimado, valor_unitario_homologado, fornecedor
--   FROM public.pncp_editais_itens ORDER BY coletado_em DESC LIMIT 20;
