
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS notificacoes_config jsonb DEFAULT '{"editais_compativeis":true,"prazos_proximos":true,"atividade_concorrentes":false,"relatorios_semanais":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS portais_monitorados jsonb DEFAULT '{"compras_governamentais":true,"pncp":true,"bec_sp":false,"licitacoes_e_bb":true,"bolsa_nacional":true,"banparanet_pa":true,"compras_publicas_rj":true,"bll_compras":true,"licitanet":true,"portal_compras_publicas":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS diarios_monitorados jsonb DEFAULT '{"dou_federal":true,"ioepa_estadual":true,"tcmpa_municipios":true,"doe_sp":true,"ioerj":true,"dodf_e":true}'::jsonb;
