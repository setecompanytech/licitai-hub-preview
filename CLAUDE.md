# Praefectus / Licitai Hub

App de gestão de licitações. Vite + React 18 + TypeScript + Tailwind + shadcn/ui, backend Supabase
(projeto `uwtyuwktxalnpgrcbbgk`), build mobile via Capacitor.

> ⚠️ Este repo **também é editado pelo Lovable**, que commita direto no `main`. O remoto muda sem
> ação local. Por isso: **sempre sincronizar antes de mexer e antes de qualquer push.**

> 🎨 **Mexendo em aparência?** O app segue o **Design System v3** (comando do dono, 19/09/2026):
> leia `docs/design-system-praefectus.md` **antes** de escolher qualquer cor, raio ou tamanho —
> ele traz os tokens, a tipografia (Inter), as anatomias (página, KPI, tabela, status, modal) e
> o roteiro por tela. `docs/rebranding-front-end.md` guarda o histórico da frente, o fluxo de
> git da branch compartilhada e a regra de que cor nunca é escrita à mão dentro de `.tsx`.

## Rotinas (slash commands em `.claude/commands/`)

| Comando | Quando usar |
| --- | --- |
| `/sync` | Antes de começar a trabalhar e antes de commitar — puxa o remoto sem sobrescrever nada |
| `/salvar` | Mudança pronta — sincroniza, registra SQL, commita com mensagem padrão e faz push |
| `/sql` | Qualquer alteração de banco — gera migration + entrada em `SQL_MIGRATIONS.md` |
| `/run-local` | Sobe o app local (Vite em http://localhost:8080) |

Fora do Claude: `npm run run-local` ou `run-local.cmd` na raiz.

> ⚠️ `npm run build` passa com **identificador inexistente** — o Vite não checa tipos, e
> `tsc -p tsconfig.json` também não (a raiz tem `"files": []`, só referências). A checagem
> que pega isso é `npx tsc --noEmit -p tsconfig.app.json`, e ela é obrigatória antes de
> commitar edição feita por script: uma substituição que não casa falha em silêncio, o
> build passa e a tela quebra em branco no navegador.
>
> ⚠️ E o tsc **não vê hook depois de return antecipado** — a tela branca de 02/09 veio
> daí, duas vezes no mesmo dia. Quem pega é `npx eslint <arquivos tocados>`
> (react-hooks/rules-of-hooks é erro). Editou componente → lint no arquivo antes do
> commit, sempre.

## Comandos

```sh
npm run run-local   # install (se preciso) + dev server na porta 8080
npm run dev         # dev server
npm run test        # vitest
npm run lint        # eslint
npm run build       # build de produção — NÃO faz checagem de tipos
npx tsc --noEmit -p tsconfig.app.json   # a checagem de tipos de verdade
npm run preview     # servir o build
```

## Convenções

**Commits** — Conventional Commits em português, imperativo, escopo = módulo real do app:

```
feat(precificacao): avaliacao por IA, filtro de margem e integracao ML
fix(auth): nao derruba sessao quando TOKEN_REFRESHED falha transitoriamente
```

**Git** — histórico linear: `git pull --rebase`. Nunca `push --force`, nunca `reset --hard` sem confirmar.

**SQL** — toda mudança de schema entra em dois lugares, com o mesmo conteúdo:
1. `supabase/migrations/<AAAAMMDD>0000NN_<slug>.sql`
2. seção nova **no fim** de `SQL_MIGRATIONS.md`

SQL sempre idempotente (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`).
Toda tabela nova: `empresa_id` + `ENABLE ROW LEVEL SECURITY` + policies com
`public.is_empresa_member(auth.uid(), empresa_id)` (delete via `is_empresa_admin`).
As migrations **não são aplicadas automaticamente** — o SQL é colado no Supabase SQL Editor.

**Percentuais** — há duas convenções no repo, e a fronteira é o *conceito*, não o módulo:

| Conceito | Convenção | Exemplos |
| --- | --- | --- |
| **Alíquota legal transcrita** — copiada de uma tabela publicada em percentual | **percentual 0–100** (`18` = 18%) | Anexos do Simples, presunções do Presumido, PIS/COFINS, ICMS, ISS, MVA, redução de base |
| **Razão derivada** — nasce de uma divisão, nunca é transcrita | **fração 0–1** (`0.18` = 18%) | `tx_ganho_padrao`, `percentualRealizado`, margem calculada |

Alíquota é transcrita por humano de um texto legal; reescrevê-la como fração é uma chance de
errar um zero a cada atualização de tabela. Razão derivada não tem essa exposição — e
`src/lib/metas/projecao.ts` já a trata como fração.

Regras que sustentam a fronteira:
- Conversão de alíquota só em `src/lib/tributario/aliquota.ts` (helper `aplicar(aliquota, base)`),
  com validação de faixa em runtime. Nenhum outro arquivo divide alíquota por 100 solto.
- `CHECK (>= 0 AND <= 100)` só nas colunas que são alíquota tributária de verdade. **Nunca por
  varredura de nome**: `aliquota_st_mva` legitimamente passa de 100 e `variacao_pct` é negativa.
- Formatador de percentual declara a convenção no nome (`formatPercentual` / `formatFracao`).
  Dois `formatPercent` com semânticas opostas foi o vetor de erro 100× que existia aqui.

**Nomes de tabela** — não criar nada com prefixo `fin_` (família legada, metade vazia). Verdade
fiscal compartilhada vai em `financeiro_*`; artefato de precificação vai em `precificacao_*`.
Não escrever na tabela `precificacao` (singular) — é legado morto, apesar de aparecer no `types.ts`.

**Versão publicada** — `src/lib/versao.ts` carrega um carimbo (`AAAA-MM-DD.N`) que
deve ser incrementado a cada leva de mudanças enviada ao Lovable.
`bash scripts/verificar-publicacao.sh` compara o carimbo do repo com o que o
domínio serve e diz se o Publish já saiu. Sem ele, só dá para conferir mudança
que cria texto novo — correção de navegação ou de parâmetro de URL não deixa
assinatura, e ficava sem verificação.

**Segredos** — `.env` é versionado neste repo, então só pode conter chaves `anon`/`publishable`.
Chave `service_role`, senha ou token de API paga nunca entram em commit.

## Princípios de arquitetura

Padrões firmados em 2026-08 (auditoria do painel → automação → prontuário). Toda mudança
nova — inclusive as commitadas pelo Lovable — deve nascer alinhada a eles:

1. **Vocabulário único de status** — `src/lib/licitacao/status.ts` é a autoridade (espelho
   Deno em `functions/_shared/licitacao-status.ts`). Nunca redeclarar listas de status em
   tela ou função: três cópias divergentes mantiveram o arquivamento automático quebrado
   por meses (`Homologada` × `Homologado`).
2. **Processo é da empresa** — consultas a `licitacoes` filtram por `empresa_id` (ou por
   `id`, deixando o RLS decidir). Nunca `eq('user_id')` em licitações — nem no front, nem
   em edge function (o `user_id !== userId → 404` barrava colegas). Pessoais de verdade:
   `processos_interesse`, `monitoramento_editais`, `editais_favoritos`, `rascunhos`.
3. **Falha silenciosa é proibida** — toda operação que pode falhar deixa rastro e oferece
   retry: lápide `em_andamento` gravada ANTES de processar (workers do sync), card de erro
   com "Tentar novamente" (espelho PNCP, viewer), mensagem real do banco no toast. Job de
   cron "succeeded" não prova entrega: `net.http_post` é assíncrono.
4. **Coordenadas PNCP via helper** — `functions/_shared/pncp-coords.ts` (URL → colunas do
   processo → número de controle). Resolver só pela URL causou o mesmo defeito três vezes.
   No front, o mesmo padrão em `ProcessoWorkspace`. Dados do espelho: cache
   (`pncp_editais_cache`) primeiro, consulta ao vivo como complemento.
5. **Rotina temporária nasce com condição de parada** — jobs de tarefa pontual são
   desligados ao concluir (a restauração do financeiro rodou 3 meses à toa; o cleanup nunca
   rodou). Cron novo usa `public.supabase_project_url()` e `public.cron_auth_header()`.
6. **Publicação é pelo Lovable** — o domínio é servido por ele; FTP/Hostgator foi
   aposentado. Edge functions: `npx supabase functions deploy <fn> --project-ref
   uwtyuwktxalnpgrcbbgk` (o CLI leva o `_shared/` junto; o dashboard não).
   **Exceção: a `feature/rebrand-ui-ux` tem publicação própria** — ver abaixo.
7. **Política de cliente não vira regra de produto** — isto é SaaS: quando uma
   prática soa como "o certo" (bônus só após a NF quitada, meta medida sobre
   faturamento, prazo de convite de 7 dias), quase sempre é a prática de UM
   assinante. Vira coluna de configuração com padrão explícito, não `IF` no
   código nem `CHECK` no banco. Sinais de que a linha foi cruzada: a regra
   chegou por um caso concreto do dono do produto; escrevê-la exige a palavra
   "sempre"; nenhuma tela permite desligá-la. Duas obrigações ao configurar:
   registro existente herda o valor que reproduz o comportamento atual (mudança
   de política é decisão de alguém, nunca efeito colateral de migration), e
   ausência de configuração não é barrada por um padrão inventado — quem ainda
   não escolheu não pode ser bloqueado pela escolha alheia.

## Robô de Lances — regras de produto do dono (17/09/2026)

Decididas pelo Rafael Castro testando o cadastro. Detalhe, arquivos e testes em
`docs/robo-de-lances.md` ("17/09, tarde"). Mudança que contrarie qualquer uma
delas precisa passar por ele:

- **Processo vencido não vira disputa de lance.** Sessão num dia anterior só é
  cadastrada como acompanhamento, com o Modo Automático desligado
  (`lib/robo/prazo-da-disputa.ts`). Sessão de hoje que já abriu só avisa: pode
  estar em andamento. A lista de processos do cadastro esconde os encerrados
  por padrão.
- **Estratégias somam.** Melhor preço, Iminência e Desempatar no 1º lugar são
  caixas: uma, duas ou as três, e ao menos uma. O robô cobre o 1º quando
  qualquer marcada autoriza. Leitura única por `estrategiasDoItem`, em três
  cópias que mudam juntas: front, `_shared/robo-estrategias.ts` e o agente.
- **Pregão remarcado não é troca de data.** Edital alterado muda itens,
  quantidades e unidades (Lei 14.133, art. 55 §1º). Nada troca só a data da
  disputa: a sessão passada leva a "Conferir alterações", o gatilho do processo
  só avisa, e o webhook tira o lance do robô quando a licitação mudou desde o
  cadastro (`_shared/robo-alteracoes-da-licitacao.ts` + espelho em `lib/robo`).
- **Sininho do robô guarda 24 horas; o histórico, 12 meses.** Aviso do robô
  (link `/robo-lances…` ou `/admin/robo-lances…`) é apagado do sininho depois
  de 24 horas, só se já estiver em `robo_historico`, a tabela da plataforma
  lida só por admin da plataforma em Admin › Configurações do Robô de Lances ›
  Histórico do robô (migration `20260917000004`). Não esconder: apagar. Não
  liberar leitura por empresa: há aviso só da equipe, com a tela remota.
- **Nome de botão é do produto, não do portal.** "Conferir alterações", não
  "Conferir no Compras.gov": a mesma tela precisa servir aos próximos portais.
- **A fase do processo é lida da operação, não do Kanban (19/09).** Sessão de
  disputa cadastrada no robô move o processo para "Em Disputa"; proposta
  registrada como enviada (aba Proposta) move para "Proposta Enviada". Só para
  a frente, nunca sobre decidido/arquivado, e sessão de acompanhamento não
  promove — a promoção carimba `data_proposta_enviada`, que as metas contam
  como participação. Regra em `lib/licitacao/promocao-de-fase.ts`; gravação por
  `useLicitacaoIntegration.promoverFase`. O espelho PNCP (Revogada/Anulada/
  Suspensa) só PEDE desfecho na agenda; nunca decide por ninguém.

## Encerramento de contrato — decisões do dono (21/09/2026)

Vigência em dia não significa obrigação em aberto: o quantitativo pode ter
sido todo fornecido antes do prazo. O fim do contrato é um FATO DECLARADO,
com motivo e data (`contratos.status = 'encerrado'` + `data_encerramento` +
`motivo_encerramento`, trilha em `contrato_encerramentos`, migration
`20260921000002`). Regras que sustentam isso — mudança que contrarie
qualquer uma passa pelo Rafael:

- **O sistema sugere, quem opera declara.** Saldo esgotado ou vigência
  vencida fazem o Resumo PERGUNTAR (aditivo ou encerramento); nunca
  encerram sozinhos. Regras puras em `lib/contratos/encerramento.ts`.
- **Vencido ≠ Encerrado.** Vencido pelo calendário sem declaração é
  "Vencido" e continua "em andamento" — pendente de aditivo de prazo ou de
  encerramento (`chaveDeExibicao` em `components/contratos/formato.ts`). A
  ATA vencida segue "Vigência encerrada" (art. 84).
- **Só as RPCs escrevem** (`encerrar_contrato`, `reabrir_contrato`). Status
  mudado por fora ganha trilha com motivo `nao_informado`, e a tela pede o
  motivo. Nunca gravar `status = 'encerrado'` direto na tela.
- **A carteira não soma encerrado nem saldo negativo.** "Saldo remanescente"
  em Gestão de Contratos exclui os dois e diz quantos ficaram de fora; a lista
  esconde encerrados por padrão (filtro "Em andamento"); "Executados acima do
  valor" cruza o saldo negativo. Saldo negativo é pendência de aditivo, não
  saldo.
- **Encerrar não apaga nem recalcula.** Pedido NOVO é barrado (aba Pedidos e
  Kanban de Compras); pedidos lançados seguem editáveis, com nota e quitação.
  Reabrir devolve tudo, e a trilha guarda os dois fatos.
- **Metas não mudam com o encerramento.** "Contratos ganhos" segue somando o
  valor global no mês da assinatura (decisão 3, 21/09).
- **Onde perguntar (decisão 4, 21/09).** A pergunta "chegou ao fim?" vive no
  Resumo do contrato, onde há contexto para decidir. O Painel geral só COBRA
  (`dashboard/ContratosAguardandoDecisao`, régua `contratosAguardandoDecisao`
  em valor e data, sem itens); a aba Pedidos só AVISA, por toast, quando o
  pedido lançado esgota o saldo — nunca uma janela que trave o lançamento,
  porque quem opera pedidos nem sempre tem alçada para encerrar.

## Nota fiscal × recebimento — regra do dono (21/09/2026)

**Valor igual não prova duplicidade.** O cliente fatura o mesmo valor em
pedidos distintos, cada um com o seu empenho/ordem e a sua NF-e (NFs 692 e
693 da ETHOS, R$ 158.000,00 cada). A identidade entre a DANFE que entra no
Gestão de Contratos e um recebimento que já está no Financeiro é o NÚMERO
da nota (ou a chave de acesso) e o número do pedido; o valor só confirma.
Régua única em `lib/financeiro/recebimento-da-nota.ts`: `certo` (mesma
chave, ou mesmo número E mesmo valor, um só) casa sem perguntar; `ambiguo`
(número sem valor, só valor, mais de um forte) não cria título e abre o
diálogo de casar; `nenhum` cria. Vale para a aba Pedidos
(`gerarLancamentosFinanceiros`) e para a Extração de Documentos
(`vincular_lancamento_a_pedido` com `p_lancamento_existente` /
`p_criar_titulo`, migration `20260921000003`). Desde 22/09 vale também
para nota de FORNECEDOR (Extração aberta de Contas a Pagar, caminho sem
contrato): nota já paga → o PDF é anexado ao pagamento existente e nenhum
título nasce; o CNPJ da outra parte só desempata, nunca decide sozinho. Apagar um título ligado a
pedido apaga o PEDIDO (gatilho `cleanup_contrato_pedido_on_lancamento_delete`):
fusão de duplicado desliga o título antes de apagar.

**Um recebimento é de um pedido OU rateado entre vários, nunca os dois
(22/09).** TED que paga várias notas (SEDUC, 27/05: R$ 1.819.739,36 pelas
NFs 725 a 730) vira RATEIO: `financeiro_lancamento_rateios`, uma linha por
recebimento × pedido × valor, gravada só pelas RPCs
`ratear_lancamento_em_pedidos` / `desfazer_rateio` (migration
`20260922000001`). Só recebimento baixado e sem pedido próprio se rateia;
pedido com título próprio não entra; a parte não passa do valor do pedido
nem a soma do valor do recebimento. A quitação do pedido enxerga os dois
caminhos no banco (`recalcular_quitacao_do_pedido`): título próprio manda
quando existe; sem título, rateio pago que cobre o valor quita. "Desfazer
quitação" recusa quitação que vem de rateio — desfaz-se o rateio, com
motivo, em Vincular lançamento (botão "Ratear" no recebimento maior que o
pedido; contas puras em `lib/contratos/rateio.ts`). Lançamento rateado não
ganha pedido próprio por nenhum caminho (gatilho).

## Custo declarado no pedido — a exceção, e o cruzamento com o Financeiro (22/09/2026, noite)

Estudo em `~/Downloads/Custo-por-Pedido-e-Conciliacao-Fracionada-2026-09-22.html`
(dono). O custo de um contrato é COMPROVADO por contas a pagar atribuídas ao
contrato e rateadas aos pedidos. O custo DECLARADO no pedido (Admin ou
Financeiro, em Pedidos › Editar: custo unitário × quantidade) é EXCEÇÃO
nomeada: gerencial, fora da DRE e do estoque, substituído pelo comprovado à
medida que os documentos chegam. Regras que valem no código (migration
`20260923000001`, lib `lib/contratos/cobertura-de-custo.ts`):

- **A compra chega ao pedido SÓ pelo rateio** (`ratear_lancamento_em_pedidos`
  aceita `a_pagar`). A coluna `financeiro_lancamentos.contrato_pedido_id` é
  do título da NF de SAÍDA: a quitação a lê como parcela do recebimento, e o
  gatilho de exclusão apaga o pedido com ela. Nunca gravar `contrato_pedido_id`
  numa conta a pagar. Quitação e limpeza filtram `a_receber`.
- **Declarado e comprovado nunca se somam em silêncio.** O custo total do
  contrato = pago + comprometido (Financeiro) + digitado + "declarado sem
  documento" (o que o declarado excede as contas a pagar do contrato), sempre
  como parcela nomeada. Na DRE do contrato e no imposto, só documento.
- **Uma régua, por pedido**, com tolerância por empresa (padrão 0,5% ou R$ 50,
  o maior; `financeiro_config_custos`): sem custo · declarado · sem declaração
  (documentado) · parcial · conferido · divergente. Mesma conta no banco
  (`situacao_do_custo`) e na lib (`situacaoDoCusto`); mudam juntas.
- **Aviso uma vez por mudança de situação**, pelo sininho (`notificacoes`):
  "sem declaração" → equipe comercial + admins; "conferido" → quem lançou
  primeiro (`custo_declarado_em` × `documento_em`); "divergente" → os dois;
  "declarado"/"parcial" vencido o prazo (15 dias da entrega) → Financeiro,
  pela rotina diária `cobrar_custos_declarados_sem_documento` (pg_cron
  `custo-declarado-cobranca`, 08:10 de Brasília).
- **A única porta de escrita da declaração é `declarar_custo_do_pedido`**
  (trilha em `contrato_pedidos_custo_log`); o resultado do cruzamento vive em
  `contrato_pedidos_custo`, ao lado do pedido, escrito só por
  `cruzar_custo_do_pedido`. A quitação da NF não tranca o custo: é custo da
  compra, não da venda. A situação do pedido também saiu da trava (decisão 15).
- **"Economia" só quando a cobertura fecha** (`textoDoDesvio`): comparar um
  custo pela metade com o previsto inteiro sempre parece economia; enquanto há
  pedido sem custo ou declarado sem documento, o painel diz "custo incompleto".
- **Rateio de indiretas só com despesa operacional** (`grupo_dre =
  desp_operacional`, mais sem grupo/sem categoria, nomeados) — CAPEX,
  financeiras e CMV sem vínculo ficam fora (migration `20260923000002`,
  `lib/financeiro/rateio-de-indiretas.ts`). **Adicional de IRPJ marginal e
  janelas iguais** em `lib/financeiro/imposto-do-contrato.ts`; ICMS pela
  alíquota EFETIVA configurada em Apuração, senão a nominal com a premissa dita.
- **Aditivo de preço não entra no rateio de valor do saldo do item**
  (migration `20260923000003`, medida antes: um único item divergia).

**Fracionado — nota e pagamento com valores diferentes não são erro (22/09):**
- A régua da nota (`lib/financeiro/recebimento-da-nota.ts`) diz a RELAÇÃO
  de cada sugestão: `igual`, `parte` (pagamento maior que a nota, com sobra
  sem nota — R$ 400 mil que quitam duas notas de R$ 200 mil) ou `parcial`
  (pagamento menor — nota paga em duas vezes), e o restante em reais. Parte
  e parcial nunca são "certo": exigem citar o número da nota, ou o mesmo
  CNPJ dentro de 90 dias da emissão (`dataEmissao`). CNPJ sozinho continua
  não sendo indício. A busca traz `coberto_por_notas` (Σ das notas já
  anexadas ao pagamento).
- N notas → 1 pagamento: `financeiro_documentos_fiscais.lancamento_id`
  (sem unicidade; a tela "anexa como parte"). 1 nota → N pagamentos:
  `financeiro_lancamentos.documento_fiscal_id` na parcela do restante, e
  `parcela_pai_id` apontando o pagamento que já entrou.
- **Baixa em partes = dividir o título** (`dividir_lancamento`, migration
  `20260923000006`): a parte fica no original, o restante nasce como parcela
  em aberto, os dois com `parcela_pai_id`. Nenhum status novo. A quitação do
  pedido continua exigindo todas as parcelas pagas. O motor
  (`reconciliation-engine`) devolve `divisoes` quando 2 a 4 movimentos do
  mesmo dia, conta e sentido somam um título em aberto — sugestão, nunca
  automática.
- Recebimento MAIOR que a nota do pedido é caso de RATEIO (22/09, manhã),
  não de parte: a tela aponta o Ratear.

## Termo aditivo item a item — preço vigente, vigência e fundamento (26/09/2026)

O 772/2024 (Barcarena, cesta básica, 18 itens num lote) tem quatro termos:
reequilíbrio de 12 itens, duas renovações de 12 meses com as quantidades
repostas aos preços reequilibrados (R$ 578.929,32 = 416.693,13 + 162.236,19,
conferido item a item) e reequilíbrio de 4 itens. O registro só tinha o
total do contrato e um par "custo atual × novo". Regras que valem no código
(migration `20260926000001`, lib `lib/contratos/itens-do-termo.ts`):

- **Uma linha física por item.** `contrato_itens.valor_unitario` é o preço
  VIGENTE; `valor_unitario_original` guarda o da contratação. As camadas por
  `origem_aditivo_id` continuam lidas, mas nenhum contrato as usa.
- **O termo diz o que faz em cada item** em `contrato_aditivo_itens`: preço
  anterior → novo, quantidade acrescida/suprimida, `origem` (leitura do anexo
  ou digitação) e o valor LIDO preservado mesmo depois de corrigido à mão. A
  tabela fica no formulário do aditivo (`ItensDoTermo.tsx`); toda célula é
  editável; os totais do termo são a SOMA das linhas, com os campos travados.
- **Aplicar é RPC** (`aplicar_itens_do_aditivo`): regrava o preço vigente, o
  gatilho de histórico escreve a trilha e o motivo ganha o número do termo;
  `reverter_itens_do_aditivo` devolve o anterior e recusa quando um termo
  posterior mexeu nos mesmos itens; apagar o termo reverte antes. Saldo do
  item = contratada + linhas exatas + rateio dos termos sem linhas − pedidos;
  saldo financeiro = saldo × preço vigente.
- **O reequilíbrio vale sobre o saldo** (Δ preço × quantidade a fornecer); a
  renovação (art. 107) repõe quantidades pelo período, com `periodo_inicio`
  e `periodo_fim`; `data_efeitos` é a vigência dos novos preços.
- **A lei fala antes de gravar** (`avisosJuridicos`): reequilíbrio não leva
  quantidade (art. 124, II, "d" × art. 124, I, "b"); efeitos mais de um mês
  antes da assinatura pedem ressalva (art. 132); reajuste antes de 12 meses
  da data-base pede ressalva (Lei 10.192/2001, art. 2º, § 1º; art. 92, V);
  renovação além do teto decenal bloqueia (art. 107); acréscimo acima de 25%
  pede ressalva (art. 125). Ressalva grava `com_ressalva`. O fundamento de
  cada tipo vai em `fundamento_legal`, pelo mapa `fundamentoDoTipo`.
- **A leitura preenche, não decide.** `extrair-contrato-pdf` devolve
  `aditivo.itens_alterados` (número do item COMO ESTÁ na tabela do termo,
  valor atual, valor novo, quantidade), `periodo_*`, `valor_periodo` e o
  fundamento citado; o casamento com o cadastro é por lote + número do item
  quando o código do item é numérico e pela descrição quando é elemento de
  despesa ("3.3.90.32.03"); linha em disputa vai para a pessoa apontar. O
  documento pode errar a própria coluna de porcentagem: o sistema calcula a
  sua e nunca copia.

## Apoio Jurídico — o caso entra primeiro, e a IA só cita o que está na base (27/09/2026)

Decisões do dono em 27/09: o módulo abre pelo **Radar**; peças judiciais
ficam, com aviso de advogado (Lei 8.906/1994, art. 1º, I); fontes "tudo que
for real, sem ilusão"; Claude com ferramentas; "revisado por" obrigatório
antes de exportar. Regras que valem no código:

- **O caso vem do sistema.** Escolher o contrato monta o dossiê
  (`lib/juridico/dossie-do-contrato.ts`: partes, valores, termos, itens,
  cláusula e data-base de reajuste, marco, aniversário, série do SGS) e ele
  vai ao prompt como "dados lidos do sistema" com a ordem de não inventar.
  O Radar (`lib/juridico/radar.ts`, `useRadarJuridico`) abre a peça certa
  com `?contrato=`; reequilíbrio NÃO reinicia o interregno do reajuste
  (lista `TIPOS_REAJUSTE`).
- **Toda afirmação leva nota de origem** (`lib/juridico/notas-de-origem.ts`):
  `[[norma:…]]`, `[[fonte:sistema|anexo|base]]`. No preview viram chips
  (`NotaDeOrigem`); no PDF/Word, parênteses. Norma fora de
  `normas-conferidas.ts` (espelho em `functions/_shared/`, teste de
  igualdade) sai como "a confirmar" — nunca como certa.
- **A base normativa é a verdade** (`base_normativa`, migration
  `20260927000002`): a edge `ingestao-normativa` lê todo dia, SEM IA, o
  Planalto artigo por artigo (`_shared/planalto-parser.ts`; revogado fora;
  redação alterada vira `base_normativa_alteracoes` + aviso aos admins), a
  API de dados abertos do TCU e a seção 1 do DOU — teto de 200 documentos
  por execução, rastro em `base_normativa_coletas`. A redação
  (`juridico-redigir`, Claude + ferramentas, SSE igual à `ai-chat`) tem
  `texto_da_norma` e `buscar_base_juridica` sobre essa base. Fonte nova
  entra pela edge com log e erro visível, nunca por raspagem com IA.
- **Citação nova → conferir contra o texto compilado do Planalto** (a base
  guarda o literal). Em 27/09 a leitura real corrigiu três sínteses da lista
  conferida (art. 25 § 7º, art. 92 § 3º e art. 166): o que a memória "sabe"
  da lei não substitui o texto lido.
- **O sininho não repete o que outra rotina já avisa**: reajuste devido é da
  `alertas-reajuste`, certidão vencendo é da `alertas-documentos`; a rotina
  `notificar_radar_juridico` (migration `20260927000001`) leva só preclusão,
  vigência, saldo negativo e recurso em prazo, sem repetir em 30 dias.

## Assinatura × Stripe — o preço se acha pelo valor e pelo ciclo (25/09/2026)

Os doze ids `price_…` gravados em `src/data/stripe-config.ts` (março, pelo
Lovable) sumiram do Stripe e o botão Assinar dizia "o plano selecionado não
existe mais". Regras que valem no código:

- **Nenhum id de preço gravado.** `create-checkout` recebe `{ plano, ciclo }`,
  lê `planos.preco_mensal` (a mesma tabela que a tela mostra) e escolhe, entre
  os preços ATIVOS da conta Stripe, o do mesmo ciclo e do mesmo valor
  (`functions/_shared/precos-stripe.ts`, testado pelo vitest em
  `src/lib/assinatura/__tests__/`). Valor diferente do site é recusado com a
  diferença dita — nunca se cobra o que a tela não mostrou. Os descontos por
  ciclo (10/15/20%) vivem em `src/data/pricing-config.ts` e no espelho
  `CICLOS` do módulo compartilhado; mudam juntos.
- **O plano de uma assinatura vem do nome do produto** (`slugDoProduto`:
  "Praefectus Profissional" → profissional; `metadata.slug` manda). O
  `product_id` gravado é só reserva. `check-subscription` devolve `plan_slug`
  e o front lê esse campo antes do id.
- **Conferir a conta é pela tela, não por fora.** Configurações › Verificação
  de Funcionalidades › "Pagamento (Stripe)" (só admin do sistema) chama
  `stripe-diagnostico`: conta, modo (produção × teste), produtos, preços e a
  tabela plano × ciclo com o que falta. A Management API mostra só o digest
  dos secrets — a chave nunca sai do Supabase, e nem deve.
- **Assinatura registrada à mão vence.** `assinaturas.data_fim` manda; vencida,
  o acesso cai para o Stripe. As quatro de 18/08 (ETHOS, Santa Rosa, Multimix,
  O S) venceram em 25/09; prorrogar é decisão do dono, por SQL.

## Portal da Transparência — a API federal por uma porta só (22/09/2026)

Mapa das 106 rotas × funções do produto em `~/Downloads/Mapa-API-Portal-
Transparencia-2026-09-22.html` (dono). Regras que valem no código:

- **Uma porta:** `functions/_shared/portal-transparencia.ts` guarda os nomes
  de parâmetro da especificação (CEIS e CNEP filtram por `codigoSancionado`;
  CEPIM e leniência por `cnpjSancionado`; o nome antigo vai junto), a
  conferência do filtro por CNPJ e a idoneidade. Testado pelo vitest em
  `src/lib/concorrentes/__tests__/portal-transparencia.test.ts` — o módulo
  não usa `Deno.*` de propósito.
- **Filtro ignorado é ERRO, nunca "encontrado".** Registro devolvido de
  outro CNPJ prova que a API não filtrou; a Idoneidade fica "inconclusiva"
  e manda conferir no portal. Cadastro sem resposta também não vira "limpo".
- **Sanção não é CADIN nem Dívida Ativa.** As edges `consulta-cadin` e
  `consulta-divida-ativa` saíram em 22/09 por dizerem o contrário. Essas
  fontes são da PGFN e do Conecta gov.br, com credenciamento.
- **Onde há API, não há raspagem:** CEIS, CNEP e CEPIM em Certidões saem
  da API, não do Firecrawl com IA. As demais certidões (Receita, FGTS, TST)
  não estão nesta API e ficam rotuladas pela fonte.
- **Janelas da API:** licitações, 1 mês por consulta (a edge varre mês a
  mês); recursos recebidos, `MM/AAAA` inicial e final obrigatórios;
  convênios com liberação, 1 dia por consulta (a edge faz uma chamada por
  dia, no máximo 10); documentos por favorecido, `fase` (1 empenho, 2
  liquidação, 3 pagamento) e `ano` obrigatórios.
- **Sob demanda, não por rotina.** "Minha empresa — federal" (a empresa
  como credora da União) e "Prospecção — federal" (convênios liberados e
  emendas pagas na UF) em Análise de mercado › Consultas só consultam ao
  clicar. Um monitor diário com aviso exige tabela e cron — decisão do dono.

## Preço de mercado — global × unitário (22/09/2026)

A aba Preços de Análise de mercado resumia o `valor_total_estimado` dos
editais e chamava de "mediana do edital": para carne moída no Pará, R$
11.941,25, quando os itens dos mesmos editais no PNCP dizem R$ 35,00 por kg
homologado. O acervo guarda o EDITAL (valor global, todos os itens); o preço
do ITEM vem dos itens do PNCP. Regras que valem no código:

- **Todo valor de mercado leva etiqueta** natureza · estágio
  (`lib/mercado/preco-observado.ts`, `EtiquetaDoValor`): "Global ·
  estimado", "Unitário · homologado", "Unitário · faturado em NF-e". Blocos de
  natureza diferente não se somam nem se comparam; o KPI unitário ancora no
  homologado (IN 65/2021, art. 5º, I), com o estimado à parte.
- **Itens do PNCP por uma porta só:** `functions/_shared/pncp-itens.ts`
  (rotas `/itens` e `/itens/{n}/resultados`, DTOs, casamento do item com o
  objeto), edge `itens-do-acervo-pncp`, cache `pncp_editais_itens`
  (migration `20260922000003`), lidos SOB DEMANDA para os editais que a
  busca devolve; lotes pequenos e espaçados (regra do portal). Os coletores
  `/contratacoes/itens?q=` e `/itensContrato?codigoItem=` do `price-search`
  respondem 404 desde 22/09 — não copiar.
- **Nome de órgão e rótulo de processo na norma da casa:**
  `lib/texto/nome-de-orgao.ts` (caixa de nome próprio, acento por dicionário,
  sigla preservada; caixa mista passa intacta) e
  `lib/licitacao/rotulo-do-processo.ts` ("Pregão Eletrônico nº 44/2025 —
  Município de Rondon do Pará"; `processoValidoParaAnalise` tira cancelado,
  anulado, revogado, suspenso, perdido, arquivado, deserto e fracassado).
- **Consulta CNPJ é UM quadro:** o espelho do comprovante, fiel ao da Receita
  (campo vazio "********", QSA com capital social por extenso e qualificação
  com código, sem faixa etária). A ficha federal só vale se for do CNPJ
  pedido (`fichaDaPessoaJuridica`).

## Precificação × Análise de mercado — uma referência de preço só (22/09/2026, tarde)

O dono pediu para tirar a duplicidade entre as abas da Precificação e a aba
Preços da Análise de mercado. O mapa que ficou:

- **Preço de referência por objeto** mora em Precificação › "Preços de
  referência" (`components/precificacao/PrecoDeReferencia.tsx`): acervo PNCP
  (global do edital) + itens do PNCP (unitário, só homologado por padrão, três
  últimos anos) + NF-e federais. A Análise de mercado não tem mais aba Preços:
  o Panorama traz o atalho, que leva o objeto e a UF (`?tab=referencias&objeto=&uf=`).
  A busca ao vivo no PNCP (`PainelPrecosGov`, todo o Brasil) fica dobrada
  embaixo, como complemento para UF que o acervo não cobre.
- **Precificação tem seis abas:** Itens do edital, Preços de referência,
  Marketplaces (varejo), Cotações, Calculadora, Catálogo. "Inteligência" virou
  o bloco "Meu catálogo × mercado" dentro de Catálogo (`InteligenciaPrecos`) e o
  "Comparativo de fontes" virou sub-aba de Cotações. "Nova precificação"
  (chat Aurélia) saiu: repetia a pesquisa de Marketplaces e, quando as fontes
  falhavam, gerava dez cotações inventadas por IA — o chat ainda existe na
  pasta do processo (`ProcessoWorkspace`), decisão do dono.
- **Uma função, um lugar.** Fonte de preço nova entra na referência, não em
  aba nova; o registro de abas é `lib/navegacao/paginas.ts`.
- **Tabela de resultado:** texto longo em célula usa `TextoRecolhido`
  (`shared/`): duas linhas e "ver mais", nunca a especificação inteira
  derrubando a coluna; número em `whitespace-nowrap tabular-nums` à direita;
  célula `align-top`. Faixa (mínimo a máximo) no KPI é texto numa linha só —
  o cartão encolhe a fonte; nunca dois `<span>` empilhados.

## Certidões — cada uma no seu órgão emissor (22/09/2026, tarde)

O dono: "quem atua dentro da administração pública busca por veracidade,
documentos probatórios reais". A aba Certidões "emitia" por raspagem com
IA, resumia por IA e misturava entes (a prefeitura de São Paulo para um
CNPJ de Belém). Regras que valem no código:

- **O Praefectus não emite, não raspa nem resume certidão por IA.** A
  certidão válida é o PDF do órgão emissor, com código de autenticidade. O
  cofre de Documentos (`lib/documentos/previstos.ts`, vagas por nome exato)
  guarda o PDF, lê a validade (`lib/documentos/validade.ts`) e avisa.
- **Catálogo único** em `data/certidoes-catalogo.ts`: para cada certidão da
  Lei 14.133 (arts. 66 a 69), quem emite, onde, como se obtém (emissão
  on-line com "sou humano" / login da empresa / solicitação ao órgão /
  documento próprio), validade usual e se terceiro consulta. Federais fixas;
  estaduais e municipais de `certidoes-estaduais-municipais.ts` (27 UFs,
  capitais); município fora do mapa vira "órgão a cadastrar" com o NOME
  dele, nunca outra cidade. Belém: solicitação por e-mail (modelo pronto).
- **O domicílio fiscal vem do cadastro do CNPJ** (BrasilAPI: UF e
  município), nunca de seleção solta; a seleção só troca o domicílio.
- **Edge `certidoes-negativas` = cadastro + sanções pela API** (CEIS, CNEP,
  CEPIM, leniência via `verificarIdoneidade`). Sem OpenAI, sem Firecrawl.
  `emitir-certidoes` (Firecrawl + IA nos sites do TST/Caixa/Receita, todos
  com verificação humana) saiu do repo em 22/09.
- Nada de rótulo técnico na tela: "APIs públicas", "Firecrawl", "IA
  (extração)", "via API" não aparecem ao usuário.

## Permissões — o que é da plataforma não aparece ao cliente (pedido do Rafael em 14/09, decidido em 19/09/2026)

O Rafael quer que parte do sistema deixe de ficar exposta às contas das
empresas que usam o plano e passe a viver só num acesso admin (mensagem de
14/09: "todos os usuários visualizam configurações que só quem desenvolve o
sistema deveria ter"). **O Grupo Santa Rosa é CNPJ do próprio Rafael**, não
cliente (Giovanny, 19/09); a BAQPLAST parece ser do mesmo grupo ("a gente
utiliza a empresa Baqplast", Rafael, 19/09 — a confirmar). A regra vale mesmo
assim: o pedido foi dele, sobre o próprio login ("não cabe ao usuário aderente
ao plano"), e o sistema é SaaS — há assinantes de fora (ex.: Voltele). **A lista completa do que esconder ainda
não existe** — confirmar com ele antes de mexer. Já há permissões no banco e
em docs do sistema: partir delas.

**Decidido em 19/09 (Ian, com o Rafael ciente):** a plataforma ganha **uma
conta de engenharia, `engsoft@praefectus.com.br`, admin da plataforma**
(`user_roles.role = 'admin'`) — a "gestão técnica do sistema" / Sys Admin
de que o Giovanny falou em 18/09. **Os dois admins coexistem** (Ian, 19/09):
a `comercial@gruposantarosa.com.br` — login do Rafael, admin da Santa Rosa e
até então o ÚNICO admin da plataforma — **mantém o papel** para a gestão do
negócio (assinaturas, marketing, métricas, o resto do grupo Admin).

**No robô, a divisão é por natureza: operação × oficina técnica** (Ian,
19/09, revendo no mesmo dia um desenho que mandava tudo ao `engsoft@`). Os
prints do Rafael (18/09) eram da aba Agente e infraestrutura: agente, RAM,
portais no ar, checklist — *"configurações internas do desenvolvedor do
sistema"*. Ele não apontou a tela remota, e é ele quem clica o captcha toda
manhã, pelo login da Santa Rosa; um segundo login para isso seria atrito
diário, e captcha perdido é disputa perdida.
- **Operação — todo admin da plataforma**, a Santa Rosa sem segunda conta:
  Sessões e tela remota, Avisos aos clientes, Histórico do robô, o toast da
  tela remota e os avisos de captcha / "assistir ao vivo" / "robô entrando".
- **Oficina técnica — só a conta de engenharia**: as abas Agente e
  infraestrutura e Diagnóstico, o cru técnico do webhook (`detalhe_tecnico`,
  nome e endereço de agente, saúde completa), configurar agente, testar o freio.

Três camadas, o mesmo corte:
- tela — `ABAS_DA_ENGENHARIA` em `AdminRoboLances.tsx`, com
  `useContaDeEngenharia`; a rota segue com o `AdminGuard`;
- banco — `sou_conta_de_engenharia()` só em agentes, registro de chamadas e
  `contas_para_plataforma` (migrations `20260919000006` + `000007`);
- servidor — `robo-lances-webhook` com duas perguntas por ação: `ehAdmin` para
  a operação, `verDetalhe` para o cru.

O gov.br do robô não muda (segue o CPF do Rafael pela Santa Rosa).
**Passos 1 e 2 feitos em 19/09** (SQL no Editor, pelo Ian): `engsoft@` criado
já confirmado, papéis `admin, user`, sem empresa, nome "Engenharia
Praefectus". A migration `20260919000002` registra só o papel.

**A conta de engenharia não cria empresa nem entra em empresa** (19/09).
Definição por fato, não por e-mail: **admin da plataforma sem empresa
nenhuma** (`lib/conta-de-engenharia.ts`, espelhada no banco em
`eh_conta_de_engenharia`). A da Santa Rosa, também admin, está na empresa e
fica de fora — é o que deixa os dois admins coexistirem sem a regra atingir o
login do Rafael. Na tela: o seletor mostra "Conta de engenharia" sem "Cadastrar
empresa", o assistente de boas-vindas não abre, `/empresas` não cadastra e
`EmpresaContext.addEmpresa` recusa (os três caminhos de criação passam por
ela). No banco, a trava de verdade: migration `20260919000003`, com gatilhos
em `empresa_membros` e `empresas` — **aplicada em 19/09** e conferida
(`eh_conta_de_engenharia`: engsoft@ `true`, comercial@gruposantarosa `false`).

A mesma mensagem pedia outra coisa, **fora do código**: passar Claude, IA,
Supabase, Lovable, GitHub e pagamentos dos e-mails da xfin e do
`praefectusbr@gmail.com` para o `engsoft@`. É do Giovanny. Trocou chave de
serviço → os secrets das edge functions (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, Z-API…) mudam **no mesmo dia**, senão a
função para calada. GitHub e Lovable mudam juntos: são o caminho do Publish.

Passos da conta de engenharia:
1. ✅ criar a conta `engsoft@` no sistema (19/09, SQL no Editor);
2. ✅ SQL idempotente dando `admin` a ela (migration `20260919000002`);
3. ✅ (local, 19/09) o admin do robô mostra a configuração de agente **de todas
   as contas**, com o dono de cada uma (`contas_para_plataforma`, migration
   `20260919000004`); para a conta de engenharia, o checklist de ativação, a
   trilha de auditoria e o tempo real — que leem a conta logada — dão lugar a
   um aviso. A trilha dos clientes NÃO foi aberta à plataforma: guarda valores
   de lance e ações de cada cliente. Esses três painéis saíram de vez;
   `AuditTrailViewer` e `DisputaRealtimePanel` ficaram sem uso no app;
4. testar os dois lados: logado como `engsoft@` (as cinco abas) e como a
   Santa Rosa (Sessões, Avisos e Histórico; captcha e tela remota sem trocar
   de conta);
5. ~~tirar o `admin` da `comercial@gruposantarosa`~~ — **não será feito**
   (Ian, 19/09: os dois admins coexistem). No lugar, **operação × oficina
   técnica** (acima):
   - **banco** — `20260919000006` **aplicada** (tudo à engenharia) e
     `20260919000007` **aplicada e conferida em 19/09** (a operação volta a
     todo admin; `pg_policies`: 4 regras de operação com `has_role`, 2 da
     oficina com `sou_conta_de_engenharia()` — agentes e registro de chamadas);
   - **tela** — local: as abas da oficina, e o toast de volta a todo admin;
   - **servidor** — **pronto local, pendente de deploy**:
     - `verDetalhe` para o cru, `ehAdmin` para a operação;
     - healthcheck: completo para a engenharia; reduzido para quem opera, com
       as sessões e os pedidos de toda empresa;
     - aviso novo "Robô entrando" a todo admin, menos a quem clicou, antes de
       acionar o robô (manual e agendador);
     - arquivos: `_shared/robo-plataforma.ts` e `_shared/robo-estado-da-sala.ts`.

O exemplo dele: **as configurações do robô não ficam no acesso das empresas.**
Como está em 19/09:
- a tela do cliente (`/robo-lances`) já perdeu as abas Agente, Portais e
  Configurações em 14/09; o que é da operação mora em Admin › Configurações do
  Robô de Lances (`/admin/robo-lances`), que só abre para o operador do SaaS;
- ao **admin da empresa** a tela do cliente ainda mostra, na `FaixaDaEmpresa`,
  o cadastro dos acessos aos portais (`CredenciaisPortalForm`) e o checklist
  de ativação (`AtivacaoChecklist modo="cliente"`). Se isso também sai do
  cliente, é decisão dele.

Em 19/09 a divisão ainda não tinha sido feita: as três levas do Giovanny desse
dia (design Fluent, dashboard, financeiro) não tocam em permissão.

As permissões são **em camadas**, e as duas de baixo já existem; o pedido novo
é sobre a de cima. A mudança se apoia nelas (não criar um quarto nível):

| Camada | Quem é | Onde se decide |
| --- | --- | --- |
| 1. Plataforma — o operador do SaaS (pedido novo) | `user_roles.role = 'admin'` → `useUserRole().isSystemAdmin` | rotas `/admin/*` (`ehRotaDoOperador` em `lib/route-permissions.ts`), `AdminGuard` na rota, RLS com `has_role(auth.uid(), 'admin')` |
| 2. Empresa — quem assina (Santa Rosa, BAQPLAST, Voltele) | `empresa_membros.papel = 'admin'` na empresa ATIVA | `ROTAS_ADMINISTRATIVAS` (empresas, equipe, configurações, integração) |
| 3. Sub-acessos da empresa, por setor — pedido do Rafael meses atrás (ex.: no escritório da Santa Rosa, separar o comercial do financeiro) | `empresa_membros.papel` (`operador`/`viewer`) + `equipe` (setor) + `permissoes` (módulos) | `ROUTE_SECTOR_MAP` via `useMembroPermissoes().canAccessRoute`; convite por setor (`create-sector-invite` → `empresa_convites.email_setor`); login de setor compartilhado com identificação individual (`ColaboradorIdentificacaoModal`, `nome_individual`/`login_individual`); tela Equipe › Permissões |

Cuidados que a divisão precisa respeitar:
- **Conta de cliente não vira admin da plataforma.** Quem tem
  `user_roles.role = 'admin'` vê o admin inteiro, menos a oficina técnica do
  robô — e inclusive a tela remota, compartilhada entre as empresas, e as
  sessões e os pedidos de código de todas elas. A ÚNICA exceção aceita é a
  `comercial@gruposantarosa`, login do dono do produto (decisão de 19/09).
  Nenhuma outra conta de empresa ganha esse papel: o acesso técnico é do
  `engsoft@`.
- Esconder menu não protege: a trava de verdade é a rota (`AdminGuard`) e o
  RLS. Tela que só some do menu continua aberta pela URL.
- **O admin da plataforma enxerga a operação, não o negócio do cliente.**
  Levantamento de 19/09 (`pg_policies` com `has_role(... 'admin')`, 46
  regras): certas as de operação (robô, logs, portais), catálogo do produto,
  negócio da Praefectus (assinaturas, leads, suporte) e LGPD. As quatro
  "dono OU admin" sobre dado de cliente (`notas_fiscais`, `nota_fiscal_itens`,
  `sub_tarefas`, `transacoes_bancarias`) foram fechadas na migration
  `20260919000005`, vazias no dia — **aplicada e conferida em 19/09**
  (nenhuma das quatro com `has_role`). Regra nova com passe do admin sobre
  dado de empresa não entra sem essa conversa.
- Não incluir conta em empresa alheia para testar: foi o que misturou Santa
  Rosa e BAQPLAST na tela em 16/09 (`docs/robo-de-lances.md`).

Abertos em 19/09, para o Rafael decidir:
- `financeiro+financeiro-01@gruposantarosa` é **admin** da Santa Rosa, e admin
  da empresa pula a trava de setor: vê comercial e robô. Deveria ser operador?
- A camada 3 **só esconde o menu**: nenhuma rota confere o setor
  (`useAuthorization().isAllowed` não tem quem chame; `/financeiro` está em
  `ProtectedPages`), e as migrations não têm RLS por setor. Confirmar pelas
  regras do banco (`pg_policies` das tabelas `financeiro_%`) antes de afirmar.
- "Configurações" e "API e integração" saem do admin da empresa?
- As contas `comercialbaqplast+com-0N@gmail.com` estão na empresa **O S
  Distribuidora**, não numa "BAQPLAST": é a mesma empresa?

## Preview do rebranding — a branch tem DOIS remotos

A `feature/rebrand-ui-ux` está no ar em **https://praefectus-preview.pages.dev**,
para o Rafael navegar e avaliar sem esperar merge. Por isso ela tem dois destinos:

| Remoto | Repositório | Serve a |
| --- | --- | --- |
| `origin` | `xfinconsultoriaempresarial-a11y/licitai-hub` | o time — é onde Ian e Caio se encontram |
| `sete` | `setecompanytech/licitai-hub-preview` | o Cloudflare Pages, que compila e publica |

O `sete` existe porque a organização principal tinha trava de permissão com a
Cloudflare. O projeto no Pages é `praefectus-preview`, ligado a esse repo, com
`npm run build` → `dist` e **`feature/rebrand-ui-ux` como branch de produção**.

```sh
git push origin feature/rebrand-ui-ux   # o time vê
git push sete   feature/rebrand-ui-ux   # o Rafael vê  ← não esqueça este
```

> ⚠️ **Esquecer o segundo push não gera erro.** O commit entra no `origin`, o time
> vê, tudo parece certo — e o Rafael continua avaliando a versão velha, sem nada
> na tela avisando. É exatamente a falha silenciosa que o princípio 3 proíbe, e o
> `/salvar` já foi ajustado para fazer os dois.

Conferir sem abrir o painel da Cloudflare — os dois hashes têm que bater:

```sh
git rev-parse --short HEAD
git ls-remote --heads sete feature/rebrand-ui-ux
```

Para provar que o ar é ESTE código, e não só que respondeu 200: os nomes dos
assets carregam hash de conteúdo, então `ls dist/assets/` depois de um
`npm run build` local dá o nome exato que o site tem que servir.

Rota profunda funciona (`/dashboard` sem 404) por causa de `public/_redirects`,
que traz `/*  /index.html  200`. Se ele sumir, o Rafael cai em 404 ao recarregar
qualquer tela — e só ele vai notar.

## Estrutura

```
src/                   app React (alias @ -> ./src)
supabase/migrations/   migrations versionadas
supabase/functions/    edge functions (Deno) — precisam de deploy separado
docs/                  notas de infra e roteiros de teste
scripts/               utilitários de edge functions
SQL_MIGRATIONS.md      log de SQL para colar no SQL Editor
```
