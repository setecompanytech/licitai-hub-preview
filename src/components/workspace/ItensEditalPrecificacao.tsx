import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Calculator, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Fase 2 do prontuário integrado — precificação IN-CONTEXT.
 *
 * Os itens extraídos do edital (licitacao_itens, gravados pela preparação
 * automática ou pelo wizard) ganham uma coluna de preço editável AQUI, sem
 * expulsar o usuário para o módulo global. Salvar grava no catálogo
 * (catalogo_itens_precificados) — exatamente de onde a aba Proposta importa.
 */

type ItemEdital = {
  id: string;
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const parsePreco = (s: string) =>
  parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0;

export default function ItensEditalPrecificacao({
  licitacaoId,
  onSaved,
  onIrParaProposta,
}: {
  licitacaoId: string;
  onSaved?: () => void;
  onIrParaProposta?: () => void;
}) {
  const { user } = useAuth();
  const [itens, setItens] = useState<ItemEdital[]>([]);
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: lis }, { data: cat }] = await Promise.all([
      supabase
        .from('licitacao_itens')
        .select('id, numero, descricao, quantidade, unidade, valor_unitario, marca, fabricante, modelo')
        .eq('licitacao_id', licitacaoId)
        .order('numero'),
      supabase
        .from('catalogo_itens_precificados')
        .select('descricao, preco_unitario')
        .eq('licitacao_id', licitacaoId),
    ]);
    const lista = (lis || []) as ItemEdital[];
    setItens(lista);
    // Preço inicial: o já precificado no catálogo; senão, o estimado do edital
    const doCatalogo = new Map((cat || []).map((c) => [c.descricao, c.preco_unitario]));
    setPrecos(
      Object.fromEntries(
        lista.map((it) => {
          const p = doCatalogo.get(it.descricao) ?? (it.valor_unitario > 0 ? it.valor_unitario : null);
          return [it.id, p != null ? p.toFixed(2).replace('.', ',') : ''];
        }),
      ),
    );
    setLoading(false);
  }, [user, licitacaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalProposto = itens.reduce(
    (s, it) => s + parsePreco(precos[it.id] || '') * (it.quantidade || 0), 0,
  );

  const salvar = async () => {
    if (!user) return;
    const comPreco = itens.filter((it) => parsePreco(precos[it.id] || '') > 0);
    if (!comPreco.length) { toast.info('Informe ao menos um preço para salvar.'); return; }
    setSalvando(true);
    try {
      // Um registro por item do edital; recriar é mais simples e auditável do
      // que reconciliar por descrição (edital pode repetir descrições).
      await supabase
        .from('catalogo_itens_precificados')
        .delete()
        .eq('licitacao_id', licitacaoId)
        .eq('user_id', user.id)
        .eq('tipo_calculo', 'edital');

      const rows = comPreco.map((it) => {
        const unit = parsePreco(precos[it.id]);
        return {
          user_id: user.id,
          licitacao_id: licitacaoId,
          descricao: it.descricao,
          quantidade: it.quantidade || 1,
          unidade: it.unidade || 'UN',
          custo_unitario: 0,
          preco_unitario: unit,
          preco_total: unit * (it.quantidade || 1),
          marca: it.marca,
          fabricante: it.fabricante,
          modelo: it.modelo,
          tipo_calculo: 'edital',
        };
      });
      const { error } = await supabase.from('catalogo_itens_precificados').insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} item(ns) precificado(s) — prontos para importar na Proposta.`);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar precificação.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando itens do edital…
      </Card>
    );
  }

  if (!itens.length) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Itens do edital:</span>{' '}
        nenhum item extraído ainda. Use a <em>Preparação automática</em> na Visão Geral
        (ou o wizard da Proposta) para extrair o termo de referência.
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Calculator className="w-4 h-4 text-accent" />
        <span className="font-semibold text-sm">Itens do edital — precificação rápida</span>
        <span className="text-xs text-muted-foreground">
          {itens.length} item(ns) · edite o preço unitário e salve no catálogo
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-border/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2 font-semibold w-10">Nº</th>
              <th className="text-left px-3 py-2 font-semibold">Descrição</th>
              <th className="text-right px-3 py-2 font-semibold w-20">Qtd.</th>
              <th className="text-right px-3 py-2 font-semibold w-28">Ref. edital</th>
              <th className="text-right px-3 py-2 font-semibold w-32">Preço unit. (R$)</th>
              <th className="text-right px-3 py-2 font-semibold w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => {
              const unit = parsePreco(precos[it.id] || '');
              return (
                <tr key={it.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{it.numero}</td>
                  <td className="px-3 py-1.5">
                    {it.descricao}
                    <span className="ml-1.5 text-muted-foreground border border-border/60 px-1 rounded">{it.unidade}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{it.quantidade?.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                    {it.valor_unitario > 0 ? brl(it.valor_unitario) : '—'}
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={precos[it.id] ?? ''}
                      onChange={(e) => setPrecos((p) => ({ ...p, [it.id]: e.target.value }))}
                      placeholder="0,00"
                      className="h-7 text-right text-xs tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {unit > 0 ? brl(unit * (it.quantidade || 1)) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Salvar precificação
        </Button>
        {onIrParaProposta && (
          <Button size="sm" variant="outline" onClick={onIrParaProposta}>
            Levar para a Proposta <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        )}
        <span className="ml-auto text-sm">
          <span className="text-muted-foreground">Total proposto:</span>{' '}
          <span className="font-semibold tabular-nums">{brl(totalProposto)}</span>
        </span>
      </div>
    </Card>
  );
}
