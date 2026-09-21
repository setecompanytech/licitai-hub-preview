-- ═══════════════════════════════════════════════════════════════════════════
-- Encerramento do contrato — fato declarado, com motivo, data e trilha
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Pergunta do dono (21/09): "como saber se o contrato já se encerrou?" A
-- vigência pode estar em dia e o quantitativo já ter sido todo fornecido — as
-- obrigações acabaram antes do prazo. O sistema sabia dizer "saldo esgotado"
-- e "vencido", mas não guardava o fato "encerrado, por este motivo, nesta
-- data": o campo `status` aceitava 'encerrado' pelo formulário, sem motivo
-- nem data, e nada perguntava, no momento em que o saldo zera, se há aditivo
-- a registrar (novas quantidades, nova vigência) ou se o contrato acabou.
--
-- Decisões do dono (21/09):
--   1. o encerramento por quantitativo é DECLARADO pelo usuário; o sistema
--      sugere (saldo esgotado, vigência vencida) e oferece o aditivo como
--      alternativa — nunca encerra sozinho (CLAUDE.md, princípio 7);
--   2. a carteira (cartão "Saldo remanescente") deixa de somar contratos
--      encerrados e saldo negativo — regra de tela; aqui só nasce o dado;
--   3. metas seguem contando o contrato no mês da assinatura — nada muda.
--
-- O que nasce aqui:
--   · contratos.data_encerramento / motivo_encerramento — leitura rápida,
--     escrita só pelas funções e pelo gatilho abaixo;
--   · contrato_encerramentos — a trilha: quem, quando, por quê, com o valor
--     global e o consumido no momento (o saldo NÃO executado fica gravado) e
--     a reabertura, quando houver;
--   · encerrar_contrato / reabrir_contrato — o caminho de escrita da tela;
--   · gatilho em contratos: status que vira 'encerrado' por QUALQUER caminho
--     (formulário, Lovable, SQL) ganha registro com motivo 'nao_informado' e
--     data de hoje; status que deixa de ser 'encerrado' fecha o registro.
--     O invariante "status encerrado ⇔ um registro aberto" vale sempre, e o
--     Resumo do contrato pede o motivo quando ele veio faltando.
--
-- Nada aqui mexe em pedido, lançamento, saldo ou meta: encerrar não apaga
-- nem recalcula; só declara. Pedido novo em contrato encerrado é barrado na
-- tela (Pedidos e Kanban de Compras), edição e quitação dos existentes seguem.

-- ── 1. Colunas de leitura rápida no contrato ────────────────────────────────
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS data_encerramento   date,
  ADD COLUMN IF NOT EXISTS motivo_encerramento text;

ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_motivo_encerramento_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_motivo_encerramento_check
  CHECK (motivo_encerramento IS NULL OR motivo_encerramento IN (
    'quantitativo_esgotado', 'prazo_vencido', 'entrega_unica_concluida',
    'rescisao', 'outro', 'nao_informado'));

COMMENT ON COLUMN public.contratos.data_encerramento IS
  'Data em que o contrato foi declarado encerrado. Escrita só por encerrar_contrato/reabrir_contrato e pelo gatilho de status.';
COMMENT ON COLUMN public.contratos.motivo_encerramento IS
  'quantitativo_esgotado | prazo_vencido | entrega_unica_concluida | rescisao | outro | nao_informado (status alterado sem motivo).';

-- ── 2. A trilha ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contrato_encerramentos (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                       uuid NOT NULL,
  -- DEFERRABLE: o gatilho BEFORE INSERT de contratos grava a trilha antes de
  -- a linha do contrato existir; a chave é conferida no commit.
  contrato_id                      uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  motivo                           text NOT NULL CHECK (motivo IN (
                                     'quantitativo_esgotado', 'prazo_vencido', 'entrega_unica_concluida',
                                     'rescisao', 'outro', 'nao_informado')),
  data_encerramento                date NOT NULL,
  observacao                       text,
  valor_global_no_encerramento     numeric(14,2),
  valor_consumido_no_encerramento  numeric(14,2),
  registrado_por_user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  registrado_por_email             text,
  registrado_em                    timestamptz NOT NULL DEFAULT now(),
  reaberto_em                      timestamptz,
  reaberto_por_user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reaberto_por_email               text,
  motivo_reabertura                text,
  -- O aditivo que motivou a reabertura, quando foi um.
  aditivo_id                       uuid REFERENCES public.contrato_aditivos(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.contrato_encerramentos IS
  'Trilha do encerramento do contrato: quem declarou, quando, por quê, com que valor global/consumido, '
  'e a reabertura (quem, quando, por quê, por qual aditivo). Um registro aberto por contrato.';

-- Um encerramento aberto por contrato — é o que sustenta o invariante.
CREATE UNIQUE INDEX IF NOT EXISTS contrato_encerramentos_um_aberto_por_contrato
  ON public.contrato_encerramentos (contrato_id) WHERE reaberto_em IS NULL;
CREATE INDEX IF NOT EXISTS contrato_encerramentos_empresa_idx
  ON public.contrato_encerramentos (empresa_id);

ALTER TABLE public.contrato_encerramentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros leem encerramentos de contrato da empresa" ON public.contrato_encerramentos;
CREATE POLICY "Membros leem encerramentos de contrato da empresa"
  ON public.contrato_encerramentos FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

-- A escrita acontece SÓ pelas funções e pelo gatilho abaixo (SECURITY
-- DEFINER). Sem policy de INSERT/UPDATE/DELETE, ninguém grava ou apaga a
-- trilha pela API.

-- ── 3. O gatilho que mantém o invariante ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contrato_encerramento_acompanha_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje          date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_email         text;
  v_status_antigo text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;
BEGIN
  IF NEW.status = 'encerrado' AND COALESCE(v_status_antigo, '') <> 'encerrado' THEN
    -- Fechou por qualquer caminho: garante data, motivo e trilha.
    NEW.data_encerramento   := COALESCE(NEW.data_encerramento, v_hoje);
    NEW.motivo_encerramento := COALESCE(NEW.motivo_encerramento, 'nao_informado');
    IF NEW.empresa_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.contrato_encerramentos
       WHERE contrato_id = NEW.id AND reaberto_em IS NULL
    ) THEN
      SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
      INSERT INTO public.contrato_encerramentos (
        empresa_id, contrato_id, motivo, data_encerramento,
        valor_global_no_encerramento, valor_consumido_no_encerramento,
        registrado_por_user_id, registrado_por_email
      ) VALUES (
        NEW.empresa_id, NEW.id, NEW.motivo_encerramento, NEW.data_encerramento,
        NEW.valor_global, NEW.valor_consumido, auth.uid(), v_email
      );
    END IF;
  ELSIF COALESCE(v_status_antigo, '') = 'encerrado' AND NEW.status IS DISTINCT FROM 'encerrado' THEN
    -- Reabriu por qualquer caminho: fecha a trilha e limpa a leitura rápida.
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    UPDATE public.contrato_encerramentos
       SET reaberto_em          = now(),
           reaberto_por_user_id = auth.uid(),
           reaberto_por_email   = v_email,
           motivo_reabertura    = COALESCE(motivo_reabertura,
                                    'Situação alterada para "' || COALESCE(NEW.status, '') || '"')
     WHERE contrato_id = NEW.id AND reaberto_em IS NULL;
    NEW.data_encerramento   := NULL;
    NEW.motivo_encerramento := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_encerramento_acompanha_status ON public.contratos;
CREATE TRIGGER trg_contrato_encerramento_acompanha_status
  BEFORE INSERT OR UPDATE OF status ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.contrato_encerramento_acompanha_status();

-- ── 4. Encerrar ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encerrar_contrato(
  p_contrato_id       uuid,
  p_motivo            text,
  p_data_encerramento date DEFAULT NULL,
  p_observacao        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c      public.contratos%ROWTYPE;
  v_hoje   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_data   date := COALESCE(p_data_encerramento, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_email  text;
  v_aberto public.contrato_encerramentos%ROWTYPE;
  v_id     uuid;
BEGIN
  IF p_motivo IS NULL OR p_motivo NOT IN (
    'quantitativo_esgotado', 'prazo_vencido', 'entrega_unica_concluida', 'rescisao', 'outro'
  ) THEN
    RAISE EXCEPTION 'Motivo de encerramento inválido: %', COALESCE(p_motivo, '(vazio)');
  END IF;

  SELECT * INTO v_c FROM public.contratos WHERE id = p_contrato_id AND excluido_em IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;
  IF v_c.empresa_id IS NULL OR NOT public.is_empresa_member(auth.uid(), v_c.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar este contrato';
  END IF;
  IF v_data > v_hoje THEN
    RAISE EXCEPTION 'A data de encerramento não pode ser futura';
  END IF;
  IF v_c.data_inicio IS NOT NULL AND v_data < v_c.data_inicio::date THEN
    RAISE EXCEPTION 'A data de encerramento (%) é anterior ao início da vigência (%)',
      to_char(v_data, 'DD/MM/YYYY'), to_char(v_c.data_inicio::date, 'DD/MM/YYYY');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT * INTO v_aberto FROM public.contrato_encerramentos
   WHERE contrato_id = p_contrato_id AND reaberto_em IS NULL;

  IF v_c.status = 'encerrado' THEN
    -- Já encerrado. Só se COMPLETA um registro sem motivo (veio do formulário
    -- ou de fora); o resto é "já está encerrado".
    IF v_aberto.id IS NULL OR v_aberto.motivo <> 'nao_informado' THEN
      RAISE EXCEPTION 'Este contrato já está encerrado (desde %)',
        COALESCE(to_char(v_c.data_encerramento, 'DD/MM/YYYY'), '?');
    END IF;
    UPDATE public.contrato_encerramentos
       SET motivo                 = p_motivo,
           data_encerramento      = v_data,
           observacao             = COALESCE(NULLIF(trim(p_observacao), ''), observacao),
           registrado_por_user_id = COALESCE(registrado_por_user_id, auth.uid()),
           registrado_por_email   = COALESCE(registrado_por_email, v_email)
     WHERE id = v_aberto.id;
    UPDATE public.contratos
       SET data_encerramento = v_data, motivo_encerramento = p_motivo
     WHERE id = p_contrato_id;
    v_id := v_aberto.id;
  ELSE
    INSERT INTO public.contrato_encerramentos (
      empresa_id, contrato_id, motivo, data_encerramento, observacao,
      valor_global_no_encerramento, valor_consumido_no_encerramento,
      registrado_por_user_id, registrado_por_email
    ) VALUES (
      v_c.empresa_id, p_contrato_id, p_motivo, v_data, NULLIF(trim(p_observacao), ''),
      v_c.valor_global, v_c.valor_consumido, auth.uid(), v_email
    ) RETURNING id INTO v_id;
    -- O gatilho vê a trilha já aberta e não a duplica.
    UPDATE public.contratos
       SET status = 'encerrado', data_encerramento = v_data, motivo_encerramento = p_motivo
     WHERE id = p_contrato_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'encerramento_id', v_id,
    'contrato_id', p_contrato_id,
    'motivo', p_motivo,
    'data_encerramento', v_data,
    'saldo_nao_executado', COALESCE(v_c.valor_global, 0) - COALESCE(v_c.valor_consumido, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.encerrar_contrato(uuid, text, date, text) IS
  'Declara o encerramento do contrato: grava a trilha (com valor global e consumido no momento) e põe status=encerrado. '
  'Em contrato já encerrado sem motivo (nao_informado), completa o registro. Guardas: membro da empresa, motivo válido, data não futura e não anterior ao início.';

-- ── 5. Reabrir ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reabrir_contrato(
  p_contrato_id uuid,
  p_motivo      text,
  p_aditivo_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c      public.contratos%ROWTYPE;
  v_email  text;
  v_id     uuid;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo da reabertura (ao menos 5 caracteres)';
  END IF;

  SELECT * INTO v_c FROM public.contratos WHERE id = p_contrato_id AND excluido_em IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;
  IF v_c.empresa_id IS NULL OR NOT public.is_empresa_member(auth.uid(), v_c.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para reabrir este contrato';
  END IF;
  IF v_c.status IS DISTINCT FROM 'encerrado' THEN
    RAISE EXCEPTION 'Este contrato não está encerrado';
  END IF;
  IF p_aditivo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contrato_aditivos WHERE id = p_aditivo_id AND contrato_id = p_contrato_id
  ) THEN
    RAISE EXCEPTION 'O aditivo informado não é deste contrato';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  UPDATE public.contrato_encerramentos
     SET reaberto_em          = now(),
         reaberto_por_user_id = auth.uid(),
         reaberto_por_email   = v_email,
         motivo_reabertura    = trim(p_motivo),
         aditivo_id           = COALESCE(p_aditivo_id, aditivo_id)
   WHERE contrato_id = p_contrato_id AND reaberto_em IS NULL
   RETURNING id INTO v_id;

  -- 'vigente' é o ponto de partida; vencendo/vencido o statusEfetivo da tela
  -- deriva das datas, como sempre fez.
  UPDATE public.contratos
     SET status = 'vigente', data_encerramento = NULL, motivo_encerramento = NULL
   WHERE id = p_contrato_id;

  RETURN jsonb_build_object(
    'ok', true,
    'contrato_id', p_contrato_id,
    'encerramento_id', v_id,
    'reaberto_em', now()
  );
END;
$$;

COMMENT ON FUNCTION public.reabrir_contrato(uuid, text, uuid) IS
  'Reabre um contrato encerrado: fecha a trilha (quem, quando, por quê, por qual aditivo) e volta status=vigente. Guardas: membro da empresa, contrato encerrado, motivo com 5+ caracteres.';

REVOKE ALL ON FUNCTION public.encerrar_contrato(uuid, text, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reabrir_contrato(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_contrato(uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_contrato(uuid, text, uuid) TO authenticated;

-- ── 6. Quem já estava encerrado ganha trilha — sem motivo, e a tela pede ────
-- Data: a menor entre o fim da vigência e a última alteração — encerrado
-- depois do prazo leva o prazo; encerrado antes (por quantitativo) leva a
-- data em que alguém mexeu. LEAST ignora NULL.
INSERT INTO public.contrato_encerramentos (
  empresa_id, contrato_id, motivo, data_encerramento, observacao,
  valor_global_no_encerramento, valor_consumido_no_encerramento
)
SELECT c.empresa_id, c.id, 'nao_informado',
       LEAST(c.data_fim::date, c.updated_at::date),
       'Registro criado pela migration 20260921000002: o contrato já estava com a situação Encerrado.',
       c.valor_global, c.valor_consumido
  FROM public.contratos c
 WHERE c.status = 'encerrado'
   AND c.empresa_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.contrato_encerramentos e
      WHERE e.contrato_id = c.id AND e.reaberto_em IS NULL
   );

UPDATE public.contratos c
   SET data_encerramento   = COALESCE(c.data_encerramento, e.data_encerramento),
       motivo_encerramento = COALESCE(c.motivo_encerramento, e.motivo)
  FROM public.contrato_encerramentos e
 WHERE e.contrato_id = c.id AND e.reaberto_em IS NULL
   AND c.status = 'encerrado'
   AND (c.data_encerramento IS NULL OR c.motivo_encerramento IS NULL);
