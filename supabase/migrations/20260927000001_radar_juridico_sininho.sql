-- ============================================================================
-- Radar Jurídico no sininho: o que os dados apontam vira aviso, uma vez
-- ============================================================================
--
-- O Apoio Jurídico abre pelo Radar (decisão do dono, 27/09/2026): eventos
-- derivados dos contratos, termos, processos e documentos, cada um com a peça.
-- Quem não abre o módulo não vê. Esta rotina diária leva ao sininho SÓ o que
-- nenhuma outra rotina cobre — reajuste devido já tem `alertas-reajuste`
-- (marcos 90/60/30/7/0), certidão vencendo já tem `alertas-documentos`:
--   1) reajuste devido E termo assinado depois do aniversário sem reajuste
--      (risco de preclusão lógica) — crítico;
--   2) vigência de contrato terminando em até 15 dias, ou vencida sem
--      prorrogação registrada;
--   3) executado acima do valor contratado (saldo negativo) com vigência em
--      curso;
--   4) desclassificação ou inabilitação registrada nos últimos 3 dias — o
--      recurso corre em 3 dias úteis (art. 165).
-- Destinatários: admins da empresa e a equipe 'juridico' (quando existir),
-- via `avisar_setor_da_empresa`. Dedupe: o mesmo aviso (link + título) não
-- repete em 30 dias para a mesma empresa.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

-- ── 1) Um aviso por empresa, sem repetir em 30 dias ─────────────────────────
CREATE OR REPLACE FUNCTION public.avisar_radar_juridico(
  p_empresa_id uuid, p_titulo text, p_mensagem text, p_link text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.notificacoes n
      JOIN public.empresa_membros m ON m.user_id = n.user_id
     WHERE m.empresa_id = p_empresa_id
       AND n.link = p_link
       AND n.titulo = p_titulo
       AND n.created_at > now() - interval '30 days'
  ) THEN
    RETURN 0;
  END IF;
  RETURN public.avisar_setor_da_empresa(p_empresa_id, 'juridico', p_titulo, p_mensagem, p_link, 'juridico');
END $$;
REVOKE ALL ON FUNCTION public.avisar_radar_juridico(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- ── 2) A rotina ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notificar_radar_juridico()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_total integer := 0;
  v_tipos_reajuste text[] := ARRAY['reajuste', 'repactuacao'];
  r record;
  v_titulo text;
  v_msg text;
  v_link text;
BEGIN
  -- 1) Preclusão: aniversário passado e termo posterior sem reajuste.
  --    O marco anda com o último reajuste/repactuação registrado (mesma régua
  --    do cartão do contrato e do front); reequilíbrio NÃO reinicia a contagem.
  FOR r IN
    SELECT c.id, c.empresa_id, c.numero_contrato, c.indice_reajuste,
           (m.marco + interval '1 year')::date AS aniversario
      FROM public.contratos c
      CROSS JOIN LATERAL (
        SELECT GREATEST(
                 c.data_base_reajuste,
                 COALESCE((SELECT max(COALESCE(a.data_base_reajuste, a.data_assinatura))
                             FROM public.contrato_aditivos a
                            WHERE a.contrato_id = c.id AND a.tipo = ANY(v_tipos_reajuste)),
                          c.data_base_reajuste)
               ) AS marco
      ) m
     WHERE c.excluido_em IS NULL
       AND c.empresa_id IS NOT NULL
       AND c.status IS DISTINCT FROM 'encerrado'
       AND c.tipo_documento IS DISTINCT FROM 'ata_srp'
       AND c.data_base_reajuste IS NOT NULL
       AND (m.marco + interval '1 year')::date <= v_hoje
       AND EXISTS (
         SELECT 1 FROM public.contrato_aditivos a
          WHERE a.contrato_id = c.id
            AND a.data_assinatura >= (m.marco + interval '1 year')::date
            AND NOT (a.tipo = ANY(v_tipos_reajuste)))
  LOOP
    v_titulo := format('Reajuste devido e termo assinado depois do aniversário — contrato %s', COALESCE(r.numero_contrato, 'sem número'));
    v_msg := format('Aniversário do reajuste em %s (índice %s). Há termo aditivo assinado depois, sem o reajuste: requeira já, com ressalva expressa, antes que a preclusão lógica se consolide (Lei 14.133/2021, art. 92, § 3º, e art. 136, I).',
                    to_char(r.aniversario, 'DD/MM/YYYY'), COALESCE(r.indice_reajuste, 'da cláusula'));
    v_link := '/apoio-juridico/redigir/7?contrato=' || r.id;
    v_total := v_total + public.avisar_radar_juridico(r.empresa_id, v_titulo, v_msg, v_link);
  END LOOP;

  -- 2) Vigência terminando em até 15 dias, ou vencida sem prorrogação.
  FOR r IN
    SELECT c.id, c.empresa_id, c.numero_contrato, c.data_fim
      FROM public.contratos c
     WHERE c.excluido_em IS NULL
       AND c.empresa_id IS NOT NULL
       AND c.status IS DISTINCT FROM 'encerrado'
       AND c.tipo_documento IS DISTINCT FROM 'ata_srp'
       AND c.data_fim IS NOT NULL
       AND c.data_fim <= v_hoje + 15
  LOOP
    IF r.data_fim < v_hoje THEN
      v_titulo := format('Vigência vencida sem prorrogação registrada — contrato %s', COALESCE(r.numero_contrato, 'sem número'));
      v_msg := format('Fim em %s. Fornecer com o prazo vencido é executar sem contrato: ou se prorroga (se ainda cabível) ou se encerra formalmente (Lei 14.133/2021, arts. 105, 107 e 111).', to_char(r.data_fim, 'DD/MM/YYYY'));
    ELSE
      v_titulo := format('Vigência termina em até 15 dias — contrato %s', COALESCE(r.numero_contrato, 'sem número'));
      v_msg := format('Fim em %s. A prorrogação exige termo aditivo assinado ANTES do fim da vigência (Lei 14.133/2021, art. 107 ou art. 111); instrua o pedido com a vantajosidade.', to_char(r.data_fim, 'DD/MM/YYYY'));
    END IF;
    v_link := '/apoio-juridico/redigir/21?contrato=' || r.id;
    v_total := v_total + public.avisar_radar_juridico(r.empresa_id, v_titulo, v_msg, v_link);
  END LOOP;

  -- 3) Executado acima do valor contratado, vigência em curso.
  FOR r IN
    SELECT c.id, c.empresa_id, c.numero_contrato, c.saldo_remanescente
      FROM public.contratos c
     WHERE c.excluido_em IS NULL
       AND c.empresa_id IS NOT NULL
       AND c.status IS DISTINCT FROM 'encerrado'
       AND COALESCE(c.valor_global, 0) > 0
       AND c.saldo_remanescente < 0
       AND (c.data_fim IS NULL OR c.data_fim >= v_hoje)
  LOOP
    v_titulo := format('Executado acima do valor contratado — contrato %s', COALESCE(r.numero_contrato, 'sem número'));
    v_msg := format('Saldo de %s: há pedidos além do valor global sem aditivo que os ampare. Regularizar por termo aditivo quantitativo, até 25%% (Lei 14.133/2021, art. 124, I, "b", e art. 125), ou declarar o encerramento.',
                    to_char(r.saldo_remanescente, 'FML999G999G999D00'));
    v_link := '/apoio-juridico/redigir/21?contrato=' || r.id;
    v_total := v_total + public.avisar_radar_juridico(r.empresa_id, v_titulo, v_msg, v_link);
  END LOOP;

  -- 4) Desclassificação ou inabilitação recente: recurso em 3 dias úteis.
  FOR r IN
    SELECT l.id, l.empresa_id, l.numero, l.resultado
      FROM public.licitacoes l
     WHERE l.empresa_id IS NOT NULL
       AND l.arquivado_em IS NULL
       AND lower(COALESCE(l.resultado, '')) IN ('desclassificada', 'inabilitada')
       AND l.updated_at >= now() - interval '3 days'
  LOOP
    v_titulo := format('%s — recurso em 3 dias úteis — processo %s', r.resultado, COALESCE(r.numero, 'sem número'));
    v_msg := 'O prazo do recurso conta da intimação ou da lavratura da ata (Lei 14.133/2021, art. 165, I, e § 1º). Confira a data da decisão no portal e redija a peça com o caso montado.';
    v_link := '/apoio-juridico/redigir/3?licitacao=' || r.id;
    v_total := v_total + public.avisar_radar_juridico(r.empresa_id, v_titulo, v_msg, v_link);
  END LOOP;

  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.notificar_radar_juridico() FROM PUBLIC, anon, authenticated;

-- ── 3) Job diário às 08:30 de Brasília (11:30 UTC) ──────────────────────────
-- Comportamento de produto, não rotina temporária (princípio 5): vive
-- enquanto houver contrato; a condição de parada de cada aviso é a peça
-- protocolada ou o fato resolvido, que o tira da régua.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'radar-juridico-diario') THEN
      PERFORM cron.unschedule('radar-juridico-diario');
    END IF;
    PERFORM cron.schedule('radar-juridico-diario', '30 11 * * *', 'SELECT public.notificar_radar_juridico();');
  ELSE
    RAISE NOTICE 'pg_cron ausente: o Radar Jurídico diário não foi agendado.';
  END IF;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'radar-juridico-diario';
--   SELECT public.notificar_radar_juridico();   -- devolve quantos avisos criou
--   SELECT titulo, link, count(*) FROM public.notificacoes WHERE tipo = 'juridico' GROUP BY 1, 2;
