# Prontuário integrado — roteiro (definido em 2026-08-14)

Visão do product owner, analisada e faseada: **o prontuário do processo
(`/processo/:id`) é a sala de operação completa** — o edital entra bruto numa
ponta e sai, na outra, proposta precificada + habilitação montada, sem o
usuário deixar o processo.

## Pipeline alvo

```
EDITAL (PNCP/portal)
   │  preparação automática (existe)
   ├─→ ITENS do TR ──→ PRECIFICAÇÃO (aba, in-context) ──→ PROPOSTA COMERCIAL (aba)
   │                                                       └─ planilha herda os itens precificados
   └─→ AURÉLIA lê o edital
          └─→ CHECKLIST de habilitação (entidade, por tipo — nunca por nome de arquivo)
                 ├─ casa com o cofre da EMPRESA (Jurídico/Documentos)
                 ├─ 4 estados: OK · vence-antes-da-sessão · faltante · a conferir
                 ├─ aceite humano → trilha de auditoria (atividades_colaborador)
                 ├─ alertas multicanal ancorados no encerramento (máquina dos Compromissos)
                 └─→ EXPORTAR ZIP na ordem exigida pelo edital
```

## Fases

### Fase 1 — Coerência (FEITA em 2026-08-14)
- "Edital em tela" saiu da Visão Geral e mora em **Anexos → pasta Edital**
  (`AnexosManager` ganhou o slot `editalViewer`); acabou o "0 arquivos" na
  pasta com o edital renderizando em outra aba.
- Visão Geral = ficha: dados + espelho PNCP + preparação automática.
- Atalhos de módulos só na aba Módulos (dedup já feita).

### Fase 2 — In-context (uma sessão dedicada)
- Abas Precificação e Proposta **operando dentro** do prontuário (hoje a aba
  Precificação é histórico; o trabalho real expulsa para os módulos globais).
- Os itens extraídos pela preparação fluem para a planilha da proposta sem
  sair da página. Peças existentes: extração automática (processo-auto-prepare),
  catálogo por licitação, rascunhos por licitação, wizard da proposta.

### Fase 3 — Habilitação inteligente (o projeto grande)
Pré-requisito: migrar as tabelas-satélite (`processo_anexos`,
`processo_documentos`, `rascunhos`, `licitacao_itens`…) para escopo de
EMPRESA, com auditoria de RLS — o cofre de habilitação é patrimônio da
empresa (pendência nº 10 do backlog).

1. **Taxonomia** de documentos de habilitação (CND Federal/Estadual/Municipal,
   FGTS, Trabalhista, Falência, Contrato Social, Balanço, Atestados…) — mesma
   filosofia do vocabulário único de status.
2. Tabela `processo_habilitacao_checklist`: exigência do edital → tipo →
   referência (ex.: item 9.1.2) → status (4 estados) → documento casado.
3. Aurélia extrai as exigências → grava o checklist como "a conferir".
4. Casamento por tipo com o cofre da empresa; validade da certidão comparada
   com a DATA DA SESSÃO (presente-porém-vencido = faltante na prática).
5. Aceite humano do checklist (um clique, registrado na trilha).
6. Alertas de habilitação incompleta na máquina multicanal dos Compromissos.
7. Exportar ZIP na ordem/numeração do edital.

## Princípios herdados (CLAUDE.md)
Vocabulário único · escopo por empresa · falha visível com retry · IA propõe,
humano confirma · uma função, um lugar.
