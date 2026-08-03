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
