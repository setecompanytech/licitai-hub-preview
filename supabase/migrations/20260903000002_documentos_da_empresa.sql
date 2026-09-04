-- ═══════════════════════════════════════════════════════════════════════════
-- Controle de Documentos passa a ser DA EMPRESA (03/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A tabela `documentos` nasceu pessoal (RLS auth.uid() = user_id, FOR ALL):
-- cada colaborador via só o que ele mesmo anexou — mas contrato social,
-- certidões e balanço são documentos DA EMPRESA (princípio nº 2 da
-- arquitetura). Conversão nos moldes da casa:
--   · linha nova nasce com empresa_id (a tela envia);
--   · linha antiga herda a empresa quando o dono pertence a UMA só
--     (sem ambiguidade); quem pertence a várias mantém a linha privada e
--     ganha o botão "Compartilhar com a equipe" na tela — mudança de
--     alcance é decisão de alguém, nunca efeito de migration (princípio 7);
--   · leitura/renovação por qualquer membro; exclusão da linha por dono ou
--     admin (padrão delete-admin da casa).

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documentos_empresa ON public.documentos(empresa_id);

-- Herança sem ambiguidade: só usuários com exatamente UMA empresa.
UPDATE public.documentos d
SET empresa_id = m.empresa_id
FROM (
  SELECT user_id, min(empresa_id::text)::uuid AS empresa_id
  FROM public.empresa_membros
  GROUP BY user_id
  HAVING count(DISTINCT empresa_id) = 1
) m
WHERE d.empresa_id IS NULL
  AND d.user_id = m.user_id
RETURNING d.id;

DROP POLICY IF EXISTS "Users can CRUD own documentos" ON public.documentos;
DROP POLICY IF EXISTS documentos_select_empresa ON public.documentos;
DROP POLICY IF EXISTS documentos_insert_empresa ON public.documentos;
DROP POLICY IF EXISTS documentos_update_empresa ON public.documentos;
DROP POLICY IF EXISTS documentos_delete_empresa ON public.documentos;

CREATE POLICY documentos_select_empresa ON public.documentos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id)));

CREATE POLICY documentos_insert_empresa ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id)));

-- Renovar certidão vencida é rotina de equipe: update por membro.
CREATE POLICY documentos_update_empresa ON public.documentos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id)))
  WITH CHECK (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY documentos_delete_empresa ON public.documentos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_admin(auth.uid(), empresa_id)));

-- ── Storage: arquivos da empresa vivem em empresa/<empresa_id>/… ────────────
-- Os caminhos antigos (<user_id>/…) continuam válidos para o dono; sem estas
-- policies, o colega veria a LINHA e não abriria o ARQUIVO.
DROP POLICY IF EXISTS docs_habilitacao_empresa_select ON storage.objects;
DROP POLICY IF EXISTS docs_habilitacao_empresa_insert ON storage.objects;
DROP POLICY IF EXISTS docs_habilitacao_empresa_update ON storage.objects;
DROP POLICY IF EXISTS docs_habilitacao_empresa_delete ON storage.objects;

CREATE POLICY docs_habilitacao_empresa_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-habilitacao'
    AND (storage.foldername(name))[1] = 'empresa'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[2])::uuid));

CREATE POLICY docs_habilitacao_empresa_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-habilitacao'
    AND (storage.foldername(name))[1] = 'empresa'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[2])::uuid));

CREATE POLICY docs_habilitacao_empresa_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-habilitacao'
    AND (storage.foldername(name))[1] = 'empresa'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[2])::uuid));

CREATE POLICY docs_habilitacao_empresa_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-habilitacao'
    AND (storage.foldername(name))[1] = 'empresa'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[2])::uuid));
