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

export type Timbrado = {
  logoDataUrl: string | null;
  /** largura/altura do logotipo — para escalar sem distorcer. */
  logoRatio: number;
  cabecalho: string | null;
  rodape: string | null;
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
    const { data } = await (supabase.from('empresa_timbrado' as never) as any)
      .select('logo_path, cabecalho, rodape')
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (data && (data.logo_path || data.cabecalho || data.rodape)) {
      let logoDataUrl: string | null = null;
      let logoRatio = 3;
      if (data.logo_path) {
        const { data: blob } = await supabase.storage.from('empresa-timbrado').download(data.logo_path);
        if (blob) {
          logoDataUrl = await blobParaDataUrl(blob);
          logoRatio = await medirProporcao(logoDataUrl).catch(() => 3);
        }
      }
      t = { logoDataUrl, logoRatio, cabecalho: data.cabecalho || null, rodape: data.rodape || null };
    }
  } catch {
    // Tabela ausente (migration pendente) ou rede: sem timbrado, sem quebra.
    t = null;
  }
  cache.set(empresaId, { t, em: Date.now() });
  return t;
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
