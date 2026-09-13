import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { estimarImpostoDoContrato, type EstimativaImposto } from '@/lib/financeiro/imposto-do-contrato';
import { AlertCircle, ExternalLink, Link2, Loader2 } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

const TIPO_CUSTO_LABEL: Record<string, string> = {
  custo_direto: 'Custo direto',
  tributo: 'Tributo',
  frete_logistica: 'Frete / logística',
  despesa_administrativa: 'Despesa administrativa',
};

type LinhaCusto = {
  contrato_id: string;
  numero_contrato: string | null;
  orgao_contratante: string | null;
  faturamento: number;
  custo_pago: number;
  custo_comprometido: number;
  custo_digitado: number;
};

type GrupoValor = { nome: string; pago: number; aberto: number };

/**
 * A ficha do contrato em formato de DRE gerencial: de onde vem cada número do
 * painel, com a origem nomeada linha a linha. Tudo aqui é LEITURA derivada
 * das mesmas tabelas que alimentam o resto do sistema — corrigir é agir na
 * fonte (vincular a despesa, editar o lançamento, digitar o custo), e o
 * painel recalcula sozinho.
 */
export default function FinCustoContratoDetalhe({
  linha,
  rateio,
  aoFechar,
  aoVincular,
}: {
  linha: LinhaCusto | null;
  rateio: number;
  aoFechar: () => void;
  aoVincular: () => void;
}) {
  const { empresaAtiva } = useEmpresa();
  const [carregando, setCarregando] = useState(false);
  const [vinculadas, setVinculadas] = useState<GrupoValor[]>([]);
  const [digitados, setDigitados] = useState<Array<{ nome: string; valor: number }>>([]);
  const [indiretasTop, setIndiretasTop] = useState<Array<{ nome: string; valor: number }>>([]);
  const [imposto, setImposto] = useState<EstimativaImposto | null>(null);

  useEffect(() => {
    if (!linha || !empresaAtiva?.id) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const [vincRes, digRes, indRes, empRes, cfgRes, recRes] = await Promise.all([
        supabase
          .from('financeiro_lancamentos')
          .select('valor, status, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(nome)')
          .eq('contrato_id', linha.contrato_id)
          .eq('tipo', 'a_pagar')
          .neq('status', 'cancelado'),
        supabase.from('contrato_custos').select('tipo, valor').eq('contrato_id', linha.contrato_id),
        supabase
          .from('financeiro_lancamentos')
          .select('valor, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(nome, natureza)')
          .eq('empresa_id', empresaAtiva.id)
          .eq('tipo', 'a_pagar')
          .is('contrato_id', null)
          .neq('status', 'cancelado')
          .gte('data_competencia', new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)),
        supabase.from('empresas').select('regime_tributario').eq('id', empresaAtiva.id).maybeSingle(),
        supabase.from('financeiro_config_tributaria').select('*').eq('empresa_id', empresaAtiva.id).maybeSingle(),
        supabase
          .from('financeiro_lancamentos')
          .select('valor, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(natureza)')
          .eq('empresa_id', empresaAtiva.id)
          .eq('tipo', 'a_receber')
          .neq('status', 'cancelado')
          .gte('data_competencia', new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)),
      ]);
      if (cancelado) return;

      // Despesas vinculadas, agrupadas por categoria, separando pago × aberto.
      const porCat = new Map<string, GrupoValor>();
      for (const l of (vincRes.data as unknown as Array<{ valor: number; status: string; categoria: { nome: string } | null }>) || []) {
        const nome = l.categoria?.nome || 'Sem categoria';
        const g = porCat.get(nome) ?? { nome, pago: 0, aberto: 0 };
        const v = Number(l.valor) || 0;
        if (l.status === 'realizado' || l.status === 'conciliado') g.pago += v; else g.aberto += v;
        porCat.set(nome, g);
      }
      setVinculadas(Array.from(porCat.values()).sort((a, b) => (b.pago + b.aberto) - (a.pago + a.aberto)));

      const porTipo = new Map<string, number>();
      for (const c of (digRes.data as unknown as Array<{ tipo: string; valor: number }>) || []) {
        porTipo.set(c.tipo, (porTipo.get(c.tipo) ?? 0) + (Number(c.valor) || 0));
      }
      setDigitados(Array.from(porTipo.entries()).map(([tipo, valor]) => ({ nome: TIPO_CUSTO_LABEL[tipo] ?? tipo, valor })).sort((a, b) => b.valor - a.valor));

      const porInd = new Map<string, number>();
      for (const l of (indRes.data as unknown as Array<{ valor: number; categoria: { nome: string; natureza: string } | null }>) || []) {
        if (l.categoria?.natureza === 'movimentacao') continue;
        const nome = l.categoria?.nome || 'Sem categoria';
        porInd.set(nome, (porInd.get(nome) ?? 0) + (Number(l.valor) || 0));
      }
      setIndiretasTop(Array.from(porInd.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5));

      // Receita 12m da empresa (mesma leitura da base do Simples: receita,
      // fora movimentação; sem categoria conta como receita).
      const receita12m = ((recRes.data as unknown as Array<{ valor: number; categoria: { natureza: string } | null }>) || [])
        .filter(l => !l.categoria || l.categoria.natureza === 'receita')
        .reduce((s, l) => s + (Number(l.valor) || 0), 0);

      setImposto(estimarImpostoDoContrato({
        regimeCadastro: (empRes.data as { regime_tributario?: string | null } | null)?.regime_tributario,
        config: (cfgRes.data as never) ?? null,
        receita12mEmpresa: receita12m,
        faturadoContrato: linha.faturamento,
      }));
      setCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [linha, empresaAtiva?.id]);

  if (!linha) return null;

  const custoDireto = linha.custo_pago + linha.custo_comprometido + linha.custo_digitado;
  const lucroBruto = linha.faturamento - custoDireto;
  const impostoValor = imposto?.imposto ?? 0;
  const resultado = lucroBruto - rateio - impostoValor;
  const margemDe = (v: number) => (linha.faturamento > 0 ? (v / linha.faturamento) * 100 : 0);

  const LinhaDre = ({ rotulo, valor, negativo, forte, sub }: { rotulo: React.ReactNode; valor: number; negativo?: boolean; forte?: boolean; sub?: boolean }) => (
    <div className={`flex items-center justify-between gap-4 ${forte ? 'font-semibold border-t border-border pt-2 mt-1' : ''} ${sub ? 'pl-4 text-muted-foreground' : ''}`}>
      <span className="text-sm min-w-0">{rotulo}</span>
      <span className={`text-sm text-right tabular-nums whitespace-nowrap ${negativo && valor > 0 ? 'text-destructive-ink' : ''} ${forte ? (valor < 0 ? 'text-destructive-ink' : 'text-success-ink') : ''}`}>
        {negativo && valor > 0 ? '(-) ' : ''}{fmt(valor)}
      </span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {linha.numero_contrato || '(sem número)'} — resultado do contrato
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">{linha.orgao_contratante}</p>

        {carregando ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <LinhaDre rotulo={<b>Receita — pedidos/empenhos faturados no contrato</b>} valor={linha.faturamento} />

              <LinhaDre rotulo="Custos diretos — Contas a Pagar vinculadas (pagas)" valor={linha.custo_pago} negativo />
              {vinculadas.filter(g => g.pago > 0).map(g => <LinhaDre key={`p-${g.nome}`} rotulo={g.nome} valor={g.pago} sub />)}
              <LinhaDre rotulo="Custos comprometidos — vinculadas em aberto (competência)" valor={linha.custo_comprometido} negativo />
              {vinculadas.filter(g => g.aberto > 0).map(g => <LinhaDre key={`a-${g.nome}`} rotulo={g.nome} valor={g.aberto} sub />)}
              <LinhaDre rotulo="Custos digitados — aba Custos do contrato" valor={linha.custo_digitado} negativo />
              {digitados.map(d => <LinhaDre key={d.nome} rotulo={d.nome} valor={d.valor} sub />)}

              <LinhaDre rotulo={<>Lucro bruto <span className="text-muted-foreground font-normal">({pct(margemDe(lucroBruto))})</span></>} valor={lucroBruto} forte />

              <LinhaDre rotulo="Rateio de despesas indiretas — sem vínculo, proporcional ao faturamento" valor={rateio} negativo />
              {rateio > 0 && indiretasTop.map(d => <LinhaDre key={d.nome} rotulo={`${d.nome} (base do rateio)`} valor={d.valor} sub />)}

              <LinhaDre
                rotulo={<>Imposto estimado — {imposto?.rotuloRegime}{imposto && imposto.aliquotaSobreContrato > 0 ? ` (${pct(imposto.aliquotaSobreContrato)} sobre a receita)` : ''}</>}
                valor={impostoValor}
                negativo
              />
              {imposto?.componentes.map(c => <LinhaDre key={c.nome} rotulo={c.nome} valor={c.valor} sub />)}

              <LinhaDre rotulo={<>Resultado do contrato <span className="text-muted-foreground font-normal">({pct(margemDe(resultado))})</span></>} valor={resultado} forte />
            </div>

            {imposto && (imposto.antes.faixa != null || imposto.antes.porte !== imposto.depois.porte) && (
              <div className="rounded-lg border border-border p-4 text-sm space-y-1">
                <p className="font-semibold">Efeito do contrato na carga da empresa (antes → depois)</p>
                <p className="text-muted-foreground">
                  Receita 12m sem o contrato: <b className="text-foreground">{fmt(imposto.antes.receita)}</b> ({imposto.antes.porte}
                  {imposto.antes.faixa != null ? `, ${imposto.antes.faixa}ª faixa, ${pct(imposto.antes.aliquotaEfetiva ?? 0)}` : ''})
                  {' '}→ com o contrato: <b className="text-foreground">{fmt(imposto.depois.receita)}</b> ({imposto.depois.porte}
                  {imposto.depois.faixa != null ? `, ${imposto.depois.faixa}ª faixa, ${pct(imposto.depois.aliquotaEfetiva ?? 0)}` : ''}).
                </p>
              </div>
            )}

            {linha.faturamento > 0 && custoDireto === 0 && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  O contrato faturou {fmt(linha.faturamento)} sem nenhum custo apontado — a margem exibida é irreal
                  até as compras serem vinculadas (use "Vincular despesas em lote").
                </AlertDescription>
              </Alert>
            )}
            {imposto?.avisos.map(a => (
              <Alert key={a} variant={a.includes('teto') || a.includes('SUBLIMITE') ? 'destructive' : 'warning'}>
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{a}</AlertDescription>
              </Alert>
            ))}
            {imposto && imposto.premissas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Estimativa gerencial — premissas: {imposto.premissas.join(' ')} A apuração oficial é a tela de Apuração.
              </p>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={aoVincular}>
                <Link2 aria-hidden="true" /> Vincular despesas em lote
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/gestao-contratos?contrato=${linha.contrato_id}`}>
                  <ExternalLink aria-hidden="true" /> Abrir contrato (aba Custos)
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/financeiro/a_pagar">
                  <ExternalLink aria-hidden="true" /> Contas a Pagar
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Corrigir é agir na fonte: o vínculo de cada lançamento, o pedido, a aba Custos.
              Este painel é derivado — qualquer acerto lá reflete aqui automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
