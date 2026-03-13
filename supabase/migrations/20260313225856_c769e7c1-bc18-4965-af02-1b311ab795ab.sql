
-- 1. Tabela de aceite expresso de termos de automação
CREATE TABLE public.robo_aceite_termos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nivel_automacao integer NOT NULL CHECK (nivel_automacao BETWEEN 1 AND 3),
  sessao_id uuid REFERENCES public.sessoes_lance_real(id) ON DELETE SET NULL,
  licitacao_id uuid REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  limite_financeiro numeric NOT NULL DEFAULT 0,
  aceite_politica_uso boolean NOT NULL DEFAULT false,
  aceite_responsabilidade boolean NOT NULL DEFAULT false,
  ip_aceite text,
  user_agent_aceite text,
  dupla_autenticacao_verificada boolean NOT NULL DEFAULT false,
  codigo_2fa_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz
);

ALTER TABLE public.robo_aceite_termos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own aceite termos"
  ON public.robo_aceite_termos FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Trilha imutável de auditoria (somente INSERT para usuários)
CREATE TABLE public.audit_log_lances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sessao_id uuid,
  licitacao_id uuid,
  nivel_automacao integer NOT NULL DEFAULT 1,
  evento text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_lance numeric,
  rodada integer,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log_lances ENABLE ROW LEVEL SECURITY;

-- Usuários só podem INSERIR e LER (nunca atualizar ou deletar = imutável)
CREATE POLICY "Users can insert own audit logs"
  ON public.audit_log_lances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own audit logs"
  ON public.audit_log_lances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Adicionar nivel_automacao e kill_switch à sessoes_lance_real
ALTER TABLE public.sessoes_lance_real 
  ADD COLUMN IF NOT EXISTS nivel_automacao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS limite_financeiro numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aceite_id uuid REFERENCES public.robo_aceite_termos(id),
  ADD COLUMN IF NOT EXISTS parada_emergencial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parada_emergencial_em timestamptz,
  ADD COLUMN IF NOT EXISTS parada_emergencial_por text;

-- 4. Habilitar realtime para audit_log_lances (replay)
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log_lances;
