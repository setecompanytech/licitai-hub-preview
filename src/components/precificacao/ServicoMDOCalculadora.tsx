import { useState, useMemo, useCallback, useEffect } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calculator, Loader2, FileText, Download, ExternalLink, ShieldCheck, Info, Save,
  Users, HardHat, Building2, Briefcase, Plus, Trash2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import {
  calcularMDO, getDefaultMod2_1, getDefaultMod2_2, getDefaultMod3, getDefaultMod4, getDefaultBeneficios,
  type MDOInputs, type MDOResult, type CargoInput, type ParametrosContrato, type ParametrosModulo1,
  type ParametrosModulo2_1, type ParametrosModulo2_2, type ParametrosModulo3, type ParametrosModulo4,
  type BeneficioItem, type InsumoItem, type ParametrosModulo6, type LineItem, type SubModuloResult,
} from '@/lib/mdo-engine';
import { exportMDOPDF, exportMDOXLSX } from '@/lib/mdo-export';

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num > 0 ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
};
const parseInput = (f: string): number => {
  const d = f.replace(/\D/g, '');
  return d ? parseInt(d, 10) / 100 : 0;
};
const parsePerc = (v: string) => { const n = parseFloat(v); return isNaN(n) || n < 0 ? 0 : n; };

interface Props {
  licitacaoId?: string | null;
  regimeLabel: string;
  regime: string;
  ufCalculo: string;
  ufNome: string;
  licitacaoNumero: string;
  licitacaoOrgao: string;
}

export default function ServicoMDOCalculadora({ licitacaoId, regimeLabel, regime, ufCalculo, ufNome, licitacaoNumero, licitacaoOrgao }: Props) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();

  // ── Active wizard step ──
  const [step, setStep] = useState<'contrato' | 'cargos' | 'parametros' | 'beneficios' | 'resultados' | 'exportar'>('contrato');

  // ── Contrato ──
  const [contrato, setContrato] = useState<ParametrosContrato>({
    nrProcesso: '', nrContratacao: licitacaoNumero, orgao: licitacaoOrgao,
    descricaoServico: '', unidadeMedida: 'Posto de Trabalho',
    dataProposta: new Date().toISOString().split('T')[0],
    municipioUf: `${ufNome} / ${ufCalculo}`, convencaoColetiva: '',
    nrRegistroCCT: '', vigenciaCCT: '', vigenciaMeses: 12,
  });
  const updContrato = useCallback((k: keyof ParametrosContrato, v: any) => setContrato(p => ({ ...p, [k]: v })), []);

  useEffect(() => {
    setContrato(prev => ({
      ...prev,
      nrContratacao: licitacaoNumero || prev.nrContratacao,
      orgao: licitacaoOrgao || prev.orgao,
    }));
  }, [licitacaoNumero, licitacaoOrgao]);

  // ── Cargo ──
  const [cargo, setCargo] = useState<CargoInput>({
    id: '1', nome: '', jornadaTipo: '44h', salarioBase: 0, quantidadePostos: 1,
  });
  const [salarioBaseStr, setSalarioBaseStr] = useState('');

  // ── Módulo 1 ──
  const [mod1, setMod1] = useState<ParametrosModulo1>({
    gratificacaoPerc: 0, adicPericulosidadePerc: 0, adicInsalubridadePerc: 0,
    baseInsalubridade: 'salario_base', salarioMinimo: 1518,
    adicNoturnoPerc: 0, proporcaoNoturna: 0, horaNReduzidaProporcao: 0,
    adicGenericoPerc: 0, adicGenericoBase: 0,
  });
  const updMod1 = useCallback((k: keyof ParametrosModulo1, v: any) => setMod1(p => ({ ...p, [k]: v })), []);

  // ── Módulo 2.1 ──
  const [mod2_1, setMod2_1] = useState<ParametrosModulo2_1>(getDefaultMod2_1());
  const updMod2_1 = useCallback((k: keyof ParametrosModulo2_1, v: number) => setMod2_1(p => ({ ...p, [k]: v })), []);

  // ── Módulo 2.2 ──
  const [mod2_2, setMod2_2] = useState<ParametrosModulo2_2>(getDefaultMod2_2());
  const updMod2_2 = useCallback((k: keyof ParametrosModulo2_2, v: number) => setMod2_2(p => ({ ...p, [k]: v })), []);

  // ── Benefícios (2.3) ──
  const [beneficios, setBeneficios] = useState<BeneficioItem[]>(getDefaultBeneficios(0, 0, 0));

  // ── Módulo 3 ──
  const [mod3, setMod3] = useState<ParametrosModulo3>(getDefaultMod3());
  const updMod3 = useCallback((k: keyof ParametrosModulo3, v: number) => setMod3(p => ({ ...p, [k]: v })), []);

  // ── Módulo 4 ──
  const [mod4, setMod4] = useState<ParametrosModulo4>(getDefaultMod4());
  const updMod4 = useCallback((k: keyof ParametrosModulo4, v: number) => setMod4(p => ({ ...p, [k]: v })), []);

  // ── Módulo 5 ──
  const [insumos, setInsumos] = useState<InsumoItem[]>([
    { id: '5A', descricao: 'Uniformes', valorMensal: 0, detalhes: '' },
    { id: '5B', descricao: 'Materiais e EPIs', valorMensal: 0, detalhes: '' },
    { id: '5C', descricao: 'Equipamentos', valorMensal: 0, detalhes: '' },
  ]);

  // ── Módulo 6 ──
  const [mod6, setMod6] = useState<ParametrosModulo6>({
    custosIndiretosPerc: 5, lucroPerc: 10,
    pisPerc: regime === 'simples_nacional' ? 0 : regime === 'lucro_real' ? 1.65 : 0.65,
    cofinsPerc: regime === 'simples_nacional' ? 0 : regime === 'lucro_real' ? 7.60 : 3.00,
    issPerc: regime === 'simples_nacional' ? 0 : 5,
  });
  const updMod6 = useCallback((k: keyof ParametrosModulo6, v: number) => setMod6(p => ({ ...p, [k]: v })), []);

  // ── Saving ──
  const [savingCatalogo, setSavingCatalogo] = useState(false);

  // ── Build inputs ──
  const inputs: MDOInputs = useMemo(() => ({
    cargo: { ...cargo, salarioBase: parseInput(salarioBaseStr) },
    contrato, mod1, mod2_1, mod2_2, beneficios, mod3, mod4, insumos, mod6, regimeLabel,
  }), [cargo, salarioBaseStr, contrato, mod1, mod2_1, mod2_2, beneficios, mod3, mod4, insumos, mod6, regimeLabel]);

  // ── Auto-calculate ──
  const result: MDOResult | null = useMemo(() => {
    const sal = parseInput(salarioBaseStr);
    if (sal <= 0) return null;
    try { return calcularMDO(inputs); } catch { return null; }
  }, [inputs, salarioBaseStr]);

  // ── Helpers ──
  const addInsumo = () => setInsumos(p => [...p, { id: `5${String.fromCharCode(65 + p.length)}`, descricao: '', valorMensal: 0, detalhes: '' }]);
  const removeInsumo = (i: number) => setInsumos(p => p.filter((_, idx) => idx !== i));
  const updateBeneficio = (i: number, field: keyof BeneficioItem, val: any) =>
    setBeneficios(p => p.map((b, idx) => idx === i ? { ...b, [field]: val } : b));

  const salvarCatalogo = async () => {
    if (!user) { toast.error('Faça login'); return; }
    if (!result) { toast.error('Calcule primeiro'); return; }
    setSavingCatalogo(true);
    const { error } = await supabase.from('catalogo_itens_precificados').insert({
      user_id: user.id, tipo_calculo: 'servico_mdo',
      descricao: `${cargo.nome || 'Serviço MDO'} (${cargo.quantidadePostos} posto(s))`,
      quantidade: cargo.quantidadePostos, unidade: 'MÊS',
      custo_unitario: result.quadroResumo.subtotalMod1a5,
      preco_unitario: result.quadroResumo.valorMensalEmpregado,
      preco_total: result.quadroResumo.valorMensalTotal,
      licitacao_id: licitacaoId || null,
      margem_lucro: mod6.lucroPerc, regime_tributario: regime,
      licitacao_numero: contrato.nrContratacao || null,
      licitacao_orgao: contrato.orgao || null,
    });
    if (error) toast.error('Erro ao salvar'); else toast.success('Salvo no catálogo!');
    setSavingCatalogo(false);
  };

  // ── Render helpers ──
  const PercInput = ({ label, value, onChange, info, step: s }: { label: string; value: number; onChange: (v: number) => void; info?: string; step?: string }) => (
    <div>
      <Label className="text-xs flex items-center gap-1">
        {label}
        {info && (
          <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
          <TooltipContent><p className="text-[10px] max-w-xs">{info}</p></TooltipContent></Tooltip></TooltipProvider>
        )}
      </Label>
      <div className="relative mt-1">
        <Input type="number" value={value || ''} onChange={e => onChange(parsePerc(e.target.value))} className="pr-6" min={0} max={100} step={s || '0.01'} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );

  const CurrInput = ({ label, value, onChange, info }: { label: string; value: string; onChange: (v: string) => void; info?: string }) => (
    <div>
      <Label className="text-xs flex items-center gap-1">
        {label}
        {info && (
          <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
          <TooltipContent><p className="text-[10px] max-w-xs">{info}</p></TooltipContent></Tooltip></TooltipProvider>
        )}
      </Label>
      <Input value={value} onChange={e => onChange(fmtInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
    </div>
  );

  const renderLineItems = (items: LineItem[]) => (
    <div className="space-y-0.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-[11px] py-0.5 hover:bg-muted/20 px-1 rounded group">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {item.id && <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 font-mono">{item.id}</Badge>}
            <span className="text-muted-foreground truncate">{item.descricao}</span>
            {item.percentual != null && item.percentual !== 0 && <span className="text-accent text-[9px]">({item.percentual}%)</span>}
            {item.formula && (
              <TooltipProvider><Tooltip><TooltipTrigger><Eye className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" /></TooltipTrigger>
              <TooltipContent side="right"><p className="text-[10px] font-mono">{item.formula}</p></TooltipContent></Tooltip></TooltipProvider>
            )}
          </div>
          <span className="font-medium ml-2 shrink-0 tabular-nums">{fmtCur(item.valor)}</span>
        </div>
      ))}
    </div>
  );

  const renderSubmodulo = (sub: SubModuloResult) => (
    <div className="bg-muted/10 rounded-lg p-2.5 space-y-1 ml-2">
      <h6 className="text-[11px] font-semibold text-foreground">{sub.titulo}</h6>
      {renderLineItems(sub.itens)}
      <div className="flex items-center justify-between text-[11px] font-bold border-t border-border/20 pt-0.5 px-1">
        <span>Subtotal</span>
        <span className="tabular-nums">{fmtCur(sub.subtotal)}</span>
      </div>
      {sub.nota && <p className="text-[8px] text-muted-foreground italic">{sub.nota}</p>}
    </div>
  );

  const steps = [
    { id: 'contrato', label: 'Contrato', icon: Briefcase },
    { id: 'cargos', label: 'Cargos', icon: Users },
    { id: 'parametros', label: 'Parâmetros', icon: Calculator },
    { id: 'beneficios', label: 'Benefícios', icon: HardHat },
    { id: 'resultados', label: 'Resultados', icon: Eye },
    { id: 'exportar', label: 'Exportar', icon: Download },
  ] as const;

  return (
    <>
      {/* Reference banner */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold">Motor de Cálculo Determinístico — Portal de Compras</span>
          </div>
          <a href="/templates/modelo-planilha-portal-compras-v2.xlsx" download className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline bg-accent/10 px-2 py-1 rounded">
            <Download className="w-3 h-3" /> Modelo XLSX
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cálculo 100% determinístico baseado no modelo oficial do <strong>Portal de Compras</strong>. Conforme <strong>Lei 14.133/2021</strong>, <strong>IN SEGES/ME nº 5/2017 (Anexo VII-D)</strong> e <strong>Acórdãos TCU 1.753/2008 e 786/2006</strong>.
          Resultados recalculam automaticamente a cada alteração de parâmetro.
        </p>
      </div>

      {/* Step navigation */}
      <div className="bg-card rounded-xl border border-border/50 p-3">
        <div className="flex gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => setStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${step === s.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
              <s.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{i + 1}.</span> {s.label}
            </button>
          ))}
        </div>
        {result && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Valor mensal/empregado:</span>
            <Badge className="bg-accent/10 text-accent border-accent/20 text-xs font-bold">{fmtCur(result.quadroResumo.valorMensalEmpregado)}</Badge>
            <span>×{cargo.quantidadePostos} =</span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">{fmtCur(result.quadroResumo.valorMensalTotal)}</Badge>
          </div>
        )}
      </div>

      {/* ═══ STEP: CONTRATO ═══ */}
      {step === 'contrato' && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4 text-accent" /> Dados do Contrato</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">Nº do Processo</Label><Input value={contrato.nrProcesso} onChange={e => updContrato('nrProcesso', e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Nº da Contratação</Label><Input value={contrato.nrContratacao} onChange={e => updContrato('nrContratacao', e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Órgão</Label><Input value={contrato.orgao} onChange={e => updContrato('orgao', e.target.value)} className="mt-1" /></div>
            <div className="col-span-2 md:col-span-3"><Label className="text-xs">Descrição do Serviço</Label><Input value={contrato.descricaoServico} onChange={e => updContrato('descricaoServico', e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Vigência (meses) *</Label><Input type="number" value={contrato.vigenciaMeses} onChange={e => updContrato('vigenciaMeses', parseInt(e.target.value) || 12)} min={1} max={120} className="mt-1" /></div>
            <div><Label className="text-xs">Data da Proposta</Label><Input type="date" value={contrato.dataProposta} onChange={e => updContrato('dataProposta', e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Município/UF</Label><Input value={contrato.municipioUf} onChange={e => updContrato('municipioUf', e.target.value)} className="mt-1" /></div>
          </div>
          <div className="border-t border-border/30 pt-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium">Convenção Coletiva de Trabalho (Art. 63, §1º, Lei 14.133/21)</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Sindicato/Convenção</Label><Input value={contrato.convencaoColetiva} onChange={e => updContrato('convencaoColetiva', e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Nº Registro MTE</Label><Input value={contrato.nrRegistroCCT} onChange={e => updContrato('nrRegistroCCT', e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Vigência CCT</Label><Input value={contrato.vigenciaCCT} onChange={e => updContrato('vigenciaCCT', e.target.value)} className="mt-1" /></div>
            </div>
          </div>
          <Button onClick={() => setStep('cargos')} className="w-full">Próximo → Cargos/Postos</Button>
        </div>
      )}

      {/* ═══ STEP: CARGOS ═══ */}
      {step === 'cargos' && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</span>
            Módulo 1 — Cargo/Posto e Remuneração Base
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><Label className="text-xs">Cargo/Função *</Label><Input value={cargo.nome} onChange={e => setCargo(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Servente de Limpeza" className="mt-1" /></div>
            <CurrInput label="Salário-base Mensal (R$) *" value={salarioBaseStr} onChange={setSalarioBaseStr} info="Piso da CCT vigente" />
            <div>
              <Label className="text-xs">Qtd de Postos</Label>
              <Input type="number" value={cargo.quantidadePostos} onChange={e => setCargo(p => ({ ...p, quantidadePostos: parseInt(e.target.value) || 1 }))} min={1} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo de Jornada</Label>
              <Select value={cargo.jornadaTipo} onValueChange={(v: any) => {
                setCargo(p => ({ ...p, jornadaTipo: v }));
                if (v === '12x36_noturno') setMod1(p => ({ ...p, proporcaoNoturna: 7/12, horaNReduzidaProporcao: 1/12, adicNoturnoPerc: 20 }));
                else if (v === '12x36_diurno') setMod1(p => ({ ...p, proporcaoNoturna: 0, horaNReduzidaProporcao: 0, adicNoturnoPerc: 0 }));
                else setMod1(p => ({ ...p, proporcaoNoturna: 0, horaNReduzidaProporcao: 0 }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="44h">44h semanais (Diurna)</SelectItem>
                  <SelectItem value="12x36_diurno">12×36 Diurno</SelectItem>
                  <SelectItem value="12x36_noturno">12×36 Noturno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-border/30 pt-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium">Adicionais (CLT e NRs)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <PercInput label="Gratificação (%)" value={mod1.gratificacaoPerc} onChange={v => updMod1('gratificacaoPerc', v)} info="Gratificação de função sobre salário-base" />
              <PercInput label="Periculosidade (%)" value={mod1.adicPericulosidadePerc} onChange={v => updMod1('adicPericulosidadePerc', v)} info="30% sobre salário-base (Art. 193, CLT / NR-16)" step="1" />
              <PercInput label="Insalubridade (%)" value={mod1.adicInsalubridadePerc} onChange={v => updMod1('adicInsalubridadePerc', v)} info="10% (mín), 20% (méd) ou 40% (máx) — Art. 192, CLT / NR-15" step="1" />
              <PercInput label="Ad. Noturno (%)" value={mod1.adicNoturnoPerc} onChange={v => updMod1('adicNoturnoPerc', v)} info="Mín. 20% (Art. 73, CLT). Proporção noturna configurável." />
            </div>
            {(cargo.jornadaTipo === '12x36_noturno' || mod1.adicNoturnoPerc > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <Label className="text-xs">Proporção Noturna</Label>
                  <Input type="number" value={mod1.proporcaoNoturna || ''} onChange={e => updMod1('proporcaoNoturna', parseFloat(e.target.value) || 0)} step="0.0001" className="mt-1" />
                  <p className="text-[8px] text-muted-foreground mt-0.5">Ex: 7/12 = 0,5833</p>
                </div>
                <div>
                  <Label className="text-xs">Proporção Hora Reduzida</Label>
                  <Input type="number" value={mod1.horaNReduzidaProporcao || ''} onChange={e => updMod1('horaNReduzidaProporcao', parseFloat(e.target.value) || 0)} step="0.0001" className="mt-1" />
                  <p className="text-[8px] text-muted-foreground mt-0.5">Ex: 1/12 = 0,0833</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <PercInput label="Adicional Genérico (%)" value={mod1.adicGenericoPerc} onChange={v => updMod1('adicGenericoPerc', v)} info="Campo genérico para adicionais não especificados" />
              <div>
                <Label className="text-xs">Base Insalubridade</Label>
                <Select value={mod1.baseInsalubridade} onValueChange={(v: any) => updMod1('baseInsalubridade', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salario_base">Salário-base</SelectItem>
                    <SelectItem value="salario_minimo">Salário Mínimo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mod1.baseInsalubridade === 'salario_minimo' && (
                <div>
                  <Label className="text-xs">Salário Mínimo (R$)</Label>
                  <Input type="number" value={mod1.salarioMinimo} onChange={e => updMod1('salarioMinimo', parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('contrato')} className="flex-1">← Contrato</Button>
            <Button onClick={() => setStep('parametros')} className="flex-1">Próximo → Parâmetros</Button>
          </div>
        </div>
      )}

      {/* ═══ STEP: PARÂMETROS ═══ */}
      {step === 'parametros' && (
        <div className="space-y-4">
          {/* Submódulo 2.1 */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2.1</span>
              13º Salário, Férias e Adicional de Férias
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <PercInput label="13º Salário" value={mod2_1.decimoTerceiroPerc} onChange={v => updMod2_1('decimoTerceiroPerc', v)} info="Art. 7º, VIII, CF — padrão 8,33% (1/12)" />
              <PercInput label="Férias" value={mod2_1.feriasPerc} onChange={v => updMod2_1('feriasPerc', v)} info="Art. 7º, XVII, CF — padrão 8,33% (1/12)" />
              <PercInput label="Adicional de Férias (1/3)" value={mod2_1.adicionalFeriasPerc} onChange={v => updMod2_1('adicionalFeriasPerc', v)} info="Art. 7º, XVII, CF — padrão 2,78% (1/3 de 8,33%)" />
            </div>
          </div>

          {/* Submódulo 2.2 */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2.2</span>
              Encargos Previdenciários, FGTS e Contribuições
            </h4>
            <p className="text-[9px] text-muted-foreground">Incidem sobre Módulo 1 + Submódulo 2.1 (Acórdão TCU 1.753/2008)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <PercInput label="INSS Patronal" value={mod2_2.inssPatronal} onChange={v => updMod2_2('inssPatronal', v)} info="Art. 22, Lei 8.212/91" step="1" />
              <PercInput label="Salário-Educação" value={mod2_2.salarioEducacao} onChange={v => updMod2_2('salarioEducacao', v)} info="Art. 3º, Lei 9.424/96" />
              <PercInput label="SAT/RAT × FAP" value={mod2_2.satRatFap} onChange={v => updMod2_2('satRatFap', v)} info="Art. 22, Lei 8.212/91 — 1% a 3% conf. CNAE" step="1" />
              <PercInput label="SESC ou SESI" value={mod2_2.sescSesi} onChange={v => updMod2_2('sescSesi', v)} info="Art. 3º, DL 9.853/46" />
              <PercInput label="SENAC ou SENAI" value={mod2_2.senacSenai} onChange={v => updMod2_2('senacSenai', v)} info="Art. 4º, DL 8.621/46" />
              <PercInput label="SEBRAE" value={mod2_2.sebrae} onChange={v => updMod2_2('sebrae', v)} info="Art. 8º, Lei 8.029/90" />
              <PercInput label="INCRA" value={mod2_2.incra} onChange={v => updMod2_2('incra', v)} info="Art. 1º, DL 1.146/70" />
              <PercInput label="FGTS" value={mod2_2.fgts} onChange={v => updMod2_2('fgts', v)} info="Art. 15, Lei 8.036/90" step="1" />
            </div>
          </div>

          {/* Módulo 3 */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">3</span>
              Provisão para Rescisão
            </h4>
            <p className="text-[9px] text-muted-foreground">Acórdão TCU 1.753/2008 e legislação trabalhista</p>
            <div className="grid grid-cols-3 gap-3">
              <PercInput label="Aviso Prévio Indenizado" value={mod3.avisoPrevioIndenizadoPerc} onChange={v => updMod3('avisoPrevioIndenizadoPerc', v)} info="Art. 7º, XXI, CF" />
              <PercInput label="Aviso Prévio Trabalhado" value={mod3.avisoPrevioTrabalhadoPerc} onChange={v => updMod3('avisoPrevioTrabalhadoPerc', v)} info="Art. 487, CLT" />
              <PercInput label="Multa FGTS" value={mod3.multaFGTSPerc} onChange={v => updMod3('multaFGTSPerc', v)} info="40% (Art. 18, Lei 8.036/90)" step="1" />
            </div>
          </div>

          {/* Módulo 4 */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">4</span>
              Custo de Reposição do Profissional Ausente
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <PercInput label="Férias" value={mod4.feriasPerc} onChange={v => updMod4('feriasPerc', v)} />
              <PercInput label="Ausências Legais (Art. 473)" value={mod4.ausenciasLegaisPerc} onChange={v => updMod4('ausenciasLegaisPerc', v)} />
              <PercInput label="Licença-Paternidade" value={mod4.licencaPaternidadePerc} onChange={v => updMod4('licencaPaternidadePerc', v)} />
              <PercInput label="Acidente de Trabalho" value={mod4.acidenteTrabalhoPerc} onChange={v => updMod4('acidenteTrabalhoPerc', v)} />
              <PercInput label="Afastamento Maternidade" value={mod4.afastamentoMaternidadePerc} onChange={v => updMod4('afastamentoMaternidadePerc', v)} />
              <PercInput label="Outros" value={mod4.outrosPerc} onChange={v => updMod4('outrosPerc', v)} />
            </div>
            <div>
              <Label className="text-xs">Valor Intrajornada (R$/mês)</Label>
              <Input type="number" value={mod4.intrajornadaValor || ''} onChange={e => updMod4('intrajornadaValor', parseFloat(e.target.value) || 0)} className="mt-1 max-w-xs" />
              <p className="text-[8px] text-muted-foreground mt-0.5">Substituto na cobertura de intervalo p/ repouso</p>
            </div>
          </div>

          {/* Módulo 6 */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">6</span>
              Custos Indiretos, Tributos e Lucro
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <PercInput label="Custos Indiretos" value={mod6.custosIndiretosPerc} onChange={v => updMod6('custosIndiretosPerc', v)} step="1" />
              <PercInput label="Lucro" value={mod6.lucroPerc} onChange={v => updMod6('lucroPerc', v)} step="1" />
            </div>
            <div className="border-t border-border/30 pt-3">
              <p className="text-[10px] font-medium mb-2">Tributos — {regimeLabel} (calculados "por dentro")</p>
              {regime === 'simples_nacional' && (
                <p className="text-[10px] text-amber-600 mb-2">⚠️ No Simples Nacional, PIS, COFINS e ISS já estão incluídos no DAS. Preencha apenas se houver incidência separada.</p>
              )}
              <div className="grid grid-cols-3 gap-3">
                <PercInput label="PIS" value={mod6.pisPerc} onChange={v => updMod6('pisPerc', v)} />
                <PercInput label="COFINS" value={mod6.cofinsPerc} onChange={v => updMod6('cofinsPerc', v)} />
                <PercInput label="ISS" value={mod6.issPerc} onChange={v => updMod6('issPerc', v)} info="2% a 5% (LC 116/2003)" />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('cargos')} className="flex-1">← Cargos</Button>
            <Button onClick={() => setStep('beneficios')} className="flex-1">Próximo → Benefícios/Insumos</Button>
          </div>
        </div>
      )}

      {/* ═══ STEP: BENEFÍCIOS / INSUMOS ═══ */}
      {step === 'beneficios' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2.3</span>
              Benefícios Mensais e Diários
            </h4>
            <div className="space-y-3">
              {beneficios.map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Label className="text-[10px]">{b.descricao}</Label>
                    <Input value={b.valorBruto ? fmtInput(String(Math.round(b.valorBruto * 100))) : ''} onChange={e => updateBeneficio(i, 'valorBruto', parseInput(fmtInput(e.target.value)))} placeholder="R$ 0,00" className="mt-0.5" />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-[10px]">Desc. Empregado (R$)</Label>
                    <Input value={b.descontoEmpregado ? fmtInput(String(Math.round(b.descontoEmpregado * 100))) : ''} onChange={e => updateBeneficio(i, 'descontoEmpregado', parseInput(fmtInput(e.target.value)))} placeholder="R$ 0,00" className="mt-0.5" />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Líquido</Label>
                    <div className="mt-0.5 h-10 flex items-center text-xs font-medium">{fmtCur(Math.max(0, b.valorBruto - b.descontoEmpregado))}</div>
                  </div>
                  <div className="col-span-1 text-[8px] text-muted-foreground">{b.referencia}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">5</span>
                Insumos Diversos
              </h4>
              <Button variant="outline" size="sm" onClick={addInsumo}><Plus className="w-3 h-3 mr-1" /> Insumo</Button>
            </div>
            <div className="space-y-2">
              {insumos.map((ins, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4"><Input value={ins.descricao} onChange={e => setInsumos(p => p.map((x, idx) => idx === i ? { ...x, descricao: e.target.value } : x))} placeholder="Descrição" /></div>
                  <div className="col-span-3"><Input type="number" value={ins.valorMensal || ''} onChange={e => setInsumos(p => p.map((x, idx) => idx === i ? { ...x, valorMensal: parseFloat(e.target.value) || 0 } : x))} placeholder="Valor/mês" /></div>
                  <div className="col-span-4"><Input value={ins.detalhes} onChange={e => setInsumos(p => p.map((x, idx) => idx === i ? { ...x, detalhes: e.target.value } : x))} placeholder="Detalhes (ex: 2 jogos/ano)" /></div>
                  <div className="col-span-1">{insumos.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeInsumo(i)} className="text-destructive h-8 w-8 p-0"><Trash2 className="w-3 h-3" /></Button>}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('parametros')} className="flex-1">← Parâmetros</Button>
            <Button onClick={() => setStep('resultados')} className="flex-1">Ver Resultados →</Button>
          </div>
        </div>
      )}

      {/* ═══ STEP: RESULTADOS ═══ */}
      {step === 'resultados' && (
        <div className="space-y-4">
          {!result ? (
            <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
              <Calculator className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Informe o salário-base para visualizar os resultados.</p>
            </div>
          ) : (
            <>
              {/* Módulo 1 */}
              <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-accent">{result.modulo1.titulo}</h5>
                  <Badge variant="outline" className="text-[9px] tabular-nums">{fmtCur(result.modulo1.subtotal)}</Badge>
                </div>
                {renderLineItems(result.modulo1.itens!)}
                <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                  <span>Total Módulo 1</span><span className="text-accent tabular-nums">{fmtCur(result.modulo1.subtotal)}</span>
                </div>
              </div>

              {/* Módulo 2 */}
              <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                <h5 className="text-xs font-semibold text-accent">{result.modulo2.titulo}</h5>
                {result.modulo2.submodulos && Object.values(result.modulo2.submodulos).map((sub, i) => (
                  <div key={i}>{renderSubmodulo(sub)}</div>
                ))}
                <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                  <span>Total Módulo 2</span><span className="text-accent tabular-nums">{fmtCur(result.modulo2.subtotal)}</span>
                </div>
              </div>

              {/* Módulo 3 */}
              <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-accent">{result.modulo3.titulo}</h5>
                  <Badge variant="outline" className="text-[9px] tabular-nums">{fmtCur(result.modulo3.subtotal)}</Badge>
                </div>
                {renderLineItems(result.modulo3.itens!)}
                {result.modulo3.nota && <p className="text-[8px] text-muted-foreground italic">{result.modulo3.nota}</p>}
                <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                  <span>Total Módulo 3</span><span className="text-accent tabular-nums">{fmtCur(result.modulo3.subtotal)}</span>
                </div>
              </div>

              {/* Módulo 4 */}
              <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                <h5 className="text-xs font-semibold text-accent">{result.modulo4.titulo}</h5>
                {result.modulo4.submodulos && Object.values(result.modulo4.submodulos).map((sub, i) => (
                  <div key={i}>{renderSubmodulo(sub)}</div>
                ))}
                {result.modulo4.itens && renderLineItems(result.modulo4.itens)}
                {result.modulo4.nota && <p className="text-[8px] text-muted-foreground italic">{result.modulo4.nota}</p>}
                <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                  <span>Total Módulo 4</span><span className="text-accent tabular-nums">{fmtCur(result.modulo4.subtotal)}</span>
                </div>
              </div>

              {/* Módulo 5 */}
              <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-accent">{result.modulo5.titulo}</h5>
                  <Badge variant="outline" className="text-[9px] tabular-nums">{fmtCur(result.modulo5.subtotal)}</Badge>
                </div>
                {renderLineItems(result.modulo5.itens!)}
                <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                  <span>Total Módulo 5</span><span className="text-accent tabular-nums">{fmtCur(result.modulo5.subtotal)}</span>
                </div>
              </div>

              {/* Módulo 6 */}
              <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                <h5 className="text-xs font-semibold text-accent">{result.modulo6.titulo}</h5>
                {result.modulo6.submodulos && Object.values(result.modulo6.submodulos).map((sub, i) => (
                  <div key={i}>{renderSubmodulo(sub)}</div>
                ))}
                <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                  <span>Total Módulo 6</span><span className="text-accent tabular-nums">{fmtCur(result.modulo6.subtotal)}</span>
                </div>
              </div>

              {/* Quadro Resumo */}
              <div className="bg-accent/10 rounded-xl border border-accent/20 p-5 space-y-3">
                <h5 className="text-sm font-bold text-accent">QUADRO-RESUMO DO CUSTO POR EMPREGADO</h5>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { label: 'Módulo 1', val: result.quadroResumo.modulo1 },
                    { label: 'Módulo 2', val: result.quadroResumo.modulo2 },
                    { label: 'Módulo 3', val: result.quadroResumo.modulo3 },
                    { label: 'Módulo 4', val: result.quadroResumo.modulo4 },
                    { label: 'Módulo 5', val: result.quadroResumo.modulo5 },
                    { label: 'Subtotal 1-5', val: result.quadroResumo.subtotalMod1a5 },
                  ].map(m => (
                    <div key={m.label} className="text-center bg-background/50 rounded-lg p-2">
                      <p className="text-[9px] text-muted-foreground">{m.label}</p>
                      <p className="text-xs font-bold tabular-nums">{fmtCur(m.val)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-accent/20 pt-3">
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground">Módulo 6</p>
                    <p className="text-sm font-bold tabular-nums">{fmtCur(result.quadroResumo.modulo6)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground">Mensal/Empregado</p>
                    <p className="text-sm font-bold text-accent tabular-nums">{fmtCur(result.quadroResumo.valorMensalEmpregado)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground">Mensal Total ({result.quadroResumo.qtdProfissionais} postos)</p>
                    <p className="text-lg font-bold text-accent tabular-nums">{fmtCur(result.quadroResumo.valorMensalTotal)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground">Contrato ({result.quadroResumo.vigenciaMeses}m)</p>
                    <p className="text-sm font-bold tabular-nums">{fmtCur(result.quadroResumo.valorContratoTotal)}</p>
                  </div>
                </div>
              </div>

              {/* Parecer */}
              <div className={`rounded-xl p-4 text-xs space-y-1 ${result.parecer.viabilidade === 'VIÁVEL' ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{result.parecer.viabilidade}</span>
                  <span className="text-muted-foreground">— Margem Líquida: {Number(result.parecer.margemLiquida || 0).toFixed(2)}%</span>
                  {result.parecer.alertaInexequibilidade && <Badge variant="destructive" className="text-[8px]">⚠ Risco de Inexequibilidade</Badge>}
                </div>
                <p>{result.parecer.observacoes}</p>
                <p className="text-[9px] text-muted-foreground">Fundamento: {result.parecer.fundamentacaoLegal.join(' • ')}</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('beneficios')} className="flex-1">← Benefícios</Button>
                <Button onClick={() => setStep('exportar')} className="flex-1">Exportar →</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ STEP: EXPORTAR ═══ */}
      {step === 'exportar' && result && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2"><Download className="w-4 h-4 text-accent" /> Exportar Planilha de Custos</h4>
          <p className="text-xs text-muted-foreground">Exporte os resultados em formato XLSX (compatível com a planilha do Portal de Compras) ou PDF.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => { exportMDOXLSX(result, inputs); toast.success('XLSX exportado!'); }} className="h-16 flex-col gap-1">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="text-xs font-medium">Exportar XLSX</span>
              <span className="text-[9px] text-muted-foreground">2 abas: Custo + Consolidação</span>
            </Button>
            <Button variant="outline" onClick={() => { exportMDOPDF(result, inputs); toast.success('PDF exportado!'); }} className="h-16 flex-col gap-1">
              <FileText className="w-5 h-5 text-red-600" />
              <span className="text-xs font-medium">Exportar PDF</span>
              <span className="text-[9px] text-muted-foreground">Layout oficial ABNT</span>
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={salvarCatalogo} disabled={savingCatalogo} className="w-full">
            {savingCatalogo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Salvar no Catálogo de Itens Precificados
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('resultados')} className="flex-1">← Resultados</Button>
          </div>
        </div>
      )}
    </>
  );
}
