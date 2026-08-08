# Épico — Motor de Precificação Tributária

> Documento de decisão. Aberto em 2026-08-08 a partir da análise de viabilidade da spec
> `comando-motor-precificacao-tributaria-praefectus.md`. Registra o que foi decidido, o que
> foi verificado e o que ainda depende do banco. Atualizar aqui quando uma fase fechar.

## 1. Origem e veredito da spec original

A spec propunha 6 fases greenfield: criar `fin_faturamento_mensal`, `fin_regime_tributario`,
`fin_lancamentos`, `fin_tributacao_produto`, `prc_memoria_calculo`, `fin_parametros_precificacao`;
escrever um motor puro em `src/lib/precificacao/`; montar uma tela de regime tributário com grade
de 12 competências; e automatizar faturamento via NF-e.

**Foi julgada inviável como escrita.** Ela foi redigida sem conhecer o repositório — o que a
própria spec proíbe ("antes de codificar, o agente deve explorar o repositório"). Duas razões
independentes:

1. **Engenharia.** ~70–80% do que ela pede como novo já existe. `fin_lancamentos` **já é uma
   tabela** — com a convenção obrigatória `CREATE TABLE IF NOT EXISTS`, a migration rodaria sem
   erro e não criaria nada, e o motor novo leria uma tabela legada vazia. Falha silenciosa.
2. **Domínio.** As fórmulas propostas estão erradas para venda a órgão público: divisor trata
   todo tributo como "por dentro" (IPI e ICMS-ST são por fora), Lucro Real sem créditos de
   PIS/COFINS, ISS ausente, retenções da IN RFB 1234 e os 11% do INSS ausentes, CPP do Anexo IV
   fora do DAS não modelada, DIFAL ausente, vedação da Súmula TCU 254 ausente.

**O épico foi reescrito de construção para consolidação + correção de domínio.**

## 2. Estado verificado do que já existe

| A spec pede | O repo tem | Cobertura |
| --- | --- | --- |
| `fin_faturamento_mensal` | `faturamento_mensal` — `UNIQUE(empresa_id, ano_mes)`, RLS por `is_empresa_member` | total |
| `fin_regime_tributario` | `financeiro_config_tributaria` | total |
| `fin_tributacao_produto` | colunas fiscais em `produtos` (ncm, cest, cfop, csosn, cst_*, p_*, FCI) | ~70% |
| `prc_memoria_calculo` | `composicoes_custo.dados_json` — mutável, `user_id`, **sem nenhum escritor** | parcial |
| Motor puro | `src/lib/financeiro/simples-nacional-2026.ts` (Anexos I–V, Presumido, Real) | total |
| Markup divisor | `src/lib/composicao-engine.ts` | total |
| Tela de 12 competências | `ApuracaoRegimeTributario.tsx`, montada em Configurações | total |
| — | `financeiro_apuracoes` (a spec nem menciona) | existe |

Consultas rodadas em produção (`uwtyuwktxalnpgrcbbgk`) em 2026-08-08:
`fin_lancamentos` = 0 · `financeiro_config_tributaria` = 0 · `financeiro_apuracoes` = 0.
A cadeia tributária inteira nunca operou. **Reforma livre, sem dados a migrar.**

Nota de causalidade: os dois últimos zeros são **independentes**. A config não podia ser gravada
(overflow, §5.1); a apuração era executável mesmo assim, porque `salvarApuracao` usa o
`DEFAULT_CONFIG` em memória quando a linha não existe (`useApuracaoTributaria.ts:96`). A apuração
simplesmente nunca foi usada.

## 3. Decisões

### 3.1 Convenção de percentual — aprovada em 2026-08-08

**Alíquota legal transcrita = percentual 0–100. Razão derivada = fração 0–1.** Fronteira e
regras de sustentação escritas no `CLAUDE.md`, seção *Percentuais*.

Basis points foram **eliminados por incorreção**, não por preferência: `AlEf = Alíq − PD/RBT12`
é genericamente dízima (Anexo I, RBT12 = R$ 517.000 → 6,81915…%), e o sistema já grava
`aliquota_efetiva_simples numeric(7,4)` — resolução 100× mais fina que 1 bp.

Fração é objetivamente melhor **nas fórmulas** (zero conversões contra 51 divisões por 100), e
perdeu por dois motivos de custo, não de elegância:

1. **Transcrição vs derivação.** ~540 alíquotas do sistema são copiadas de tabelas legais
   impressas em percentual. Convertê-las são 540 chances de errar um zero, e custo permanente em
   toda atualização legal — não verificável por teste, porque o teste seria transcrito da mesma
   tabela com o mesmo erro.
2. **Dados de produção desconhecidos** em ~31 colunas percent-shaped fora do par vazio.

Descartado um terceiro argumento que apareceu na investigação ("fração desperdiça casas em
`numeric(5,4)`"): escala decimal é parâmetro livre e as colunas mudam de tipo de qualquer jeito.

**O precedente do repo apontava para o outro lado** e isso foi resolvido, não ignorado:
`comercial_metas_config.tx_ganho_padrao numeric(5,4) DEFAULT 0.2000 CHECK (> 0 AND <= 1)` é
fração com CHECK, e é o trabalho de schema mais recente do repo. Ele fica como está — é razão
derivada. Não há duas convenções para o mesmo conceito; há duas para conceitos diferentes.

### 3.2 Nomes finais

Não criar nada com prefixo `fin_`. Verdade fiscal compartilhada → `financeiro_*`.
Artefato de precificação → `precificacao_*`.

| Necessidade | Ação | Nome |
| --- | --- | --- |
| Config de regime | REUSAR | `financeiro_config_tributaria` + `ALTER TYPE` das 9 alíquotas |
| Grade de 12 competências | REUSAR | `faturamento_mensal` |
| Apuração mensal | REUSAR | `financeiro_apuracoes` |
| Razão financeiro | JÁ É | `financeiro_lancamentos` |
| Perfil fiscal do produto | ESTENDER | `produtos` + `cst_ipi, p_ipi, p_icms_st, mva, p_red_bc, monofasico, cod_servico_lc116, p_iss` |
| Produto × UF × vigência | CRIAR | `produto_tributacao_uf` |
| Parâmetros de precificação | CRIAR | `precificacao_parametros` |
| Memória imutável | CRIAR | `precificacao_memoria_calculo`, com `parametros_snapshot jsonb` |

Rejeitados: `prc_*` (críptico); `financeiro_parametros_precificacao` (dono errado);
`precificacao_snapshot` (mesma entidade da memória — vira coluna).

**`fin_lancamentos`: manter e marcar como legado.** DROP e RENAME foram descartados.
O DROP obrigaria a `DROP VIEW vw_fin_saldo_contas` e a mexer em `fin_notas_fiscais`, que é viva.
O RENAME libera o nome num repo que o Lovable também edita. A única referência de `from()` é
`alerta-vencimento-financeiro`, que aponta para a tabela errada — mas consertá-lo **não é de
graça**: ele também filtra `data_competencia` onde o vencimento é `data_vencimento`, exclui
`em_atraso`, e o insert em `notificacoes` não tem idempotência (uma primeira execução realmente
corrigida dispararia notificação + e-mail + WhatsApp para todo membro de toda empresa em cada
lançamento nas 3 datas-alvo). É fase própria, com backfill controlado. O DROP espera por ela.

**`precificacao` (singular): dropar.** Legado morto com zero `from()` no repo, mas visível e
atraente no `types.ts` — é convite para o Lovable escrever nela. Pendente das consultas de
dependência e do `count(*)` em produção.

### 3.3 Ordem de execução — aprovada

1. **Fase 0 — Higiene** ✅ 2026-08-08: gatilho de deploy manual + CI, registro da 20260425194132,
   correção do ref de projeto no `SQL_MIGRATIONS.md`, obsolescência do `01-ARQUITETURA.md`,
   convenção no `CLAUDE.md`, DROP da tabela `precificacao` (singular).
2. **Fase 1 — Caracterização** (§6): 8 arquivos de teste, nenhum motor tocado até os 8 verdes.
   Arquivo 1 ✅ 2026-08-08 (`5a9734f2`).
3. **Correção do Anexo III** ✅ 2026-08-08 (`e7405d2f`), logo após o arquivo de teste nº 1.
4. **Correção da CalculadoraUnificada** (§5.3) — próximo item de valor.
5. **Consolidação**: fonte canônica de regime, uma tabela do Anexo I, os 3 RBT12 divergentes,
   `ALTER TYPE` do `numeric(5,4)`, alinhar `enviarParaProposta` ao divisor.
6. **Ligação**: precificação lê RBT12 real; enriquecer `EditalItem`/carrinho; fechar os 10
   produtores num ponto.
7. **Domínio**: pipeline em camadas por tributo (base própria, por dentro/por fora, crédito,
   retenção fora do markup), ISS por município, DIFAL, ST com MVA ajustada, Fator R, Anexo IV
   com CPP, flag TCU 254.
8. **Imutabilidade**: `precificacao_parametros` versionada, entidade `propostas`, snapshot.
9. **NF-e**: épico separado (webhook inalcançável, RLS por usuário, token por empresa descartado,
   dois inserts quebrados).

**Regra dura para a fase 6:** ligar a precificação à `financeiro_config_tributaria` é **commit
isolado, com diff de preço antes/depois medido**. Nunca efeito colateral de consolidação.

## 4. Escopo — o que o épico não resolve

Lacunas de domínio levantadas na análise e **fora** das fases 1–6, para não gerar expectativa:
retenções na fonte (IN RFB 1234 e INSS 11%) e a distinção antecipação-vs-custo; CPRB e a
transição da Lei 14.973/2024; planilha de custos da IN SEGES 5/2017; PMVG/CMED; regime de caixa
no Presumido; CBS/IBS e o split payment de aquisições governamentais da LC 214/2025. Entram na
fase 7 ou em épico próprio.

## 5. Defeitos nomeados

### 5.1 `numeric(5,4)` com DEFAULT percentual — DEFEITO CONHECIDO, bloqueia a config

`financeiro_config_tributaria` tem 9 colunas `numeric(5,4)` (máx. 9,9999) e DEFAULTs percentuais:
`aliquota_irpj 15.00`, `adicional_irpj 10.00`, `aliquota_icms 18.00`
(`supabase/migrations/20260425194132_…sql:19,20,24`). O DDL passa; nenhum INSERT funciona — nem
um que **omita** as colunas, porque o DEFAULT é avaliado no insert. `useApuracaoTributaria.ts:116`
piora: `merged = { ...config, ...novo }` embarca os três valores em toda gravação, então editar
qualquer campo estoura.

Segundo modo de falha a separar nos testes: a policy de escrita é `FOR ALL USING
(is_empresa_admin(...))`, então membro comum falha por RLS (42501) com a mesma toast genérica do
overflow (22003). Descartado por verificação: não há problema de `onConflict` — `empresa_id` é PK.

**Correção:** `ALTER TYPE` para `numeric(7,4)` + `CHECK (0..100)`, na fase 5, em bloco próprio.

### 5.2 Anexo III somava 102% — CORRIGIDO em 2026-08-08 (`e7405d2f`)

`src/data/simples-nacional-anexos.ts`, faixas 1–5 do Anexo III: `IRPJ: 6.00`, e a partilha soma
**102,00**. Com 4,00 (Resolução CGSN 140/2018) soma exatamente 100,00 — e os outros 25 pares
anexo/faixa do arquivo já somam 100,00.

Não fica no papel: `composicao-engine.ts` importa `getPartilhaSimplesReal` e soma as alíquotas no
divisor (`:268`), então toda proposta de serviço no Simples sai com ~0,4% de sobrepreço — mais que
a margem de disputa num pregão eletrônico.

**Diferença medida no próprio motor** (custo R$ 1.000.000, margem 10, frete 2, desp. adm 5):

| Cenário | Preço antes | Preço depois | Δ |
| --- | --- | --- | --- |
| RBT12 300k (faixa 2) | 1.337.640 | 1.334.760 | −R$ 2.880 (−0,215%) |
| RBT12 1M (faixa 4) | 1.422.170 | 1.417.150 | −R$ 5.020 (−0,353%) |
| RBT12 3M (faixa 5) | 1.518.560 | 1.510.850 | −R$ 7.710 (−0,508%) |

O teste do commit anterior guardou a mudança: com a fonte corrigida e a lista de divergências
ainda cheia, 11 casos ficaram vermelhos — poder de detecção provado antes de esvaziar a lista.

Corroboração independente: a fixture legal, transcrita sem olhar o código, bateu com o repositório
em 29 das 30 linhas na primeira execução, divergindo só nesta célula. Ainda assim, **conferência
humana no texto publicado da Resolução continua recomendada** — duas transcrições concordando
reduzem a chance de erro, não a eliminam.

### 5.3 CalculadoraUnificada forma preço sem nenhum tributo — DEFEITO CONHECIDO

`CalculadoraUnificada.tsx:529` (`enviarParaProposta`) e `:548` (`salvarNoCatalogo`) calculam
`custo * (1 + margem/100)` e nada mais. A análise tributária que a tela exibe é sobre receita e
está desconectada do preço — mas `:561` grava `tributos_total` ao lado de um preço que não os
contém, em `catalogo_itens_precificados`, e o mesmo preço vai para o carrinho da Proposta.
Subprecificação sistemática no caminho que chega ao cliente.

Correlato: o repo tem **duas convenções de markup contraditórias**. Divisor "por dentro" em
`composicao-engine.ts:275/:499`, `mdo-engine.ts:315`, `FinCalculadoraMargem.tsx:120`,
`ServicoEngenhariaCalculadora.tsx:181`. Multiplicador "por fora" em `CalculadoraUnificada.tsx:529/:548`,
`ComposicaoCustoIA.tsx:210`, `ContratoArquivos.tsx:1029`. Para margem 15%, uma dá 1,1765× e a
outra 1,15× — 2,3% de diferença a partir do mesmo campo `margem_lucro`.

### 5.4 DAS calculado com alíquota não arredondada — DEFEITO CONHECIDO

`calcularSimples` (`simples-nacional-2026.ts:96-110`) calcula `valor` com a AlEf **não
arredondada** e devolve `aliquotaEfetiva: round4(aliqEfetiva)`. Com RBT12 = 2.750.000,
receitaMes = 229.166,67, Anexo I: devolve `11,1255` e `25.495,83`; recompor o DAS a partir da
alíquota devolvida dá `25.495,94` — **R$ 0,11**. E `financeiro_apuracoes` persiste os dois campos,
então a linha gravada fica internamente inconsistente e quem ler a alíquota gravada não reproduz
o DAS gravado.

Consequência para a Fase 1: a propriedade `valorDevido === round2(receitaMes * aliquotaEfetiva/100)`
**nasce vermelha**. Tem de ser fixada como divergência conhecida, com os números acima.

### 5.5 Anexo IV injeta 20 pontos fixos de CPP no divisor — DEFEITO SUSPEITO

`simples-nacional-anexos.ts:273-279` empilha `CPP (INSS separado)` com 20 pontos percentuais fixos
na mesma soma que alimenta o divisor de markup. Isso mistura pontos de **alíquota efetiva do DAS**
com uma **alíquota sobre folha**, que não têm a mesma base — a CPP do Anexo IV é ~26–28% da folha,
não 20% do preço.

A Fase 1 apenas **congela** o comportamento. Fica marcado como SUSPEITO para a fase 7 revisitar:
congelar sem marcar significa que a correção nunca acontece.

### 5.6 Outros, registrados sem fase atribuída

- **`financeiro_config_tributaria` tem exatamente um leitor** (`useApuracaoTributaria`). Os 14
  arquivos que calculam alíquota hardcodam tudo, inclusive `composicao-engine` (IRPJ 15, CSLL 9,
  COFINS 3, PIS 0,65). "Integrar a config" são 14 leitores novos — dimensionar as fases por esse
  número.
- **Quarto motor não catalogado:** o recomendador de regime em `ApuracaoRegimeTributario.tsx:146-181`
  avalia empresa de serviço com presunção de comércio (`:150`, base 8%), fixa margem de Lucro Real
  em 15%, e compara um Simples que inclui ICMS e CPP contra Presumido/Real que não incluem — a
  comparação é estruturalmente enviesada. É conselho tributário errado exibido na tela.
- **Presunções em duas convenções lado a lado:** hardcoded como fração em `CalculadoraTributaria.tsx:147`,
  `CalculadoraUnificada.tsx:420`, `ApuracaoRegimeTributario.tsx:150` e `relatorio-contabil-data.ts:182`,
  enquanto a coluna é percentual (`presuncao_irpj_comercio numeric(5,2) DEFAULT 8.00`).
- **Segunda tabela com escala mista:** `20260410214034_…sql` tem `p_pis`/`p_cofins numeric(5,4)`
  na mesma tabela em que `p_icms`, `p_icms_st`, `p_red_bc`, `p_ipi`, `p_iss` são `numeric(5,2)`.
  Hoje não estoura, mas a folga é de um dígito e não há CHECK.
- **Divergência de borda no sublimite:** na 6ª faixa do Anexo I, `simples-nacional-anexos.ts:290`
  empilha `ICMS (Sublimite)` com a alíquota interna cheia da UF, enquanto
  `SimplesNacionalCalculadora.tsx:29` tem `icms: 0`. Partilha idêntica, carga muito diferente.

## 6. Fase 1 — plano de arquivos

8 arquivos, **nenhum toca banco** — mesmo padrão do módulo de Metas. Suíte: 169 → **273** com o
arquivo 1. A estimativa original era ~45 casos para o arquivo 1; saíram 104, porque cada linha
anexo×faixa virou caso nomeado em vez de laço dentro de um `it` — o custo é ~24ms e o ganho é
saber qual linha quebrou sem abrir o teste.

Exceção deliberada à regra "nenhum motor é tocado até os 8 verdes": a correção do Anexo III (§5.2)
saiu logo após o arquivo 1, que é justamente a guarda dela. Não depende dos outros 7.

**O oráculo é uma fixture transcrita da Resolução CGSN 140/2018, conferida por humano no texto
legal. A igualdade entre cópias é corolário, nunca a fonte.** As 6 cópias do Anexo I são idênticas
valor a valor — o que significa que um teste de igualdade entre elas tem poder **zero** de detecção
para a classe de bug que o épico encontrou (o 102% do Anexo III foi achado por invariante de soma).
Se as 6 cópias carregassem o mesmo erro de transcrição, o teste ficaria verde e a consolidação
propagaria o erro com selo de aprovação. Por isso invariantes vêm primeiro.

| # | Arquivo | Cobre | ~casos |
| --- | --- | --- | --- |
| 1 ✅ | `tributario-partilha.test.ts` | Fixture legal se auto-valida (30); código vs. lei célula a célula (30); soma = 100 + desvio documentado (30); divergências toleradas e invariantes estruturais | **104** |
| 2 | `tributario-tabelas.test.ts` | As 30 faixas contra a fixture; igualdade das 6 cópias como corolário (`readFileSync` + regex, mecanismo do `metas-modalidades`); guarda estática cruzando `DEFAULT_CONFIG` com a precisão da migration | 40 |
| 3 | `simples-nacional-2026.test.ts` | 6 limites superiores e inferiores exatos, o buraco de 1 centavo, `rbt12=0`, empresa nova, `excedeuLimite` em 4.800.000,00 vs ,01 | 34 |
| 4 | `simples-nacional-anexos.test.ts` | 2º motor: `rbt12=0` → `NaN` (defeito documentado), faixa `null`, Anexo IV com `CPP (INSS separado)` | 22 |
| 5 | `simples-nacional-dois-motores.test.ts` | Paridade cruzada; domínio válido + **5 divergências de borda** nomeadas, cada uma com o valor dos dois lados e qual está certa | 18 |
| 6 | `composicao-engine.test.ts` | Divisor e clamp (`soma 99,5%` → preço = custo×100; `soma 120%` → margem positiva falsa); defaults escondidos (`rbt12=0` → fallback 180.000; `anexoId` inválido → Anexo I; lucro real → margem 15% oculta); override e `gerarAlertasItem` nas fronteiras exatas | 34 |
| 7 | `composicao-engine-roundtrip.test.ts` | Propriedades: inversa `calcularPrecoFromMargem` (quebra no lucro real, com delta fixado), identidade contábil ao centavo, monotonia e sua quebra no clamp | 14 |
| 8 | `markup-duas-convencoes.test.ts` | Divisor "por dentro" (4 sítios) vs multiplicador "por fora" (3 sítios), com o delta medido | 20 |

Verificado antes de começar: as 4 cópias in-component são parseáveis por regex sem tocar em
código; só `SimplesNacionalCalculadora.tsx` exige regex próprio (ordem de campos diferente e
separador numérico `180_000`).

## 7. Pendente

- **Aplicar a migration `20260808000001`** no SQL Editor (DROP da tabela `precificacao`) e
  **regenerar o `types.ts`** depois — enquanto não regenerar, a tabela continua aparecendo lá,
  que é justamente o motivo de ela ter sido dropada.
- Conferência humana da partilha do Anexo III no texto publicado da CGSN 140/2018.
- Se `alerta-vencimento-financeiro` está agendada por `cron.schedule` no dashboard (não há nenhuma
  nas 14 migrations que usam `cron.schedule`). Muda o impacto do bug e o custo do DROP de
  `fin_lancamentos`.
- População das ~31 colunas percent-shaped fora do par vazio — só importaria se a convenção fosse
  revista.

Resolvido em 2026-08-08: `count(*)` de `precificacao` = 0, sem FK e sem view dependente.

## 8. Higiene do `SQL_MIGRATIONS.md` — lacunas abertas

260 migrations: 235 de nome UUID (Lovable, auto-aplicadas, **não** registrar) e 25 de slug.
Registradas integralmente: 5. Parcialmente: 2. A 20260425194132 foi registrada em 2026-08-08.

Aberto, por prioridade:

- **ALTA — 5 seções do doc sem arquivo de migration nenhum:** `pedidos`/`pedido_itens`
  ([2026-07-04]), `certificados_digitais` ([2026-07-07]), vínculo NF-e↔Pedido ([2026-07-09]),
  recálculo de `saldo_atual` ([2026-07-16]), bucket `pedidos-anexos` ([2026-07-20]). Schema em
  produção sem fonte versionada — se o banco for reconstruído, some. Nada foi deletado
  (`git log --diff-filter=D` vazio): nunca existiram.
- **MÉDIA — 2 parciais**, piores que ausentes porque aparentam cobertura:
  `20260611000002_estoque_e_nfe.sql` (faltam `nfe_recebidas`, `estoque_movimentos`, 2 triggers,
  7 policies) e `20260612000002_fiscal_fields.sql` (falta o ALTER de `fornecedores`).
- **BAIXA — 18 slug-named ausentes** (`email_infra`, `add_username_login`, `create-modulo-compras`,
  `fix-contratos-rls-empresa`, `pncp_fonte_margem`, `fix_saldo_retroativo_e_trigger`, entre outras).
  Já versionadas em arquivo; o risco é de rastreabilidade, não de perda.
