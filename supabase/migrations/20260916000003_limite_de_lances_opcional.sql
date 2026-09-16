-- 20260916000003 — o limite de lances da disputa passa a ser opcional
--
-- APLICAR ANTES de publicar a tela que deixa o campo "Máx. lances por sessão"
-- vazio. Com a coluna ainda NOT NULL, salvar uma disputa sem limite falharia
-- com erro de banco.
--
-- POR QUE. Na reunião de 14/09 o limite ficou definido como escolha: "30 ou
-- infinitamente até chegar no meu limite". Até aqui a coluna era NOT NULL com
-- padrão 20, e a tela gravava 20 quando o campo ficava vazio — um teto que
-- ninguém pôs. Agora NULL significa "sem teto": o robô disputa até o piso de
-- cada item. E o teto passou a contar lances ENVIADOS, não rodadas de leitura.
--
-- Disputas existentes não mudam: continuam com o número que têm (20 para quem
-- nunca mexeu). O padrão 20 continua valendo para insert que não informe a
-- coluna — só o vazio explícito vira "sem teto".
--
-- Reversão (só se nenhuma disputa tiver sido salva sem limite):
--   UPDATE public.robo_lances_disputas SET max_lances = 20 WHERE max_lances IS NULL;
--   ALTER TABLE public.robo_lances_disputas ALTER COLUMN max_lances SET NOT NULL;

ALTER TABLE public.robo_lances_disputas ALTER COLUMN max_lances DROP NOT NULL;

COMMENT ON COLUMN public.robo_lances_disputas.max_lances IS
  'Teto de lances ENVIADOS pelo robô nesta disputa. NULL = sem teto: disputa até o piso de cada item.';
