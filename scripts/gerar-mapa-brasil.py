#!/usr/bin/env python3
"""Regera src/components/dashboard/mapa-brasil-contornos.ts a partir da malha
oficial do IBGE.

    curl -o malha.json "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF"
    python3 scripts/gerar-mapa-brasil.py

Projeta em Mercator, descarta ilhas oceanicas por area, simplifica com
Douglas-Peucker e escreve contornos.json (que vira o .ts). So precisa rodar se
o IBGE mudar a malha — o que acontece quando um municipio muda de limite, nao
todo ano.
"""
import json, math

UF = {
 '11':('RO','Rondônia'), '12':('AC','Acre'), '13':('AM','Amazonas'), '14':('RR','Roraima'),
 '15':('PA','Pará'), '16':('AP','Amapá'), '17':('TO','Tocantins'), '21':('MA','Maranhão'),
 '22':('PI','Piauí'), '23':('CE','Ceará'), '24':('RN','Rio Grande do Norte'),
 '25':('PB','Paraíba'), '26':('PE','Pernambuco'), '27':('AL','Alagoas'),
 '28':('SE','Sergipe'), '29':('BA','Bahia'), '31':('MG','Minas Gerais'),
 '32':('ES','Espírito Santo'), '33':('RJ','Rio de Janeiro'), '35':('São Paulo','x'),
 '41':('PR','Paraná'), '42':('SC','Santa Catarina'), '43':('RS','Rio Grande do Sul'),
 '50':('MS','Mato Grosso do Sul'), '51':('MT','Mato Grosso'), '52':('GO','Goiás'),
 '53':('DF','Distrito Federal'),
}
UF['35'] = ('SP','São Paulo')

def mercator(lon, lat):
    x = math.radians(lon)
    y = math.log(math.tan(math.pi/4 + math.radians(lat)/2))
    return (x, y)

def area(ring):
    s = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i+1) % len(ring)]
        s += x1*y2 - x2*y1
    return abs(s)/2

def anilhas(geom):
    t, c = geom['type'], geom['coordinates']
    return [c[0]] + list(c[1:]) if t == 'Polygon' else [r for poly in c for r in poly]

# 1) projeta
bruto = {}
g = json.load(open('malha.json'))
for f in g['features']:
    cod = f['properties']['codarea']
    aneis = [[mercator(lon, lat) for lon, lat in r] for r in anilhas(f['geometry'])]
    bruto[cod] = aneis

# 2) descarta ilhas minusculas — as oceanicas (Trindade, Noronha) esticariam a
#    caixa e encolheriam o continente
limpo = {}
for cod, aneis in bruto.items():
    aneis = sorted(aneis, key=area, reverse=True)
    maior = area(aneis[0])
    limpo[cod] = [r for r in aneis if area(r) >= maior * 0.004]

# 3) caixa comum
xs = [p[0] for a in limpo.values() for r in a for p in r]
ys = [p[1] for a in limpo.values() for r in a for p in r]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
L = 12.0
LARG = 520.0
esc = (LARG - 2*L) / (x1 - x0)
ALT = (y1 - y0) * esc + 2*L

def para_tela(p):
    return (L + (p[0]-x0)*esc, L + (y1-p[1])*esc)

# 4) Douglas-Peucker
def dp(pts, tol):
    if len(pts) < 3: return pts
    def rec(ini, fim):
        ax, ay = pts[ini]; bx, by = pts[fim]
        dx, dy = bx-ax, by-ay
        norma = math.hypot(dx, dy) or 1e-12
        pior, idx = 0.0, -1
        for i in range(ini+1, fim):
            px, py = pts[i]
            d = abs(dy*px - dx*py + bx*ay - by*ax) / norma
            if d > pior: pior, idx = d, i
        if pior <= tol: return [pts[ini]]
        return rec(ini, idx) + rec(idx, fim)
    return rec(0, len(pts)-1) + [pts[-1]]

TOL = 0.28
saida, total_pts = [], 0
for cod in sorted(limpo, key=lambda c: UF[c][0]):
    sigla, nome = UF[cod]
    partes = []
    for anel in limpo[cod]:
        tela = [para_tela(p) for p in anel]
        # Anel fechado degenera o DP (primeiro ponto == ultimo, reta base nula).
        # Divide em duas metades e simplifica cada uma.
        if tela[0] == tela[-1]: tela = tela[:-1]
        if len(tela) < 4: continue
        m = len(tela)//2
        s = dp(tela[:m+1], TOL)[:-1] + dp(tela[m:] + [tela[0]], TOL)[:-1]
        if len(s) < 4: continue
        total_pts += len(s)
        d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in s) + ' Z'
        partes.append(d)
    # rotulo no centroide do maior anel
    maior = [para_tela(p) for p in limpo[cod][0]]
    cx = sum(p[0] for p in maior)/len(maior)
    cy = sum(p[1] for p in maior)/len(maior)
    a = area(limpo[cod][0]) * esc * esc
    saida.append((sigla, nome, ' '.join(partes), cx, cy, a))

print(f'viewBox 0 0 {LARG:.0f} {ALT:.0f} | pontos {total_pts} | estados {len(saida)}')
json.dump([{'uf':u,'nome':n,'d':d,'cx':round(cx,1),'cy':round(cy,1),'area':round(a)} for u,n,d,cx,cy,a in saida],
          open('contornos.json','w'), ensure_ascii=False)
print('bytes do d:', sum(len(d) for _,_,d,_,_,_ in saida))
print('viewbox', f'0 0 {LARG:.0f} {ALT:.0f}')
