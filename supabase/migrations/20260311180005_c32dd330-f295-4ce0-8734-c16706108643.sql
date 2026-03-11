
ALTER TABLE public.configuracoes 
ADD COLUMN IF NOT EXISTS segmentos_prioridade text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS alerta_sistema boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS alerta_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS alerta_whatsapp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS uf_sede text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS municipio_sede text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS priorizar_regiao_sede boolean DEFAULT true;
