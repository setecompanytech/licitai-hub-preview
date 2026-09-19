# Design System v3 do Praefectus — manual de aplicação

**Origem:** comando do dono do produto, 19/09/2026 — redesign visual completo,
exclusivamente na camada de apresentação. Este manual é o que qualquer pessoa
(ou agente) precisa para aplicar o padrão a uma tela sem tocar em lógica.

| | |
| --- | --- |
| Tokens | `src/index.css` (`:root` e `.dark`) · `tailwind.config.ts` |
| Classes de apoio | `src/styles/ds-app.css` (`.ds-*`), `.g-*` em `index.css` |
| Componentes base | `src/components/ui/*` (shadcn, já repintados) |
| Moldura | `AppLayout` = `AppSidebar` (navy, 248/72px) + `AppHeader` (topbar branca, 60px) + conteúdo (teto 1520px) |
| Páginas | `CabecalhoPagina` (telas de menu) · `TelaGestao` (registro) · `SecaoGestao` |
| Indicadores | `StatCard` (painel) · `FaixaIndicadores` (Gestão) · `LinhaKpis` · `KpiStrip` (faixa densa) |
| Tabelas | `TabelaGestao` (com versão de celular) · `ui/table` (Financeiro, Admin) |
| Filtros | `BarraFiltros` |
| Estados | `SeloSituacao` · `Badge` (variantes `success/info/warning/danger/muted/ia`) · `StatusBadge` |
| IA | `SeloPraefectusIA` (Badge `ia` + `Sparkles` em teal) |
| Vazio / espera | `EstadoVazio` (`preencher` ocupa a altura do contêiner) · `Skeleton` / `SkeletonCorpo` |

---

## 1. A regra número um: só aparência

Mexe-se em **JSX de apresentação, classes, ícones, espaçamento, ordem visual e
invólucros**. Não se mexe em: `useEffect`, `useState`, handlers, consultas
(`supabase.`), cálculos, validações, máscaras, rotas, textos que mudam o
sentido, nomes de campo, props que a API consome.

Teste ao terminar um arquivo — o diff não pode acrescentar nada disto:

```sh
git diff -- <arquivo> | grep -E '^\+' | grep -E 'useEffect|useState|supabase\.|await |\.filter\(|\.map\(|=>' 
```

O que aparecer precisa ser `.map()` de renderização ou handler que já existia
e só mudou de linha. Na dúvida, desfaça.

**Cor nunca é escrita à mão em `.tsx`.** Nada de `#2563EB`, `bg-blue-600`,
`hsl(215 …)` inline nem `rgba(...)` em `style`. Se faltar um token, ele nasce
em `index.css` (claro e escuro) e no `tailwind.config.ts`. As exceções são
documento gerado (PDF, DOCX, prévia impressa) e marca de terceiro (logo de
banco) — ver `docs/rebranding-front-end.md`, seção 8.

## 2. Paleta (tokens)

| Uso | Token | Classe |
| --- | --- | --- |
| Fundo da página | `--background` #F5F7FA | `bg-background` |
| Cartão, campo, topbar | `--card` #FFF | `bg-card` |
| Cabeçalho de tabela, coluna de kanban, superfície rebaixada | `--secondary` #F8FAFC | `bg-secondary` |
| Hover de linha/menu, ladrilho neutro | `--muted` #EEF2F6 | `bg-muted` |
| Borda de cartão/divisória | `--border` #E5EAF0 | `border-border` (padrão de `border`) |
| Borda de campo | `--input` #D7DEE7 | `border-input` |
| Texto principal | `--foreground` #172033 | `text-foreground` |
| Texto secundário | `--muted-foreground` #64748B | `text-muted-foreground` |
| Texto terciário / placeholder | `--foreground-tertiary` #94A3B8 | `text-foreground-tertiary` |
| **Ação** (botão primário, link, foco, seleção, sucesso) | `--primary` #087F5B | `bg-primary`, `text-primary`, `ring-ring` |
| Superfície da ação (item ativo, realce) | `--primary-tint` / `--primary-line` | `bg-primary-tint border-primary-line` |
| Teal tecnológico (IA, indicador positivo, ícone) — nunca texto sobre branco | `--teal` #08A88A | `text-teal`, `bg-teal` |
| Estrutura (sidebar, tooltip, título institucional) | `--navy` #0F1E35 | `bg-navy`, `text-navy`, `bg-navy-tint`; texto sobre navy em `text-navy-foreground` |
| Azul corporativo (ícone de módulo, rótulo institucional) | `--brand-blue` #1F4E79 | `text-brand-blue` |
| Informativo (em disputa, aviso neutro) | `--info` #2563EB + trio | `bg-info-tint text-info-ink border-info-line` |
| Sucesso | trio `success` | `bg-success-tint text-success-ink border-success-line` |
| Alerta | trio `warning` (#F59E0B só em ícone/barra) | `bg-warning-tint text-warning-ink border-warning-line` |
| Erro | trio `destructive` (#DC2626) | `bg-destructive-tint text-destructive-ink border-destructive-line` |

Proporção: ~80% neutros, ~20% destaque. Verde só para ação/sucesso/IA/
seleção. Azul só para informação. Nunca duas cores de destaque disputando a
mesma tela; nunca gradiente fora do herói institucional.

`--accent` é igual ao primário (57 arquivos usam `text-accent`); hover de menu
usa `bg-muted`, não `bg-accent`.

## 3. Tipografia (Inter)

| Papel | Classe | Tamanho |
| --- | --- | --- |
| Título de página | `h1` padrão ou `text-[1.75rem] leading-9 font-semibold` | 28/36 · 600 |
| Título de seção | `h2` / `text-lg font-semibold leading-6` (ou `g-titulo-secao` 20/28) | 18–20 · 600 |
| Título de cartão | `CardTitle` / `text-base font-semibold leading-6` | 16/24 · 600 |
| Texto padrão | `text-base` (= 14px) — o corpo do app | 14/20 · 400 |
| Secundário / célula de tabela | `text-sm` | 13/18 |
| Rótulo de campo | `Label` (`text-sm font-medium`) | 13 · 500 |
| Metadado, badge, rótulo de coluna | `text-xs` | 12/16 |
| KPI | `text-[1.75rem] leading-9 font-semibold tabular-nums` (28) ou `text-2xl` (24) | 650–700 |

Escala Tailwind: xs 12 · sm 13 · base 14 · lg 16 · xl 18 · 2xl 20 · 3xl 24 ·
4xl 28 · 5xl 32. `text-[Npx]` arbitrário só quando a escala não tem o degrau.
Dígitos em coluna: `tabular-nums`. Título em caixa alta só para eyebrow de
grupo (`text-xs font-semibold uppercase tracking-wider text-muted-foreground`).

## 4. Forma

| | |
| --- | --- |
| Cartão | `rounded-lg` (10px) · `border border-border` · `bg-card` · `shadow-sm`; hover clicável: `hover:border-primary/40 hover:shadow-md` |
| Botão / campo / select | 40px (`h-10`), `rounded-md` (8px); `sm` 36px; `lg` 44px; variantes `default` (uma por contexto) · `outline` · `secondary` (tonal) · `ghost` · `destructive` · `ghost-destructive` (lixeira de linha, tinta vermelha sem fundo) · `link` |
| Chip / badge / selo | `rounded-sm` (6px), 22px, `text-xs font-semibold` |
| Modal / drawer / menu | `rounded-xl` (12px) · `shadow-xl`; véu `bg-navy/45` |
| Herói institucional | `rounded-2xl` (16px) — único lugar acima de 12px |
| Sombra | `shadow-sm` repouso · `shadow-md` hover · `shadow-lg` menu · `shadow-xl` modal |
| Ícones | Lucide, `strokeWidth` padrão (2) ou 1.9 na navegação; 16px em botão/célula, 18–20px em item de menu/cartão, 24px só em estado vazio |
| Transição | `transition-colors duration-150` (padrão global 150ms) |
| Espaçamento | múltiplos de 4: `gap-2/3/4/6`, `p-4/5`, `mb-6/8`; grade de 12 colunas com `gap-6` no desktop e `gap-4` abaixo de `lg` |

Não usar: `rounded-2xl/3xl` em componente corporativo, `shadow-2xl`, gradiente
decorativo, glassmorphism, ícone colorido por matiz próprio, `text-[2rem]+`
fora de KPI, `bg-*/10` composto na mão (use o trio `tint/ink/line`).

## 5. Anatomias

**Página (tela de menu)**
```
<AppLayout>
  <CabecalhoPagina rota="/x" acoes={<Button>Ação principal</Button>} filtros={…} />
  <FaixaIndicadores itens={…} />           (ou LinhaKpis / StatCard)
  <BarraFiltros busca=… aoBuscar=…>selects</BarraFiltros>
  <TabelaGestao … />                        (ou <Table> de ui/table)
```

**Cartão KPI (110–130px):** rótulo `text-sm font-medium text-muted-foreground`
em cima · valor `text-[1.75rem] leading-9 font-semibold tabular-nums` · ícone
32px num ladrilho `rounded-md` tingido no canto superior direito · linha de
contexto `text-xs text-muted-foreground`. Nunca cartão gigante nem centralizado.

**Tabela:** `thead` em `bg-secondary`; `th` `h-11 px-4 text-xs font-semibold
tracking-wide text-muted-foreground` (sem caixa alta); `td` `h-12 px-4 text-sm`;
`tr` `border-b border-border hover:bg-muted/60`; números à direita com
`tabular-nums`; ações secundárias num menu "⋯" (`DropdownMenu`) quando houver
mais de três; rolagem horizontal presa ao contêiner (`overflow-x-auto`).

**Status:** `Badge` com variante semântica (`success` ganha/ativo, `info` em
disputa/andamento, `warning` pendente/aguardando, `danger` perdida/vencida,
`muted` encerrada/arquivada) ou `SeloSituacao` (`tom`: neutro, ativo, info,
sucesso, atencao, critico, indisponivel). Sempre com TEXTO. Para status de
processo, `aparenciaStatus()` de `lib/licitacao/status.ts` já traz as classes
certas. `FaixaIndicadores` e `LinhaKpis` têm o mesmo vocabulário de tom no
ladrilho do ícone (`neutro/ok/info/aviso/critico`).

**Busca com nome acessível:** `BarraFiltros` aceita `rotuloBusca` (vira o
`aria-label` do campo); sem ele, o nome acessível é o placeholder.

**Formulário:** `Label` acima do campo, `Input`/`Select`/`Textarea` de 40px,
campos em grade `grid gap-4 sm:grid-cols-2`, seções agrupadas por assunto com
`SecaoGestao` ou `h3` de 16px, rodapé de ações alinhado à direita
(`DialogFooter` em modal). Não mudar campo, máscara, validação nem obrigatoriedade.

**Modal:** `DialogContent` (12px, véu navy), `DialogHeader` com título 18px,
`DialogFooter` com `Cancelar` (`variant="outline"`) e a ação principal
(`default`), destrutiva em `destructive`.

**Vazio:** `EstadoVazio` com ícone, título curto e a ação que tira do vazio;
`tamanho="compacto"` dentro de cartão, `preencher` quando o contêiner tem altura
(painel de prévia, coluna, aba fixa).
**Espera:** `Skeleton` na forma do conteúdo; nunca spinner grande no centro.

**IA:** selo `Praefectus IA` = `<SeloPraefectusIA />` (`shared/`), que é um
`<Badge variant="ia">` (tinta verde discreta) com
ícone `Sparkles` em `text-teal`; superfícies da
Aurélia em `bg-muted`/`bg-primary-tint`, nunca escuras; balões `rounded-lg`,
mensagem do usuário na tinta verde, da IA em `bg-muted`.

**Kanban:** coluna `bg-secondary rounded-lg p-3` (≈300px), cartão
`bg-card rounded-md border border-border shadow-sm p-3` com processo, órgão,
data, status (badge) e valor quando houver. Arrastar continua igual.

## 6. Roteiro por tela

1. Identifique lógica e trave-a: hooks, handlers, consultas, cálculos ficam onde
   estão.
2. Cabeçalho → `CabecalhoPagina` (ou `TelaGestao`). Tela de admin com `<h1>`
   cru passa a usar `CabecalhoPagina rota="/admin/..."` (o registro
   `paginas.ts` já tem título e descrição).
3. Indicadores → `FaixaIndicadores` / `LinhaKpis` / `StatCard`.
4. Filtros → `BarraFiltros` (busca larga + selects + ação à direita).
5. Tabela → cabeçalho, linhas e ações conforme a anatomia; `ui/table` já vem
   repintado — remova classes que o contrariem (`bg-muted/50` no `thead`,
   `text-sm` no `th`, `p-4` etc.).
6. Cartões → `rounded-lg border bg-card shadow-sm p-4/5`; título 16/600.
7. Cores à mão → tokens. Raios `2xl/3xl` → `lg`. `text-[15px]`/`[13px]` → escala.
8. Estados vazio/erro/espera → `EstadoVazio`, `Alert`, `Skeleton`.
9. Confira nos dois temas (a paleta escura é derivada — texto sobre tinta é
   onde ela falha).
10. Gates: `npx tsc --noEmit -p tsconfig.app.json` (0 erros nos seus arquivos),
    `npx eslint <arquivos>` (nenhum problema novo — compare com
    `git show HEAD:<arquivo> | npx eslint --stdin --stdin-filename <arquivo>`),
    `npx vitest run <testes do módulo>`. Não rode `npm run build` em paralelo
    com outra frente.
