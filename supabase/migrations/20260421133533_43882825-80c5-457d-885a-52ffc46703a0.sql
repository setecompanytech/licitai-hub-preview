
-- 1) Tabela de versionamento de arquivos
CREATE TABLE IF NOT EXISTS public.contrato_arquivos_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id UUID NOT NULL REFERENCES public.contrato_arquivos(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  versao INTEGER NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho_bytes BIGINT,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caversoes_arquivo ON public.contrato_arquivos_versoes(arquivo_id);
CREATE INDEX IF NOT EXISTS idx_caversoes_contrato ON public.contrato_arquivos_versoes(contrato_id);

ALTER TABLE public.contrato_arquivos_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view file versions"
ON public.contrato_arquivos_versoes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert file versions"
ON public.contrato_arquivos_versoes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete file versions"
ON public.contrato_arquivos_versoes FOR DELETE
USING (auth.uid() = user_id);

-- coluna versao_atual em contrato_arquivos
ALTER TABLE public.contrato_arquivos
  ADD COLUMN IF NOT EXISTS versao_atual INTEGER NOT NULL DEFAULT 1;

-- 2) Validação: contrato com ATA → ata_item_id obrigatório
CREATE OR REPLACE FUNCTION public.validar_item_contrato_ata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_doc TEXT;
  v_ata_origem UUID;
BEGIN
  SELECT tipo_documento, ata_srp_id INTO v_tipo_doc, v_ata_origem
  FROM public.contratos WHERE id = NEW.contrato_id;

  -- Só valida quando documento é contrato e tem ATA de origem
  IF v_tipo_doc = 'contrato' AND v_ata_origem IS NOT NULL THEN
    IF NEW.ata_item_id IS NULL THEN
      RAISE EXCEPTION 'Este contrato é derivado de ATA SRP. Todos os itens devem ser vinculados a um item da ATA de origem.'
        USING ERRCODE = 'P0001';
    END IF;
    -- garante que o ata_item_id pertence à ATA correta
    IF NOT EXISTS (
      SELECT 1 FROM public.contrato_itens
      WHERE id = NEW.ata_item_id AND contrato_id = v_ata_origem
    ) THEN
      RAISE EXCEPTION 'O item da ATA selecionado não pertence à ATA de origem deste contrato.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_item_contrato_ata ON public.contrato_itens;
CREATE TRIGGER trg_validar_item_contrato_ata
BEFORE INSERT OR UPDATE OF ata_item_id ON public.contrato_itens
FOR EACH ROW EXECUTE FUNCTION public.validar_item_contrato_ata();

-- 3) Validação: aditivo precisa de alvo coerente com o tipo do documento
CREATE OR REPLACE FUNCTION public.validar_aditivo_alvo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_doc TEXT;
BEGIN
  IF NEW.referencia_tipo IS NULL THEN
    NEW.referencia_tipo := 'contrato';
  END IF;

  IF NEW.referencia_tipo NOT IN ('contrato','ata_srp') THEN
    RAISE EXCEPTION 'referencia_tipo do aditivo deve ser contrato ou ata_srp.';
  END IF;

  SELECT tipo_documento INTO v_tipo_doc FROM public.contratos WHERE id = NEW.contrato_id;

  IF v_tipo_doc IS NULL THEN
    RAISE EXCEPTION 'Documento de referência não encontrado.';
  END IF;

  IF NEW.referencia_tipo = 'contrato' AND v_tipo_doc <> 'contrato' THEN
    RAISE EXCEPTION 'Aditivo marcado como de Contrato, mas o documento referenciado é uma ATA SRP.';
  END IF;
  IF NEW.referencia_tipo = 'ata_srp' AND v_tipo_doc <> 'ata_srp' THEN
    RAISE EXCEPTION 'Aditivo marcado como de ATA SRP, mas o documento referenciado é um Contrato.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_aditivo_alvo ON public.contrato_aditivos;
CREATE TRIGGER trg_validar_aditivo_alvo
BEFORE INSERT OR UPDATE OF referencia_tipo, contrato_id ON public.contrato_aditivos
FOR EACH ROW EXECUTE FUNCTION public.validar_aditivo_alvo();
