---
description: Sobe o projeto localmente (Vite dev server na porta 8080)
allowed-tools: PowerShell, Bash, Read, Grep, Glob
---

# /run-local — rodar o projeto na máquina

## Passos

1. Garantir dependências: se `node_modules` não existir (ou se `package.json`/lockfile
   mudaram no último `/sync`), rodar `npm install --no-audit --no-fund`.
2. Subir o dev server **em background**: `npm run dev` (equivale a `npm run run-local`).
3. Esperar o Vite anunciar o endereço e reportar ao usuário:
   **http://localhost:8080**
4. Ler a saída em busca de erro de compilação/porta ocupada:
   - porta 8080 em uso → mostrar quem está usando (`Get-NetTCPConnection -LocalPort 8080`) e
     perguntar se mata o processo ou sobe em outra porta (`npm run dev -- --port 8081`).
   - erro de módulo faltando → `npm install` e tentar de novo.
5. Deixar rodando. Para parar, o usuário fecha o processo — não derrube o servidor sozinho
   a menos que ele peça.

## Notas

- Vite serve na porta **8080** (`vite.config.ts`), não na 5173.
- As credenciais do Supabase estão embutidas via `define` no `vite.config.ts` — não é preciso
  configurar `.env` para rodar local.
- Testes: `npm run test` (vitest). Lint: `npm run lint`.
- Build de produção: `npm run build`; conferir com `npm run preview`.
