## Objetivo
Gerar um snapshot de backup completo do banco do projeto `sbnlovigyifvrkgsoalj` (PRAEFECTUS) e disponibilizar como arquivo para download em `/mnt/documents/`. Sem aplicar migrations ou alterar dados.

## Restrição descoberta
- O sandbox tem acesso `psql` válido (`aws-1-us-east-1.pooler.supabase.com:6543`, user `sandbox_exec.*`).
- `pg_dump` não autentica no pooler com esse usuário (erro `EAUTHQUERY`), tanto na 6543 quanto na 5432.
- Logo, faremos o snapshot manualmente via `psql` + `COPY ... TO STDOUT`, que funcionam com o usuário disponível.

## Plano de execução

1. **Inventário do banco**
   - Listar todas as tabelas em `public` (e opcionalmente `auth`, `storage` apenas como referência).
   - Listar funções, triggers, policies RLS, enums, índices, sequences, views.

2. **Exportar DDL (schema)**
   - Para cada objeto, montar SQL `CREATE` a partir de `pg_catalog` / `information_schema` / `pg_get_functiondef` / `pg_get_triggerdef` / `pg_get_viewdef` / `pg_get_indexdef`.
   - Gerar `01_schema.sql` com: extensions, enums, tables, sequences, defaults, PKs/FKs/uniques, índices, views, functions, triggers, policies RLS, grants básicos.

3. **Exportar dados**
   - Para cada tabela do `public`, gerar `data/<tabela>.csv` via `COPY (SELECT * FROM <tabela>) TO STDOUT WITH CSV HEADER`.
   - Gerar também `02_data.sql` com `COPY <tabela> FROM STDIN` apontando para os CSVs (formato restaurável).
   - Tabelas grandes (>50MB) ficam só em CSV comprimido para economizar espaço.

4. **Empacotar**
   - Comprimir tudo em `/mnt/documents/backup_sbn_YYYYMMDD_HHMM.tar.gz` contendo:
     - `01_schema.sql`
     - `02_data.sql`
     - `data/*.csv.gz`
     - `MANIFEST.txt` (lista de tabelas + contagem de linhas + tamanho + timestamp + hash SHA-256 de cada arquivo).
   - Publicar via `<presentation-artifact>` para download.

5. **Validação**
   - Conferir contagem de linhas por tabela contra o banco vivo.
   - Listar tabelas vazias e tabelas que falharam (se houver) no `MANIFEST.txt`.

## Limitações que vou comunicar no MANIFEST
- Não inclui dados de `auth.users` sensíveis (apenas schema), pois o usuário sandbox não tem permissão de leitura no schema `auth` em algumas tabelas — vou tentar e marcar o que falhar.
- Não inclui objetos do schema `storage` do Supabase (arquivos em buckets) — apenas os metadados se acessíveis. O conteúdo binário dos buckets exige API separada e não é incluso.
- Não inclui secrets, configurações de Auth, edge functions (essas vivem fora do Postgres).

## Saída final
- Arquivo único: `/mnt/documents/backup_sbn_YYYYMMDD_HHMM.tar.gz`
- Tag `<presentation-artifact>` para download direto.
- Resumo no chat com tamanho, número de tabelas e linhas exportadas.

Confirma para eu executar?