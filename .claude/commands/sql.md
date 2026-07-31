---
description: Registra uma mudança de banco como migration versionada + entrada em SQL_MIGRATIONS.md
allowed-tools: Bash(git:*), Read, Write, Edit, Grep, Glob, PowerShell
---

# /sql — registrar mudança de banco

Mudança a registrar: $ARGUMENTS

Toda alteração de schema entra em **dois lugares**, sempre com o mesmo SQL:

1. `supabase/migrations/<AAAAMMDD>0000NN_<slug>.sql` — arquivo versionado no git
2. Uma seção nova **no fim** de `SQL_MIGRATIONS.md` — bloco pronto para colar no SQL Editor

## Passos

1. Descobrir a data: `Get-Date -Format 'yyyyMMdd'` (PowerShell).
2. Nome do arquivo: `<AAAAMMDD>000001_<slug_em_snake_case>.sql`.
   Se já existir migration com a mesma data, incremente o sufixo (`000002`, `000003`, ...).
   Confira o que já existe: `Get-ChildItem supabase/migrations | Select-Object -Last 5`.
3. Escrever o SQL **idempotente** (o repo assume que pode rerodar sem quebrar):
   - `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
   - `DROP POLICY IF EXISTS "nome" ON tabela;` antes de cada `CREATE POLICY`
   - `CREATE OR REPLACE FUNCTION` para funções
4. **RLS obrigatório** em toda tabela nova:
   ```sql
   ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "<tabela>_select" ON public.<tabela>
     FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
   -- insert/update idem; delete normalmente com public.is_empresa_admin(...)
   ```
   Siga o padrão das tabelas existentes (`empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE`).
5. Anexar ao fim de `SQL_MIGRATIONS.md`:
   ```
   ---

   ## [AAAA-MM-DD] Título curto do que muda

   ```sql
   -- exatamente o mesmo SQL da migration
   ```
   ```
   Nunca reescreva entradas antigas do arquivo — só acrescente no fim.
6. Se a mudança **quebra dados existentes** (rename, drop, NOT NULL em tabela populada),
   escreva também o passo de backfill no mesmo bloco e avise explicitamente no resumo.
7. Avisar o usuário: o SQL **não é aplicado automaticamente** — precisa ser colado no
   **Supabase SQL Editor** do projeto `uwtyuwktxalnpgrcbbgk` (ver `supabase/config.toml`).

## Regras

- Nunca rodar SQL destrutivo (`DROP TABLE`, `DELETE FROM`, `TRUNCATE`) sem confirmação explícita.
- O arquivo de migration e o bloco no Markdown têm que ficar **idênticos** — se divergirem, o histórico perde valor.
