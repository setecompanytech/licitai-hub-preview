
-- Table for contract file attachments
CREATE TABLE public.contrato_arquivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'contrato_original',
  descricao TEXT,
  tamanho_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contract files"
  ON public.contrato_arquivos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contract files"
  ON public.contrato_arquivos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contract files"
  ON public.contrato_arquivos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contract files"
  ON public.contrato_arquivos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contrato_arquivos_updated_at
  BEFORE UPDATE ON public.contrato_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add missing columns to existing contrato_aditivos
ALTER TABLE public.contrato_aditivos 
  ADD COLUMN IF NOT EXISTS valor_acrescimo NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_supressao NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nova_data_fim DATE,
  ADD COLUMN IF NOT EXISTS data_assinatura DATE,
  ADD COLUMN IF NOT EXISTS arquivo_id UUID REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create storage bucket for contract documents  
INSERT INTO storage.buckets (id, name, public) VALUES ('contratos-docs', 'contratos-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own contract docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contratos-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload contract docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contratos-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update contract docs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'contratos-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete contract docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contratos-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger to auto-update contrato when aditivo changes
CREATE OR REPLACE FUNCTION public.aplicar_aditivo_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_acrescimo NUMERIC;
  v_total_supressao NUMERIC;
  v_ultima_data_fim DATE;
  v_contrato_id UUID;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  SELECT 
    COALESCE(SUM(valor_acrescimo), 0) + COALESCE(SUM(CASE WHEN valor_aditivo > 0 THEN valor_aditivo ELSE 0 END), 0),
    COALESCE(SUM(valor_supressao), 0) + COALESCE(SUM(CASE WHEN valor_aditivo < 0 THEN ABS(valor_aditivo) ELSE 0 END), 0)
  INTO v_total_acrescimo, v_total_supressao
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id;

  SELECT nova_data_fim INTO v_ultima_data_fim
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id AND nova_data_fim IS NOT NULL
  ORDER BY nova_data_fim DESC LIMIT 1;

  UPDATE public.contratos
  SET updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_aditivo ON public.contrato_aditivos;
CREATE TRIGGER trg_aplicar_aditivo
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_aditivo_contrato();
