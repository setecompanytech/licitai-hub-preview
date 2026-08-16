-- =============================================================================
-- Disputas do Robô de Lances como ENTIDADE
--
-- As disputas viviam só na memória da tela (useState): recarregar a página
-- perdia a configuração inteira — estratégia, itens, valor mínimo. Numa véspera
-- de pregão isso é perda de trabalho crítico, e explicava o painel "Disputas
-- adicionadas" sempre vazio ao entrar pelo módulo.
--
-- A disputa é DA EMPRESA e pertence a um PROCESSO: abrir a pasta do processo
-- deve mostrar as disputas dele, sem reseleção (mesmo princípio já aplicado a
-- precificação, proposta e catálogo).
--
-- `itens` fica em jsonb: são os itens em disputa com o piso definido pelo
-- operador (valor mínimo), fotografados no momento da configuração. Não é
-- duplicação de licitacao_itens — é a estratégia daquela sessão, que não pode
-- mudar sozinha se o edital for reextraído no meio do pregão.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.robo_lances_disputas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  licitacao_id uuid,                       -- processo de origem (pasta)
  edital text NOT NULL,
  portal text,
  tipo_disputa text NOT NULL DEFAULT 'item'
    CHECK (tipo_disputa IN ('item', 'lote')),
  -- Estratégia
  valor_referencia numeric NOT NULL DEFAULT 0,
  valor_inicial numeric NOT NULL DEFAULT 0,
  valor_minimo numeric NOT NULL DEFAULT 0,  -- piso: trava financeira do operador
  decremento_min numeric NOT NULL DEFAULT 0,
  decremento_percentual numeric NOT NULL DEFAULT 0,
  intervalo_segundos integer NOT NULL DEFAULT 30,
  max_lances integer NOT NULL DEFAULT 20,
  modo_automatico boolean NOT NULL DEFAULT false,
  horario text,
  -- Andamento
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'ativo', 'vencendo', 'perdendo', 'encerrado')),
  meu_lance numeric NOT NULL DEFAULT 0,
  valor_atual numeric NOT NULL DEFAULT 0,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.robo_lances_disputas IS
  'Disputas configuradas no Robô de Lances. Pertencem à empresa e, quando '
  'nascem de uma pasta, ao processo (licitacao_id). itens = estratégia da '
  'sessão (com valor mínimo por item), não espelho de licitacao_itens.';

CREATE INDEX IF NOT EXISTS idx_robo_disputas_licitacao
  ON public.robo_lances_disputas (licitacao_id);

CREATE INDEX IF NOT EXISTS idx_robo_disputas_empresa
  ON public.robo_lances_disputas (empresa_id, status);

ALTER TABLE public.robo_lances_disputas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros da empresa veem as disputas" ON public.robo_lances_disputas;
CREATE POLICY "Membros da empresa veem as disputas"
ON public.robo_lances_disputas FOR SELECT TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa criam disputas" ON public.robo_lances_disputas;
CREATE POLICY "Membros da empresa criam disputas"
ON public.robo_lances_disputas FOR INSERT TO authenticated
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa atualizam disputas" ON public.robo_lances_disputas;
CREATE POLICY "Membros da empresa atualizam disputas"
ON public.robo_lances_disputas FOR UPDATE TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Admins da empresa apagam disputas" ON public.robo_lances_disputas;
CREATE POLICY "Admins da empresa apagam disputas"
ON public.robo_lances_disputas FOR DELETE TO authenticated
USING (public.is_empresa_admin(auth.uid(), empresa_id));

DROP TRIGGER IF EXISTS set_updated_at_robo_disputas ON public.robo_lances_disputas;
CREATE TRIGGER set_updated_at_robo_disputas
  BEFORE UPDATE ON public.robo_lances_disputas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
