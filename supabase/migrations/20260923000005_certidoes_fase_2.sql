-- ═══════════════════════════════════════════════════════════════════════════
-- Certidões — fase 2 (23/09/2026): solicitação ao órgão com protocolo e prazo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O Praefectus não emite, não raspa nem resume certidão: a válida é o PDF do
-- órgão emissor, guardado na vaga do cofre de Documentos (nome exato,
-- `lib/documentos/previstos.ts`). O que faltava entre o pedido e o PDF:
--
--  1. `documentos_solicitacoes` — certidão que não sai por site sai por
--     PEDIDO (Belém atende por e-mail). Uma linha por pedido: a quem, quando,
--     até quando, e o protocolo quando o órgão responde. A vaga mostra
--     "solicitada em DD/MM, prazo DD/MM" até o PDF chegar; ao anexar o
--     arquivo à vaga, a tela encerra a solicitação aberta (`encerrada_em`).
--     A tabela `documentos` não muda.
--
-- RLS por empresa (leitura, criação e alteração por membro; exclusão por
-- admin). Idempotente. As migrations deste repo são coladas à mão: a tela
-- tolera a tabela ausente e diz o que falta.

-- ── 1. Solicitações de certidão ao órgão ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.documentos_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- A vaga do cofre, pelo nome exato (documentos.nome / VAGAS_PREVISTAS.nome).
  documento_nome text NOT NULL,
  orgao text NOT NULL,
  email_destino text,
  solicitada_em timestamptz NOT NULL DEFAULT now(),
  -- Digitado depois, quando o órgão responde com um número.
  protocolo text,
  -- Até quando se espera o PDF. Opcional: sem prazo, a vaga só "aguarda".
  prazo_resposta date,
  observacao text,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Preenchido quando o PDF chegou (a tela encerra ao anexar) ou o pedido foi abandonado.
  encerrada_em timestamptz
);

-- A pergunta da tela: "há pedido aberto para esta vaga desta empresa?"
CREATE INDEX IF NOT EXISTS idx_documentos_solicitacoes_abertas
  ON public.documentos_solicitacoes (empresa_id, documento_nome)
  WHERE encerrada_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_solicitacoes_empresa
  ON public.documentos_solicitacoes (empresa_id, solicitada_em DESC);

ALTER TABLE public.documentos_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem solicitacoes de documentos" ON public.documentos_solicitacoes;
CREATE POLICY "membros leem solicitacoes de documentos" ON public.documentos_solicitacoes
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros registram solicitacoes de documentos" ON public.documentos_solicitacoes;
CREATE POLICY "membros registram solicitacoes de documentos" ON public.documentos_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id) AND user_id = auth.uid());

-- Protocolo, prazo e encerramento são rotina de equipe: alteração por membro.
DROP POLICY IF EXISTS "membros alteram solicitacoes de documentos" ON public.documentos_solicitacoes;
CREATE POLICY "membros alteram solicitacoes de documentos" ON public.documentos_solicitacoes
  FOR UPDATE TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin apaga solicitacoes de documentos" ON public.documentos_solicitacoes;
CREATE POLICY "admin apaga solicitacoes de documentos" ON public.documentos_solicitacoes
  FOR DELETE TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

REVOKE ALL ON public.documentos_solicitacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_solicitacoes TO authenticated;
GRANT ALL ON public.documentos_solicitacoes TO service_role;

COMMENT ON TABLE public.documentos_solicitacoes IS
  'Certidões, fase 2 (23/09/2026): pedidos de certidão ao órgão emissor, por vaga do cofre (documento_nome = nome exato da vaga). A vaga mostra "solicitada em, prazo" até o PDF chegar; a tela encerra (encerrada_em) ao anexar o arquivo.';
COMMENT ON COLUMN public.documentos_solicitacoes.documento_nome IS 'A vaga do cofre, nome exato de lib/documentos/previstos.ts — nunca renomear.';
COMMENT ON COLUMN public.documentos_solicitacoes.protocolo IS 'Número dado pelo órgão ao responder; digitado depois, opcional.';
COMMENT ON COLUMN public.documentos_solicitacoes.encerrada_em IS 'PDF anexado à vaga (encerramento pela tela) ou pedido abandonado.';

NOTIFY pgrst, 'reload schema';

-- ── Conferência (a colar depois; só leitura) ────────────────────────────────
-- SELECT tablename, policyname, cmd
--   FROM pg_policies
--  WHERE tablename IN ('documentos_solicitacoes')
--  ORDER BY tablename, cmd, policyname;
-- -- esperado: 4 regras em documentos_solicitacoes (SELECT/INSERT/UPDATE por membro, DELETE por admin)
--
-- SELECT documento_nome, orgao, email_destino, solicitada_em, prazo_resposta, protocolo, encerrada_em
--   FROM public.documentos_solicitacoes
--  ORDER BY solicitada_em DESC
--  LIMIT 20;
