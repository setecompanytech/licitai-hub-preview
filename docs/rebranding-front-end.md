# Rebranding do front-end — planejamento e manual de trabalho

**Documento vivo.** Serve a duas leituras:

- **Acompanhamento** (Rafael, Giovanny, Rubens) — as seções 1 a 3 dizem o que
  muda, por que, e como a produção fica protegida. Sem código.
- **Execução** (Caio, e quem entrar depois) — da seção 4 em diante é manual de
  trabalho: como começar, o que mexer, o que não mexer, e a tabela de tradução
  das cores.

| | |
| --- | --- |
| Direção visual | `prototype-praefectus/index.html` — aprovada pelo Rafael |
| Frente | Ian + Caio Gabriel (`gabrielcgm-web`) |
| Onde | branch única `feature/rebrand-ui-ux`, compartilhada pelos dois; `main` é produção |
| Status | **entrega única em 04/09**, após avaliação do tech lead — o plano de fatias a cada poucos dias caiu com o prazo |
| Última revisão | 04/09/2026 |

---

## 1. O que muda, e por quê

O protótipo nasceu como apresentação. O Rafael aprovou a direção, e agora o app
migra para ela.

**Não é uma cópia do protótipo.** O protótipo desenhou 43 telas; o app tem 89
rotas. Ele é direção, não especificação — as melhorias vão aparecer ao longo do
trabalho, e o desenho das telas que faltam vem depois.

**O que o usuário vai ver mudar, em ordem:**

1. **Cor e sombra** — o app inteiro de uma vez, inclusive as telas que ninguém
   desenhou. Sai o azul-marinho com laranja; entra azul, ciano e dourado.
2. **Tipografia** — Inter no corpo do texto, serifada nos títulos.
3. **Forma dos componentes** — botão, campo, cartão: raio, altura, densidade.
4. **Layout das telas**, em grupos, conforme o desenho ficar pronto.

**O que NÃO muda: absolutamente nada do funcionamento.** Esta etapa mexe só na
aparência. Nenhum cálculo, nenhuma regra de negócio, nenhuma consulta ao banco,
nenhuma tela deixa de fazer o que fazia. É o mesmo sistema, com outra cara.

Isso é uma garantia prática, não uma intenção: as fatias visuais tocam
`index.css`, `tailwind.config.ts` e os componentes de interface — arquivos que
não contêm lógica. A regra está escrita na seção 5, com o teste que decide
quando algo saiu do escopo.

## 2. Como a produção fica protegida

A `main` é o que está no ar e recebe **cerca de 30 commits por dia**, de três
pessoas mais o Lovable, que commita sozinho. Mexer no visual direto ali seria
arriscado para todo mundo.

Então o rebrand vive numa **branch única, a `feature/rebrand-ui-ux`, compartilhada por Ian e
Caio** — decisão do Giovanny, uma frente só, sem branch por pessoa. Ela volta
para a `main` em **fatias a cada poucos dias**, não numa entrega única no fim.
Três consequências:

- cada fatia é pequena o bastante para revisar e reverter
- o rebrand chega ao ar aos poucos, em vez de num susto só
- a branch nunca acumula semanas de divergência

Se uma fatia der problema, ela volta atrás sozinha, sem levar junto o trabalho
de Contratos, Financeiro ou Robô de Lances.

Branch compartilhada tem uma exigência técnica própria, e ela está na seção 4:
**nunca rebasear a `feature/rebrand-ui-ux` contra o `main`** — o rebase reescreve o histórico
que o outro já baixou. Ali entra `merge`.

## 3. Onde estamos hoje

| | App hoje | Protótipo |
| --- | --- | --- |
| Telas | 89 rotas | 43 |
| Cores definidas | 60 variáveis | 75 variáveis |
| Formato da cor | `215 55% 20%` (HSL) | `#2563EB` (hex) |
| Primária | azul-marinho | azul-marinho + azul vivo |
| Destaque | laranja | ciano e dourado |
| Tema escuro | funcionando | **não existe** |
| Corpo | Plus Jakarta Sans | Inter |
| Títulos | Cinzel | Cinzel (Playfair só na tela de login) |

> **Números reconferidos em 02/09/2026.** A versão anterior desta tabela dizia
> "91 rotas / 37 telas / 101 variáveis / 64 variáveis". Os valores corretos são
> os acima. E a Playfair Display aparece numa única regra do protótipo
> (`index.html:3350`, o logo do login), mas **não está no `<link>` do Google
> Fonts** (`index.html:8` carrega só Inter e Cinzel) — hoje ela cai em Georgia.
>
> **Decidido em 04/09/2026: carrega.** A Playfair entra por `src/styles/login.css`,
> junto do resto do estilo da tela de login, e não pelo `index.css` — assim ela
> não pesa no primeiro carregamento de quem já está autenticado, que é quem abre
> o app todo dia. Georgia continua no fallback.

**O número que define o tamanho do trabalho:** de **448 arquivos** de tela, só
**6** escrevem cor de interface à mão. Os outros herdam das variáveis. Trocar as
variáveis repinta o app quase inteiro — inclusive as ~46 telas que o protótipo
nunca desenhou.

É por isso que a primeira fatia é a de maior efeito e menor risco.

---

## 4. Primeiros passos — Caio

```sh
git clone git@github.com:xfinconsultoriaempresarial-a11y/licitai-hub.git
cd licitai-hub
npm install
npm run run-local          # sobe em http://localhost:8080
```

**Leia o `CLAUDE.md` da raiz antes de qualquer coisa.** Ele tem as convenções do
projeto — commits em português, SQL idempotente, a fronteira dos percentuais — e
o seu Claude também vai lê-lo sozinho.

### A branch

**Uma só, `feature/rebrand-ui-ux`, compartilhada entre Ian e Caio.** Decisão do Giovanny. Ela
sobrevive às fatias: não se cria branch nova a cada entrega, a mesma continua
viva depois que cada fatia volta para o `main`.

```sh
git checkout main
git pull --rebase origin main
git checkout -b feature/rebrand-ui-ux          # só na criação; depois é sempre checkout
git push -u origin feature/rebrand-ui-ux
```

Quem chegar depois:

```sh
git checkout feature/rebrand-ui-ux             # a branch já existe no remoto
```

### ⚠️ Branch compartilhada: rebase contra o `main` é proibido

Esta é a regra que mais dói se for esquecida.

`git pull --rebase origin main` **reescreve todos os commits da branch**. Numa
branch de uma pessoa só, tudo bem. Numa compartilhada, quebra o clone do outro:
o próximo `pull` dele falha e ele só se recupera com `reset --hard`, perdendo o
que tiver local.

Então, para trazer o `main` para dentro da `feature/rebrand-ui-ux`:

```sh
git fetch origin
git merge origin/main            # MERGE. Nunca rebase.
git push origin feature/rebrand-ui-ux
```

**Um de vocês faz isso, uma vez por dia, e avisa o outro.** Os dois no mesmo dia
viram merges concorrentes.

### ⚠️ Correção de 04/09: `--rebase` saiu do fluxo, inclusive dentro da branch

A versão anterior deste documento dizia que `git pull --rebase origin
feature/rebrand-ui-ux` era seguro "entre vocês, dentro da branch". **Era, até a
branch receber o primeiro merge da `main`.** Agora não é mais.

**Rebase achata merge.** Com um commit de merge no histórico da branch, o
`--rebase` desfaz esse merge e tenta reaplicar, um a um, todos os commits que
ele havia trazido. Aconteceu aqui em 04/09: a branch estava **zero commits
atrás**, não havia nada a trazer, e mesmo assim o rebase começou a replayar 31
commits da `main` e travou no primeiro conflito.

```
interactive rebase in progress; onto 0c98a14e
Last commands done (13 commands done)
Next commands to do (18 remaining)
```

**Se acontecer com você:**

```sh
git rebase --abort      # volta tudo ao estado anterior. Nada se perde.
```

E então `git pull` sem `--rebase`.

**O reflexo errado é `--force`.** Se o push for recusado depois de um rebase
confuso, `--force` apaga o trabalho do outro. Aborte e use merge.

### ⚠️ O fluxo obrigatório: status → pull → commit → pull → push

**Ninguém pode sobrescrever o trabalho do outro.** Como a `feature/rebrand-ui-ux` é
compartilhada, esta sequência é obrigatória em toda entrega. Não é preferência
de estilo — é o que impede perda de código.

```sh
# 1. VER onde você está, antes de qualquer coisa
git status

# 2. TRAZER o que o outro fez  —  SEM --rebase, ver o aviso abaixo
git pull origin feature/rebrand-ui-ux

# 3. CONFERIR que nada quebrou com o que veio
npx tsc --noEmit -p tsconfig.app.json
npx eslint <os arquivos que você tocou>     # obrigatório em componente
npm run test -- --run

# 4. COMMITAR o seu trabalho
git add <arquivos>          # nomeados, não `git add .`
git commit -m "feat(rebrand): ..."

# 5. TRAZER de novo — o outro pode ter enviado enquanto você commitava
git pull origin feature/rebrand-ui-ux

# 6. ENVIAR
git push origin feature/rebrand-ui-ux

# 7. CONFERIR que subiu
git status                  # deve dizer "nothing to commit, working tree clean"
```

**Por que o `pull` aparece duas vezes.** O passo 2 pega o que existia quando você
começou. Entre commitar e enviar passam minutos, e nesse intervalo o outro pode
ter enviado — o passo 5 pega isso. Sem ele, o `push` é recusado, e a saída errada
para essa recusa é `--force`, que apaga o trabalho do outro.

**As três proibições que decorrem disso:**

| Nunca | Por quê |
| --- | --- |
| `git push --force` | apaga commit do outro. Se o push foi recusado, é porque falta `pull` — nunca porque falta força |
| `git reset --hard` sem avisar | joga fora trabalho local, seu ou herdado do outro |
| `git add .` | leva junto arquivo que você não olhou. Nomeie os arquivos |

**Push recusado?** Não force. Rode o passo 5 e tente de novo. Deu conflito no
rebase, **pare e chame o outro** — quem escreveu aquelas linhas sabe o que
preservar. `git rebase --abort` volta ao estado anterior sem perder nada.

> ⚠️ **`npm run build` não checa tipos.** Ele passa com identificador
> inexistente — o Vite não checa, e o `tsc -p tsconfig.json` da raiz também não.
> Só `tsconfig.app.json` pega. Uma substituição que não casou passa no build e
> quebra a tela em branco no navegador.
>
> ⚠️ **E o `tsc` também não pega tudo.** Hook depois de `return` antecipado passa
> na checagem de tipos e quebra a tela em branco — aconteceu duas vezes em
> 02/09/2026. Quem pega é `npx eslint <arquivo>`, onde
> `react-hooks/rules-of-hooks` é erro.
>
> **Isto é especialmente perigoso nesta frente.** Mexer em aparência leva a
> mover JSX de lugar, e é assim que um `useState` acaba embaixo de um
> `if (!dados) return null`. **Editou componente → `eslint` naquele arquivo,
> antes do commit, sempre.**

---

## 5. O que mexer, e o que não mexer

> ## ⚠️ Regra número um: esta etapa mexe SÓ NA APARÊNCIA
>
> O rebrand muda **o visual de todo o sistema, e nada além disso.** Nenhuma
> regra de negócio, nenhum cálculo, nenhuma consulta, nenhum comportamento.
>
> | Está no escopo | Está fora |
> | --- | --- |
> | cor, sombra, borda, raio | consulta ao banco, RLS, migration |
> | tipografia, tamanho, peso | regra de negócio, cálculo, validação |
> | espaçamento, densidade, alinhamento | rota, navegação, edge function |
> | ícone, ilustração, estado visual | texto que muda significado |
> | classe do Tailwind, token CSS | `useEffect`, `useState`, handler |
>
> **O teste:** se a mudança fosse desfeita, algum número, algum dado salvo ou
> alguma decisão do sistema mudaria? Se sim, **está fora desta etapa.**
>
> **Achou um defeito enquanto trabalhava?** Não conserte aqui. Anote e avise —
> a correção vai para a `main`, separada. Bug misturado com rebrand faz a fatia
> inteira ficar difícil de revisar, e impede reverter o visual sem reverter o
> conserto junto.
>
> Isso vale inclusive para o que parece inofensivo: renomear uma variável,
> extrair um componente, "aproveitar e organizar o arquivo". Refatoração
> estrutural é outra etapa.

O Robô de Lances está sendo trabalhado em paralelo, na `main`. As duas frentes
tocam conjuntos de arquivos **disjuntos**, e é isso que evita conflito:

```
REBRAND (branch)              ROBÔ DE LANCES (main)
src/index.css                 supabase/functions/
tailwind.config.ts            src/lib/agent-template/
src/components/ui/            src/pages/RoboLances.tsx
                              src/components/robo-lances/
```

Precisou entrar no território da outra frente? **Avise antes.**

### Divisão dentro da branch — Ian e Caio

O git resolve sozinho quando são arquivos diferentes. O que dói é os dois no
mesmo arquivo no mesmo dia. Divisão pela natureza do trabalho:

| Ian | Caio |
| --- | --- |
| `src/index.css` — os 101 tokens | `src/components/ui/` — os 51 componentes |
| `tailwind.config.ts` | telas e composição |
| derivação do tema escuro | ajuste fino do que ficar feio |
| normalização dos 6 arquivos (seção 8) | |

Tradução de token é mecânica; forma e composição pedem olho de designer. Quando
um precisar entrar no arquivo do outro, **avise no mesmo dia** — não é proibido,
só não pode ser silencioso.

---

## ⚠️ 04/09, a partir de agora: os DOIS na branch ao mesmo tempo

Até aqui o trabalho foi alternado — o Caio entregou em 03/09, o Ian seguiu em
04/09. **Isso mudou: daqui em diante os dois estão escrevendo em paralelo.**

A regra da seção 4 (`status → pull → commit → pull → push`) deixa de ser
recomendação e passa a ser a única forma de trabalhar. Sem ela, o segundo a
enviar leva um push recusado, e a saída errada para isso — `--force` — apaga o
trabalho do outro.

### Quem está com o quê, agora

Esta tabela é o contrato do dia. **Quem pegar um arquivo, escreve aqui antes de
começar.** Uma linha a mais custa dez segundos; um conflito no
`MonitoramentoEditais.tsx`, de 2.500 linhas, custa a tarde.

| Arquivo / área | Com quem | Desde |
| --- | --- | --- |
| `src/index.css` · `tailwind.config.ts` | **Caio** — é a frente dele desde o começo | 02/09 |
| `src/components/ui/` (os 51) | **Caio** | 02/09 |
| `AppSidebar.tsx` · `menu.ts` · `AppTopNav.tsx` | **Caio** (navegação é dele) | 02/09 |
| `LicitacoesEstrategicas.tsx` · `HistoricoLicitacoes.tsx` | **Caio** — fecham o módulo 3 junto com o Kanban | 04/09 |
| ↳ o **herói** das Estratégicas | **Ian** (feito, com o Caio avisado antes) — o corpo continua do Caio | 04/09 |
| `ApoioContabil.tsx` · `GestaoCompras.tsx` — **só o herói** | **Ian** (feito); o corpo das telas segue livre | 04/09 |
| `Precificacao.tsx` | **Ian** | 04/09 |
| `src/assets/brand/` (heróis dos módulos) | **Ian** | 04/09 |
| As outras 12 telas da seção 11 | **livre** — nenhuma reservada | |
| _(anote aqui ao pegar uma)_ | | |

> **Ian tocou em `index.css`, `menu.ts`, `AppTopNav.tsx` e `AppSidebar.tsx` em
> 04/09, que são território do Caio.** Está tudo enviado, então basta um `pull`
> para receber. O que entrou: a classe `.eleva` e o bloco `.aurelia-fab` no
> CSS; o grupo *Painel* saiu do menu e *Inteligência* assumiu o topo (e o ícone
> dele virou `Brain` — `Tag` era etiqueta de preço, herança de quando o grupo
> se chamava "Inteligência & Preços"); a altura do cabeçalho subiu (e o `top-`
> da lateral acompanha); e o `.aurelia-fab` ganhou um bloco `.dark`. **Caio,
> puxe antes de abrir qualquer um desses quatro.**

### As três perguntas antes de commitar

1. **Puxei agora?** Não "hoje de manhã" — agora. `git pull origin feature/rebrand-ui-ux`
2. **O arquivo que abri está na tabela acima com o nome do outro?** Se sim, avise antes.
3. **Vou dar `--force`?** Não. Nunca. Push recusado quer dizer que falta `pull`.

### Três medidas que andam juntas, e quebram calado se separarem

Mexeu numa, confira as outras duas — não há erro de compilação para avisar:

| | Onde |
| --- | --- |
| Altura do cabeçalho (`h-14 sm:h-16`) | `AppLayout.tsx` |
| Onde a lateral gruda (`top-16` / `h-[calc(100vh-4rem)]`) | `AppSidebar.tsx` |
| A moldura do esqueleto (mesma altura, **e a mesma ordem das peças**) | `SkeletonPagina.tsx` |

### As outras regras rígidas

**1. `src/lib/versao.ts` é exclusivo da `main`. A branch nunca toca.**
É o arquivo mais disputado do repositório — 44 dos últimos 64 commits passaram
por ele. Se os dois lados bumparem o carimbo, conflita todo dia.

**2. Cor de interface sempre vira variável.** Nunca `#2563EB` nem `bg-blue-600`
dentro de um `.tsx`. Se faltar uma variável, crie em `index.css` — é o que mantém
as outras 442 telas herdando de graça.

A exceção está na seção 8: **documento gerado** (PDF, DOCX, HTML de exportação) e
**marca de terceiro** (logo de banco) continuam com cor fixa, e de propósito.

**3. Fatia curta.** Melhor três branches de dois dias que uma de duas semanas.

---

## 6. Tabela de tradução

O protótipo escreve cor em **hex**; o app consome **tripla HSL** via
`hsl(var(--token))`. Colar hex quebra o build inteiro. Toda cor abaixo já vem
convertida.

### 6.1 Mapeamento direto — sem decisão a tomar

| Token do app | Vem de | HSL |
| --- | --- | --- |
| `--background` | `--bg` | `216 38% 97%` |
| `--foreground` | `--text` | `222 47% 11%` |
| `--card` `--popover` | `--surface` | `0 0% 100%` |
| `--card-foreground` `--popover-foreground` | `--text` | `222 47% 11%` |
| `--secondary` | `--surface-alt` | `210 40% 96%` |
| `--secondary-foreground` | `--text` | `222 47% 11%` |
| `--muted` | `--border-soft` | `213 33% 95%` |
| `--muted-foreground` | `--text-secondary` | `215 16% 47%` |
| `--border` `--input` | `--border` | `214 32% 91%` |
| `--destructive` | `--error` | `0 72% 51%` |
| `--success` | `--success` | `142 76% 36%` |
| `--warning` | `--warning` | `32 95% 44%` |
| `--info` | `--text-secondary` | `215 16% 47%` |

### 6.2 Decisões que precisam de confirmação

**`--primary` — navy ou azul?**

O protótipo tem os dois, e usa cada um para uma coisa:

```css
.btn--primario        { background: var(--navy) }        /* #101B2D */
.btn--primario:hover  { background: var(--navy-hover) }  /* #1F3050 */
--primary: #2563EB;   /* links, foco, estado ativo, borda de hover */
```

No shadcn, `--primary` é a cor do **botão primário**. Então:

| Token | Recomendação | HSL |
| --- | --- | --- |
| `--primary` | `--navy` | `217 48% 12%` |
| `--primary-foreground` | branco | `0 0% 100%` |
| `--ring` | `--primary` do protótipo (azul) | `221 83% 53%` |

**`--accent` — este app usa fora do padrão.** No shadcn, `--accent` é fundo sutil
de hover. Aqui virou cor de marca (laranja `25 95% 36%`), e aparece em gradiente,
brilho e navegação. O protótipo tem três candidatas:

```
--primary   #2563EB  azul     221 83% 53%
--secondary #0891B2  ciano    192 91% 36%
--accent    #0EA5E9  céu      199 89% 48%
```

**Recomendo `--accent: 221 83% 53%`** (o azul do protótipo), porque é o que ele
usa em foco, link e estado ativo — exatamente onde o laranja está hoje. O ciano
fica para a família `--cat-banco`, e o céu para gráficos.

> ✅ **Confirmado pelo Caio em 02/09/2026.** `--accent: 221 83% 53%`.
> Confirmadas na mesma conversa: `--primary` = navy `217 48% 12%` com foreground
> branco, `--ring` = azul `221 83% 53%`, e o tema escuro derivado por regra.

### 6.2.1 A cor predominante é o navy — e ela emparelha com a logo dourada

Apontado pelo Caio e conferido no protótipo: **`--navy #101B2D` é a cor
predominante do rebranding**, e o header, o splash de carregamento e o véu da
tela de login são todos exatamente esse hex — `.topbar` (`index.html:141`),
`--boot-bg` (`:73`) e `--lg-veu-3: rgba(16,27,45,.44)` (`:111`) compartilham o
token de propósito.

O par dele é a **logo dourada**: `.logo{color:var(--logo-accent)}` `#F0D77B` no
header (`:145`) e `.boot__logo{color:var(--gold)}` `#D4AF37` no splash (`:247`).

Consequência para os tokens de navegação: **`--nav-active` sai do laranja
(`25 95% 53%`) e vira `--gold`**. É a cor de marca sobre o navy no protótipo, e
mantê-la laranja deixaria o único resquício da paleta velha justamente no
elemento mais visível do app.

### 6.3 Famílias novas — entram no app

O protótipo tem estas, o app não. Todas passam a existir em `index.css`:

**Cor por categoria** — usada para tipar registro (operacional, banco, fiscal,
análise, cadastro):

```
--cat-op          221 83% 53%     --cat-op-tint          213 84% 93%
--cat-banco       192 91% 36%     --cat-banco-tint       190 81% 90%
--cat-fiscal       32 95% 44%     --cat-fiscal-tint       40 91% 91%
--cat-analise     262 83% 58%     --cat-analise-tint     262 86% 94%
--cat-cadastro    142 76% 36%     --cat-cadastro-tint    143 59% 90%
```

**Trio por estado** — hoje o app tem uma cor por estado; o protótipo tem três
(fundo, texto, borda), que é o que dá aquele visual de aviso mais leve:

```
--success-tint  141 84% 93%   --success-ink  142 72% 29%   --success-line  141 59% 78%
--warning-tint   48 96% 89%   --warning-ink   26 90% 37%   --warning-line   44 67% 76%
--error-tint      0 93% 94%   --error-ink      0 74% 42%   --error-line      0 68% 85%
```

**Dourado** (marca) e **carregamento**:

```
--gold        46 65% 52%      --skeleton-bg  214 33% 92%
--gold-deep   39 62% 41%      --skeleton-hi  213 47% 96%
--gold-hi     47 76% 87%
--logo-accent 47 80% 71%
```

**Escala de intensidade** (mapa de calor, 6 passos) e **bloco de código**:

```
--map-1  214 100% 97%   --map-4  212 96% 78%      --cod-bg   216 49% 11%
--map-2  214 95% 93%    --map-5  213 94% 68%      --cod-txt  215 39% 89%
--map-3  213 97% 87%    --map-6  221 83% 53%      --cod-key  212 96% 78%
                                                  --cod-str  142 77% 73%
                                                  --cod-cmt  215 16% 47%
```

**Raio** — o protótipo trabalha com três; o app tem um só (`--radius: 0.5rem`):

```
--radius-sm  8px      --radius-md  12px      --radius-lg  16px
```

### 6.4 Famílias do app que precisam ser derivadas

O protótipo não cobre estas, mas elas existem e **estão visíveis**. Se ficarem
como estão, o app fica meio repaginado — gráfico e navegação com a cara velha.

| Família | Quantos | De onde derivar |
| --- | --- | --- |
| `--chart-1..5` | 5 | da família `--cat-*`, que já é um conjunto de 5 cores distinguíveis |
| `--nav-*` | 5 | de `--navy` (`217 48% 12%`), `--navy-hover`, `--navy-tint` |
| `--sidebar-*` | 9 | de `--surface` + `--navy` |
| `--gradient-*` | 6 | refazer com a paleta nova; os atuais são navy→laranja |
| `--shadow-*` | 6 | o protótipo tem `--shadow-sm/md` em rgba; converter e derivar os demais |

---

## 7. O tema escuro

**O protótipo não tem tema escuro.** Zero ocorrências de `.dark`,
`prefers-color-scheme` ou `data-theme` nas 16.390 linhas.

O app tem: **47 variáveis** redefinidas em `.dark`
([src/index.css:103](../src/index.css#L103)) e o botão de alternar no cabeçalho.
É funcionalidade em produção.

**As 13 que o `.dark` NÃO redefine são uma armadilha:** `--radius`, os 6
`--gradient-*` e os 6 `--shadow-*`. `--gradient-card` é branco→cinza-claro e
`--gradient-warm` é bege — ambos continuam claros no tema escuro. E as sombras
usam `hsl(215 45% 12% / α)`: sombra escura sobre fundo escuro, que não aparece.
As duas famílias precisam ganhar bloco `.dark` na derivação.

**Decisão tomada:** a paleta escura será **derivada por regra** da clara nova —
inverter a luminosidade, preservar matiz e saturação — e depois ajustada à mão
onde ficar ruim. Assim o escuro continua funcionando desde o primeiro dia, sem
esperar desenho, e os dois temas ficam da mesma família.

**Ao aplicar qualquer fatia, alternar claro/escuro em cada tela mexida.** É onde
a derivação automática falha — normalmente em texto sobre fundo tingido, e em
borda que some.

---

## 8. As fatias, em ordem

| # | Fatia | Arquivos | Efeito |
| --- | --- | --- | --- |
| 1 | **Tokens** | `index.css`, `tailwind.config.ts` | repinta o app inteiro |
| 2 | **Tipografia** | `index.css`, `tailwind.config.ts` | Inter no corpo, Playfair no display |
| 3 | **Componentes** | `src/components/ui/*` (51) | raio, sombra, altura, densidade |
| 4 | **Telas**, em grupos | conforme o desenho | layout e composição |

A fatia 1 é a de maior retorno: uma mudança em dois arquivos muda a aparência de
442 telas. As fatias 3 e 4 só começam depois que 1 e 2 estiverem na `main`.

### Como uma fatia volta para o `main`

A branch é **uma só e continua viva** entre as fatias — não se cria branch nova.
O que volta é o conteúdo, por **squash**, para o `main` seguir linear como o
`CLAUDE.md` exige (a branch compartilhada tem merges dentro, e eles não devem
vazar para o histórico principal):

```sh
# 1. a branch precisa estar em dia com o main
git checkout feature/rebrand-ui-ux
git fetch origin && git merge origin/main
npx tsc --noEmit -p tsconfig.app.json && npm run test -- --run
git push origin feature/rebrand-ui-ux

# 2. a fatia entra no main como UM commit
git checkout main
git pull --rebase origin main
git merge --squash feature/rebrand-ui-ux
git commit          # mensagem descrevendo a fatia inteira
git push origin main

# 3. a branch continua, agora já contendo o que foi entregue
git checkout feature/rebrand-ui-ux
git merge origin/main
git push origin feature/rebrand-ui-ux
```

O passo 3 importa: sem ele, a próxima fatia levaria de novo o que já está no ar.

**Combine a entrega entre os dois.** Squash de trabalho pela metade do outro é a
única forma real de perder código aqui.

### Preparação, antes da fatia 1

Feita na `main`, por Ian: este documento, o ponteiro no `CLAUDE.md`, e a
normalização dos 6 arquivos abaixo.

#### Os 6 que escrevem cor de interface à mão — normalizar

| Arquivo | O que tem | Vira |
| --- | --- | --- |
| `components/analise-mercado/ContratosGov.tsx` | `COLORS` com 5 tokens + 3 hex soltos no fim | `--chart-4`, `--chart-5`, `--cat-banco` |
| `components/analise-mercado/TransparenciaPA.tsx` | idem | idem |
| `components/financeiro/FinDRE.tsx` | `border-amber-500/40`, `text-amber-500` | `--warning` |
| `components/precificacao/ServicoMDOCalculadora.tsx` | `text-green-600`, `text-red-600` | `--success`, `--destructive` |
| `components/contratos/ContratoPedidos.tsx` | `bg-blue-50`, `text-blue-900`, `text-amber-700` | `--info`, `--warning` |
| `pages/PerfisAlerta.tsx` | `CLASSIFICACAO_CONFIG` com `bg-red-500`/`orange`/`yellow`/`blue`, e `text-red-500` | `--destructive`, `--warning`, `--chart-5`, `--info` |

**Feito em 02/09/2026.** Os gráficos de `ContratosGov` e `TransparenciaPA` pedem
8 séries e o app só tinha 5 tokens de gráfico, então nasceram **`--chart-6`,
`--chart-7` e `--chart-8`** em `index.css` (claro e escuro) e no
`tailwind.config.ts` — as três cores que estavam soltas em hex, agora numa fonte
só que o rebrand retune de uma vez.

> ⚠️ `ContratoPedidos.tsx` está no módulo de Contratos, que recebe commits todo
> dia. São 5 linhas — fazer isolado e commitar sozinho, para não brigar com quem
> está mexendo lá.

#### Os 9 que escrevem cor à mão COM RAZÃO — não tocar

Estes **não** entram no rebrand. Mudá-los quebraria coisa:

| Arquivo | Por quê |
| --- | --- |
| `main.tsx` | cor do banner no console do DevTools — não existe variável CSS lá |
| `components/financeiro/BancoSelectorLogos.tsx` | 44 cores de **marca de banco** (Banco do Brasil, BASA, Bradesco…). São identidade de terceiro e não mudam com o nosso rebrand |
| `components/proposta/PropostaDownload.tsx` | HTML do documento gerado |
| `components/proposta/PropostaLivePreview.tsx` | prévia do documento impresso — tem que parecer papel, não o tema do app |
| `components/precificacao/CatalogoDocGenerator.tsx` | DOCX gerado |
| `components/precificacao/AureliaPrecificacaoChat.tsx` | documento gerado |
| `components/gestao-compras/PedidosOmie.tsx` | documento gerado |
| `pages/AuditoriaBancos.tsx` | documento gerado |
| `pages/PerfisAlerta.tsx` — só o `CORES_PERFIL` | é **dado, não tema**: a cor escolhida é gravada no banco, e a tela a usa como `p.cor + '20'` para compor o alfa. Token viraria `hsl(var(--x))20`, que não é cor. O resto do arquivo já foi normalizado |

**A regra por trás da divisão:** cor de **interface** vem de variável, porque
muda com o tema. Cor de **documento gerado** e de **marca de terceiro** é fixa,
porque não deve mudar quando o app muda de cara — um PDF não tem tema escuro, e
o amarelo do Banco do Brasil é do Banco do Brasil.

#### Como reconferir

```sh
grep -rlE '#[0-9a-fA-F]{6}' --include='*.tsx' src
grep -rlE '\b(bg|text|border)-(slate|gray|zinc|red|orange|amber|yellow|green|emerald|teal|cyan|blue|indigo|violet|purple|pink)-[0-9]{2,3}' --include='*.tsx' src
grep -rlE 'hsl\(\s*[0-9]' --include='*.tsx' src
```

Depois da normalização, os dois primeiros comandos devem retornar **só os 9 da
lista de cima**. Qualquer nome novo é cor escapando do sistema.

Conferido em 02/09/2026 — é exatamente o que eles retornam.

> ⚠️ **O terceiro `grep` foi acrescentado em 04/09, e não é detalhe.** Os dois
> primeiros procuram `#B91C1C` e `bg-blue-600`. Nenhum dos dois enxerga
> `hsl(215, 50%, 7%)` — nem inline em `style`, nem em classe arbitrária
> `text-[hsl(...)]`. **Cinco arquivos escapavam por esse buraco desde o começo
> da frente**, e a afirmação "os dois comandos retornam só os 9 conhecidos"
> continuava verdadeira o tempo todo: a rede é que tinha furo, não a lista.
>
> Como apareceu: o painel de análise do edital, dentro de Estratégicas, ficou
> navy sobre cartão branco no tema claro, com o texto quase ilegível. A cor não
> estava no `index.css` — estava fixada no componente, em valores do tema
> escuro. Corrigir o CSS não resolvia, porque o CSS não era o problema.
>
> Situação em 04/09: `AureliaChat`, `AureliaQuickCard` e `AureliaEditalPanel`
> normalizados. **Faltam `AdminMarketing.tsx` e `TutorialPage.tsx`** — o
> primeiro é uma das 14 telas da seção 11 e se resolve quando ela for feita.

---

## 9. Como conferir antes de entregar uma fatia

1. `npx tsc --noEmit -p tsconfig.app.json` — 0 erros
2. `npx eslint $(git diff --name-only main...HEAD -- '*.tsx' '*.ts')` — 0 erros.
   É o que pega hook fora de ordem, que o `tsc` deixa passar e vira tela branca
3. `npm run test -- --run` — 1091 testes passando
4. `npm run run-local` e percorrer: **Kanban, Financeiro, Contratos, Robô de
   Lances, Proposta** — são as telas de maior tráfego
5. **Alternar claro e escuro em cada uma**
6. Conferir que nenhum arquivo voltou a escrever cor à mão (os dois `grep` acima
   devem continuar retornando só o que já era conhecido)
7. Comparar lado a lado com o protótipo, nas telas que ele desenhou
8. **Ler o próprio diff procurando lógica** — é a conferência da regra número um:

```sh
git diff main...HEAD -- 'src/**/*.tsx' | grep -E '^\+' | \
  grep -E 'useEffect|useState|supabase\.|await |if \(|\.filter\(|\.map\(|=>' 
```

Idealmente **não retorna nada**. O que aparecer precisa de explicação: ou é
lógica que vazou para a fatia visual, ou é um `.map()` legítimo de renderização.
Na dúvida, tire da fatia.

---

## 10. Em aberto

- **Lovable e a branch** — ele commita sozinho na `main`; confirmar que continua
  apontado para lá e não passa a mexer na branch
- ~~**`--accent`**~~ — decidido em 02/09/2026: azul `221 83% 53%` (seção 6.2)
- **As ~46 telas sem desenho** — herdam a paleta pelos tokens, mas layout e
  composição seguem como estão até alguém desenhar
- **Tema escuro** — a derivação automática precisa de uma passada de ajuste
  manual; quando, e por quem

---

## 11. Checklist de módulos

> Autorizado pelo Yrmih em 02/09/2026. Esta é a folha de acompanhamento do
> rebrand: as 89 rotas de [src/App.tsx](../src/App.tsx) agrupadas em 22 módulos
> de negócio. **Marcar a cada etapa concluída.**

Como ler as colunas:

| Coluna | Fecha quando |
| --- | --- |
| **Prot.** | ✅ = o protótipo desenhou este módulo · — = não desenhou, herda só a paleta |
| **Tok** | a fatia 1 entrou — o módulo já está com a paleta nova |
| **Tip** | a fatia 2 entrou — Inter no corpo e a escala densa aplicada |
| **Comp** | a fatia 3 entrou — raio, altura, densidade e forma dos componentes |
| **Lay** | a fatia 4 passou por este módulo — layout e composição |
| **☾** | claro **e** escuro percorridos nas telas do módulo, sem quebra |

E o que cada marca quer dizer:

| Marca | Onde está |
| :---: | --- |
| ☐ | não começou |
| **◐** | **feito, e vivendo na `feature/rebrand-ui-ux`** — ainda não voltou para a `main` |
| ✔ | mesclado na `main`, valendo em produção |

O ◐ existe porque sem ele o checklist mente nos dois sentidos: marcar ✔ o que
está só na branch faz parecer publicado, e deixar ☐ o que já foi escrito faz
parecer que ninguém trabalhou. Fatia entregue vira ✔ no merge, não antes.

A fatia 1 marca a coluna **Tok** de todos de uma vez — é o efeito de repintar 442
telas com dois arquivos. As demais avançam módulo a módulo.

| # | Módulo | Rotas | Prot. | Tok | Tip | Comp | Lay | ☾ |
| --- | --- | ---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | Autenticação & Onboarding | 5 | ✅ | ◐ | ◐ | ☐ | ◐ | ◐ |
| 2 | Painel & Navegação | 3 | ✅ | ◐ | ◐ | ☐ | ◐ | ◐ |
| 3 | Licitações & Kanban | 5 | ✅ | ◐ | ◐ | ☐ | ◐ | ◐ |
| 4 | Monitoramento & Busca | 6 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 5 | Precificação | 2 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 6 | Proposta & Envio | 2 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 7 | Robô de Lances | 1 | ✅ | ◐ | ◐ | ☐ | ◐ | ◐ |
| 8 | Contratos | 2 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 9 | Compras & Fornecedores | 1 | ✅ | ◐ | ◐ | ☐ | ☐ | ☐ |
| 10 | Financeiro | 5 | ✅ | ◐ | ◐ | ☐ | ◐ | ◐ |
| 11 | Apoio Jurídico | 2 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 12 | Apoio Contábil | 1 | ✅ | ◐ | ◐ | ☐ | ☐ | ☐ |
| 13 | Análise de Mercado & Concorrentes | 2 | ✅ | ◐ | ◐ | ☐ | ◐ | ◐ |
| 14 | Metas | 2 | ✅ | ◐ | ◐ | ☐ | ☐ | ☐ |
| 15 | IA & Assistentes | 6 | ✅ | ◐ | ◐ | ☐ | ☐ | ☐ |
| 16 | Comunicação | 3 | ✅ | ◐ | ◐ | ☐ | ☐ | ☐ |
| 17 | Documentos & Cadastro | 3 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 18 | Agenda | 2 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 19 | Equipe & Configurações | 3 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 20 | Admin | 7 | ✅ | ◐ | ◐ | ☐ | ☐ | ☐ |
| 21 | Conteúdo & Suporte | 9 | ✅ | ◐ | ◐ | ☐ | ◐ | ☐ |
| 22 | Institucional & Legal | 17 | — | ◐ | ◐ | ☐ | ☐ | ☐ |

**Onde está o trabalho sem desenho.** O módulo 22 (17 rotas: landing, sobre,
contato, soluções, demo, investidores e as 11 páginas legais) é o único grupo
inteiro que o protótipo não cobriu. Somado às telas internas dos outros módulos
que ficaram de fora, dá as ~46 telas sem referência visual: elas herdam a paleta
pelos tokens e mantêm o layout atual até alguém desenhar.

### O que já está escrito, e por quem

Atualizado em 03/09/2026. Tudo abaixo vive na `feature/rebrand-ui-ux` e **ainda
não voltou para a `main`** — é o que o ◐ da grade acima quer dizer.

#### Caio Gabriel — commits `c520f26a` e `a63f2dcc`

> Marcado pelo Caio em 04/09. A grade acima também: Cor e Tipografia em todos os
> 22, porque as duas fatias moram em dois arquivos que as 442 telas herdam.

| | Entrega | Arquivos |
| :---: | --- | --- |
| ◐ | Paleta navy + dourada, tipografia Inter, escala compacta | `src/index.css` · `tailwind.config.ts` |
| ◐ | Barra lateral nova, com busca e grupos recolhíveis | `AppSidebar.tsx` (novo) |
| ◐ | Menu como autoridade única, lido pela lateral **e** pelo topo | `src/lib/navegacao/menu.ts` (novo) |
| ◐ | **Limpeza do menu do topo — +1 / −104.** As 104 linhas da lista saíram de dentro do componente. Não é só menos código: enquanto a lista morava ali, ela era uma constante exportada de um arquivo de componente, o que **desliga a atualização instantânea da tela** naquele arquivo (o `Could not Fast Refresh` que o Vite acusava). E era o caminho aberto para a segunda cópia — o defeito que o `CLAUDE.md` descreve como tendo mantido o arquivamento automático quebrado por meses | `AppTopNav.tsx` |
| ◐ | Painel: faixa de destaque, oportunidades, mapa por estado | `Index.tsx` · 4 componentes novos em `dashboard/` |
| ◐ | Central de avisos agrupada por dia | `CentralAvisos.tsx` |
| ◐ | Tema padrão passa de escuro para claro | `App.tsx` |

#### Ian + Claude — 03 a 04/09/2026

| | Entrega | Arquivos |
| :---: | --- | --- |
| ◐ | Imagens da marca — mascote e foto do login, com README de uso | `src/assets/brand/` |
| ◐ | **Splash de abertura** — navy, Cinzel dourado; cobre o branco entre o HTML chegar e o React montar | `index.html` · `main.tsx` |
| ◐ | **Tela de login** — foto, véu de dois gradientes, cartão de vidro, Playfair na marca | `Auth.tsx` · `src/styles/login.css` |
| ◐ | **Skeleton com varredura de luz** no lugar do pulsar — `transform` em vez de `background-position`, sem repintura | `skeleton.tsx` · `index.css` |
| ◐ | Espera de rota e de sessão viram esqueleto, não spinner | `SkeletonPagina.tsx` · `App.tsx` · `ProtectedRoute.tsx` |
| ◐ | Tokens `--skeleton-bg` / `--skeleton-hi`, claro e escuro | `src/index.css` |
| ◐ | **Modal do mascote** no primeiro acesso, com holofote na barra lateral e conector refeito | `MascoteBoasVindas.tsx` · `src/styles/mascote.css` |
| ◐ | Fila entre wizard e mascote — `onboardingCarregado` distingue "ainda não sei" de "não precisa" | `OnboardingWizard.tsx` · `Index.tsx` |
| ◐ | Âncora `data-grupo` na barra lateral, para o holofote medir o alvo certo | `AppSidebar.tsx` |
| ◐ | **Hub de perfil** — 7 seções no lugar de 3 campos, sem coluna nova de banco | `perfil/` (6 arquivos) |
| ◐ | Faixa do painel deixa de anunciar novidade que não existe | `Index.tsx` |
| ◐ | Esta folha de acompanhamento, preenchida | este arquivo |

**04/09 — telas de maior tráfego** — _Ian + Claude_ (o prazo virou entrega única; ver seção 8)

| | Entrega | Arquivos |
| :---: | --- | --- |
| ◐ | **Financeiro** — herói com saldo, projeção e curva de 6 meses. Dado REAL, `useResumoFinanceiro`, zero consulta nova. Aditivo: entra acima do `FinHomeHub`, que continua inteiro | `FinHeroPainel.tsx` (novo) · `Financeiro.tsx` |
| ◐ | **Análise de Mercado** — modalidade passa a ler o banco e vira "Sua carteira"; os 4 blocos que continuam fixos ganham tarja | `AnaliseMercado.tsx` · `TarjaExemplo.tsx` (novo) |
| ◐ | **Kanban** — `kb-barra` do protótipo, com filtro do board por número, órgão e objeto (sem acento, sem caixa) | `KanbanPage.tsx` |
| ◐ | **Robô de Lances** — cabeçalho em duas fileiras; o selo de nível sobe para ele e vira atalho para a parada de emergência | `RoboLances.tsx` |
| ◐ | Três esperas do Robô viram esqueleto, cada uma com a forma do que vem | `CredenciaisPortalForm` · `DeteccaoPortais` · `PortalHealthcheck` |
| ◐ | **Analytics** — o título deixa de prometer tempo real; o rodapé também. Só texto, o dado sempre foi verdadeiro (achado 2 da seção 12) | `Analytics.tsx` |
| ◐ | **Varredura de contraste** — 17 pares de texto/fundo calculados nos dois temas | (verificação, sem alteração) |

**04/09 — segunda leva: a jornada de ponta a ponta** — _Ian + Claude_

As quatro primeiras são o percurso de quem trabalha no sistema — **encontrar →
precificar → propor → disputar → contratar**. O Kanban e o Robô, já entregues
acima, ficam no meio dele; estas fecham as pontas. A quinta é diferente: é um
buraco que a leva anterior abriu.

| | Entrega | Arquivos |
| :---: | --- | --- |
| ◐ | **Monitoramento de Editais** — o painel SIASG de 19 filtros recolhe sozinho quando a busca volta, e o que estava marcado vira etiqueta legível; a espera virou esqueleto com a forma dos cartões | `MonitoramentoEditais.tsx` |
| ◐ | **Precificação** — os dois gráficos do protótipo, em dado REAL da planilha aberta | `PrecoGraficos.tsx` (novo) · `PlanilhaCustosEdital.tsx` · `Precificacao.tsx` |
| ◐ | **Proposta Comercial** — a régua `mstep`: oito nós ligados por um trilho que fica verde onde já passou, no lugar de oito pastilhas soltas | `PropostaTecnica.tsx` |
| ◐ | **Gestão de Contratos** — anatomia `kpi-meta` nos cinco cartões: rótulo, valor e **nota** de contexto | `GestaoContratos.tsx` |
| ◐ | **Tutorial** — anel de progresso, trilha que se preenche, conclusão por passo e "continuar de onde parei" | `TutorialPage.tsx` |
| ◐ | **Fim das telas brancas de carregamento** — sete esperas que mostravam página vazia agora abrem com a moldura do app | `SkeletonPagina.tsx` · 3 guardas · 4 páginas |
| ◐ | **Barra lateral: "Painel" saiu, "Inteligência" assume o topo** | `menu.ts` · `AppTopNav.tsx` |
| ◐ | **Relevo dos cartões do painel** — a borda azul do hover vira profundidade | `index.css` · `QuickAccessGrid` · `OportunidadesPainel` · `StatCard` |
| ◐ | **Mapa do Brasil: malha oficial do IBGE** no lugar dos polígonos à mão | `mapa-brasil-contornos.ts` · `MapaLicitacoesPorEstado.tsx` · `scripts/gerar-mapa-brasil.py` |
| ◐ | **Foto de perfil** — envio, recorte e remoção; cabeçalho maior | `useAvatarPerfil.ts` · `FotoPerfil.tsx` + 3 telas · **1 migration** |
| ◐ | **Ordem do cabeçalho** — sino → sol → engrenagem │ empresa │ avatar | `AppLayout.tsx` · `SkeletonPagina.tsx` |
| ◐ | **Navegador de seções do painel** — salto nomeado entre as seis seções | `NavegadorDeSecoes.tsx` · `Index.tsx` |
| ◐ | **Item ativo do menu do topo estava sem fundo** — `bg-accent/8` não existe | `AppTopNav.tsx` |

**A ordem do cabeçalho.** Vai do EFÊMERO ao PERMANENTE, da esquerda para a
direita. O sino muda sozinho várias vezes por dia — é o mais olhado e o que
precisa de menos mira. O sol muda quando a luz da sala muda. A engrenagem,
raramente. Depois de uma **divisória** vêm os dois campos de identidade — em
qual empresa estou, quem sou eu —, que não são ações: são contexto, e respondem
à mesma pergunta. Sem a divisória, o seletor de empresa vira o quarto de uma
fileira de cinco botões e a pessoa procura ação onde só há informação.

O `SkeletonPagina` repete a mesma ordem. Esqueleto que troca as peças de lugar
faz a barra real "corrigir" a posição ao montar, e o olho lê isso como defeito.

**O navegador de seções.** O botão **nomeia o destino** — "Oportunidades ⌄", não
uma seta solta. Seta que só aponta para baixo é o mesmo que rolar: aperta-se sem
saber quanto anda nem onde chega. Com o nome, ele vira um sumário de um item.
Na última seção vira "Voltar ao topo", e traz um traço por seção mostrando
quanto falta. Lê `[data-secao]` do documento, então a página só marca as seções
— nenhum índice duplicado para desencontrar.

**A opacidade que não existia.** `bg-accent/8` e `bg-accent/6`, em quatro pontos
do `AppTopNav`, **não geram classe nenhuma**: a escala de opacidade do Tailwind
anda de 5 em 5, e valor fora dela é descartado em silêncio. O item ativo do menu
do topo estava sem fundo desde o commit `fee7938b` (Lovable). Achado por
varredura — vale repetir de vez em quando:

```sh
grep -rnE '\b(bg|text|border|ring)-[a-z-]+/[0-9]{1,3}\b' --include='*.tsx' src \
  | grep -oE '(bg|text|border|ring)-[a-z-]+/[0-9]+' | sort -u \
  | awk -F/ '$2 % 5 != 0 {print}'
```

O mesmo erro quase entrou no navegador de seções (`bg-navy/92`), e foi pego
compilando um HTML de sonda com o Tailwind antes de aceitar a classe.

**O relevo dos cartões.** A borda acendia em azul no hover. Isso pinta a
*moldura* para dizer "você está aqui", que é a gramática de **foco**, não a de
alvo clicável — e numa grade de 24 ladrilhos o azul brigava com o ícone, que já
é azul. No lugar entra profundidade: o cartão sobe, cresce e a sombra abre. É o
gesto de levantar um papel da mesa, e funciona **sem cor nenhuma** — passa em
tela monocromática e para quem não distingue matiz. `transform` e `box-shadow`
são as duas propriedades que o navegador anima na GPU sem recalcular layout: 24
ladrilhos crescendo juntos não custam nada.

**O mapa.** Os contornos eram polígonos desenhados à mão — 10 a 20 pontos por
estado, só segmentos retos. Servia para dizer "isto é o Brasil", mas os estados
não tinham a forma deles, e num painel que usa o mapa para **ler concentração**
isso é erro de leitura, não de estética: a pessoa procura o estado dela e não
reconhece.

Agora é a malha oficial do IBGE, projetada em Mercator e simplificada por
Douglas-Peucker: **5.128 pontos**, 65 KB. Sem biblioteca nova — `react-simple-maps`
exigiria `d3-geo` + `topojson-client` e uma malha baixada em runtime, para
entregar o mesmo desenho que um `<path>` estático entrega offline. O gerador
ficou em `scripts/gerar-mapa-brasil.py`; só roda de novo se o IBGE mudar a malha.

Ganhou também: legenda da escala (sem ela o degradê é decoração — nada dizia que
escuro é "mais"), foco ligado nos dois sentidos entre a lista e o mapa, siglas
nos 20 estados que comportam o texto, e o **"N/I" saiu do ranking**. Ele não é
estado: é licitação sem UF preenchida, e aparecia em segundo lugar, acima do
Pará. Virou nota — "14 processos estão sem estado informado e ficam fora do
mapa" —, que é o que ele é: um buraco no cadastro, não um lugar.

**A foto de perfil.** Única entrega da frente que toca o banco, autorizada como
exceção. Precisou de menos do que parecia: `profiles.avatar_url` **já existia**
(conferido contra produção — a consulta devolve lista vazia, não `42703`), e
nunca foi preenchida porque não havia por onde enviar. Não há tabela nova, e não
deveria haver: **foto é arquivo**, e vai para o Storage, como os outros oito
buckets do repo.

A migration `20260904000001_foto_de_perfil.sql` cria só o bucket `avatares` e as
políticas. **Ainda não foi aplicada** — precisa ser colada no SQL Editor.

A imagem é recortada no centro e reduzida para 512px WebP **no navegador**, antes
de subir: foto de celular chega com 4 MB e 4000px de lado, estouraria o limite de
2 MB do bucket, e o app a mostraria num círculo de 40px depois de baixar tudo.
Resolve o limite e o enquadramento sem embarcar um editor de recorte.

O cabeçalho subiu de 48/56px para 56/64px e a esfera do avatar de 28/32px para
36/40px, com anel — sobre o navy, círculo sem contorno encosta no fundo e some.
**As três medidas andam juntas**: `AppLayout`, o `top-` da `AppSidebar` e a
moldura do `SkeletonPagina`.

**Por que o grupo "Painel" deixou de existir.** Ele abria para mostrar
*Dashboard* e *Analytics* — e "Painel" e "Dashboard" são a mesma palavra em dois
idiomas. O grupo abria para repetir o próprio nome.

Os dois itens foram para **Inteligência**, que já reunia Precificação, Proposta,
Análise de Mercado e Concorrentes. A divisão que sobra é limpa: Inteligência
responde **"como estamos indo"**; os demais grupos respondem **"o que preciso
fazer agora"**. Analytics é leitura de desempenho e Dashboard é leitura do dia —
os dois são a primeira pergunta.

O grupo herdou a **primeira posição** da barra, que era a do Painel: quem abre o
sistema quer o número antes da tarefa. O título perdeu o "& Preços" (com seis
itens de naturezas diferentes, o recorte ficou estreito demais) e, por caber
inteiro na coluna de 264px em caixa alta, dispensou o `curto`.

O `AppTopNav` acompanha — o menu do topo lê os mesmos grupos.

**A varredura das telas brancas.** A leva anterior trocou spinner por esqueleto
em `ProtectedRoute` e no `Suspense` das rotas, mas parou aí — e sobrava um
caminho inteiro em que a pessoa via **branco**:

| Onde | O que aparecia | Por que passou batido |
| --- | --- | --- |
| `MaintenanceGuard` | página vazia com um ponto girando | embrulha **todas** as rotas e consulta o modo manutenção em **todo** carregamento: era a primeira coisa depois do splash |
| `PlanGuard` (×2) e `AdminGuard` | idem | rodam DEPOIS do `ProtectedRoute` e FORA do `AppLayout` — davam um pisca branco entre o esqueleto e a página |
| `ProcessoWorkspace` | `h-screen` em branco | desenha a própria moldura, não passa pelo `AppLayout` |
| `PainelDistribuicao` | idem | mesma razão |
| `MetricasSaaS`, `PreferenciasAlertas` | spinner dentro do layout | cabeçalho aparecia, mas a espera não tinha forma |

O `SkeletonPagina` passou a desenhar a **moldura**: barra navy com a logo do
rebrand (`PRAE` em branco + `FECTUS` em `--logo-accent`), coluna lateral de
264px e o conteúdo em esqueleto — as mesmas medidas do `AppLayout`, para a
barra verdadeira substituir a falsa sem deslocar um pixel. Quem chama de dentro
do layout passa `moldura={false}`.

**Splash ou esqueleto?** Os dois, um de cada vez. O splash cobre o vão entre o
HTML chegar e o React montar; depois disso ele sai e **não volta** — reexibi-lo
a cada troca de rota faria o app parecer que reinicia. Daí em diante quem espera
é o esqueleto, e ele herda a identidade do splash: mesma barra navy, mesma logo,
mesmo dourado.

> A quinta linha é dívida nossa, não escolha de escopo. O modal de boas-vindas
> entrega o primeiro clique de um usuário novo em uma tela sem rebrand: a
> apresentação promete um sistema, o destino mostra outro. Quem cria o caminho
> responde pelo destino.

**04/09 — terceira leva: as telas de apoio** — _Ian + Claude_

| | Entrega | Arquivos |
| :---: | --- | --- |
| ◐ | **Documentos** — a barra de conformidade vira segmentada: regular, vencido e ausente lado a lado | `Documentos.tsx` |
| ◐ | **Meus Compromissos** — os cinco números viram cartões `kpi-meta` com nota de contexto | `MeusCompromissos.tsx` |
| ◐ | **Calendário** — mesma anatomia nos cinco cartões + **correção do contador de "Ganhas"** | `CalendarioLicitacoes.tsx` |
| ◐ | **Equipe** — busca por nome, e-mail ou setor; os oito cartões de equipe passam a filtrar | `EquipeColaboradores.tsx` |
| ◐ | **Apoio Jurídico** — abas em faixa rolável, com o rótulo inteiro | `ApoioJuridico.tsx` |

**Por que a barra de Documentos ficou segmentada.** A pergunta de quem abre a
tela não é "quanto está pronto" — é **"consigo me habilitar hoje"**. E quem
responde isso não é o número, é a composição do que falta: dez pendências
*ausentes* se resolvem pedindo os documentos; **uma** *vencida* barra a empresa
no mesmo dia. A barra única de progresso escondia essa diferença. O número
grande também mudou de cor conforme a saúde: enquanto houver vencido ele fica
vermelho mesmo com 90% de conformidade, porque 90% com certidão vencida é
inabilitação.

**Por que as abas do Jurídico mudaram de forma.** A grade de cinco colunas
obrigava cada aba a caber numa fração fixa da largura, e a saída tinha sido
abreviar: "Reequilíbrio" virava *Reequil.*, "Base Jurídica" virava *Base*,
"Legislação" virava *Leis*. Abreviação em rótulo de navegação é a pior troca
possível — economiza pixel e cobra do usuário adivinhar o destino, justamente
onde ele ainda não sabe o que vai encontrar. Na faixa rolável a largura de cada
aba é a do próprio texto, como no `barra-abas` do protótipo.

> ⚠️ **Uma correção de dado saiu junto, e precisa ser conhecida.** O cartão
> "Ganhas" do Calendário comparava `status` com dois literais escritos na
> própria tela:
>
> ```ts
> l.status === 'Vencida' || l.status === 'Homologada'
> ```
>
> É exatamente o padrão que o `CLAUDE.md` proíbe no princípio 1, e pelo mesmo
> motivo histórico (`Homologada` × `Homologado`). A conta perdia processo
> gravado como `Homologado`, `adjudicada`, `vencedor`, `ata_registro` ou
> `contrato assinado` — o número aparecia **menor que a realidade**, num cartão
> que a pessoa usa para conferir resultado.
>
> Não foi para a seção 12 porque a seção 12 é para achado que ESPERA, e a regra
> de lá é explícita: dado errado na tela não espera. Agora passa por
> `normalizarStatus`, que é a autoridade.

**04/09 — heróis de módulo, ícone da Inteligência e o FAB no escuro** — _Ian + Claude_

| | Entrega | Arquivos |
| :---: | --- | --- |
| ◐ | **Robô de Lances** — herói navy com o aperto de mão robô–humano; título e selo de nível sobem para ele, a faixa de baixo fica só com abas + exportar | `RoboLances.tsx` |
| ◐ | **Apoio Jurídico** — herói navy com o martelo sobre o teclado | `ApoioJuridico.tsx` |
| ◐ | **Apoio Contábil** — mesmo herói; **só o cabeçalho**, o resto da tela segue livre | `ApoioContabil.tsx` |
| ◐ | **Precificação** — herói camaleão (reescreve nos 7 abas) e a barra de localização entra nele | `Precificacao.tsx` |
| ◐ | **Gestão de Compras** — herói com o corredor de galpão; **só o cabeçalho**, o resto segue livre | `GestaoCompras.tsx` |
| ◐ | **Gestão de Contratos** — herói com o martelo sobre o teclado; a linha de ações sai da faixa | `GestaoContratos.tsx` |
| ◐ | **Licitações Estratégicas** — herói com o xadrez; **só o cabeçalho**, a tela é do Caio | `LicitacoesEstrategicas.tsx` |
| ◐ | Ícone do grupo **Inteligência**: `Tag` → `Brain` | `menu.ts` |
| ◐ | **FAB da Aurélia no tema escuro**: dourado com o robô preto | `index.css` |

### A anatomia do herói de módulo

Os três são o mesmo desenho, e o próximo também deve ser. Vale a pena ter isto
escrito porque **quase todo parâmetro aqui foi decidido renderizando a faixa e
olhando**, não escolhendo número bonito.

```
faixa      rounded-xl, bg-gradient-to-r from-navy-hover to-navy, md:min-h-[232px]
foto       absolute inset-y-0 right-0, w-[LARGURA] max-w-[52%], hidden md:block
véu 1      lateral — from-navy via-navy/0 via-N% to-transparent
véu 2      de topo — h-[70%], from-navy/N to-transparent
texto      relative, chip dourado + h1 branco + descrição white/75 + selos white/10
```

| | Robô de Lances | Apoio Jurídico | Apoio Contábil | Precificação | Gestão de Compras | Gestão de Contratos | Estratégicas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Arquivo | 512×288 | 1280×720 | 1000×667 | 1280×949 | 1365×587 | 600×400 | 880×293 |
| Largura do painel | 512px | 560px | 640px | 520px | 620px | 560px | 620px |
| Recorte vertical | 45% | 50% | 45% | 62% | 50% | 45% | 50% |
| Véu lateral até | 50% | 55% | 70% | 65% | 60% | 55% | **35%** |
| Véu de topo | 45% | 55% | 50% | 50% | 55% | 55% | 45% |
| `brightness` | — | — | `.85` | `.85` | `.95` | `.85` | `.85` |

**O véu de 35% das Estratégicas é a exceção que ensina a regra.** Em todas as
outras fotos o assunto está à direita do quadro, e o véu longo só come fundo. Na
do xadrez o assunto — a mão e o rei — está no CENTRO, e como o painel tem quase
a largura da imagem, um véu de 55% dissolveria justamente ele, sobrando os peões
da direita. Ou seja: **o véu é função de ONDE está o assunto, não um número
fixo.** Véu curto normalmente deixa emenda visível; ali não deixa porque a borda
esquerda da foto é a manga escura de um terno, que já é da cor do véu.

Lendo a tabela de trás para frente dá para prever o ajuste de uma imagem nova:
**quanto mais clara e quente a foto, mais longe o véu lateral tem que ir e mais
o `brightness` tem que descer.** O corredor de galpão é escuro e acinzentado e
quase não precisou de nada; a mesa de contabilidade, branca, precisou dos dois
no talo. E **quanto mais próxima a foto já é da proporção da faixa, menor o
painel pode ser** — a de Precificação é 4:3 e precisa de recorte agressivo
(62%) para a balança não sair da cena.

**Por que a foto não cobre a faixa inteira.** Esticada de ponta a ponta, uma
foto 16:9 numa faixa de 1400×232 vira uma fatia de 6:1 — o martelo deixou de
ser martelo e virou um cilindro escuro, o aperto de mão virou um punhado de
dedos. Assunto irreconhecível é enfeite, não símbolo. Contida à direita, a foto
aparece quase inteira e o texto fica sobre navy sólido, sem depender de véu
para ter contraste.

**Por que 232px.** É a altura em que o assunto das três fotos aparece inteiro.
Abaixo disso o corte come a cena. E é a MESMA nos três de propósito: módulo
irmão com faixa de outro tamanho lê como descuido.

**Os dois véus fazem trabalhos diferentes.** O lateral derrete a borda esquerda
da foto no navy, para ela não parecer colada por cima da faixa. O de topo apaga
a área mais clara de cada imagem — o brilho da tela do notebook no Jurídico, o
braço robótico no Robô.

**A foto do Contábil precisou de dois ajustes que as outras não.** Ela é clara
— papel branco, mesa branca, pele — enquanto as outras duas já são azul-escuras.
Sobre navy isso vira um bloco aceso com **emenda visível** na borda esquerda. O
`brightness-[.85]` aproxima a foto da família do navy, e o véu lateral se
estende a 70% em vez de 55%, dando mais caminho para a transição.

> **Para escolher a próxima imagem.** Quatro critérios, nesta ordem:
> **1.** 640px de largura no mínimo — o painel chega a 640, e ampliar borra;
> **2.** paisagem, nunca retrato;
> **3.** escura ou azulada de preferência (clara funciona, mas custa os dois
> ajustes do Contábil);
> **4.** nada importante no terço esquerdo da foto — é justamente onde o véu a
> dissolve no navy.
>
> **E antes de commitar: converta para JPEG e limite a 1280px de largura.** A
> imagem de Precificação chegou como PNG de **2,4 MB** — PNG é formato de
> desenho com transparência, não de fotografia, e cada byte aqui entra no
> bundle que TODO usuário baixa. Em JPEG q85 a 1280px ela virou **229 KB**, dez
> vezes menor, sem diferença visível: o painel tem no máximo 640 CSS px, então
> 1280 já cobre tela retina. A de Apoio Contábil caiu de 426 KB para 77 KB pelo
> mesmo caminho. Cinco heróis a 2 MB seriam 10 MB de bundle por uma faixa
> decorativa.
>
> ```sh
> python3 -c "
> from PIL import Image
> im = Image.open('ORIGEM').convert('RGB')
> if im.width > 1280: im = im.resize((1280, round(im.height*1280/im.width)), Image.LANCZOS)
> im.save('DESTINO.jpg', 'JPEG', quality=85, optimize=True, progressive=True)"
> ```
>
> E o critério que não é técnico: **o símbolo tem que ser do módulo, não de um
> vizinho.** O martelo foi cogitado para o Robô de Lances e recusado por isso —
> martelo é Jurídico, e o app tem um módulo Jurídico. Pôr ali faria duas telas
> disputarem o mesmo símbolo, e a que perde é a que tem razão.

**Por que o FAB inverte no escuro.** No claro o botão é navy porque precisa se
destacar de uma página branca; no escuro a página já é navy e o botão sumia,
sobrando só a sombra segurando a silhueta. Invertido, ele vira o ponto mais
claro da interface. O relevo dos três níveis continua — muda de que lado vem a
luz: sobre dourado o brilho de cima é quase branco e a sombra de baixo é
**bronze, não preta** (preto sobre amarelo suja em vez de aprofundar), e a
sombra externa ganha um halo dourado porque sombra preta em página escura não
aparece. O anel de pulso também mudou: dourado em volta de botão dourado deixa
de ler como pulso e vira contorno, então no escuro ele sobe para
`--logo-accent`.

### O que ainda falta — 14 telas, sem dono

**Nenhuma destas está reservada.** Quem pegar escreve o nome na linha e na
tabela de "quem está com o quê" da seção 5, antes de começar.

A ordem é por quanto o protótipo desenhou: quanto maior o número, mais
referência visual existe para seguir e menos decisão de desenho sobra.

**Legenda da primeira coluna:** ☐ livre, ninguém pegou · ◔ **reservada**, alguém
já está nela (o nome vai na linha) · ◐ **parcial**, uma parte já foi feita e o
resto continua livre — a linha diz qual parte · ◔◐ reservada **e** com uma parte
já pronta: o dono da reserva continua sendo o dono do resto.

| | Tela | Rota | Arquivo | Prot. | Hoje |
| :---: | --- | --- | --- | ---: | ---: |
| ☐ | Marketing (admin) | `/admin/marketing` | `AdminMarketing.tsx` | 233 | 392 |
| ☐ | API & Integração | `/api-integracao` | `ApiIntegracao.tsx` | 153 | 138 |
| ◐ | **Gestão de Compras** | `/gestao-compras` | `GestaoCompras.tsx` | 171 | **1.586** |
| ◔◐ | Licitações Estratégicas — **Caio** (herói já feito) | `/licitacoes-estrategicas` | `LicitacoesEstrategicas.tsx` | 121 | 336 |
| ☐ | Chat e Mural | `/monitoramento-chat` | `MonitoramentoChat.tsx` | 100 | 243 |
| ☐ | Concorrentes | `/concorrentes` | `Concorrentes.tsx` | 99 | 51 |
| ☐ | Metas do Comercial | `/metas-comercial` | `MetasComercial.tsx` | 97 | 95 |
| ☐ | WhatsApp CRM | `/whatsapp-crm` | `WhatsAppCRM.tsx` | 75 | 60 |
| ◔ | Histórico de Licitações — **Caio** | `/historico-licitacoes` | `HistoricoLicitacoes.tsx` | 70 | 435 |
| ☐ | Fontes & Fabricantes | `/admin/fontes-fabricantes` | `AdminFontesFabricantes.tsx` | 67 | 362 |
| ☐ | Assessoria Cadastral | `/assessoria-cadastral` | `AssessoriaCadastral.tsx` | 53 | 191 |
| ◐ | Apoio Contábil | `/apoio-contabil` | `ApoioContabil.tsx` | 53 | 160 |
| ☐ | Workflow IA | `/workflow-ia` | `WorkflowIA.tsx` | 44 | 220 |
| ☐ | Empresas | `/empresas` | `Empresas.tsx` | 29 | 145 |

> **Duas linhas estão ◐, não ☐: Gestão de Compras e Apoio Contábil.** Em 04/09
> o Ian trocou nelas só o **cabeçalho**, pelo herói navy com foto. O resto de
> cada tela — abas, busca, cartões, tabelas — continua com o layout antigo e
> continua **livre**. Quem pegar: mexa do `<Tabs>` para baixo e **deixe o herói
> como está**, para os módulos não divergirem entre si.
>
> Isso NÃO tira Gestão de Compras da lista nem diminui o aviso abaixo: as 1.586
> linhas continuam inteiras, o herói são 40 delas.

**Por onde começar: Concorrentes ou Metas do Comercial.** São as que ainda
**fecham módulo inteiro** na grade da seção 11 — Concorrentes fecha o 13, Metas
fecha o 14 sozinha. Terminar um módulo vale mais que terminar tela solta: o
módulo é a unidade que o tech lead revisa.

> As outras duas que fechavam módulo — **Estratégicas e Histórico**, que fecham
> o 3 junto com o Kanban — **o Caio reservou em 04/09**. Elas continuam na
> tabela como ◔ para ninguém começar por cima; quem chegar agora pega
> Concorrentes ou Metas.
>
> E as telas aqui são nomeadas, não numeradas, de propósito: a versão anterior
> deste parágrafo dizia "comece pelas 4, 6, 7 ou 9", contando linhas da tabela.
> Bastou o Caio reservar duas para o conselho mandar todo mundo para telas
> ocupadas. Referência posicional em tabela que muda envelhece calada.

**Gestão de Compras é armadilha.** 1.586 linhas, a segunda maior página do
sistema. Sozinha custa perto do que custam quatro telas médias juntas — merece
uma leva própria, não entra num pacote de cinco.

**Concorrentes tem 51 linhas contra 99 no protótipo.** Provavelmente é casca,
não tela. Confira se há dado por trás ANTES de desenhar; se não houver, é
`TarjaExemplo` ou nada — gráfico bonito com número inventado é pior que gráfico
feio com número inventado, porque a paleta nova empresta credibilidade que o
dado não tem.

**Três telas ficam fora desta lista de propósito.** `Configurações`,
`Ferramentas IA` e `Jurídico` têm 1, 1 e 5 linhas no protótipo — não há
referência para seguir. Herdam a paleta pelos tokens e ficam como estão até
alguém desenhá-las. Não são dívida; são trabalho que ainda não existe.

**Nenhuma das 14 encosta** em `index.css`, `tailwind.config.ts`,
`components/ui/` ou na navegação.

**Caio, três coisas que você precisa saber destas telas:**

1. **`TarjaExemplo` é para usar.** Todo bloco com número fixo no código leva a
   tarja — sem exceção para "é só um exemplo". Gráfico bonito com número
   inventado é PIOR que gráfico feio com número inventado: a paleta nova
   empresta credibilidade que o dado não tem. Se a tela fica mais convincente,
   o aviso precisa ficar mais visível junto. Quando o bloco passar a ler o
   banco, a tarja sai.

2. **O protótipo está errado no healthcheck do Robô.** Ele traz "Healthcheck de
   Seletores — 12 OK · 3 falhas". A verificação faz uma requisição HTTP: nunca
   abre navegador, nunca testa seletor. O texto certo, que está no app desde
   02/09, é "Portais no ar — 12 responderam". **Não alinhe ao protótipo aqui.**

3. **Contraste: a sua paleta passou inteira.** Zero pares abaixo de 4.5:1 (AA)
   nos dois temas. Os mais apertados são `warning-ink` sobre `warning-tint`
   (4.53) e `success-ink` sobre `success-tint` (4.64) no claro — passam, mas
   sem folga. Se alguém escurecer a tinta, quebram.

Conferido a cada entrega: `npx tsc --noEmit -p tsconfig.app.json` limpo,
`npx eslint` sem erro novo nos arquivos tocados, e a suíte em 73 arquivos /
1091 testes passando.

Três decisões tomadas no caminho, todas divergindo do protótipo de propósito:

1. **A seta do mascote foi refeita.** A do protótipo é uma bezier de ~525px com
   ponta arredondada — traço longo, curvatura baixa e cabeça pequena, que é a
   receita do rabisco a lápis. Aqui o card encosta na coluna e o conector é
   curto, com ponta reta e cabeça sólida. O holofote e o anel pulsante, que são
   a parte boa, ficaram como estavam.
2. **O acesso de demonstração do login não veio** (`caio-teste@… / 123456`), nem
   a área de arrastar certificado, nem o "Manter conectado". Os dois últimos não
   têm lógica atrás no app: caixa que aceita arquivo sem receber arquivo e
   caixinha marcada que não liga nada são promessa falsa na porta de entrada.
3. **O "Celular" do hub de perfil ficou de fora.** `profiles` tem `telefone`, não
   tem `celular`. Campo que aceita digitação sem ter onde guardar é pior que
   campo ausente. Entra quando alguém decidir a coluna.

E dois achados que **não são do rebranding**, mas apareceram e precisam de dono:

- **A faixa de destaque do painel é texto fixo.** Dizia "Agenda atualizada" e
  "Novidades no Robô de Lances" para todo cliente, para sempre. Trocado por um
  texto que aponta a funcionalidade em vez de anunciar novidade, e marcado no
  código como provisório. Quando ganhar dado de verdade, o candidato natural é a
  próxima sessão da empresa — o `useAnalyticsData` do painel já traz
  `data_abertura`, `orgao`, `numero` e `objeto`.
- **O cadastro descarta oito dos nove campos que coleta.** `signUp()` manda só
  `nome_completo`; cargo, celular, telefone empresarial, CNPJ, UF, como conheceu,
  quantidade de funcionários, licitações por mês e faturamento somem em silêncio
  ([AuthContext.tsx:222](../src/contexts/AuthContext.tsx#L222)). Por isso
  `profiles.cargo` e `profiles.telefone` chegam vazios no hub de perfil.

### As rotas de cada módulo

| # | Módulo | Rotas |
| --- | --- | --- |
| 1 | Autenticação & Onboarding | `/auth` `/cadastro` `/reset-password` `/aceitar-convite` `/certificado-upload` |
| 2 | Painel & Navegação | `/` `/dashboard` `/avisos` |
| 3 | Licitações & Kanban | `/licitacoes` `/kanban` `/licitacoes-estrategicas` `/historico-licitacoes` `/processo/:id` |
| 4 | Monitoramento & Busca | `/monitoramento-editais` `/diarios-oficiais` `/busca-inteligente` `/boletins` `/perfis-alerta` `/configuracoes/alertas` |
| 5 | Precificação | `/precificacao` `/produtos` |
| 6 | Proposta & Envio | `/proposta-tecnica` `/comprasgov-envio` |
| 7 | Robô de Lances | `/robo-lances` |
| 8 | Contratos | `/gestao-contratos` `/indices-repactuacao` |
| 9 | Compras & Fornecedores | `/gestao-compras` |
| 10 | Financeiro | `/financeiro` `/financeiro/:view` `/auditoria-bancos` `/relatorio-contabil` `/admin/financeiro` |
| 11 | Apoio Jurídico | `/apoio-juridico` `/apoio-juridico/redigir/:modeloId` |
| 12 | Apoio Contábil | `/apoio-contabil` |
| 13 | Análise de Mercado & Concorrentes | `/analise-mercado` `/concorrentes` |
| 14 | Metas | `/metas-comercial` `/definir-metas` |
| 15 | IA & Assistentes | `/assistente` `/aurelia` `/assistente-especializado` `/agente` `/workflow-ia` `/ferramentas` |
| 16 | Comunicação | `/whatsapp-crm` `/whatsapp-setores` `/monitoramento-chat` |
| 17 | Documentos & Cadastro | `/documentos` `/assessoria-cadastral` `/empresas` |
| 18 | Agenda | `/calendario` `/meus-compromissos` |
| 19 | Equipe & Configurações | `/equipe` `/equipe/permissoes` `/configuracoes` |
| 20 | Admin | `/admin/templates` `/admin/fontes-fabricantes` `/admin/marketing` `/admin/auditoria` `/admin/distribuicao` `/admin/mural-telemetria` `/admin/metricas-saas` |
| 21 | Conteúdo & Suporte | `/blog` `/ebook` `/tutorial` `/suporte` `/ajuda` `/faq` `/api-integracao` `/analytics` `/status` |
| 22 | Institucional & Legal | `/landing` `/index` `/sobre` `/contato` `/solucoes` `/demo` `/investidores` `/termos-de-uso` `/politica-de-privacidade` `/lgpd` `/dpa` `/compliance` `/seguranca-informacao` `/politica-cookies` `/politica-sla` `/aviso-legal` `/unsubscribe` |

### As lacunas do protótipo que esta frente precisa cobrir

O protótipo é direção, não gabarito — e tem buracos reconhecidos. Copiá-lo tal
como está deixaria o app pior em cinco pontos. Cada um vira decisão nossa:

| Lacuna no protótipo | O que fazemos | Fatia |
| --- | --- | --- |
| **Sem tema escuro** (zero `.dark` em 19.227 linhas) | derivar as 47 variáveis por regra e ajustar à mão | 1 |
| **28 `box-shadow` escritas à mão**, contra 4 tokens | derivar uma escala de 6 e expor em `boxShadow` no config | 1 |
| **10 gradientes, nenhum tokenizado** | refazer os 6 `--gradient-*` do app com navy→azul→dourado | 1 |
| **`--linha` e `--linha-tint` são variáveis fantasma** — usadas em `.secao-cat__head` e `.mod__ic`, injetadas inline pelo JS, ausentes do `:root` | viram tokens de verdade (é o mesmo defeito já corrigido em `--text-primary`, documentado no próprio protótipo) | 1 |
| **Nenhum `:focus-visible` em `.btn`, `.aba`, `.tag`, `.chip` ou links** — o único anel padronizado é o `0 0 0 3px var(--primary-tint)` do `.campo` | **não copiar a falha.** O app já tem `focus-visible:ring-2` em todo componente shadcn; mantemos, tokenizado com o `--ring` azul novo | 3 |
| **Faltam tokens para `20px`** (a pílula universal: tags, badges, contadores, barras) **e `6px`** (pílula interna de segmented control) | nascem junto com `--radius-sm/md/lg` | 3 |
| **11 famílias de KPI e 4 de cartão**, fragmentadas | consolidar nas duas boas — `.crt-*` e `.mk-kpi`, que usam `auto-fit` + `clamp()` + `min()` e dispensam breakpoint | 3 |

### O que o `tailwind.config.ts` hoje não entrega

Descoberto ao conferir, e muda o alcance da fatia 1: **não existe chave
`boxShadow` no config**. As classes `shadow-sm`/`shadow-md`/`shadow-lg` usadas em
`card.tsx`, `.stat-card` e `.glass-card` são as **sombras default do Tailwind** —
não os tokens `--shadow-*`, que só chegam à tela em 2 regras de CSS e 1
ocorrência em `.tsx`. Trocar `--shadow-*` hoje quase não muda nada.

Mesma situação com `--gradient-*`: sem `backgroundImage` no config, apenas 4
ocorrências em `.tsx` os consomem.

Expor as duas famílias no config é a mudança de maior alcance visual pelo menor
diff — e é token, não lógica.

Duas limpezas para a mesma passada:

- **`--sidebar-bg` é código morto** — declarada duas vezes (`:100` e `:170`) e com
  **zero consumidores** no repositório inteiro. O `sidebar.DEFAULT` do Tailwind
  aponta para `--sidebar-background`, não para ela.
- **`.kanban-card` está declarada duas vezes** em `index.css` (linhas 356 e 449,
  em blocos `@layer utilities` diferentes). As duas se somam por cascata; mexer
  numa sem a outra é armadilha.

---

## 12. Achados de lógica — fora do escopo desta frente

Esta etapa mexe só na aparência; a regra está na seção 1 e vale. Mas quem
repinta 448 arquivos passa por trechos que ninguém abria há meses, e algumas
coisas aparecem no caminho.

**Nada aqui foi consertado.** Cada item é defeito de comportamento ou de
verdade, não de cor — arrumar dentro do rebrand romperia a garantia de que
"nenhuma tela deixa de fazer o que fazia", e é o tipo de mudança que precisa de
dono, decisão e teste próprios.

Estão listados para virar tarefa. Quem for pegar: leia a coluna "Por que
importa" antes de estimar — algumas parecem cosméticas e não são.

| # | Achado | Onde | Por que importa | Custo |
| --- | --- | --- | --- | --- |
| 1 | **O cadastro descarta 8 dos 9 campos que coleta.** `signUp()` manda só `nome_completo`; cargo, celular, telefone empresarial, CNPJ, UF, como conheceu, nº de funcionários, licitações/mês e faturamento somem em silêncio | [`AuthContext.tsx:222`](../src/contexts/AuthContext.tsx#L222) | A pessoa preenche um formulário longo achando que informou. E é por isso que `profiles.cargo` e `profiles.telefone` chegam vazios no hub de perfil | médio — decidir onde cada campo mora antes de gravar |
| 2 | **Analytics não é tempo real.** `useAnalyticsData` busca uma vez, na montagem e na troca de empresa: sem `subscribe`, sem `refetchInterval` | [`useAnalyticsData.ts`](../src/hooks/useAnalyticsData.ts) | O texto que prometia isso já foi corrigido (04/09). Ligar de verdade é barato: o Realtime do Supabase já roda em **29 arquivos** deste repo, e o padrão é de 5 linhas. **Não usar `refetchInterval`** — a consulta puxa todas as licitações da empresa sem `limit`, e pesquisar a cada 30s custaria milhares de linhas por minuto para um dado que muda poucas vezes ao dia | baixo — ~30 min |
| 3 | **A faixa de destaque do painel é texto fixo.** Dizia "Agenda atualizada" e "Novidades no Robô de Lances" para todo cliente, para sempre | [`Index.tsx`](../src/pages/Index.tsx) · `BannerDestaque.tsx` | O texto já foi trocado por um que aponta a funcionalidade em vez de anunciar novidade, e está marcado como provisório no código. Para virar dado de verdade, o candidato natural é a **próxima sessão da empresa** — o `useAnalyticsData` da mesma página já traz `data_abertura`, `orgao`, `numero` e `objeto`, então custa zero consulta nova. Filtrar por `STATUS_ANDAMENTO` de [`licitacao/status.ts`](../src/lib/licitacao/status.ts), nunca por lista reescrita no componente | baixo |
| 4 | **`/admin/mural-telemetria` não aparece em menu nenhum.** É rota real, com `AdminGuard` | [`App.tsx:180`](../src/App.tsx#L180) · `menu.ts` | Só chega quem digita a URL. São 7 de 8 rotas de admin no menu; esta é a que falta | trivial — uma linha |
| 5 | **`profiles` não tem `celular`.** O protótipo mostra "Telefone" e "Celular" separados; o banco tem um campo só | `profiles` · `perfil/secoes/SecaoPerfil.tsx` | O hub de perfil ficou com um campo só, de propósito: caixa que aceita digitação sem ter onde guardar é pior que campo ausente. Se os dois forem mesmo necessários, é migration | trivial + migration |

### O que fazer quando aparecer mais um

Não conserte no meio de uma fatia de rebrand — **acrescente uma linha aqui**. O
custo de anotar é um minuto; o de misturar comportamento com aparência é uma
fatia que ninguém consegue reverter sem levar junto o que funcionava.

Se o achado for grave o bastante para não esperar (dado errado na tela, algo que
faz o usuário perder prazo), aí sai desta lista e vira correção na `main`, na
frente própria — não na branch do rebrand.
