import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { estimarImpostoDoContrato, type EstimativaImposto } from '@/lib/financeiro/imposto-do-contrato';
import { categoriaEntraNoRateio } from '@/lib/financeiro/rateio-de-indiretas';
import { AlertCircle, ExternalLink, Link2, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput } from '@/components/ui/money-input';
import { toast } from 'sonner';
import { TIPOS_DE_AJUSTE, type TipoDeAjuste } from '@/lib/contratos/custo-do-lote';

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
  /** Custo declarado nos pedidos que as contas a pagar ainda não cobrem (22/09). */
  custo_declarado_sem_documento?: number;
};

type GrupoValor = { nome: string; pago: number; aberto: number };

/** O que `cobertura_de_custo_do_contrato` devolve (migration 20260923000001). */
type Cobertura = {
  declarado: number; comprovado_pago: number; comprovado_aberto: number;
  do_contrato_pago: number; do_contrato_aberto: number;
  a_distribuir: number; a_distribuir_n: number;
  declarado_sem_documento: number; cobertura_pct: number | null;
  pedidos_total: number; pedidos_sem_custo: number;
};

/** A janela de 12 meses, em data ISO, para a receita e para o faturado do contrato. */
const inicioDaJanela12m = () => new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

/**
 * A ficha do contrato em formato de DRE gerencial: de onde vem cada número do
 * painel, com a origem nomeada linha a linha. Tudo aqui é LEITURA derivada
 * das mesmas tabelas que alimentam o resto do sistema — corrigir é agir na
 * fonte (vincular a despesa, editar o lançamento, declarar o custo no
 * pedido), e o painel recalcula sozinho.
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
  // Despesas declaradas À MÃO (30/09): imposto, administrativa, operacional, BDI,
  // outra — parcela nomeada e com ressalva; nunca substitui o comprovado.
  type Ajuste = { id: string; tipo: TipoDeAjuste; descricao: string; valor: number; user_email: string | null; created_at: string };
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [novoAjuste, setNovoAjuste] = useState<{ tipo: TipoDeAjuste; descricao: string; valor: number }>({ tipo: 'operacional', descricao: '', valor: 0 });
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const carregarAjustes = async (contratoId: string) => {
    const { data } = await supabase.from('contrato_custos_ajustes' as never).select('id, tipo, descricao, valor, user_email, created_at').eq('contrato_id', contratoId).order('created_at', { ascending: true });
    setAjustes(((data ?? []) as unknown as Ajuste[]).map((a) => ({ ...a, valor: Number(a.valor) || 0 })));
  };
  const adicionarAjuste = async () => {
    if (!linha || !empresaAtiva?.id) return;
    if (!novoAjuste.descricao.trim() || !(novoAjuste.valor > 0)) { toast.error('Informe a descrição e o valor da despesa.'); return; }
    setSalvandoAjuste(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('contrato_custos_ajustes' as never).insert({
      empresa_id: empresaAtiva.id, contrato_id: linha.contrato_id, tipo: novoAjuste.tipo, descricao: novoAjuste.descricao.trim(), valor: novoAjuste.valor,
      user_id: u?.user?.id ?? null, user_email: u?.user?.email ?? null,
    } as never);
    setSalvandoAjuste(false);
    if (error) { toast.error('Não foi possível registrar a despesa', { description: error.message.includes('contrato_custos_ajustes') ? 'A tabela contrato_custos_ajustes ainda não existe: cole a migration 20260930000006.' : error.message }); return; }
    setNovoAjuste({ tipo: 'operacional', descricao: '', valor: 0 });
    void carregarAjustes(linha.contrato_id);
  };
  const removerAjuste = async (id: string) => {
    if (!linha) return;
    const { error } = await supabase.from('contrato_custos_ajustes' as never).delete().eq('id', id);
    if (error) { toast.error('Não foi possível remover', { description: error.message }); return; }
    void carregarAjustes(linha.contrato_id);
  };
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);

  useEffect(() => {
    if (!linha || !empresaAtiva?.id) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const janela = inicioDaJanela12m();
      const [vincRes, digRes, indRes, empRes, cfgRes, recRes, pedRes, cobRes] = await Promise.all([
        supabase
          .from('financeiro_lancamentos')
          .select('valor, status, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(nome)')
          .eq('contrato_id', linha.contrato_id)
          .eq('tipo', 'a_pagar')
          .neq('status', 'cancelado'),
        supabase.from('contrato_custos').select('tipo, valor').eq('contrato_id', linha.contrato_id),
        supabase
          .from('financeiro_lancamentos')
          .select('valor, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(nome, natureza, grupo_dre)')
          .eq('empresa_id', empresaAtiva.id)
          .eq('tipo', 'a_pagar')
          .is('contrato_id', null)
          .neq('status', 'cancelado')
          .gte('data_competencia', janela),
        supabase.from('empresas').select('regime_tributario').eq('id', empresaAtiva.id).maybeSingle(),
        supabase.from('financeiro_config_tributaria').select('*').eq('empresa_id', empresaAtiva.id).maybeSingle(),
        supabase
          .from('financeiro_lancamentos')
          .select('valor, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(natureza)')
          .eq('empresa_id', empresaAtiva.id)
          .eq('tipo', 'a_receber')
          .neq('status', 'cancelado')
          .gte('data_competencia', janela),
        // Janelas iguais (22/09): o faturado do contrato DENTRO dos mesmos 12
        // meses da receita — é o que move faixa, porte e adicional.
        supabase
          .from('contrato_pedidos')
          .select('valor_total')
          .eq('contrato_id', linha.contrato_id)
          .neq('status', 'cancelado')
          .gte('data_pedido', janela),
        // A cobertura de custo: RPC de migration colada à mão — ausente, o
        // painel mostra o resto.
        supabase.rpc('cobertura_de_custo_do_contrato' as never, { p_contrato_id: linha.contrato_id } as never),
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

      // A base do rateio: só despesa OPERACIONAL (22/09) — a mesma régua da
      // função do banco que soma o total.
      const porInd = new Map<string, number>();
      for (const l of (indRes.data as unknown as Array<{ valor: number; categoria: { nome: string; natureza: string | null; grupo_dre: string | null } | null }>) || []) {
        if (!categoriaEntraNoRateio(l.categoria)) continue;
        const nome = l.categoria?.nome || 'Sem categoria';
        porInd.set(nome, (porInd.get(nome) ?? 0) + (Number(l.valor) || 0));
      }
      setIndiretasTop(Array.from(porInd.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5));

      // Receita 12m da empresa (mesma leitura da base do Simples: receita,
      // fora movimentação; sem categoria conta como receita).
      const receita12m = ((recRes.data as unknown as Array<{ valor: number; categoria: { natureza: string } | null }>) || [])
        .filter(l => !l.categoria || l.categoria.natureza === 'receita')
        .reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const faturado12m = ((pedRes.data as unknown as Array<{ valor_total: number }>) || [])
        .reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

      setImposto(estimarImpostoDoContrato({
        regimeCadastro: (empRes.data as { regime_tributario?: string | null } | null)?.regime_tributario,
        config: (cfgRes.data as never) ?? null,
        receita12mEmpresa: receita12m,
        faturadoContrato: linha.faturamento,
        faturadoContrato12m: Math.min(faturado12m, linha.faturamento),
      }));
      setCobertura((cobRes.data as unknown as Cobertura[] | null)?.[0] ?? null);
      // Os ajustes à mão são lidos aqui mesmo: a rotina de recarga serve ao registrar/remover.
      const { data: aj } = await supabase.from('contrato_custos_ajustes' as never).select('id, tipo, descricao, valor, user_email, created_at').eq('contrato_id', linha.contrato_id).order('created_at', { ascending: true });
      setAjustes(((aj ?? []) as unknown as Ajuste[]).map((a) => ({ ...a, valor: Number(a.valor) || 0 })));
      setCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [linha, empresaAtiva?.id]);

  if (!linha) return null;

  const declaradoSemDocumento = Number(linha.custo_declarado_sem_documento ?? cobertura?.declarado_sem_documento ?? 0);
  const custoDireto = linha.custo_pago + linha.custo_comprometido + linha.custo_digitado + declaradoSemDocumento;
  const lucroBruto = linha.faturamento - custoDireto;
  const impostoValor = imposto?.imposto ?? 0;
  const ajustesTotal = ajustes.reduce((s, a) => s + a.valor, 0);
  const resultado = lucroBruto - rateio - impostoValor - ajustesTotal;
  const rotuloDoTipo = (t: TipoDeAjuste) => TIPOS_DE_AJUSTE.find((x) => x.valor === t)?.rotulo ?? t;
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
          <DialogTitle>
            {linha.numero_contrato || '(sem número)'} — resultado do contrato
          </DialogTitle>
          <DialogDescription>{linha.orgao_contratante}</DialogDescription>
        </DialogHeader>

        {carregando ? (
          // Espera na forma da DRE que vem a seguir, não um spinner no centro.
          <div role="status" className="space-y-2 rounded-lg border border-border p-4">
            <span className="sr-only">Carregando resultado do contrato</span>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
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
              {/* A exceção (22/09): o declarado nos pedidos que nenhuma conta a
                  pagar cobre. Parcela nomeada — nunca somada em silêncio. */}
              <LinhaDre rotulo="Custo declarado nos pedidos — sem documento (gerencial)" valor={declaradoSemDocumento} negativo />

              <LinhaDre rotulo={<>Lucro bruto <span className="text-muted-foreground font-normal">({pct(margemDe(lucroBruto))})</span></>} valor={lucroBruto} forte />

              <LinhaDre rotulo="Rateio de despesas operacionais — sem vínculo, proporcional ao faturamento" valor={rateio} negativo />
              {rateio > 0 && indiretasTop.map(d => <LinhaDre key={d.nome} rotulo={`${d.nome} (base do rateio)`} valor={d.valor} sub />)}

              <LinhaDre
                rotulo={<>Imposto estimado — {imposto?.rotuloRegime}{imposto && imposto.aliquotaSobreContrato > 0 ? ` (${pct(imposto.aliquotaSobreContrato)} sobre a receita)` : ''}</>}
                valor={impostoValor}
                negativo
              />
              {imposto?.componentes.map(c => <LinhaDre key={c.nome} rotulo={c.nome} valor={c.valor} sub />)}

              {/* O declarado à mão entra NOMEADO e com ressalva: o sistema não o comprova. */}
              <LinhaDre rotulo={<>Despesas declaradas à mão <Badge variant="warning" className="ml-1">sem documento</Badge></>} valor={ajustesTotal} negativo />
              {ajustes.map(a => <LinhaDre key={a.id} rotulo={`${rotuloDoTipo(a.tipo)} — ${a.descricao}`} valor={a.valor} sub />)}

              <LinhaDre rotulo={<>Resultado do contrato <span className="text-muted-foreground font-normal">({pct(margemDe(resultado))})</span></>} valor={resultado} forte />
            </div>

            <div className="rounded-lg border border-border p-4 text-sm space-y-3">
              <div>
                <p className="font-semibold">Despesas declaradas à mão — imposto, administrativa, operacional, BDI</p>
                <p className="text-muted-foreground">Entram no resultado como parcela nomeada e com ressalva: o sistema não as comprova. O que tem documento vai por Contas a Pagar vinculadas ao contrato; o imposto estimado e o rateio já são automáticos acima.</p>
              </div>
              {ajustes.length > 0 && (
                <div className="divide-y divide-border rounded-md border border-border">
                  {ajustes.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1"><b>{rotuloDoTipo(a.tipo)}</b> — {a.descricao}<span className="block text-xs text-muted-foreground">{a.user_email ?? 'sem autor'} · {new Date(a.created_at).toLocaleDateString('pt-BR')}</span></span>
                      <span className="tabular-nums whitespace-nowrap">{fmt(a.valor)}</span>
                      <Button size="icon-sm" variant="ghost-destructive" aria-label="Remover despesa" onClick={() => void removerAjuste(a.id)}><Trash2 aria-hidden="true" /></Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)_9rem_auto] items-end">
                <div className="space-y-1"><Label className="text-xs">Tipo</Label>
                  <Select value={novoAjuste.tipo} onValueChange={(v) => setNovoAjuste({ ...novoAjuste, tipo: v as TipoDeAjuste })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_DE_AJUSTE.map(t => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={novoAjuste.descricao} placeholder="Frete Belém → Barcarena, out/2024" onChange={(e) => setNovoAjuste({ ...novoAjuste, descricao: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Valor (R$)</Label><MoneyInput value={novoAjuste.valor} onValueChange={(v) => setNovoAjuste({ ...novoAjuste, valor: v })} /></div>
                <Button size="sm" onClick={() => void adicionarAjuste()} disabled={salvandoAjuste}><Plus aria-hidden="true" />Registrar</Button>
              </div>
            </div>

            {cobertura && (
              <div className="rounded-lg border border-border p-4 text-sm space-y-1">
                <p className="font-semibold">Cobertura de custo — declarado nos pedidos × contas a pagar</p>
                <p className="text-muted-foreground">
                  Declarado <b className="text-foreground tabular-nums">{fmt(Number(cobertura.declarado))}</b>
                  {' · '}contas a pagar do contrato <b className="text-foreground tabular-nums">{fmt(Number(cobertura.do_contrato_pago) + Number(cobertura.do_contrato_aberto))}</b>
                  {' · '}cobertura <b className="text-foreground tabular-nums">{cobertura.cobertura_pct == null ? '—' : pct(Number(cobertura.cobertura_pct))}</b>
                  {Number(cobertura.pedidos_sem_custo) > 0 && <> · <Badge variant="warning">{Number(cobertura.pedidos_sem_custo)} de {Number(cobertura.pedidos_total)} pedidos sem custo</Badge></>}
                </p>
                {Number(cobertura.a_distribuir) > 0.01 && (
                  <p className="text-muted-foreground">
                    {fmt(Number(cobertura.a_distribuir))} em {Number(cobertura.a_distribuir_n)} conta{Number(cobertura.a_distribuir_n) === 1 ? '' : 's'} a pagar ainda sem pedido —
                    distribua em Gestão de Contratos › Pedidos › Compras deste pedido.
                  </p>
                )}
              </div>
            )}

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
                  até as compras serem vinculadas (use "Vincular despesas em lote") ou o custo ser declarado nos pedidos.
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
                  <ExternalLink aria-hidden="true" /> Abrir contrato (cobertura de custo)
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/financeiro/a_pagar">
                  <ExternalLink aria-hidden="true" /> Contas a Pagar
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Corrigir é agir na fonte: o vínculo de cada lançamento, a parte de cada compra em Compras deste pedido, o custo declarado no pedido.
              Este painel é derivado — qualquer acerto lá reflete aqui automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
