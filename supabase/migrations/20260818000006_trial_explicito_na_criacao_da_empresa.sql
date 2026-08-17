-- =============================================================================
-- Período de teste explícito, com prazo, no lugar de acesso indefinido
--
-- Hoje ninguém assina porque nada pede: quem cria a própria empresa vira admin
-- dela, e o bypass de plano libera qualquer admin. Seis empresas, de maio a
-- julho de 2026, nenhuma com assinatura. Não houve burla — o sistema nunca
-- perguntou.
--
-- Aqui nasce o outro lado: toda empresa nova ganha uma assinatura `trial` com
-- data de fim. O acesso continua liberado no começo, mas passa a ter prazo
-- visível em vez de ser silencioso e eterno.
--
-- Por que TRIGGER e não código de tela: a policy de `assinaturas` só deixa
-- administrador do sistema escrever (e assim deve ser — é a tabela que decide
-- quem paga). A tela do cliente não pode inserir a própria assinatura. O
-- gatilho, SECURITY DEFINER, cobre todo caminho de criação de empresa, hoje e
-- amanhã.
--
-- Qual plano o teste oferece: o de maior `trial_dias` entre os ativos, com
-- desempate pelo maior preço. É o plano que alguém configurou explicitamente
-- para teste; sem nenhum configurado, nada é criado (melhor não inventar).
-- =============================================================================

-- ── 1. O plano de teste, resolvido em um lugar só ────────────────────────────
CREATE OR REPLACE FUNCTION public.plano_de_teste()
RETURNS TABLE (id uuid, trial_dias int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, COALESCE(p.trial_dias, 0)
    FROM public.planos p
   WHERE COALESCE(p.ativo, true) IS TRUE
     AND COALESCE(p.trial_dias, 0) > 0
   ORDER BY p.trial_dias DESC, p.preco_mensal DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.plano_de_teste() IS
  'Plano usado no período de teste: o de maior trial_dias entre os ativos. '
  'Sem plano com trial_dias > 0, não devolve linha e nenhum teste é criado.';

-- ── 2. Empresa nova nasce em teste ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_trial_da_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano uuid;
  v_dias  int;
BEGIN
  SELECT t.id, t.trial_dias INTO v_plano, v_dias FROM public.plano_de_teste() t;
  IF v_plano IS NULL THEN
    RETURN NEW;  -- nenhum plano configurado para teste: nada a fazer
  END IF;

  -- Empresa recriada ou importada não ganha teste novo por cima do existente.
  IF EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.empresa_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.assinaturas (empresa_id, plano_id, status, data_inicio, data_fim, observacoes)
  VALUES (NEW.id, v_plano, 'trial', now(), now() + (v_dias || ' days')::interval,
          'Período de teste criado automaticamente na abertura da empresa.');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_trial_da_empresa ON public.empresas;

CREATE TRIGGER trg_criar_trial_da_empresa
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_trial_da_empresa();

-- ── 3. As empresas que já existem ────────────────────────────────────────────
--
-- Decisão deliberada: o prazo conta a partir de HOJE, não da data de cadastro.
-- Contar retroativo deixaria as seis já vencidas e cortaria o acesso de todas
-- no mesmo instante — inclusive o do dono do produto. Quem já usa recebe o
-- mesmo prazo de quem chega agora, e a partir daí a régra vale para todos.
INSERT INTO public.assinaturas (empresa_id, plano_id, status, data_inicio, data_fim, observacoes)
SELECT e.id, t.id, 'trial', now(), now() + (t.trial_dias || ' days')::interval,
       'Período de teste concedido na regularização de ' || to_char(now(), 'DD/MM/YYYY') ||
       ' — empresa cadastrada em ' || to_char(e.created_at, 'DD/MM/YYYY') || ' sem assinatura.'
  FROM public.empresas e
 CROSS JOIN public.plano_de_teste() t
 WHERE NOT EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.empresa_id = e.id);

COMMENT ON COLUMN public.assinaturas.status IS
  'pendente | trial | ativa | cancelada | vencida. `trial` e `ativa` com data_fim '
  'no futuro (ou nula) liberam o plano — ver check-subscription.';
