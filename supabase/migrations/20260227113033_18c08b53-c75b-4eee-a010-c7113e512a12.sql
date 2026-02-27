-- Add texto_integral column for full gazette text
ALTER TABLE public.monitoramento_editais 
ADD COLUMN texto_integral TEXT NULL;