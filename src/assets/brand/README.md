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
