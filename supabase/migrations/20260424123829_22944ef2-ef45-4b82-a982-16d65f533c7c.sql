-- Índices otimizados para filtros frequentes (idempotentes)

-- CONTRATOS
CREATE INDEX IF NOT EXISTS idx_contratos_empresa_tipo_status
  ON public.contratos (empresa_id, tipo_documento, status)
  WHERE empresa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_user_tipo_data
  ON public.contratos (user_id, tipo_documento, data_assinatura DESC);

CREATE INDEX IF NOT EXISTS idx_contratos_ata_srp_data
  ON public.contratos (ata_srp_id, data_assinatura DESC)
  WHERE ata_srp_id IS NOT NULL AND tipo_documento = 'contrato';

CREATE INDEX IF NOT EXISTS idx_contratos_vigencia
  ON public.contratos (data_inicio, data_fim)
  WHERE status IN ('ativo', 'vigente');

-- CONTRATO_ITENS
CREATE INDEX IF NOT EXISTS idx_contrato_itens_contrato_codigo
  ON public.contrato_itens (contrato_id, codigo_item);

CREATE INDEX IF NOT EXISTS idx_contrato_itens_ata_item
  ON public.contrato_itens (ata_item_id)
  WHERE ata_item_id IS NOT NULL;

-- CONTRATO_ADITIVOS
CREATE INDEX IF NOT EXISTS idx_contrato_aditivos_contrato_data
  ON public.contrato_aditivos (contrato_id, data_assinatura DESC);

-- CONTRATO_IA_AUDITORIA
CREATE INDEX IF NOT EXISTS idx_contrato_ia_auditoria_contrato_data
  ON public.contrato_ia_auditoria (contrato_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contrato_ia_auditoria_origem
  ON public.contrato_ia_auditoria (contrato_id, origem, created_at DESC);

-- CONTRATO_PEDIDOS
CREATE INDEX IF NOT EXISTS idx_contrato_pedidos_contrato_item
  ON public.contrato_pedidos (contrato_id, contrato_item_id, status);

CREATE INDEX IF NOT EXISTS idx_contrato_pedidos_data
  ON public.contrato_pedidos (contrato_id, created_at DESC);

-- Atualiza estatísticas do planner
ANALYZE public.contratos;
ANALYZE public.contrato_itens;
ANALYZE public.contrato_aditivos;
ANALYZE public.contrato_ia_auditoria;
ANALYZE public.contrato_pedidos;