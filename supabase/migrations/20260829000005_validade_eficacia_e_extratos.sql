-- ═══════════════════════════════════════════════════════════════════════════
-- Validade e eficácia: assinatura das partes e divulgação oficial
-- ═══════════════════════════════════════════════════════════════════════════
--
-- São duas coisas, e o sistema tratava como uma só.
--
--   VALIDADE  nasce da assinatura por agente competente, com objeto lícito e
--             na forma da lei. A partir daí o contrato existe.
--
--   EFICÁCIA  nasce da divulgação. Lei 14.133/2021, art. 94: a divulgação no
--             PNCP é "condição indispensável para a eficácia do contrato e de
--             seus aditamentos", nos prazos de 20 dias úteis (licitação) ou
--             10 dias úteis (contratação direta), contados da assinatura.
--             Antes disso o ajuste não produz efeitos e a execução não pode
--             começar legitimamente.
--
-- ── Por que isto é problema de quem VENDE ───────────────────────────────────
--
-- Publicar é dever do órgão. Mas quem paga o preço de executar antes da
-- eficácia é o fornecedor: entrega feita sob contrato ineficaz é entrega sem
-- título que a sustente, e a conta a receber nasce contestável.
--
-- Daí duas necessidades que o sistema não atendia:
--
--   1. Avisar quando o documento anexado tem assinatura de UMA parte só.
--      Instrumento com uma assinatura é proposta, não ajuste.
--
--   2. Guardar os EXTRATOS — do contrato, da ata, de cada aditivo e da
--      designação do fiscal —, que são a prova de que a eficácia começou e a
--      partir de quando os prazos correm.

-- ── 1. Como o instrumento foi assinado ──────────────────────────────────────

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS assinatura_situacao   text,
  ADD COLUMN IF NOT EXISTS assinatura_observacao text;

COMMENT ON COLUMN public.contratos.assinatura_situacao IS
  'ambas | so_contratada | so_orgao | nenhuma. Documento assinado por uma '
  'parte só é proposta, não ajuste: não vincula ninguém e não inicia prazo. '
  'Nulo significa que ninguém verificou — diferente de "está tudo certo".';

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_assinatura_situacao;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_assinatura_situacao
  CHECK (assinatura_situacao IS NULL
         OR assinatura_situacao IN ('ambas','so_contratada','so_orgao','nenhuma'))
  NOT VALID;

-- Art. 94, §1º: contrato de urgência tem eficácia desde a assinatura — mas
-- continua obrigado a publicar no prazo, sob pena de nulidade.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS eficacia_por_urgencia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contratos.eficacia_por_urgencia IS
  'Art. 94, §1º — urgência expressamente caracterizada dá eficácia desde a '
  'assinatura. Não dispensa a publicação posterior no prazo legal.';

-- ── 2. Os extratos ──────────────────────────────────────────────────────────
--
-- Tabela, e não colunas, porque um contrato tem VÁRIAS publicações: o extrato
-- do próprio contrato, o de cada aditivo, o da designação do fiscal, e as
-- republicações quando o órgão erra e retifica.

CREATE TABLE IF NOT EXISTS public.contrato_publicacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id  uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  -- Quando a publicação é de um aditivo específico. Nulo = é do contrato/ata.
  aditivo_id   uuid REFERENCES public.contrato_aditivos(id) ON DELETE CASCADE,

  tipo         text NOT NULL,
  -- PNCP, DOU, DOE, DOM, sítio oficial. O PNCP é o que dá eficácia (art. 94);
  -- os demais podem ser exigidos por norma local e ficam registrados junto.
  veiculo      text NOT NULL DEFAULT 'PNCP',
  data_publicacao date NOT NULL,
  numero       text,
  url          text,
  observacao   text,

  arquivo_id   uuid REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

COMMENT ON TABLE public.contrato_publicacoes IS
  'Os extratos publicados de um contrato: do próprio contrato ou ata, de cada '
  'termo aditivo e da designação do fiscal. É a prova de que a eficácia '
  'começou e a partir de quando os prazos correm (Lei 14.133/2021, art. 94).';

COMMENT ON COLUMN public.contrato_publicacoes.tipo IS
  'extrato_contrato | extrato_ata | extrato_aditivo | designacao_fiscal | outro';

COMMENT ON COLUMN public.contrato_publicacoes.veiculo IS
  'Onde saiu. O PNCP é o que dá eficácia; diário oficial e sítio próprio '
  'podem ser exigidos por norma local e ficam registrados do mesmo jeito.';

ALTER TABLE public.contrato_publicacoes
  DROP CONSTRAINT IF EXISTS chk_publicacao_tipo;
ALTER TABLE public.contrato_publicacoes
  ADD CONSTRAINT chk_publicacao_tipo
  CHECK (tipo IN ('extrato_contrato','extrato_ata','extrato_aditivo','designacao_fiscal','outro'));

-- Extrato de aditivo sem dizer QUAL aditivo não serve de prova de nada.
ALTER TABLE public.contrato_publicacoes
  DROP CONSTRAINT IF EXISTS chk_publicacao_aditivo_identificado;
ALTER TABLE public.contrato_publicacoes
  ADD CONSTRAINT chk_publicacao_aditivo_identificado
  CHECK (tipo <> 'extrato_aditivo' OR aditivo_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_publicacoes_contrato
  ON public.contrato_publicacoes(contrato_id, tipo);
CREATE INDEX IF NOT EXISTS idx_publicacoes_aditivo
  ON public.contrato_publicacoes(aditivo_id) WHERE aditivo_id IS NOT NULL;

ALTER TABLE public.contrato_publicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publicacoes_select" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_select" ON public.contrato_publicacoes
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "publicacoes_insert" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_insert" ON public.contrato_publicacoes
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "publicacoes_update" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_update" ON public.contrato_publicacoes
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "publicacoes_delete" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_delete" ON public.contrato_publicacoes
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Contratos assinados que ainda não têm extrato — os que não podem ser
--    executados:
--
--    SELECT c.numero_contrato, c.modalidade, c.data_assinatura,
--           c.assinatura_situacao, c.eficacia_por_urgencia
--      FROM public.contratos c
--     WHERE c.data_assinatura IS NOT NULL
--       AND NOT EXISTS (
--         SELECT 1 FROM public.contrato_publicacoes p
--          WHERE p.contrato_id = c.id
--            AND p.tipo IN ('extrato_contrato','extrato_ata')
--       )
--     ORDER BY c.data_assinatura;
--
-- 2. Aditivos sem extrato próprio (art. 94 fala em "contrato E SEUS
--    aditamentos"):
--
--    SELECT c.numero_contrato, a.numero_aditivo, a.tipo, a.data_assinatura
--      FROM public.contrato_aditivos a
--      JOIN public.contratos c ON c.id = a.contrato_id
--     WHERE NOT EXISTS (
--       SELECT 1 FROM public.contrato_publicacoes p WHERE p.aditivo_id = a.id
--     );
