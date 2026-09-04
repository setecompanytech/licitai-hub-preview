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
```

Depois da normalização, os dois comandos devem retornar **só os 9 da lista de
cima**. Qualquer nome novo é cor escapando do sistema.

Conferido em 02/09/2026 — é exatamente o que eles retornam.

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
| 1 | Autenticação & Onboarding | 5 | ✅ | ☐ | ☐ | ☐ | ◐ | ☐ |
| 2 | Painel & Navegação | 3 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | Licitações & Kanban | 5 | ✅ | ☐ | ☐ | ☐ | ◐ | ☐ |
| 4 | Monitoramento & Busca | 6 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Precificação | 2 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | Proposta & Envio | 2 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | Robô de Lances | 1 | ✅ | ☐ | ☐ | ☐ | ◐ | ☐ |
| 8 | Contratos | 2 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | Compras & Fornecedores | 1 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | Financeiro | 5 | ✅ | ☐ | ☐ | ☐ | ◐ | ☐ |
| 11 | Apoio Jurídico | 2 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 12 | Apoio Contábil | 1 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 13 | Análise de Mercado & Concorrentes | 2 | ✅ | ☐ | ☐ | ☐ | ◐ | ☐ |
| 14 | Metas | 2 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 15 | IA & Assistentes | 6 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 16 | Comunicação | 3 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 17 | Documentos & Cadastro | 3 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 18 | Agenda | 2 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 19 | Equipe & Configurações | 3 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 20 | Admin | 7 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 21 | Conteúdo & Suporte | 9 | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 22 | Institucional & Legal | 17 | — | ☐ | ☐ | ☐ | ☐ | ☐ |

**Onde está o trabalho sem desenho.** O módulo 22 (17 rotas: landing, sobre,
contato, soluções, demo, investidores e as 11 páginas legais) é o único grupo
inteiro que o protótipo não cobriu. Somado às telas internas dos outros módulos
que ficaram de fora, dá as ~46 telas sem referência visual: elas herdam a paleta
pelos tokens e mantêm o layout atual até alguém desenhar.

### O que já está escrito, e por quem

Atualizado em 03/09/2026. Tudo abaixo vive na `feature/rebrand-ui-ux` e **ainda
não voltou para a `main`** — é o que o ◐ da grade acima quer dizer.

#### Caio Gabriel — commits `c520f26a` e `a63f2dcc`

> Deixei sem marca de propósito: **quem marca é quem fez.** Caio, é só trocar
> ☐ por ◐ nas linhas abaixo e nas colunas Tok/Tip/Lay da grade acima.

| | Entrega | Arquivos |
| :---: | --- | --- |
| ☐ | Paleta navy + dourada, tipografia Inter, escala compacta | `src/index.css` · `tailwind.config.ts` |
| ☐ | Barra lateral nova, com busca e grupos recolhíveis | `AppSidebar.tsx` (novo) |
| ☐ | Menu como autoridade única, lido pela lateral **e** pelo topo | `src/lib/navegacao/menu.ts` (novo) |
| ☐ | Painel: faixa de destaque, oportunidades, mapa por estado | `Index.tsx` · 4 componentes novos em `dashboard/` |
| ☐ | Central de avisos agrupada por dia | `CentralAvisos.tsx` |
| ☐ | Tema padrão passa de escuro para claro | `App.tsx` |

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

**04/09 — telas de maior tráfego** (o prazo virou entrega única; ver seção 8)

| | Entrega | Arquivos |
| :---: | --- | --- |
| ◐ | **Financeiro** — herói com saldo, projeção e curva de 6 meses. Dado REAL, `useResumoFinanceiro`, zero consulta nova. Aditivo: entra acima do `FinHomeHub`, que continua inteiro | `FinHeroPainel.tsx` (novo) · `Financeiro.tsx` |
| ◐ | **Análise de Mercado** — modalidade passa a ler o banco e vira "Sua carteira"; os 4 blocos que continuam fixos ganham tarja | `AnaliseMercado.tsx` · `TarjaExemplo.tsx` (novo) |
| ◐ | **Kanban** — `kb-barra` do protótipo, com filtro do board por número, órgão e objeto (sem acento, sem caixa) | `KanbanPage.tsx` |
| ◐ | **Robô de Lances** — cabeçalho em duas fileiras; o selo de nível sobe para ele e vira atalho para a parada de emergência | `RoboLances.tsx` |
| ◐ | Três esperas do Robô viram esqueleto, cada uma com a forma do que vem | `CredenciaisPortalForm` · `DeteccaoPortais` · `PortalHealthcheck` |
| ◐ | **Analytics** — o título deixa de prometer tempo real; o rodapé também. Só texto, o dado sempre foi verdadeiro (achado 2 da seção 12) | `Analytics.tsx` |
| ◐ | **Varredura de contraste** — 17 pares de texto/fundo calculados nos dois temas | (verificação, sem alteração) |

**04/09 — segunda leva: a jornada de ponta a ponta**

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
