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
