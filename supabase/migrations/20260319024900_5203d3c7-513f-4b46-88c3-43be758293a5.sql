-- Re-apply everything that was blocked by the publication error

-- Tables (IF NOT EXISTS is safe)
CREATE TABLE IF NOT EXISTS public.portal_healthcheck (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id TEXT NOT NULL,
  portal_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'desconhecido',
  seletores_ok BOOLEAN DEFAULT true,
  seletores_falhos TEXT[] DEFAULT '{}',
  ultima_verificacao TIMESTAMPTZ,
  proximo_check TIMESTAMPTZ,
  detalhes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estrategia_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  orgao TEXT,
  objeto TEXT,
  categoria TEXT,
  historico_disputas INT DEFAULT 0,
  preco_medio_fechamento NUMERIC DEFAULT 0,
  desconto_medio NUMERIC DEFAULT 0,
  decremento_sugerido NUMERIC DEFAULT 0,
  valor_minimo_sugerido NUMERIC DEFAULT 0,
  confianca NUMERIC DEFAULT 0,
  analise_ia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.portal_healthcheck ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estrategia_ia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portal_healthcheck' AND policyname = 'Authenticated users can read healthcheck') THEN
    CREATE POLICY "Authenticated users can read healthcheck" ON public.portal_healthcheck FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'estrategia_ia' AND policyname = 'Users can manage own strategies') THEN
    CREATE POLICY "Users can manage own strategies" ON public.estrategia_ia FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Hash columns
ALTER TABLE public.audit_log_lances ADD COLUMN IF NOT EXISTS hash_anterior TEXT;
ALTER TABLE public.audit_log_lances ADD COLUMN IF NOT EXISTS hash_registro TEXT;

-- pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash function
CREATE OR REPLACE FUNCTION public.compute_audit_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prev_hash TEXT;
  v_payload TEXT;
BEGIN
  SELECT hash_registro INTO v_prev_hash
  FROM public.audit_log_lances
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  NEW.hash_anterior := COALESCE(v_prev_hash, 'GENESIS');
  v_payload := NEW.user_id || '|' || NEW.evento || '|' || COALESCE(NEW.valor_lance::TEXT, '0') || '|' || NEW.created_at::TEXT || '|' || NEW.hash_anterior;
  NEW.hash_registro := encode(digest(v_payload, 'sha256'), 'hex');
  
  RETURN NEW;
END;
$$;

-- Hash trigger
DROP TRIGGER IF EXISTS trg_audit_hash ON public.audit_log_lances;
CREATE TRIGGER trg_audit_hash
  BEFORE INSERT ON public.audit_log_lances
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_audit_hash();