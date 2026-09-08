-- ═══════════════════════════════════════════════════════════════════════════
-- O dossiê do contrato é da EMPRESA (08/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- contrato_arquivos, suas versões e o bucket contratos-docs nasceram com RLS
-- por USUÁRIO: recorte de publicação, ordem/empenho e versões eram invisíveis
-- entre colegas — o "O recorte não foi encontrado no dossiê" do Admin ao abrir
-- um extrato registrado pelo Setor Comercial. Mesmo defeito de classe dos
-- documentos do Jurídico (princípio nº 2: processo é da empresa).

-- ── Tabela principal ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own contract files" ON public.contrato_arquivos;
DROP POLICY IF EXISTS "Users can insert own contract files" ON public.contrato_arquivos;
DROP POLICY IF EXISTS "Users can update own contract files" ON public.contrato_arquivos;
DROP POLICY IF EXISTS "Users can delete own contract files" ON public.contrato_arquivos;
DROP POLICY IF EXISTS ca_select_membro ON public.contrato_arquivos;
DROP POLICY IF EXISTS ca_insert_membro ON public.contrato_arquivos;
DROP POLICY IF EXISTS ca_update_membro ON public.contrato_arquivos;
DROP POLICY IF EXISTS ca_delete_dono_ou_admin ON public.contrato_arquivos;

CREATE POLICY ca_select_membro ON public.contrato_arquivos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contratos c
                 WHERE c.id = contrato_arquivos.contrato_id
                   AND public.is_empresa_member(auth.uid(), c.empresa_id)));

CREATE POLICY ca_insert_membro ON public.contrato_arquivos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.contratos c
                WHERE c.id = contrato_arquivos.contrato_id
                  AND public.is_empresa_member(auth.uid(), c.empresa_id)));

CREATE POLICY ca_update_membro ON public.contrato_arquivos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contratos c
                 WHERE c.id = contrato_arquivos.contrato_id
                   AND public.is_empresa_member(auth.uid(), c.empresa_id)));

CREATE POLICY ca_delete_dono_ou_admin ON public.contrato_arquivos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.contratos c
               WHERE c.id = contrato_arquivos.contrato_id
                 AND public.is_empresa_admin(auth.uid(), c.empresa_id)));

-- ── Versões ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can view file versions" ON public.contrato_arquivos_versoes;
DROP POLICY IF EXISTS "Owner can insert file versions" ON public.contrato_arquivos_versoes;
DROP POLICY IF EXISTS "Owner can delete file versions" ON public.contrato_arquivos_versoes;
DROP POLICY IF EXISTS cav_select_membro ON public.contrato_arquivos_versoes;
DROP POLICY IF EXISTS cav_insert_membro ON public.contrato_arquivos_versoes;
DROP POLICY IF EXISTS cav_delete_dono_ou_admin ON public.contrato_arquivos_versoes;

CREATE POLICY cav_select_membro ON public.contrato_arquivos_versoes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contratos c
                 WHERE c.id = contrato_arquivos_versoes.contrato_id
                   AND public.is_empresa_member(auth.uid(), c.empresa_id)));

CREATE POLICY cav_insert_membro ON public.contrato_arquivos_versoes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.contratos c
                WHERE c.id = contrato_arquivos_versoes.contrato_id
                  AND public.is_empresa_member(auth.uid(), c.empresa_id)));

CREATE POLICY cav_delete_dono_ou_admin ON public.contrato_arquivos_versoes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.contratos c
               WHERE c.id = contrato_arquivos_versoes.contrato_id
                 AND public.is_empresa_admin(auth.uid(), c.empresa_id)));

-- ── Storage: leitura por membro via contrato no caminho ─────────────────────
-- Os arquivos vivem em <user_id>/<contrato_id>/… — o 2º segmento identifica o
-- contrato, e por ele chega-se à empresa. A escrita continua na pasta do
-- autor; a LEITURA passa a ser da equipe.
DROP POLICY IF EXISTS contratos_docs_membros_leem ON storage.objects;
CREATE POLICY contratos_docs_membros_leem ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contratos-docs'
    AND EXISTS (SELECT 1 FROM public.contratos c
                WHERE c.id::text = (storage.foldername(name))[2]
                  AND public.is_empresa_member(auth.uid(), c.empresa_id)));
