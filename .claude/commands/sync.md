---
description: Verifica se há mudanças novas no remoto e traz para o local sem sobrescrever nada
allowed-tools: Bash(git:*), Read, Grep, Glob
---

# /sync — puxar o remoto com segurança

Este repositório também recebe commits automáticos do **Lovable**, então o remoto muda
sem você fazer nada. Rode esta rotina **antes de começar a mexer** e **antes de qualquer push**.

## Passos

1. `git fetch origin --prune`
2. Levantar o estado:
   - `git status -sb` (working tree e ahead/behind)
   - `git log --oneline HEAD..@{u}` → commits que existem só no remoto
   - `git log --oneline @{u}..HEAD` → commits locais ainda não enviados
3. **Nada novo no remoto** → apenas informe "já atualizado" e pare.
4. **Há commits novos no remoto:**
   - Working tree limpo → `git pull --rebase origin <branch-atual>`
   - Working tree sujo → `git stash push -u -m "sync-auto"`, depois `git pull --rebase origin <branch-atual>`, depois `git stash pop`
5. **Conflito** (no rebase ou no `stash pop`): **pare imediatamente**, não tente resolver sozinho
   sem mostrar. Liste os arquivos em conflito, explique o que cada lado mudou e pergunte como seguir.
   Se precisar abortar: `git rebase --abort` (o stash continua salvo — avise que ele existe).
6. Resumo final para o usuário:
   - quantos commits vieram e o que eles tocaram (`git diff --stat ORIG_HEAD..HEAD`)
   - **destaque separado** se vieram arquivos em `supabase/migrations/`, `supabase/functions/`
     ou alterações em `SQL_MIGRATIONS.md` — nesse caso avise que há **SQL novo para aplicar
     no Supabase SQL Editor** (projeto `uwtyuwktxalnpgrcbbgk`) e/ou edge functions para redeploy.
   - se `package.json` / lockfile mudaram, avise que é preciso rodar `npm install` de novo.

## Regras

- Nunca `git push --force`, nunca `git reset --hard`, nunca descartar trabalho local sem confirmar.
- Preferir `--rebase` a merge, para manter o histórico linear como já está no repo.
- Se o branch local não for `main`, trabalhe com o branch atual e diga qual é.
