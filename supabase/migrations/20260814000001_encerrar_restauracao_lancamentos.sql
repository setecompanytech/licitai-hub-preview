-- =============================================================================
-- Encerra a rotina de restauração de lançamentos financeiros (incidente de maio)
--
-- DIAGNÓSTICO (2026-08-14). Dois jobs da restauração de 2026-05-07 continuavam
-- agendados três meses depois do incidente:
--
--   restaurar-lancamentos-tick   */2 min — FALHAVA em toda execução (~720/dia):
--                                a tabela `restauracao_lancamentos_progresso`,
--                                que o comando consulta na guarda WHERE, não
--                                existe mais no banco.
--   popular-fila-restauracao     */1 min — "sucedia", mas fazia dano silencioso:
--                                capturava TODO delete de financeiro_lancamentos
--                                para a fila de restauração, misturando deleções
--                                LEGÍTIMAS dos usuários com o incidente antigo.
--
-- A fila tinha 124 pendentes e 0 processados. A distribuição temporal dos
-- deletes fechou a questão: jun=7, jul=34, ago=83, MAIO=0. Nenhum item é do
-- incidente — todos são deleções intencionais pós-incidente. NÃO há nada a
-- restaurar; restaurá-los ressuscitaria lançamentos apagados de propósito.
--
-- Esta migration registra o desligamento (feito manualmente em 2026-08-14) e
-- remove a infraestrutura órfã: a fila, e as SEIS gerações de funções que o
-- incidente deixou para trás. O `financeiro_audit_log` fica intacto — ele é a
-- fonte de verdade e permite refazer qualquer análise futura.
-- =============================================================================

-- Idempotente: já desligados manualmente; repetido aqui para registro.
DO $$ BEGIN PERFORM cron.unschedule('restaurar-lancamentos-tick'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('popular-fila-restauracao'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- A fila: só UUIDs de controle, todos referentes a deleções legítimas.
-- O conteúdo real (dados_antes) permanece no financeiro_audit_log.
DROP TABLE IF EXISTS public.restauracao_lancamentos_fila;
DROP TABLE IF EXISTS public.restauracao_lancamentos_progresso;

-- As seis gerações de funções do incidente.
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_tick();
DROP FUNCTION IF EXISTS public.popular_fila_restauracao(int);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_por_id_v3(int);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_por_id_v2(int);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_por_id(integer);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_audit(integer);
