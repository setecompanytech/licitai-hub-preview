-- ═══════════════════════════════════════════════════════════════════════════
-- Trilha de auditoria do Controle de Documentos (03/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Qualquer membro alimenta o módulo (envio, substituição, renovação,
-- compartilhamento, remoção) e o efeito é instantâneo para todos — o Admin
-- precisa do rastro de QUEM fez O QUÊ. O registro nasce em GATILHO no banco:
-- todo caminho que tocar a tabela deixa história, sem depender de tela
-- lembrar de registrar. Tabela imutável (sem policy de UPDATE/DELETE; só o
-- gatilho, como definer, escreve) — o padrão do histórico de exclusões de
-- publicações.

CREATE TABLE IF NOT EXISTS public.documentos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  documento_nome text NOT NULL,
  acao text NOT NULL,
  autor uuid,
  validade_anterior date,
  validade_nova date,
  arquivo_anterior text,
  arquivo_novo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_historico_empresa
  ON public.documentos_historico (empresa_id, criado_em DESC);

ALTER TABLE public.documentos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documentos_historico_select_admin ON public.documentos_historico;
-- Leitura: só o Admin da empresa — é para ele que o registro existe.
CREATE POLICY documentos_historico_select_admin ON public.documentos_historico
  FOR SELECT TO authenticated
  USING (empresa_id IS NOT NULL AND public.is_empresa_admin(auth.uid(), empresa_id));

CREATE OR REPLACE FUNCTION public.registrar_alteracao_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.documentos_historico
      (empresa_id, documento_nome, acao, autor, validade_nova, arquivo_novo)
    VALUES (NEW.empresa_id, NEW.nome, 'enviado', auth.uid(), NEW.validade, NEW.arquivo_path);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.documentos_historico
      (empresa_id, documento_nome, acao, autor,
       validade_anterior, validade_nova, arquivo_anterior, arquivo_novo)
    VALUES (
      COALESCE(NEW.empresa_id, OLD.empresa_id),
      NEW.nome,
      CASE
        WHEN OLD.empresa_id IS NULL AND NEW.empresa_id IS NOT NULL THEN 'compartilhado'
        WHEN OLD.arquivo_path IS DISTINCT FROM NEW.arquivo_path THEN 'substituído'
        WHEN OLD.validade IS DISTINCT FROM NEW.validade THEN 'validade alterada'
        ELSE 'editado'
      END,
      auth.uid(), OLD.validade, NEW.validade, OLD.arquivo_path, NEW.arquivo_path);
    RETURN NEW;
  ELSE
    INSERT INTO public.documentos_historico
      (empresa_id, documento_nome, acao, autor, validade_anterior, arquivo_anterior)
    VALUES (OLD.empresa_id, OLD.nome, 'removido', auth.uid(), OLD.validade, OLD.arquivo_path);
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_historico ON public.documentos;
CREATE TRIGGER trg_documentos_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_alteracao_documento();
