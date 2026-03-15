
-- Table for backup configuration per user
CREATE TABLE public.backup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  frequencia TEXT NOT NULL DEFAULT 'semanal',
  dia_semana INTEGER DEFAULT 1,
  dia_mes INTEGER DEFAULT 1,
  hora_execucao TEXT DEFAULT '03:00',
  enviar_email BOOLEAN NOT NULL DEFAULT true,
  email_destino TEXT,
  alerta_calendario BOOLEAN NOT NULL DEFAULT true,
  backup_storage BOOLEAN NOT NULL DEFAULT true,
  ultimo_backup TIMESTAMPTZ,
  proximo_backup TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.backup_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own backup config"
  ON public.backup_config FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for backup history
CREATE TABLE public.backup_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'automatico',
  status TEXT NOT NULL DEFAULT 'concluido',
  tamanho_bytes BIGINT,
  storage_path TEXT,
  tabelas_exportadas TEXT[],
  registros_total INTEGER,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own backup history"
  ON public.backup_historico FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_backup_config_updated_at
  BEFORE UPDATE ON public.backup_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
