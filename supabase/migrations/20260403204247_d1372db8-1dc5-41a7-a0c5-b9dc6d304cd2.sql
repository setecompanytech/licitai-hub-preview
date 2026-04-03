
-- credenciais_portais_safe view (base table already has proper SELECT policy)
CREATE VIEW public.credenciais_portais_safe
WITH (security_invoker=on) AS
SELECT id, user_id, portal_id, portal_nome, login, certificado_path,
       certificado_tipo, certificado_nome, validade_certificado, status,
       created_at, updated_at
FROM public.credenciais_portais;

GRANT SELECT ON public.credenciais_portais_safe TO authenticated;

-- nuvem_fiscal_config: split ALL policy into granular ones
DROP POLICY IF EXISTS "Users manage own nuvem_fiscal_config" ON public.nuvem_fiscal_config;

CREATE POLICY "Users can view own nuvem_fiscal_config"
ON public.nuvem_fiscal_config FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own nuvem_fiscal_config"
ON public.nuvem_fiscal_config FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own nuvem_fiscal_config"
ON public.nuvem_fiscal_config FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own nuvem_fiscal_config"
ON public.nuvem_fiscal_config FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- nuvem_fiscal_config_safe view
CREATE VIEW public.nuvem_fiscal_config_safe
WITH (security_invoker=on) AS
SELECT id, user_id, empresa_id, ambiente, certificado_path,
       certificado_validade, ativo, created_at, updated_at
FROM public.nuvem_fiscal_config;

GRANT SELECT ON public.nuvem_fiscal_config_safe TO authenticated;
