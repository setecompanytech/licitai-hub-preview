---
description: Rotina completa de salvar mudança — sincroniza, registra SQL, commita com mensagem amigável e envia
allowed-tools: Bash(git:*), Read, Write, Edit, Grep, Glob
---

# /salvar — fechar uma mudança

Descrição opcional do que foi feito: $ARGUMENTS

Rotina para rodar **sempre que uma mudança estiver pronta**. Execute na ordem.

## 1. Sincronizar antes

Rode a rotina do `/sync` (fetch → comparar → pull --rebase). Nunca commite sem isso —
o Lovable pode ter empurrado alterações no mesmo arquivo.

## 2. Entender o que mudou

- `git status --porcelain`
- `git diff` e `git diff --staged` nos arquivos afetados
- Se não houver nada para commitar, diga isso e pare.

## 3. SQL sempre documentado

Se o diff tocar em schema/banco (arquivos `.sql`, chamadas novas a tabelas/colunas,
`supabase/functions/**` que dependam de schema novo), **antes de commitar** rode a rotina
do `/sql`: cada mudança de banco precisa existir em **duas** formas —

- `supabase/migrations/<AAAAMMDD>0000NN_<slug>.sql` (arquivo versionado)
- uma entrada nova no fim de `SQL_MIGRATIONS.md` (bloco copiável para o SQL Editor)

Nunca commite código que dependa de coluna/tabela que não tem migration correspondente.

## 4. Conferir antes de commitar

- Nenhum segredo novo: `.env` é versionado neste repo, então só pode conter chaves
  `anon`/`publishable`. **Se aparecer `service_role`, chave de API paga ou senha, pare e avise.**
- Nenhum arquivo de lixo (`tmp/`, dumps, `.log`, artefatos de build) entrando no commit.
- Se houver dúvida sobre um arquivo grande ou inesperado no diff, pergunte antes de incluir.

## 5. Commit com mensagem amigável

Padrão do repositório — Conventional Commits em português:

```
tipo(escopo): resumo no imperativo, minúsculo, até ~72 caracteres

- detalhe relevante 1
- detalhe relevante 2

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

- `tipo`: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`
- `escopo`: módulo real do app (`precificacao`, `auth`, `financeiro`, `compras`, `proposta`, `editais`...)
- Corpo em bullets só quando houver mais de uma mudança relevante; mudança simples = uma linha só.
- Mencione no corpo quando houver **migration nova** ("requer aplicar migration X no Supabase").
- Se `$ARGUMENTS` trouxer uma descrição, use como base — mas ajuste ao padrão acima.

Comandos: `git add` dos arquivos relevantes (evite `git add -A` cego se houver ruído no status) → `git commit`.

## 6. Enviar

- `git push origin <branch-atual>`
- Se o push for rejeitado (non-fast-forward), volte ao passo 1 (`/sync`) e tente de novo. Nunca force.

## 7. Resumo final

Reporte em poucas linhas:
- hash curto + mensagem do commit
- arquivos alterados
- **se ficou SQL pendente de aplicar** no Supabase SQL Editor (projeto `uwtyuwktxalnpgrcbbgk`)
- se alguma edge function precisa de redeploy
