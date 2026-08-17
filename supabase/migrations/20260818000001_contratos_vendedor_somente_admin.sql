-- =============================================================================
-- Trocar o vendedor de um contrato é ato de administrador
--
-- `vendedor_user_id` decide de quem é a meta e para quem vai a bonificação.
-- A tela já esconde o seletor de quem não é admin, mas esconder um controle
-- não fecha a porta: a mesma linha continua atualizável pela API com o token
-- de qualquer membro, e a policy de contratos autoriza UPDATE para a empresa
-- inteira (assim tem de ser — financeiro lança consumo, jurídico faz aditivo).
--
-- Então o recorte é por COLUNA, não por linha: todos seguem editando o
-- contrato; só administrador muda de quem ele é.
--
-- auth.uid() nulo = execução server-side (edge function com service_role,
-- job de cron). Esses caminhos não passam por RLS e não são o risco aqui.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.contratos_vendedor_somente_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendedor_user_id IS DISTINCT FROM OLD.vendedor_user_id
     AND auth.uid() IS NOT NULL
     AND NOT public.is_empresa_admin(auth.uid(), NEW.empresa_id)
  THEN
    RAISE EXCEPTION
      'Somente o administrador da empresa pode alterar o vendedor responsável pelo contrato.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contratos_vendedor_somente_admin ON public.contratos;

CREATE TRIGGER trg_contratos_vendedor_somente_admin
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.contratos_vendedor_somente_admin();

COMMENT ON COLUMN public.contratos.vendedor_user_id IS
  'Colaborador responsável pelo contrato: define a carteira que ele vê, a meta '
  'em que o contrato conta e quem recebe a bonificação. Só administrador altera '
  '(trigger trg_contratos_vendedor_somente_admin).';
