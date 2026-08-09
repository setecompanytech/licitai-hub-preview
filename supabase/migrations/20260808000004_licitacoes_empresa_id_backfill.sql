-- =============================================================================
-- MIGRATION: licitacoes.empresa_id — backfill
-- Data: 2026-08-08
-- Objetivo: preencher o vinculo com a empresa nas licitacoes existentes.
--
-- Diagnostico que motivou (08/08/2026): das 33 licitacoes do banco, ZERO tinham
-- empresa_id. O `iniciarProcesso` nunca gravou esse campo desde que existe, e a
-- coluna e anulavel, entao nada reclamou.
--
-- Consequencia concreta: vw_comercial_realizado_mensal filtra
-- `l.empresa_id IS NOT NULL` para contar participacoes, entao "processos
-- participados" ficava sempre 0 no painel de metas. A taxa de conversao nunca
-- saia do padrao conservador e as sugestoes do motor vinham infladas.
-- Ganhos e faturamento nao eram afetados: vem de contratos e contrato_pedidos,
-- que tem empresa_id proprio.
--
-- O conserto do lado do codigo (iniciarProcesso passando a gravar empresa_id)
-- vai no mesmo commit — so o backfill resolveria o passado e o problema
-- voltaria no proximo processo criado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Resolucao da empresa, por ordem de confianca
--
--    a) empresa ativa do perfil, MAS so se o usuario for mesmo membro dela —
--       sem essa checagem, um perfil com empresa_ativa_id defasada levaria a
--       licitacao para uma empresa da qual a pessoa ja saiu;
--    b) a unica empresa do usuario, quando ele so pertence a uma.
--
--    Usuario ambiguo (varias empresas, sem empresa ativa valida) fica de fora:
--    chutar aqui contaminaria o realizado de uma empresa com processo de outra.
-- -----------------------------------------------------------------------------
WITH empresa_unica AS (
  SELECT user_id,
         (min(empresa_id::text))::uuid AS empresa_id
    FROM public.empresa_membros
   GROUP BY user_id
  HAVING count(DISTINCT empresa_id) = 1
),
resolucao AS (
  SELECT l.id,
         COALESCE(
           CASE
             WHEN EXISTS (
               SELECT 1 FROM public.empresa_membros m
                WHERE m.user_id = l.user_id
                  AND m.empresa_id = p.empresa_ativa_id
             ) THEN p.empresa_ativa_id
           END,
           eu.empresa_id
         ) AS empresa_id
    FROM public.licitacoes l
    LEFT JOIN public.profiles      p  ON p.user_id  = l.user_id
    LEFT JOIN empresa_unica        eu ON eu.user_id = l.user_id
   WHERE l.empresa_id IS NULL
)
UPDATE public.licitacoes l
   SET empresa_id = r.empresa_id
  FROM resolucao r
 WHERE l.id = r.id
   AND r.empresa_id IS NOT NULL;

-- Nota sobre os triggers desta tabela, para quem revisar:
--   - comercial_exigir_motivo_perda so levanta excecao quando o status ENTRA em
--     'Perdida'; aqui o status nao muda, entao o backfill nao e barrado;
--   - comercial_marcar_proposta_enviada so preenche data_proposta_enviada
--     quando ela e nula, e a Fase B ja preencheu todas as elegiveis.

-- -----------------------------------------------------------------------------
-- 2. Perdas que o backfill da Fase B pulou
--    Aquele INSERT exigia empresa_id (a coluna e NOT NULL em comercial_perdas),
--    entao as licitacoes orfas ficaram sem registro de motivo. Agora que tem
--    empresa, entram com o mesmo motivo legado e inativo.
-- -----------------------------------------------------------------------------
INSERT INTO public.comercial_perdas (
  empresa_id, licitacao_id, user_id, motivo_id, observacao,
  valor_estimado, modalidade_codigo, data_perda
)
SELECT l.empresa_id,
       l.id,
       l.user_id,
       m.id,
       'Registro criado no backfill de empresa_id. A perda é anterior à regra de motivo obrigatório.',
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
-- 3. Indice para o filtro da view de realizado
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_licitacoes_empresa_user
  ON public.licitacoes (empresa_id, user_id)
  WHERE empresa_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Conferencia — rode DEPOIS e leia o resultado
--    `sem_empresa` maior que zero significa usuario ambiguo, que precisa de
--    decisao humana; nao e erro do script.
-- -----------------------------------------------------------------------------
-- select count(*)                                    as total,
--        count(empresa_id)                           as com_empresa,
--        count(*) - count(empresa_id)                as sem_empresa,
--        (select count(*) from comercial_perdas)     as perdas_registradas
--   from licitacoes;
