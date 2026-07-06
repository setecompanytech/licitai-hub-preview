import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CEST_CODES, type CestCode } from '@/data/cest-codes';
import { Search, ChevronsLeft, ChevronRight, ChevronsRight, Filter, ChevronsUpDown } from 'lucide-react';

const PAGE_SIZE = 50;

function codigoSemMascara(codigo: string): string {
  return codigo.replace(/\./g, '');
}

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
  const [soRelacionados, setSoRelacionados] = useState(false);

  const filtered = useMemo<CestCode[]>(() => {
    let list = CEST_CODES;
    if (searched.trim()) {
      const q = searched.trim().toLowerCase();
      list = list.filter(c =>
        c.codigo.toLowerCase().includes(q) ||
        c.descricao.toLowerCase().includes(q) ||
        codigoSemMascara(c.codigo).includes(q)
      );
    }
    return list;
  }, [searched, soRelacionados]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  function handleSearch() { setSearched(query); setPage(1); }
  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter') handleSearch(); }

  function handleSelect(c: CestCode) {
    onSelect(c.codigo, c.descricao);
    onOpenChange(false);
    setQuery(''); setSearched(''); setPage(1);
  }

  const start = filtered.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(curPage * PAGE_SIZE, filtered.length);

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) { setQuery(''); setSearched(''); setPage(1); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold text-teal-700">
            CEST (Código Especificador da Substituição Tributária)
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 border-b space-y-3">
          <p className="text-xs text-muted-foreground">
            <strong>Digite o que deseja pesquisar</strong> (Código ou Descrição)
          </p>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder='Exemplo: "27.000.00" ou "Objetos de vidro para serviço de mesa ou de cozinha"'
              className="flex-1 border-teal-400/60 focus-visible:ring-teal-400"
            />
            <Button onClick={handleSearch} className="bg-amber-500 hover:bg-amber-600 text-white px-6 rounded-full gap-2">
              <Search className="w-4 h-4" /> Pesquisar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="so-relacionados"
              checked={soRelacionados}
              onCheckedChange={v => { setSoRelacionados(v); setPage(1); }}
              disabled={!ncmAtual}
            />
            <Label htmlFor="so-relacionados" className="text-xs text-muted-foreground flex items-center gap-1">
              Exibir somente os CESTs relacionados com o NCM do produto
              <span className="cursor-help" title="Filtra os CESTs vinculados ao NCM selecionado no produto">ⓘ</span>
            </Label>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b z-10">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground w-32">
                  <div className="flex items-center gap-1">Código <ChevronsUpDown className="w-3 h-3 opacity-40" /></div>
                  <div className="h-px bg-border mt-1" />
                  <div className="flex items-center gap-1 mt-0.5 opacity-40"><Filter className="w-3 h-3" /></div>
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">Descrição <ChevronsUpDown className="w-3 h-3 opacity-40" /></div>
                  <div className="h-px bg-border mt-1" />
                  <div className="flex items-center gap-1 mt-0.5 opacity-40"><Filter className="w-3 h-3" /></div>
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground w-36">
                  <div className="flex items-center gap-1">Código sem Máscara <ChevronsUpDown className="w-3 h-3 opacity-40" /></div>
                  <div className="h-px bg-border mt-1" />
                  <div className="flex items-center gap-1 mt-0.5 opacity-40"><Filter className="w-3 h-3" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageItems.length === 0 ? (
                <tr><td colSpan={3} className="py-10 text-center text-muted-foreground text-sm">Nenhum resultado encontrado</td></tr>
              ) : pageItems.map((c, i) => (
                <tr
                  key={c.codigo}
                  className={`cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950/20 transition-colors ${i === 0 && page === 1 ? 'bg-amber-50 dark:bg-amber-950/20' : i % 2 === 0 ? '' : 'bg-muted/20'}`}
                  onClick={() => handleSelect(c)}
                >
                  <td className="py-2 px-4 text-amber-700 font-medium text-xs whitespace-nowrap">{c.codigo}</td>
                  <td className="py-2 px-4 text-xs text-muted-foreground">{c.descricao}</td>
                  <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">{codigoSemMascara(c.codigo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t text-xs text-muted-foreground bg-muted/20">
          <span>{filtered.length === 0 ? 'Nenhum registro' : `${start} - ${end} de ${filtered.length} registros`}</span>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-4 h-4" /></button>
            <button className="p-1 hover:text-foreground disabled:opacity-30 text-xs" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>◄ anterior</button>
            <span className="px-2">Página</span>
            <select
              value={curPage}
              onChange={e => setPage(Number(e.target.value))}
              className="border rounded px-1 py-0.5 text-xs bg-background"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="px-1">de {totalPages}</span>
            <button className="p-1 hover:text-foreground disabled:opacity-30 text-xs" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>próximo ►</button>
            <button className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
