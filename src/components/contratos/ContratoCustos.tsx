import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Receipt, DollarSign, TrendingUp, TrendingDown, Percent,
  Calculator, Building2, AlertTriangle, Info, Package, Briefcase, Truck, FileText,
  HardHat, Paperclip
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── Tax regime configs ──
const REGIMES_TRIBUTOS: Record<string, { label: string; tributos: { nome: string; aliquota: number; base: 'receita' | 'lucro'; editavel?: boolean }[] }> = {
  simples_nacional: {
    label: 'Simples Nacional',
    tributos: [
      { nome: 'DAS (alíquota efetiva)', aliquota: 6.0, base: 'receita', editavel: true },
    ],
  },
  lucro_presumido: {
    label: 'Lucro Presumido',
    tributos: [
      { nome: 'IRPJ', aliquota: 1.2, base: 'receita' },
      { nome: 'CSLL', aliquota: 1.08, base: 'receita' },
      { nome: 'COFINS', aliquota: 3.0, base: 'receita' },
      { nome: 'PIS/PASEP', aliquota: 0.65, base: 'receita' },
      { nome: 'ISS', aliquota: 5.0, base: 'receita', editavel: true },
    ],
  },
  lucro_real: {
    label: 'Lucro Real',
    tributos: [
      { nome: 'IRPJ', aliquota: 15.0, base: 'lucro' },
      { nome: 'CSLL', aliquota: 9.0, base: 'lucro' },
      { nome: 'COFINS', aliquota: 7.6, base: 'receita' },
      { nome: 'PIS/PASEP', aliquota: 1.65, base: 'receita' },
      { nome: 'ISS', aliquota: 5.0, base: 'receita', editavel: true },
    ],
  },
};

const SIMPLES_FAIXAS = [
  { min: 0, max: 180000, aliquota: 4.0, deducao: 0 },
  { min: 180000.01, max: 360000, aliquota: 7.3, deducao: 5940 },
  { min: 360000.01, max: 720000, aliquota: 9.5, deducao: 13860 },
  { min: 720000.01, max: 1800000, aliquota: 10.7, deducao: 22500 },
  { min: 1800000.01, max: 3600000, aliquota: 14.3, deducao: 87300 },
  { min: 3600000.01, max: 4800000, aliquota: 19.0, deducao: 378000 },
];

function calcSimplesAliquota(rbt12: number): number {
  const faixa = SIMPLES_FAIXAS.find(f => rbt12 >= f.min && rbt12 <= f.max);
  if (!faixa || rbt12 <= 0) return 6.0;
  return Math.max(0, ((rbt12 * faixa.aliquota / 100) - faixa.deducao) / rbt12 * 100);
}

const tiposCusto = [
  { value: 'custo_direto', label: 'Custo Direto', Icon: Package, desc: 'Materiais, insumos e custos diretamente ligados à execução' },
  { value: 'despesa_administrativa', label: 'Despesa Administrativa', Icon: Briefcase, desc: 'Despesas de gestão, escritório e suporte' },
  { value: 'frete_logistica', label: 'Frete / Logística', Icon: Truck, desc: 'Custos de transporte e entrega' },
  { value: 'tributo', label: 'Tributos', Icon: FileText, desc: 'Impostos e contribuições calculados automaticamente' },
  { value: 'mao_de_obra', label: 'Mão de Obra', Icon: HardHat, desc: 'Salários, encargos e benefícios' },
  { value: 'outros', label: 'Outros', Icon: Paperclip, desc: 'Custos diversos não classificados' },
];

const ENCARGOS_SOCIAIS = {
  inss_patronal: { label: 'INSS Patronal', aliquota: 20.0 },
  fgts: { label: 'FGTS', aliquota: 8.0 },
  salario_educacao: { label: 'Salário Educação', aliquota: 2.5 },
  sistema_s: { label: 'Sistema S (SESC/SENAC)', aliquota: 2.5 },
  sat_rat: { label: 'SAT/RAT', aliquota: 2.0 },
  sebrae: { label: 'SEBRAE', aliquota: 0.6 },
  incra: { label: 'INCRA', aliquota: 0.2 },
};

type Custo = {
  id: string; tipo: string; descricao: string; valor: number;
  data_lancamento: string | null; categoria: string | null;
  nota_fiscal: string | null; observacoes: string | null;
};

// ── Currency input helpers ──
const formatInputBRL = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseBRLInput = (value: string): string => {
  const clean = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? '0' : String(num);
};

export default function ContratoCustos({ contratoId, valorFaturado }: { contratoId: string; valorFaturado: number }) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTipo, setDialogTipo] = useState('custo_direto');
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('all');

  // Get empresa regime
  const regime = empresaAtiva?.regime_tributario || '';
  const regimeConfig = REGIMES_TRIBUTOS[regime];
  const regimeLabel = regimeConfig?.label || 'Não configurado';

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contrato_custos')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('data_lancamento', { ascending: false });
    setCustos((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [contratoId]);

  const handleDelete = async (id: string) => {
    await supabase.from('contrato_custos').delete().eq('id', id);
    toast.success('Custo excluído');
    load();
  };

  const custosFiltrados = filtroTipo === 'all' ? custos : custos.filter(c => c.tipo === filtroTipo);

  const custosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    custos.forEach(c => { map[c.tipo] = (map[c.tipo] || 0) + c.valor; });
    return map;
  }, [custos]);

  const totalCustos = custos.reduce((s, c) => s + c.valor, 0);
  const custosDiretos = custosPorTipo['custo_direto'] || 0;
  const tributos = custosPorTipo['tributo'] || 0;
  const lucroBruto = valorFaturado - custosDiretos;
  const lucroLiquido = valorFaturado - totalCustos;
  const margemBruta = valorFaturado > 0 ? (lucroBruto / valorFaturado) * 100 : 0;
  const margemLiquida = valorFaturado > 0 ? (lucroLiquido / valorFaturado) * 100 : 0;

  const openCalculator = (tipo: string) => {
    setDialogTipo(tipo);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Regime badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          <Building2 className="w-3 h-3 mr-1" />
          Regime: {regimeLabel}
        </Badge>
        {!regime && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Configure o regime tributário na empresa
          </Badge>
        )}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><DollarSign className="w-3 h-3" /> Faturamento</div>
          <p className="text-sm font-bold text-foreground">{fmt(valorFaturado)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><Receipt className="w-3 h-3" /> Custos Totais</div>
          <p className="text-sm font-bold text-destructive">{fmt(totalCustos)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3 h-3" /> Lucro Bruto</div>
          <p className={`text-sm font-bold ${lucroBruto >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroBruto)}</p>
          <p className="text-xs text-muted-foreground">Margem: {margemBruta.toFixed(1)}%</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><TrendingDown className="w-3 h-3" /> Lucro Líquido</div>
          <p className={`text-sm font-bold ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroLiquido)}</p>
          <p className="text-xs text-muted-foreground">Margem: {margemLiquida.toFixed(1)}%</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><Percent className="w-3 h-3" /> Tributos</div>
          <p className="text-sm font-bold text-warning">{fmt(tributos)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><Truck className="w-3 h-3" /> Frete/Logística</div>
          <p className="text-sm font-bold text-accent">{fmt(custosPorTipo['frete_logistica'] || 0)}</p>
        </Card>
      </div>

      {/* Calculators by type */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiposCusto.map(t => {
          const val = custosPorTipo[t.value] || 0;
          const pct = totalCustos > 0 ? (val / totalCustos) * 100 : 0;
          return (
            <Card
              key={t.value}
              className="p-3 text-center cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
              onClick={() => openCalculator(t.value)}
            >
              <t.Icon className="w-5 h-5 text-muted-foreground mx-auto" />
              <p className="text-xs font-medium mt-1">{t.label}</p>
              <p className="text-xs font-bold">{fmt(val)}</p>
              <p className="text-xs text-muted-foreground">{pct.toFixed(0)}%</p>
              <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant="secondary" className="text-xs">
                  <Calculator className="w-2.5 h-2.5 mr-0.5" /> Calcular
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Calculator Dialog */}
      <CalculatorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tipo={dialogTipo}
        contratoId={contratoId}
        userId={user?.id || ''}
        regime={regime}
        valorFaturado={valorFaturado}
        onSaved={load}
      />

      {/* Header + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-accent" /> Lançamentos de Custos
          {filtroTipo !== 'all' && (
            <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setFiltroTipo('all')}>
              {tiposCusto.find(t => t.value === filtroTipo)?.label} ✕
            </Badge>
          )}
        </h3>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Filtrar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tiposCusto.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : custosFiltrados.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum custo registrado</Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs">NF</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custosFiltrados.map(c => {
                const tipoCfg = tiposCusto.find(t => t.value === c.tipo);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                        {tipoCfg && <tipoCfg.Icon className="w-3 h-3" />} {tipoCfg?.label || c.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{c.descricao}</TableCell>
                    <TableCell className="text-xs text-right font-medium text-destructive">{fmt(c.valor)}</TableCell>
                    <TableCell className="text-xs text-center">{c.data_lancamento ? new Date(c.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-xs">{c.categoria || '—'}</TableCell>
                    <TableCell className="text-xs">{c.nota_fiscal || '—'}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Calculator Dialog — smart per-type calculators
// ══════════════════════════════════════════════════════════════

function CalculatorDialog({
  open, onOpenChange, tipo, contratoId, userId, regime, valorFaturado, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: string;
  contratoId: string;
  userId: string;
  regime: string;
  valorFaturado: number;
  onSaved: () => void;
}) {
  const tipoCfg = tiposCusto.find(t => t.value === tipo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            {tipoCfg && <tipoCfg.Icon className="w-4 h-4 text-muted-foreground" />} {tipoCfg?.label} — Calculadora
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{tipoCfg?.desc}</p>
        </DialogHeader>

        {tipo === 'tributo' ? (
          <TributoCalculator contratoId={contratoId} userId={userId} regime={regime} valorFaturado={valorFaturado} onSaved={onSaved} onClose={() => onOpenChange(false)} />
        ) : tipo === 'mao_de_obra' ? (
          <MaoDeObraCalculator contratoId={contratoId} userId={userId} regime={regime} onSaved={onSaved} onClose={() => onOpenChange(false)} />
        ) : tipo === 'frete_logistica' ? (
          <FreteCalculator contratoId={contratoId} userId={userId} onSaved={onSaved} onClose={() => onOpenChange(false)} />
        ) : (
          <GenericCostCalculator contratoId={contratoId} userId={userId} tipo={tipo} onSaved={onSaved} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Tributo Calculator ──
function TributoCalculator({ contratoId, userId, regime, valorFaturado, onSaved, onClose }: {
  contratoId: string; userId: string; regime: string; valorFaturado: number; onSaved: () => void; onClose: () => void;
}) {
  const regimeConfig = REGIMES_TRIBUTOS[regime];
  const [baseCalculo, setBaseCalculo] = useState(valorFaturado.toString());
  const [rbt12, setRbt12] = useState('');
  const [aliquotasOverride, setAliquotasOverride] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const base = parseFloat(baseCalculo) || 0;

  const simplesAliquota = useMemo(() => {
    if (regime !== 'simples_nacional') return 0;
    const rbt = parseFloat(rbt12) || 0;
    return rbt > 0 ? calcSimplesAliquota(rbt) : 6.0;
  }, [regime, rbt12]);

  const tributos = useMemo(() => {
    if (!regimeConfig) return [];
    return regimeConfig.tributos.map(t => {
      const aliquota = aliquotasOverride[t.nome] ?? (regime === 'simples_nacional' ? simplesAliquota : t.aliquota);
      const valor = base * (aliquota / 100);
      return { nome: t.nome, aliquota, valor, base: t.base, editavel: t.editavel };
    });
  }, [regimeConfig, base, aliquotasOverride, simplesAliquota, regime]);

  const totalTributos = tributos.reduce((s, t) => s + t.valor, 0);

  const handleSave = async () => {
    if (totalTributos <= 0) { toast.error('Valor dos tributos é zero'); return; }
    setSaving(true);
    const inserts = tributos.filter(t => t.valor > 0).map(t => ({
      contrato_id: contratoId,
      user_id: userId,
      tipo: 'tributo',
      descricao: `${t.nome} (${fmtPct(t.aliquota)} s/ ${fmt(base)})`,
      valor: Math.round(t.valor * 100) / 100,
      data_lancamento: new Date().toISOString().split('T')[0],
      categoria: regime === 'simples_nacional' ? 'Simples Nacional' : regime === 'lucro_presumido' ? 'Lucro Presumido' : 'Lucro Real',
      nota_fiscal: null,
      observacoes: `Base: ${fmt(base)} | Alíq: ${fmtPct(t.aliquota)} | Regime: ${REGIMES_TRIBUTOS[regime]?.label}`,
    }));
    const { error } = await supabase.from('contrato_custos').insert(inserts as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar tributos'); return; }
    toast.success(`${inserts.length} tributos registrados!`);
    onSaved();
    onClose();
  };

  if (!regimeConfig) {
    return (
      <div className="py-6 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-warning mx-auto" />
        <p className="text-sm font-medium">Regime tributário não configurado</p>
        <p className="text-xs text-muted-foreground">
          Acesse <strong>Empresas → Editar</strong> e defina o regime tributário para calcular os tributos automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2">
      <div className="p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs font-medium flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" /> Regime: <Badge variant="secondary" className="text-xs">{regimeConfig.label}</Badge>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Base de Cálculo (R$)</Label>
          <Input
            inputMode="decimal"
            value={formatInputBRL(baseCalculo)}
            onChange={e => setBaseCalculo(parseBRLInput(e.target.value))}
            placeholder="Valor do faturamento"
          />
          <p className="text-xs text-muted-foreground mt-1">Faturamento do contrato: {fmt(valorFaturado)}</p>
        </div>
        {regime === 'simples_nacional' && (
          <div>
            <Label className="text-xs">RBT12 — Receita Bruta 12 meses (R$)</Label>
            <Input
              inputMode="decimal"
              value={formatInputBRL(rbt12)}
              onChange={e => setRbt12(parseBRLInput(e.target.value))}
              placeholder="Faturamento acumulado 12 meses"
            />
            <p className="text-xs text-muted-foreground mt-1">Alíquota efetiva: {fmtPct(simplesAliquota)}</p>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-semibold">Decomposição dos Tributos</p>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tributo</TableHead>
                <TableHead className="text-xs text-right">Alíquota</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tributos.map(t => (
                <TableRow key={t.nome}>
                  <TableCell className="text-xs font-medium">{t.nome}</TableCell>
                  <TableCell className="text-xs text-right">
                    {t.editavel && regime !== 'simples_nacional' ? (
                      <Input
                        type="number" step="0.01" className="h-7 w-20 text-xs text-right ml-auto"
                        value={aliquotasOverride[t.nome] ?? t.aliquota}
                        onChange={e => setAliquotasOverride(prev => ({ ...prev, [t.nome]: parseFloat(e.target.value) || 0 }))}
                      />
                    ) : (
                      <span>{fmtPct(t.aliquota)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium text-warning">{fmt(t.valor)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-bold">
                <TableCell className="text-xs">Total Tributos</TableCell>
                <TableCell className="text-xs text-right">{base > 0 ? fmtPct((totalTributos / base) * 100) : '—'}</TableCell>
                <TableCell className="text-xs text-right text-warning">{fmt(totalTributos)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || totalTributos <= 0}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar {tributos.filter(t => t.valor > 0).length} tributos
        </Button>
      </div>
    </div>
  );
}

// ── Mão de Obra Calculator ──
function MaoDeObraCalculator({ contratoId, userId, regime, onSaved, onClose }: {
  contratoId: string; userId: string; regime: string; onSaved: () => void; onClose: () => void;
}) {
  const [salarioBase, setSalarioBase] = useState('');
  const [numFuncionarios, setNumFuncionarios] = useState('1');
  const [incluirEncargos, setIncluirEncargos] = useState(true);
  const [beneficios, setBeneficios] = useState({ vt: '0', va: '0', plano_saude: '0', seguro_vida: '0' });
  const [meses, setMeses] = useState('1');
  const [saving, setSaving] = useState(false);

  const salario = parseFloat(salarioBase) || 0;
  const qtdFunc = parseInt(numFuncionarios) || 1;
  const qtdMeses = parseInt(meses) || 1;

  const totalEncargos = useMemo(() => {
    if (!incluirEncargos || regime === 'simples_nacional') return 0;
    return Object.values(ENCARGOS_SOCIAIS).reduce((s, e) => s + (salario * e.aliquota / 100), 0);
  }, [salario, incluirEncargos, regime]);

  const totalBeneficios = useMemo(() => {
    return Object.values(beneficios).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [beneficios]);

  const custoMensalUnitario = salario + totalEncargos + totalBeneficios;
  const custoTotal = custoMensalUnitario * qtdFunc * qtdMeses;

  const handleSave = async () => {
    if (salario <= 0) { toast.error('Informe o salário base'); return; }
    setSaving(true);

    const itens: any[] = [];
    // Salários
    itens.push({
      contrato_id: contratoId, user_id: userId, tipo: 'mao_de_obra',
      descricao: `Salários (${qtdFunc} func × ${qtdMeses} meses)`,
      valor: Math.round(salario * qtdFunc * qtdMeses * 100) / 100,
      data_lancamento: new Date().toISOString().split('T')[0],
      categoria: 'Salários', nota_fiscal: null, observacoes: `Base: ${fmt(salario)}/func`,
    });

    // Encargos
    if (incluirEncargos && regime !== 'simples_nacional' && totalEncargos > 0) {
      itens.push({
        contrato_id: contratoId, user_id: userId, tipo: 'mao_de_obra',
        descricao: `Encargos Sociais (INSS, FGTS, etc.) — ${qtdFunc} func × ${qtdMeses} meses`,
        valor: Math.round(totalEncargos * qtdFunc * qtdMeses * 100) / 100,
        data_lancamento: new Date().toISOString().split('T')[0],
        categoria: 'Encargos Sociais', nota_fiscal: null,
        observacoes: Object.entries(ENCARGOS_SOCIAIS).map(([, e]) => `${e.label}: ${fmtPct(e.aliquota)}`).join(' | '),
      });
    }

    // Benefícios
    if (totalBeneficios > 0) {
      const descBen = [
        parseFloat(beneficios.vt) > 0 ? `VT: ${fmt(parseFloat(beneficios.vt))}` : '',
        parseFloat(beneficios.va) > 0 ? `VA/VR: ${fmt(parseFloat(beneficios.va))}` : '',
        parseFloat(beneficios.plano_saude) > 0 ? `Plano Saúde: ${fmt(parseFloat(beneficios.plano_saude))}` : '',
        parseFloat(beneficios.seguro_vida) > 0 ? `Seguro Vida: ${fmt(parseFloat(beneficios.seguro_vida))}` : '',
      ].filter(Boolean).join(' | ');
      itens.push({
        contrato_id: contratoId, user_id: userId, tipo: 'mao_de_obra',
        descricao: `Benefícios — ${qtdFunc} func × ${qtdMeses} meses`,
        valor: Math.round(totalBeneficios * qtdFunc * qtdMeses * 100) / 100,
        data_lancamento: new Date().toISOString().split('T')[0],
        categoria: 'Benefícios', nota_fiscal: null, observacoes: descBen,
      });
    }

    const { error } = await supabase.from('contrato_custos').insert(itens as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar custos de mão de obra'); return; }
    toast.success(`${itens.length} lançamentos de mão de obra registrados!`);
    onSaved();
    onClose();
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Salário Base (R$/mês)</Label>
          <Input inputMode="decimal" value={formatInputBRL(salarioBase)} onChange={e => setSalarioBase(parseBRLInput(e.target.value))} placeholder="0,00" />
        </div>
        <div>
          <Label className="text-xs">Nº Funcionários</Label>
          <Input type="number" min="1" value={numFuncionarios} onChange={e => setNumFuncionarios(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Meses</Label>
          <Input type="number" min="1" value={meses} onChange={e => setMeses(e.target.value)} />
        </div>
      </div>

      {regime !== 'simples_nacional' && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-semibold mb-2">Encargos Sociais (35,8%)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(ENCARGOS_SOCIAIS).map(([key, enc]) => (
                <div key={key} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                  <span className="text-muted-foreground">{enc.label}</span>
                  <span className="font-medium">{fmtPct(enc.aliquota)} = {fmt(salario * enc.aliquota / 100)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-medium text-right mt-1">Total Encargos/func: {fmt(totalEncargos)}</p>
          </div>
        </>
      )}

      {regime === 'simples_nacional' && (
        <div className="p-2 rounded bg-accent/10 text-xs text-accent-foreground">
          <Info className="w-3.5 h-3.5 inline mr-1" />
          No Simples Nacional, os encargos patronais (INSS, SAT/RAT) estão incluídos no DAS.
        </div>
      )}

      <Separator />
      <div>
        <p className="text-xs font-semibold mb-2">Benefícios (por funcionário/mês)</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Vale Transporte (R$)</Label>
            <Input inputMode="decimal" value={formatInputBRL(beneficios.vt)} onChange={e => setBeneficios(b => ({ ...b, vt: parseBRLInput(e.target.value) }))} className="h-8" /></div>
          <div><Label className="text-xs">Vale Alimentação/Refeição (R$)</Label>
            <Input inputMode="decimal" value={formatInputBRL(beneficios.va)} onChange={e => setBeneficios(b => ({ ...b, va: parseBRLInput(e.target.value) }))} className="h-8" /></div>
          <div><Label className="text-xs">Plano de Saúde (R$)</Label>
            <Input inputMode="decimal" value={formatInputBRL(beneficios.plano_saude)} onChange={e => setBeneficios(b => ({ ...b, plano_saude: parseBRLInput(e.target.value) }))} className="h-8" /></div>
          <div><Label className="text-xs">Seguro de Vida (R$)</Label>
            <Input inputMode="decimal" value={formatInputBRL(beneficios.seguro_vida)} onChange={e => setBeneficios(b => ({ ...b, seguro_vida: parseBRLInput(e.target.value) }))} className="h-8" /></div>
        </div>
      </div>

      <Separator />
      <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
        <div className="flex justify-between text-xs"><span>Salário base</span><span>{fmt(salario)}</span></div>
        {regime !== 'simples_nacional' && <div className="flex justify-between text-xs"><span>+ Encargos</span><span>{fmt(totalEncargos)}</span></div>}
        <div className="flex justify-between text-xs"><span>+ Benefícios</span><span>{fmt(totalBeneficios)}</span></div>
        <Separator className="my-1" />
        <div className="flex justify-between text-xs font-medium"><span>Custo mensal/func</span><span>{fmt(custoMensalUnitario)}</span></div>
        <div className="flex justify-between text-sm font-bold text-primary"><span>Total ({qtdFunc} func × {qtdMeses} meses)</span><span>{fmt(custoTotal)}</span></div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || salario <= 0}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar Custos de MdO
        </Button>
      </div>
    </div>
  );
}

// ── Frete Calculator ──
function FreteCalculator({ contratoId, userId, onSaved, onClose }: {
  contratoId: string; userId: string; onSaved: () => void; onClose: () => void;
}) {
  const [tipo, setTipo] = useState<'fixo' | 'percentual' | 'por_item'>('fixo');
  const [valorFixo, setValorFixo] = useState('');
  const [percentual, setPercentual] = useState('');
  const [basePercentual, setBasePercentual] = useState('');
  const [valorPorItem, setValorPorItem] = useState('');
  const [qtdItens, setQtdItens] = useState('1');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const valorCalculado = useMemo(() => {
    if (tipo === 'fixo') return parseFloat(valorFixo) || 0;
    if (tipo === 'percentual') return ((parseFloat(basePercentual) || 0) * (parseFloat(percentual) || 0)) / 100;
    return (parseFloat(valorPorItem) || 0) * (parseInt(qtdItens) || 1);
  }, [tipo, valorFixo, percentual, basePercentual, valorPorItem, qtdItens]);

  const handleSave = async () => {
    if (valorCalculado <= 0) { toast.error('Informe o valor do frete'); return; }
    setSaving(true);
    const obs = tipo === 'fixo' ? 'Valor fixo' :
      tipo === 'percentual' ? `${fmtPct(parseFloat(percentual) || 0)} s/ ${fmt(parseFloat(basePercentual) || 0)}` :
        `${fmt(parseFloat(valorPorItem) || 0)} × ${qtdItens} itens`;
    const { error } = await supabase.from('contrato_custos').insert({
      contrato_id: contratoId, user_id: userId, tipo: 'frete_logistica',
      descricao: descricao || 'Frete / Logística',
      valor: Math.round(valorCalculado * 100) / 100,
      data_lancamento: new Date().toISOString().split('T')[0],
      categoria: tipo === 'fixo' ? 'Frete Fixo' : tipo === 'percentual' ? 'Frete %' : 'Frete por Item',
      nota_fiscal: null, observacoes: obs,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar frete'); return; }
    toast.success('Frete registrado!');
    onSaved();
    onClose();
  };

  return (
    <div className="space-y-4 mt-2">
      <Tabs value={tipo} onValueChange={v => setTipo(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="fixo" className="flex-1 text-xs">Valor Fixo</TabsTrigger>
          <TabsTrigger value="percentual" className="flex-1 text-xs">% sobre Valor</TabsTrigger>
          <TabsTrigger value="por_item" className="flex-1 text-xs">Por Item</TabsTrigger>
        </TabsList>
        <TabsContent value="fixo" className="mt-3">
          <Label className="text-xs">Valor do Frete (R$)</Label>
          <Input inputMode="decimal" value={formatInputBRL(valorFixo)} onChange={e => setValorFixo(parseBRLInput(e.target.value))} placeholder="0,00" />
        </TabsContent>
        <TabsContent value="percentual" className="mt-3 space-y-3">
          <div><Label className="text-xs">Base de Cálculo (R$)</Label>
            <Input inputMode="decimal" value={formatInputBRL(basePercentual)} onChange={e => setBasePercentual(parseBRLInput(e.target.value))} /></div>
          <div><Label className="text-xs">Percentual do Frete (%)</Label>
            <Input type="number" step="0.1" value={percentual} onChange={e => setPercentual(e.target.value)} placeholder="Ex: 5" /></div>
        </TabsContent>
        <TabsContent value="por_item" className="mt-3 grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Valor por Item (R$)</Label>
            <Input inputMode="decimal" value={formatInputBRL(valorPorItem)} onChange={e => setValorPorItem(parseBRLInput(e.target.value))} /></div>
          <div><Label className="text-xs">Quantidade de Itens</Label>
            <Input type="number" min="1" value={qtdItens} onChange={e => setQtdItens(e.target.value)} /></div>
        </TabsContent>
      </Tabs>

      <div><Label className="text-xs">Descrição</Label>
        <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Frete CIF Belém-PA" /></div>

      <div className="p-3 rounded-lg bg-muted/50 border text-center">
        <p className="text-xs text-muted-foreground">Valor calculado</p>
        <p className="text-xl font-bold text-primary">{fmt(valorCalculado)}</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || valorCalculado <= 0}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar Frete
        </Button>
      </div>
    </div>
  );
}

// ── Generic Cost Calculator (Custo Direto, Desp. Admin, Outros) — Multi-item ──
type LineItem = {
  key: string; descricao: string; valor: string; quantidade: string;
  dataLancamento: string; categoria: string; notaFiscal: string; observacoes: string;
};

const emptyLine = (): LineItem => ({
  key: crypto.randomUUID(), descricao: '', valor: '', quantidade: '1',
  dataLancamento: new Date().toISOString().split('T')[0], categoria: '', notaFiscal: '', observacoes: '',
});

function GenericCostCalculator({ contratoId, userId, tipo, onSaved, onClose }: {
  contratoId: string; userId: string; tipo: string; onSaved: () => void; onClose: () => void;
}) {
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const updateLine = (key: string, field: keyof LineItem, value: string) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  };
  const removeLine = (key: string) => setLines(prev => prev.length > 1 ? prev.filter(l => l.key !== key) : prev);
  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  const lineTotal = (l: LineItem) => (parseFloat(l.valor) || 0) * (parseFloat(l.quantidade) || 1);
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const validLines = lines.filter(l => l.descricao && (parseFloat(l.valor) || 0) > 0);

  const handleSave = async () => {
    if (validLines.length === 0) { toast.error('Preencha ao menos um item com descrição e valor'); return; }
    setSaving(true);
    const inserts = validLines.map(l => {
      const qtd = parseFloat(l.quantidade) || 1;
      const total = Math.round(lineTotal(l) * 100) / 100;
      return {
        contrato_id: contratoId, user_id: userId, tipo,
        descricao: qtd > 1 ? `${l.descricao} (${qtd}x)` : l.descricao,
        valor: total,
        data_lancamento: l.dataLancamento || null,
        categoria: l.categoria || null,
        nota_fiscal: l.notaFiscal || null,
        observacoes: l.observacoes || null,
      };
    });
    const { error } = await supabase.from('contrato_custos').insert(inserts as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar custos'); return; }
    toast.success(`${inserts.length} lançamento(s) registrado(s)!`);
    onSaved();
    onClose();
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {lines.map((line, idx) => (
          <Card key={line.key} className="p-3 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
              {lines.length > 1 && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeLine(line.key)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={line.descricao} onChange={e => updateLine(line.key, 'descricao', e.target.value)} placeholder="Ex: Material de consumo" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Valor Unit. (R$) *</Label>
                <Input inputMode="decimal" value={formatInputBRL(line.valor)} onChange={e => updateLine(line.key, 'valor', parseBRLInput(e.target.value))} placeholder="0,00" />
              </div>
              <div>
                <Label className="text-xs">Qtd</Label>
                <Input type="number" min="1" step="1" value={line.quantidade} onChange={e => updateLine(line.key, 'quantidade', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Total</Label>
                <Input value={fmt(lineTotal(line))} readOnly className="bg-muted/50 font-medium" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={line.dataLancamento} onChange={e => updateLine(line.key, 'dataLancamento', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Input value={line.categoria} onChange={e => updateLine(line.key, 'categoria', e.target.value)} placeholder="Material..." />
              </div>
              <div>
                <Label className="text-xs">Nota Fiscal</Label>
                <Input value={line.notaFiscal} onChange={e => updateLine(line.key, 'notaFiscal', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={line.observacoes} onChange={e => updateLine(line.key, 'observacoes', e.target.value)} rows={1} />
            </div>
          </Card>
        ))}
      </div>

      <Button variant="outline" size="sm" className="w-full text-xs" onClick={addLine}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar mais um item
      </Button>

      <div className="p-3 rounded-lg bg-muted/50 border flex justify-between items-center">
        <span className="text-xs font-medium">{validLines.length} item(ns) válido(s)</span>
        <span className="text-sm font-bold text-primary">Total: {fmt(grandTotal)}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || validLines.length === 0}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar {validLines.length} item(ns) — {fmt(grandTotal)}
        </Button>
      </div>
    </div>
  );
}
