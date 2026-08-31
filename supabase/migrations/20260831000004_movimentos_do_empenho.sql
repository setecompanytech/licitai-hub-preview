-- ═══════════════════════════════════════════════════════════════════════════
-- O empenho tem uma vida, não um valor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `contrato_empenhos.valor` guardava UM número, e o empenho estimativo não tem
-- um número: ele nasce pequeno e é reforçado conforme o consumo se materializa.
-- O 149/2024 mostra isso ao vivo — a nota inicial reserva R$ 22,55 num contrato
-- de R$ 81.180,00, e é prática regular.
--
-- Sem reforço no modelo, três coisas quebram:
--
--   1. Aumentar o empenho exige SOBRESCREVER o valor. O registro passa a dizer
--      que ele sempre teve aquele montante, e a diferença entre "estimei R$ 40
--      mil" e "estimei R$ 40 mil e reforcei R$ 15 mil em outubro" é justamente
--      o que uma auditoria pergunta.
--
--   2. A ANULAÇÃO do saldo não utilizado no encerramento do exercício não tem
--      onde ser registrada. O empenho fica eternamente "com saldo", e o
--      149/2024 — marcado Encerrado — segue oferecendo cobertura que não
--      existe mais.
--
--   3. O sistema confere o cabimento contra um número que sabe estar
--      incompleto. Enquanto for assim, o aviso do estimativo não pode barrar
--      nada (ver `informativo` em lib/contratos/cabimento.ts) — acusar falta a
--      partir do que não se sabe seria pior que calar.
--
-- ── Movimentos, não um campo ────────────────────────────────────────────────
--
-- Cada ato orçamentário é um documento próprio, com número, data e valor: a
-- nota original, cada nota de reforço, cada anulação. Guardá-los como
-- lançamentos de uma conta preserva a história e faz o saldo ser DERIVADO —
-- pela mesma razão que `saldo_atual` do Financeiro e o saldo do empenho já são:
-- número gravado descola do que o originou e passa a mentir em silêncio.

CREATE TABLE IF NOT EXISTS public.contrato_empenho_movimentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  empenho_id   uuid NOT NULL REFERENCES public.contrato_empenhos(id) ON DELETE CASCADE,

  tipo         text NOT NULL,
  -- O reforço e a anulação são notas PRÓPRIAS, com número próprio. Nulo no
  -- movimento original, que já tem o número no empenho.
  numero       text,
  -- Sempre POSITIVO. O sinal vem do tipo — guardar negativo convidaria a somar
  -- tudo direto e a errar quando um valor viesse com o sinal já aplicado.
  valor        numeric(15,2) NOT NULL CHECK (valor >= 0),
  data_movimento date NOT NULL,

  arquivo_id   uuid REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL,
  observacao   text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

COMMENT ON TABLE public.contrato_empenho_movimentos IS
  'Os atos orçamentários de um empenho: a nota original, os reforços e as '
  'anulações. Cada um é documento próprio, com número e data. O saldo do '
  'empenho passa a ser derivado deles em vez de um campo que se sobrescreve.';

COMMENT ON COLUMN public.contrato_empenho_movimentos.tipo IS
  'original | reforco | anulacao. O reforço acresce ao empenhado; a anulação '
  'devolve ao orçamento o que não será usado — tipicamente no encerramento do '
  'exercício, que é quando o estimativo fecha.';

ALTER TABLE public.contrato_empenho_movimentos
  DROP CONSTRAINT IF EXISTS chk_movimento_tipo;
ALTER TABLE public.contrato_empenho_movimentos
  ADD CONSTRAINT chk_movimento_tipo
  CHECK (tipo IN ('original','reforco','anulacao'));

CREATE INDEX IF NOT EXISTS idx_empenho_movimentos_empenho
  ON public.contrato_empenho_movimentos(empenho_id);

ALTER TABLE public.contrato_empenho_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empenho_mov_select" ON public.contrato_empenho_movimentos;
CREATE POLICY "empenho_mov_select" ON public.contrato_empenho_movimentos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_mov_insert" ON public.contrato_empenho_movimentos;
CREATE POLICY "empenho_mov_insert" ON public.contrato_empenho_movimentos
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_mov_update" ON public.contrato_empenho_movimentos;
CREATE POLICY "empenho_mov_update" ON public.contrato_empenho_movimentos
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_mov_delete" ON public.contrato_empenho_movimentos;
CREATE POLICY "empenho_mov_delete" ON public.contrato_empenho_movimentos
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── O exercício financeiro ──────────────────────────────────────────────────
-- O empenho estimativo não atravessa o ano (Lei 4.320/64, art. 34: o exercício
-- coincide com o ano civil). Um contrato plurianual tem uma nota por exercício
-- — o 149/2024 tem a de 2024 e a de 2025 —, e sem isto elas parecem dois
-- empenhos soltos em vez da sucessão que são.
ALTER TABLE public.contrato_empenhos
  ADD COLUMN IF NOT EXISTS exercicio int;

COMMENT ON COLUMN public.contrato_empenhos.exercicio IS
  'O ano do exercício financeiro a que o empenho pertence. Derivado da data de '
  'emissão quando não informado. É por ele que a sucessão anual de um contrato '
  'plurianual se lê como sucessão, e que a anulação de fim de exercício sabe o '
  'que fechar.';

UPDATE public.contrato_empenhos
   SET exercicio = EXTRACT(YEAR FROM data_emissao)::int
 WHERE exercicio IS NULL AND data_emissao IS NOT NULL;

-- ── O valor vigente, derivado ───────────────────────────────────────────────
--
-- `contrato_empenhos.valor` continua sendo o ORIGINAL — o que a primeira nota
-- reservou. O vigente sai daqui, e a diferença entre os dois é a história.
CREATE OR REPLACE FUNCTION public.contrato_empenho_valor_vigente(p_empenho_id uuid)
RETURNS TABLE (
  valor_original  numeric,
  reforcos        numeric,
  anulacoes       numeric,
  valor_vigente   numeric,
  movimentos      integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.valor,
    COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'reforco'), 0),
    COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'anulacao'), 0),
    -- O `original` em movimentos existe para quem quiser a história completa;
    -- o valor de partida continua sendo o do empenho, para não depender de
    -- alguém ter cadastrado o movimento inicial.
    e.valor
      + COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'reforco'), 0)
      - COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'anulacao'), 0),
    count(m.id)::int
    FROM public.contrato_empenhos e
    LEFT JOIN public.contrato_empenho_movimentos m ON m.empenho_id = e.id
   WHERE e.id = p_empenho_id
   GROUP BY e.id, e.valor;
$$;

COMMENT ON FUNCTION public.contrato_empenho_valor_vigente(uuid) IS
  'O valor que o empenho comporta HOJE: o original mais os reforços, menos as '
  'anulações. `contrato_empenhos.valor` permanece sendo o original — a '
  'diferença entre os dois é a história do empenho, e é ela que a auditoria '
  'pergunta.';

GRANT EXECUTE ON FUNCTION public.contrato_empenho_valor_vigente(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT c.numero_contrato, e.numero, e.tipo, e.exercicio, v.*
--     FROM public.contrato_empenhos e
--     JOIN public.contratos c ON c.id = e.contrato_id
--    CROSS JOIN LATERAL public.contrato_empenho_valor_vigente(e.id) v
--    ORDER BY c.numero_contrato, e.exercicio, e.numero;
--
-- A sucessão anual do 149/2024 deve aparecer como duas linhas, exercícios 2024
-- e 2025, cada uma com o seu vigente.
