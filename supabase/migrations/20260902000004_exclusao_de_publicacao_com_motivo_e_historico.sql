-- ═══════════════════════════════════════════════════════════════════════════
-- Exclusão de publicação: qualquer membro, COM motivo e COM histórico
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Decisão do dono (02/09): o colaborador pode excluir um registro de
-- publicação — o que não pode é a exclusão acontecer sem rastro. O motivo é
-- obrigatório e cada exclusão vira uma linha de histórico imutável, com o
-- registro congelado em JSON, quem excluiu e quando — pronto para o
-- relatório mensal do administrador.
--
-- O caminho é uma RPC SECURITY DEFINER: valida membro da empresa, exige o
-- motivo, congela o snapshot e apaga — tudo ou nada. A policy de DELETE
-- direto (só admin) continua como está: o colaborador passa PELA porta que
-- registra, nunca por fora dela.

CREATE TABLE IF NOT EXISTS public.contrato_publicacoes_exclusoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  contrato_id   uuid,
  publicacao_id uuid NOT NULL,
  -- O registro inteiro, congelado no instante da exclusão.
  registro      jsonb NOT NULL,
  motivo        text NOT NULL CHECK (btrim(motivo) <> ''),
  excluido_por  uuid NOT NULL,
  excluido_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_exclusoes_contrato
  ON public.contrato_publicacoes_exclusoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_pub_exclusoes_empresa_mes
  ON public.contrato_publicacoes_exclusoes(empresa_id, excluido_em);

ALTER TABLE public.contrato_publicacoes_exclusoes ENABLE ROW LEVEL SECURITY;

-- Membros LEEM o histórico (transparência); ninguém escreve, altera ou apaga
-- direto — a única porta de entrada é a RPC, e não há porta de saída:
-- histórico de exclusão que se apaga não é histórico.
DROP POLICY IF EXISTS "pub_exclusoes_select" ON public.contrato_publicacoes_exclusoes;
CREATE POLICY "pub_exclusoes_select" ON public.contrato_publicacoes_exclusoes
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE OR REPLACE FUNCTION public.excluir_publicacao_com_motivo(
  p_publicacao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pub public.contrato_publicacoes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;
  IF length(btrim(COALESCE(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo da exclusão (mínimo 5 caracteres).';
  END IF;

  SELECT * INTO v_pub FROM public.contrato_publicacoes WHERE id = p_publicacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de publicação não encontrado — pode já ter sido excluído.';
  END IF;
  IF NOT public.is_empresa_member(v_uid, v_pub.empresa_id) THEN
    RAISE EXCEPTION 'Você não integra a empresa deste contrato.';
  END IF;

  INSERT INTO public.contrato_publicacoes_exclusoes
    (empresa_id, contrato_id, publicacao_id, registro, motivo, excluido_por)
  VALUES
    (v_pub.empresa_id, v_pub.contrato_id, v_pub.id, to_jsonb(v_pub), btrim(p_motivo), v_uid);

  DELETE FROM public.contrato_publicacoes WHERE id = p_publicacao_id;

  RETURN jsonb_build_object('ok', true);
END $$;

COMMENT ON FUNCTION public.excluir_publicacao_com_motivo(uuid, text) IS
  'Exclui um registro de publicação em nome de qualquer membro da empresa, '
  'exigindo motivo e gravando o histórico imutável (registro congelado, autor '
  'e instante) — a matéria-prima do relatório mensal do administrador.';

GRANT EXECUTE ON FUNCTION public.excluir_publicacao_com_motivo(uuid, text) TO authenticated;
