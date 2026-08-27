/**
 * Kit de faturamento: recibo + certidões, em ZIP ou em PDF único.
 *
 * O financeiro emite a NF-e e precisa enviar ao órgão, no mesmo ato, o recibo
 * de quitação e as negativas. Fazia isso baixando uma a uma, renomeando à mão
 * e torcendo para nenhuma estar vencida.
 *
 * Dois formatos porque os órgãos pedem coisas diferentes: uns aceitam pasta
 * compactada, outros exigem um PDF só — e converter na mão, na hora do envio,
 * é onde falta página.
 */

import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import {
  type CertidaoAvaliada, nomeDeArquivo, podeEnviar,
} from './certidoes';

export const BUCKET_DOCUMENTOS = 'documentos-habilitacao';

export type PecaDoKit = { nome: string; blob: Blob };

/**
 * Baixa as certidões enviáveis. Falha de uma não derruba o kit: o financeiro
 * precisa do que existe, e a que faltou aparece no índice como não obtida —
 * silêncio aqui viraria envio incompleto sem ninguém perceber.
 */
export async function baixarCertidoes(
  certidoes: CertidaoAvaliada[],
): Promise<{ pecas: PecaDoKit[]; falhas: string[] }> {
  const pecas: PecaDoKit[] = [];
  const falhas: string[] = [];

  for (const c of certidoes.filter(podeEnviar)) {
    const caminho = c.documento?.arquivo_path;
    if (!caminho) { falhas.push(c.nome); continue; }
    const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).download(caminho);
    if (error || !data) { falhas.push(c.nome); continue; }
    pecas.push({ nome: nomeDeArquivo(c.nome, caminho), blob: data });
  }
  return { pecas, falhas };
}

/** Índice em texto: o que foi anexado, com validade, e o que ficou de fora. */
export function indiceDoKit(
  certidoes: CertidaoAvaliada[],
  falhas: string[],
  cabecalho: string[],
): string {
  const linhas = [...cabecalho, '', 'CERTIDÕES', '─'.repeat(60)];
  for (const c of certidoes) {
    const validade = c.documento?.validade
      ? new Date(c.documento.validade.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')
      : '—';
    const situacao = falhas.includes(c.nome)
      ? 'NÃO ANEXADA (falha ao baixar)'
      : ({
          valida: 'anexada',
          vence_em_breve: `anexada — VENCE EM ${c.diasRestantes} DIA(S)`,
          sem_validade: 'anexada — sem data de validade cadastrada',
          vencida: `NÃO ANEXADA — VENCIDA há ${Math.abs(c.diasRestantes ?? 0)} dia(s)`,
          ausente: 'NÃO ANEXADA — não cadastrada no sistema',
        } as const)[c.situacao];
    linhas.push(`${c.nome}`, `    validade: ${validade}  ·  ${situacao}`);
  }
  return linhas.join('\n');
}

/** Pacote compactado: recibo, certidões e o índice. */
export async function montarZip(pecas: PecaDoKit[], indice: string): Promise<Blob> {
  const zip = new JSZip();
  for (const p of pecas) zip.file(p.nome, p.blob);
  zip.file('INDICE.txt', indice);
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Documento único, na ordem em que o órgão confere: recibo primeiro, depois as
 * certidões. Só PDF e imagem entram — o resto seria página em branco, e página
 * em branco no meio de um envio parece documento faltando.
 */
export async function montarPdfUnico(pecas: PecaDoKit[]): Promise<{ blob: Blob; ignorados: string[] }> {
  const alvo = await PDFDocument.create();
  const ignorados: string[] = [];

  for (const peca of pecas) {
    const bytes = new Uint8Array(await peca.blob.arrayBuffer());
    const ehPdf = bytes[0] === 0x25 && bytes[1] === 0x50; // "%P" de %PDF
    try {
      if (ehPdf) {
        const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await alvo.copyPages(origem, origem.getPageIndices());
        paginas.forEach((p) => alvo.addPage(p));
      } else if (/\.(jpe?g|png)$/i.test(peca.nome)) {
        const img = /\.png$/i.test(peca.nome)
          ? await alvo.embedPng(bytes)
          : await alvo.embedJpg(bytes);
        const pagina = alvo.addPage([595.28, 841.89]); // A4 em pontos
        const escala = Math.min(535 / img.width, 780 / img.height, 1);
        pagina.drawImage(img, {
          x: 30, y: 841.89 - 30 - img.height * escala,
          width: img.width * escala, height: img.height * escala,
        });
      } else {
        ignorados.push(peca.nome);
      }
    } catch {
      ignorados.push(peca.nome);
    }
  }

  // `save()` devolve Uint8Array<ArrayBufferLike>; BlobPart exige ArrayBuffer.
  const bytes = await alvo.save();
  return {
    blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
    ignorados,
  };
}

/** Entrega ao navegador. */
export function baixar(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
