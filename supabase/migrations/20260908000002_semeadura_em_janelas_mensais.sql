-- A janela ANUAL da semeadura estourava o timeout do PNCP em toda fatia — o
-- cron disparou por quatro madrugadas e cada invocação morreu na primeira
-- consulta, sem rastro (08/09). Janela MENSAL responde em segundos.
DELETE FROM public.pncp_semeadura_progresso WHERE NOT concluido;

INSERT INTO public.pncp_semeadura_progresso (uf, modalidade_id, data_inicial, data_final)
SELECT 'PA', m, ini::date, LEAST((ini + interval '1 month' - interval '1 day')::date, DATE '2026-09-08')
FROM unnest(ARRAY[6, 8, 9, 4, 5, 7]) AS m,
     generate_series(DATE '2023-09-01', DATE '2026-09-01', interval '1 month') AS ini
ON CONFLICT (uf, modalidade_id, data_inicial) DO NOTHING;
