import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Undo2 } from 'lucide-react';
import {
  impactoDaLinha, linhaDaLeitura, linhaFoiEditada, linhaMudaAlgo, linhaSemMudanca, numeroDoItem, ordenarItensPorNumero,
  resumoDoTermo, type ItemDoContrato, type LinhaDoTermo, type LinhaLida, type Modo,
} from '@/lib/contratos/itens-do-termo';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtQtd = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v);

type Props = {
  itens: ItemDoContrato[];
  modo: Modo;
  linhas: Record<string, LinhaDoTermo>;
  onChange: (linhas: Record<string, LinhaDoTermo>) => void;
  /** Linhas que a leitura trouxe e não casou com item nenhum. */
  semItem: LinhaLida[];
  onSemItemChange: (linhas: LinhaLida[]) => void;
  disabled?: boolean;
};

/**
 * A tabela de itens de um termo aditivo: preço novo e quantidade por item,
 * com o impacto calculado na hora.
 *
 * Toda célula é editável — a leitura do anexo PREENCHE, não decide. O que
 * veio da leitura fica marcado; o que a pessoa corrigiu fica marcado como
 * editado, e o valor lido continua guardado para conferência. Linha que a
 * leitura não conseguiu casar com um item aparece embaixo, com um seletor
 * para a pessoa apontar o item certo.
 */
export default function ItensDoTermo({ itens, modo, linhas, onChange, semItem, onSemItemChange, disabled }: Props) {
  const mudaPreco = modo !== 'quantidade';
  const mudaQuantidade = modo !== 'preco';

  const linhaDe = (item: ItemDoContrato): LinhaDoTermo => linhas[item.id] ?? linhaSemMudanca(item);

  const atualizar = (item: ItemDoContrato, parte: Partial<LinhaDoTermo>) => {
    onChange({ ...linhas, [item.id]: { ...linhaDe(item), ...parte } });
  };

  const restaurarLido = (item: ItemDoContrato) => {
    const l = linhaDe(item);
    atualizar(item, {
      valor_novo: l.valor_lido ?? (Number(item.valor_unitario) || 0),
      quantidade_acrescimo: l.quantidade_lida ?? 0,
    });
  };

  const atribuir = (lida: LinhaLida, itemId: string) => {
    const item = itens.find((i) => i.id === itemId);
    if (!item) return;
    onChange({ ...linhas, [item.id]: linhaDaLeitura(item, lida, modo) });
    onSemItemChange(semItem.filter((l) => l !== lida));
  };

  const resumo = useMemo(() => resumoDoTermo(linhas, itens), [linhas, itens]);
  // Na ordem do contrato — lote e número do item —, não na ordem em que a
  // importação gravou (saía 6, 7, 18, 8, 16…).
  const ordenados = useMemo(() => ordenarItensPorNumero(itens), [itens]);

  if (itens.length === 0) {
    return (
      <p className="g-meta text-muted-foreground">
        Este contrato não tem itens cadastrados. Cadastre-os em Itens/Lotes para registrar o que o termo muda em cada um.
      </p>
    );
  }

  return (
    <div className="space-y-3 sm:col-span-2" data-testid="itens-do-termo">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Itens alterados pelo termo</p>
        <p className="g-meta text-muted-foreground">
          {mudaPreco && 'O preço novo já vem preenchido com o vigente: mude só o que o termo muda. '}
          {mudaPreco && 'O impacto do preço é sobre o saldo a fornecer. '}
          {mudaQuantidade && 'Quantidade acrescida entra no saldo ao preço da linha.'}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Nº</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              {mudaPreco && <TableHead className="text-right">Vigente</TableHead>}
              {mudaPreco && <TableHead className="w-36">Preço novo</TableHead>}
              {mudaPreco && <TableHead className="text-right">Variação</TableHead>}
              {mudaQuantidade && <TableHead className="w-28">Acréscimo</TableHead>}
              {mudaQuantidade && <TableHead className="w-28">Supressão</TableHead>}
              <TableHead className="text-right">Impacto</TableHead>
              <TableHead className="w-28">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenados.map((item) => {
              const linha = linhaDe(item);
              const imp = impactoDaLinha(linha, item);
              const muda = linhaMudaAlgo(linha, item);
              const editada = linhaFoiEditada(linha);
              const numero = numeroDoItem(item);
              return (
                <TableRow key={item.id} className={muda ? 'bg-warning-tint/40' : undefined} data-testid={`linha-${item.id}`}>
                  <TableCell className="tabular-nums text-muted-foreground">{numero ?? '—'}</TableCell>
                  <TableCell className="max-w-[260px]">
                    <span className="block truncate font-medium text-foreground" title={item.descricao}>{item.descricao}</span>
                    <span className="g-meta text-muted-foreground">
                      {item.numero_lote ? `Lote ${item.numero_lote} · ` : ''}{item.unidade}
                      {linha.numero_item_lido && linha.descricao_lida && (
                        <span title={linha.descricao_lida}> · lido como item {linha.numero_item_lido}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{fmtQtd(Number(item.saldo_quantitativo) || 0)}</TableCell>
                  {mudaPreco && (
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{fmt(imp.vigente)}</TableCell>
                  )}
                  {mudaPreco && (
                    <TableCell>
                      <MoneyInput
                        value={linha.valor_novo}
                        onValueChange={(v) => atualizar(item, { valor_novo: Number(v) || 0 })}
                        disabled={disabled}
                        aria-label={`Preço novo de ${item.descricao}`}
                      />
                    </TableCell>
                  )}
                  {mudaPreco && (
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {imp.variacaoPct === null
                        ? <span className="text-muted-foreground">—</span>
                        : <span className={imp.variacaoPct >= 0 ? 'text-success-ink' : 'text-destructive-ink'}>
                            {imp.variacaoPct >= 0 ? '+' : ''}{imp.variacaoPct.toFixed(2).replace('.', ',')}%
                          </span>}
                    </TableCell>
                  )}
                  {mudaQuantidade && (
                    <TableCell>
                      <Input
                        type="number" min={0} step="any" inputMode="decimal"
                        value={linha.quantidade_acrescimo === 0 ? '' : linha.quantidade_acrescimo}
                        onChange={(e) => atualizar(item, { quantidade_acrescimo: Math.max(Number(e.target.value) || 0, 0) })}
                        placeholder="0" disabled={disabled}
                        aria-label={`Quantidade acrescida de ${item.descricao}`}
                      />
                    </TableCell>
                  )}
                  {mudaQuantidade && (
                    <TableCell>
                      <Input
                        type="number" min={0} step="any" inputMode="decimal"
                        value={linha.quantidade_supressao === 0 ? '' : linha.quantidade_supressao}
                        onChange={(e) => atualizar(item, { quantidade_supressao: Math.max(Number(e.target.value) || 0, 0) })}
                        placeholder="0" disabled={disabled}
                        aria-label={`Quantidade suprimida de ${item.descricao}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className={`text-right tabular-nums whitespace-nowrap font-medium ${imp.total > 0 ? 'text-success-ink' : imp.total < 0 ? 'text-destructive-ink' : 'text-muted-foreground'}`}>
                    {muda ? fmt(imp.total) : '—'}
                  </TableCell>
                  <TableCell>
                    {linha.origem === 'leitura' ? (
                      <span className="flex items-center gap-1">
                        <Badge variant={editada ? 'warning' : 'info'}>{editada ? 'editado' : 'lido do anexo'}</Badge>
                        {editada && !disabled && (
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => restaurarLido(item)}
                            title={`Restaurar o lido: ${linha.valor_lido !== null ? fmt(linha.valor_lido) : ''}${linha.quantidade_lida !== null ? ` · ${fmtQtd(linha.quantidade_lida)}` : ''}`}
                            aria-label="Restaurar o valor lido do anexo">
                            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </span>
                    ) : muda ? (
                      <Badge variant="muted">digitado</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {semItem.length > 0 && (
        <div className="space-y-2 rounded-lg border border-warning-line bg-warning-tint p-3">
          <p className="text-sm font-medium text-warning-ink">
            {semItem.length === 1 ? 'Uma linha do anexo não casou com item nenhum.' : `${semItem.length} linhas do anexo não casaram com item nenhum.`} Aponte o item ou ignore.
          </p>
          <ul className="space-y-2">
            {semItem.map((l, i) => (
              <li key={`${l.numero_item ?? 'x'}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate" title={l.descricao ?? ''}>
                  <span className="font-mono text-muted-foreground">item {l.numero_item ?? '?'}</span> {l.descricao ?? 'sem descrição'}
                  {l.valor_novo !== null && <span className="text-muted-foreground"> · {fmt(l.valor_novo)}</span>}
                  {l.quantidade !== null && <span className="text-muted-foreground"> · {fmtQtd(l.quantidade)}</span>}
                </span>
                <Select onValueChange={(v) => atribuir(l, v)} disabled={disabled}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Escolher o item" /></SelectTrigger>
                  <SelectContent>
                    {ordenados.map((it) => (
                      <SelectItem key={it.id} value={it.id}>{numeroDoItem(it) ?? '—'} · {it.descricao.slice(0, 50)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => onSemItemChange(semItem.filter((x) => x !== l))} disabled={disabled}>
                  Ignorar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs" data-testid="resumo-do-termo">
        <span><span className="text-muted-foreground">Itens alterados:</span> <strong>{resumo.itensAlterados}</strong></span>
        <span><span className="text-muted-foreground">Acréscimo:</span> <strong className="text-success-ink">{fmt(resumo.valorAcrescimo)}</strong></span>
        {resumo.valorSupressao > 0 && <span><span className="text-muted-foreground">Supressão:</span> <strong className="text-destructive-ink">{fmt(resumo.valorSupressao)}</strong></span>}
        {mudaQuantidade && <span><span className="text-muted-foreground">Quantidade:</span> <strong>+{fmtQtd(resumo.quantidadeAcrescimo)}{resumo.quantidadeSupressao > 0 ? ` / −${fmtQtd(resumo.quantidadeSupressao)}` : ''}</strong></span>}
      </div>
    </div>
  );
}
