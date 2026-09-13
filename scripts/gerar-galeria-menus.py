#!/usr/bin/env python3
"""Gera a galeria de padronização das telas do menu.

Lê `src/lib/navegacao/paginas.ts` (a fonte de verdade — não duplica dados) e
escreve `docs/padronizacao-menus.html`: uma miniatura de tela por função do
menu, com a moldura real da identidade 12/09 (sidebar navy, barra branca de
72px, cabeçalho padrão e o esqueleto do padrão de conteúdo declarado).

    python3 scripts/gerar-galeria-menus.py

O HTML é também a origem dos PNGs individuais (ver scripts/shots no
scratchpad): cada tela tem `id="tela-<slug>"` para recorte.
"""
import html
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / 'src' / 'lib' / 'navegacao' / 'paginas.ts'
SAIDA = RAIZ / 'docs' / 'padronizacao-menus.html'

# Ícones cujo nome no lucide difere do identificador importado no TS.
ICONE_ESPECIAL = {'HeadphonesIcon': 'headphones'}
ICONES_DIR = RAIZ / 'node_modules' / 'lucide-react' / 'dist' / 'esm' / 'icons'
_cache_svg: dict[str, str] = {}


def svg_do_icone(nome_kebab: str, tam: int = 24, cls: str = '') -> str:
    """SVG inline do ícone, lido do lucide-react INSTALADO — o mesmo desenho
    que o app renderiza. Sem CDN: a galeria abre offline e dentro do artifact."""
    if nome_kebab not in _cache_svg:
        arq = ICONES_DIR / f'{nome_kebab}.js'
        if not arq.exists():
            _cache_svg[nome_kebab] = ''
        else:
            fonte = arq.read_text()
            ini = fonte.find('createLucideIcon(')
            fim = fonte.find('export {')
            corpo = fonte[ini:fim] if ini >= 0 and fim > ini else fonte
            partes = []
            for tag, attrs in re.findall(r'\["(\w+)",\s*\{(.*?)\}\]', corpo, re.S):
                pares = re.findall(r'(\w[\w-]*):\s*"((?:[^"\\]|\\.)*)"', attrs)
                atributos = ' '.join(f'{k}="{html.escape(v)}"' for k, v in pares if k != 'key')
                partes.append(f'<{tag} {atributos}/>')
            _cache_svg[nome_kebab] = ''.join(partes)
    interno = _cache_svg[nome_kebab]
    if not interno:
        return ''
    classe = f' class="{cls}"' if cls else ''
    return (f'<svg{classe} width="{tam}" height="{tam}" viewBox="0 0 24 24" fill="none" '
            f'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
            f'stroke-linejoin="round" aria-hidden="true">{interno}</svg>')


def kebab(nome: str) -> str:
    if nome in ICONE_ESPECIAL:
        return ICONE_ESPECIAL[nome]
    s = re.sub(r'(?<=[a-z])(?=[A-Z])|(?<=[A-Za-z])(?=\d)', '-', nome)
    return s.lower()


def ler_paginas():
    texto = FONTE.read_text()
    corpo = texto[texto.index('export const paginasPadrao'):texto.index('const porRota')]
    paginas = []
    # Tolera comentário(s) entre a chave e o campo `rota:` — o registro os usa
    # para justificar decisões (ex.: por que o h1 diverge do rótulo do menu).
    for bloco in re.findall(r'\{\s*\n(?:\s*//[^\n]*\n)*\s*rota:.*?\n\s*\},', corpo, re.S):
        def campo(nome):
            m = re.search(rf"{nome}: '((?:[^'\\]|\\.)*)'", bloco)
            return m.group(1).replace("\\'", "'") if m else None
        abas = re.search(r'abas: \[(.*?)\]', bloco, re.S)
        paginas.append({
            'rota': campo('rota'),
            'grupo': campo('grupo'),
            'titulo': campo('titulo'),
            'descricao': campo('descricao'),
            'acao': campo('acao'),
            'padrao': campo('padrao'),
            'icone': (re.search(r'icone: (\w+)', bloco) or [None, ''])[1],
            'abas': [a.strip().strip("'") for a in abas.group(1).split(',') if a.strip()] if abas else [],
        })
    return paginas


def slug(rota: str) -> str:
    return rota.strip('/').replace('/', '-') or 'raiz'


# ── Esqueletos por padrão de conteúdo ────────────────────────────────────
def linha(w='100%'):
    return f'<span class="l" style="width:{w}"></span>'


def esqueleto(p):
    padrao = p['padrao']
    abas = ''.join(
        f'<span class="aba{" is-on" if i == 0 else ""}">{html.escape(a)}</span>'
        for i, a in enumerate(p['abas'][:5])
    )
    fila_abas = f'<div class="abas">{abas}</div>' if p['abas'] else ''

    if padrao == 'painel':
        kpis = ''.join(f'<div class="kpi"><span class="kpi-r"></span><b>—</b></div>' for _ in range(4))
        return f'''{fila_abas}<div class="kpis">{kpis}</div>
        <div class="duo"><div class="bloco graf"><span class="bt"></span><span class="barras">{"".join(f'<i style="height:{h}%"></i>' for h in (38, 62, 45, 78, 55, 88))}</span></div>
        <div class="bloco"><span class="bt"></span>{"".join(f'<div class="it"><i></i>{linha("70%")}</div>' for _ in range(4))}</div></div>'''

    if padrao == 'abas':
        return f'''{fila_abas}<div class="bloco alto"><span class="bt"></span>
        <div class="grade3">{"".join(f'<div class="mini">{linha("55%")}{linha("85%")}{linha("40%")}</div>' for _ in range(6))}</div></div>'''

    if padrao == 'tabela':
        cab = '<div class="tr th">' + ''.join(f'<span>{c}</span>' for c in ('Identificação', 'Órgão', 'Prazo', 'Situação', 'Valor')) + '</div>'
        linhas = ''.join(
            '<div class="tr">' + ''.join(
                f'<span>{linha(w)}</span>' for w in ('80%', '90%', '60%', '')
            ) + '<span class="num">—</span></div>' for _ in range(5))
        return f'''{fila_abas}<div class="filtros">{"".join('<span class="f"></span>' for _ in range(4))}<span class="f busca"></span></div>
        <div class="bloco tabela">{cab}{linhas}</div>'''

    if padrao == 'cartoes':
        return f'''{fila_abas}<div class="grade3 cartoes">{"".join(f'<div class="cartao"><span class="ci"></span>{linha("60%")}{linha("90%")}{linha("45%")}</div>' for _ in range(6))}</div>'''

    if padrao == 'formulario':
        campos = ''.join(f'<div class="campo"><span class="rot"></span><span class="inp"></span></div>' for _ in range(6))
        return f'''{fila_abas}<div class="bloco"><span class="bt"></span><div class="grade2">{campos}</div>
        <div class="rodape-form"><span class="btn-sec"></span><span class="btn-pri"></span></div></div>'''

    if padrao == 'kanban':
        chip = f'<div class="chip">{linha("70%")}{linha("45%")}</div>'
        cols = ''.join(
            f'<div class="col"><span class="ct"></span>{chip * n}</div>'
            for n in (3, 2, 3, 2, 1))
        return f'{fila_abas}<div class="kanban">{cols}</div>'

    if padrao == 'calendario':
        dias = ''.join(f'<span class="dia{" tem" if d in (3, 9, 14, 17, 22, 28) else ""}"></span>' for d in range(35))
        return f'{fila_abas}<div class="bloco"><span class="bt"></span><div class="cal">{dias}</div></div>'

    if padrao == 'conversa':
        baloes = ''.join(
            '<div class="msg %s">%s%s</div>' % ('eu' if i % 2 else 'ele', linha('100%'), linha('60%'))
            for i in range(4))
        return f'''{fila_abas}<div class="bloco alto conversa">{baloes}<div class="compor"><span class="inp"></span><span class="btn-pri"></span></div></div>'''

    return fila_abas


def tela(p):
    ic = kebab(p['icone'])
    acao = (f'<span class="acao">{svg_do_icone("plus", 10)}{html.escape(p["acao"])}</span>'
            if p['acao'] else '<span class="acao-vazia">leitura</span>')
    return f'''
    <figure class="tela" id="tela-{slug(p['rota'])}">
      <div class="quadro">
        <aside class="side">
          <span class="marca"><svg viewBox="0 12 94 58" width="74" aria-hidden="true"><path d="M4 60 A44 44 0 0 1 90 49 A47 47 0 0 0 12 65.5 Z" fill="#fff"/><path d="M30 47 A28 28 0 0 1 80 66 L74 68 A30 30 0 0 0 30 47 Z" fill="#087F5B"/><rect x="34" y="52" width="12" height="12" rx="2.5" fill="#fff"/></svg></span>
          <span class="sgrupo">{html.escape(p['grupo'])}</span>
          <span class="sitem is-on">{svg_do_icone(ic, 8)}{html.escape(p['titulo'])}</span>
          {''.join('<span class="sitem"><i></i><em></em></span>' for _ in range(5))}
        </aside>
        <div class="corpo">
          <div class="topo"><span class="tf"></span><span class="ticons">{svg_do_icone("search", 9)}{svg_do_icone("bell", 9)}{svg_do_icone("settings", 9)}</span><span class="tav"></span></div>
          <div class="conteudo">
            <nav class="trilha">Painel <b>›</b> {html.escape(p['grupo'])} <b>›</b> <em>{html.escape(p['titulo'])}</em></nav>
            <header class="cab">
              <span class="ic">{svg_do_icone(ic, 10)}</span>
              <span class="tx"><h3>{html.escape(p['titulo'])}</h3><p>{html.escape(p['descricao'])}</p></span>
              {acao}
            </header>
            {esqueleto(p)}
          </div>
        </div>
      </div>
      <figcaption>
        <code>{html.escape(p['rota'])}</code>
        <span class="pad">{p['padrao']}</span>
      </figcaption>
    </figure>'''


def gerar():
    paginas = ler_paginas()
    grupos = []
    for p in paginas:
        if not grupos or grupos[-1][0] != p['grupo']:
            grupos.append((p['grupo'], []))
        grupos[-1][1].append(p)

    secoes = ''.join(
        f'''<section class="grupo" id="grupo-{slug(nome)}">
        <h2>{html.escape(nome)}<span class="cont">{len(itens)} {"tela" if len(itens) == 1 else "telas"}</span></h2>
        <div class="telas">{"".join(tela(p) for p in itens)}</div>
      </section>''' for nome, itens in grupos)

    indice = ''.join(
        f'<a href="#grupo-{slug(nome)}">{html.escape(nome)}<b>{len(itens)}</b></a>'
        for nome, itens in grupos)

    SAIDA.parent.mkdir(exist_ok=True)
    SAIDA.write_text(MOLDE.replace('{{INDICE}}', indice).replace('{{SECOES}}', secoes)
                     .replace('{{TOTAL}}', str(len(paginas))).replace('{{GRUPOS}}', str(len(grupos))))
    print(f'{SAIDA} — {len(paginas)} telas em {len(grupos)} grupos')


MOLDE = r'''<title>Padronização dos Menus</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap">
<style>
  :root{
    --navy:#102A43; --verde:#087F5B; --verde-hover:#066649; --tint:#EAF7F1;
    --bg:#F5F7FA; --sup:#FFFFFF; --txt:#102A43; --txt2:#526477; --bd:#DCE3EB;
    --sombra:0 1px 3px rgba(16,42,67,.07),0 1px 2px rgba(16,42,67,.05);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font:400 16px/1.5 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  h1,h2,h3{font-family:Manrope,Inter,sans-serif;margin:0;letter-spacing:-.02em}
  a{color:inherit}
  .env{max-width:1200px;margin-inline:auto;padding:0 24px}
  header.topo-pag{background:var(--sup);border-bottom:1px solid var(--bd);padding:40px 0 32px}
  header.topo-pag .marca-svg{display:block;margin-bottom:24px}
  h1{font-size:40px;line-height:48px;font-weight:800}
  .sub{margin:12px 0 0;max-width:62ch;color:var(--txt2);font-size:17px;line-height:26px}
  .resumo{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
  .resumo span{border:1px solid var(--bd);background:var(--bg);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600}
  .resumo b{color:var(--verde)}
  nav.indice{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
  nav.indice a{display:inline-flex;align-items:center;gap:8px;text-decoration:none;border:1px solid var(--bd);background:var(--sup);
    border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;transition:.15s}
  nav.indice a:hover{border-color:var(--verde);color:var(--verde)}
  nav.indice b{background:var(--tint);color:var(--verde);border-radius:6px;padding:1px 6px;font-size:11px}
  .regra{margin:32px 0 0;border:1px solid var(--bd);background:var(--sup);border-radius:16px;padding:24px}
  .regra h2{font-size:18px;line-height:26px;font-weight:700;margin-bottom:12px}
  .regra ol{margin:0;padding-left:20px;color:var(--txt2);font-size:15px;line-height:26px}
  .regra ol b{color:var(--txt)}
  .grupo{padding:40px 0 8px}
  .grupo h2{font-size:22px;line-height:30px;font-weight:700;display:flex;align-items:center;gap:12px;margin-bottom:20px}
  .cont{font-family:Inter;font-size:12px;font-weight:600;letter-spacing:0;color:var(--verde);background:var(--tint);border-radius:999px;padding:4px 10px}
  .telas{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px}
  figure.tela{margin:0}
  .quadro{display:flex;background:var(--bg);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:var(--sombra);aspect-ratio:16/10}
  .side{width:29%;background:var(--navy);padding:9px 8px;display:flex;flex-direction:column;gap:5px;min-width:0}
  .marca{display:block;padding:3px 4px 8px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:3px}
  .sgrupo{font:700 6.5px/1 Manrope;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);padding:4px}
  .sitem{display:flex;align-items:center;gap:5px;padding:4px 5px;border-radius:5px;font:500 7.5px/1.2 Inter;color:rgba(255,255,255,.72);white-space:nowrap;overflow:hidden}
  .sitem svg{width:8px;height:8px;flex:0 0 8px;color:currentColor}
  .sitem i{display:block}
  .sitem i:empty,.sitem em{display:block;background:rgba(255,255,255,.18);border-radius:2px}
  .sitem i:empty{width:8px;height:8px}
  .sitem em{height:4px;width:62%}
  .sitem.is-on{background:rgba(255,255,255,.14);color:#fff;font-weight:700;position:relative}
  .sitem.is-on::before{content:"";position:absolute;left:-5px;top:4px;bottom:4px;width:2px;border-radius:2px;background:#3ECF93}
  .corpo{flex:1;min-width:0;display:flex;flex-direction:column}
  .topo{height:13%;background:var(--sup);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:6px;padding:0 10px}
  .tf{flex:1}
  .ticons{display:flex;gap:7px;color:#8A9BAE}
  .ticons svg{width:9px;height:9px}
  .tav{width:12px;height:12px;border-radius:50%;background:var(--navy)}
  .conteudo{flex:1;padding:10px;display:flex;flex-direction:column;gap:7px;min-height:0;overflow:hidden}
  .trilha{font-size:6px;color:#8A9BAE;letter-spacing:.02em}
  .trilha b{color:#C3CEDA;margin:0 1px}
  .trilha em{font-style:normal;color:var(--txt);font-weight:600}
  .cab{display:flex;align-items:flex-start;gap:6px}
  .cab .ic{width:17px;height:17px;flex:0 0 17px;border-radius:5px;background:var(--tint);color:var(--verde);display:flex;align-items:center;justify-content:center}
  .cab .ic svg{width:10px;height:10px}
  .cab .tx{flex:1;min-width:0}
  .cab h3{font-size:11px;line-height:14px;font-weight:700}
  .cab p{margin:2px 0 0;font-size:6.5px;line-height:9px;color:var(--txt2)}
  .acao{flex:0 0 auto;display:inline-flex;align-items:center;gap:3px;background:var(--verde);color:#fff;border-radius:4px;padding:4px 7px;font:600 6.5px/1 Inter;white-space:nowrap}
  .acao svg{width:6.5px;height:6.5px}
  .acao-vazia{flex:0 0 auto;font:600 6px/1 Inter;color:#A9B6C4;border:1px dashed var(--bd);border-radius:4px;padding:4px 6px;text-transform:uppercase;letter-spacing:.06em}
  .abas{display:flex;gap:3px;background:#EDF1F6;border-radius:5px;padding:2px;width:fit-content;max-width:100%;overflow:hidden}
  .aba{font:600 6px/1 Inter;color:var(--txt2);padding:4px 6px;border-radius:4px;white-space:nowrap}
  .aba.is-on{background:var(--sup);color:var(--txt);box-shadow:0 1px 2px rgba(16,42,67,.12)}
  .l{display:block;height:3px;border-radius:2px;background:#DDE4EC}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
  .kpi{background:var(--sup);border:1px solid var(--bd);border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:4px}
  .kpi-r{display:block;height:3px;width:64%;border-radius:2px;background:#DDE4EC}
  .kpi b{font:700 11px/1 Manrope;color:var(--txt)}
  .duo{display:grid;grid-template-columns:1.35fr 1fr;gap:5px;flex:1;min-height:0}
  .bloco{background:var(--sup);border:1px solid var(--bd);border-radius:6px;padding:7px;display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden}
  .bloco.alto{flex:1}
  .bt{display:block;height:4px;width:38%;border-radius:2px;background:#CFD9E4}
  .barras{flex:1;display:flex;align-items:flex-end;gap:4px}
  .barras i{flex:1;background:linear-gradient(180deg,#1FA97C,#087F5B);border-radius:2px 2px 0 0;display:block}
  .it{display:flex;align-items:center;gap:4px}
  .it i{width:5px;height:5px;border-radius:50%;background:var(--verde);flex:0 0 5px;display:block}
  .it .l{flex:1}
  .grade3{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
  .grade2{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}
  .mini,.cartao{background:var(--bg);border:1px solid var(--bd);border-radius:5px;padding:6px;display:flex;flex-direction:column;gap:3px}
  .cartoes .cartao{background:var(--sup)}
  .ci{width:12px;height:12px;border-radius:50%;background:var(--tint);display:block;margin-bottom:2px}
  .filtros{display:flex;gap:4px}
  .f{height:12px;width:44px;border-radius:4px;border:1px solid var(--bd);background:var(--sup);display:block}
  .f.busca{flex:1;width:auto}
  .tabela{padding:0;overflow:hidden}
  .tr{display:grid;grid-template-columns:1.6fr 1.3fr .8fr .8fr .7fr;gap:6px;align-items:center;padding:6px 7px;border-bottom:1px solid #EFF3F7}
  .tr:last-child{border-bottom:0}
  .tr.th{background:#F7F9FC;font:600 6px/1 Inter;color:var(--txt2)}
  .tr.th span{white-space:nowrap}
  .tr .num{font:600 6.5px/1 Inter;text-align:right;color:var(--txt)}
  .kanban{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;flex:1;min-height:0}
  .col{background:#EDF1F6;border-radius:6px;padding:5px;display:flex;flex-direction:column;gap:4px;min-height:0}
  .ct{display:block;height:4px;width:70%;border-radius:2px;background:#C6D2DF}
  .chip{background:var(--sup);border:1px solid var(--bd);border-radius:4px;padding:5px;display:flex;flex-direction:column;gap:3px}
  .cal{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;gap:3px}
  .dia{border:1px solid #EFF3F7;border-radius:3px;display:block}
  .dia.tem{background:var(--tint);border-color:#BFE6D6}
  .campo{display:flex;flex-direction:column;gap:3px}
  .rot{display:block;height:3px;width:40%;border-radius:2px;background:#CFD9E4}
  .inp{display:block;height:12px;border-radius:4px;border:1px solid var(--bd);background:var(--bg)}
  .rodape-form{display:flex;justify-content:flex-end;gap:5px;margin-top:auto}
  .btn-sec{width:34px;height:13px;border-radius:4px;border:1px solid var(--bd);background:var(--sup);display:block}
  .btn-pri{width:44px;height:13px;border-radius:4px;background:var(--verde);display:block}
  .conversa{gap:6px}
  .msg{max-width:72%;border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:3px}
  .msg.ele{background:var(--bg);border:1px solid var(--bd)}
  .msg.eu{background:var(--tint);border:1px solid #C9E9DB;margin-left:auto}
  .compor{display:flex;gap:4px;margin-top:auto}
  .compor .inp{flex:1}
  figcaption{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px}
  figcaption code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--txt2);background:var(--sup);border:1px solid var(--bd);border-radius:5px;padding:2px 7px}
  .pad{font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--verde)}
  footer{margin-top:48px;background:var(--navy);color:rgba(255,255,255,.72);padding:28px 0}
  footer .env{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;font-size:13px}
  @media (max-width:640px){h1{font-size:30px;line-height:38px}.telas{grid-template-columns:1fr}}
</style>

<header class="topo-pag">
  <div class="env">
    <svg class="marca-svg" viewBox="0 12 372 58" width="200" role="img" aria-label="Praefectus">
      <path d="M4 60 A44 44 0 0 1 90 49 A47 47 0 0 0 12 65.5 Z" fill="#102A43"/>
      <path d="M30 47 A28 28 0 0 1 80 66 L74 68 A30 30 0 0 0 30 47 Z" fill="#087F5B"/>
      <rect x="34" y="52" width="12" height="12" rx="2.5" fill="#087F5B"/>
      <text x="110" y="62" font-family="Manrope,Inter,sans-serif" font-weight="800" font-size="46" letter-spacing="-0.9" fill="#102A43" textLength="252" lengthAdjust="spacingAndGlyphs">praefectus</text>
    </svg>
    <h1>Padronização dos menus</h1>
    <p class="sub">Como cada função do menu se apresenta na identidade nova: a mesma moldura,
      o mesmo cabeçalho e um padrão de conteúdo declarado por tela. Cada miniatura abaixo é
      a projeção da tela — não uma captura do sistema atual.</p>
    <div class="resumo">
      <span><b>{{TOTAL}}</b> funções do menu</span>
      <span><b>{{GRUPOS}}</b> grupos</span>
      <span>8 padrões de conteúdo</span>
      <span>fonte: <b>src/lib/navegacao/paginas.ts</b></span>
    </div>
    <nav class="indice">{{INDICE}}</nav>
    <div class="regra">
      <h2>A régua que toda tela segue</h2>
      <ol>
        <li><b>Trilha</b> — Painel › grupo do menu › tela, em 12/16</li>
        <li><b>Ícone</b> do módulo num ladrilho verde-claro, o mesmo do menu lateral</li>
        <li><b>Título</b> 28/36 em Manrope navy, um por tela (nunca dois h1)</li>
        <li><b>Descrição</b> de uma linha, 16/24, dizendo o que a tela faz — sem promessa e sem número sem fonte</li>
        <li><b>Ação principal</b> em verde à direita; tela de leitura declara que não tem ação</li>
        <li><b>Conteúdo</b> conforme o padrão declarado: painel, abas, tabela, cartões, formulário, kanban, calendário ou conversa</li>
      </ol>
    </div>
  </div>
</header>

<main class="env">{{SECOES}}</main>

<footer><div class="env"><span>Praefectus — identidade 12/09/2026</span><span>docs/padronizacao-menus.html</span></div></footer>

'''

if __name__ == '__main__':
    gerar()
