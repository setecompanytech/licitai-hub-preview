import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Link2, Loader2, Search } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR') : '—');

type Despesa = {
  id: string;
  data_vencimento: string | null;
  data_competencia: string | null;
  descricao: string | null;
  valor: number;
  status: string;
  categoria: { nome: string; natureza: string } | null;
  pessoa: { nome: string } | null;
};

type ContratoOpcao = {
  id: string;
  numero_contrato: string | null;
  orgao_contratante: string | null;
  data_fim: string | null;
};

/**
 * Vínculo em lote: as despesas de Contas a Pagar que ainda não apontam
 * contrato — o custo direto desgarrado que polui o rateio como se fosse
 * despesa indireta. Aqui elas são apontadas ao contrato de uma vez, e o
 * efeito é imediato nas duas pontas: entram no custo do contrato
 * (contrato_custo_realizado) e saem da base do rateio.
 *
 * Movimentação (transferência, aplicação, distribuição de lucro) fica fora
 * da lista: permuta de caixa não é custo de contrato nenhum.
 */
export default function FinVincularDespesasLote({
  aberto,
  onFechar,
  onVinculado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onVinculado: () => void;
}) {
  const { empresaAtiva } = useEmpresa();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [contratos, setContratos] = useState<ContratoOpcao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [contratoDestino, setContratoDestino] = useState('');

  useEffect(() => {
    if (!aberto || !empresaAtiva?.id) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setSelecionadas(new Set());
      const [despRes, contrRes] = await Promise.all([
        supabase
          .from('financeiro_lancamentos')
          .select('id, data_vencimento, data_competencia, descricao, valor, status, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(nome, natureza), pessoa:financeiro_pessoas(nome)')
          .eq('empresa_id', empresaAtiva.id)
          .eq('tipo', 'a_pagar')
          .is('contrato_id', null)
          .neq('status', 'cancelado')
          .order('valor', { ascending: false })
          .limit(500),
        supabase
          .from('contratos')
          .select('id, numero_contrato, orgao_contratante, data_fim')
          .eq('empresa_id', empresaAtiva.id)
          .is('excluido_em', null)
          .order('data_fim', { ascending: false, nullsFirst: false }),
      ]);
      if (cancelado) return;
      const todas = ((despRes.data as unknown as Despesa[]) || []).map(d => ({ ...d, valor: Number(d.valor) || 0 }));
      // Movimentação não é custo — fora da lista, pela mesma regra do rateio.
      setDespesas(todas.filter(d => d.categoria?.natureza !== 'movimentacao'));
      const cs = ((contrRes.data as unknown as ContratoOpcao[]) || []);
      setContratos(cs);
      // Pré-seleciona quando só há um contrato vigente — o caso comum.
      const hoje = new Date().toISOString().slice(0, 10);
      const vigentes = cs.filter(c => !c.data_fim || c.data_fim >= hoje);
      if (vigentes.length === 1) setContratoDestino(vigentes[0].id);
      setCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [aberto, empresaAtiva?.id]);

  const categorias = useMemo(() => {
    const s = new Set<string>();
    despesas.forEach(d => s.add(d.categoria?.nome || 'Sem categoria'));
    return Array.from(s).sort();
  }, [despesas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return despesas.filter(d => {
      const cat = d.categoria?.nome || 'Sem categoria';
      if (categoriaFiltro !== 'todas' && cat !== categoriaFiltro) return false;
      if (!q) return true;
      return (d.descricao || '').toLowerCase().includes(q)
        || (d.pessoa?.nome || '').toLowerCase().includes(q)
        || cat.toLowerCase().includes(q);
    });
  }, [despesas, busca, categoriaFiltro]);

  const todasFiltradasMarcadas = filtradas.length > 0 && filtradas.every(d => selecionadas.has(d.id));
  const totalSelecionado = despesas.filter(d => selecionadas.has(d.id)).reduce((s, d) => s + d.valor, 0);

  const alternarTodas = () => {
    setSelecionadas(prev => {
      const novo = new Set(prev);
      if (todasFiltradasMarcadas) filtradas.forEach(d => novo.delete(d.id));
      else filtradas.forEach(d => novo.add(d.id));
      return novo;
    });
  };

  const alternar = (id: string) => {
    setSelecionadas(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const vincular = async () => {
    if (!contratoDestino) { toast.error('Escolha o contrato de destino.'); return; }
    if (selecionadas.size === 0) { toast.error('Selecione ao menos uma despesa.'); return; }
    setSalvando(true);
    const ids = Array.from(selecionadas);
    const { error } = await supabase
      .from('financeiro_lancamentos')
      .update({ contrato_id: contratoDestino } as never)
      .in('id', ids);
    setSalvando(false);
    if (error) {
      toast.error('Não foi possível vincular', { description: error.message });
      return;
    }
    const c = contratos.find(x => x.id === contratoDestino);
    toast.success(`${ids.length} despesa${ids.length === 1 ? '' : 's'} (${fmt(totalSelecionado)}) vinculada${ids.length === 1 ? '' : 's'} ao contrato ${c?.numero_contrato || ''}.`, {
      description: 'Entram no custo do contrato e saem da base do rateio. O vínculo é reversível no lápis de cada lançamento.',
    });
    onVinculado();
    onFechar();
  };

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Vincular despesas em lote
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Despesas de Contas a Pagar ainda sem contrato (movimentação fica de fora).
          Ao vincular, entram no custo do contrato e saem da base do rateio — reversível
          lançamento a lançamento.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por descrição, fornecedor ou categoria…" className="pl-8 h-9 text-sm" />
          </div>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="h-9 text-sm sm:w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-auto flex-1 min-h-[200px]">
          {carregando ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {despesas.length === 0 ? 'Nenhuma despesa sem vínculo — tudo já aponta um contrato.' : 'Nada encontrado com esse filtro.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={todasFiltradasMarcadas} onCheckedChange={alternarTodas}
                      aria-label="Selecionar todas as filtradas" />
                  </TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Vencimento</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Categoria</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Situação</TableHead>
                  <TableHead className="text-xs text-right whitespace-nowrap">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map(d => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => alternar(d.id)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selecionadas.has(d.id)} onCheckedChange={() => alternar(d.id)}
                        aria-label="Selecionar despesa" />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap tabular-nums">{fmtDate(d.data_vencimento || d.data_competencia)}</TableCell>
                    <TableCell className="text-xs max-w-[240px]">
                      <span className="block truncate" title={d.descricao || undefined}>{d.descricao || '—'}</span>
                      {d.pessoa?.nome && <span className="block truncate text-[11px] text-muted-foreground">{d.pessoa.nome}</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px]"><span className="block truncate">{d.categoria?.nome || 'Sem categoria'}</span></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <Badge variant="outline" className="text-xs font-normal">
                        {d.status === 'realizado' || d.status === 'conciliado' ? 'Pago' : 'Em aberto'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap tabular-nums font-medium">{fmt(d.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
          <div className="flex-1 max-w-sm">
            <Label className="text-xs">Contrato de destino</Label>
            <Select value={contratoDestino} onValueChange={setContratoDestino}>
              <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Escolher contrato…" /></SelectTrigger>
              <SelectContent>
                {contratos.map(c => {
                  const vigente = !c.data_fim || c.data_fim >= hoje;
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero_contrato || '(sem número)'} — {(c.orgao_contratante || '').slice(0, 40)}{vigente ? '' : ' (encerrado)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{selecionadas.size} selecionada{selecionadas.size === 1 ? '' : 's'}</p>
              <p className="text-sm font-semibold tabular-nums">{fmt(totalSelecionado)}</p>
            </div>
            <Button variant="outline" onClick={onFechar}>Cancelar</Button>
            <Button onClick={vincular} disabled={salvando || selecionadas.size === 0 || !contratoDestino}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Link2 className="w-4 h-4 mr-1" />}
              Vincular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
