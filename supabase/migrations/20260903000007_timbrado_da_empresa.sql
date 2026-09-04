-- ═══════════════════════════════════════════════════════════════════════════
-- Timbrado da empresa — identidade única para todo documento gerado (03/09)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Cada empresa configura UMA vez (Configurações → Timbrado): logotipo,
-- cabeçalho (qualificação) e rodapé (contatos). Todo gerador de documento —
-- recibo, relatórios, cabeçalho impresso, e os que vierem — consome a mesma
-- fonte, em retrato e paisagem. Sem configuração, nada muda: cada documento
-- mantém o cabeçalho que já tinha (princípio 7 — ausência de configuração
-- não é barrada por padrão inventado).

CREATE TABLE IF NOT EXISTS public.empresa_timbrado (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  logo_path text,
  cabecalho text,
  rodape text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

ALTER TABLE public.empresa_timbrado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_timbrado_select ON public.empresa_timbrado;
DROP POLICY IF EXISTS empresa_timbrado_insert ON public.empresa_timbrado;
DROP POLICY IF EXISTS empresa_timbrado_update ON public.empresa_timbrado;

-- Todo membro LÊ (é ele quem gera documentos); só o Admin define a identidade.
CREATE POLICY empresa_timbrado_select ON public.empresa_timbrado
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY empresa_timbrado_insert ON public.empresa_timbrado
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE POLICY empresa_timbrado_update ON public.empresa_timbrado
  FOR UPDATE TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── Bucket do logotipo: <empresa_id>/logo.png ───────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresa-timbrado', 'empresa-timbrado', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS timbrado_logo_select ON storage.objects;
DROP POLICY IF EXISTS timbrado_logo_insert ON storage.objects;
DROP POLICY IF EXISTS timbrado_logo_update ON storage.objects;
DROP POLICY IF EXISTS timbrado_logo_delete ON storage.objects;

CREATE POLICY timbrado_logo_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'empresa-timbrado'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY timbrado_logo_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'empresa-timbrado'
    AND public.is_empresa_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY timbrado_logo_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'empresa-timbrado'
    AND public.is_empresa_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY timbrado_logo_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'empresa-timbrado'
    AND public.is_empresa_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));
