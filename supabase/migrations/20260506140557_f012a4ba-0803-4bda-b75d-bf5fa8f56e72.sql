-- Enum tipo de pedido (1 instituto por pedido)
DO $$ BEGIN
  CREATE TYPE public.juridico_pedido_tipo AS ENUM ('reajuste', 'repactuacao', 'revisao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum status (7 status conforme escolha do usuário, + variantes finais)
DO $$ BEGIN
  CREATE TYPE public.juridico_pedido_status AS ENUM (
    'rascunho',
    'em_revisao',
    'gerado',
    'assinado',
    'protocolado',
    'em_analise',
    'deferido',
    'indeferido',
    'parcialmente_deferido'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal: pedidos
CREATE TABLE IF NOT EXISTS public.juridico_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  tipo public.juridico_pedido_tipo NOT NULL,
  status public.juridico_pedido_status NOT NULL DEFAULT 'rascunho',

  -- Numeração híbrida (gerada por trigger):
  -- PRAEFECTUS/REQ/2026/0001-CT015 (sufixo opcional)
  ano INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  sequencial INTEGER NOT NULL DEFAULT 0,
  numero_formatado TEXT,

  -- Identificação do caso
  instrumento TEXT, -- edital | ata_srp | contrato | aditivo
  processo_administrativo TEXT,
  pregao_numero TEXT,
  ata_numero TEXT,
  contrato_numero TEXT,
  aditivo_numero TEXT,
  orgao_contratante TEXT,
  licitacao_id UUID,

  -- Dados de geração (JSONB para flexibilidade)
  dados_caso JSONB DEFAULT '{}'::jsonb, -- itens comparativos, índices, CCTs, fato gerador, etc.

  -- Pós-protocolo
  data_protocolo DATE,
  numero_protocolo TEXT,
  retorno_orgao TEXT,

  -- Versão atual exibida (FK para versões)
  versao_atual_id UUID,
  versoes_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_pedidos_empresa ON public.juridico_pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_juridico_pedidos_status ON public.juridico_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_juridico_pedidos_tipo ON public.juridico_pedidos(tipo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_juridico_pedidos_numero ON public.juridico_pedidos(empresa_id, tipo, ano, sequencial);

-- Versões (histórico imutável de documentos gerados)
CREATE TABLE IF NOT EXISTS public.juridico_pedidos_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.juridico_pedidos(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  conteudo TEXT NOT NULL,
  resumo_alteracao TEXT,
  modelo_ia TEXT,
  gerado_por UUID NOT NULL,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pedido_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_jpv_pedido ON public.juridico_pedidos_versoes(pedido_id);

-- Histórico/timeline de eventos
CREATE TABLE IF NOT EXISTS public.juridico_pedidos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.juridico_pedidos(id) ON DELETE CASCADE,
  evento TEXT NOT NULL, -- 'criado', 'versao_gerada', 'status_alterado', 'protocolado', etc.
  descricao TEXT,
  status_anterior public.juridico_pedido_status,
  status_novo public.juridico_pedido_status,
  autor UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jph_pedido ON public.juridico_pedidos_historico(pedido_id);

-- Trigger: atribui sequencial e número formatado na inserção
CREATE OR REPLACE FUNCTION public.juridico_pedidos_set_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_prefixo := CASE NEW.tipo
    WHEN 'reajuste'   THEN 'REQ'
    WHEN 'repactuacao' THEN 'REP'
    WHEN 'revisao'    THEN 'REV'
  END;

  -- Sufixo: contrato, ata ou aditivo, o que estiver presente
  IF COALESCE(NEW.contrato_numero, '') <> '' THEN
    v_sufixo := '-CT' || regexp_replace(NEW.contrato_numero, '[^0-9A-Za-z]', '', 'g');
  ELSIF COALESCE(NEW.ata_numero, '') <> '' THEN
    v_sufixo := '-AT' || regexp_replace(NEW.ata_numero, '[^0-9A-Za-z]', '', 'g');
  ELSIF COALESCE(NEW.aditivo_numero, '') <> '' THEN
    v_sufixo := '-AD' || regexp_replace(NEW.aditivo_numero, '[^0-9A-Za-z]', '', 'g');
  END IF;

  NEW.numero_formatado := 'PRAEFECTUS/' || v_prefixo || '/' || NEW.ano::text
    || '/' || lpad(NEW.sequencial::text, 4, '0') || v_sufixo;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_juridico_pedidos_set_numero ON public.juridico_pedidos;
CREATE TRIGGER trg_juridico_pedidos_set_numero
  BEFORE INSERT ON public.juridico_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.juridico_pedidos_set_numero();

-- Trigger updated_at em UPDATE
CREATE OR REPLACE FUNCTION public.juridico_pedidos_touch_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_juridico_pedidos_touch ON public.juridico_pedidos;
CREATE TRIGGER trg_juridico_pedidos_touch
  BEFORE UPDATE ON public.juridico_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.juridico_pedidos_touch_updated();

-- RLS
ALTER TABLE public.juridico_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juridico_pedidos_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juridico_pedidos_historico ENABLE ROW LEVEL SECURITY;

-- Helper: usuário é membro da empresa?
CREATE OR REPLACE FUNCTION public.is_member_of_empresa(_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_membros
     WHERE empresa_id = _empresa_id
       AND user_id = auth.uid()
  );
$$;

-- Policies: pedidos
DROP POLICY IF EXISTS "Membros veem pedidos da empresa" ON public.juridico_pedidos;
CREATE POLICY "Membros veem pedidos da empresa"
  ON public.juridico_pedidos FOR SELECT TO authenticated
  USING (public.is_member_of_empresa(empresa_id));

DROP POLICY IF EXISTS "Membros criam pedidos" ON public.juridico_pedidos;
CREATE POLICY "Membros criam pedidos"
  ON public.juridico_pedidos FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of_empresa(empresa_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Membros atualizam pedidos" ON public.juridico_pedidos;
CREATE POLICY "Membros atualizam pedidos"
  ON public.juridico_pedidos FOR UPDATE TO authenticated
  USING (public.is_member_of_empresa(empresa_id));

DROP POLICY IF EXISTS "Membros deletam pedidos" ON public.juridico_pedidos;
CREATE POLICY "Membros deletam pedidos"
  ON public.juridico_pedidos FOR DELETE TO authenticated
  USING (public.is_member_of_empresa(empresa_id));

-- Policies: versões (lê/insere conforme acesso ao pedido pai)
DROP POLICY IF EXISTS "Versoes via pedido" ON public.juridico_pedidos_versoes;
CREATE POLICY "Versoes via pedido"
  ON public.juridico_pedidos_versoes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.juridico_pedidos p
                  WHERE p.id = pedido_id AND public.is_member_of_empresa(p.empresa_id)));

DROP POLICY IF EXISTS "Versoes insert via pedido" ON public.juridico_pedidos_versoes;
CREATE POLICY "Versoes insert via pedido"
  ON public.juridico_pedidos_versoes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.juridico_pedidos p
                       WHERE p.id = pedido_id AND public.is_member_of_empresa(p.empresa_id))
              AND gerado_por = auth.uid());

-- Policies: histórico
DROP POLICY IF EXISTS "Historico via pedido" ON public.juridico_pedidos_historico;
CREATE POLICY "Historico via pedido"
  ON public.juridico_pedidos_historico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.juridico_pedidos p
                  WHERE p.id = pedido_id AND public.is_member_of_empresa(p.empresa_id)));

DROP POLICY IF EXISTS "Historico insert via pedido" ON public.juridico_pedidos_historico;
CREATE POLICY "Historico insert via pedido"
  ON public.juridico_pedidos_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.juridico_pedidos p
                       WHERE p.id = pedido_id AND public.is_member_of_empresa(p.empresa_id)));