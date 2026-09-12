-- ============================================================================
-- Boletins Diários: a lista passa a abrir o conteúdo enviado (12/09)
-- ============================================================================
-- A aba "Boletins" listava os envios mas o clique não fazia nada: o painel
-- expandido só renderizava com itens > 0, e `itens: []` era FIXO no código —
-- o conteúdo do boletim não era gravado em lugar nenhum, só ia no e-mail.
-- Agora cada envio arquiva um resumo do que foi mandado (até 20 editais +
-- resumo executivo), e a tela abre esse arquivo. Envio antigo (sem conteudo)
-- mostra aviso honesto de que o boletim completo está no e-mail.
ALTER TABLE public.boletim_envios
  ADD COLUMN IF NOT EXISTS total_itens integer,
  ADD COLUMN IF NOT EXISTS conteudo jsonb;

COMMENT ON COLUMN public.boletim_envios.conteudo IS
  'Instantâneo do que o e-mail levou: {resumo, uf_sede, editais:[{orgao, objeto, municipio, uf, valor, url, data_abertura}]} — até 20 itens. Preenchido pelas edges boletim-ia-diario e envio-boletim.';
