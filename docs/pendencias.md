# Pendências conhecidas

Itens identificados durante o trabalho, deixados de fora do escopo em curso por decisão
explícita. Não são bugs novos — são coisas que já estavam no repositório ou que foram
adiadas de propósito.

---

## [2026-08-03] 2 testes falhando em `concorrentes-document-analysis.test.ts`

**Situação:** `src/test/concorrentes-document-analysis.test.ts` tem 2 dos 5 testes falhando
(a falha aponta para a linha 79). Verificado que já falhavam **antes** do módulo de Metas do
Comercial — não é regressão dele.

**Como reproduzir:**

```sh
npx vitest run src/test/concorrentes-document-analysis.test.ts
# Tests  2 failed | 3 passed (5)
```

**Decisão:** deixado como está, fora do escopo do módulo de metas. Revisar depois da Fase C.

**Efeito colateral a considerar:** enquanto isso, `npm run test` (suíte inteira) sai com
código diferente de zero. Se algum dia entrar verificação de testes em CI ou em hook de
commit, isso vai barrar — então convém resolver antes disso.

---

## [2026-08-03] 14 erros de tipo fora do módulo de metas

**Situação:** `npx tsc --noEmit -p tsconfig.app.json` acusa 14 erros, todos anteriores ao
módulo de Metas do Comercial e concentrados em cinco arquivos:

| Arquivo | Erros | Natureza |
| --- | --- | --- |
| `src/components/contratos/ContratoItens.tsx` | 6 | tabela `produtos` ausente em `types.ts`; `TS2589` |
| `src/components/contratos/ContratoPedidos.tsx` | 2 | `codigo_item` fora de `ContratoItem`; `any` → `never` |
| `src/components/financeiro/FinEmissorNFe.tsx` | 2 | `pedido_id` ausente em `financeiro_nfes_emitidas` |
| `src/components/financeiro/FinPedidosAFaturar.tsx` | 1 | `any` → `never` |
| `src/components/financeiro/LancamentoDialog.tsx` | 1 | `'movimentacao'` fora do union de tipo |
| `src/components/gestao-compras/PedidosOmie.tsx` | 2 | tabela `produtos` ausente em `types.ts`; `TS2589` |

**Causa provável:** `src/integrations/supabase/types.ts` está desatualizado em relação ao
banco — a maior parte some com uma nova geração de tipos.

**Como reproduzir:**

```sh
npx tsc --noEmit -p tsconfig.app.json
```

**Decisão:** fora do escopo da Fase D. Não afeta build nem execução — `npm run build` é
`vite build`, que não faz checagem de tipos, e nada disso está em CI.
