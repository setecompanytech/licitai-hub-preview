import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

/**
 * Timbrado da empresa — a identidade única de todo documento gerado.
 *
 * Configurado UMA vez em Configurações → Timbrado (logotipo + cabeçalho +
 * rodapé), consumido por todo gerador: recibo do kit, relatórios em PDF,
 * cabeçalho impresso das telas de Gestão — retrato e paisagem, porque as
 * medidas saem da PRÓPRIA página (`doc.internal.pageSize`), nunca de um
 * A4 fixo.
 *
 * Sem configuração, nada muda: cada documento mantém o cabeçalho que já
 * tinha. Timbrado é identidade declarada pelo Admin, não padrão inventado.
 */

export type AjustesTimbrado = {
  marginTop: number; marginBottom: number; marginLeft: number; marginRight: number;
  headerHeight: number; footerHeight: number;
  headerAlign: 'esticar' | 'esquerda' | 'centro' | 'direita';
  headerWidth: number; headerOffsetY: number;
  footerAlign: 'esticar' | 'esquerda' | 'centro' | 'direita';
  footerWidth: number; footerOffsetY: number;
};

const AJUSTES_PADRAO: AjustesTimbrado = {
  marginTop: 3, marginBottom: 2, marginLeft: 3, marginRight: 2,
  headerHeight: 2.5, footerHeight: 2,
  headerAlign: 'esticar', headerWidth: 100, headerOffsetY: 0,
  footerAlign: 'esticar', footerWidth: 100, footerOffsetY: 0,
};

type ImagemTimbrado = { dataUrl: string; ratio: number };

export type Timbrado = {
  logoDataUrl: string | null;
  /** largura/altura do logotipo — para escalar sem distorcer. */
  logoRatio: number;
  cabecalho: string | null;
  rodape: string | null;
  /** Arte completa do timbrado (Configurações → Timbrado da proposta):
   *  quando existe, ela MANDA — é a identidade desenhada pela empresa. */
  cabecalhoImg: ImagemTimbrado | null;
  rodapeImg: ImagemTimbrado | null;
  ajustes: AjustesTimbrado;
};

const cache = new Map<string, { t: Timbrado | null; em: number }>();
const CACHE_MS = 5 * 60_000;

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function medirProporcao(dataUrl: string): Promise<number> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img.height > 0 ? img.width / img.height : 3);
    img.onerror = rej;
    img.src = dataUrl;
  });
}

/** Busca a configuração da empresa (com cache curto — gera-se muitos documentos em série). */
export async function carregarTimbrado(empresaId: string | null | undefined): Promise<Timbrado | null> {
  if (!empresaId) return null;
  const hit = cache.get(empresaId);
  if (hit && Date.now() - hit.em < CACHE_MS) return hit.t;

  let t: Timbrado | null = null;
  try {
    // Fonte 1 — a ARTE do timbrado (imagens de cabeçalho/rodapé + ajustes de
    // posição), da tabela empresas: é a identidade desenhada pela empresa.
    let cabecalhoImg: ImagemTimbrado | null = null;
    let rodapeImg: ImagemTimbrado | null = null;
    let ajustes: AjustesTimbrado = AJUSTES_PADRAO;
    try {
      const { data: emp } = await (supabase.from('empresas') as any)
        .select('cabecalho_url, rodape_url, timbrado_url, timbrado_ajustes')
        .eq('id', empresaId)
        .maybeSingle();
      if (emp) {
        if (emp.timbrado_ajustes && typeof emp.timbrado_ajustes === 'object') {
          ajustes = { ...AJUSTES_PADRAO, ...emp.timbrado_ajustes };
        }
        cabecalhoImg = await baixarImagem(emp.cabecalho_url || emp.timbrado_url);
        rodapeImg = await baixarImagem(emp.rodape_url);
      }
    } catch { /* colunas ausentes: segue para a fonte 2 */ }

    // Fonte 2 — logotipo + textos (empresa_timbrado): o fallback composto.
    const { data } = await (supabase.from('empresa_timbrado' as never) as any)
      .select('logo_path, cabecalho, rodape')
      .eq('empresa_id', empresaId)
      .maybeSingle();
    let logoDataUrl: string | null = null;
    let logoRatio = 3;
    if (data?.logo_path) {
      const { data: blob } = await supabase.storage.from('empresa-timbrado').download(data.logo_path);
      if (blob) {
        logoDataUrl = await blobParaDataUrl(blob);
        logoRatio = await medirProporcao(logoDataUrl).catch(() => 3);
      }
    }
    if (cabecalhoImg || rodapeImg || logoDataUrl || data?.cabecalho || data?.rodape) {
      t = {
        logoDataUrl,
        logoRatio,
        cabecalho: data?.cabecalho || null,
        rodape: data?.rodape || null,
        cabecalhoImg,
        rodapeImg,
        ajustes,
      };
    }
  } catch {
    // Tabela ausente (migration pendente) ou rede: sem timbrado, sem quebra.
    t = null;
  }
  cache.set(empresaId, { t, em: Date.now() });
  return t;
}

async function baixarImagem(url: string | null | undefined): Promise<ImagemTimbrado | null> {
  if (!url || !/^https?:/i.test(url)) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!/^image\//.test(blob.type)) return null;
    const dataUrl = await blobParaDataUrl(blob);
    const ratio = await medirProporcao(dataUrl).catch(() => 4);
    return { dataUrl, ratio };
  } catch {
    return null;
  }
}

/** object-contain de uma imagem numa caixa, com alinhamento horizontal. */
function caberNaCaixa(
  img: ImagemTimbrado,
  caixa: { x: number; y: number; w: number; h: number },
  align: 'esticar' | 'esquerda' | 'centro' | 'direita',
  larguraPct: number,
): { x: number; y: number; w: number; h: number } {
  const wAlvo = align === 'esticar' ? caixa.w : caixa.w * (larguraPct / 100);
  let h = Math.min(caixa.h, wAlvo / (img.ratio || 4));
  let w = h * (img.ratio || 4);
  if (w > wAlvo) { w = wAlvo; h = w / (img.ratio || 4); }
  const x = align === 'esquerda' || align === 'esticar'
    ? caixa.x
    : align === 'direita' ? caixa.x + caixa.w - w : caixa.x + (caixa.w - w) / 2;
  return { x, y: caixa.y, w, h };
}

/** Depois de salvar a configuração, o próximo documento precisa do novo. */
export function limparCacheTimbrado(empresaId: string): void {
  cache.delete(empresaId);
}

function formatoDaImagem(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
}

/**
 * Desenha topo e rodapé na PÁGINA ATUAL e devolve as fronteiras úteis:
 * o conteúdo do chamador vive entre `topoY` e `rodapeY`. Funciona em
 * retrato e paisagem — as medidas vêm da página, não de constantes.
 */
export function aplicarTimbrado(doc: jsPDF, t: Timbrado): { topoY: number; rodapeY: number } {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  let topoY = 14;

  // ── A arte desenhada manda: cabeçalho/rodapé em imagem, com os ajustes
  //    de posição definidos em Configurações (mover/editar a logomarca). ──
  if (t.cabecalhoImg || t.rodapeImg) {
    const aj = t.ajustes;
    let rodapeYImg = H - 12;
    if (t.cabecalhoImg) {
      const areaH = Math.max(6, (aj.marginTop + aj.headerHeight) * 10 - aj.headerOffsetY * 10);
      const pos = caberNaCaixa(t.cabecalhoImg,
        { x: 0, y: aj.headerOffsetY * 10, w: W, h: areaH },
        aj.headerAlign, aj.headerWidth);
      try {
        doc.addImage(t.cabecalhoImg.dataUrl, formatoDaImagem(t.cabecalhoImg.dataUrl), pos.x, pos.y, pos.w, pos.h);
      } catch { /* imagem ilegível: o conteúdo segue com margem padrão */ }
      topoY = pos.y + pos.h + 4;
    }
    if (t.rodapeImg) {
      const areaH = Math.max(6, (aj.marginBottom + aj.footerHeight) * 10 - aj.footerOffsetY * 10);
      const caixaY = H - areaH - aj.footerOffsetY * 10;
      const pos = caberNaCaixa(t.rodapeImg,
        { x: 0, y: caixaY, w: W, h: areaH },
        aj.footerAlign, aj.footerWidth);
      // Ancorado na base da caixa, como no papel timbrado real.
      const y = caixaY + areaH - pos.h;
      try {
        doc.addImage(t.rodapeImg.dataUrl, formatoDaImagem(t.rodapeImg.dataUrl), pos.x, y, pos.w, pos.h);
      } catch { /* idem */ }
      rodapeYImg = y - 4;
    }
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    return { topoY: Math.max(topoY, 16), rodapeY: rodapeYImg };
  }

  let xTexto = M;
  if (t.logoDataUrl) {
    const altura = 16;
    const largura = Math.min(altura * (t.logoRatio || 3), W * 0.35);
    try {
      doc.addImage(t.logoDataUrl, formatoDaImagem(t.logoDataUrl), M, 8, largura, altura);
      xTexto = M + largura + 6;
      topoY = Math.max(topoY, 8 + altura + 3);
    } catch {
      // Formato que o jsPDF não abriu: o texto do cabeçalho segura a identidade.
    }
  }
  if (t.cabecalho) {
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(40);
    const linhas = doc.splitTextToSize(t.cabecalho, W - xTexto - M);
    doc.text(linhas, xTexto, 11);
    topoY = Math.max(topoY, 11 + linhas.length * 3.2 + 3);
  }
  doc.setDrawColor(60);
  doc.setLineWidth(0.5);
  doc.line(M, topoY, W - M, topoY);
  topoY += 6;

  let rodapeY = H - 12;
  doc.setLineWidth(0.4);
  if (t.rodape) {
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(60);
    const linhas = doc.splitTextToSize(t.rodape, W - M * 2);
    const altura = linhas.length * 3.2;
    doc.line(M, H - 8 - altura - 3, W - M, H - 8 - altura - 3);
    linhas.forEach((l: string, i: number) => {
      doc.text(l, W / 2, H - 8 - altura + i * 3.2 + 2.2, { align: 'center' });
    });
    rodapeY = H - 8 - altura - 7;
  } else {
    doc.line(M, H - 12, W - M, H - 12);
    rodapeY = H - 16;
  }
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  return { topoY, rodapeY };
}

/** Relatórios de várias páginas: o timbrado vale em todas. */
export function aplicarTimbradoEmTodasAsPaginas(doc: jsPDF, t: Timbrado): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    aplicarTimbrado(doc, t);
  }
}
