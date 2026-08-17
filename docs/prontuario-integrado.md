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

DISPUTA (Robô de Lances) ──→ desfecho ──→ Fase 4: proposta readequada,
                                          estado do processo, ata/contrato
```

## Fases

### Fase 1 — Coerência (FEITA em 2026-08-14)
- "Edital em tela" saiu da Visão Geral e mora em **Anexos → pasta Edital**
  (`AnexosManager` ganhou o slot `editalViewer`); acabou o "0 arquivos" na
  pasta com o edital renderizando em outra aba.
- Visão Geral = ficha: dados + espelho PNCP + preparação automática.
- Atalhos de módulos só na aba Módulos (dedup já feita).

### Fase 2 — In-context (FEITA em 2026-08-14)
- Aba Precificação: `ItensEditalPrecificacao` — os itens do edital ganham
  preço unitário editável ali mesmo e são salvos no catálogo
  (`catalogo_itens_precificados`, tipo_calculo='edital'); botão "Levar para a
  Proposta" troca de aba.
- Aba Proposta (nova): `PropostaTab` — a PlanilhaPrecos do wizard operando
  sobre o MESMO rascunho por licitação (editar aqui reflete no wizard), com
  "Importar itens do edital" (licitacao_itens) e Importar do Catálogo. O PDF
  final continua no wizard completo (link no cabeçalho da aba).

### Fase 3 — Habilitação inteligente (NÚCLEO FEITO em 2026-08-14)

Entregue: taxonomia (`src/lib/habilitacao/tipos.ts` + espelho Deno, com teste
de espelho), tabela `processo_habilitacao_checklist` (RLS por empresa),
edge function `habilitacao-checklist` (extração IA → classificação por tipo →
casamento com `agent_documentos` → validade × data da sessão → persistência) e
`HabilitacaoChecklist` na aba Documentos (4 estados, aceite → trilha,
"Gerar com a Aurélia" lendo o edital materializado do PNCP).

Restante da fase (3.1): alertas multicanal de habilitação incompleta na
máquina dos Compromissos; Exportar ZIP na ordem/numeração do edital; migrar
`documentos`/`processo_anexos`/`licitacao_itens` para escopo de empresa.

#### Desenho original:
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

### Fase 4 — Pós-disputa: fechar o ciclo (DESENHADA em 2026-08-16)

Hoje o prontuário leva o processo do edital bruto até a proposta e a
habilitação montadas. Vencer (ou perder) o pregão devolve o usuário ao mundo
manual: o Mural anuncia o resultado e **o processo para ali**. Esta fase faz o
desfecho continuar dentro da pasta.

```
DISPUTA encerrada (Robô de Lances)
   │
   ├─→ MURAL do processo recebe o resultado (JÁ EXISTE — licitacao_mensagens)
   │      └─ mas é só aviso: nenhuma ação sai dele
   │
   └─→ o que precisa acontecer e hoje acontece fora do sistema:
          ├─ PROPOSTA READEQUADA (valores finais + marca/modelo) → pasta Proposta
          ├─ DOSSIÊ de habilitação ao pregoeiro          → pasta Habilitação (PRONTO)
          ├─ ESTADO do processo muda (Homologada/Perdida) → Kanban, financeiro, metas
          └─ ATA / CONTRATO assinado                      → pasta Contrato
```

**Princípio da fase:** o resultado da disputa é um **fato do processo**, não uma
notificação. Ele deve mover o processo, gerar os documentos que a vitória exige
e deixar rastro — sem o usuário sair da pasta.

#### 4.1 — O Mural vira ponto de partida (menor esforço, maior ganho)

A mensagem de encerramento hoje é texto morto. Passa a carregar as ações do
desfecho, cada uma abrindo o lugar certo do próprio processo:

- venceu → **Gerar proposta readequada** · **Ver pasta de habilitação** ·
  **Mover para Homologada**
- perdeu → **Registrar motivo da perda** (reaproveita o fluxo de perda do
  Painel, que já exige motivo) · **Arquivar**

Depende de: nada além do que existe. É costura de UI sobre `licitacao_mensagens`
e a máquina de status (`src/lib/licitacao/status.ts`).

#### 4.2 — Proposta readequada (a lacuna documental)

O portal exige, do vencedor, a proposta com os **valores finais alcançados no
pregão** — item a item, com marca e modelo. É o único ponto do fluxo em que
marca/fabricante/modelo voltam a ser exigidos depois do cadastro.

Todos os insumos já existem, em lugares diferentes:

| Dado | Origem |
| --- | --- |
| Itens, quantidade, unidade | `licitacao_itens` |
| Valores FINAIS por item | `robo_lances_disputas.itens` (a disputa encerrada) |
| Marca, fabricante, modelo | `licitacao_itens` / `catalogo_itens_precificados` |
| Empresa, representante, banco | cadastro (Configurações) |

Falta o gerador que os combina. Reaproveita o motor de PDF da proposta inicial
(`PropostaDownload`, jsPDF/ABNT) — muda a fonte dos valores e o rótulo do
documento. Arquiva na **pasta Proposta** via `salvarNaPastaDoProcesso`, com o
nome distinguindo da inicial.

**Pré-requisito:** a disputa precisa estar persistida (feito em 2026-08-16,
tabela `robo_lances_disputas`) — sem valores finais gravados não há readequada.

#### 4.3 — O desfecho move o processo

Vencer deveria mudar o estado do processo, e disso decorre o resto do sistema:
Kanban, financeiro e metas leem status. Hoje o Mural anuncia e o card não anda.

- Encerramento da disputa propõe a mudança de status (nunca aplica sozinho:
  desfecho é decisão do operador — mesma disciplina do "IA propõe, gente
  confirma").
- Usa o vocabulário único de status; perda continua exigindo motivo.
- Registra na trilha (`atividades_colaborador`) quem decidiu e quando.

#### 4.4 — Ata e contrato

A pasta **Contrato** existe e está vazia. O Apoio Jurídico já arquiva aditivos e
reequilíbrios nela (mapeamento em `pastaDaPecaJuridica`). Falta a entrada do
documento original — ata de registro de preços ou contrato assinado — e o gancho
para o módulo de Contratos, que já gerencia vigência e consumo de ata.

#### Ordem sugerida

1. **4.1** — costura de UI, sem migration, devolve o fio ao usuário no dia
   seguinte à disputa;
2. **4.3** — o processo volta a andar sozinho (alimenta Kanban/financeiro/metas);
3. **4.2** — o documento que a vitória exige (maior esforço, depende de 4.3 para
   saber que houve vitória);
4. **4.4** — fecha a ponte com o módulo de Contratos.

### Fase 5 — Bonificação por atingimento de meta (DESENHADA em 2026-08-16)

Hoje a bonificação e a meta existem sem se falar. A bonificação calcula por
percentual sobre contrato, percentual sobre lucro ou valor fixo; a "regra de
variação por desconto" é um **campo de texto livre que nenhum código lê** — é
documentação, não cálculo. A meta, do outro lado, guarda `meta_faturamento`,
`meta_contratos` e `meta_participacoes`, com o realizado apurado por view
mensal, e ninguém consulta esse número na hora de bonificar.

**Alvo:** a bonificação ganha um MULTIPLICADOR POR FAIXA DE ATINGIMENTO —
abaixo de X% da meta reduz, na faixa alvo integral, acima amplia. As faixas são
parametrizadas pelo administrador junto com as metas, e o cálculo do lançamento
passa a lê-las.

```
LANÇAMENTO DE BONIFICAÇÃO
   ├─ base (contrato / lucro / valor fixo)      ← já existe
   └─ × multiplicador da faixa de atingimento   ← a construir
          ↑
      realizado ÷ meta do período (vw_comercial_realizado_mensal × comercial_metas)
```

**Decisões que dependem do product owner** (por isso a fase está desenhada e não
implementada):

1. Quais faixas e multiplicadores (ex.: <80% → 0,5×; 80–100% → 1×; >100% → 1,3×).
2. Qual meta vale como base: faturamento, contratos ganhos ou participações.
3. O que acontece quando não há meta definida no período — bonificação integral
   ou bloqueada? (Recomendação: integral, para a ausência de meta não punir
   quem vendeu.)
4. Se o multiplicador é por período fechado (mês) ou acumulado no ano.

**Pré-requisitos técnicos:** tabela de faixas por empresa; o cálculo do
lançamento passando a consultar meta e realizado do período; e a regra de
variação por desconto migrando de texto livre para parâmetro — ou sendo
explicitamente aposentada, para não haver duas regras concorrentes.

**Já feito (16/08):** definição de metas e parametrização restritas ao
administrador, com entrada própria em Administração → "Definir Metas"; o
acompanhamento (Painel e Relatórios) segue visível à equipe. Bonificações e
Painel de Metas passaram a usar a mesma base de identidade do colaborador, então
os dois lados já falam do mesmo sujeito.

## Princípios herdados (CLAUDE.md)
Vocabulário único · escopo por empresa · falha visível com retry · IA propõe,
humano confirma · uma função, um lugar.
