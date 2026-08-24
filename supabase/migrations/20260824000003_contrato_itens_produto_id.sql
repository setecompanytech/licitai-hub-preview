-- =============================================================================
-- O item do contrato ganha o elo com o produto do catálogo
--
-- O formulário "Cadastrar Item da ATA" oferece "Buscar Produto do Catálogo" e
-- grava `produto_id` — mas a coluna nunca existiu em `contrato_itens`. Nenhuma
-- migration a criou: a tela nasceu apostando num schema que não veio, e todo
-- cadastro manual de item morria com "Could not find the 'produto_id' column".
--
-- O elo em si é legítimo: o mesmo produto vendido em três atas é UM produto no
-- catálogo, e sem a chave o vínculo refaz-se por nome — que diverge na primeira
-- abreviação. Nulo permitido: item de contrato antigo não tem produto e não
-- precisa ter.
-- =============================================================================

ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contrato_itens_produto
  ON public.contrato_itens(produto_id) WHERE produto_id IS NOT NULL;

COMMENT ON COLUMN public.contrato_itens.produto_id IS
  'Produto do catálogo (public.produtos) que este item vende. Nulo em item '
  'sem vínculo — cadastro antigo ou produto fora do catálogo. ON DELETE SET '
  'NULL: apagar o produto não pode apagar o item de um contrato.';
