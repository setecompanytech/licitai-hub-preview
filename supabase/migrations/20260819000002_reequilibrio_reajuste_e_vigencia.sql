-- =============================================================================
-- O que o reequilíbrio exige, o que o reajuste exige, e o prazo que a espécie
-- do objeto comporta
--
-- Três lacunas do mesmo tema, apontadas pelo dono do produto.
--
-- 1. REVISÃO × REAJUSTE. Os dois já ficavam fora do teto do art. 125 — e isso
--    está certo, nenhum acresce objeto. Mas o que sustenta cada um é diferente:
--    reajuste é índice e data-base; revisão exige fato imprevisível POSTERIOR à
--    proposta, ausência de culpa e prova documental. Sem esses campos, o pedido
--    nasce sem o que o sustenta, e a falta só aparece quando o órgão indefere.
--
-- 2. PRECLUSÃO LÓGICA. Assinar prorrogação sem ressalva depois do fato gerador
--    pode ser lido como aceitação dos preços antigos — renúncia ao direito. O
--    sistema tinha as datas e os tipos e não os cruzava. `com_ressalva` é o dado
--    que faltava: sem ele, não há como distinguir a prorrogação que preservou o
--    direito da que o comprometeu.
--
-- 3. VIGÊNCIA POR ESPÉCIE. 120 meses era teto de tudo. Dez anos só cabem em
--    serviço ou fornecimento contínuo (arts. 106 e 107); compra com entrega
--    imediata se esgota no ato, e locação de informática tem 4 anos (art. 109).
--
-- Tudo nulo em registro antigo: são declarações que ninguém fez até aqui, e
-- inferi-las seria o sistema opinar sobre processo que não acompanhou.
-- =============================================================================

-- ── 1 e 2 · o que sustenta o pedido, e a ressalva ────────────────────────────
ALTER TABLE public.contrato_aditivos
  ADD COLUMN IF NOT EXISTS data_fato_gerador date,
  ADD COLUMN IF NOT EXISTS indice_reajuste text,
  ADD COLUMN IF NOT EXISTS data_base_reajuste date,
  ADD COLUMN IF NOT EXISTS com_ressalva boolean;

COMMENT ON COLUMN public.contrato_aditivos.data_fato_gerador IS
  'Quando ocorreu o evento que rompeu a equação econômico-financeira. Só em '
  'revisão/reequilíbrio, e precisa ser POSTERIOR à apresentação da proposta. '
  'É a data que o sistema cruza para avisar sobre preclusão lógica.';

COMMENT ON COLUMN public.contrato_aditivos.indice_reajuste IS
  'Índice contratual aplicado no reajuste (INPC, IPCA, IGP-M…). Só em reajuste '
  'e repactuação — revisão não se calcula por índice.';

COMMENT ON COLUMN public.contrato_aditivos.data_base_reajuste IS
  'Data-base a partir da qual conta a periodicidade do reajuste.';

COMMENT ON COLUMN public.contrato_aditivos.com_ressalva IS
  'Prorrogação assinada COM ressalva quanto aos preços. Assinar sem ressalva '
  'depois do fato gerador pode ser interpretado como renúncia ao reequilíbrio '
  '(preclusão lógica). Nulo = não declarado, e o sistema trata como sem ressalva '
  'ao avisar — o alerta é conservador de propósito.';

-- ── 3 · a espécie do objeto, que define o prazo possível ─────────────────────
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS especie_objeto text;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_especie_objeto_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_especie_objeto_check
  CHECK (especie_objeto IS NULL OR especie_objeto IN (
    'compra_entrega_imediata', 'servico_continuo', 'servico_escopo', 'informatica'
  ));

COMMENT ON COLUMN public.contratos.especie_objeto IS
  'Espécie do objeto, que determina o prazo máximo: compra_entrega_imediata '
  '(art. 105), servico_continuo (arts. 106 e 107, até 10 anos), servico_escopo '
  '(art. 111) ou informatica (art. 109, 4 anos). Espelho no front: '
  'ESPECIES_OBJETO em src/lib/contratos/instrumentos.ts.';
