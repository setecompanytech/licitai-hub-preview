# Pendências conhecidas

Itens identificados durante o trabalho, deixados de fora do escopo em curso por decisão
explícita. Não são bugs novos — são coisas que já estavam no repositório ou que foram
adiadas de propósito.

---

## ~~[2026-08-09] PRIORIZADA — redefinição de senha para acesso por login~~ — RESOLVIDO no mesmo dia

**Como foi resolvido:** trocando o e-mail sintético pelo **sub-endereçamento** do e-mail do
setor. A conta de `COMERCIAL-01` passou a ser `comercial+comercial-01@gruposantarosa.com.br`
— endereço único para o Auth e, ao mesmo tempo, entregue na caixa compartilhada do setor.
A recuperação de senha voltou a funcionar sem intervenção do admin.

**Confirmado empiricamente** em 09/08/2026: mensagem enviada para
`comercial+01@gruposantarosa.com.br` chegou na **caixa de entrada** do HostGator
(cPanel/Dovecot), não numa subpasta — que era o risco real desse provedor.

**O que sobrou como salvaguarda:** `emailDaConta` cai no domínio sintético
(`@praefectus.invalid`) quando o e-mail do setor não serve de base (sem arroba, domínio sem
ponto). Nesses casos a recuperação continua indisponível, mas o cadastro não trava — 15
testes cobrem essas quedas.

**Efeito colateral inerente ao modelo, não à solução:** o e-mail de redefinição chega na
caixa do setor, então todos que a acessam veem o pedido. Isso decorre de o setor compartilhar
uma caixa, e vale para qualquer mensagem que ela receba.

Registro do problema original:

**Contexto:** com o setor usando um e-mail compartilhado, o acesso individual teria e-mail
sintético (`<login>@praefectus.invalid`). É o que torna possível vários colaboradores
no mesmo setor — mas o endereço não existe como caixa postal.

**O que quebrava:** o "Esqueceu a senha?" da tela de login enviaria para o vazio. O
colaborador não receberia nada e não teria como saber por quê.

**Solução proposta:**

1. A tela de login detecta que o identificador digitado resolve para um e-mail
   `@praefectus.invalid` e, em vez de oferecer o envio, orienta a procurar o administrador;
2. Tela do admin em Equipe & Colaboradores: **Redefinir senha** para um membro, gerando
   senha temporária com troca obrigatória no primeiro acesso. Usa
   `auth.admin.updateUserById` numa edge function com `service_role`;
3. Registrar a redefinição em `atividades_colaborador` — é ação sensível e precisa de trilha.

**Por que não entrou junto:** é feature própria, com tela e edge function novas. Misturá-la
na correção do convite aumentaria o risco de um trabalho que já mexe em autenticação em
produção. A correção do convite é útil sozinha; esta é o complemento.

**Contorno até lá:** o admin redefine a senha pelo Dashboard do Supabase, em Authentication →
Users → o usuário → *Reset password*.

---

## ~~[2026-08-08] Todo push em `main` publica em produção — com clean-slate~~ — DESATUALIZADA

**Verificado em 2026-08-09:** o gatilho virou `workflow_dispatch`. **Push em `main` não publica
mais nada** — a publicação é manual, em Actions → *Deploy Frontend via FTP* → *Run workflow*.
O comentário no próprio arquivo registra a mudança.

**O que isso inverte:** o cuidado deixou de ser "não commite sem validar" e passou a ser
**"não esqueça de publicar"**. O código pode estar em `main` e fora do ar por tempo
indeterminado — foi o que aconteceu em 09/08 com a correção do convite por setor: a edge
function foi publicada, o front não, e o fluxo ficou quebrado no intervalo entre os dois.

**Regra prática que sai daí:** quando uma mudança tem front **e** edge function, publique o
**front primeiro**. O front novo conversando com a function antiga costuma degradar; a
function nova com o front antigo rejeita a requisição inteira.

**Cache:** publicar não basta para ver. O app tem service worker; use "Limpar cache e
recarregar" na tela de login, ou `Ctrl+Shift+R`.

Registro do que valia antes:

**Fato (08/08):** `.github/workflows/deploy-hostgator.yml` rodava em `on: push: branches: [main]`,
builda e sobe o `dist/` por FTP com **`dangerous-clean-slate: true`** — o diretório remoto é
limpo antes do upload. Não existe branch de homologação nem gate manual.

**Consequências práticas, aprendidas nesta sessão:**

- **não há commit barato.** Corrigir uma vírgula custa um deploy completo. Agrupe mudanças
  pequenas e envie junto com algo que valha a publicação;
- **o que está em `main` está no ar.** Não dá para "commitar agora e validar depois" —
  validar tem de vir antes do push. No rollout da régua, os 8 lotes ficaram commitados
  localmente até a validação humana, justamente por isto;
- **`git log origin/main..HEAD`** mostra o que está retido localmente. Vale conferir antes
  de assumir que o repositório está sincronizado.

**Se um dia isso incomodar:** trocar o gatilho para `workflow_dispatch` (deploy manual) ou
exigir tag, e manter `main` como integração. Decisão de processo, não urgente.

---

## [2026-08-08] Screenshot NÃO serve de regressão visual em Licitações Estratégicas

**Fato medido:** duas capturas da MESMA tela, com o MESMO código, minutos de diferença,
divergem em **276.821 pixels (3,93%)**. A comparação antes/depois de uma mudança real de
código, na mesma tela, deu **232.309 px (3,30%)** — ou seja, **o ruído é maior que o sinal**.

**Causa:** a lista é alimentada por dados vivos do PNCP e se reordena a cada carregamento.

**Consequência prática:** qualquer critério do tipo "confira se os N registros estão
idênticos entre antes e depois" é **inverificável** nessa tela — foi proposto no rollout da
régua e teve de ser abandonado. Para essa tela, verificar por **diff de código** (ou por
teste, quando houver lógica envolvida), nunca por imagem.

**Telas com o mesmo risco** (dados externos/voláteis, a confirmar caso a caso): Monitoramento
de Editais, Boletins, Análise de Mercado, Concorrentes.

**Onde screenshot funciona bem:** telas de dados estáveis ou semeados. No mesmo rollout,
Compromissos deu 187 px de diferença e Histórico 869 px, com cada faixa de pixels casando
com uma mudança prevista — verificação mais forte que a inspeção visual. A ferramenta usada
está em `scratchpad/diff.mjs` (pixelmatch + pngjs, com `diffMask` e contagem por faixa de
100px); vale recriar num ciclo futuro que precise de regressão visual.

---

## ~~[2026-08-08] Barra de progresso das Metas ligada à severidade~~ — RESOLVIDO no mesmo dia

**Entregue:** `estadoDaBarra` em `src/lib/metas/progresso.ts` traduz a severidade que o painel
já calcula em cor e rótulo — verde com a meta batida (vence a severidade), âmbar em atenção,
vermelho em risco e crítico. 9 testes, incluindo o caso que motivou a nota: 24% e 98% no fim
do mês não podem mais ter a mesma cor.

Dois desvios do que a nota previa, ambos deliberados:

- **O `Progress` deste repo NÃO aceitava `className` no indicador** — o `bg-primary` estava
  fixo. Foi adicionada a prop opcional `indicatorClassName`, que mantém o comportamento
  anterior quando omitida, então nenhum outro uso do componente muda.
- **Cor sozinha não comunica.** Cada estado carrega um rótulo, aplicado em `aria-label`,
  `title` e num `sr-only` — sem isso a informação sumiria para quem não distingue as cores.

Registro do que era antes, para contexto histórico:

**Era:** a barra de "Progresso" do painel de Metas era laranja fixo, em qualquer situação —
exceção documentada à regra de cor, decidida em 2026-08-08 (medidor não é ação nem estado,
as duas categorias que a régua governa). O comentário está em `PainelMetas.tsx`, na própria
barra.

**Estado final desejado:** colorir a barra pela severidade que o painel **já calcula**
(`avaliarAlerta` devolve `nenhum`/`atencao`/`risco`/`critico`): verde ao atingir a meta,
âmbar/vermelho quando o mês entra em risco. Hoje o alerta e a barra contam a mesma história
com pesos visuais diferentes — a barra fica igualmente laranja com 24% ou com 98%.

**Por que não entrou na auditoria:** mudança de **comportamento**, não de cor — a barra
passaria a depender da lógica de alerta. E o módulo de Metas é o mais validado do sistema
(169 testes, motor conferido contra o calendário); mexer na semântica dele exige ciclo
próprio, com teste. Mesmo critério aplicado ao truncamento dos cards e ao AppTopNav.

**Ao implementar:** a severidade já está em `analise.severidade` no mesmo `useMemo`; o
`Progress` do shadcn aceita `className` no indicador. Cobrir com teste os quatro estados.

---

## [2026-08-08] PRIORIZADA — estratégia de espaço em 1280px (barra superior + cards)

Dois sintomas, **uma causa só**: nenhum dos dois containers tem estratégia de espaço, e ambos
contam com a quebra de texto para caber. Devem ser tratados no **mesmo ciclo de layout**.

### Sintoma A — AppTopNav quebra os rótulos no meio da palavra

Em 1280px a barra mostra "Pai-nel", "Monitora-mento", "Ges-tão", "Inteligên-cia",
"Comunica-ção", "Ferramen-tas". Causa imediata: o `overflow-wrap: anywhere` global de
`src/index.css` (normalização de quebra) atinge os itens de menu.

**Tentativa que FALHOU (2026-08-08):** impedir a quebra com
`nav a, nav button { overflow-wrap: normal; word-break: keep-all }` resolveu os rótulos e
**criou defeito pior** — sem a quebra, os itens ficam mais largos que o espaço e a barra se
sobrepõe: a wordmark PRAEFECTUS cobre "Painel" e "Ferramentas" colide com o seletor de
empresa. Revertido. **Não repetir sem antes resolver o espaço.**

### Sintoma B — títulos dos cards do Kanban truncam cedo demais

Com o corpo a 16px, o título trunca em "[PILOTO] Aquisição de material de escri…". O
`line-clamp-2` de `src/pages/KanbanPage.tsx` foi dimensionado quando o texto era 14px; a
16px cabem menos caracteres na mesma altura, e a coluna tem largura fixa.

### Diagnóstico comum e caminhos

Falta, nos dois casos: `min-width: 0` nos filhos flex (sem isso o item nunca encolhe abaixo
do conteúdo), `flex-shrink` com prioridade definida, e um **ponto de corte** que mande os
itens excedentes para o menu móvel/overflow em vez de espremer.

- **Barra:** definir o breakpoint em que a nav horizontal vira o botão de menu (hoje só
  acontece abaixo de `lg`), ou reduzir rótulos/ícones antes de quebrar.
- **Cards:** (a) `line-clamp-3` aceitando cards mais altos; (b) coluna mais larga com menos
  colunas antes da rolagem; (c) título em 14px como exceção de UI densa — contraria a régua
  e só vale se (a) e (b) forem descartadas.
  **Reforço para (a)** (conferido na aprovação do Kanban em 2026-08-08): após a régua, todo o
  texto do card já está entre 12 e 16px; o único desconforto restante é o título cortado em
  duas linhas. `line-clamp-3` resolve sem tocar em mais nada. Decisão final no ciclo.

**Por que ficou fora da régua:** o escopo acordado da auditoria é explicitamente só tipo e
cor — "nenhuma mudança de estrutura, copy ou layout".

**Evidência:** `scratchpad/shots/kanban-ANTES-*.png` e `kanban-DEPOIS-*.png` (2026-08-08); o
print da tentativa revertida mostra a sobreposição da barra.

---

## [2026-08-08] Um segundo banco com schema do Praefectus na organização

**Situação:** ao investigar por que uma semente de dados de teste "sumiu", verificou-se que
existem **dois projetos Supabase com o schema do Praefectus** na organização:

| Projeto | Ref | Papel |
| --- | --- | --- |
| New Database - Praefectus | `uwtyuwktxalnpgrcbbgk` | **o que o app usa** (produção de fato) |
| xfinconsultuoriaempresarial-a11y's Project | `pyizwczmmzavtujfbivd` | desconhecido — mas `public.licitacoes` **existe** lá |

**Por que importa:** um SQL colado na aba errada do SQL Editor executa em silêncio no banco
errado, e a conferência "passa" — foi exatamente o que aconteceu em 2026-08-08 com a semente
do piloto de UI. Sem saber que o segundo banco existe, o diagnóstico custa caro.

**A que o app está preso:** `uwtyuwktxalnpgrcbbgk` está **hardcoded** em
`src/integrations/supabase/client.ts:5` (arquivo gerado, não lê `.env`) e reforçado pelo
`define` do `vite.config.ts`. Não há banco local: `npm run dev` fala com a nuvem.

**Pendente de decisão:** descobrir o que é o `pyizwczmmzavtujfbivd` — cópia antiga, ambiente
de teste, ou projeto órfão de algum experimento. Se for lixo, apagar; se tiver uso,
documentar qual. Enquanto não se decide, **confira sempre o projeto selecionado antes de
rodar SQL**.

**Mitigação já aplicada:** os scripts de dados de teste passaram a ter *guarda de banco* —
abortam com `BANCO ERRADO` se o registro esperado não existir ali (ver `piloto-ui-seed.sql`).
Vale repetir o padrão em qualquer script futuro que dependa de dados de uma conta específica.

---

## ~~[2026-08-08] `.env` apontava as `VITE_*` para um projeto inexistente~~ — RESOLVIDO no mesmo dia

**Era:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PROJECT_ID` apontavam para
`sbnlovigyifvrkgsoalj` — um ref que **não existe na organização** (provável resíduo de
template/experimento), enquanto `SUPABASE_URL` apontava para o projeto real. Inofensivo hoje
porque o `define` do Vite e o hardcode do `client.ts` vencem, mas era uma bomba de efeito
retardado: remover o `define` faria o app trocar de banco silenciosamente.

**Correção:** todas as variáveis do `.env` alinhadas para `uwtyuwktxalnpgrcbbgk`. As chaves
seguem sendo `anon`/publishable, como manda a convenção do repo.

---

## ~~[2026-08-03] 2 testes falhando em `concorrentes-document-analysis.test.ts`~~ — RESOLVIDO em 2026-08-04

**Causa raiz:** o `Blob` do jsdom não implementa `arrayBuffer()`/`text()` — lacuna do
ambiente de teste, não do app. **Correção:** polyfill via `FileReader` em
`src/test/setup.ts`. A suíte inteira passou a sair com código zero (155/155), então
`npm run test` agora serve como verificação de CI ou hook de commit.

---

## ~~[2026-08-03] 14 erros de tipo fora do módulo de metas~~ — RESOLVIDO em 2026-08-04

**Como:** `types.ts` regenerado pelo CLI oficial autenticado (schema pós-praça), 26 casts
`as never` removidos dos hooks de metas, e os 15 erros que os tipos novos REVELARAM foram
corrigidos pela causa raiz em 9 arquivos — incluindo um bug de runtime real
(`LancamentoDialog` gravava `"movimentacao"`, valor de outro enum). `npx tsc --noEmit`
sai **zerado** no app inteiro. A entrada original segue abaixo para histórico.

## ~~[2026-08-03] 14 erros de tipo fora do módulo de metas~~ — RESOLVIDO em 2026-08-09

**Verificado em 09/08/2026:** `npx tsc --noEmit -p tsconfig.app.json` sai com **exit code 0**
— zero erros. A causa apontada abaixo estava certa: era o `types.ts` defasado. A regeneração
feita em `45351dc4` (após o DROP da tabela `precificacao`) trouxe `produtos`,
`itens_pedido_compra`, `estoque_movimentos`, `pedidos_compra`, `fornecedores` e
`nfe_recebidas`, e os 14 erros sumiram junto — nenhum deles precisou de correção manual.

**Lição para a próxima vez:** erro de tipo em massa apontando para tabela ausente é sintoma,
não doença. Antes de corrigir arquivo por arquivo, checar se o `types.ts` está atualizado.

Registro do diagnóstico original:

**Situação (03/08):** `npx tsc --noEmit -p tsconfig.app.json` acusava 14 erros, todos anteriores ao
módulo de Metas do Comercial e concentrados em cinco arquivos:

| Arquivo | Erros | Natureza |
| --- | --- | --- |
| `src/components/contratos/ContratoItens.tsx` | 6 | tabela `produtos` ausente em `types.ts`; `TS2589` |
| `src/components/contratos/ContratoPedidos.tsx` | 2 | `codigo_item` fora de `ContratoItem`; `any` → `never` |
| `src/components/financeiro/FinEmissorNFe.tsx` | 2 | `pedido_id` ausente em `financeiro_nfes_emitidas` |
| `src/components/financeiro/FinPedidosAFaturar.tsx` | 1 | `any` → `never` |
| `src/components/financeiro/LancamentoDialog.tsx` | 1 | `'movimentacao'` fora do union de tipo |
| `src/components/gestao-compras/PedidosOmie.tsx` | 2 | tabela `produtos` ausente em `types.ts`; `TS2589` |

**Causa provável:** `src/integrations/supabase/types.ts` está desatualizado em relação ao
banco — a maior parte some com uma nova geração de tipos.

**Como reproduzir:**

```sh
npx tsc --noEmit -p tsconfig.app.json
```

**Decisão:** fora do escopo da Fase D. Não afeta build nem execução — `npm run build` é
`vite build`, que não faz checagem de tipos, e nada disso está em CI.

---

## [2026-08-03] `npm run lint` falha no repo inteiro — 2.064 problemas

**Como apareceu:** ao validar a Fase D das metas, `npx eslint src/components/layout` acusou
2 problemas em `src/components/layout/AppLayout.tsx`, arquivo não tocado pelo módulo:

```
73:26  error    Unexpected any. Specify a different type   @typescript-eslint/no-explicit-any
97:6   warning  React Hook useEffect has a missing dependency: 'navigate'
                                                             react-hooks/exhaustive-deps
```

**Situação real:** não é um caso isolado do AppLayout. Rodando no repo inteiro:

```sh
npm run lint
# ✖ 2064 problems (1932 errors, 132 warnings)
# 381 de 720 arquivos com pelo menos um problema
```

Distribuição por regra:

| Regra | Ocorrências |
| --- | --- |
| `@typescript-eslint/no-explicit-any` | 1.728 (84%) |
| `no-useless-escape` | 119 |
| `react-hooks/exhaustive-deps` | 100 |
| `prefer-const` | 32 |
| `@typescript-eslint/ban-ts-comment` | 28 |
| `react-refresh/only-export-components` | 27 |
| demais | ~30 |

Só 30 erros e 5 avisos são corrigíveis com `--fix`. O grosso é `any` espalhado, que exige
tipar caso a caso — e boa parte encosta no mesmo `types.ts` defasado da pendência acima.

**Decisão:** nada a corrigir agora. O registro existe para que ninguém trate um lint vermelho
como regressão de uma mudança recente: **ele já estava assim**. Os arquivos do módulo de
metas passam limpos, e é esse o critério que tem sido usado — lintar o que se toca, não o
repo.

**Efeito colateral a considerar:** o mesmo alerta das outras pendências — se entrar
verificação em CI ou hook de commit, `npm run lint` barra tudo. Ligar isso exige antes uma
limpeza grande, ou começar com a regra `no-explicit-any` rebaixada a `warn`.

### Atualização de 2026-08-09 — o que foi feito e o que não dá para fazer

**Feito:** `eslint --fix` aplicado no repo. Saiu de **2.049 → 2.015 problemas**. As 34
correções foram 29 `let` → `const` e 5 remoções de `/* eslint-disable-next-line */` inertes
(escritos no meio da linha, onde não suprimiam nada). Nenhuma tocou lógica; 414 testes e
`tsc` continuam limpos.

**Medição atual, por regra:**

| Regra | Total | Corrigível com `--fix` |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | 1.714 (85%) | **0** |
| `no-useless-escape` | 119 | 0 |
| `react-hooks/exhaustive-deps` | 100 | 0 |
| `@typescript-eslint/ban-ts-comment` | 28 | 0 |
| `react-refresh/only-export-components` | 27 | 0 |
| demais | ~27 | 0 |

**Por que não dá para "só corrigir":** os 1.714 `any` estão em 381 dos 720 arquivos. Tipar
caso a caso produziria um diff que toca metade do repositório, irrevisável, em código sem
cobertura de teste (a suíte cobre 19 arquivos). O risco de regressão silenciosa é alto e o
ganho para o usuário final é zero.

**O problema real não é o número, é o lint não servir de sinal.** Com 1.917 erros de fundo,
ninguém distingue uma regressão nova do ruído. As saídas, em ordem de custo:

| Opção | O que faz | Custo | Risco |
| --- | --- | --- | --- |
| **A** | `no-explicit-any` vira `warn`; lint passa a falhar só nos ~200 erros reais | horas | baixo |
| **B** | Baseline congelando a dívida atual; qualquer erro novo quebra | horas | baixo |
| **C** | Tipar os 1.714 `any` | semanas | alto |

**Recomendação:** **A**, com a dívida pagando-se incrementalmente — cada arquivo que alguém
for mexer, tipa de passagem. É mudança de política do projeto, então precisa de decisão
explícita: não foi aplicada.

---

## ~~[2026-08-03] PRIORIZADA — dia útil por praça do colaborador (metas)~~ — CÓDIGO CONCLUÍDO em 2026-08-08

**Prazo-alvo:** implementar antes do fechamento de setembro/2026. **Cumprido** — as duas
fases estão entregues. Resta só o passo operacional: cadastrar os feriados de setembro na
tela nova, começando por 07/09.

**Contexto:** a equipe comercial é distribuída em todas as UFs, então o dia útil varia por
pessoa. Hoje `comercial_feriados` é só por empresa, e o motor trata todo mundo com o mesmo
calendário.

**Modelo pretendido:**

- `comercial_feriados` ganha `uf` e `municipio` opcionais — `null`/`null` = nacional (vale
  para todos), `uf` preenchida = estadual, `uf` + `municipio` = municipal;
- colaborador ganha uma praça (`uf`, `municipio`) em `empresa_membros`, editável pelo admin;
- no cálculo, o colaborador recebe os nacionais + os da UF dele + os do município dele;
- só serão cadastrados feriados estaduais das UFs e municipais das cidades **onde há
  colaborador** — não o Brasil inteiro;
- colaborador sem praça definida usa só os nacionais, que é o comportamento atual. A
  transição não quebra ninguém.

**Por que foi adiado:** agosto/2026 não tem feriado nacional, então o resultado com praça e
sem praça é idêntico no mês. Construir agora seria entregar sem poder validar. O primeiro mês
que exercita a regra é setembro (07/09, segunda) — daí o prazo-alvo.

### Faseamento

**Fase 1 — schema + praça do colaborador.** ✅ **ENTREGUE em 2026-08-04** — migration
`20260804000001` (colunas + UNIQUE com COALESCE + CHECKs pela forma normalizada +
`normalize(NFC)` + ñ no `comercial_sem_acento`), filtro `filtrarFeriadosPorPraca` em
`src/lib/metas/praca.ts` (14 testes, paridade TS↔SQL), praça no diálogo de
`EquipeColaboradores.tsx` e contador de feriados visível no painel (ressalva 3).
Feriados estaduais/municipais entram por SQL até a Fase 2.

**Fase 2 — CRUD de feriados na Parametrização.** ✅ **ENTREGUE em 2026-08-08** — commit
`c7287729`. `FeriadosManager.tsx` em Metas do Comercial → Parametrização, com cadastro,
edição e exclusão; `useSalvarFeriado`/`useExcluirFeriado`; regras isoladas em
`src/lib/metas/feriados.ts` com 15 testes.

Saiu **sem migration**: as três ressalvas abaixo já tinham sido resolvidas na Fase 1
(`20260804000001`). A abrangência é derivada de `uf`/`municipio`, nunca digitada, espelhando
o CHECK `comercial_feriados_abrangencia_praca`. Dois avisos não bloqueantes cobrem os erros
silenciosos: data em fim de semana e feriado que não atinge praça nenhuma.

**Falta operacional:** cadastrar **07/09/2026 (nacional)** antes de setembro. Sem isso o mês
conta 22 dias úteis em vez de 21 e infla o ritmo diário de todo o comercial — é a própria
razão do prazo-alvo desta pendência.

### Tamanho estimado

| Parte | Tamanho | Observação |
| --- | --- | --- |
| Schema | P | 1 migration idempotente, RLS já existe nas duas tabelas |
| Motor | PP | `dias-uteis.ts` e `projecao.ts` **não mudam** (ver abaixo) |
| Hooks | P | campos novos em `useFeriados`/`useColaboradores` + 1 mutation |
| Testes | P | ~12 casos na função de filtro; os atuais seguem válidos |
| Tela — CRUD de feriados | G | do zero |
| Tela — praça | M | dois campos em `EquipeColaboradores.tsx` (625 linhas) |
| Tela — painel | PP | passar a lista já filtrada |

O motor não muda porque `dias-uteis.ts` aceita uma lista arbitrária de datas e `projecao.ts`
apenas a repassa. O filtro por praça é uma função pura nova aplicada **antes** do motor.

### Ressalvas a resolver na implementação

**1. A constraint atual bloqueia o modelo.** `comercial_feriados` tem
`UNIQUE (empresa_id, data)`. Com praças, duas UFs podem ter feriados diferentes na mesma
data e o segundo `INSERT` seria descartado em silêncio. A migration precisa trocar por
`UNIQUE (empresa_id, data, coalesce(uf,''), coalesce(municipio,''))`. Os dados já
cadastrados não precisam de retrabalho: nacional tem `uf` nulo e continua único por data.

**2. Município como texto livre falha para menos.** "Santa Rosa" vs. "SANTA ROSA " vs.
"Santa Rosa/RS" não casam, e o efeito é silencioso — o colaborador ganha um dia útil que não
existe, inflando o denominador do ritmo diário. Normalizar no mesmo padrão do `achatar()` de
`src/lib/metas/modalidades.ts`, com testes de grafia.

**3. A tela precisa mostrar quantos feriados entraram no cálculo.** Praça errada ou feriado
não cadastrado não gera erro, só distorce a projeção. Sem esse número visível no painel do
colaborador, ninguém descobre que está errado.

---

## [2026-08-13] A automação de editais estava parada há 7 semanas

**Situação:** nenhum dos jobs de `cron.job` alcançava as edge functions. A causa se dividia
em três, e todas passaram despercebidas pelo mesmo motivo — `net.http_post` é assíncrono, e
o `cron.job_run_details` só registra se o comando SQL rodou, não se o HTTP chegou.

| Causa | Jobs afetados | Sintoma no `job_run_details` |
| --- | --- | --- |
| URL fixa em `sbnlovigyifvrkgsoalj` (projeto inexistente) | `boletim-ia-diario-06h`, `pncp-sync-madrugada`, `pncp-sync-meiodia`, `mural-telemetria-alerta-15min` | **`succeeded`** — verde falso |
| Vault sem `SUPABASE_URL` → `NULL \|\| '/functions/...'` = NULL | `coletar-portais-cron`, `distribuir-editais-cron`, `pesquisa-tempo-real-30min`, `pncp-sync-diario` | `failed` |
| Edge functions sem `CRON_SECRET` | as 9 que validam o token | 401 |

**A pegadinha das duas grafias:** o vault é *case-sensitive* e as migrations usam as duas.
`coletar-portais` e `distribuir-editais` procuram `SUPABASE_URL`; `crawler-pncp`,
`pesquisa-tempo-real` e `pncp-sync-diario` procuram `supabase_url`. Criar só uma conserta
metade dos jobs e a outra metade continua falhando, o que confunde o diagnóstico. Hoje as
duas existem, com o mesmo valor.

**Evidência do impacto:** `pncp_sync_log` sem uma linha desde 2026-06-25 e 0 syncs em 7 dias,
enquanto `pncp_editais_cache` recebia dados no mesmo dia — porque o app chama as funções
direto do navegador quando alguém abre a tela. **A coleta só acontecia com gente usando o
sistema.**

**Mitigação aplicada:** a migration `20260813000005` criou `public.supabase_project_url()` e
`public.cron_auth_header()`, para que a URL e o token existam em um lugar só. Foi a
duplicação em quatro migrations que permitiu ao erro sobreviver meses.

**Pendente:** padronizar as migrations antigas para usarem os dois helpers, e decidir o que
fazer com `crawler-pncp-30min` — está nas migrations mas não em `cron.job`, o que sugere
remoção deliberada quando o `pncp-sync-diario` assumiu a coleta.

---

## [2026-08-14] Restauração de lançamentos: dois jobs órfãos do incidente de maio — RESOLVIDO

**Situação:** `restaurar-lancamentos-tick` falhava a cada 2 minutos desde que a tabela
`restauracao_lancamentos_progresso` deixou de existir (~720 falhas/dia poluindo o
`cron.job_run_details`). Pior: `popular-fila-restauracao` seguia rodando a cada minuto e
capturava **todo** delete de `financeiro_lancamentos` para a fila de restauração —
misturando deleções legítimas dos usuários com o incidente antigo.

**Como foi decidido:** a fila tinha 124 pendentes / 0 processados. A distribuição temporal
dos deletes: jun=7, jul=34, ago=83, **maio=0**. Nenhum item era do incidente — todos eram
deleções intencionais pós-incidente. Restaurá-los ressuscitaria lançamentos apagados de
propósito. Decisão: nada a restaurar.

**O que foi feito:** os dois jobs desligados (2026-08-14) e a migration `20260814000001`
remove a fila e as seis gerações de funções que o incidente deixou (`audit`, `por_id`,
`v2`, `v3`, `tick`, `popular`). O `financeiro_audit_log` fica intacto como fonte de verdade.

**Lição repetida:** é o mesmo padrão do arquivamento e dos crons do PNCP — tarefa pontual
que vira rotina eterna porque ninguém desliga. Toda rotina temporária deveria nascer com
condição de parada verificável (o `tick` até tinha; a tabela que a sustentava é que sumiu).
