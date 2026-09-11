-- UASG na disputa do robô de lances.
--
-- No Compras.gov o número da compra NÃO é único: em 10/09/2026 a busca
-- "Em disputa" devolveu cinco "N° 1/2022", de cinco órgãos. O código da
-- unidade compradora (UASG, 6 dígitos) é o que torna a busca exata — o
-- formulário público tem o campo, e o agente já sabe preenchê-lo.
--
-- Só a disputa ganha a coluna: é o registro do que o operador decidiu. A
-- sessão (sessoes_lance_real) não muda — a UASG viaja no corpo para o
-- agente, e assim o envio não depende desta migration ter sido aplicada.
ALTER TABLE public.robo_lances_disputas
  ADD COLUMN IF NOT EXISTS uasg text;

COMMENT ON COLUMN public.robo_lances_disputas.uasg IS
  'Código da unidade compradora (Compras.gov), 6 dígitos. Desambigua o número da compra, que se repete entre órgãos.';
