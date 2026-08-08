import { useState, useEffect, useMemo } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

export default function ApuracaoRegimeTributario() {
  const { empresaAtiva, reloadEmpresas } = useEmpresa();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meses, setMeses] = useState<MonthData[]>([]);

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

  if (!empresaAtiva) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Calculator className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Selecione uma empresa ativa para configurar o regime tributário.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Apuração de Faturamento — Últimos 12 Meses</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Preencha o faturamento bruto mensal da empresa. O sistema calculará automaticamente o RBT12,
          identificará a faixa tributária ideal e alimentará a Calculadora de Precificação.
        </p>

        {regimeAtual && (
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="text-xs">
              Regime Atual: {regimeLabels[regimeAtual] || regimeAtual}
            </Badge>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[180px]">Mês/Ano</TableHead>
                    <TableHead className="text-xs">Faturamento Bruto (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meses.map((m, i) => (
                    <TableRow key={m.ano_mes}>
                      <TableCell className="text-xs font-medium py-2">
                        {last12Months[i]?.label}
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          value={m.valor_faturamento > 0 ? formatInputBRL(String(m.valor_faturamento)) : ''}
                          onChange={e => handleChange(i, e.target.value)}
                          placeholder="0,00"
                          className="h-8 text-xs max-w-[200px]"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {mesesPreenchidos}/12 meses preenchidos
              </p>
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <DollarSign className="w-3 h-3" /> RBT12
              </div>
              <p className="text-sm font-bold">{formatBRL(rbt12)}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <TrendingUp className="w-3 h-3" /> Média Mensal
              </div>
              <p className="text-sm font-bold">{formatBRL(mediaMensal)}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <BarChart3 className="w-3 h-3" /> Meses Informados
              </div>
              <p className="text-sm font-bold">{mesesPreenchidos}/12</p>
            </Card>
            {regimeRecomendado && (
              <Card className="p-3 border-border/50 bg-muted/30">
                <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                  <Lightbulb className="w-3 h-3" /> Regime Sugerido
                </div>
                <p className="text-sm font-bold text-foreground">{regimeRecomendado.label}</p>
                <p className="text-xs text-muted-foreground">~{regimeRecomendado.carga.toFixed(2)}% carga</p>
              </Card>
            )}
          </div>

          {/* Comparison table */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Comparativo de Regimes Tributários</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Estimativa baseada no faturamento informado. Valores aproximados para fins de planejamento.
            </p>

            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Regime</TableHead>
                    <TableHead className="text-xs text-right">Carga Efetiva</TableHead>
                    <TableHead className="text-xs text-right">Tributo Mensal Est.</TableHead>
                    <TableHead className="text-xs text-center">Elegível</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Simples */}
                  <TableRow className={regimeRecomendado?.regime === 'simples_nacional' ? 'bg-success/10 hover:bg-success/15' : ''}>
                    <TableCell className="text-xs font-medium">Simples Nacional</TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {simplesInfo?.elegivel ? `${simplesInfo.aliquotaEfetiva.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {simplesInfo?.elegivel ? formatBRL(simplesInfo.valorDAS) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {simplesInfo?.elegivel
                        ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                        : <AlertTriangle className="w-4 h-4 text-warning mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {regimeAtual === 'simples_nacional' && <Badge className="text-xs bg-muted text-foreground">Atual</Badge>}
                      {regimeRecomendado?.regime === 'simples_nacional' && regimeAtual !== 'simples_nacional' && (
                        <Badge className="text-xs bg-success/15 text-success">Recomendado</Badge>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Presumido */}
                  <TableRow className={regimeRecomendado?.regime === 'lucro_presumido' ? 'bg-success/10 hover:bg-success/15' : ''}>
                    <TableCell className="text-xs font-medium">Lucro Presumido</TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {presumidoInfo?.elegivel ? `${presumidoInfo.cargaEfetiva.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {presumidoInfo?.elegivel ? formatBRL(presumidoInfo.totalMensal) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {presumidoInfo?.elegivel
                        ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                        : <AlertTriangle className="w-4 h-4 text-warning mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {regimeAtual === 'lucro_presumido' && <Badge className="text-xs bg-muted text-foreground">Atual</Badge>}
                      {regimeRecomendado?.regime === 'lucro_presumido' && regimeAtual !== 'lucro_presumido' && (
                        <Badge className="text-xs bg-success/15 text-success">Recomendado</Badge>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Lucro Real */}
                  <TableRow className={regimeRecomendado?.regime === 'lucro_real' ? 'bg-success/10 hover:bg-success/15' : ''}>
                    <TableCell className="text-xs font-medium">Lucro Real</TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {lucroRealInfo ? `${lucroRealInfo.cargaEfetiva.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {lucroRealInfo ? formatBRL(lucroRealInfo.totalMensal) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      {regimeAtual === 'lucro_real' && <Badge className="text-xs bg-muted text-foreground">Atual</Badge>}
                      {regimeRecomendado?.regime === 'lucro_real' && regimeAtual !== 'lucro_real' && (
                        <Badge className="text-xs bg-success/15 text-success">Recomendado</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {simplesInfo?.faixa && simplesInfo.elegivel && (
              <div className="mt-3 bg-muted/30 rounded-lg p-3 text-xs">
                <p className="font-semibold text-foreground mb-1">Simples Nacional — Detalhamento</p>
                <p><strong>Faixa:</strong> {simplesInfo.faixa.faixa} ({formatBRL(simplesInfo.faixa.min)} a {formatBRL(simplesInfo.faixa.max)})</p>
                <p><strong>Alíquota Nominal:</strong> {simplesInfo.faixa.aliquota}% | <strong>Dedução:</strong> {formatBRL(simplesInfo.faixa.deducao)}</p>
                <p><strong>Alíquota Efetiva:</strong> {simplesInfo.aliquotaEfetiva.toFixed(2)}%</p>
              </div>
            )}
          </section>

          {/* Info box */}
          <section className="bg-muted/30 border border-border/50 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
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
