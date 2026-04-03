
-- 1. Recreate empresas_safe with security_invoker = true
CREATE OR REPLACE VIEW public.empresas_safe
WITH (security_invoker = true)
AS
SELECT id,
    created_by,
    cnpj,
    razao_social,
    nome_fantasia,
    cnae_principal,
    uf,
    municipio,
    endereco,
    complemento,
    bairro,
    cep,
    telefone,
    email,
    inscricao_estadual,
    inscricao_municipal,
    certificado_nome,
    certificado_path,
    certificado_tipo,
    certificado_validade,
    regime_tributario,
    timbrado_url,
    timbrado_path,
    cabecalho_url,
    cabecalho_path,
    rodape_url,
    rodape_path,
    rep_nome,
    rep_cargo,
    rep_orgao_expedidor,
    rep_naturalidade,
    rep_nacionalidade,
    CASE
        WHEN is_empresa_admin(auth.uid(), id) THEN rep_cpf
        ELSE NULL::text
    END AS rep_cpf,
    CASE
        WHEN is_empresa_admin(auth.uid(), id) THEN rep_rg
        ELSE NULL::text
    END AS rep_rg,
    created_at,
    updated_at
FROM empresas
WHERE (is_empresa_member(auth.uid(), id) OR is_empresa_creator(auth.uid(), id));

-- 2. Recreate credenciais_portais_safe with security_invoker = true
CREATE OR REPLACE VIEW public.credenciais_portais_safe
WITH (security_invoker = true)
AS
SELECT id,
    user_id,
    portal_id,
    portal_nome,
    login,
    certificado_path,
    certificado_tipo,
    certificado_nome,
    validade_certificado,
    status,
    created_at,
    updated_at
FROM credenciais_portais;

-- 3. Recreate nuvem_fiscal_config_safe with security_invoker = true
CREATE OR REPLACE VIEW public.nuvem_fiscal_config_safe
WITH (security_invoker = true)
AS
SELECT id,
    user_id,
    empresa_id,
    ambiente,
    certificado_path,
    certificado_validade,
    ativo,
    created_at,
    updated_at
FROM nuvem_fiscal_config;

-- 4. Add missing UPDATE policy on backup_verificacao for admins
CREATE POLICY "Admins can update backup_verificacao"
ON public.backup_verificacao
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Revoke direct access to base tables from anon/authenticated via the views
-- (The views with security_invoker=true will use the caller's permissions,
--  so the existing RLS on empresas, credenciais_portais, nuvem_fiscal_config
--  will be enforced automatically)
