-- ═══════════════════════════════════════════════════════════════════════════
-- SEMENTE DE DADOS DO PILOTO DE UI  (v2)  —  TEMPORÁRIA, PARA SCREENSHOTS
--
-- v2 corrige as duas fragilidades da primeira versão:
--   a) usa o user_id LITERAL da sessão real (23d641eb-…), verificado no JWT,
--      em vez de resolver por e-mail — elimina qualquer ambiguidade de lookup;
--   b) tem GUARDA DE BANCO: se esse usuário não existir aqui, aborta com erro
--      explícito. Rodar no projeto errado passa a falhar alto, em vez de
--      "dar certo" num banco que o app não usa.
--
-- O app aponta para o projeto uwtyuwktxalnpgrcbbgk (hardcoded em
-- src/integrations/supabase/client.ts:5). Rode ESTE script nesse projeto.
--
-- Tudo marcado [PILOTO] no objeto, valores redondos. Idempotente.
-- Limpeza: piloto-ui-limpeza.sql
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- Id autoritativo: o que o app usa ao logar (conferido no JWT da sessão)
  v_user   uuid := '23d641eb-edd0-4347-b382-e972ad717a91';
  v_emp    uuid;
  v_lic    uuid;
  v_motivo uuid;
  v_contr  uuid;
  v_n      int;
  v_hoje   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ini    date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
  -- ── GUARDA DE BANCO ─────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user) THEN
    RAISE EXCEPTION
      'BANCO ERRADO: o usuario do piloto (%) nao existe aqui. Este script e '
      'para o projeto uwtyuwktxalnpgrcbbgk (o que o app usa). Banco atual: %',
      v_user, current_database();
  END IF;

  SELECT empresa_id INTO v_emp FROM public.empresa_membros
   WHERE user_id = v_user LIMIT 1;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'piloto sem vinculo em empresa_membros neste banco — rode o SQL de vinculo antes';
  END IF;
  RAISE NOTICE 'banco ok: usuario % vinculado a empresa %', v_user, v_emp;

  -- ── 6 licitações, uma por coluna do Kanban ──────────────────────────────
  -- O trigger de motivo de perda só vale em UPDATE, então nascer "Perdida"
  -- é permitido; ainda assim registramos a perda abaixo, para o painel de
  -- metas ficar coerente.
  INSERT INTO public.licitacoes
    (user_id, empresa_id, numero, orgao, objeto, status, modalidade,
     valor_estimado, uf, municipio, data_encerramento)
  SELECT v_user, v_emp, d.numero, d.orgao, d.objeto, d.status, d.modalidade,
         d.valor, 'RS', 'Santa Rosa', d.encerra
    FROM (VALUES
      ('PIL-001/2026', 'Prefeitura Municipal de Santa Rosa',
       '[PILOTO] Aquisição de material de escritório para as secretarias',
       'Monitorando', 'Pregão Eletrônico', 100000.00, v_hoje + 20),
      ('PIL-002/2026', 'Secretaria Estadual de Saúde',
       '[PILOTO] Contratação de serviços de manutenção predial',
       'Em Análise', 'Pregão Eletrônico', 250000.00, v_hoje + 12),
      ('PIL-003/2026', 'Universidade Federal da Fronteira Sul',
       '[PILOTO] Fornecimento de equipamentos de informática',
       'Proposta Enviada', 'Concorrência', 500000.00, v_hoje + 8),
      ('PIL-004/2026', 'Corpo de Bombeiros Militar',
       '[PILOTO] Registro de preços para material hospitalar',
       'Em Disputa', 'Pregão Eletrônico', 300000.00, v_hoje + 2),
      ('PIL-005/2026', 'Prefeitura Municipal de Porto Alegre',
       '[PILOTO] Prestação de serviços de limpeza e conservação',
       'Vencida', 'Pregão Eletrônico', 400000.00, v_hoje - 5),
      ('PIL-006/2026', 'Tribunal de Justiça do Estado',
       '[PILOTO] Aquisição de mobiliário corporativo',
       'Perdida', 'Dispensa de Licitação', 150000.00, v_hoje - 10)
    ) AS d(numero, orgao, objeto, status, modalidade, valor, encerra)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.licitacoes l WHERE l.user_id = v_user AND l.numero = d.numero
   );
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'licitacoes inseridas: %', v_n;

  -- ── Registro de perda da PIL-006 (coerência com o módulo de metas) ──────
  SELECT id INTO v_lic FROM public.licitacoes
   WHERE user_id = v_user AND numero = 'PIL-006/2026';
  SELECT id INTO v_motivo FROM public.comercial_motivos_perda
   WHERE empresa_id = v_emp AND ativo = true ORDER BY ordem LIMIT 1;

  IF v_motivo IS NULL THEN
    RAISE NOTICE 'ATENCAO: nenhum motivo de perda ativo — rode "Restaurar padroes" na Parametrizacao';
  ELSIF v_lic IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.comercial_perdas WHERE licitacao_id = v_lic) THEN
    INSERT INTO public.comercial_perdas
      (empresa_id, licitacao_id, user_id, motivo_id, observacao,
       valor_estimado, modalidade_codigo, data_perda, registrado_por)
    VALUES (v_emp, v_lic, v_user, v_motivo, '[PILOTO] registro de teste',
            150000.00, 'dispensa', v_hoje - 10, v_user);
    RAISE NOTICE 'perda registrada';
  END IF;

  -- ── Contrato ganho + pedido faturado (alimentam o realizado das metas) ──
  IF NOT EXISTS (SELECT 1 FROM public.contratos
                  WHERE vendedor_user_id = v_user AND numero_contrato = 'PIL-CT-001/2026') THEN
    INSERT INTO public.contratos
      (user_id, vendedor_user_id, empresa_id, numero_contrato, objeto,
       orgao_contratante, modalidade, valor_global, valor_global_original,
       data_assinatura, uf, municipio, status)
    VALUES (v_user, v_user, v_emp, 'PIL-CT-001/2026',
            '[PILOTO] Prestação de serviços de limpeza e conservação',
            'Prefeitura Municipal de Porto Alegre', 'Pregão Eletrônico',
            400000.00, 400000.00, v_ini + 3, 'RS', 'Porto Alegre', 'ativo')
    RETURNING id INTO v_contr;

    INSERT INTO public.contrato_pedidos
      (contrato_id, user_id, numero_pedido, descricao, quantidade,
       valor_unitario, valor_total, data_pedido, status)
    VALUES (v_contr, v_user, 'PIL-PD-001', '[PILOTO] 1ª medição do contrato',
            1, 120000.00, 120000.00, v_ini + 10, 'faturado');
    RAISE NOTICE 'contrato e pedido criados';
  END IF;

  -- ── Meta do mês corrente ────────────────────────────────────────────────
  INSERT INTO public.comercial_metas
    (empresa_id, user_id, ano, mes, meta_faturamento, meta_contratos,
     meta_participacoes, base_meta, observacao, criado_por)
  SELECT v_emp, v_user,
         EXTRACT(YEAR FROM v_hoje)::int, EXTRACT(MONTH FROM v_hoje)::int,
         500000.00, 4, 20, 'faturamento', '[PILOTO] meta de teste', v_user
   WHERE NOT EXISTS (
     SELECT 1 FROM public.comercial_metas
      WHERE empresa_id = v_emp AND user_id = v_user
        AND ano = EXTRACT(YEAR FROM v_hoje)::int
        AND mes = EXTRACT(MONTH FROM v_hoje)::int
   );
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'metas inseridas: %', v_n;

  RAISE NOTICE 'semente do piloto aplicada com sucesso';
END $$;

-- ── Conferência: o DONO tem de ser 23d641eb-… em todas as linhas ────────────
SELECT 'licitacoes' AS tabela, user_id::text AS dono, count(*) AS qtd
  FROM public.licitacoes WHERE objeto LIKE '[PILOTO]%' GROUP BY user_id
UNION ALL
SELECT 'perdas', user_id::text, count(*)
  FROM public.comercial_perdas WHERE observacao LIKE '[PILOTO]%' GROUP BY user_id
UNION ALL
SELECT 'contratos', vendedor_user_id::text, count(*)
  FROM public.contratos WHERE numero_contrato = 'PIL-CT-001/2026' GROUP BY vendedor_user_id
UNION ALL
SELECT 'pedidos', user_id::text, count(*)
  FROM public.contrato_pedidos WHERE numero_pedido = 'PIL-PD-001' GROUP BY user_id
UNION ALL
SELECT 'metas', user_id::text, count(*)
  FROM public.comercial_metas WHERE observacao LIKE '[PILOTO]%' GROUP BY user_id;

-- ESPERADO: 5 linhas, todas com dono = 23d641eb-edd0-4347-b382-e972ad717a91,
-- e qtd = 6 / 1 / 1 / 1 / 1.
