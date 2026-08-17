-- =============================================================================
-- Documentos são da EMPRESA, não de quem fez o upload
--
-- `documentos` nasceu sem `empresa_id` e com RLS `auth.uid() = user_id`. Na
-- prática: a CND que o dono baixou da Receita é invisível para o financeiro,
-- que é justamente quem precisa dela para acompanhar a NF-e. O kit de
-- faturamento sairia vazio, e nem daria erro — só não teria nada dentro.
--
-- Mesmo princípio já codificado para licitações (CLAUDE.md, princípio 2):
-- certidão negativa é da pessoa jurídica, não da pessoa física que a emitiu.
--
-- Resolução da empresa no backfill, por ordem de confiança — mesma disciplina
-- de 20260808000004 (backfill de licitacoes):
--   a) empresa ativa do perfil, se o usuário for mesmo membro dela;
--   b) a única empresa do usuário, quando ele só pertence a uma.
-- Usuário ambíguo fica de fora: chutar contaminaria uma empresa com documento
-- de outra, e documento de habilitação errado reprova em licitação.
-- =============================================================================

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

WITH empresa_unica AS (
  SELECT user_id, (min(empresa_id::text))::uuid AS empresa_id
    FROM public.empresa_membros
   GROUP BY user_id
  HAVING count(DISTINCT empresa_id) = 1
),
resolucao AS (
  SELECT d.id,
         COALESCE(
           CASE
             WHEN EXISTS (
               SELECT 1 FROM public.empresa_membros m
                WHERE m.user_id = d.user_id
                  AND m.empresa_id = p.empresa_ativa_id
             ) THEN p.empresa_ativa_id
           END,
           eu.empresa_id
         ) AS empresa_id
    FROM public.documentos d
    LEFT JOIN public.profiles p      ON p.user_id = d.user_id
    LEFT JOIN empresa_unica  eu      ON eu.user_id = d.user_id
   WHERE d.empresa_id IS NULL
)
UPDATE public.documentos d
   SET empresa_id = r.empresa_id
  FROM resolucao r
 WHERE r.id = d.id
   AND r.empresa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_empresa_validade
  ON public.documentos(empresa_id, validade);

-- ── RLS: a empresa inteira lê e mantém ───────────────────────────────────────
--
-- O fallback por `user_id` continua para documento que o backfill não conseguiu
-- resolver — sem ele, quem subiu perderia acesso ao próprio arquivo.
DROP POLICY IF EXISTS "Users can CRUD own documentos" ON public.documentos;
DROP POLICY IF EXISTS "Membros gerenciam documentos da empresa" ON public.documentos;

CREATE POLICY "Membros gerenciam documentos da empresa" ON public.documentos
  FOR ALL TO authenticated
  USING (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  );

COMMENT ON COLUMN public.documentos.empresa_id IS
  'Empresa dona do documento. Certidão, contrato social e atestado são da '
  'pessoa jurídica — o financeiro precisa alcançar o que o comercial subiu. '
  'Nulo só em registro antigo que o backfill não conseguiu resolver.';
