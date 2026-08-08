# Praefectus / Licitai Hub

App de gestão de licitações. Vite + React 18 + TypeScript + Tailwind + shadcn/ui, backend Supabase
(projeto `uwtyuwktxalnpgrcbbgk`), build mobile via Capacitor.

> ⚠️ Este repo **também é editado pelo Lovable**, que commita direto no `main`. O remoto muda sem
> ação local. Por isso: **sempre sincronizar antes de mexer e antes de qualquer push.**

## Rotinas (slash commands em `.claude/commands/`)

| Comando | Quando usar |
| --- | --- |
| `/sync` | Antes de começar a trabalhar e antes de commitar — puxa o remoto sem sobrescrever nada |
| `/salvar` | Mudança pronta — sincroniza, registra SQL, commita com mensagem padrão e faz push |
| `/sql` | Qualquer alteração de banco — gera migration + entrada em `SQL_MIGRATIONS.md` |
| `/run-local` | Sobe o app local (Vite em http://localhost:8080) |

Fora do Claude: `npm run run-local` ou `run-local.cmd` na raiz.

## Comandos

```sh
npm run run-local   # install (se preciso) + dev server na porta 8080
npm run dev         # dev server
npm run test        # vitest
npm run lint        # eslint
npm run build       # build de produção
npm run preview     # servir o build
```

## Convenções

**Commits** — Conventional Commits em português, imperativo, escopo = módulo real do app:

```
feat(precificacao): avaliacao por IA, filtro de margem e integracao ML
fix(auth): nao derruba sessao quando TOKEN_REFRESHED falha transitoriamente
```

**Git** — histórico linear: `git pull --rebase`. Nunca `push --force`, nunca `reset --hard` sem confirmar.

**SQL** — toda mudança de schema entra em dois lugares, com o mesmo conteúdo:
1. `supabase/migrations/<AAAAMMDD>0000NN_<slug>.sql`
2. seção nova **no fim** de `SQL_MIGRATIONS.md`

SQL sempre idempotente (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`).
Toda tabela nova: `empresa_id` + `ENABLE ROW LEVEL SECURITY` + policies com
`public.is_empresa_member(auth.uid(), empresa_id)` (delete via `is_empresa_admin`).
As migrations **não são aplicadas automaticamente** — o SQL é colado no Supabase SQL Editor.

**Percentuais** — há duas convenções no repo, e a fronteira é o *conceito*, não o módulo:

| Conceito | Convenção | Exemplos |
| --- | --- | --- |
| **Alíquota legal transcrita** — copiada de uma tabela publicada em percentual | **percentual 0–100** (`18` = 18%) | Anexos do Simples, presunções do Presumido, PIS/COFINS, ICMS, ISS, MVA, redução de base |
| **Razão derivada** — nasce de uma divisão, nunca é transcrita | **fração 0–1** (`0.18` = 18%) | `tx_ganho_padrao`, `percentualRealizado`, margem calculada |

Alíquota é transcrita por humano de um texto legal; reescrevê-la como fração é uma chance de
errar um zero a cada atualização de tabela. Razão derivada não tem essa exposição — e
`src/lib/metas/projecao.ts` já a trata como fração.

Regras que sustentam a fronteira:
- Conversão de alíquota só em `src/lib/tributario/aliquota.ts` (helper `aplicar(aliquota, base)`),
  com validação de faixa em runtime. Nenhum outro arquivo divide alíquota por 100 solto.
- `CHECK (>= 0 AND <= 100)` só nas colunas que são alíquota tributária de verdade. **Nunca por
  varredura de nome**: `aliquota_st_mva` legitimamente passa de 100 e `variacao_pct` é negativa.
- Formatador de percentual declara a convenção no nome (`formatPercentual` / `formatFracao`).
  Dois `formatPercent` com semânticas opostas foi o vetor de erro 100× que existia aqui.

**Nomes de tabela** — não criar nada com prefixo `fin_` (família legada, metade vazia). Verdade
fiscal compartilhada vai em `financeiro_*`; artefato de precificação vai em `precificacao_*`.
Não escrever na tabela `precificacao` (singular) — é legado morto, apesar de aparecer no `types.ts`.

**Segredos** — `.env` é versionado neste repo, então só pode conter chaves `anon`/`publishable`.
Chave `service_role`, senha ou token de API paga nunca entram em commit.

## Estrutura

```
src/                   app React (alias @ -> ./src)
supabase/migrations/   migrations versionadas
supabase/functions/    edge functions (Deno) — precisam de deploy separado
docs/                  notas de infra e roteiros de teste
scripts/               utilitários de edge functions
SQL_MIGRATIONS.md      log de SQL para colar no SQL Editor
```
