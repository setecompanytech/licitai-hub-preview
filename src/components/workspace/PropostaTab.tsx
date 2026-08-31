import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, FileText, ExternalLink, Download, Gavel } from 'lucide-react';
import { toast } from 'sonner';
import PlanilhaPrecos from '@/components/proposta/PlanilhaPrecos';
import ImportarDoCatalogo from '@/components/proposta/ImportarDoCatalogo';
import type { EditalItem } from '@/components/proposta/EditalUploader';
import type { DisputeItem } from '@/components/robo-lances/ConfigurarLanceDialog';
import { useRascunho } from '@/hooks/useRascunho';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { readequarComADisputa, type ResumoReadequacao } from '@/lib/proposta/readequar';

/**
 * Fase 2 do prontuário integrado — a PROPOSTA trabalhada dentro do processo.
 *
 * A planilha de preços da proposta (o coração do wizard) opera aqui, sobre o
 * MESMO rascunho por licitação que o wizard usa — editar num lugar reflete no
 * outro. Importa itens do edital (licitacao_itens) e do catálogo precificado.
 * O wizard completo continua sendo o lugar do PDF final; o link está no rodapé.
 */

type DadosRascunho = Record<string, unknown> & { itens?: EditalItem[] };

type DisputaDoProcesso = {
  id: string;
  edital: string;
  criadaEm: string;
  itens: DisputeItem[];
};

const num = (v: number) => v.toFixed(2).replace('.', ',');

export default function PropostaTab({ licitacaoId, numeroLicitacao }: { licitacaoId: string; numeroLicitacao?: string | null }) {
  const { user } = useAuth();
  const [itens, setItens] = useState<EditalItem[]>([]);
  const [pronto, setPronto] = useState(false);
  const [importando, setImportando] = useState(false);
  // A disputa deste processo, quando existe: é dela que sai o preço negociado.
  const [disputa, setDisputa] = useState<DisputaDoProcesso | null>(null);
  const [outrasDisputas, setOutrasDisputas] = useState(0);
  // A proposta inicial já foi gerada e arquivada na pasta? Decide se readequar
  // perde os valores originais ou apenas atualiza o rascunho.
  const [propostaNaPasta, setPropostaNaPasta] = useState(false);
  // Nada muda antes de a pessoa ver o que mudaria.
  const [previa, setPrevia] = useState<ResumoReadequacao | null>(null);
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

  // Disputa do processo + se a proposta inicial já está arquivada na pasta.
  // As duas respondem a mesma pergunta: readequar aqui perde alguma coisa?
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [disputas, anexos] = await Promise.all([
        supabase
          .from('robo_lances_disputas' as never)
          .select('id, edital, created_at, itens')
          .eq('licitacao_id', licitacaoId)
          .order('created_at', { ascending: false }),
        supabase
          .from('processo_anexos')
          .select('id')
          .eq('licitacao_id', licitacaoId)
          .eq('categoria', 'proposta')
          .limit(1),
      ]);
      if (cancelado) return;

      const linhas = (disputas.data || []) as unknown as Array<Record<string, unknown>>;
      const primeira = linhas[0];
      setDisputa(
        primeira
          ? {
              id: String(primeira.id),
              edital: String(primeira.edital || ''),
              criadaEm: String(primeira.created_at || ''),
              itens: Array.isArray(primeira.itens) ? (primeira.itens as DisputeItem[]) : [],
            }
          : null,
      );
      // Mais de uma disputa no mesmo processo é possível. Usamos a mais recente
      // e dizemos quantas ficaram de fora, em vez de escolher em silêncio.
      setOutrasDisputas(Math.max(0, linhas.length - 1));
      setPropostaNaPasta((anexos.data?.length ?? 0) > 0);
    })();
    return () => { cancelado = true; };
  }, [licitacaoId]);

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

  // Readequar NÃO é importar: os itens já estão aqui, o que muda é o preço.
  // A prévia existe para que a troca seja vista antes de acontecer — a planilha
  // só muda depois do "Aplicar".
  const prepararReadequacao = () => {
    if (!disputa) return;
    if (!disputa.itens.length) {
      toast.info('A disputa deste processo não tem itens configurados.');
      return;
    }
    if (!itens.some((i) => i.descricao?.trim())) {
      toast.info('A proposta ainda não tem itens — importe do edital ou do catálogo antes de readequar.');
      return;
    }
    setPrevia(readequarComADisputa(itens, disputa.itens));
  };

  const aplicarReadequacao = () => {
    if (!previa) return;
    atualizarItens(previa.itens);
    toast.success(
      previa.readequados.length
        ? `${previa.readequados.length} item(ns) readequado(s) com o preço final da disputa.`
        : 'Nenhum item tinha lance nosso — a planilha continua como estava.',
    );
    setPrevia(null);
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
            {disputa && (
              <Button size="sm" variant="outline" onClick={prepararReadequacao}>
                <Gavel className="w-3.5 h-3.5 mr-1.5" />
                Readequar com os preços da disputa
              </Button>
            )}
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

      <AlertDialog open={!!previa} onOpenChange={(aberto) => !aberto && setPrevia(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Readequar com os preços da disputa</AlertDialogTitle>
            <AlertDialogDescription>
              O preço unitário de cada item passa a ser o último lance que nós demos
              naquele item{disputa?.edital ? ` no edital ${disputa.edital}` : ''}. Nada muda até você aplicar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {previa && (
            <div className="space-y-1.5 text-sm">
              <p>
                <span className="font-semibold">{previa.readequados.length}</span>{' '}
                {previa.readequados.length === 1 ? 'item terá' : 'itens terão'} o preço trocado.
              </p>
              {previa.semLance.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-semibold">{previa.semLance.length}</span>{' '}
                  {previa.semLance.length === 1 ? 'item fica' : 'itens ficam'} como {previa.semLance.length === 1 ? 'está' : 'estão'} — não
                  houve lance nosso {previa.semLance.length === 1 ? 'nele' : 'neles'} (item {previa.semLance.join(', ')}).
                </p>
              )}
              {previa.semPar.length > 0 && (
                <p className="text-muted-foreground">
                  {previa.semPar.length === 1 ? 'O item' : 'Os itens'} {previa.semPar.join(', ')} {previa.semPar.length === 1 ? 'está' : 'estão'} na
                  disputa e não {previa.semPar.length === 1 ? 'tem par' : 'têm par'} na proposta — {previa.semPar.length === 1 ? 'não entra' : 'não entram'} sozinho{previa.semPar.length === 1 ? '' : 's'}.
                </p>
              )}
              {outrasDisputas > 0 && (
                <p className="text-muted-foreground">
                  Este processo tem {outrasDisputas + 1} disputas. Usando a mais recente.
                </p>
              )}
              {!propostaNaPasta && (
                <p className="text-warning">
                  A proposta inicial ainda não foi gerada em PDF, então os valores originais
                  existem só neste rascunho e serão substituídos. Se precisar deles depois,
                  gere o PDF pelo wizard antes de aplicar.
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aplicarReadequacao}>Aplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
