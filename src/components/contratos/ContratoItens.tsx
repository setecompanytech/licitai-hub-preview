import { useState, useEffect, useMemo } from 'react';
import { UNIDADES } from '@/lib/unidades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Package, Copy, Download, Link2, History, Layers, Search, Pencil
} from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import EstruturaDocumentoCard from './EstruturaDocumentoCard';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Item antigo pode ter a PALAVRA "null" gravada como unidade (extração que
// declarou ausência em prosa). Na tela, isso não é unidade — é vazio.
const uni = (u?: string | null) => (u && u.trim() && !/^null$/i.test(u.trim()) ? u : '');

type Produto = { id: string; codigo: string | null; descricao: string; unidade: string; preco_venda: number | null };

type ContratoItem = {
  id: string; contrato_id: string; descricao: string; unidade: string;
  quantidade_contratada: number; valor_unitario: number; valor_total: number;
  quantidade_consumida: number; saldo_quantitativo: number; saldo_financeiro: number;
  codigo_item: string | null; observacoes: string | null; origem_aditivo_id: string | null;
  ata_item_id: string | null; quantidade_ata_consumida: number | null;
  custo_unitario?: number | null; custo_total?: number | null;
  numero_lote?: string | null; descricao_lote?: string | null;
};

type Aditivo = { id: string; numero_aditivo: string; tipo: string; };

type ContratoMeta = {
  tipo_documento: 'contrato' | 'ata_srp' | string;
  ata_srp_id: string | null;
  tipo_estrutura?: 'itens' | 'lotes' | string | null;
};

/** Chave de agrupamento para identificar o mesmo item físico entre versões */
function itemGroupKey(item: ContratoItem): string {
  return item.codigo_item?.toLowerCase().trim()
    || item.descricao.toLowerCase().trim();
}

/** Item consolidado: representa o estado ATUAL de um item físico, agregando todas as suas versões (original + aditivos) */
type ItemConsolidado = ContratoItem & {
  _versoes: ContratoItem[];         // todas as versões (inclusive a atual)
  _original: ContratoItem | null;   // versão original (origem_aditivo_id = null), se existir
  _foiModificado: boolean;          // item original foi alterado por pelo menos um aditivo
  _foiAdicionado: boolean;          // item novo criado por um aditivo (não existia no original)
  _aditivoModificador: Aditivo | null; // aditivo responsável pelo estado atual
};

export default function ContratoItens({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isFinanceiro, isAdmin } = useMembroPermissoes();
  const podeVerCustos = isFinanceiro || isAdmin;
  const [meta, setMeta] = useState<ContratoMeta | null>(null);
  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [ataItens, setAtaItens] = useState<ContratoItem[]>([]);
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consolidado, setConsolidado] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [prodSearch, setProdSearch] = useState('');
  const [prodPopover, setProdPopover] = useState(false);
  const [form, setForm] = useState({
    produto_id: '', descricao: '', unidade: 'UN', quantidade_contratada: '',
    valor_unitario: '', custo_unitario: '', codigo_item: '', observacoes: '', origem_aditivo_id: '',
    ata_item_id: '',
  });

  const isContratoComATA = meta?.tipo_documento === 'contrato' && !!meta?.ata_srp_id;

  // A trava do "mesmo preço da ata" protege a CONTRATAÇÃO — mas o art. 124,
  // II, "d" (reequilíbrio) e os institutos irmãos autorizam exatamente a
  // divergência que ela proíbe. Registrado o aditivo no contrato, o preço do
  // item destrava; sem aditivo, a trava continua sendo a lei.
  const temAditivoForaDoObjeto = aditivos.some((a: { tipo?: string }) =>
    ['reequilibrio', 'revisao', 'repactuacao', 'reajuste'].includes(a.tipo || ''));

  const filteredProdutos = useMemo(() => {
    if (!prodSearch.trim()) return produtos.slice(0, 12);
    const q = prodSearch.toLowerCase();
    return produtos.filter(p =>
      p.descricao.toLowerCase().includes(q) ||
      (p.codigo && p.codigo.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [prodSearch, produtos]);

  const onSelectProduto = (prod: Produto) => {
    setForm(f => ({
      ...f,
      produto_id: prod.id,
      descricao: prod.descricao,
      unidade: prod.unidade,
      codigo_item: prod.codigo || f.codigo_item,
      valor_unitario: prod.preco_venda != null ? String(prod.preco_venda) : f.valor_unitario,
    }));
    setProdSearch(prod.descricao);
    setProdPopover(false);
  };

  // Agrupa itens pelo mesmo item físico (mesmo codigo_item ou mesma descrição)
  // e retorna a visão consolidada: uma linha por item físico com o estado mais recente
  const itensMesclados = useMemo((): ItemConsolidado[] => {
    const grupos = new Map<string, ContratoItem[]>();
    for (const item of itens) {
      const key = itemGroupKey(item);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(item);
    }

    const result: ItemConsolidado[] = [];
    for (const grupo of grupos.values()) {
      const original = grupo.find(i => !i.origem_aditivo_id) ?? null;

      // Ordena versões com aditivo pela posição do aditivo na lista (preserva a ordem cronológica)
      const versoesPorAditivo = grupo
        .filter(i => i.origem_aditivo_id)
        .sort((a, b) =>
          aditivos.findIndex(x => x.id === a.origem_aditivo_id) -
          aditivos.findIndex(x => x.id === b.origem_aditivo_id)
        );

      // Estado efetivo = última versão de aditivo, ou original se não há versões de aditivo
      const efetivo = versoesPorAditivo.length > 0
        ? versoesPorAditivo[versoesPorAditivo.length - 1]
        : (original ?? grupo[0]);

      const aditivoModificador = efetivo.origem_aditivo_id
        ? (aditivos.find(a => a.id === efetivo.origem_aditivo_id) ?? null)
        : null;

      result.push({
        ...efetivo,
        _versoes: grupo,
        _original: original,
        _foiModificado: !!original && versoesPorAditivo.length > 0,
        _foiAdicionado: !original && versoesPorAditivo.length > 0,
        _aditivoModificador: aditivoModificador,
      });
    }
    return result;
  }, [itens, aditivos]);

  // Na visão consolidada, totais calculados apenas sobre o estado efetivo (sem duplicar versões)
  const itensExibidos = consolidado ? itensMesclados : itens;
  const totalContratadoEfetivo = itensMesclados.reduce((s, i) => s + i.valor_total, 0);
  const totalSaldoEfetivo = itensMesclados.reduce((s, i) => s + i.saldo_financeiro, 0);

  const loadData = async () => {
    setLoading(true);
    const metaRes = await supabase.from('contratos').select('tipo_documento, ata_srp_id, tipo_estrutura, empresa_id, valor_global').eq('id', contratoId).maybeSingle();
    const m = metaRes.data as ContratoMeta | null;
    setMeta(m);

    const empresaId = (m as any)?.empresa_id || empresaAtiva?.id;

    const [itensRes, aditivosRes, produtosRes] = await Promise.all([
      supabase.from('contrato_itens').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('contrato_aditivos').select('id, numero_aditivo, tipo').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      empresaId
        ? supabase.from('produtos').select('id, codigo, descricao, unidade, preco_venda').eq('empresa_id', empresaId).order('descricao')
        : Promise.resolve({ data: [] }),
    ]);
    setItens((itensRes.data as any[]) || []);
    setAditivos((aditivosRes.data as any[]) || []);
    setProdutos((produtosRes.data as any[]) || []);

    if (m?.tipo_documento === 'contrato' && m.ata_srp_id) {
      const ataItensRes = await supabase.from('contrato_itens').select('*').eq('contrato_id', m.ata_srp_id).order('created_at', { ascending: true });
      setAtaItens((ataItensRes.data as any[]) || []);
    } else {
      setAtaItens([]);
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [contratoId]);

  const getOrigemLabel = (aditivoId: string | null) => {
    if (!aditivoId) return meta?.tipo_documento === 'ata_srp' ? 'ATA SRP' : 'Contrato Original';
    const ad = aditivos.find(a => a.id === aditivoId);
    return ad ? `Aditivo ${ad.numero_aditivo}` : 'Aditivo';
  };

  const ataItemLabel = (id: string | null) => {
    if (!id) return null;
    const it = ataItens.find(a => a.id === id);
    if (!it) return 'Item da ATA';
    return `${it.codigo_item || '—'} · ${it.descricao.slice(0, 40)}${it.descricao.length > 40 ? '…' : ''}`;
  };

  const onSelectAtaItem = (ataItemId: string) => {
    const it = ataItens.find(a => a.id === ataItemId);
    if (!it) {
      setForm(f => ({ ...f, ata_item_id: '' }));
      return;
    }
    const saldo = Math.max((it.quantidade_contratada || 0) - (it.quantidade_ata_consumida || 0), 0);
    setForm(f => ({
      ...f,
      ata_item_id: ataItemId,
      descricao: it.descricao,
      unidade: it.unidade,
      codigo_item: it.codigo_item || '',
      valor_unitario: String(it.valor_unitario),
      quantidade_contratada: f.quantidade_contratada || String(saldo || ''),
    }));
  };

  const handleSave = async () => {
    if (isContratoComATA && !form.ata_item_id) {
      toast.error('Selecione o item da ATA de origem');
      return;
    }
    if (!form.descricao) { toast.error('Informe a descrição do item'); return; }

    const qty = parseFloat(form.quantidade_contratada) || 0;
    const unit = parseFloat(form.valor_unitario) || 0;
    const total = qty * unit;

    // valida saldo da ATA
    if (form.ata_item_id) {
      const ataItem = ataItens.find(a => a.id === form.ata_item_id);
      if (ataItem) {
        const saldoDisp = Math.max((ataItem.quantidade_contratada || 0) - (ataItem.quantidade_ata_consumida || 0), 0);
        if (qty > saldoDisp) {
          toast.error(`Quantidade excede saldo da ATA (disponível: ${saldoDisp})`);
          return;
        }
      }
    }

    const custoUnit = parseFloat(form.custo_unitario) || 0;

    setSaving(true);

    // Resolve produto_id: usa o selecionado, ou busca por nome, ou cria automaticamente
    let produtoId: string | null = form.produto_id || null;
    const empresaId = (meta as any)?.empresa_id || empresaAtiva?.id;
    if (!produtoId && empresaId) {
      const { data: existing } = await supabase
        .from('produtos')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('descricao', form.descricao.trim())
        .maybeSingle();
      if (existing) {
        produtoId = (existing as any).id;
      } else {
        // Cria produto automaticamente para manter sincronização
        const { data: newProd } = await supabase
          .from('produtos')
          .insert({
            empresa_id: empresaId,
            descricao: form.descricao.trim(),
            unidade: form.unidade,
            codigo: form.codigo_item || null,
            preco_venda: unit || null,
          } as any)
          .select('id')
          .single();
        if (newProd) {
          produtoId = (newProd as any).id;
          toast.info('Produto criado automaticamente no catálogo.');
        }
      }
    }

    const { error } = await supabase.from('contrato_itens').insert({
      contrato_id: contratoId,
      user_id: user!.id,
      descricao: form.descricao,
      unidade: form.unidade,
      quantidade_contratada: qty,
      valor_unitario: unit,
      valor_total: total,
      // custo_total NÃO se grava: é coluna GERADA no banco
      // (custo_unitario * quantidade_contratada) — enviar valor aqui é erro.
      // E custo_unitario é NOT NULL DEFAULT 0: custo em branco é ZERO, não
      // nulo — mandar null viola a constraint e derruba o salvar.
      custo_unitario: custoUnit || 0,
      saldo_quantitativo: qty,
      saldo_financeiro: total,
      codigo_item: form.codigo_item || null,
      observacoes: form.observacoes || null,
      origem_aditivo_id: form.origem_aditivo_id || null,
      ata_item_id: form.ata_item_id || null,
      produto_id: produtoId,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar item', { description: error.message }); return; }
    toast.success('Item cadastrado!');
    setDialogOpen(false);
    setForm({ produto_id: '', descricao: '', unidade: 'UN', quantidade_contratada: '', valor_unitario: '', custo_unitario: '', codigo_item: '', observacoes: '', origem_aditivo_id: '', ata_item_id: '' });
    setProdSearch('');
    loadData();
  };

  const handleImportarDaAta = async () => {
    if (!isContratoComATA || ataItens.length === 0) return;
    if (!confirm(`Importar ${ataItens.length} item(ns) da ATA para o contrato? Quantidades virão com o saldo disponível e podem ser ajustadas depois.`)) return;
    setImporting(true);
    try {
      const jaImportados = new Set(itens.filter(i => i.ata_item_id).map(i => i.ata_item_id));
      const novos = ataItens
        .filter(it => !jaImportados.has(it.id))
        .map(it => {
          const saldo = Math.max((it.quantidade_contratada || 0) - (it.quantidade_ata_consumida || 0), 0);
          return {
            contrato_id: contratoId,
            user_id: user!.id,
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade_contratada: saldo,
            valor_unitario: it.valor_unitario,
            valor_total: saldo * (it.valor_unitario || 0),
            saldo_quantitativo: saldo,
            saldo_financeiro: saldo * (it.valor_unitario || 0),
            codigo_item: it.codigo_item,
            ata_item_id: it.id,
          };
        });
      if (novos.length === 0) {
        toast.info('Todos os itens da ATA já foram importados');
      } else {
        const { error } = await supabase.from('contrato_itens').insert(novos as any);
        if (error) throw error;
        toast.success(`${novos.length} item(ns) importado(s) da ATA`);
      }
      loadData();
    } catch (err: any) {
      toast.error('Erro ao importar', { description: err.message });
    } finally {
      setImporting(false);
    }
  };

  /**
   * Edição do item — que não existia: o item só nascia e morria, e uma
   * quantidade zerada (scan que não rendeu o número) ficava presa para sempre,
   * com o financeiro dizendo 25% da ata e os quilos dizendo nada.
   *
   * O preço continua travado quando o item aponta a ata (mesmo preço e
   * condições); quantidade, custo e observações são de quem gerencia.
   */
  // Visualizador da descrição: a tabela trunca por necessidade ("CORTE PA…"),
  // mas a especificação completa — 700 caracteres de norma técnica — precisa
  // de um lugar para ser LIDA. Clicar no item abre a ficha, só leitura.
  const [itemVisualizado, setItemVisualizado] = useState<ContratoItem | null>(null);
  const [editItem, setEditItem] = useState<ContratoItem | null>(null);
  const [editForm, setEditForm] = useState({ quantidade: '', valor_unitario: '', custo_unitario: '', observacoes: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const abrirEdicao = (item: ContratoItem) => {
    setEditItem(item);
    setEditForm({
      quantidade: String(item.quantidade_contratada ?? ''),
      valor_unitario: String(item.valor_unitario ?? ''),
      custo_unitario: item.custo_unitario != null ? String(item.custo_unitario) : '',
      observacoes: (item as { observacoes?: string | null }).observacoes ?? '',
    });
  };

  const salvarEdicao = async () => {
    if (!editItem) return;
    const qtd = parseFloat(editForm.quantidade) || 0;
    const travado = isContratoComATA && !!editItem.ata_item_id && !temAditivoForaDoObjeto;
    const vu = travado ? (editItem.valor_unitario || 0) : (parseFloat(editForm.valor_unitario) || 0);

    // O saldo da ata vale também na edição — descontando a própria fatia
    // antiga, senão o item não conseguiria nem manter a quantidade que já tem.
    if (editItem.ata_item_id) {
      const ataItem = ataItens.find(a => a.id === editItem.ata_item_id);
      if (ataItem) {
        const consumidoPorOutros = Math.max((ataItem.quantidade_ata_consumida || 0) - (editItem.quantidade_contratada || 0), 0);
        const disponivel = Math.max((ataItem.quantidade_contratada || 0) - consumidoPorOutros, 0);
        if (qtd > disponivel) {
          toast.error(`Quantidade excede o saldo da ATA (disponível para este item: ${disponivel.toLocaleString('pt-BR')})`);
          return;
        }
      }
    }

    setSavingEdit(true);
    const vt = qtd * vu;
    const consumidaQtd = editItem.quantidade_consumida || 0;
    const consumidoFin = Math.max((editItem.valor_total || 0) - (editItem.saldo_financeiro || 0), 0);
    const { error } = await supabase.from('contrato_itens').update({
      quantidade_contratada: qtd,
      valor_unitario: vu,
      valor_total: vt,
      custo_unitario: parseFloat(editForm.custo_unitario) || 0,
      observacoes: editForm.observacoes || null,
      // Os saldos preservam o já consumido: editar a quantidade não apaga pedidos.
      saldo_quantitativo: Math.max(qtd - consumidaQtd, 0),
      saldo_financeiro: Math.max(vt - consumidoFin, 0),
    } as never).eq('id', editItem.id);
    setSavingEdit(false);
    if (error) { toast.error('Erro ao salvar item', { description: error.message }); return; }
    toast.success('Item atualizado — saldos da ATA recalculados.');
    setEditItem(null);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contrato_itens').delete().eq('id', id);
    toast.success('Item excluído');
    loadData();
  };

  const handleDuplicate = async (item: ContratoItem) => {
    const prodId = (item as any).produto_id || '';
    setForm({
      produto_id: prodId,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade_contratada: String(item.quantidade_contratada),
      valor_unitario: String(item.valor_unitario),
      custo_unitario: item.custo_unitario != null ? String(item.custo_unitario) : '',
      codigo_item: item.codigo_item || '',
      observacoes: `Duplicado do item "${item.descricao}" — vinculado a aditivo`,
      origem_aditivo_id: '',
      ata_item_id: item.ata_item_id || '',
    });
    setProdSearch(item.descricao);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <EstruturaDocumentoCard contratoId={contratoId} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" /> Itens {meta?.tipo_documento === 'ata_srp' ? 'da ATA SRP' : 'do Contrato'}
            {meta?.tipo_estrutura && (
              <Badge variant="outline" className="text-xs font-normal">
                Estrutura: {meta.tipo_estrutura === 'lotes' ? 'Lotes' : 'Itens'}
              </Badge>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            Total efetivo: {fmt(totalContratadoEfetivo)} | Saldo: {fmt(totalSaldoEfetivo)}
            {!consolidado && itens.length !== itensMesclados.length && (
              <span className="ml-2 text-warning">({itens.length} registros, {itensMesclados.length} itens físicos)</span>
            )}
          </p>
          {(() => {
            // Os dois livros do contrato: o Valor Global (original + aditivos,
            // automático) e a soma dos itens (declarada no lápis). Divergência
            // acima de 1% é preço de item errado ou aditivo mal lançado — e os
            // dois já divergiram em milhões sem ninguém acusar, quando o VALOR
            // do acréscimo foi digitado como PREÇO unitário.
            const global = Number((meta as { valor_global?: number } | null)?.valor_global) || 0;
            if (global <= 0 || totalContratadoEfetivo <= 0) return null;
            const dif = totalContratadoEfetivo - global;
            if (Math.abs(dif) <= global * 0.01) return null;
            return (
              <p className="text-xs text-destructive mt-0.5">
                ⚠ A soma dos itens {dif > 0 ? 'excede' : 'fica abaixo de'} o Valor Global do contrato
                ({fmt(global)}) em {fmt(Math.abs(dif))}. Confira o preço unitário dos itens
                e os aditivos — os dois totais devem fechar.
              </p>
            );
          })()}

          {isContratoComATA && (
            <p className="text-xs text-warning mt-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Contrato vinculado à ATA SRP — itens devem ser selecionados da ATA de origem
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle de visão mesclada / todos os registros */}
          {aditivos.length > 0 && (
            <Button
              size="sm"
              variant={consolidado ? 'secondary' : 'outline'}
              onClick={() => setConsolidado(v => !v)}
              className="text-xs gap-1.5"
            >
              {consolidado ? <Layers className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
              {consolidado ? 'Consolidado' : 'Todos os registros'}
            </Button>
          )}
          {isContratoComATA && ataItens.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleImportarDaAta} disabled={importing}>
              {importing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
              Importar itens da ATA
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar Item {meta?.tipo_documento === 'ata_srp' ? 'da ATA' : 'do Contrato'}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {/* Busca de produto sincronizado */}
                <div className="col-span-2">
                  <Label className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" /> Buscar Produto do Catálogo
                    {form.produto_id && <span className="text-xs text-success font-normal">(vinculado)</span>}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      value={prodSearch}
                      onChange={e => { setProdSearch(e.target.value); setProdPopover(true); setForm(f => ({ ...f, produto_id: '', descricao: e.target.value })); }}
                      onFocus={() => setProdPopover(true)}
                      onBlur={() => setTimeout(() => setProdPopover(false), 150)}
                      placeholder="Digite para buscar ou criar produto..."
                      className={form.produto_id ? 'border-success/50 bg-success/5' : ''}
                    />
                    {prodPopover && (
                      <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-52 overflow-y-auto">
                        {filteredProdutos.length > 0 ? (
                          filteredProdutos.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 flex items-center gap-2"
                              onMouseDown={() => onSelectProduto(p)}
                            >
                              {p.codigo && <span className="font-mono text-muted-foreground text-xs shrink-0">[{p.codigo}]</span>}
                              <span className="flex-1 truncate">{p.descricao}</span>
                              <span className="shrink-0 text-muted-foreground">{p.unidade}{p.preco_venda ? ` · ${fmt(p.preco_venda)}` : ''}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                            Produto não encontrado — será criado automaticamente ao salvar.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione um produto existente ou digite para criar um novo automaticamente.
                  </p>
                </div>

                {isContratoComATA && (
                  <div className="col-span-2">
                    <Label>Item da ATA de origem *</Label>
                    <Select value={form.ata_item_id} onValueChange={onSelectAtaItem}>
                      <SelectTrigger><SelectValue placeholder="Selecionar item da ATA" /></SelectTrigger>
                      <SelectContent>
                        {ataItens.map(it => {
                          const saldo = Math.max((it.quantidade_contratada || 0) - (it.quantidade_ata_consumida || 0), 0);
                          return (
                            <SelectItem key={it.id} value={it.id} disabled={saldo <= 0}>
                              {it.codigo_item ? `[${it.codigo_item}] ` : ''}{it.descricao.slice(0, 60)} — saldo: {saldo} {it.unidade}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ao selecionar, descrição/unidade/valor são preenchidos automaticamente.
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <Label>Origem (Aditivo)</Label>
                  <Select value={form.origem_aditivo_id} onValueChange={v => setForm(f => ({ ...f, origem_aditivo_id: v === '__contrato__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__contrato__">{meta?.tipo_documento === 'ata_srp' ? 'ATA Original' : 'Contrato Original'}</SelectItem>
                      {aditivos.map(a => (
                        <SelectItem key={a.id} value={a.id}>Aditivo {a.numero_aditivo} ({a.tipo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Descrição *</Label>
                  <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} disabled={isContratoComATA && !!form.ata_item_id} />
                </div>
                <div>
                  <Label>Código</Label>
                  <Input value={form.codigo_item} onChange={e => setForm(f => ({ ...f, codigo_item: e.target.value }))} placeholder="ITEM-01" disabled={isContratoComATA && !!form.ata_item_id} />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))} disabled={isContratoComATA && !!form.ata_item_id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map(u => u.codigo).map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" value={form.quantidade_contratada} onChange={e => setForm(f => ({ ...f, quantidade_contratada: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Unitário Venda (R$)</Label>
                  <MoneyInput value={Number(form.valor_unitario) || 0} onValueChange={v => setForm(f => ({ ...f, valor_unitario: String(v) }))} disabled={isContratoComATA && !!form.ata_item_id} />
                  {isContratoComATA && !!form.ata_item_id && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Travado no preço registrado da ATA — o contrato derivado segue o mesmo preço
                      e condições da ata. Se o registrado mudar por reequilíbrio ou reajuste, a
                      alteração se faz no item da ATA, e o histórico de preços guarda de quanto
                      para quanto foi.
                    </p>
                  )}
                </div>
                {podeVerCustos && (
                  <div className="col-span-2">
                    <Label>Custo Unitário (R$) <span className="text-xs text-muted-foreground">(opcional — apenas Financeiro/Admin)</span></Label>
                    <MoneyInput value={Number(form.custo_unitario) || 0} onValueChange={v => setForm(f => ({ ...f, custo_unitario: String(v) }))} placeholder="R$ 0,00" />
                  </div>
                )}
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          {isContratoComATA && ataItens.length > 0
            ? 'Nenhum item ainda. Use "Importar itens da ATA" para começar.'
            : 'Nenhum item cadastrado'}
        </Card>
      ) : (
        <TooltipProvider>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs whitespace-nowrap">Situação</TableHead>
                {meta?.tipo_estrutura === 'lotes' && <TableHead className="text-xs whitespace-nowrap">Lote</TableHead>}
                {/* Pares que são um assunto só viram UMA coluna com duas
                    linhas (unitário em cima, total embaixo): treze colunas
                    empurravam Saldo e o lápis para a rolagem horizontal, que o
                    macOS esconde — a tabela parecia quebrada e a edição ficava
                    inalcançável. O que ela existe para mostrar e permitir tem
                    de caber SEM rolar. */}
                <TableHead className="text-xs whitespace-nowrap">Item</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Qtd</TableHead>
                {podeVerCustos && <TableHead className="text-xs text-right whitespace-nowrap">Custo</TableHead>}
                <TableHead className="text-xs text-right whitespace-nowrap">Valor</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Consumido</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Saldo</TableHead>
                <TableHead className="text-xs w-10 sticky right-0 bg-card border-l border-border"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(itensExibidos as (ContratoItem & Partial<ItemConsolidado>)[]).map(item => {
                const pct = item.quantidade_contratada > 0
                  ? (item.quantidade_consumida / item.quantidade_contratada) * 100 : 0;
                const lowStock = pct >= 80;

                // Lógica de badge de situação para visão consolidada
                const foiModificado = !!(item as ItemConsolidado)._foiModificado;
                const foiAdicionado = !!(item as ItemConsolidado)._foiAdicionado;
                const aditivoModificador = (item as ItemConsolidado)._aditivoModificador ?? null;
                const original = (item as ItemConsolidado)._original ?? null;

                // Para visão plana (todos os registros), usa a lógica original
                const origemLabel = !consolidado
                  ? getOrigemLabel(item.origem_aditivo_id)
                  : foiModificado && aditivoModificador
                    ? `✏ Atualizado: ${aditivoModificador.numero_aditivo}`
                    : foiAdicionado && aditivoModificador
                      ? `✦ Novo: ${aditivoModificador.numero_aditivo}`
                      : meta?.tipo_documento === 'ata_srp' ? 'ATA SRP' : 'Contrato Original';

                const badgeColor = !consolidado
                  ? 'bg-muted text-muted-foreground'
                  : foiModificado
                    ? 'bg-warning/10 text-warning border-warning/30'
                    : foiAdicionado
                      ? 'bg-success/10 text-success border-success/30'
                      : 'bg-muted text-muted-foreground';

                // Tooltip com histórico de versões (só na visão consolidada)
                const tooltipContent = consolidado && foiModificado && original ? (
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">Histórico de alterações:</p>
                    <p className="text-muted-foreground">
                      Original: {fmt(original.valor_unitario)}/un × {original.quantidade_contratada} {original.unidade}
                    </p>
                    {(item as ItemConsolidado)._versoes?.filter(v => v.origem_aditivo_id).map(v => {
                      const ad = aditivos.find(a => a.id === v.origem_aditivo_id);
                      return (
                        <p key={v.id}>
                          {ad?.numero_aditivo ?? 'Aditivo'}: {fmt(v.valor_unitario)}/un × {v.quantidade_contratada} {v.unidade}
                          {v.valor_unitario !== original.valor_unitario && (
                            <span className={v.valor_unitario > original.valor_unitario ? ' text-success' : ' text-destructive'}>
                              {' '}({v.valor_unitario > original.valor_unitario ? '+' : ''}{((v.valor_unitario - original.valor_unitario) / original.valor_unitario * 100).toFixed(1)}%)
                            </span>
                          )}
                        </p>
                      );
                    })}
                  </div>
                ) : null;

                return (
                  <TableRow key={item.id} className={lowStock ? 'bg-warning/5' : ''}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {tooltipContent ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className={`text-xs font-normal cursor-help ${badgeColor}`}>
                              {origemLabel}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            {tooltipContent}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Badge variant="outline" className={`text-xs font-normal ${badgeColor}`}>
                          {origemLabel}
                        </Badge>
                      )}
                    </TableCell>
                    {meta?.tipo_estrutura === 'lotes' && (
                      <TableCell className="text-xs whitespace-nowrap">
                        {item.numero_lote
                          ? <Badge variant="secondary" className="text-xs font-normal">Lote {item.numero_lote}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="text-xs max-w-[280px]">
                      <button
                        type="button"
                        onClick={() => setItemVisualizado(item)}
                        title="Ver a descrição completa do item"
                        className="truncate block w-full text-left font-medium text-foreground hover:text-accent hover:underline"
                      >
                        {item.descricao}
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        {item.codigo_item && <span className="font-mono">cód. {item.codigo_item}</span>}
                        {isContratoComATA && (
                          item.ata_item_id
                            ? <span>{item.codigo_item ? ' · ' : ''}⛓ {ataItemLabel(item.ata_item_id)}</span>
                            : <span className="text-warning">{item.codigo_item ? ' · ' : ''}sem vínculo à ata</span>
                        )}
                      </span>
                      {consolidado && foiModificado && original && original.valor_unitario !== item.valor_unitario && (
                        <span className="text-xs text-muted-foreground line-through">
                          {fmt(original.valor_unitario)}/un (original)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {Number(item.quantidade_contratada || 0).toLocaleString('pt-BR')}
                      <span className="text-muted-foreground"> {uni(item.unidade)}</span>
                      {/* Quantidade zerada é a fratura físico×financeiro: o
                          scan não rendeu o número e o total fica em R$ 0,00.
                          O aviso mora ao lado do defeito, não noutra aba. */}
                      {(item.quantidade_contratada || 0) === 0 && (
                        <div className="text-[11px] text-warning">sem quantidade — edite no lápis</div>
                      )}
                    </TableCell>
                    {podeVerCustos && (
                      <TableCell className="text-xs text-right whitespace-nowrap text-muted-foreground">
                        <div>{item.custo_unitario != null ? fmt(item.custo_unitario) : '—'}<span className="text-[10px]">/un</span></div>
                        {/* O "/un" rotula a primeira linha; sem rótulo na segunda,
                            item de quantidade zero mostrava R$ 0,00 sobre R$ 0,00
                            e parecia valor repetido, não unitário × total. */}
                        <div className="text-[11px]"><span className="text-[10px]">total </span>{item.custo_total != null ? fmt(item.custo_total) : '—'}</div>
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-right whitespace-nowrap font-medium">
                      {fmt(item.valor_unitario)}<span className="text-[10px] text-muted-foreground">/un</span>
                      {(() => {
                        // O contrato guarda o preço da CONTRATAÇÃO; a ATA evolui por
                        // reequilíbrio/reajuste. Divergência aqui não é erro — é
                        // história, e precisa aparecer: era X, a ata hoje registra Y.
                        if (!item.ata_item_id) return null;
                        const ataItem = ataItens.find(a => a.id === item.ata_item_id);
                        if (!ataItem || ataItem.valor_unitario == null) return null;
                        const dif = (ataItem.valor_unitario || 0) - (item.valor_unitario || 0);
                        if (Math.abs(dif) < 0.005) return null;
                        const pct = item.valor_unitario ? ((dif / item.valor_unitario) * 100).toFixed(2) : null;
                        return (
                          <div className="text-[11px] text-warning font-normal">
                            ATA hoje: {fmt(ataItem.valor_unitario)}{pct ? ` (${dif > 0 ? '+' : ''}${pct}%)` : ''}
                          </div>
                        );
                      })()}
                      <div className="text-[11px] text-muted-foreground"><span className="text-[10px]">total </span><span className="text-foreground">{fmt(item.valor_total)}</span></div>
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {Number(item.quantidade_consumida || 0).toLocaleString('pt-BR')}
                      <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                    </TableCell>
                    <TableCell className={`text-xs text-right font-medium whitespace-nowrap ${lowStock ? 'text-warning' : 'text-success'}`}>
                      <div>{Number(item.saldo_quantitativo || 0).toLocaleString('pt-BR')} {uni(item.unidade)}</div>
                      <div className="text-[11px]">{fmt(item.saldo_financeiro)}</div>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card border-l border-border">
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicar item (aditivo)" onClick={() => handleDuplicate(item)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar item" onClick={() => abrirEdicao(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      )}

      {/* Edição de item — preço travado quando aponta a ata */}
      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Editar item</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{editItem.descricao}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" value={editForm.quantidade}
                    onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Unitário (R$)</Label>
                  {isContratoComATA && !!editItem.ata_item_id && !temAditivoForaDoObjeto ? (
                    <>
                      {/* Campo travado não é campo: é informação. Exibir o
                          número cru do input ("15,8") num valor em reais nega
                          a pontuação que o resto da tela promete. */}
                      <Input value={fmt(editItem.valor_unitario || 0)} disabled />
                      <p className="text-xs text-muted-foreground mt-1">
                        Travado no registrado da ATA. Para alterá-lo, registre antes o
                        termo aditivo que o autoriza (reequilíbrio, revisão, reajuste)
                        em Arquivos e Aditivos.
                      </p>
                    </>
                  ) : (
                    <>
                      <Input type="number" step="0.01" value={editForm.valor_unitario}
                        onChange={e => setEditForm(f => ({ ...f, valor_unitario: e.target.value }))} />
                      {isContratoComATA && !!editItem.ata_item_id && temAditivoForaDoObjeto && (
                        <p className="text-xs text-warning mt-1">
                          Destravado: o contrato registra reequilíbrio/revisão/reajuste.
                          A mudança fica no histórico de preços; o registrado da ATA não muda.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              {podeVerCustos && (
                <div>
                  <Label>Custo Unitário (R$)</Label>
                  <Input type="number" step="0.01" value={editForm.custo_unitario}
                    onChange={e => setEditForm(f => ({ ...f, custo_unitario: e.target.value }))} />
                </div>
              )}
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={editForm.observacoes}
                  onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
                <Button onClick={salvarEdicao} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ficha do item — leitura integral do que a tabela trunca */}
      <Dialog open={!!itemVisualizado} onOpenChange={(v) => !v && setItemVisualizado(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Descrição do item</DialogTitle>
          </DialogHeader>
          {itemVisualizado && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{itemVisualizado.descricao}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground">Código</div>
                  <div className="font-medium">{itemVisualizado.codigo_item || '—'}</div>
                </div>
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground">Quantidade</div>
                  <div className="font-medium">{Number(itemVisualizado.quantidade_contratada || 0).toLocaleString('pt-BR')} {uni(itemVisualizado.unidade)}</div>
                </div>
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground">Valor unitário</div>
                  <div className="font-medium">{fmt(itemVisualizado.valor_unitario || 0)}</div>
                </div>
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground">Valor total</div>
                  <div className="font-medium">{fmt(itemVisualizado.valor_total || 0)}</div>
                </div>
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground">Consumido</div>
                  <div className="font-medium">{Number(itemVisualizado.quantidade_consumida || 0).toLocaleString('pt-BR')} {uni(itemVisualizado.unidade)}</div>
                </div>
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground">Saldo</div>
                  <div className="font-medium">{Number(itemVisualizado.saldo_quantitativo || 0).toLocaleString('pt-BR')} {uni(itemVisualizado.unidade)} · {fmt(itemVisualizado.saldo_financeiro || 0)}</div>
                </div>
              </div>

              {isContratoComATA && itemVisualizado.ata_item_id && (
                <p className="text-xs text-muted-foreground">
                  ⛓ Fraciona o item da ATA: {ataItemLabel(itemVisualizado.ata_item_id)}
                </p>
              )}
              {(itemVisualizado as { observacoes?: string | null }).observacoes && (
                <div className="border rounded-md p-3 bg-muted/30 text-xs">
                  <div className="text-muted-foreground mb-1">Observações</div>
                  <p className="whitespace-pre-wrap">{(itemVisualizado as { observacoes?: string | null }).observacoes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
