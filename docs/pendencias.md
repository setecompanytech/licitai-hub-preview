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

---

## [2026-08-03] PRIORIZADA — dia útil por praça do colaborador (metas)

**Prazo-alvo:** implementar antes do fechamento de setembro/2026.

**Contexto:** a equipe comercial é distribuída em todas as UFs, então o dia útil varia por
pessoa. Hoje `comercial_feriados` é só por empresa, e o motor trata todo mundo com o mesmo
calendário.

**Modelo pretendido:**

- `comercial_feriados` ganha `uf` e `municipio` opcionais — `null`/`null` = nacional (vale
  para todos), `uf` preenchida = estadual, `uf` + `municipio` = municipal;
- colaborador ganha uma praça (`uf`, `municipio`) em `empresa_membros`, editável pelo admin;
- no cálculo, o colaborador recebe os nacionais + os da UF dele + os do município dele;
- só serão cadastrados feriados estaduais das UFs e municipais das cidades **onde há
  colaborador** — não o Brasil inteiro;
- colaborador sem praça definida usa só os nacionais, que é o comportamento atual. A
  transição não quebra ninguém.

**Por que foi adiado:** agosto/2026 não tem feriado nacional, então o resultado com praça e
sem praça é idêntico no mês. Construir agora seria entregar sem poder validar. O primeiro mês
que exercita a regra é setembro (07/09, segunda) — daí o prazo-alvo.

### Faseamento

**Fase 1 — schema + praça do colaborador.** Migration com as colunas novas nas duas tabelas,
mais a tela de praça em `EquipeColaboradores.tsx`. Entregue isso, os feriados estaduais e
municipais entram por SQL, como os nacionais entram hoje. É o que destrava o valor sem
depender da parte grande, e é o dado que diz *quais* UFs e municípios cadastrar.

**Fase 2 — CRUD de feriados na Parametrização.** Hoje **não existe** tela nenhuma de
feriados: tabela, formulário e exclusão saem do zero. É a maior parte do esforço e a única
que não é pré-requisito de nada.

### Tamanho estimado

| Parte | Tamanho | Observação |
| --- | --- | --- |
| Schema | P | 1 migration idempotente, RLS já existe nas duas tabelas |
| Motor | PP | `dias-uteis.ts` e `projecao.ts` **não mudam** (ver abaixo) |
| Hooks | P | campos novos em `useFeriados`/`useColaboradores` + 1 mutation |
| Testes | P | ~12 casos na função de filtro; os atuais seguem válidos |
| Tela — CRUD de feriados | G | do zero |
| Tela — praça | M | dois campos em `EquipeColaboradores.tsx` (625 linhas) |
| Tela — painel | PP | passar a lista já filtrada |

O motor não muda porque `dias-uteis.ts` aceita uma lista arbitrária de datas e `projecao.ts`
apenas a repassa. O filtro por praça é uma função pura nova aplicada **antes** do motor.

### Ressalvas a resolver na implementação

**1. A constraint atual bloqueia o modelo.** `comercial_feriados` tem
`UNIQUE (empresa_id, data)`. Com praças, duas UFs podem ter feriados diferentes na mesma
data e o segundo `INSERT` seria descartado em silêncio. A migration precisa trocar por
`UNIQUE (empresa_id, data, coalesce(uf,''), coalesce(municipio,''))`. Os dados já
cadastrados não precisam de retrabalho: nacional tem `uf` nulo e continua único por data.

**2. Município como texto livre falha para menos.** "Santa Rosa" vs. "SANTA ROSA " vs.
"Santa Rosa/RS" não casam, e o efeito é silencioso — o colaborador ganha um dia útil que não
existe, inflando o denominador do ritmo diário. Normalizar no mesmo padrão do `achatar()` de
`src/lib/metas/modalidades.ts`, com testes de grafia.

**3. A tela precisa mostrar quantos feriados entraram no cálculo.** Praça errada ou feriado
não cadastrado não gera erro, só distorce a projeção. Sem esse número visível no painel do
colaborador, ninguém descobre que está errado.
