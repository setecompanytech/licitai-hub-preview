-- =============================================================================
-- MIGRATION: Metas do Comercial — Fase B (ingestao e vinculo com os modulos)
-- Data: 2026-08-03
-- Objetivo: derivar o realizado dos modulos existentes (licitacoes, contratos,
--           contrato_pedidos) e tornar obrigatorio o motivo de perda.
--
-- Decisoes de negocio aplicadas aqui:
--   (3) contratos sem vendedor_user_id recebem o contratos.user_id, marcados
--       como atribuicao automatica para auditoria futura;
--   (4) motivo de perda so e exigido daqui pra frente — o historico recebe o
--       motivo "Nao informado (anterior a regra)", inativo para novos registros;
--   (5) "participado" = proposta enviada, medida por licitacoes.data_proposta_enviada.
--
-- Nenhuma tabela nova: o realizado e sempre derivado, nunca copiado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Vendedor do contrato (decisao 3)
-- -----------------------------------------------------------------------------
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS vendedor_atribuido_automaticamente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contratos.vendedor_atribuido_automaticamente IS
  'true = vendedor_user_id foi preenchido pela implantacao do modulo de metas '
  'com o contratos.user_id, e nao informado por uma pessoa. Serve de trilha '
  'para revisao posterior da carteira.';

UPDATE public.contratos
   SET vendedor_user_id = user_id,
       vendedor_atribuido_automaticamente = true
 WHERE vendedor_user_id IS NULL
   AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_vendedor
  ON public.contratos (vendedor_user_id, data_assinatura)
  WHERE vendedor_user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Marco de "participacao" = proposta enviada (decisao 5)
--    O status guarda so o estado atual; sem uma data propria nao daria para
--    atribuir a participacao ao mes correto.
-- -----------------------------------------------------------------------------
ALTER TABLE public.licitacoes
  ADD COLUMN IF NOT EXISTS data_proposta_enviada timestamptz;

COMMENT ON COLUMN public.licitacoes.data_proposta_enviada IS
  'Momento em que o processo alcancou "Proposta Enviada" pela primeira vez. '
  'E o evento que conta como participacao no modulo de metas.';

CREATE OR REPLACE FUNCTION public.comercial_marcar_proposta_enviada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Uma vez marcada, nunca mais muda: voltar o card no Kanban nao apaga o
  -- fato de a proposta ter sido enviada.
  IF NEW.data_proposta_enviada IS NULL
     AND NEW.status IN ('Proposta Enviada', 'Em Disputa', 'Vencida', 'Homologada', 'Perdida')
  THEN
    NEW.data_proposta_enviada := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licitacoes_marcar_proposta_enviada ON public.licitacoes;
CREATE TRIGGER licitacoes_marcar_proposta_enviada
  BEFORE INSERT OR UPDATE ON public.licitacoes
  FOR EACH ROW EXECUTE FUNCTION public.comercial_marcar_proposta_enviada();

-- Backfill: usa a mensagem de sistema da mudanca de status quando existir
-- (e o registro mais proximo do evento real); senao cai no updated_at.
UPDATE public.licitacoes l
   SET data_proposta_enviada = COALESCE(
         (SELECT MIN(m.created_at)
            FROM public.licitacao_mensagens m
           WHERE m.licitacao_id = l.id
             AND m.tipo = 'sistema'
             AND m.conteudo ILIKE '%Proposta Enviada%'),
         l.updated_at)
 WHERE l.data_proposta_enviada IS NULL
   AND l.status IN ('Proposta Enviada', 'Em Disputa', 'Vencida', 'Homologada', 'Perdida');

CREATE INDEX IF NOT EXISTS idx_licitacoes_proposta_enviada
  ON public.licitacoes (empresa_id, user_id, data_proposta_enviada)
  WHERE data_proposta_enviada IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Normalizacao de modalidade em SQL
--    ESPELHO de src/lib/metas/modalidades.ts — as duas versoes precisam mudar
--    juntas. Aqui e a autoridade para agregacao; la, para a interface.
-- -----------------------------------------------------------------------------
-- Remove acentos sem depender da extensao `unaccent`, que pode nao estar
-- instalada no projeto. Cobre o que aparece em nome de modalidade.
CREATE OR REPLACE FUNCTION public.comercial_sem_acento(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

CREATE OR REPLACE FUNCTION public.comercial_normalizar_modalidade(p_texto text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
BEGIN
  t := lower(regexp_replace(public.comercial_sem_acento(coalesce(p_texto, '')), '[^a-zA-Z0-9]+', ' ', 'g'));
  t := trim(t);
  IF t = '' THEN RETURN 'outra'; END IF;

  IF t LIKE '%pregao%' AND (t LIKE '%presencial%' OR t LIKE '%nao eletronico%') THEN
    RETURN 'pregao_presencial';
  END IF;
  IF t LIKE '%pregao%'        THEN RETURN 'pregao_eletronico'; END IF;
  IF t LIKE '%dispensa%'      THEN RETURN 'dispensa'; END IF;
  IF t LIKE '%inexigib%'      THEN RETURN 'inexigibilidade'; END IF;
  IF t LIKE '%credenciamento%' THEN RETURN 'credenciamento'; END IF;
  IF t LIKE '%tomada%'        THEN RETURN 'tomada_precos'; END IF;
  IF t LIKE '%convite%'       THEN RETURN 'convite'; END IF;
  IF t LIKE '%concorrencia%'  THEN RETURN 'concorrencia'; END IF;
  IF t LIKE '%concurso%'      THEN RETURN 'concurso'; END IF;
  IF t LIKE '%leilao%'        THEN RETURN 'leilao'; END IF;

  RETURN 'outra';
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Perdas historicas (decisao 4)
--    Motivo inativo: aparece no relatorio, mas nao na lista de escolha.
-- -----------------------------------------------------------------------------
INSERT INTO public.comercial_motivos_perda (empresa_id, codigo, label, ordem, ativo)
SELECT e.id, 'nao_informado_legado', 'Não informado (anterior à regra)', 100, false
  FROM public.empresas e
ON CONFLICT (empresa_id, codigo) DO NOTHING;

INSERT INTO public.comercial_perdas (
  empresa_id, licitacao_id, user_id, motivo_id, observacao,
  valor_estimado, modalidade_codigo, data_perda
)
SELECT l.empresa_id,
       l.id,
       l.user_id,
       m.id,
       'Registro criado na implantação do módulo de metas. A perda é anterior à regra de motivo obrigatório.',
       l.valor_estimado,
       public.comercial_normalizar_modalidade(l.modalidade),
       COALESCE(l.data_encerramento::date, l.updated_at::date)
  FROM public.licitacoes l
  JOIN public.comercial_motivos_perda m
    ON m.empresa_id = l.empresa_id
   AND m.codigo = 'nao_informado_legado'
 WHERE l.empresa_id IS NOT NULL
   AND (l.status = 'Perdida' OR l.resultado = 'Perdedor')
ON CONFLICT (licitacao_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Motivo obrigatorio daqui pra frente
--    Só em UPDATE: um INSERT ja nascendo "Perdida" nao teria como ter o
--    registro de perda antes, e nenhum fluxo do app faz isso hoje.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comercial_exigir_motivo_perda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Perdida' AND OLD.status IS DISTINCT FROM 'Perdida' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comercial_perdas p WHERE p.licitacao_id = NEW.id
    ) THEN
      RAISE EXCEPTION
        'Registre o motivo da perda antes de marcar o processo como Perdida.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licitacoes_exigir_motivo_perda ON public.licitacoes;
CREATE TRIGGER licitacoes_exigir_motivo_perda
  BEFORE UPDATE ON public.licitacoes
  FOR EACH ROW EXECUTE FUNCTION public.comercial_exigir_motivo_perda();

-- -----------------------------------------------------------------------------
-- 6. Realizado mensal por colaborador
--    security_invoker=on: sem isso a view rodaria com o dono e furaria a RLS
--    das tabelas de origem.
--    Fuso America/Sao_Paulo em todo timestamptz, para o mes fechar certo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_comercial_realizado_mensal
WITH (security_invoker = on) AS
WITH participacoes AS (
  SELECT l.empresa_id,
         l.user_id,
         EXTRACT(YEAR  FROM l.data_proposta_enviada AT TIME ZONE 'America/Sao_Paulo')::int AS ano,
         EXTRACT(MONTH FROM l.data_proposta_enviada AT TIME ZONE 'America/Sao_Paulo')::int AS mes,
         COUNT(*)::int AS participados
    FROM public.licitacoes l
   WHERE l.empresa_id IS NOT NULL
     AND l.data_proposta_enviada IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
ganhos AS (
  SELECT c.empresa_id,
         c.vendedor_user_id AS user_id,
         EXTRACT(YEAR  FROM c.data_assinatura)::int AS ano,
         EXTRACT(MONTH FROM c.data_assinatura)::int AS mes,
         COUNT(*)::int AS ganhos,
         SUM(c.valor_global)::numeric(14,2) AS valor_ganho
    FROM public.contratos c
   WHERE c.empresa_id IS NOT NULL
     AND c.vendedor_user_id IS NOT NULL
     AND c.data_assinatura IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
perdas AS (
  SELECT p.empresa_id,
         p.user_id,
         EXTRACT(YEAR  FROM p.data_perda)::int AS ano,
         EXTRACT(MONTH FROM p.data_perda)::int AS mes,
         COUNT(*)::int AS perdidos,
         COALESCE(SUM(p.valor_estimado), 0)::numeric(14,2) AS valor_perdido
    FROM public.comercial_perdas p
   GROUP BY 1, 2, 3, 4
),
faturamento AS (
  SELECT c.empresa_id,
         c.vendedor_user_id AS user_id,
         EXTRACT(YEAR  FROM cp.data_pedido)::int AS ano,
         EXTRACT(MONTH FROM cp.data_pedido)::int AS mes,
         COUNT(*)::int AS pedidos_faturados,
         SUM(cp.valor_total)::numeric(14,2) AS valor_faturado
    FROM public.contrato_pedidos cp
    JOIN public.contratos c ON c.id = cp.contrato_id
   WHERE c.empresa_id IS NOT NULL
     AND c.vendedor_user_id IS NOT NULL
     AND cp.data_pedido IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
quitacoes AS (
  SELECT c.empresa_id,
         c.vendedor_user_id AS user_id,
         EXTRACT(YEAR  FROM cp.data_quitacao)::int AS ano,
         EXTRACT(MONTH FROM cp.data_quitacao)::int AS mes,
         COUNT(*)::int AS nfe_quitadas,
         SUM(cp.valor_total)::numeric(14,2) AS valor_quitado
    FROM public.contrato_pedidos cp
    JOIN public.contratos c ON c.id = cp.contrato_id
   WHERE c.empresa_id IS NOT NULL
     AND c.vendedor_user_id IS NOT NULL
     AND cp.nf_quitada IS TRUE
     AND cp.data_quitacao IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
chaves AS (
  SELECT empresa_id, user_id, ano, mes FROM participacoes
  UNION SELECT empresa_id, user_id, ano, mes FROM ganhos
  UNION SELECT empresa_id, user_id, ano, mes FROM perdas
  UNION SELECT empresa_id, user_id, ano, mes FROM faturamento
  UNION SELECT empresa_id, user_id, ano, mes FROM quitacoes
)
SELECT k.empresa_id,
       k.user_id,
       k.ano,
       k.mes,
       COALESCE(pa.participados, 0)      AS participados,
       COALESCE(g.ganhos, 0)             AS ganhos,
       COALESCE(pe.perdidos, 0)          AS perdidos,
       COALESCE(g.valor_ganho, 0)        AS valor_ganho,
       COALESCE(pe.valor_perdido, 0)     AS valor_perdido,
       COALESCE(f.pedidos_faturados, 0)  AS pedidos_faturados,
       COALESCE(f.valor_faturado, 0)     AS valor_faturado,
       COALESCE(q.nfe_quitadas, 0)       AS nfe_quitadas,
       COALESCE(q.valor_quitado, 0)      AS valor_quitado
  FROM chaves k
  LEFT JOIN participacoes pa ON (pa.empresa_id, pa.user_id, pa.ano, pa.mes) = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN ganhos       g  ON (g.empresa_id,  g.user_id,  g.ano,  g.mes)  = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN perdas       pe ON (pe.empresa_id, pe.user_id, pe.ano, pe.mes) = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN faturamento  f  ON (f.empresa_id,  f.user_id,  f.ano,  f.mes)  = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN quitacoes    q  ON (q.empresa_id,  q.user_id,  q.ano,  q.mes)  = (k.empresa_id, k.user_id, k.ano, k.mes);

COMMENT ON VIEW public.vw_comercial_realizado_mensal IS
  'Realizado mensal por colaborador, derivado de licitacoes (participados), '
  'contratos (ganhos), comercial_perdas (perdidos) e contrato_pedidos '
  '(faturado e NF quitada). Mes calculado em America/Sao_Paulo.';
