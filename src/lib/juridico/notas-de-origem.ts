/**
 * Notas de origem — cada afirmação da peça diz de onde veio (27/09/2026).
 *
 * A IA escreve marcadores no texto:
 *   [[norma:Lei 14.133/2021, art. 136, I]]   — dispositivo citado
 *   [[fonte:sistema]]                        — dado lido do Praefectus (dossiê)
 *   [[fonte:anexo|Ofício 12/2026, p. 2]]      — documento anexado
 *   [[fonte:base|<id>|<título>]]             — documento da Base Jurídica
 * Na tela viram chips; norma fora da lista conferida sai como "a confirmar";
 * no PDF/Word viram parênteses e notas, nunca marcador cru.
 */
import { normaConferida, type NormaConferida } from './normas-conferidas';

export type Nota =
  | { tipo: 'norma'; citacao: string; conferida: NormaConferida | null }
  | { tipo: 'sistema' }
  | { tipo: 'anexo'; referencia: string }
  | { tipo: 'base'; id: string; titulo: string };

const MARCADOR = /\[\[(norma|fonte):([^\]]*)\]\]/g;

export function interpretarNota(tipo: string, corpo: string): Nota | null {
  const c = corpo.trim();
  if (tipo === 'norma') return c ? { tipo: 'norma', citacao: c, conferida: normaConferida(c) } : null;
  const [origem, ...resto] = c.split('|');
  if (origem === 'sistema') return { tipo: 'sistema' };
  if (origem === 'anexo') return { tipo: 'anexo', referencia: resto.join('|').trim() || 'documento anexado' };
  if (origem === 'base') return { tipo: 'base', id: (resto[0] ?? '').trim(), titulo: resto.slice(1).join('|').trim() || 'documento da base' };
  return null;
}

export function notasDoTexto(md: string): Nota[] {
  const notas: Nota[] = [];
  for (const m of md.matchAll(MARCADOR)) {
    const n = interpretarNota(m[1], m[2]);
    if (n) notas.push(n);
  }
  return notas;
}

/** Marcadores viram links `nota://…` que o preview renderiza como chips. */
export function marcarNotasComoLinks(md: string): string {
  return md.replace(MARCADOR, (todo, tipo: string, corpo: string) => {
    const n = interpretarNota(tipo, corpo);
    if (!n) return '';
    const rotulo = n.tipo === 'norma' ? n.citacao : n.tipo === 'sistema' ? 'dado do sistema' : n.tipo === 'anexo' ? n.referencia : n.titulo;
    return ` [${rotulo.replace(/[[\]]/g, '')}](nota://${tipo}/${encodeURIComponent(corpo.trim())})`;
  });
}

/** Para PDF e Word: norma entre parênteses; fonte vira nota curta; nada de colchete duplo. */
export function textoParaExportacao(md: string): string {
  return md.replace(MARCADOR, (todo, tipo: string, corpo: string) => {
    const n = interpretarNota(tipo, corpo);
    if (!n) return '';
    if (n.tipo === 'norma') return ` (${n.citacao}${n.conferida ? '' : ' — a confirmar'})`;
    if (n.tipo === 'anexo') return ` (doc. anexo: ${n.referencia})`;
    if (n.tipo === 'base') return ` (ref.: ${n.titulo})`;
    return '';
  }).replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ');
}

export type ResumoDasNotas = {
  normasConferidas: number;
  normasAConfirmar: string[];
  fontesDoSistema: number;
  anexos: number;
  base: number;
};

export function resumoDasNotas(md: string): ResumoDasNotas {
  const r: ResumoDasNotas = { normasConferidas: 0, normasAConfirmar: [], fontesDoSistema: 0, anexos: 0, base: 0 };
  for (const n of notasDoTexto(md)) {
    if (n.tipo === 'norma') {
      if (n.conferida) r.normasConferidas += 1;
      else if (!r.normasAConfirmar.includes(n.citacao)) r.normasAConfirmar.push(n.citacao);
    } else if (n.tipo === 'sistema') r.fontesDoSistema += 1;
    else if (n.tipo === 'anexo') r.anexos += 1;
    else r.base += 1;
  }
  return r;
}
