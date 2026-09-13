import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useIndicadoresGerenciais } from '@/hooks/useIndicadoresGerenciais';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, CheckCircle2, AlertTriangle, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { cn } from '@/lib/utils';

/**
 * Os indicadores que o Financeiro entrega ao comercial — e o ato de adotá-los.
 *
 * O cálculo é vivo: muda a cada lançamento conciliado. A ADOÇÃO é um ato
 * datado, com autor — porque proposta entregue não se reescreve com o
 * percentual do mês seguinte, e porque quem for questionado sobre um preço
 * dois anos depois precisa poder dizer "usei 6,99%, apurados em 25/08 sobre
 * doze meses, com esta composição".
 *
 * A janela é escolha de quem administra: 12 meses suaviza sazonalidade mas
 * reage devagar; 3 meses sente a mudança de estrutura e sofre com o mês
 * atípico. Por isso é parâmetro, não constante.
 */

type Adocao = {
  id: string;
  adotado_em: string;
  adotado_por: string | null;
  referencia: string;
  meses: number;
  pct_despesa_administrativa: number | null;
  pct_despesa_financeira: number | null;
  observacao: string | null;
};

const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`;

export default function IndicadoresGerenciais() {
  const { empresaAtiva } = useEmpresa();
  const [janela, setJanela] = useState(12);
  const { indicadores, carregando, erro, recarregar, adotar } = useIndicadoresGerenciais(janela);
  const [observacao, setObservacao] = useState('');
  const [adotando, setAdotando] = useState(false);
  const [historico, setHistorico] = useState<Adocao[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});

  /**
   * A conta que explica a divergência — e ela tem TRÊS parcelas, não duas.
   *
   * O faturamento DECLARADO na Apuração (digitado mês a mês) contra o
   * CONTABILIZADO pelos indicadores. A diferença costuma ser lida como
   * "conciliação atrasada", e em parte é. Mas há uma segunda causa, estrutural,
   * que não some com esforço nenhum: o indicador só conta lançamento
   * `realizado`/`conciliado`, e uma Conta a Receber emitida e ainda não
   * recebida é faturamento de competência que NUNCA entra até ser quitada.
   *
   * Num negócio que vende a órgão público — trinta, sessenta, noventa dias
   * para receber — essa parcela é permanente. Somá-la ao atraso da conciliação
   * faria a tela cobrar do usuário um trabalho que não existe.
   *
   * Por isso a divergência é decomposta:
   *   declarado − contabilizado = (a receber em aberto) + (o que falta lançar)
   *
   * A primeira parcela é normal e se explica sozinha. A segunda é a real
   * pendência de conciliação — e é só ela que deve pesar na decisão de adotar.
   */
  const [faturamentoDeclarado, setFaturamentoDeclarado] = useState(0);
  const [aReceberEmAberto, setAReceberEmAberto] = useState(0);

  useEffect(() => {
    if (!empresaAtiva?.id) { setFaturamentoDeclarado(0); setAReceberEmAberto(0); return; }
    const empresaId = empresaAtiva.id;

    void supabase
      .from('faturamento_mensal' as never)
      .select('valor_faturamento')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        const total = ((data ?? []) as { valor_faturamento: number }[])
          .reduce((s, r) => s + (Number(r.valor_faturamento) || 0), 0);
        setFaturamentoDeclarado(total);
      });

    if (!indicadores?.periodo) { setAReceberEmAberto(0); return; }
    void supabase
      .from('financeiro_lancamentos')
      .select('valor')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'a_receber')
      .not('status', 'in', '(realizado,conciliado)')
      .gte('data_competencia', indicadores.periodo.inicio)
      .lte('data_competencia', indicadores.periodo.fim)
      .then(({ data }) => {
        const total = ((data ?? []) as { valor: number }[])
          .reduce((s, r) => s + (Number(r.valor) || 0), 0);
        setAReceberEmAberto(total);
      });
  }, [empresaAtiva?.id, indicadores?.periodo]);

  const carregarHistorico = useCallback(async () => {
    if (!empresaAtiva?.id) return;
    const { data } = await supabase
      .from('financeiro_indicadores_adotados' as never)
      .select('id, adotado_em, adotado_por, referencia, meses, pct_despesa_administrativa, pct_despesa_financeira, observacao')
      .eq('empresa_id', empresaAtiva.id)
      .order('adotado_em', { ascending: false })
      .limit(12);
    const linhas = ((data ?? []) as unknown) as Adocao[];
    setHistorico(linhas);

    // Quem adotou: sem o nome, o histórico vira uma coluna de UUIDs.
    const ids = [...new Set(linhas.map((l) => l.adotado_por).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: perfis } = await supabase
        .from('profiles')
        .select('user_id, nome_completo, username')
        .in('user_id', ids);
      setNomes(Object.fromEntries(
        (perfis ?? []).map((p) => {
          const perfil = p as { user_id: string; nome_completo?: string | null; username?: string | null };
          return [
            perfil.user_id,
            nomeExibido({
              nome_individual: perfil.nome_completo,
              login_individual: perfil.username,
            }),
          ];
        }),
      ));
    }
  }, [empresaAtiva?.id]);

  useEffect(() => { void carregarHistorico(); }, [carregarHistorico]);

  const confirmarAdocao = async () => {
    setAdotando(true);
    const ok = await adotar(observacao || undefined);
    setAdotando(false);
    if (!ok) { toast.error('Não foi possível registrar a adoção.'); return; }
    toast.success('Indicadores adotados — a partir de agora é esta a referência do comercial.');
    setObservacao('');
    void carregarHistorico();
  };

  const vigente = historico[0] ?? null;
  // O indicador mudou desde a última adoção? É o que dispara a revisão.
  const defasagem = vigente && indicadores?.pct_despesa_administrativa != null
    ? Math.abs((vigente.pct_despesa_administrativa ?? 0) - indicadores.pct_despesa_administrativa)
    : null;

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Indicadores Gerenciais</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            O custo da estrutura, apurado dos lançamentos conciliados — é ele que o
            comercial usa para precificar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(janela)} onValueChange={(v) => setJanela(Number(v))}>
            <SelectTrigger className="w-[180px]" aria-label="Janela de apuração"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => void recarregar()} disabled={carregando} aria-label="Recalcular indicadores" title="Recalcular">
            {carregando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>Não foi possível apurar os indicadores: {erro}</AlertDescription>
        </Alert>
      )}

      {indicadores && (
        <>
          {/* ── Os percentuais, e quais deles chegam ao preço ────────────
              Só o administrativo entra. O financeiro e o CMV ficam de fora, por
              motivos diferentes: juro e tarifa bancária são custo de FINANCIAR
              a operação, não de operá-la — por decisão do dono do produto, saem
              do lucro, não do preço; e o CMV já é o custo unitário do item na
              cotação, somá-lo aqui cobraria a mercadoria duas vezes. Dizer isso
              no cartão evita que alguém some 6% de boa-fé. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-primary bg-primary-tint p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                Despesas administrativas
                <Badge variant="success">vai ao preço</Badge>
              </p>
              <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{pct(indicadores.pct_despesa_administrativa)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {brl(indicadores.media_mensal.despesa_operacional)}/mês
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-sm text-muted-foreground">Despesas financeiras</p>
              <p className="text-[2rem] font-bold leading-10 tabular-nums text-muted-foreground">{pct(indicadores.pct_despesa_financeira)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {brl(indicadores.media_mensal.despesa_financeira)}/mês — fora do cálculo
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-sm text-muted-foreground">Receita bruta média</p>
              <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{brl(indicadores.media_mensal.receita)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                CMV {pct(indicadores.pct_cmv)} — fora do cálculo
              </p>
            </div>
          </div>

          {/* ── Confronto: declarado × contabilizado, decomposto ─────────── */}
          {faturamentoDeclarado > 0 && indicadores.receita_bruta > 0 && (() => {
            const dif = faturamentoDeclarado - indicadores.receita_bruta;
            const pctDif = (dif / faturamentoDeclarado) * 100;
            if (Math.abs(pctDif) < 2) return null;

            // A parcela que a conciliação NÃO resolve: nota emitida, prazo
            // correndo. Some do confronto quando o órgão pagar, não antes.
            const emAberto = Math.min(Math.max(aReceberEmAberto, 0), Math.max(dif, 0));
            const porLancar = Math.max(dif - emAberto, 0);
            const excedente = dif < 0;
            const atencao = porLancar > 0 || excedente;

            return (
              <div className={cn(
                'rounded-lg border p-4',
                atencao ? 'border-warning-line bg-warning-tint text-warning-ink' : 'border-border bg-muted text-foreground',
              )}>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className={cn('h-4 w-4', !atencao && 'text-primary')} aria-hidden="true" />
                  {excedente
                    ? 'Receita lançada acima do faturamento declarado'
                    : porLancar > 0
                      ? 'Conciliação em andamento'
                      : 'Diferença explicada por contas a receber'}
                </p>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Faturamento declarado (Apuração)</span>
                    <span className="font-medium tabular-nums">{brl(faturamentoDeclarado)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Receita contabilizada (lançamentos)</span>
                    <span className="font-medium tabular-nums">{brl(indicadores.receita_bruta)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-border pt-1">
                    <span className="text-muted-foreground">Diferença</span>
                    <span className="font-semibold tabular-nums">
                      {brl(Math.abs(dif))} ({Math.abs(pctDif).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                    </span>
                  </div>
                  {!excedente && (
                    <>
                      <div className="flex justify-between gap-2 pl-3">
                        <span className="text-muted-foreground">· a receber em aberto (normal)</span>
                        <span className="tabular-nums">{brl(emAberto)}</span>
                      </div>
                      <div className="flex justify-between gap-2 pl-3">
                        <span className="text-muted-foreground">· sem lançamento (a conciliar)</span>
                        <span className={cn('tabular-nums', porLancar > 0 && 'font-semibold')}>{brl(porLancar)}</span>
                      </div>
                    </>
                  )}
                </div>

                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  {excedente
                    ? 'Há mais receita lançada do que faturamento declarado na Apuração — provável nota lançada em duplicidade, ou competência de Apuração desatualizada.'
                    : porLancar > 0
                      ? <>Faltam <strong className="text-foreground">{brl(porLancar)}</strong> em lançamentos. Enquanto isso, o percentual apurado sai ALTO — a mesma despesa dividida por uma receita menor — e precificar por ele encarece a proposta.</>
                      : 'A diferença inteira é nota emitida com prazo a vencer. Não há conciliação pendente: essa parcela só entra quando o pagamento entrar.'}
                </p>
              </div>
            );
          })()}

          {/* ── A confiança do número, dita antes de ele ser usado ──────── */}
          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {indicadores.confiavel
                  ? <><CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> Classificação suficiente</>
                  : <><AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" /> Classificação incompleta</>}
              </span>
              <span className="text-sm text-muted-foreground">
                despesas {pct(indicadores.cobertura.despesa)} · receitas {pct(indicadores.cobertura.receita)}
              </span>
            </div>
            <Progress value={indicadores.cobertura.despesa ?? 0} className="h-2" aria-label="Cobertura de classificação das despesas" />
            {!indicadores.confiavel && (
              <p className="text-sm text-warning">
                {brl(indicadores.cobertura.despesa_sem_categoria)} em despesas e{' '}
                {brl(indicadores.cobertura.receita_sem_categoria)} em receitas ainda sem categoria.
                Percentual apurado sobre lançamento não classificado é palpite — classifique na
                Conciliação antes de adotar.
              </p>
            )}
          </div>

          {/* ── O ato de adotar ─────────────────────────────────────────── */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            {vigente ? (
              <p className="text-sm text-muted-foreground">
                Em vigor desde <strong className="text-foreground">{new Date(vigente.adotado_em).toLocaleDateString('pt-BR')}</strong>:{' '}
                <strong className="text-foreground">{pct(vigente.pct_despesa_administrativa)}</strong> administrativas
                {vigente.adotado_por && nomes[vigente.adotado_por] ? ` · adotado por ${nomes[vigente.adotado_por]}` : ''}
                {defasagem != null && defasagem >= 0.5 && (
                  <span className="text-warning">
                    {' '}— o apurado hoje está {defasagem.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ponto(s) diferente.
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma versão adotada ainda. O comercial usa o valor apurado no momento do cálculo.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <Label htmlFor="indicadores-observacao">Observação (opcional)</Label>
                <Input
                  id="indicadores-observacao"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: revisão trimestral após ajuste do aluguel"
                  className="mt-1"
                />
              </div>
              <Button onClick={confirmarAdocao} disabled={adotando || !indicadores.confiavel}>
                {adotando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                Adotar estes indicadores
              </Button>
            </div>
            {!indicadores.confiavel && (
              <p className="text-xs text-muted-foreground">
                A adoção fica indisponível enquanto a classificação não cobrir 80% do movimento.
              </p>
            )}
          </div>

          {/* ── O histórico: a memória que defende o preço praticado ────── */}
          {historico.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Versões adotadas
              </p>
              <div className="divide-y divide-border">
                {historico.map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="text-muted-foreground">
                      {new Date(h.adotado_em).toLocaleDateString('pt-BR')}
                    </span>
                    <Badge variant="muted">{h.meses}m</Badge>
                    <span className="font-medium tabular-nums text-foreground">{pct(h.pct_despesa_administrativa)} adm.</span>
                    <span className="tabular-nums text-muted-foreground">{pct(h.pct_despesa_financeira)} fin.</span>
                    {h.adotado_por && nomes[h.adotado_por] && (
                      <span className="text-muted-foreground">{nomes[h.adotado_por]}</span>
                    )}
                    {h.observacao && (
                      <span className="max-w-[280px] truncate italic text-muted-foreground">{h.observacao}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
