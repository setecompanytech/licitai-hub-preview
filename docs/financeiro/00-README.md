# Módulo Financeiro — Praefectus

Sistema completo de gestão financeira automatizada para o ecossistema Praefectus, integrado nativamente com:

- **Open Finance Brasil** (via Pluggy) — sincronização bancária regulada para 60+ instituições
- **OFX import** — fallback para bancos sem conector ou para consolidação histórica
- **SEFAZ NF-e** — consulta automática via webservices oficiais
- **DDA** (Débito Direto Autorizado) — captura de boletos via FEBRABAN CNAB
- **OCR inteligente** — extração de dados de PDFs (boletos, NFs) via AURÉLIA
- **AURÉLIA** (Claude) — categorização automática, sugestões de conciliação, análise de DRE

## Estrutura de arquivos deste pacote

| Arquivo | Destino no Lovable | Função |
|---|---|---|
| `00-README.md` | (leitura) | Este arquivo |
| `01-ARQUITETURA.md` | (leitura) | Decisões técnicas, fluxos, modelo de dados |
| `02-supabase-migration.sql` | `supabase/migrations/` | Schema completo (PostgreSQL + RLS) |
| `edge-functions/import-ofx.ts` | `supabase/functions/import-ofx/index.ts` | Parser OFX + persistência |
| `edge-functions/reconciliation-engine.ts` | `supabase/functions/reconciliation-engine/index.ts` | Motor de conciliação automática |
| `edge-functions/pluggy-sync.ts` | `supabase/functions/pluggy-sync/index.ts` | Sincronização bancária via Pluggy |
| `edge-functions/nfe-consult-sefaz.ts` | `supabase/functions/nfe-consult-sefaz/index.ts` | Consulta NF-e na SEFAZ |
| `frontend/lib/ofx-parser.ts` | `src/lib/financeiro/ofx-parser.ts` | Parser OFX client-side |
| `frontend/lib/reconciliation-matcher.ts` | `src/lib/financeiro/reconciliation-matcher.ts` | Algoritmo de matching |
| `frontend/lib/formatters.ts` | `src/lib/financeiro/formatters.ts` | Formatação BRL, datas, CPF/CNPJ |
| `frontend/components/DashboardFinanceiro.tsx` | `src/pages/financeiro/Dashboard.tsx` | Visão geral |
| `frontend/components/ConciliacaoBancaria.tsx` | `src/pages/financeiro/Conciliacao.tsx` | UI de conciliação |
| `04-ROADMAP.md` | (leitura) | Plano de implementação por sprints |

## Ordem recomendada de implementação

1. Aplicar `02-supabase-migration.sql` no Supabase
2. Configurar variáveis de ambiente (Pluggy, SEFAZ, etc.)
3. Deploy das Edge Functions (começar por `import-ofx` e `reconciliation-engine`)
4. Frontend: Dashboard → Conciliação → Contas a Pagar/Receber → DRE → Folha
5. Integrações premium (Pluggy, SEFAZ, OCR) em segunda fase

Detalhes de cada decisão estão em `01-ARQUITETURA.md`.
