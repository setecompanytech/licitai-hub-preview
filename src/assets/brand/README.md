# Imagens da marca — rebranding

Pasta criada para o rebranding (`feature/rebrand-ui-ux`). Aqui ficam as imagens
da identidade nova: logo, símbolo, variações, ícones de marca, texturas de fundo.

Se a imagem é de um módulo específico e não da marca, ela não é daqui — vai para
uma pasta própria (`src/assets/contratos/`, `src/assets/robo-lances/`), no mesmo
padrão de `banks/`, `ebook/`, `landing/` e `portais/`.

## Como usar no código

Imagem daqui é **importada**, nunca referenciada por caminho de string:

```tsx
import logo from '@/assets/brand/logo-horizontal.svg';

<img src={logo} alt="Praefectus" />
```

Import é o que faz o Vite botar hash no nome (cache eterno) e **quebrar o build
se o arquivo não existir**. Caminho em string não é verificado por ninguém e vira
404 silencioso em produção.

Quando o nome só se resolve em runtime, o padrão do repo é `import.meta.glob` —
veja [src/components/financeiro/BancoSelectorLogos.tsx](../../components/financeiro/BancoSelectorLogos.tsx).

## Regras

**Nome em kebab-case, descrevendo o que é**, seguindo `hero-corporate.jpg` e
`ch01-dashboard.png`: `logo-horizontal.svg`, `simbolo-mono.svg`,
`logo-fundo-escuro.svg`.

**SVG sempre que possível.** Logo em PNG fica serrilhado em tela retina e não
acompanha tema claro/escuro.

**Comprimir antes de commitar.** Binário fica no histórico do git para sempre,
mesmo apagado depois. Screenshot em PNG costuma cair 70% sem perda visível.
Acima de ~500 KB, comprimir não é opcional.

**Caminho repetido não faz merge.** Git resolve conflito de texto, não de
binário: se duas pessoas adicionarem arquivos diferentes com o mesmo nome aqui,
alguém escolhe uma e a outra some. Combine o nome antes de commitar.

**Imagem não importada não vai para o bundle** — mas continua pesando no repo.
Se um arquivo daqui não for usado por ninguém até o fim do rebranding, apague:
`src/assets/portais/` tem 12 logos parados há meses justamente assim.

## `icon-robo.png` e `icon-robo-mascara.png`

O `icon-robo.png` é o **original** entregue pelo Yrmih (1254px, 435 KB) e fica
aqui como fonte. Quem o app carrega é o `icon-robo-mascara.png`, 192px e 16 KB.

O derivado não é só um redimensionamento. O botão da AURÉLIA pinta o robô com o
dourado da logo, e o original é azul — então a cor tem de vir do CSS, não do
arquivo. Isso se faz com `mask`, que usa **só o canal alfa**. Mascarar o
original direto devolvia uma mancha dourada: o miolo do desenho é branco
OPACO, e para a máscara opaco é opaco, seja branco ou azul.

A máscara certa vem da TINTA, não da silhueta — `alfa × (1 − luminância)`:
fundo transparente continua fora, preenchimento branco vira transparente,
e só o traço fica. A cobertura cai de 26% para 5,8% da tela, que é a diferença
entre um borrão e um desenho.

Para regerar, se o original mudar:

```sh
O=src/assets/brand/icon-robo.png
convert "$O" -alpha extract /tmp/a.png
convert "$O" -background white -alpha remove -alpha off -colorspace Gray -negate /tmp/l.png
convert /tmp/a.png /tmp/l.png -compose multiply -composite /tmp/final.png
convert -size 1254x1254 xc:white /tmp/final.png -alpha off -compose copy_opacity -composite /tmp/bruta.png
convert /tmp/bruta.png -trim +repage -resize 176x176 -background none \
  -gravity center -extent 192x192 -strip PNG32:src/assets/brand/icon-robo-mascara.png
```
