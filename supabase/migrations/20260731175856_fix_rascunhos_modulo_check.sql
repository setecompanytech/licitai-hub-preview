-- Fix rascunhos: add precificacao_planilha to modulo CHECK constraint
ALTER TABLE public.rascunhos DROP CONSTRAINT IF EXISTS rascunhos_modulo_check;

ALTER TABLE public.rascunhos
  ADD CONSTRAINT rascunhos_modulo_check
  CHECK (modulo IN ('proposta', 'precificacao', 'precificacao_planilha'));
