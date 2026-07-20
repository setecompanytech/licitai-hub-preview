import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle, Pencil, Check, X, CheckCircle2, CircleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { LicitacaoItem } from '@/hooks/useEditalExtraction';

interface EditalItensTableProps {
  itens: LicitacaoItem[];
  onUpdate?: (itemId: string, updates: Partial<LicitacaoItem>) => void;
  onDelete?: (itemId: string) => void;
  onDeleteLote?: (lote: string) => void;
  readOnly?: boolean;
  showOrigin?: boolean;
  compact?: boolean;
}

const origemBadge: Record<string, { label: string; className: string }> = {
  ia: { label: 'IA', className: 'bg-primary/10 text-primary border-primary/20' },
  manual: { label: 'Manual', className: 'bg-muted text-muted-foreground border-border' },
  importado: { label: 'Importado', className: 'bg-accent/10 text-accent border-accent/20' },
};

function avaliarItem(item: LicitacaoItem): { nivel: 'completo' | 'parcial' | 'incompleto'; motivo: string } {
  const semDescricao = !item.descricao || item.descricao.trim().length < 3;
  const semQtd = !item.quantidade || item.quantidade <= 0;
  if (semDescricao || semQtd) return { nivel: 'incompleto', motivo: semDescricao ? 'Sem descrição' : 'Quantidade inválida' };
  const semUnidade = !item.unidade || item.unidade.trim().length === 0;
  const semPreco = !item.valor_unitario || item.valor_unitario <= 0;
  if (semUnidade || semPreco) return { nivel: 'parcial', motivo: semUnidade ? 'Sem unidade' : 'Sem valor unitário' };
  return { nivel: 'completo', motivo: 'Item completo' };
}

export default function EditalItensTable({
  itens,
  onUpdate,
  onDelete,
  onDeleteLote,
  readOnly = false,
  showOrigin = true,
  compact = false,
}: EditalItensTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<LicitacaoItem>>({});

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lotes = [...new Set(itens.map(i => i.lote))].filter(Boolean);
  const totalGeral = itens.reduce((s, i) => s + (i.valor_unitario * i.quantidade), 0);

  const startEdit = (item: LicitacaoItem) => {
    setEditingId(item.id);
    setEditValues({
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      valor_unitario: item.valor_unitario,
      marca: item.marca,
    });
  };

  const saveEdit = () => {
    if (editingId && onUpdate) {
      const qty = editValues.quantidade ?? 0;
      const vu = editValues.valor_unitario ?? 0;
      onUpdate(editingId, {
        ...editValues,
        valor_total: qty * vu,
      });
    }
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const renderLoteGroup = (lote: string) => {
    const loteItens = itens.filter(i => i.lote === lote);
    const loteTotal = loteItens.reduce((s, i) => s + (i.valor_unitario * i.quantidade), 0);

    return (
      <div key={lote} className="space-y-1">
        {lotes.length > 1 && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-xs font-semibold text-foreground">{lote}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {loteItens.length} {loteItens.length === 1 ? 'item' : 'itens'} — {formatCurrency(loteTotal)}
              </span>
              {!readOnly && onDeleteLote && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive/60 hover:text-destructive"
                  onClick={() => {
                    onDeleteLote(lote);
                    toast.info(`Lote "${lote}" removido.`);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        )}
        {loteItens.map(renderRow)}
      </div>
    );
  };

  const renderRow = (item: LicitacaoItem) => {
    const isEditing = editingId === item.id;
    const valorRef = item.valor_unitario * item.quantidade;
    const descontoRef = totalGeral > 0 ? ((totalGeral - valorRef) / totalGeral) * 100 : 0;
    const _ = descontoRef; // unused for now

    return (
      <TableRow key={item.id} className={compact ? 'text-xs' : ''}>
        <TableCell className="w-10 text-center font-mono text-muted-foreground">
          {item.numero}
        </TableCell>
        <TableCell className="max-w-[200px]">
          {isEditing ? (
            <Input
              value={editValues.descricao || ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, descricao: e.target.value }))}
              className="h-7 text-xs"
            />
          ) : (
            <span className="text-xs line-clamp-2">{item.descricao}</span>
          )}
        </TableCell>
        <TableCell className="w-16 text-center">
          {isEditing ? (
            <Input
              type="number"
              value={editValues.quantidade ?? ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, quantidade: parseFloat(e.target.value) || 0 }))}
              className="h-7 text-xs w-16"
            />
          ) : (
            <span className="text-xs">{item.quantidade}</span>
          )}
        </TableCell>
        <TableCell className="w-14 text-center">
          {isEditing ? (
            <Input
              value={editValues.unidade || ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, unidade: e.target.value }))}
              className="h-7 text-xs w-14"
            />
          ) : (
            <span className="text-xs">{item.unidade}</span>
          )}
        </TableCell>
        <TableCell className="w-28 text-right">
          {isEditing ? (
            <MoneyInput
              value={Number(editValues.valor_unitario) || 0}
              onValueChange={(v) => setEditValues(prev => ({ ...prev, valor_unitario: v }))}
              className="h-7 text-xs w-28"
            />
          ) : (
            <span className="text-xs font-mono">{formatCurrency(item.valor_unitario)}</span>
          )}
        </TableCell>
        <TableCell className="w-28 text-right">
          <span className="text-xs font-mono">
            {formatCurrency((isEditing ? (editValues.valor_unitario ?? 0) * (editValues.quantidade ?? 0) : item.valor_unitario * item.quantidade))}
          </span>
        </TableCell>
        <TableCell className="w-16 text-center">
          {(() => {
            const { nivel, motivo } = avaliarItem(isEditing ? { ...item, ...editValues } as LicitacaoItem : item);
            if (nivel === 'completo') return (
              <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" title={motivo} />
            );
            if (nivel === 'parcial') return (
              <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" title={motivo} />
            );
            return <CircleAlert className="w-4 h-4 text-destructive mx-auto" title={motivo} />;
          })()}
        </TableCell>
        {showOrigin && (
          <TableCell className="w-20">
            <Badge variant="outline" className={`text-[9px] ${origemBadge[item.origem]?.className || ''}`}>
              {origemBadge[item.origem]?.label || item.origem}
            </Badge>
          </TableCell>
        )}
        {!readOnly && (
          <TableCell className="w-20">
            <div className="flex gap-1">
              {isEditing ? (
                <>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-accent" onClick={saveEdit}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
                    <X className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <>
                  {onUpdate && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(item)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive/60 hover:text-destructive"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  if (itens.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum item cadastrado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Inexequibilidade alert */}
      {totalGeral > 0 && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-muted-foreground">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'} • {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}
          </span>
          <span className="font-semibold">Total: {formatCurrency(totalGeral)}</span>
        </div>
      )}

      <div className="border border-border/50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10 text-center text-[10px]">#</TableHead>
              <TableHead className="text-[10px]">Descrição</TableHead>
              <TableHead className="w-16 text-center text-[10px]">Qtd</TableHead>
              <TableHead className="w-14 text-center text-[10px]">Und</TableHead>
              <TableHead className="w-28 text-right text-[10px]">Vlr Unit.</TableHead>
              <TableHead className="w-28 text-right text-[10px]">Vlr Total</TableHead>
              <TableHead className="w-16 text-center text-[10px]">Status</TableHead>
              {showOrigin && <TableHead className="w-20 text-[10px]">Origem</TableHead>}
              {!readOnly && <TableHead className="w-20 text-[10px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.length > 1
              ? lotes.map(lote => {
                  const loteItens = itens.filter(i => i.lote === lote);
                  return loteItens.map(renderRow);
                })
              : itens.map(renderRow)
            }
          </TableBody>
        </Table>
      </div>

      {lotes.length > 1 && (
        <div className="space-y-1">
          {lotes.map(lote => {
            const loteItens = itens.filter(i => i.lote === lote);
            const loteTotal = loteItens.reduce((s, i) => s + (i.valor_unitario * i.quantidade), 0);
            return (
              <div key={lote} className="flex items-center justify-between px-2 py-1 bg-muted/30 rounded text-xs">
                <span className="font-medium">{lote}</span>
                <div className="flex items-center gap-2">
                  <span>{formatCurrency(loteTotal)}</span>
                  {!readOnly && onDeleteLote && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-destructive/60 hover:text-destructive"
                      onClick={() => { onDeleteLote(lote); toast.info(`Lote "${lote}" removido.`); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
