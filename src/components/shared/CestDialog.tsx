import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CEST_CODES, CEST_FONTE, SEGMENTOS_CEST, type CestCode } from '@/data/cest-codes';
import { cestCombinaComNcm, soDigitos } from '@/lib/fiscal/cest';
import { Search, ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react';

/**
 * Seleção de CEST (28/09/2026): tabela do Convênio ICMS 142/18, com o NCM de
 * cada item e o segmento. "Só os relacionados com o NCM do produto" agora
 * filtra de verdade (antes o interruptor não fazia nada, porque a tabela não
 * tinha NCM). Revogados ficam fora da lista.
 */
const PAGE_SIZE = 50;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (codigo: string, descricao: string) => void;
  ncmAtual?: string;
}

export default function CestDialog({ open, onOpenChange, onSelect, ncmAtual }: Props) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [page, setPage] = useState(1);
  const [segmento, setSegmento] = useState('__todos__');
  const temNcm = soDigitos(ncmAtual).length >= 4;
  const [soRelacionados, setSoRelacionados] = useState(true);

  const filtered = useMemo<CestCode[]>(() => {
    let list = CEST_CODES.filter((c) => !c.revogado);
    if (soRelacionados && temNcm) list = list.filter((c) => cestCombinaComNcm(c, ncmAtual));
    if (segmento !== '__todos__') list = list.filter((c) => c.segmento === segmento);
    const q = searched.trim().toLowerCase();
    if (q) {
      const qd = soDigitos(q);
      list = list.filter((c) =>
        c.codigo.includes(q) || (qd.length >= 3 && soDigitos(c.codigo).includes(qd)) || (qd.length >= 4 && c.ncmPrefixos.some((p) => p.startsWith(qd) || qd.startsWith(p)))
        || c.descricao.toLowerCase().includes(q),
      );
    }
    return list;
  }, [searched, soRelacionados, temNcm, ncmAtual, segmento]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  function handleSearch() { setSearched(query); setPage(1); }
  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }
  function limpar() { setQuery(''); setSearched(''); setPage(1); setSegmento('__todos__'); }
  function handleSelect(c: CestCode) {
    onSelect(c.codigo, c.descricao);
    onOpenChange(false);
    limpar();
  }

  const start = filtered.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(curPage * PAGE_SIZE, filtered.length);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) limpar(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold text-foreground">
            CEST (Código Especificador da Substituição Tributária)
          </DialogTitle>
          <p className="g-meta text-muted-foreground">
            {CEST_FONTE.ato}, Anexos II a XXVI, texto consolidado do CONFAZ lido em {CEST_FONTE.lidoEm.split('-').reverse().join('/')} · {CEST_CODES.filter((c) => !c.revogado).length.toLocaleString('pt-BR')} códigos vigentes ·{' '}
            <a href={CEST_FONTE.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">texto oficial <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
          </p>
        </DialogHeader>

        <div className="px-6 py-4 border-b space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder='Código, NCM ou descrição — ex.: "17.084.00", "0202" ou "carne"'
              className="min-w-64 flex-1"
              aria-label="Pesquisar CEST"
            />
            <Select value={segmento} onValueChange={(v) => { setSegmento(v); setPage(1); }}>
              <SelectTrigger className="w-72" aria-label="Segmento"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos os segmentos</SelectItem>
                {Object.entries(SEGMENTOS_CEST).map(([n, nome]) => <SelectItem key={n} value={n}>{n} — {nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}><Search aria-hidden="true" /> Pesquisar</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Switch id="so-relacionados" checked={soRelacionados && temNcm} onCheckedChange={(v) => { setSoRelacionados(v); setPage(1); }} disabled={!temNcm} />
            <Label htmlFor="so-relacionados" className="text-xs text-muted-foreground">
              {temNcm ? <>Só os CESTs cujo NCM no convênio casa com o NCM do produto (<b className="text-foreground">{ncmAtual}</b>)</> : 'Informe o NCM do produto para filtrar pelos CESTs relacionados'}
            </Label>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b z-10">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground w-28">CEST</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground w-40">NCM/SH</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Descrição</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground w-44">Segmento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageItems.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground text-sm">
                  {soRelacionados && temNcm ? 'Nenhum CEST no convênio para este NCM: a mercadoria provavelmente não tem substituição tributária. Desligue o filtro para ver a tabela inteira.' : 'Nenhum resultado encontrado'}
                </td></tr>
              ) : pageItems.map((c) => (
                <tr key={c.codigo} className="cursor-pointer hover:bg-muted/60" onClick={() => handleSelect(c)}>
                  <td className="py-2 px-4 text-primary font-medium text-xs whitespace-nowrap tabular-nums">{c.codigo}</td>
                  <td className="py-2 px-4 text-xs text-muted-foreground tabular-nums">{c.ncm || '—'}</td>
                  <td className="py-2 px-4 text-xs text-foreground">{c.descricao}</td>
                  <td className="py-2 px-4 text-xs text-muted-foreground">{c.segmento} — {SEGMENTOS_CEST[c.segmento] ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 border-t text-xs text-muted-foreground bg-muted/20">
          <span>{filtered.length === 0 ? 'Nenhum registro' : `${start} - ${end} de ${filtered.length.toLocaleString('pt-BR')} registros`}</span>
          <div className="flex items-center gap-1">
            <button type="button" className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage <= 1} onClick={() => setPage(1)} aria-label="Primeira página"><ChevronsLeft className="w-4 h-4" /></button>
            <button type="button" className="p-1 hover:text-foreground disabled:opacity-30 text-xs" disabled={curPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>◄ anterior</button>
            <span className="px-2">Página</span>
            <select value={curPage} onChange={(e) => setPage(Number(e.target.value))} className="border rounded px-1 py-0.5 text-xs bg-background" aria-label="Página">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="px-1">de {totalPages}</span>
            <button type="button" className="p-1 hover:text-foreground disabled:opacity-30 text-xs" disabled={curPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>próximo ►</button>
            <button type="button" className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage >= totalPages} onClick={() => setPage(totalPages)} aria-label="Última página"><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
