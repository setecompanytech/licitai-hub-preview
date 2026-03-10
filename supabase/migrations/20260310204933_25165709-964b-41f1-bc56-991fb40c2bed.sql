
ALTER TABLE public.planos
ADD COLUMN IF NOT EXISTS preco_semestral numeric NULL,
ADD COLUMN IF NOT EXISTS preco_bienal numeric NULL;

-- Update existing plans with semestral and bienal pricing
UPDATE public.planos SET preco_semestral = preco_mensal * 6 * 0.95 WHERE preco_semestral IS NULL;
UPDATE public.planos SET preco_bienal = preco_mensal * 24 * 0.70 WHERE preco_bienal IS NULL;
