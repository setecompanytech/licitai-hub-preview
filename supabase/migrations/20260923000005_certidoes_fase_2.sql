-- ═══════════════════════════════════════════════════════════════════════════
-- Certidões — fase 2 (23/09/2026): solicitação ao órgão com protocolo e
-- prazo; órgão municipal cadastrado pela empresa
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
--  2. `certidoes_orgaos_da_empresa` — o mapa de certidões cobre as 27 UFs e
--     as capitais; os ~5.500 municípios de fora viram "órgão a cadastrar".
--     Aqui a empresa cadastra o SEU órgão municipal (nome, site, e-mail,
--     instruções, validade usual). O catálogo mescla: município no mapa → o
--     mapa; fora do mapa → o cadastrado da empresa; sem nenhum → "a
--     cadastrar" com o nome do município. Só esfera municipal: uma prefeitura
--     serve às duas vagas municipais (débitos e inscrição). Abrir para a
--     estadual exige dizer a qual vaga o cadastro responde (Fazenda, Junta e
--     TJ são órgãos diferentes) — decisão de outra migration.
--
-- RLS por empresa em ambas (leitura, criação e alteração por membro; exclusão
-- por admin). Idempotente. As migrations deste repo são coladas à mão: a
-- tela tolera a tabela ausente e diz o que falta.

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

-- ── 2. Órgão municipal cadastrado pela empresa ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.certidoes_orgaos_da_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Só municipal por ora: a prefeitura serve às duas vagas municipais. Abrir
  -- para 'estadual' exige uma coluna dizendo a qual vaga o cadastro responde.
  esfera text NOT NULL DEFAULT 'municipal' CHECK (esfera IN ('municipal')),
  uf text NOT NULL CHECK (uf = upper(uf) AND length(uf) = 2),
  -- O nome do município como está no cadastro da empresa (empresas.municipio);
  -- o catálogo compara sem acento e sem caixa.
  municipio text NOT NULL CHECK (length(btrim(municipio)) > 0),
  nome_orgao text NOT NULL CHECK (length(btrim(nome_orgao)) > 0),
  site text,
  email text,
  instrucoes text,
  -- Validade usual, em dias; nulo = conforme o documento ou o edital.
  validade_dias integer CHECK (validade_dias IS NULL OR validade_dias BETWEEN 1 AND 3650),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Um órgão por município e esfera, por empresa — sem a caixa do nome contar.
CREATE UNIQUE INDEX IF NOT EXISTS certidoes_orgaos_da_empresa_unico
  ON public.certidoes_orgaos_da_empresa (empresa_id, esfera, uf, lower(municipio));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certidoes_orgaos_da_empresa_updated_at ON public.certidoes_orgaos_da_empresa;
CREATE TRIGGER trg_certidoes_orgaos_da_empresa_updated_at
  BEFORE UPDATE ON public.certidoes_orgaos_da_empresa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.certidoes_orgaos_da_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa;
CREATE POLICY "membros leem orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros cadastram orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa;
CREATE POLICY "membros cadastram orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "membros alteram orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa;
CREATE POLICY "membros alteram orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa
  FOR UPDATE TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin apaga orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa;
CREATE POLICY "admin apaga orgaos de certidoes da empresa" ON public.certidoes_orgaos_da_empresa
  FOR DELETE TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

REVOKE ALL ON public.certidoes_orgaos_da_empresa FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certidoes_orgaos_da_empresa TO authenticated;
GRANT ALL ON public.certidoes_orgaos_da_empresa TO service_role;

COMMENT ON TABLE public.certidoes_orgaos_da_empresa IS
  'Certidões, fase 2 (23/09/2026): o órgão municipal que a própria empresa cadastra para município fora do mapa de data/certidoes-estaduais-municipais.ts. O catálogo mescla: no mapa → mapa; fora → este cadastro; sem nenhum → "a cadastrar".';
COMMENT ON COLUMN public.certidoes_orgaos_da_empresa.municipio IS 'Como está em empresas.municipio; comparado sem acento e sem caixa pelo catálogo.';
COMMENT ON COLUMN public.certidoes_orgaos_da_empresa.validade_dias IS 'Validade usual da certidão de débitos deste órgão, em dias; nulo = conforme o documento ou o edital. A inscrição municipal não vence.';

NOTIFY pgrst, 'reload schema';

-- ── Conferência (a colar depois; só leitura) ────────────────────────────────
-- SELECT tablename, policyname, cmd
--   FROM pg_policies
--  WHERE tablename IN ('documentos_solicitacoes', 'certidoes_orgaos_da_empresa')
--  ORDER BY tablename, cmd, policyname;
-- -- esperado: 4 regras em cada tabela (SELECT/INSERT/UPDATE por membro, DELETE por admin)
--
-- SELECT documento_nome, orgao, email_destino, solicitada_em, prazo_resposta, protocolo, encerrada_em
--   FROM public.documentos_solicitacoes
--  ORDER BY solicitada_em DESC
--  LIMIT 20;
--
-- SELECT uf, municipio, nome_orgao, site, email, validade_dias, updated_at
--   FROM public.certidoes_orgaos_da_empresa
--  ORDER BY updated_at DESC
--  LIMIT 20;
