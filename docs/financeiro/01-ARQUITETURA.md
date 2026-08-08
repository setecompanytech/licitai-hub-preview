# Arquitetura — Módulo Financeiro Praefectus

> ## ⚠️ OBSOLETO — NÃO SEGUIR (marcado em 2026-08-08)
>
> Este documento é uma **spec pré-implementação** que nunca foi conciliada com o que foi
> construído. Seguir o que está aqui produz código errado. Divergências verificadas:
>
> - **RLS por `org_id`** (seções 6 e 7). `org_id` aparece **zero** vezes em `src/` e em
>   `supabase/migrations/`. A produção usa `empresa_id` + `public.is_empresa_member(auth.uid(), empresa_id)`,
>   como manda o `CLAUDE.md`. Esta é a divergência perigosa: um agente que siga o doc escreve
>   policy que não protege nada.
> - **Caminhos de arquivo** — o doc manda em `src/pages/financeiro/`, que **não existe**. Os
>   componentes vivem em `src/components/financeiro/`.
> - **`docs/financeiro/00-README.md`** indexa `02-supabase-migration.sql`, `04-ROADMAP.md` e um
>   diretório `edge-functions/` que nunca foram commitados.
>
> O que **sobrevive** e continua valendo: o módulo financeiro tem schema próprio `financeiro_*`
> (parágrafo abaixo) — é a razão de o épico tributário não criar nada com prefixo `fin_`.
>
> Fonte de verdade atual: `src/integrations/supabase/types.ts`, `supabase/migrations/` e
> `docs/epico-motor-precificacao-tributaria.md`.

## 1. Visão geral

O módulo financeiro do Praefectus é uma camada autônoma dentro da plataforma, com schema próprio (`financeiro_*`), Edge Functions dedicadas e UI organizada em sub-módulos. Foi desenhado para:

1. **Ser tenant-aware desde o primeiro dia** — todo dado pertence a um `org_id`, com RLS estrita
2. **Operar em modo offline-first** — usuário pode importar OFX manualmente sem depender de Pluggy
3. **Ser auditável** — todo lançamento tem trilha completa (quem/quando/o quê)
4. **Ser idempotente em integrações** — re-sincronizar Pluggy/OFX nunca duplica lançamentos
5. **Permitir conciliação assistida por IA** — AURÉLIA sugere matches e categorias, usuário confirma

## 2. Decisões arquiteturais críticas

### 2.1 Por que Pluggy e não Belvo/Klavi?

| Critério | Pluggy | Belvo | Klavi |
|---|---|---|---|
| Foco SaaS gestão financeira | ✅ Caso de uso explícito | ⚠️ Foco em fintechs reguladas | ⚠️ Foco em scoring/crédito |
| SDK TypeScript pronto | ✅ `pluggy-sdk` no npm | ✅ | ⚠️ Limitado |
| Free tier para dev | ✅ 15 dias trial + uso continuado | ❌ | ❌ |
| Iniciador de Pagamento (ITP) | ✅ Licenciada pelo BC | ✅ | ⚠️ Em homologação |
| Pix Automático para cobrança | ✅ Documentado | ⚠️ | ❌ |
| Conector Open Finance regulado | ✅ Outubro/2024 | ✅ | ✅ |

Conclusão: Pluggy entrega o melhor ratio capacidade/custo/velocidade para o caso de uso PME que o Praefectus atende.

### 2.2 Por que tabela única de lançamentos?

Em vez de separar `contas_pagar`, `contas_receber` e `movimentos_bancarios` em três tabelas, usamos `financeiro_lancamentos` com discriminador `tipo`. Vantagens:

- **Conciliação simplificada**: matching entre AP/AR e movimento bancário é só um JOIN na mesma tabela
- **Fluxo de caixa unificado**: query única para consolidar previsto + realizado
- **DRE consistente**: regras de classificação aplicam-se uniformemente
- **Auditoria centralizada**: histórico de mudanças vive em um só lugar

A separação visual (telas de AP, AR, banco) é feita por filtros, não por tabelas distintas.

### 2.3 Conciliação: algoritmo de scoring

O motor de conciliação não é regra rígida — atribui score de confiança (0–100) para cada par `(extrato_movimento, lancamento)` usando:

- **Match exato de valor + data ±3 dias**: +50 pontos
- **Match de descrição via fuzzy (Levenshtein normalizado)**: +25 pontos por similaridade > 0.7
- **Histórico de conciliação anterior** (mesmo descritor já conciliado com mesmo fornecedor): +20 pontos
- **CNPJ/CPF detectado no descritor batendo com cadastro**: +15 pontos
- **Categoria sugerida pela AURÉLIA com confiança alta**: +10 pontos

Score ≥ 80 = conciliação automática. 50–79 = sugestão para usuário. < 50 = não sugerido.

### 2.4 Arquitetura assíncrona via pgmq

Operações pesadas (sync Pluggy de 30 dias, processamento OCR de 50 boletos, geração de DRE) **nunca** bloqueiam a UI. Padrão:

```
[Frontend] → [Edge Function trigger] → enfileira em pgmq → [Worker pg_cron consome] → [Realtime notifica frontend]
```

Isso aproveita a infra que você já estabeleceu nos módulos PNCP e bidding system.

## 3. Modelo de dados (resumo)

```
┌─────────────────────────────────────────────────────────────────┐
│                    financeiro_lancamentos                       │
│  (tabela central — AP, AR, movimentos bancários, transferências)│
└────┬───────────────┬──────────────┬─────────────┬──────────────┘
     │               │              │             │
     ▼               ▼              ▼             ▼
┌─────────┐   ┌──────────────┐  ┌─────────┐  ┌──────────────┐
│ contas  │   │ categorias   │  │ centros │  │ fornecedores │
│bancárias│   │(plano contas)│  │ custo   │  │ /clientes    │
└─────────┘   └──────────────┘  └─────────┘  └──────────────┘
     │
     ▼
┌──────────────────┐    ┌─────────────────┐
│extratos_         │───▶│extrato_         │
│importados (OFX)  │    │movimentos       │
└──────────────────┘    └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ conciliacao     │ (link many-to-many com scoring)
                        └─────────────────┘
```

Tabelas de apoio: `documentos_fiscais` (NFs/boletos), `folha_pagamento`, `comissoes`, `regras_categorizacao`, `audit_log`, `anexos`.

Schema completo está em `02-supabase-migration.sql`.

## 4. Sub-módulos funcionais

### 4.1 Dashboard
Visão consolidada: saldos por banco, contas a vencer (7/30 dias), faturamento do mês, fluxo de caixa projetado, top 5 categorias de despesa, alertas (DDA pendentes, conciliações sugeridas).

### 4.2 Conciliação Bancária
- Importação OFX (drag-and-drop, parser client-side antes de enviar)
- Sync Pluggy (botão "Sincronizar agora" + cron diário)
- Tela de conciliação: split view (movimentos não conciliados | sugestões)
- Tratamento de tarifas/IOF/juros automáticos via `regras_categorizacao`

### 4.3 Contas a Pagar / Receber
- CRUD completo com recorrência (RRULE iCalendar)
- Anexos (boleto, NF, contrato)
- Geração de remessa CNAB 240 para pagamento em lote
- Workflow de aprovação (configurável por valor)

### 4.4 DRE
- Configuração do plano de contas mapeando para grupos DRE (Receita Bruta, Deduções, CMV, Despesas Operacionais, Resultado Financeiro, etc.)
- Geração mensal/trimestral/anual
- Comparação YoY e contra orçamento
- Export PDF/Excel

### 4.5 Fluxo de Caixa
- Visão diária/semanal/mensal
- Previsto (lançamentos com `status='previsto'`) vs Realizado
- Cenários what-if (postergar pagamentos, antecipar recebimentos)
- Gráfico de saldo projetado

### 4.6 Folha de Pagamento
- Cadastro de funcionários (CPF, salário, cargo, regime)
- Cálculo de INSS, IRRF, FGTS (tabelas 2026)
- Comissões (regras por vendedor + % sobre valor)
- Geração de holerite PDF
- Lançamento automático em Contas a Pagar

### 4.7 Captura Inteligente
- **OCR PDF**: usuário arrasta boleto/NF → Edge Function envia para serviço OCR → AURÉLIA estrutura dados → cria pré-lançamento para confirmação
- **DDA**: webhook recebe arquivo CNAB do banco → parser extrai boletos → cria lançamentos AP em status 'previsto'
- **NF-e SEFAZ**: cron consulta SEFAZ por CNPJ → notas novas viram lançamentos AP/AR

### 4.8 Relatórios Gerenciais
- Contas Gerenciais (custo por departamento, projeto, cliente)
- Análise de inadimplência
- Margem por produto/serviço
- Cohort de pagamento de clientes

## 5. Integrações externas detalhadas

### 5.1 Pluggy (Open Finance)

```typescript
// Variáveis necessárias:
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
PLUGGY_WEBHOOK_SECRET // valida assinatura
```

Fluxo de conexão:
1. Backend gera `connectToken` curto (Edge Function)
2. Frontend abre Pluggy Connect Widget (modal hospedado)
3. Usuário escolhe banco e autoriza no Open Finance regulado
4. Pluggy retorna `itemId` permanente
5. Backend salva `itemId` cifrado em `financeiro_contas.pluggy_item_id`
6. Webhook `ITEM_UPDATED` dispara sync de transações

Frequência: sync diária via cron + webhook em tempo real para movimentos críticos.

### 5.2 SEFAZ NF-e

Webservices oficiais variam por UF. Para multi-tenant, abstraímos com adapter:

```typescript
interface SefazAdapter {
  consultarNotasDestinadas(cnpj: string, ultimoNSU: number): Promise<NFe[]>
  consultarChave(chave: string): Promise<NFe>
}
```

Implementações: `SefazPAAdapter`, `SefazSPAdapter`, etc. Ou **alternativa pragmática**: usar serviço como **TecnoSpeed** ou **Plug Notas** que já abstrai todas as UFs (custo: ~R$ 0,02/consulta).

Recomendação: começar com TecnoSpeed/PlugNotas para acelerar; migrar para webservices diretos quando volume justificar.

### 5.3 DDA / Boletos

DDA chega ao banco do cliente via arquivo CNAB 240 (FEBRABAN). Duas estratégias:

**A. Pluggy webhook** — Pluggy não cobre DDA nativamente em todos os bancos.
**B. Integração direta com banco** — exige convênio, cada banco tem sua API.
**C. Cliente faz upload do CNAB** — solução universal e imediata.

Para MVP: implementar **C** (upload CNAB), evoluir para **A** quando Pluggy expandir cobertura.

### 5.4 OCR

Opções avaliadas:

| Serviço | Custo aprox. | Qualidade NFe/Boleto BR | Latência |
|---|---|---|---|
| Google Document AI | $0.50/100 págs | Alta (tem template fiscal BR) | 2–5s |
| AWS Textract | $0.15/100 págs | Média (sem template fiscal) | 1–3s |
| Azure Form Recognizer | $0.50/100 págs | Alta | 2–5s |
| Claude (vision direto) | Token-based | Muito alta com prompt bem-feito | 3–8s |

Recomendação: **Claude vision via API** integrado à AURÉLIA. Vantagens:
- Já está no stack
- Extrai *e categoriza* em uma chamada
- Lida com layouts não-padrão (carnês, recibos manuscritos)

Custo estimado: ~$0.01 por documento usando Sonnet 4.

## 6. Segurança e LGPD

### 6.1 Criptografia
- **Credenciais bancárias** (não as do Pluggy, mas legacy se houver): AES-256-GCM com chave derivada por org via HKDF
- **`pluggy_item_id`**: armazenado cifrado mesmo sendo opaco — princípio de defense in depth
- **CPFs/CNPJs em logs**: sempre mascarados (`***.***.***-12`)

### 6.2 RLS
Toda tabela `financeiro_*` tem política RLS forçando `org_id = auth.jwt() ->> 'org_id'`. Edge Functions usam `service_role` apenas em jobs de sync, e validam `org_id` explicitamente.

### 6.3 Auditoria
`financeiro_audit_log` registra:
- INSERT/UPDATE/DELETE em `lancamentos`, `contas`, `categorias`
- Login/logout de conexões Pluggy
- Imports OFX (quem, qual arquivo, hash SHA-256, quantos registros)
- Conciliações (sugestão IA vs decisão humana)

Retenção: 5 anos (alinhado com obrigação fiscal).

### 6.4 LGPD
- Consentimento explícito antes de conectar Pluggy (ele já cobre Open Finance, mas registramos a permissão no Praefectus)
- Direito ao esquecimento: rotina de anonimização que mantém integridade contábil substituindo PII por hash
- DPO contact + base legal documentada (legítimo interesse para gestão financeira do próprio cliente)

## 7. Performance

### 7.1 Índices críticos

```sql
-- queries de fluxo de caixa (mais frequente)
CREATE INDEX idx_lanc_org_data_status ON financeiro_lancamentos(org_id, data_vencimento, status);

-- conciliação
CREATE INDEX idx_lanc_org_valor_data ON financeiro_lancamentos(org_id, valor, data_vencimento) WHERE status IN ('previsto','realizado');

-- DRE (agregações por categoria/período)
CREATE INDEX idx_lanc_org_categoria_data ON financeiro_lancamentos(org_id, categoria_id, data_competencia);

-- busca textual em descrições
CREATE INDEX idx_lanc_descricao_trgm ON financeiro_lancamentos USING gin(descricao gin_trgm_ops);
```

### 7.2 Materialized views

DRE mensal e Fluxo de Caixa diário ficam em MVs refreshed via trigger ou cron, evitando agregação on-the-fly em telas de uso intenso.

### 7.3 Particionamento

`financeiro_lancamentos` particionada por `data_competencia` em ranges anuais quando passar de ~10M linhas (decisão futura, não para o MVP).

## 8. Diferenciação competitiva

Praefectus vs ConLicitação/Effecti no módulo financeiro:

1. **Concorrentes não têm financeiro** — eles são só de licitações. Praefectus + financeiro = ERP de licitações.
2. **AURÉLIA conecta dados** — ao conciliar, AURÉLIA pode dizer: "Este pagamento de R$ 42.300 corresponde ao edital 90003/2025 do IFPA Castanhal que você ganhou em fev/2026". Ninguém faz isso.
3. **DRE por edital/contrato** — receita e custo rastreados ao processo licitatório que originou. Nenhum ERP brasileiro genérico tem isso pronto.
4. **Compliance fiscal de licitações embarcado** — controle de retenções (INSS, ISS) específico de contratos públicos.

## 9. O que NÃO está neste pacote (escopo de fases futuras)

- Folha de pagamento completa (eSocial integration)
- Emissão de NFS-e (precisa adapter por município)
- Integração com SPED Fiscal/Contribuições
- Dashboard mobile nativo
- Multi-moeda (raramente relevante para PME pública)

Detalhes em `04-ROADMAP.md`.
