import { useState, useEffect, useMemo } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import LinhaKpis, { type ItemKpi } from '@/components/shared/LinhaKpis';
import { toast } from 'sonner';
import {
  Calculator, Save, Loader2, TrendingUp, AlertTriangle,
  CheckCircle2, Info, BarChart3, DollarSign, Lightbulb,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Faixas Simples Nacional (Anexo I - Comércio) - LC 123/2006
const SIMPLES_FAIXAS = [
  { min: 0, max: 180000, aliquota: 4, deducao: 0, faixa: '1ª' },
  { min: 180000.01, max: 360000, aliquota: 7.3, deducao: 5940, faixa: '2ª' },
  { min: 360000.01, max: 720000, aliquota: 9.5, deducao: 13860, faixa: '3ª' },
  { min: 720000.01, max: 1800000, aliquota: 10.7, deducao: 22500, faixa: '4ª' },
  { min: 1800000.01, max: 3600000, aliquota: 14.3, deducao: 87300, faixa: '5ª' },
  { min: 3600000.01, max: 4800000, aliquota: 19, deducao: 378000, faixa: '6ª' },
];

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(s: string): number {
  return parseFloat(s.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
}

function formatInputBRL(v: string): string {
  const num = parseBRL(v);
  if (!v || num === 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type MonthData = { ano_mes: string; valor_faturamento: number; id?: string };

type RegimeSlug = 'simples_nacional' | 'lucro_presumido' | 'lucro_real';

export default function ApuracaoRegimeTributario() {
  const { empresaAtiva, reloadEmpresas } = useEmpresa();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meses, setMeses] = useState<MonthData[]>([]);
  // raw string while the user is typing — avoids reformatting decimal mid-entry
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  // Generate last 12 months
  const last12Months = useMemo(() => {
    const months: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${MESES[d.getMonth()]}/${d.getFullYear()}`;
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      months.push({ label, value });
    }
    return months;
  }, []);

  // Load saved data
  useEffect(() => {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    supabase
      .from('faturamento_mensal' as any)
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('ano_mes', { ascending: true })
      .then(({ data }) => {
        const saved = (data || []) as any[];
        const merged = last12Months.map(m => {
          const found = saved.find((s: any) => s.ano_mes === m.value);
          return found
            ? { ano_mes: m.value, valor_faturamento: found.valor_faturamento, id: found.id }
            : { ano_mes: m.value, valor_faturamento: 0 };
        });
        setMeses(merged);
        setLoading(false);
      });
  }, [empresaAtiva?.id, last12Months]);

  const handleChange = (index: number, rawValue: string) => {
    setMeses(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], valor_faturamento: parseBRL(rawValue) };
      return copy;
    });
  };

  const handleSave = async () => {
    if (!empresaAtiva?.id || !user?.id) return;
    setSaving(true);
    try {
      for (const m of meses) {
        if (m.id) {
          await supabase
            .from('faturamento_mensal' as any)
            .update({ valor_faturamento: m.valor_faturamento } as any)
            .eq('id', m.id);
        } else if (m.valor_faturamento > 0) {
          const { data } = await supabase
            .from('faturamento_mensal' as any)
            .insert({
              empresa_id: empresaAtiva.id,
              user_id: user.id,
              ano_mes: m.ano_mes,
              valor_faturamento: m.valor_faturamento,
            } as any)
            .select('id')
            .single();
          if (data) m.id = (data as any).id;
        }
      }
      toast.success('Faturamento mensal salvo com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // ── Calculations ──
  const rbt12 = meses.reduce((s, m) => s + m.valor_faturamento, 0);
  const mediaMensal = rbt12 / 12;
  const mesesPreenchidos = meses.filter(m => m.valor_faturamento > 0).length;

  const simplesInfo = useMemo(() => {
    if (rbt12 <= 0) return null;
    const faixa = SIMPLES_FAIXAS.find(f => rbt12 >= f.min && rbt12 <= f.max);
    if (!faixa) return { elegivel: false, aliquotaEfetiva: 0, valorDAS: 0, faixa: null };
    const aliquotaEfetiva = ((rbt12 * faixa.aliquota / 100) - faixa.deducao) / rbt12 * 100;
    const valorDAS = mediaMensal * (aliquotaEfetiva / 100);
    return { elegivel: rbt12 <= 4800000, aliquotaEfetiva: Math.max(0, aliquotaEfetiva), valorDAS, faixa };
  }, [rbt12, mediaMensal]);

  const presumidoInfo = useMemo(() => {
    if (rbt12 <= 0) return null;
    const elegivel = rbt12 <= 78000000;
    // Comércio: base 8%
    const baseIRPJ = mediaMensal * 0.08;
    const irpj = baseIRPJ * 0.15 + Math.max(0, baseIRPJ - 20000) * 0.10;
    const csll = mediaMensal * 0.12 * 0.09;
    const pis = mediaMensal * 0.0065;
    const cofins = mediaMensal * 0.03;
    const totalMensal = irpj + csll + pis + cofins;
    const cargaEfetiva = (totalMensal / mediaMensal) * 100;
    return { elegivel, totalMensal, cargaEfetiva };
  }, [rbt12, mediaMensal]);

  const lucroRealInfo = useMemo(() => {
    if (rbt12 <= 0) return null;
    // Estimativa conservadora: margem de lucro 15%
    const lucroEstimado = mediaMensal * 0.15;
    const irpj = lucroEstimado * 0.15 + Math.max(0, lucroEstimado - 20000) * 0.10;
    const csll = lucroEstimado * 0.09;
    const pis = mediaMensal * 0.0165;
    const cofins = mediaMensal * 0.076;
    const totalMensal = irpj + csll + pis + cofins;
    const cargaEfetiva = (totalMensal / mediaMensal) * 100;
    return { totalMensal, cargaEfetiva };
  }, [rbt12, mediaMensal]);

  const regimeRecomendado = useMemo(() => {
    if (!simplesInfo || !presumidoInfo || !lucroRealInfo) return null;
    const options = [
      { regime: 'simples_nacional', label: 'Simples Nacional', carga: simplesInfo.elegivel ? simplesInfo.aliquotaEfetiva : Infinity },
      { regime: 'lucro_presumido', label: 'Lucro Presumido', carga: presumidoInfo.elegivel ? presumidoInfo.cargaEfetiva : Infinity },
      { regime: 'lucro_real', label: 'Lucro Real', carga: lucroRealInfo.cargaEfetiva },
    ].filter(o => o.carga < Infinity);
    return options.sort((a, b) => a.carga - b.carga)[0] || null;
  }, [simplesInfo, presumidoInfo, lucroRealInfo]);

  const regimeAtual = empresaAtiva?.regime_tributario;
  const regimeLabels: Record<string, string> = {
    simples_nacional: 'Simples Nacional',
    lucro_presumido: 'Lucro Presumido',
    lucro_real: 'Lucro Real',
  };

  /**
   * Mudar o regime AQUI, onde ele é decidido.
   *
   * Este painel comparava as três cargas, marcava uma como "Recomendado" — e
   * não oferecia como adotá-la: o regime só se alterava em Empresas → Editar,
   * uma tela de cadastro. Quem estudava a decisão aqui saía convencido de ter
   * mudado, e a Precificação seguia calculando pelo regime antigo.
   */
  const [trocando, setTrocando] = useState(false);
  const trocarRegime = async (novo: string) => {
    if (!empresaAtiva?.id || novo === regimeAtual) return;
    setTrocando(true);
    const { error } = await supabase
      .from('empresas')
      .update({ regime_tributario: novo } as never)
      .eq('id', empresaAtiva.id);
    setTrocando(false);
    if (error) { toast.error('Não foi possível alterar o regime: ' + error.message); return; }
    toast.success(`Regime alterado para ${regimeLabels[novo] ?? novo}.`, {
      description: 'A Precificação passa a calcular por este regime.',
    });
    await reloadEmpresas();
  };

  if (!empresaAtiva) {
    return (
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <EstadoVazio
          icone={<Calculator />}
          titulo="Nenhuma empresa ativa"
          descricao="Selecione uma empresa ativa para configurar o regime tributário."
        />
      </section>
    );
  }

  const kpis: ItemKpi[] = [
    { rotulo: 'RBT12', valor: formatBRL(rbt12), icone: DollarSign, tom: 'info' },
    { rotulo: 'Média mensal', valor: formatBRL(mediaMensal), icone: TrendingUp },
    { rotulo: 'Meses informados', valor: `${mesesPreenchidos}/12`, icone: BarChart3 },
    ...(regimeRecomendado
      ? [{
          rotulo: `Regime sugerido · ~${regimeRecomendado.carga.toFixed(2)}% de carga`,
          valor: regimeRecomendado.label,
          icone: Lightbulb,
          tom: 'ok' as const,
        }]
      : []),
  ];

  /** A célula de status de cada regime: "Atual", "Adotar" e a etiqueta de recomendação. */
  const celulaStatus = (regime: RegimeSlug) => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {regimeAtual === regime
        ? <Badge variant="info">Atual</Badge>
        : (
          <Button size="sm" variant="ghost"
            disabled={trocando} onClick={() => trocarRegime(regime)}>
            Adotar
          </Button>
        )}
      {regimeRecomendado?.regime === regime && regimeAtual !== regime && (
        <Badge variant="success">Recomendado</Badge>
      )}
    </div>
  );

  const linhaRecomendada = (regime: RegimeSlug) =>
    regimeRecomendado?.regime === regime ? 'bg-success-tint hover:bg-success-tint' : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Apuração de Faturamento — Últimos 12 Meses</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Preencha o faturamento bruto mensal da empresa. O sistema calculará automaticamente o RBT12,
          identificará a faixa tributária ideal e alimentará a Calculadora de Precificação.
        </p>

        {regimeAtual && (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="info">
              Regime Atual: {regimeLabels[regimeAtual] || regimeAtual}
            </Badge>
          </div>
        )}

        {loading ? (
          <div role="status" aria-busy="true" className="space-y-2">
            <span className="sr-only">Carregando faturamento</span>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Mês/Ano</TableHead>
                    <TableHead>Faturamento Bruto (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meses.map((m, i) => (
                    <TableRow key={m.ano_mes}>
                      <TableCell className="py-2 font-medium">
                        <label htmlFor={`faturamento-${m.ano_mes}`}>{last12Months[i]?.label}</label>
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          id={`faturamento-${m.ano_mes}`}
                          value={drafts[i] !== undefined
                            ? drafts[i]
                            : (m.valor_faturamento > 0 ? formatInputBRL(String(m.valor_faturamento)) : '')}
                          onChange={e => setDrafts(d => ({ ...d, [i]: e.target.value }))}
                          onBlur={() => {
                            const raw = drafts[i];
                            if (raw !== undefined) {
                              handleChange(i, raw);
                              setDrafts(d => { const n = { ...d }; delete n[i]; return n; });
                            }
                          }}
                          placeholder="0,00"
                          inputMode="decimal"
                          className="h-9 max-w-xs text-right tabular-nums"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {mesesPreenchidos}/12 meses preenchidos
              </p>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Salvar Faturamento
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Results */}
      {rbt12 > 0 && (
        <>
          {/* KPIs */}
          <LinhaKpis itens={kpis} />

          {/* Comparison table */}
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground">Comparativo de Regimes Tributários</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Estimativa baseada no faturamento informado. Valores aproximados para fins de planejamento.
            </p>

            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Regime</TableHead>
                    <TableHead className="text-right">Carga Efetiva</TableHead>
                    <TableHead className="text-right">Tributo Mensal Est.</TableHead>
                    <TableHead className="text-center">Elegível</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Simples */}
                  <TableRow className={linhaRecomendada('simples_nacional')}>
                    <TableCell className="font-medium">Simples Nacional</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {simplesInfo?.elegivel ? `${simplesInfo.aliquotaEfetiva.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {simplesInfo?.elegivel ? formatBRL(simplesInfo.valorDAS) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {simplesInfo?.elegivel
                        ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Sim</span>
                        : <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Não</span>}
                    </TableCell>
                    <TableCell>{celulaStatus('simples_nacional')}</TableCell>
                  </TableRow>

                  {/* Presumido */}
                  <TableRow className={linhaRecomendada('lucro_presumido')}>
                    <TableCell className="font-medium">Lucro Presumido</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {presumidoInfo?.elegivel ? `${presumidoInfo.cargaEfetiva.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {presumidoInfo?.elegivel ? formatBRL(presumidoInfo.totalMensal) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {presumidoInfo?.elegivel
                        ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Sim</span>
                        : <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Não</span>}
                    </TableCell>
                    <TableCell>{celulaStatus('lucro_presumido')}</TableCell>
                  </TableRow>

                  {/* Lucro Real */}
                  <TableRow className={linhaRecomendada('lucro_real')}>
                    <TableCell className="font-medium">Lucro Real</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lucroRealInfo ? `${lucroRealInfo.cargaEfetiva.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lucroRealInfo ? formatBRL(lucroRealInfo.totalMensal) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Sim</span>
                    </TableCell>
                    <TableCell>{celulaStatus('lucro_real')}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {simplesInfo?.faixa && simplesInfo.elegivel && (
              <div className="mt-3 rounded-lg bg-muted p-4 text-sm">
                <p className="mb-1 font-semibold text-foreground">Simples Nacional — Detalhamento</p>
                <p><strong>Faixa:</strong> {simplesInfo.faixa.faixa} ({formatBRL(simplesInfo.faixa.min)} a {formatBRL(simplesInfo.faixa.max)})</p>
                <p><strong>Alíquota Nominal:</strong> {simplesInfo.faixa.aliquota}% | <strong>Dedução:</strong> {formatBRL(simplesInfo.faixa.deducao)}</p>
                <p><strong>Alíquota Efetiva:</strong> {simplesInfo.aliquotaEfetiva.toFixed(2)}%</p>
              </div>
            )}
          </section>

          {/* Info box */}
          <section className="flex gap-3 rounded-lg border border-border bg-muted p-4">
            <Info className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Como funciona a integração com a Calculadora?</p>
              <p>• O valor do <strong>RBT12 ({formatBRL(rbt12)})</strong> será preenchido automaticamente no campo "Faturamento 12 meses" da Calculadora de Precificação.</p>
              <p>• Você pode sobrescrever manualmente o valor na Calculadora a qualquer momento.</p>
              <p>• Os dados são atualizados sempre que você salvar novos valores nesta tela.</p>
              <p>• A estimativa do Lucro Real considera uma margem de lucro conservadora de 15%.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
