#!/usr/bin/env python3
"""Gera os artefatos da marca Praefectus a partir da geometria oficial.

A geometria-mestre vive em src/components/shared/BrandLogo.tsx (SIMBOLO_PATHS)
e está REPETIDA aqui — mudou lá, mude aqui e rode:

    python3 scripts/gerar-icones-marca.py

Saídas:
  public/marca/marca-principal.svg   marca completa, fundo claro
  public/marca/marca-inversa.svg     marca completa, para fundo escuro
  public/marca/simbolo.svg           símbolo isolado, versão principal
  public/marca/simbolo-inverso.svg   símbolo isolado, para fundo escuro
  public/favicon.svg                 símbolo centrado em quadrado
  public/pwa-192x192.png / pwa-512x512.png   símbolo inverso sobre navy
  public/favicon.ico                 fallback raster do favicon

Requer Pillow (pip install --user pillow).
"""
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NAVY = '#102A43'
GREEN = '#087F5B'
NAVY_RGB = (16, 42, 67, 255)
GREEN_RGB = (8, 127, 91, 255)
WHITE_RGB = (255, 255, 255, 255)

# ── Geometria oficial (espelho de SIMBOLO_PATHS no BrandLogo.tsx) ────────────
ARCO_SUP = 'M4 60 A44 44 0 0 1 90 49 A47 47 0 0 0 12 65.5 Z'
ARCO_INF = 'M30 47 A28 28 0 0 1 80 66 L74 68 A30 30 0 0 0 30 47 Z'
QUADRADO = (34, 52, 12, 2.5)  # x, y, lado, raio
TEXTO = ('praefectus', 110, 62, 46, -0.9, 252)  # conteúdo, x, y, fs, ls, textLength

VB_SIMBOLO = '0 12 94 58'
VB_FULL = '0 12 372 58'


def _svg(viewbox: str, corpo: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">\n'
            f'  <!-- Marca Praefectus — prancha oficial 12/09/2026. Gerado por scripts/gerar-icones-marca.py -->\n'
            f'{corpo}</svg>\n')


def _simbolo_svg(cor_sup: str, cor_inf: str, cor_quad: str, indent: str = '  ') -> str:
    x, y, lado, r = QUADRADO
    return (f'{indent}<path d="{ARCO_SUP}" fill="{cor_sup}"/>\n'
            f'{indent}<path d="{ARCO_INF}" fill="{cor_inf}"/>\n'
            f'{indent}<rect x="{x}" y="{y}" width="{lado}" height="{lado}" rx="{r}" fill="{cor_quad}"/>\n')


def _marca_svg(cor_nome: str, cor_inf: str, cor_quad: str) -> str:
    t, tx, ty, fs, ls, tl = TEXTO
    corpo = _simbolo_svg(cor_nome, cor_inf, cor_quad)
    corpo += (f'  <text x="{tx}" y="{ty}" font-family="\'Manrope\', \'Inter\', sans-serif" font-weight="800" '
              f'font-size="{fs}" letter-spacing="{ls}" fill="{cor_nome}" textLength="{tl}" '
              f'lengthAdjust="spacingAndGlyphs">{t}</text>\n')
    return _svg(VB_FULL, corpo)


# ── Amostragem dos arcos para o raster (Pillow não desenha path SVG) ─────────
def _params_arco(p1, p2, r, sweep):
    """Centro e varredura de um arco SVG com large-arc=0. O lado do centro é
    escolhido testando os dois candidatos: com y para baixo, sweep=1 é o delta
    de ângulo positivo."""
    (x1, y1), (x2, y2) = p1, p2
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    c = math.hypot(dx, dy)
    h = math.sqrt(max(r * r - (c / 2) ** 2, 0))
    for sgn in (1, -1):
        cx, cy = mx + sgn * (-dy / c) * h, my + sgn * (dx / c) * h
        a1 = math.atan2(y1 - cy, x1 - cx)
        a2 = math.atan2(y2 - cy, x2 - cx)
        delta = a2 - a1
        while delta <= -math.pi:
            delta += 2 * math.pi
        while delta > math.pi:
            delta -= 2 * math.pi
        if (delta > 0) == (sweep == 1):
            return cx, cy, a1, delta
    raise ValueError('arco sem solução')


def _pontos_arco(p1, p2, r, sweep, n=90):
    cx, cy, a1, delta = _params_arco(p1, p2, r, sweep)
    return [(cx + r * math.cos(a1 + delta * i / n),
             cy + r * math.sin(a1 + delta * i / n)) for i in range(n + 1)]


def _poligonos():
    """Devolve (navy, verde): listas de pontos das duas peças afiladas."""
    navy = _pontos_arco((4, 60), (90, 49), 44, 1) + _pontos_arco((90, 49), (12, 65.5), 47, 0)
    verde = _pontos_arco((30, 47), (80, 66), 28, 1) + [(74, 68)] + _pontos_arco((74, 68), (30, 47), 30, 0)
    return navy, verde


def _bounds(pontos):
    xs = [p[0] for p in pontos]
    ys = [p[1] for p in pontos]
    return min(xs), min(ys), max(xs), max(ys)


def gerar_svgs():
    marca = RAIZ / 'public' / 'marca'
    marca.mkdir(exist_ok=True)
    (marca / 'marca-principal.svg').write_text(_marca_svg(NAVY, GREEN, GREEN))
    (marca / 'marca-inversa.svg').write_text(_marca_svg('#FFFFFF', GREEN, '#FFFFFF'))
    (marca / 'simbolo.svg').write_text(_svg(VB_SIMBOLO, _simbolo_svg(NAVY, GREEN, GREEN)))
    (marca / 'simbolo-inverso.svg').write_text(_svg(VB_SIMBOLO, _simbolo_svg('#FFFFFF', GREEN, '#FFFFFF')))

    # favicon: símbolo centrado num quadrado, versão principal
    navy, verde = _poligonos()
    x0, y0, x1, y1 = _bounds(navy + verde + [(34, 52), (46, 64)])
    w, h = x1 - x0, y1 - y0
    lado = max(w, h) / 0.86  # 86% de ocupação
    ox, oy = (lado - w) / 2 - x0, (lado - h) / 2 - y0
    corpo = f'  <g transform="translate({ox:.2f} {oy:.2f})">\n' + _simbolo_svg(NAVY, GREEN, GREEN, '    ') + '  </g>\n'
    (RAIZ / 'public' / 'favicon.svg').write_text(_svg(f'0 0 {lado:.2f} {lado:.2f}', corpo))


def gerar_rasters():
    from PIL import Image, ImageDraw

    navy_pts, verde_pts = _poligonos()
    x0, y0, x1, y1 = _bounds(navy_pts + verde_pts + [(34, 52), (46, 64)])
    w, h = x1 - x0, y1 - y0

    def icone(tam, fundo, cor_sup, cor_inf, cor_quad, ocupacao):
        SS = 4
        T = tam * SS
        img = Image.new('RGBA', (T, T), fundo)
        d = ImageDraw.Draw(img)
        s = T * ocupacao / max(w, h)
        ox = (T - w * s) / 2 - x0 * s
        oy = (T - h * s) / 2 - y0 * s
        P = lambda p: (p[0] * s + ox, p[1] * s + oy)
        d.polygon([P(p) for p in navy_pts], fill=cor_sup)
        d.polygon([P(p) for p in verde_pts], fill=cor_inf)
        qx, qy, lado, r = QUADRADO
        d.rounded_rectangle([P((qx, qy)), P((qx + lado, qy + lado))], radius=r * s, fill=cor_quad)
        return img.resize((tam, tam), Image.LANCZOS)

    pub = RAIZ / 'public'
    icone(192, NAVY_RGB, WHITE_RGB, GREEN_RGB, WHITE_RGB, 0.60).save(pub / 'pwa-192x192.png')
    icone(512, NAVY_RGB, WHITE_RGB, GREEN_RGB, WHITE_RGB, 0.60).save(pub / 'pwa-512x512.png')
    icone(48, (0, 0, 0, 0), NAVY_RGB, GREEN_RGB, GREEN_RGB, 0.90).save(
        pub / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == '__main__':
    gerar_svgs()
    gerar_rasters()
    print('marca/, favicon.svg, favicon.ico e ícones PWA regenerados.')
