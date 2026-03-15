ALTER TABLE public.agente_externo_config 
  ADD COLUMN IF NOT EXISTS max_sessoes_paralelas integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS sessoes_ativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ram_mb integer DEFAULT NULL;