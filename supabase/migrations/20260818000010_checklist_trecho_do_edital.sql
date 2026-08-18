-- =============================================================================
-- Checklist de habilitação guarda o TRECHO ORIGINAL do edital
--
-- Hoje a linha traz o nome da exigência (interpretação da IA) e o número do
-- item. Quem confere precisa do texto como o órgão escreveu: "atestado(s) de
-- capacidade técnica, emitido(s) por pessoa jurídica de direito público ou
-- privado, que comprove(m) a execução anterior de objeto similar e compatível"
-- diz o que "Atestado de Capacidade Técnica" não diz — quem pode emitir, o que
-- precisa comprovar, e o que conta como similar.
--
-- Sem o texto à vista, conferir exige abrir o PDF e procurar o item. A
-- interpretação continua ali, agora acompanhada da fonte.
--
-- Nulo em linha antiga: o trecho só existe a partir da próxima geração.
-- =============================================================================

ALTER TABLE public.processo_habilitacao_checklist
  ADD COLUMN IF NOT EXISTS trecho_edital text;

COMMENT ON COLUMN public.processo_habilitacao_checklist.trecho_edital IS
  'Transcrição literal do trecho do edital que cria a exigência, como o órgão '
  'escreveu. Complementa `exigencia` (interpretação) e `referencia` (número do '
  'item). Nulo em registro anterior a 18/08/2026.';
