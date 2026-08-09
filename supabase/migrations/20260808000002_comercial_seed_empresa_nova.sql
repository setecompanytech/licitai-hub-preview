-- =============================================================================
-- MIGRATION: Metas do Comercial — seed automatico em empresa nova
-- Data: 2026-08-08
-- Objetivo: fechar a lacuna deixada pela Fase A.
--
-- O seed daquela migration percorreu `SELECT id FROM empresas` uma vez, entao
-- so alcancou as empresas existentes naquele momento. Empresa criada depois
-- nasce sem valores-alvo e sem motivos de perda: o painel de metas fica sem
-- referencia de ticket e o dialogo de perda abre vazio, impedindo marcar
-- qualquer processo como Perdida.
--
-- Trigger, e nao chamada na aplicacao, porque ha mais de um caminho que cria
-- empresa (cadastro, convite, seed de demo) e todos precisam do mesmo
-- resultado. Hoje `comercial_seed_padroes` so e chamada pelo botao
-- "Restaurar padroes" da tela de parametrizacao, que depende de alguem
-- perceber o problema e agir.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comercial_seed_ao_criar_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.comercial_seed_padroes(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_comercial_seed_padroes ON public.empresas;
CREATE TRIGGER empresas_comercial_seed_padroes
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.comercial_seed_ao_criar_empresa();

-- Rede de seguranca: reaplica nas empresas criadas entre a Fase A e agora,
-- que ficaram sem parametrizacao. Idempotente — nao sobrescreve o que existe.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT e.id
      FROM public.empresas e
     WHERE NOT EXISTS (
       SELECT 1 FROM public.comercial_motivos_perda m WHERE m.empresa_id = e.id
     )
  LOOP
    PERFORM public.comercial_seed_padroes(r.id);
  END LOOP;
END;
$$;
