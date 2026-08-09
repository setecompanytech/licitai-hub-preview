-- =============================================================================
-- MIGRATION: corrige o comentario de profiles.username
-- Data: 2026-08-09
-- Objetivo: o comentario gravado pela 20260809000001 descreve o e-mail da conta
--           como sempre sintetico. Isso ficou desatualizado no mesmo dia: o
--           teste no HostGator confirmou que o sub-enderecamento e entregue na
--           caixa do setor, e ele virou o padrao — o dominio reservado passou a
--           ser apenas a queda.
--
-- Comentario de coluna e documentacao que vive no banco: quem for ler o schema
-- daqui a seis meses le isto, nao o commit. Errado, induz a conclusao de que
-- recuperacao de senha nao funciona.
-- =============================================================================

COMMENT ON COLUMN public.profiles.username IS
  'Login individual do colaborador e identidade de acesso quando o setor usa '
  'um e-mail compartilhado. O e-mail da conta em auth.users e derivado dele '
  'por sub-enderecamento (comercial+<login>@dominio), entregue na caixa do '
  'setor — e o que mantem a redefinicao de senha funcionando. Quando o e-mail '
  'do setor nao serve de base, cai em <login>@praefectus.invalid, dominio '
  'reservado pela RFC 2606, e ai a redefinicao fica indisponivel. Regra em '
  'supabase/functions/accept-sector-invite/email-conta.ts. Unico sem distinguir maiusculas.';
