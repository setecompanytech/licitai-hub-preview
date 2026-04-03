
CREATE VIEW public.empresas_safe AS
SELECT id, created_by, cnpj, razao_social, nome_fantasia, cnae_principal,
       uf, municipio, endereco, complemento, bairro, cep,
       telefone, email, inscricao_estadual, inscricao_municipal,
       certificado_nome, certificado_path, certificado_tipo, certificado_validade,
       regime_tributario, timbrado_url, timbrado_path, cabecalho_url, cabecalho_path,
       rodape_url, rodape_path,
       rep_nome, rep_cargo, rep_orgao_expedidor, rep_naturalidade, rep_nacionalidade,
       CASE WHEN public.is_empresa_admin(auth.uid(), id) THEN rep_cpf ELSE NULL END AS rep_cpf,
       CASE WHEN public.is_empresa_admin(auth.uid(), id) THEN rep_rg ELSE NULL END AS rep_rg,
       created_at, updated_at
FROM public.empresas
WHERE public.is_empresa_member(auth.uid(), id)
   OR public.is_empresa_creator(auth.uid(), id);

GRANT SELECT ON public.empresas_safe TO authenticated;
