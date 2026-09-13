# Padrão visual do módulo Gestão

Contrato de composição das dez telas de Gestão, fixado pelo comando de
13/09/2026 e pelas 22 referências aprovadas junto com ele. Vale para
Estratégicas, Compromissos, Calendário, Workflow IA, Kanban, dossiê do
processo, Robô de Lances, Histórico, Metas do Comercial, Contratos/ATAs e
Compras/Pedidos/Estoque.

As referências definem **composição**: onde cada coisa fica, que proporção
ocupa, que densidade tem. Elas **não** definem dados, cálculo, permissão ou
regra de negócio — números, nomes, datas e status que aparecem nelas são
ilustrativos. Quando a referência contradiz o sistema, **a regra existente
vence e a apresentação se adapta**.

---

## 1. Moldura (já implementada, não refazer)

| Peça | Onde | O quê |
| --- | --- | --- |
| Coluna de navegação | `src/components/layout/AppSidebar.tsx` | 240px, navy, recolhível (68px). Marca ≤180px, busca única (⌘K) abaixo dela, grupos recolhíveis, item ativo com fundo verde e texto branco |
| Faixa superior | `src/components/layout/AppLayout.tsx` | Branca, 64px. Voltar + trilha à esquerda; empresa, sino, tema e avatar à direita |
| Trilha | `src/components/layout/TrilhaDoTopo.tsx` | Vem de `paginas.ts`; `extra` acrescenta o identificador do registro aberto |
| Área principal | `AppLayout` | Fundo `--background`, 24px de respiro (16px no celular), sem teto de largura |

A tela **não** desenha moldura, trilha nem respiro: ela começa no título.

---

## 2. Tipografia e medidas

Classes em `src/index.css`, escopadas por uso — não mexa na escala global do
Tailwind, ela serve aos outros módulos e foi calibrada para leitura, não para
densidade de sistema.

| Classe | Papel | Medida |
| --- | --- | --- |
| `g-titulo-pagina` | `h1` da tela | 26/34, peso 700 (22/30 no celular) |
| `g-titulo-secao` | `h2` de bloco | 18/26, peso 600 |
| `g-corpo` | texto e controles | 14/20 |
| `g-meta` | rótulo, selo, carimbo | 12/16 |
| `g-cartao` | superfície branca | borda `--border`, raio 8px, sombra discreta |
| `g-controle` | input e botão | altura mínima 40px (44px e 16px de fonte no celular) |

Tokens de medida (`:root`): `--g-raio` 8px · `--g-controle` 40px ·
`--g-linha` 44px · `--g-painel` 384px · `--g-topo` 64px.

Espaçamento em 4, 8, 12, 16, 24, 32 — `gap-1 gap-2 gap-3 gap-4 gap-6 gap-8`.
Cor **só** por token (`hsl(var(--token))` ou classe Tailwind mapeada). Nenhum
hexadecimal dentro de `.tsx`.

---

## 3. Componentes compartilhados — `src/components/gestao/`

### `TelaGestao` · `SecaoGestao`
Cabeçalho da tela: título, selos ao lado, descrição **curta**, linha de
contexto, ações à direita (uma principal só), abas abaixo.
Objeto de licitação extenso **não** vai no cabeçalho — vai no Resumo, com
`TextoExpansivel`.

### `AbasGestao` + `useAbaNaUrl` (`src/lib/navegacao/aba-na-url.ts`)
Abas sublinhadas, ativa em verde, rolagem presa à fila. A aba mora em `?aba=`
para o voltar do navegador e o F5 caírem onde a pessoa estava.

### `FaixaIndicadores`
KPIs em tira baixa (valor 20px), não em painel. `valor: null` vira "—" com a
razão — **nunca 0**. `aoClicar` liga o indicador ao filtro da tabela.

### `BarraFiltros`
Busca larga, filtros em fila, "Limpar filtros" quando há algo aplicado, ação
principal à direita. No celular os filtros colapsam num painel com contador.

### `TabelaGestao`
Linhas de 44px, números à direita com `tabular-nums`, ordenação por coluna,
tarja verde no registro selecionado. No celular vira lista de cartões com as
colunas marcadas `prioridade: 'sempre'`; o resto se lê no detalhe.
Rolagem horizontal **dentro** da tabela, nunca na página.

### `AreaComPainel`
Tabela + painel de 384px a partir de 1280px; abaixo disso, gaveta. O painel é
montado uma vez só (decisão em JS via `useLarguraMinima`), porque duas árvores
vivas significam dois formulários com os mesmos ids.

### `ListaDeCampos` · `BlocoDoPainel`
O miolo do painel: `<dl>` de rótulo/valor, número à direita.

### `SeloSituacao` · `ValorIndisponivel` · `AvisoDeContexto` · `AvisoDeFalha`
Status em **texto + ícone + cor** — nunca só cor. Tons: `neutro`, `ativo`,
`sucesso`, `atencao`, `critico`, `indisponivel`.

`AvisoDeFalha` é o bloco de erro de carga: mensagem **real** do banco mais o
retry, empilhando no celular. Use-o em vez de montar um `Alert` com botão ao
lado — sete telas montaram o seu, e as sete quebravam igual em 390px, com o
texto encolhendo a uma palavra por linha enquanto o botão não cedia um pixel.

### `TextoExpansivel`
Descrição longa truncada com botão real de expansão (`aria-expanded`), não
`line-clamp` mudo.

Reaproveite o que já existe fora daqui: `EstadoVazio`, `SkeletonPagina`,
`Badge`, `ui/table`, `ui/sheet`, `ui/tabs`.

---

## 4. Composição por tela

| Tela | Composição exigida |
| --- | --- |
| Estratégicas, Compromissos, Histórico | indicadores → filtros → tabela; selecionar abre painel lateral |
| Calendário | calendário ~65% / agenda e alertas ~35%; no celular a agenda vem primeiro |
| Workflow IA | etapas à esquerda, conteúdo da etapa no centro, resumo da execução à direita |
| Kanban | colunas de no mínimo 260px com rolagem horizontal local; **não** comprimir para caber |
| Robô de Lances | sessões à esquerda, sessão selecionada no centro, checklist e ações à direita |
| Metas | abas Painel/Equipe/Relatórios; período e colaborador acima dos resultados |
| Contratos | tabela hierárquica ATA + derivados, painel lateral; dentro do contrato, cabeçalho compacto + abas Resumo / Itens-Lotes / Pedidos / Arquivos-Aditivos |
| Compras | abas Pedidos / Produtos / Fornecedores / Estoque / NF-e / Certificado; Pedidos alterna Lista e Quadro |
| Dossiê | Visão Geral / Documentos / Anexos / Precificação / Proposta / Módulos / Histórico, mantendo o processo selecionado |
| Proposta | editor e configurações à esquerda, prévia à direita |

---

## 5. Celular

Não é o desktop reduzido.

- Coluna vira gaveta; respiro de 16px; título ~22px.
- Indicadores em uma ou duas colunas; filtros em painel expansível.
- Detalhe ocupa a tela inteira; formulário em coluna única.
- Kanban por etapa selecionada; calendário prioriza a agenda.
- Tabela mostra o essencial e manda o resto para o detalhe.
- Alvo de toque ~44px; campo com fonte ≥16px (abaixo disso o iOS dá zoom).
- **Nenhuma** rolagem horizontal na página inteira.

---

## 6. O que não fazer

- Não alterar regra de negócio, cálculo, status, permissão ou consulta.
- Não copiar número, nome, data, CNPJ, status ou contador das referências.
- Não usar imagem de referência como fundo de página.
- Não deixar botão fictício, link `#`, dado estático de demonstração nem
  função existente inacessível.
- Não executar operação real de envio, faturamento, estoque, proposta ou lance
  para validar visual.
- Não somar valor de ATA com o dos derivados: bases de cálculo distintas.
- Não exibir custo não apurado como zero.
- Não chamar score de "probabilidade de vitória" sem validação do modelo.
- Não criar navegação duplicada nem item de menu sem destino.

---

## 7. Portões antes de commitar

```sh
npx tsc --noEmit -p tsconfig.app.json   # a checagem de tipos de verdade
npx eslint <arquivos tocados>           # pega hook depois de return antecipado
npm run test -- --run
npm run build
```
