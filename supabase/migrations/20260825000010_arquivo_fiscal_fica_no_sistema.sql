-- ═══════════════════════════════════════════════════════════════════════════
-- O documento fiscal passa a ficar no sistema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hoje o PDF que se envia em Contas a Receber é lido para a memória, vira
-- imagem, vai para a IA, produz um lançamento — e some quando a tela fecha.
-- O XML tem o mesmo destino por outro caminho: a edge function extrai os
-- campos e não guarda o arquivo. Sobra o REGISTRO da nota; não sobra a NOTA.
--
-- Para quem vende a órgão público isso é três problemas de uma vez:
--
--   • Guarda. O XML da NF-e É o documento fiscal; o DANFE em PDF é só a
--     representação impressa dele. Guardar campos extraídos não cumpre o
--     prazo decadencial de cinco anos.
--   • Prova. Quando o órgão questiona uma entrega, ou quando se pede
--     reequilíbrio, a nota é a prova. Hoje ela está no e-mail de alguém.
--   • Auditoria da leitura. Em 25/08 a IA leu o número da nota no lugar da
--     chave de acesso. Sem o arquivo original, não há como reconferir o que
--     ela leu errado — e `ocr_data`, a coluna que existe exatamente para
--     isso, está vazia.
--
-- ── O que já existia, e por que nunca funcionou ─────────────────────────────
-- `financeiro_documentos_fiscais` foi criada em abril com as colunas certas,
-- incluindo `arquivo_url`, `arquivo_xml` e `ocr_data`. Tem RLS habilitada e
-- ZERO políticas — o que significa que ninguém, nunca, conseguiria ler ou
-- gravar nela. Ela não foi esquecida: ela foi construída sem porta.
--
-- Os buckets `nfes-xml`, `danfes` e `capturas-ocr` também existem desde abril,
-- sem uso. E as políticas deles isolam por `auth.uid()` — por USUÁRIO. Nota
-- fiscal é da EMPRESA: com aquela regra, o documento que o contador subiu
-- ficaria invisível para o sócio. É o mesmo defeito do princípio 2 do
-- CLAUDE.md, e é por isso que aqui nasce um bucket novo em vez de reaproveitar
-- os três.

-- ── 1. O bucket, isolado por empresa ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('financeiro-documentos', 'financeiro-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Caminho: {empresa_id}/{ano}/{uuid}.{ext}
-- A primeira pasta é a empresa, e é ela que a política confere.
DROP POLICY IF EXISTS "membros leem documentos fiscais" ON storage.objects;
CREATE POLICY "membros leem documentos fiscais"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'financeiro-documentos'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "membros enviam documentos fiscais" ON storage.objects;
CREATE POLICY "membros enviam documentos fiscais"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'financeiro-documentos'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Excluir documento fiscal é ato de administrador. Nota guardada por
-- obrigação legal não se apaga por engano de quem estava organizando pasta.
DROP POLICY IF EXISTS "admin exclui documentos fiscais" ON storage.objects;
CREATE POLICY "admin exclui documentos fiscais"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'financeiro-documentos'
    AND public.is_empresa_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ── 2. A tabela ganha o que faltava para servir ─────────────────────────────
ALTER TABLE public.financeiro_documentos_fiscais
  ADD COLUMN IF NOT EXISTS lancamento_id uuid
    REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_path  text,
  ADD COLUMN IF NOT EXISTS arquivo_nome  text,
  ADD COLUMN IF NOT EXISTS arquivo_mime  text,
  ADD COLUMN IF NOT EXISTS arquivo_bytes bigint,
  ADD COLUMN IF NOT EXISTS enviado_por   uuid;

-- `data_emissao` e `valor_total` eram NOT NULL. Isso obrigaria a esperar a
-- leitura da IA terminar para só então gravar o documento — e era justamente
-- a leitura que podia falhar, levando o arquivo junto. A CHEGADA do documento
-- é um fato; o CONTEÚDO dele é uma interpretação, e interpretação pode vir
-- depois, ou não vir.
ALTER TABLE public.financeiro_documentos_fiscais
  ALTER COLUMN data_emissao DROP NOT NULL,
  ALTER COLUMN valor_total  DROP NOT NULL,
  ALTER COLUMN valor_total  SET DEFAULT 0,
  ALTER COLUMN tipo         SET DEFAULT 'outro';

CREATE INDEX IF NOT EXISTS idx_fdf_lancamento
  ON public.financeiro_documentos_fiscais(lancamento_id)
  WHERE lancamento_id IS NOT NULL;

-- ── 3. As políticas que nunca existiram ─────────────────────────────────────
DROP POLICY IF EXISTS "membros leem docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "membros leem docs fiscais"
  ON public.financeiro_documentos_fiscais FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros gravam docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "membros gravam docs fiscais"
  ON public.financeiro_documentos_fiscais FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros atualizam docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "membros atualizam docs fiscais"
  ON public.financeiro_documentos_fiscais FOR UPDATE TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin exclui docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "admin exclui docs fiscais"
  ON public.financeiro_documentos_fiscais FOR DELETE TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

COMMENT ON TABLE public.financeiro_documentos_fiscais IS
  'O documento fiscal em si — o arquivo, não os campos extraídos dele. '
  'storage_path aponta para o bucket financeiro-documentos; arquivo_xml guarda '
  'o XML da NF-e, que É o documento (o DANFE é só a representação impressa). '
  'ocr_data guarda o que a leitura automática entendeu, para se poder conferir '
  'depois contra o original. Nasceu em 2026-04 com RLS habilitada e nenhuma '
  'política — inacessível — e só passou a servir em 2026-08.';

COMMENT ON COLUMN public.financeiro_documentos_fiscais.ocr_data IS
  'O que a leitura automática entendeu, cru. Em 25/08 a IA leu o número da '
  'nota no lugar da chave de acesso; sem este campo e sem o arquivo original, '
  'não havia como descobrir o que ela leu errado.';
