-- ═══════════════════════════════════════════════════════════════════════════
-- O conteúdo da pasta é lido pela empresa; alterado por quem subiu ou pelo admin
-- Data: 2026-09-17 — opção 3, decidida pelo dono do produto em 17/09
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A pasta do processo tem três gavetas — edital e anexos (`processo_anexos` +
-- bucket `processo-arquivos`), itens extraídos (`licitacao_itens`) e documentos
-- montados (`processo_documentos`) — e todas eram visíveis SÓ para quem gravou
-- (`auth.uid() = user_id`). Com a aba Compromissos mostrando o quadro da
-- empresa (20260917000001), o colega passou a abrir a pasta e encontrá-la
-- vazia: sem o edital, sem os 614 itens que outra pessoa extraiu. A reação é
-- extrair de novo — a O S já tinha 3 processos com itens de duas pessoas.
--
-- O que muda (aditivo — nenhuma política existente é removida):
--   · LEITURA por membro da empresa, chegando à empresa pela licitação
--     (`is_empresa_member`, princípio 2: o processo é da empresa);
--   · ALTERAÇÃO e EXCLUSÃO pelo administrador da empresa (`is_empresa_admin`),
--     somando-se ao direito de quem gravou, que continua o mesmo;
--   · o mesmo para os arquivos do bucket `processo-arquivos`. O id da
--     licitação fica no 2º segmento (`usuário/licitação/categoria/arquivo`)
--     ou no 3º (`usuário/zip-extraido/licitação/arquivo`); a política aceita
--     os dois. `processo_documentos` não usa bucket (coluna `pdf_path`, tabela
--     vazia em 17/09) e só ganha política de tabela.
--
-- Impacto medido em 17/09 (linhas que passam a ser visíveis aos colegas):
--   O S DISTRIBUIDORA  8 anexos · 614 itens · 4 membros
--   GRUPO SANTA ROSA   6 anexos · 140 itens · 5 membros
--   demais empresas    têm um membro só — nada muda na prática
--
-- O service role (edge functions) não passa pelo RLS: a regra "substituir
-- itens é de quem extraiu ou do admin" está repetida em
-- `edital-auto-ingest`, que é onde a substituição acontece no servidor.
--
-- REVERSÃO: os DROP POLICY abaixo, sem os CREATE. O índice pode ficar.

-- ── licitacao_itens ──────────────────────────────────────────────────────────
-- A política existente é `ALL USING (auth.uid() = user_id)`: quem extraiu
-- continua lendo, alterando e apagando o que é seu.

DROP POLICY IF EXISTS "membros leem itens do processo da empresa" ON public.licitacao_itens;
CREATE POLICY "membros leem itens do processo da empresa" ON public.licitacao_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = licitacao_itens.licitacao_id
         AND public.is_empresa_member(auth.uid(), l.empresa_id)
    )
  );

DROP POLICY IF EXISTS "admin altera itens do processo da empresa" ON public.licitacao_itens;
CREATE POLICY "admin altera itens do processo da empresa" ON public.licitacao_itens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = licitacao_itens.licitacao_id
         AND public.is_empresa_admin(auth.uid(), l.empresa_id)
    )
  );

DROP POLICY IF EXISTS "admin apaga itens do processo da empresa" ON public.licitacao_itens;
CREATE POLICY "admin apaga itens do processo da empresa" ON public.licitacao_itens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = licitacao_itens.licitacao_id
         AND public.is_empresa_admin(auth.uid(), l.empresa_id)
    )
  );

-- A tabela só tinha a chave primária. Toda leitura é por licitação — e agora
-- a política também consulta por ela.
CREATE INDEX IF NOT EXISTS idx_licitacao_itens_licitacao
  ON public.licitacao_itens (licitacao_id);

-- ── processo_anexos ──────────────────────────────────────────────────────────
-- Existentes: SELECT/UPDATE/DELETE de quem gravou; INSERT com `auth.uid() = user_id`.
-- O colega que anexa grava na PRÓPRIA pasta do bucket, com o próprio user_id —
-- o INSERT não muda.

DROP POLICY IF EXISTS "membros leem anexos do processo da empresa" ON public.processo_anexos;
CREATE POLICY "membros leem anexos do processo da empresa" ON public.processo_anexos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = processo_anexos.licitacao_id
         AND public.is_empresa_member(auth.uid(), l.empresa_id)
    )
  );

DROP POLICY IF EXISTS "admin altera anexos do processo da empresa" ON public.processo_anexos;
CREATE POLICY "admin altera anexos do processo da empresa" ON public.processo_anexos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = processo_anexos.licitacao_id
         AND public.is_empresa_admin(auth.uid(), l.empresa_id)
    )
  );

DROP POLICY IF EXISTS "admin apaga anexos do processo da empresa" ON public.processo_anexos;
CREATE POLICY "admin apaga anexos do processo da empresa" ON public.processo_anexos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = processo_anexos.licitacao_id
         AND public.is_empresa_admin(auth.uid(), l.empresa_id)
    )
  );

-- ── processo_documentos ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "membros leem documentos do processo da empresa" ON public.processo_documentos;
CREATE POLICY "membros leem documentos do processo da empresa" ON public.processo_documentos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = processo_documentos.licitacao_id
         AND public.is_empresa_member(auth.uid(), l.empresa_id)
    )
  );

DROP POLICY IF EXISTS "admin altera documentos do processo da empresa" ON public.processo_documentos;
CREATE POLICY "admin altera documentos do processo da empresa" ON public.processo_documentos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = processo_documentos.licitacao_id
         AND public.is_empresa_admin(auth.uid(), l.empresa_id)
    )
  );

DROP POLICY IF EXISTS "admin apaga documentos do processo da empresa" ON public.processo_documentos;
CREATE POLICY "admin apaga documentos do processo da empresa" ON public.processo_documentos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id = processo_documentos.licitacao_id
         AND public.is_empresa_admin(auth.uid(), l.empresa_id)
    )
  );

-- ── bucket processo-arquivos ─────────────────────────────────────────────────
-- Leitura do arquivo pelo membro: `createSignedUrl` e `download` passam por
-- SELECT em storage.objects. Upload continua na pasta de quem envia
-- (política "Users ... own processo files", intocada).

DROP POLICY IF EXISTS "membros leem arquivos do processo da empresa" ON storage.objects;
CREATE POLICY "membros leem arquivos do processo da empresa" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'processo-arquivos'
    AND EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id::text IN ((storage.foldername(name))[2], (storage.foldername(name))[3])
         AND public.is_empresa_member(auth.uid(), l.empresa_id)
    )
  );

DROP POLICY IF EXISTS "admin apaga arquivos do processo da empresa" ON storage.objects;
CREATE POLICY "admin apaga arquivos do processo da empresa" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'processo-arquivos'
    AND EXISTS (
      SELECT 1 FROM public.licitacoes l
       WHERE l.id::text IN ((storage.foldername(name))[2], (storage.foldername(name))[3])
         AND public.is_empresa_admin(auth.uid(), l.empresa_id)
    )
  );

NOTIFY pgrst, 'reload schema';

-- ── Conferência (somente leitura) ────────────────────────────────────────────
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE policyname LIKE '%do processo da empresa'
--  ORDER BY 1, 3;
-- Esperado: 11 linhas — 3 por tabela (SELECT, UPDATE, DELETE) e 2 em storage.objects.
