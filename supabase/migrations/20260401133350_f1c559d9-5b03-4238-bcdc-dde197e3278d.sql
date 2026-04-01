
-- Tabela de perfis de alerta (múltiplos por usuário/empresa)
CREATE TABLE public.perfis_alerta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Perfil Principal',
  ativo BOOLEAN NOT NULL DEFAULT true,
  cor TEXT DEFAULT '#3b82f6',
  icone TEXT DEFAULT 'Search',
  -- Filtros de conteúdo
  cnaes TEXT[] DEFAULT '{}',
  palavras_chave TEXT[] DEFAULT '{}',
  palavras_negativas TEXT[] DEFAULT '{}',
  segmentos TEXT[] DEFAULT '{}',
  -- Filtros geográficos
  ufs TEXT[] DEFAULT '{}',
  municipios TEXT[] DEFAULT '{}',
  regiao TEXT DEFAULT NULL,
  priorizar_regiao_sede BOOLEAN DEFAULT false,
  -- Filtros de órgão
  orgaos_favoritos TEXT[] DEFAULT '{}',
  orgaos_bloqueados TEXT[] DEFAULT '{}',
  -- Filtros de modalidade e tipo
  modalidades TEXT[] DEFAULT '{}',
  tipos_publicacao TEXT[] DEFAULT '{}',
  -- Filtros de valor
  valor_minimo NUMERIC DEFAULT NULL,
  valor_maximo NUMERIC DEFAULT NULL,
  exclusividade_meepp BOOLEAN DEFAULT false,
  -- Pesos de relevância (0-100)
  peso_cnae INT NOT NULL DEFAULT 30,
  peso_palavra_chave INT NOT NULL DEFAULT 25,
  peso_regiao INT NOT NULL DEFAULT 20,
  peso_modalidade INT NOT NULL DEFAULT 10,
  peso_valor INT NOT NULL DEFAULT 10,
  peso_urgencia INT NOT NULL DEFAULT 5,
  -- Preferências de envio
  canal_email BOOLEAN DEFAULT true,
  canal_whatsapp BOOLEAN DEFAULT false,
  canal_sistema BOOLEAN DEFAULT true,
  frequencia TEXT DEFAULT 'imediato',
  horarios_disparo TEXT[] DEFAULT '{08:00,12:00,18:00}',
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_perfis_alerta_user ON public.perfis_alerta(user_id);
CREATE INDEX idx_perfis_alerta_empresa ON public.perfis_alerta(empresa_id);
CREATE INDEX idx_perfis_alerta_ativo ON public.perfis_alerta(ativo) WHERE ativo = true;

-- Trigger updated_at
CREATE TRIGGER update_perfis_alerta_updated_at
  BEFORE UPDATE ON public.perfis_alerta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.perfis_alerta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alert profiles"
  ON public.perfis_alerta FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tabela de resultados de matching (score calculado)
CREATE TABLE public.licitacao_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_alerta_id UUID REFERENCES public.perfis_alerta(id) ON DELETE CASCADE NOT NULL,
  licitacao_cache_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score_total NUMERIC NOT NULL DEFAULT 0,
  score_cnae NUMERIC DEFAULT 0,
  score_palavra_chave NUMERIC DEFAULT 0,
  score_regiao NUMERIC DEFAULT 0,
  score_modalidade NUMERIC DEFAULT 0,
  score_valor NUMERIC DEFAULT 0,
  score_urgencia NUMERIC DEFAULT 0,
  classificacao TEXT NOT NULL DEFAULT 'normal',
  notificado BOOLEAN DEFAULT false,
  descartado BOOLEAN DEFAULT false,
  salvo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(perfil_alerta_id, licitacao_cache_id)
);

CREATE INDEX idx_licitacao_scores_perfil ON public.licitacao_scores(perfil_alerta_id);
CREATE INDEX idx_licitacao_scores_user ON public.licitacao_scores(user_id);
CREATE INDEX idx_licitacao_scores_classificacao ON public.licitacao_scores(classificacao);
CREATE INDEX idx_licitacao_scores_total ON public.licitacao_scores(score_total DESC);

ALTER TABLE public.licitacao_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scores"
  ON public.licitacao_scores FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
