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
import { Loader2, TrendingUp, CheckCircle2, AlertTriangle, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { nomeExibido } from '@/lib/equipe/nomeExibido';

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
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Indicadores Gerenciais</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            O custo da estrutura, apurado dos lançamentos conciliados — é ele que o
            comercial usa para precificar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(janela)} onValueChange={(v) => setJanela(Number(v))}>
            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => void recarregar()} disabled={carregando}>
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {erro && (
        <p className="text-xs text-destructive">
          Não foi possível apurar os indicadores: {erro}
        </p>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                Despesas administrativas
                <span className="rounded bg-primary/15 px-1 py-px text-[10px] font-semibold text-primary">vai ao preço</span>
              </p>
              <p className="text-2xl font-bold tabular-nums">{pct(indicadores.pct_despesa_administrativa)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {brl(indicadores.media_mensal.despesa_operacional)}/mês
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">Despesas financeiras</p>
              <p className="text-2xl font-bold tabular-nums text-muted-foreground">{pct(indicadores.pct_despesa_financeira)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {brl(indicadores.media_mensal.despesa_financeira)}/mês — fora do cálculo
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">Receita bruta média</p>
              <p className="text-2xl font-bold tabular-nums">{brl(indicadores.media_mensal.receita)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
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

            return (
              <div className={`rounded-lg border p-3 ${porLancar > 0 || excedente ? 'border-warning/40 bg-warning/5' : 'border-info/40 bg-info/5'}`}>
                <p className={`text-xs font-medium flex items-center gap-1.5 mb-1.5 ${porLancar > 0 || excedente ? 'text-warning' : 'text-info'}`}>
                  <AlertTriangle className="w-4 h-4" />
                  {excedente
                    ? 'Receita lançada acima do faturamento declarado'
                    : porLancar > 0
                      ? 'Conciliação em andamento'
                      : 'Diferença explicada por contas a receber'}
                </p>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Faturamento declarado (Apuração)</span>
                    <span className="tabular-nums font-medium">{brl(faturamentoDeclarado)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Receita contabilizada (lançamentos)</span>
                    <span className="tabular-nums font-medium">{brl(indicadores.receita_bruta)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t pt-1">
                    <span className="text-muted-foreground">Diferença</span>
                    <span className="tabular-nums font-semibold">
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
                        <span className={`tabular-nums ${porLancar > 0 ? 'font-semibold text-warning' : ''}`}>{brl(porLancar)}</span>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
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
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-medium flex items-center gap-1.5">
                {indicadores.confiavel
                  ? <><CheckCircle2 className="w-4 h-4 text-success" /> Classificação suficiente</>
                  : <><AlertTriangle className="w-4 h-4 text-warning" /> Classificação incompleta</>}
              </span>
              <span className="text-xs text-muted-foreground">
                despesas {pct(indicadores.cobertura.despesa)} · receitas {pct(indicadores.cobertura.receita)}
              </span>
            </div>
            <Progress value={indicadores.cobertura.despesa ?? 0} className="h-1.5" />
            {!indicadores.confiavel && (
              <p className="text-xs text-warning">
                {brl(indicadores.cobertura.despesa_sem_categoria)} em despesas e{' '}
                {brl(indicadores.cobertura.receita_sem_categoria)} em receitas ainda sem categoria.
                Percentual apurado sobre lançamento não classificado é palpite — classifique na
                Conciliação antes de adotar.
              </p>
            )}
          </div>

          {/* ── O ato de adotar ─────────────────────────────────────────── */}
          <div className="rounded-lg border p-3 space-y-3">
            {vigente ? (
              <p className="text-xs text-muted-foreground">
                Em vigor desde <strong>{new Date(vigente.adotado_em).toLocaleDateString('pt-BR')}</strong>:{' '}
                <strong>{pct(vigente.pct_despesa_administrativa)}</strong> administrativas
                {vigente.adotado_por && nomes[vigente.adotado_por] ? ` · adotado por ${nomes[vigente.adotado_por]}` : ''}
                {defasagem != null && defasagem >= 0.5 && (
                  <span className="text-warning">
                    {' '}— o apurado hoje está {defasagem.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ponto(s) diferente.
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma versão adotada ainda. O comercial usa o valor apurado no momento do cálculo.
              </p>
            )}
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <Label className="text-xs">Observação (opcional)</Label>
                <Input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: revisão trimestral após ajuste do aluguel"
                  className="mt-1 h-9"
                />
              </div>
              <Button size="sm" onClick={confirmarAdocao} disabled={adotando || !indicadores.confiavel}>
                {adotando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
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
              <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <History className="w-4 h-4 text-muted-foreground" /> Versões adotadas
              </p>
              <div className="divide-y divide-border/50">
                {historico.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 py-2 text-xs flex-wrap">
                    <span className="text-muted-foreground">
                      {new Date(h.adotado_em).toLocaleDateString('pt-BR')}
                    </span>
                    <Badge variant="outline" className="text-xs">{h.meses}m</Badge>
                    <span className="font-medium tabular-nums">{pct(h.pct_despesa_administrativa)} adm.</span>
                    <span className="text-muted-foreground tabular-nums">{pct(h.pct_despesa_financeira)} fin.</span>
                    {h.adotado_por && nomes[h.adotado_por] && (
                      <span className="text-muted-foreground">{nomes[h.adotado_por]}</span>
                    )}
                    {h.observacao && (
                      <span className="text-muted-foreground italic truncate max-w-[280px]">{h.observacao}</span>
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
