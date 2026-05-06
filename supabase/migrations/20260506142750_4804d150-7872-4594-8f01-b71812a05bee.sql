-- 1. Adicionar 'outros' ao enum
ALTER TYPE public.juridico_pedido_tipo ADD VALUE IF NOT EXISTS 'outros';

-- 2. Novos campos para identificar o modelo
ALTER TABLE public.juridico_pedidos
  ADD COLUMN IF NOT EXISTS modelo_id TEXT,
  ADD COLUMN IF NOT EXISTS modelo_titulo TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS prefixo_numero TEXT;

CREATE INDEX IF NOT EXISTS idx_juridico_pedidos_modelo ON public.juridico_pedidos(empresa_id, modelo_id);
CREATE INDEX IF NOT EXISTS idx_juridico_pedidos_categoria ON public.juridico_pedidos(empresa_id, categoria);

-- 3. Atualizar trigger de numeração para suportar prefixo dinâmico
CREATE OR REPLACE FUNCTION public.juridico_pedidos_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seq INTEGER;
  v_prefixo TEXT;
  v_sufixo TEXT := '';
BEGIN
  IF NEW.sequencial IS NULL OR NEW.sequencial = 0 THEN
    SELECT COALESCE(MAX(sequencial), 0) + 1
      INTO v_seq
      FROM public.juridico_pedidos
     WHERE empresa_id = NEW.empresa_id
       AND tipo = NEW.tipo
       AND ano = NEW.ano;
    NEW.sequencial := v_seq;
  END IF;

  -- Prioridade: prefixo_numero customizado > tipo padrão
  IF COALESCE(NEW.prefixo_numero, '') <> '' THEN
    v_prefixo := upper(regexp_replace(NEW.prefixo_numero, '[^A-Za-z0-9]', '', 'g'));
  ELSE
    v_prefixo := CASE NEW.tipo
      WHEN 'reajuste'    THEN 'REQ'
      WHEN 'repactuacao' THEN 'REP'
      WHEN 'revisao'     THEN 'REV'
      WHEN 'outros'      THEN 'DOC'
      ELSE 'DOC'
    END;
  END IF;

  -- Sufixo: contrato, ata ou aditivo (o que estiver presente)
  IF COALESCE(NEW.contrato_numero, '') <> '' THEN
    v_sufixo := '-CT' || regexp_replace(NEW.contrato_numero, '[^0-9A-Za-z]', '', 'g');
  ELSIF COALESCE(NEW.ata_numero, '') <> '' THEN
    v_sufixo := '-AT' || regexp_replace(NEW.ata_numero, '[^0-9A-Za-z]', '', 'g');
  ELSIF COALESCE(NEW.aditivo_numero, '') <> '' THEN
    v_sufixo := '-AD' || regexp_replace(NEW.aditivo_numero, '[^0-9A-Za-z]', '', 'g');
  ELSIF COALESCE(NEW.pregao_numero, '') <> '' THEN
    v_sufixo := '-PG' || regexp_replace(NEW.pregao_numero, '[^0-9A-Za-z]', '', 'g');
  END IF;

  NEW.numero_formatado := 'PRAEFECTUS/' || v_prefixo || '/' || NEW.ano::text
    || '/' || lpad(NEW.sequencial::text, 4, '0') || v_sufixo;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;