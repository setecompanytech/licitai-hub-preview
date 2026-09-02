-- ═══════════════════════════════════════════════════════════════════════════
-- O contrato diz se o fornecimento é único ou contínuo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O alerta de "saldo baixo/esgotado" existe para avisar que PEDIDOS FUTUROS
-- não terão cobertura. Em contrato de ENTREGA ÚNICA (comum na dispensa, mas
-- possível em qualquer modalidade), saldo esgotado não é risco — é conclusão:
-- entregou-se tudo, o contrato caminha para o encerramento, e o alerta
-- permanente vira ruído.
--
-- A forma de fornecimento é informação DO CONTRATO (cláusula de entrega/
-- execução). Três valores:
--   'unico'    → entrega única/integral: saldo esgotado = concluído;
--   'continuo' → fornecimento parcelado/contínuo: alerta vale como sempre;
--   NULL       → ninguém informou. Nenhum padrão é inventado: o registro
--                existente herda NULL e se comporta exatamente como hoje, e a
--                tela PERGUNTA quando a hipótese surgir (saldo esgotado),
--                em vez de assumir.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS forma_fornecimento text
  CHECK (forma_fornecimento IS NULL OR forma_fornecimento IN ('unico', 'continuo'));

COMMENT ON COLUMN public.contratos.forma_fornecimento IS
  'Forma de fornecimento declarada no contrato: unico (entrega integral de '
  'uma vez — saldo esgotado significa concluído, não alerta) ou continuo '
  '(parcelado — saldo esgotado alerta pedidos futuros). NULL = não informado: '
  'comportamento clássico, e a tela pergunta quando o saldo zerar.';
