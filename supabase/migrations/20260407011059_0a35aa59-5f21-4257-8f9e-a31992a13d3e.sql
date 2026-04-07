
-- ============================================================
-- TRIGGER: editais_coletados → pncp_editais_cache
-- Sincroniza automaticamente novos editais coletados pela
-- edge function coletar-portais para a tabela de cache com FTS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_sync_editais_coletados_para_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_pncp_id TEXT;
  v_fonte TEXT;
  v_fonte_id TEXT;
  v_modalidade_id INTEGER;
BEGIN
  -- Derivar fonte e fonte_id a partir do identificador_ext
  v_fonte := CASE
    WHEN NEW.identificador_ext ILIKE 'pncp_%' THEN 'PNCP'
    WHEN NEW.identificador_ext ILIKE 'licitanet_%' THEN 'Licitanet'
    WHEN NEW.identificador_ext ILIKE 'bll_%' THEN 'BLL'
    WHEN NEW.identificador_ext ILIKE 'tcm%' THEN 'TCM-PA'
    WHEN NEW.identificador_ext ILIKE 'comprasnet_%' THEN 'ComprasNet'
    WHEN NEW.identificador_ext ILIKE 'banpara%' THEN 'BanParaNet'
    ELSE 'Portal'
  END;

  v_fonte_id := NEW.identificador_ext;

  -- Para PNCP, extrair o pncp_id limpo
  v_pncp_id := CASE
    WHEN NEW.identificador_ext ILIKE 'pncp_%'
      THEN substring(NEW.identificador_ext FROM 6)
    ELSE NULL
  END;

  -- Mapear modalidade texto para código numérico PNCP
  v_modalidade_id := CASE NEW.modalidade
    WHEN 'Pregão Eletrônico'         THEN 6
    WHEN 'Pregão Presencial'         THEN 7
    WHEN 'Dispensa de Licitação'     THEN 8
    WHEN 'Dispensa Eletrônica'       THEN 8
    WHEN 'Concorrência Eletrônica'   THEN 4
    WHEN 'Concorrência Presencial'   THEN 5
    WHEN 'Inexigibilidade'           THEN 9
    WHEN 'Manifestação de Interesse' THEN 10
    WHEN 'Credenciamento'            THEN 12
    ELSE NULL
  END;

  -- Upsert em pncp_editais_cache com nomes REAIS das colunas
  INSERT INTO pncp_editais_cache (
    pncp_id,
    fonte,
    fonte_id,
    modalidade_id,
    modalidade_nome,
    numero_compra,
    orgao,
    uf,
    municipio,
    objeto,
    valor_total_estimado,
    data_publicacao_pncp,
    data_abertura_proposta,
    link_sistema_origem,
    url_pncp
  ) VALUES (
    v_pncp_id,
    v_fonte,
    v_fonte_id,
    v_modalidade_id,
    NEW.modalidade,
    NEW.numero,
    NEW.orgao,
    NEW.uf,
    NEW.municipio,
    NEW.objeto,
    NEW.valor_estimado,
    NEW.data_publicacao,
    NEW.data_abertura,
    NEW.url_edital,
    NEW.url_edital
  )
  ON CONFLICT (fonte, fonte_id) WHERE fonte_id IS NOT NULL
  DO UPDATE SET
    modalidade_id        = EXCLUDED.modalidade_id,
    modalidade_nome      = EXCLUDED.modalidade_nome,
    orgao                = EXCLUDED.orgao,
    uf                   = EXCLUDED.uf,
    municipio            = EXCLUDED.municipio,
    objeto               = EXCLUDED.objeto,
    valor_total_estimado = EXCLUDED.valor_total_estimado,
    data_publicacao_pncp = EXCLUDED.data_publicacao_pncp,
    data_abertura_proposta = EXCLUDED.data_abertura_proposta,
    link_sistema_origem  = EXCLUDED.link_sistema_origem,
    updated_at           = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca deixar o trigger quebrar o insert original
  RAISE WARNING 'fn_sync_editais: % - identificador: %', SQLERRM, NEW.identificador_ext;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar trigger para INSERT e UPDATE
DROP TRIGGER IF EXISTS tg_sync_editais_para_cache ON editais_coletados;
CREATE TRIGGER tg_sync_editais_para_cache
  AFTER INSERT OR UPDATE ON editais_coletados
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_editais_coletados_para_cache();
