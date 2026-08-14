import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ExternalLink, Download } from 'lucide-react';
import { toast } from 'sonner';
import PlanilhaPrecos from '@/components/proposta/PlanilhaPrecos';
import ImportarDoCatalogo from '@/components/proposta/ImportarDoCatalogo';
import type { EditalItem } from '@/components/proposta/EditalUploader';
import { useRascunho } from '@/hooks/useRascunho';
import { valorPorExtenso } from '@/lib/numero-extenso';

/**
 * Fase 2 do prontuário integrado — a PROPOSTA trabalhada dentro do processo.
 *
 * A planilha de preços da proposta (o coração do wizard) opera aqui, sobre o
 * MESMO rascunho por licitação que o wizard usa — editar num lugar reflete no
 * outro. Importa itens do edital (licitacao_itens) e do catálogo precificado.
 * O wizard completo continua sendo o lugar do PDF final; o link está no rodapé.
 */

type DadosRascunho = Record<string, unknown> & { itens?: EditalItem[] };

const num = (v: number) => v.toFixed(2).replace('.', ',');

export default function PropostaTab({ licitacaoId, numeroLicitacao }: { licitacaoId: string; numeroLicitacao?: string | null }) {
  const { user } = useAuth();
  const [itens, setItens] = useState<EditalItem[]>([]);
  const [pronto, setPronto] = useState(false);
  const [importando, setImportando] = useState(false);
  // O rascunho do wizard carrega MAIS que itens (dados da empresa, config do
  // documento…) — preservamos tudo e só sobrescrevemos a lista de itens.
  const dadosRef = useRef<DadosRascunho>({});

  const { loadRascunho, autoSave, markLoaded, saving, lastSaved } = useRascunho<DadosRascunho>({
    modulo: 'proposta',
    licitacaoId,
  });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const dados = await loadRascunho();
      if (cancelado) return;
      dadosRef.current = dados || {};
      if (Array.isArray(dados?.itens) && dados.itens.length) setItens(dados.itens);
      markLoaded();
      setPronto(true);
    })();
    return () => { cancelado = true; };
  }, [loadRascunho, markLoaded]);

  const atualizarItens = useCallback((novos: EditalItem[]) => {
    setItens(novos);
    dadosRef.current = { ...dadosRef.current, itens: novos };
    autoSave(dadosRef.current);
  }, [autoSave]);

  const importarDoEdital = async () => {
    if (!user) return;
    setImportando(true);
    const { data } = await supabase
      .from('licitacao_itens')
      .select('numero, descricao, quantidade, unidade, valor_unitario, valor_total, marca, fabricante, modelo')
      .eq('licitacao_id', licitacaoId)
      .order('numero');
    setImportando(false);
    if (!data?.length) { toast.info('Nenhum item extraído do edital ainda — rode a Preparação automática.'); return; }
    const base = itens.length === 1 && !itens[0]?.descricao?.trim() ? [] : itens;
    const novos: EditalItem[] = data.map((it, idx) => ({
      item: String(it.numero ?? base.length + idx + 1),
      descricao: it.descricao || '',
      quantidade: String(it.quantidade ?? 1),
      unidade: it.unidade || 'UN',
      marca: it.marca || '',
      fabricante: it.fabricante || '',
      modelo: it.modelo || '',
      valorUnitario: it.valor_unitario > 0 ? num(it.valor_unitario) : '',
      valorUnitarioExtenso: it.valor_unitario > 0 ? valorPorExtenso(it.valor_unitario) : '',
      valorTotal: it.valor_total > 0 ? num(it.valor_total) : '',
      valorTotalExtenso: it.valor_total > 0 ? valorPorExtenso(it.valor_total) : '',
    }));
    atualizarItens([...base, ...novos]);
    toast.success(`${novos.length} item(ns) do edital importado(s) para a proposta.`);
  };

  if (!pronto) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando a proposta deste processo…
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <FileText className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Proposta comercial deste processo</span>
          <span className="text-xs text-muted-foreground">
            {saving ? 'Salvando…' : lastSaved ? `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Rascunho novo'}
            {' · '}mesmo rascunho do wizard — editar aqui reflete lá
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={importarDoEdital} disabled={importando}>
              {importando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Importar itens do edital
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to={`/proposta-tecnica?lid=${licitacaoId}`}>
                Wizard completo / PDF <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      <ImportarDoCatalogo
        licitacaoId={licitacaoId}
        licitacaoNumero={numeroLicitacao ?? undefined}
        onImport={(catalogItems) => {
          const hasEmpty = itens.length === 1 && !itens[0]?.descricao?.trim();
          const base = hasEmpty ? [] : itens;
          const novos: EditalItem[] = catalogItems.map((ci, idx) => ({
            item: String(base.length + idx + 1),
            descricao: ci.descricao,
            quantidade: String(ci.quantidade),
            unidade: ci.unidade,
            marca: ci.marca || '',
            fabricante: ci.fabricante || '',
            modelo: ci.modelo || '',
            valorUnitario: num(ci.preco_unitario),
            valorUnitarioExtenso: valorPorExtenso(ci.preco_unitario),
            valorTotal: num(ci.preco_total),
            valorTotalExtenso: valorPorExtenso(ci.preco_total),
          }));
          atualizarItens([...base, ...novos]);
          toast.success(`${catalogItems.length} item(ns) importado(s) do catálogo!`);
        }}
      />

      <PlanilhaPrecos itens={itens} setItens={atualizarItens} />
    </div>
  );
}
