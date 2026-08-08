# Pendências conhecidas

Itens identificados durante o trabalho, deixados de fora do escopo em curso por decisão
explícita. Não são bugs novos — são coisas que já estavam no repositório ou que foram
adiadas de propósito.

---

## [2026-08-08] Um segundo banco com schema do Praefectus na organização

**Situação:** ao investigar por que uma semente de dados de teste "sumiu", verificou-se que
existem **dois projetos Supabase com o schema do Praefectus** na organização:

| Projeto | Ref | Papel |
| --- | --- | --- |
| New Database - Praefectus | `uwtyuwktxalnpgrcbbgk` | **o que o app usa** (produção de fato) |
| xfinconsultuoriaempresarial-a11y's Project | `pyizwczmmzavtujfbivd` | desconhecido — mas `public.licitacoes` **existe** lá |

**Por que importa:** um SQL colado na aba errada do SQL Editor executa em silêncio no banco
errado, e a conferência "passa" — foi exatamente o que aconteceu em 2026-08-08 com a semente
do piloto de UI. Sem saber que o segundo banco existe, o diagnóstico custa caro.

**A que o app está preso:** `uwtyuwktxalnpgrcbbgk` está **hardcoded** em
`src/integrations/supabase/client.ts:5` (arquivo gerado, não lê `.env`) e reforçado pelo
`define` do `vite.config.ts`. Não há banco local: `npm run dev` fala com a nuvem.

**Pendente de decisão:** descobrir o que é o `pyizwczmmzavtujfbivd` — cópia antiga, ambiente
de teste, ou projeto órfão de algum experimento. Se for lixo, apagar; se tiver uso,
documentar qual. Enquanto não se decide, **confira sempre o projeto selecionado antes de
rodar SQL**.

**Mitigação já aplicada:** os scripts de dados de teste passaram a ter *guarda de banco* —
abortam com `BANCO ERRADO` se o registro esperado não existir ali (ver `piloto-ui-seed.sql`).
Vale repetir o padrão em qualquer script futuro que dependa de dados de uma conta específica.

---

## ~~[2026-08-08] `.env` apontava as `VITE_*` para um projeto inexistente~~ — RESOLVIDO no mesmo dia

**Era:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PROJECT_ID` apontavam para
`sbnlovigyifvrkgsoalj` — um ref que **não existe na organização** (provável resíduo de
template/experimento), enquanto `SUPABASE_URL` apontava para o projeto real. Inofensivo hoje
porque o `define` do Vite e o hardcode do `client.ts` vencem, mas era uma bomba de efeito
retardado: remover o `define` faria o app trocar de banco silenciosamente.

**Correção:** todas as variáveis do `.env` alinhadas para `uwtyuwktxalnpgrcbbgk`. As chaves
seguem sendo `anon`/publishable, como manda a convenção do repo.

---

## ~~[2026-08-03] 2 testes falhando em `concorrentes-document-analysis.test.ts`~~ — RESOLVIDO em 2026-08-04

**Causa raiz:** o `Blob` do jsdom não implementa `arrayBuffer()`/`text()` — lacuna do
ambiente de teste, não do app. **Correção:** polyfill via `FileReader` em
`src/test/setup.ts`. A suíte inteira passou a sair com código zero (155/155), então
`npm run test` agora serve como verificação de CI ou hook de commit.

---

## ~~[2026-08-03] 14 erros de tipo fora do módulo de metas~~ — RESOLVIDO em 2026-08-04

**Como:** `types.ts` regenerado pelo CLI oficial autenticado (schema pós-praça), 26 casts
`as never` removidos dos hooks de metas, e os 15 erros que os tipos novos REVELARAM foram
corrigidos pela causa raiz em 9 arquivos — incluindo um bug de runtime real
(`LancamentoDialog` gravava `"movimentacao"`, valor de outro enum). `npx tsc --noEmit`
sai **zerado** no app inteiro. A entrada original segue abaixo para histórico.

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

## [2026-08-03] `npm run lint` falha no repo inteiro — 2.064 problemas

**Como apareceu:** ao validar a Fase D das metas, `npx eslint src/components/layout` acusou
2 problemas em `src/components/layout/AppLayout.tsx`, arquivo não tocado pelo módulo:

```
73:26  error    Unexpected any. Specify a different type   @typescript-eslint/no-explicit-any
97:6   warning  React Hook useEffect has a missing dependency: 'navigate'
                                                             react-hooks/exhaustive-deps
```

**Situação real:** não é um caso isolado do AppLayout. Rodando no repo inteiro:

```sh
npm run lint
# ✖ 2064 problems (1932 errors, 132 warnings)
# 381 de 720 arquivos com pelo menos um problema
```

Distribuição por regra:

| Regra | Ocorrências |
| --- | --- |
| `@typescript-eslint/no-explicit-any` | 1.728 (84%) |
| `no-useless-escape` | 119 |
| `react-hooks/exhaustive-deps` | 100 |
| `prefer-const` | 32 |
| `@typescript-eslint/ban-ts-comment` | 28 |
| `react-refresh/only-export-components` | 27 |
| demais | ~30 |

Só 30 erros e 5 avisos são corrigíveis com `--fix`. O grosso é `any` espalhado, que exige
tipar caso a caso — e boa parte encosta no mesmo `types.ts` defasado da pendência acima.

**Decisão:** nada a corrigir agora. O registro existe para que ninguém trate um lint vermelho
como regressão de uma mudança recente: **ele já estava assim**. Os arquivos do módulo de
metas passam limpos, e é esse o critério que tem sido usado — lintar o que se toca, não o
repo.

**Efeito colateral a considerar:** o mesmo alerta das outras pendências — se entrar
verificação em CI ou hook de commit, `npm run lint` barra tudo. Ligar isso exige antes uma
limpeza grande, ou começar com a regra `no-explicit-any` rebaixada a `warn`.

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

**Fase 1 — schema + praça do colaborador.** ✅ **ENTREGUE em 2026-08-04** — migration
`20260804000001` (colunas + UNIQUE com COALESCE + CHECKs pela forma normalizada +
`normalize(NFC)` + ñ no `comercial_sem_acento`), filtro `filtrarFeriadosPorPraca` em
`src/lib/metas/praca.ts` (14 testes, paridade TS↔SQL), praça no diálogo de
`EquipeColaboradores.tsx` e contador de feriados visível no painel (ressalva 3).
Feriados estaduais/municipais entram por SQL até a Fase 2.

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
