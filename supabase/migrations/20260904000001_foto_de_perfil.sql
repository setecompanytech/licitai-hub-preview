-- Foto de perfil do usuário
--
-- A coluna `profiles.avatar_url` JÁ EXISTE — conferido contra o banco em
-- 2026-09-04 (a consulta devolve lista vazia, não `42703`). Nunca foi
-- preenchida porque não havia por onde enviar o arquivo. Esta migration cria
-- só o que falta: o bucket.
--
-- Não há tabela nova, e não deveria haver: foto é ARQUIVO. Guardar imagem em
-- coluna de banco (base64 ou bytea) infla cada SELECT de perfil com centenas
-- de KB que ninguém pediu, some do cache do navegador e transforma troca de
-- foto em UPDATE de linha quente. O Storage já é o padrão deste repo — são
-- oito buckets em uso.
--
-- ── Por que o bucket é público ───────────────────────────────────────────────
-- Avatar aparece no cabeçalho, na equipe, no mural e no chat — inclusive para
-- colega de outra empresa que divide um processo. Bucket privado exigiria URL
-- assinada, que expira: cada tela precisaria renovar a assinatura de cada foto,
-- e a imagem piscaria ao vencer.
--
-- O que protege é o CAMINHO: `{user_id}/{uuid}.{ext}`. O UUID é aleatório, não
-- é derivado do usuário e não aparece em lugar nenhum além do próprio perfil.
-- Quem não recebeu o link não o adivinha.
--
-- Não coloque aqui nada que não possa ser visto por quem tem o link. É bucket
-- de avatar, não de documento.

-- ── 1. O bucket ─────────────────────────────────────────────────────────────
-- 2 MB e só imagem. O limite é do BUCKET, não do formulário: validação no
-- front é conveniência para o usuário, e o servidor é quem recusa de verdade.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatares',
  'avatares',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Políticas ────────────────────────────────────────────────────────────
-- Caminho: {user_id}/{uuid}.{ext} — a primeira pasta é o dono, e é ela que as
-- políticas de escrita conferem. Mesmo desenho do bucket de documentos
-- fiscais, trocando `is_empresa_member` por identidade: avatar é da PESSOA,
-- não da empresa. Quem troca de empresa leva a própria foto.

DROP POLICY IF EXISTS "avatar e visivel para todos" ON storage.objects;
CREATE POLICY "avatar e visivel para todos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatares');

DROP POLICY IF EXISTS "dono envia o proprio avatar" ON storage.objects;
CREATE POLICY "dono envia o proprio avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatares'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "dono substitui o proprio avatar" ON storage.objects;
CREATE POLICY "dono substitui o proprio avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatares'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Apagar é do dono e de mais ninguém — nem do admin da empresa. A foto sai
-- junto com a troca: o app grava a nova e remove a anterior, senão o bucket
-- vira depósito de todas as fotos que a pessoa já teve.
DROP POLICY IF EXISTS "dono apaga o proprio avatar" ON storage.objects;
CREATE POLICY "dono apaga o proprio avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatares'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. A coluna, por garantia ───────────────────────────────────────────────
-- Já existe no banco de produção. O IF NOT EXISTS está aqui para o caso de
-- alguém subir este schema do zero num ambiente novo.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.avatar_url IS
  'URL pública da foto no bucket `avatares`. Caminho {user_id}/{uuid}.{ext}.';
