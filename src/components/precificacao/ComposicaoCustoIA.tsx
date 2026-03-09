import { useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Calculator, FileText, Plus, MapPin, Building2, ShieldCheck, Sparkles, Loader2,
} from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import ComposicaoResultado from './ComposicaoResultado';
import ComposicaoDeterministica from './ComposicaoDeterministica';
import {
  calcularComposicao,
  type ComposicaoResult,
  type ComposicaoItemInput,
  type ComposicaoParametros,
} from '@/lib/composicao-engine';

const UF_ICMS: Record<string, { nome: string; icms_interno: number; iss_min: number; iss_max: number }> = {
  AC: { nome: 'Acre', icms_interno: 19, iss_min: 2, iss_max: 5 },
  AL: { nome: 'Alagoas', icms_interno: 19, iss_min: 2, iss_max: 5 },
  AP: { nome: 'Amapá', icms_interno: 18, iss_min: 2, iss_max: 5 },
  AM: { nome: 'Amazonas', icms_interno: 20, iss_min: 2, iss_max: 5 },
  BA: { nome: 'Bahia', icms_interno: 20.5, iss_min: 2, iss_max: 5 },
  CE: { nome: 'Ceará', icms_interno: 20, iss_min: 2, iss_max: 5 },
  DF: { nome: 'Distrito Federal', icms_interno: 20, iss_min: 2, iss_max: 5 },
  ES: { nome: 'Espírito Santo', icms_interno: 17, iss_min: 2, iss_max: 5 },
  GO: { nome: 'Goiás', icms_interno: 19, iss_min: 2, iss_max: 5 },
  MA: { nome: 'Maranhão', icms_interno: 22, iss_min: 2, iss_max: 5 },
  MT: { nome: 'Mato Grosso', icms_interno: 17, iss_min: 2, iss_max: 5 },
  MS: { nome: 'Mato Grosso do Sul', icms_interno: 17, iss_min: 2, iss_max: 5 },
  MG: { nome: 'Minas Gerais', icms_interno: 18, iss_min: 2, iss_max: 5 },
  PA: { nome: 'Pará', icms_interno: 19, iss_min: 2, iss_max: 5 },
  PB: { nome: 'Paraíba', icms_interno: 20, iss_min: 2, iss_max: 5 },
  PR: { nome: 'Paraná', icms_interno: 19.5, iss_min: 2, iss_max: 5 },
  PE: { nome: 'Pernambuco', icms_interno: 20.5, iss_min: 2, iss_max: 5 },
  PI: { nome: 'Piauí', icms_interno: 21, iss_min: 2, iss_max: 5 },
  RJ: { nome: 'Rio de Janeiro', icms_interno: 22, iss_min: 2, iss_max: 5 },
  RN: { nome: 'Rio Grande do Norte', icms_interno: 20, iss_min: 2, iss_max: 5 },
  RS: { nome: 'Rio Grande do Sul', icms_interno: 17, iss_min: 2, iss_max: 5 },
  RO: { nome: 'Rondônia', icms_interno: 19.5, iss_min: 2, iss_max: 5 },
  RR: { nome: 'Roraima', icms_interno: 20, iss_min: 2, iss_max: 5 },
  SC: { nome: 'Santa Catarina', icms_interno: 17, iss_min: 2, iss_max: 5 },
  SP: { nome: 'São Paulo', icms_interno: 18, iss_min: 2, iss_max: 5 },
  SE: { nome: 'Sergipe', icms_interno: 19, iss_min: 2, iss_max: 5 },
  TO: { nome: 'Tocantins', icms_interno: 20, iss_min: 2, iss_max: 5 },
};

const REGIMES_LABEL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
};

const formatCurrencyInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  if (num <= 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrencyInput = (formatted: string): number => {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

type ItemCusto = {
  descricao: string;
  quantidade: string;
  unidade: string;
  custoUnitario: string;
};

export default function ComposicaoCustoIA() {
  const { empresaAtiva } = useEmpresa();
  const { addItem } = usePropostaCart();
  const regime = empresaAtiva?.regime_tributario || '';
  const ufEmpresa = empresaAtiva?.uf || '';

  const [ufCalculo, setUfCalculo] = useState(ufEmpresa || 'PA');
  const [atividade, setAtividade] = useState<'comercio' | 'servicos' | 'industria'>('comercio');
  const [rbt12, setRbt12] = useState('');
  const [margemLucro, setMargemLucro] = useState('15');
  const [frete, setFrete] = useState('');
  const [despesasAdmin, setDespesasAdmin] = useState('');

  const [itens, setItens] = useState<ItemCusto[]>([
    { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '' },
  ]);

  const [composicaoResult, setComposicaoResult] = useState<ComposicaoResult | null>(null);
  const [iaResult, setIaResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviarProposta, setEnviarProposta] = useState(false);

  if (!regime) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-6 text-center">
        <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-1">Regime tributário não definido</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Defina o regime tributário no cadastro da empresa (Empresas → Editar) para gerar a composição de custo.
        </p>
        <Badge variant="outline">Simples Nacional • Lucro Presumido • Lucro Real</Badge>
      </div>
    );
  }

  const ufInfo = UF_ICMS[ufCalculo];
  const regimeLabel = REGIMES_LABEL[regime] || regime;

  const addItemRow = () => {
    setItens(prev => [...prev, { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '' }]);
  };

  const updateItem = (index: number, field: keyof ItemCusto, value: string) => {
    setItens(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    if (itens.length <= 1) return;
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  // ── Motor Determinístico ──
  const gerarComposicaoDeterministica = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) {
      toast.error('Informe pelo menos um item com descrição e custo unitário.');
      return;
    }

    const inputs: ComposicaoItemInput[] = validItens.map(item => ({
      descricao: item.descricao,
      quantidade: parseFloat(item.quantidade) || 1,
      unidade: item.unidade,
      custoUnitario: parseCurrencyInput(item.custoUnitario),
    }));

    const params: ComposicaoParametros = {
      regime: regime as 'simples_nacional' | 'lucro_presumido' | 'lucro_real',
      uf: ufCalculo,
      icmsInterno: ufInfo?.icms_interno || 18,
      issRate: ufInfo?.iss_max || 5,
      atividade,
      margemLucroPerc: parseFloat(margemLucro) || 15,
      fretePerc: parseFloat(frete) || 0,
      despesasAdmPerc: parseFloat(despesasAdmin) || 0,
      rbt12: parseCurrencyInput(rbt12) || undefined,
    };

    const result = calcularComposicao(inputs, params);
    setComposicaoResult(result);
    setIaResult('');
    toast.success('Composição de custo calculada!');
  };

  // ── IA (alternativo) ──
  const gerarComposicaoIA = async () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) {
      toast.error('Informe pelo menos um item com descrição e custo unitário.');
      return;
    }
    setLoading(true);
    setIaResult('');
    setComposicaoResult(null);

    const itensTexto = validItens.map((item, idx) => {
      const custo = parseCurrencyInput(item.custoUnitario);
      const qtd = parseFloat(item.quantidade) || 1;
      return `Item ${idx + 1}: ${item.descricao} | Qtd: ${qtd} ${item.unidade} | Custo Unitário: R$ ${custo.toFixed(2)}`;
    }).join('\n');

    const freteVal = parseFloat(frete) || 0;
    const despAdm = parseFloat(despesasAdmin) || 0;
    const margem = parseFloat(margemLucro) || 15;

    const prompt = `Gere a PLANILHA DE COMPOSIÇÃO DE CUSTO conforme Lei 14.133/2021. Regime: ${regimeLabel}, UF: ${ufCalculo}, ICMS: ${ufInfo?.icms_interno || 18}%, Atividade: ${atividade}, Margem: ${margem}%, Frete: ${freteVal}%, Desp.Adm: ${despAdm}%\nITENS:\n${itensTexto}\nResponda EXCLUSIVAMENTE em JSON com: itens[{descricao,quantidade,unidade,componentes[{componente,baseCalculo,aliquota,valor}],custoUnitario,precoUnitarioFormado,precoTotal}], resumo{custoTotalMateriais,totalTributos,bdiTotal,bdiPercentual,freteTotal,despesasAdm,margemLucro,precoTotalFormado,precoExtenso,tributosPorImposto[{imposto,aliquota,valor}]}, parecer{viabilidade,margemLiquida,alertaInexequibilidade,observacoes}`;

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'composicao_custo',
        onDelta: (d) => setIaResult(prev => prev + d),
        onDone: () => { setLoading(false); toast.success('Composição gerada pela IA!'); },
        onError: (err) => { toast.error('Erro: ' + err); setLoading(false); },
      });
    } catch {
      setLoading(false);
      toast.error('Erro ao conectar com a IA contábil.');
    }
  };

  const enviarParaProposta2 = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Nenhum item válido para enviar.'); return; }
    validItens.forEach((item, idx) => {
      const custo = parseCurrencyInput(item.custoUnitario);
      const qtd = parseFloat(item.quantidade) || 1;
      const margem = parseFloat(margemLucro) || 15;
      const markup = 1 + margem / 100;
      const precoUnit = custo * markup;
      const total = precoUnit * qtd;
      addItem({
        item: String(idx + 1), descricao: item.descricao, quantidade: String(qtd), unidade: item.unidade,
        marca: '', fabricante: '', modelo: '',
        valorUnitario: precoUnit.toFixed(2).replace('.', ','), valorUnitarioExtenso: valorPorExtenso(precoUnit),
        valorTotal: total.toFixed(2).replace('.', ','), valorTotalExtenso: valorPorExtenso(total),
      });
    });
    toast.success(`${validItens.length} item(ns) enviado(s) para a Proposta Comercial!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">
              Planilha de Composição de Custo — Lei 14.133/2021
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <ShieldCheck className="w-3 h-3 mr-1" /> Motor Determinístico
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Gere a composição de custo e formação de preço com cálculos tributários determinísticos por regime e UF. Edite o preço final manualmente e o sistema recalcula a margem automaticamente.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge className="bg-accent/10 text-accent border-accent/20">
            <Building2 className="w-3 h-3 mr-1" /> {regimeLabel}
          </Badge>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <MapPin className="w-3 h-3 mr-1" /> {ufCalculo} — ICMS {ufInfo?.icms_interno || 18}%
          </Badge>
          {empresaAtiva && (
            <Badge variant="outline" className="text-[10px]">{empresaAtiva.razao_social}</Badge>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4 text-accent" /> Parâmetros do Cálculo
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">UF para Cálculo *</Label>
            <Select value={ufCalculo} onValueChange={setUfCalculo}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(UF_ICMS).sort((a, b) => a[1].nome.localeCompare(b[1].nome)).map(([uf, info]) => (
                  <SelectItem key={uf} value={uf}>{uf} — {info.nome} (ICMS {info.icms_interno}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Atividade Principal</Label>
            <Select value={atividade} onValueChange={(v: any) => setAtividade(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comercio">Comércio</SelectItem>
                <SelectItem value="servicos">Serviços</SelectItem>
                <SelectItem value="industria">Indústria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Margem de Lucro (%)</Label>
            <Input type="number" value={margemLucro} onChange={e => setMargemLucro(e.target.value)} placeholder="15" className="mt-1" min={0} max={100} />
          </div>
          {regime === 'simples_nacional' && (
            <div>
              <Label className="text-xs">RBT12 (Faturamento 12m)</Label>
              <Input value={rbt12} onChange={e => setRbt12(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Frete Estimado (%)</Label>
            <Input type="number" value={frete} onChange={e => setFrete(e.target.value)} placeholder="0" className="mt-1" min={0} max={100} />
          </div>
          <div>
            <Label className="text-xs">Despesas Administrativas (%)</Label>
            <Input type="number" value={despesasAdmin} onChange={e => setDespesasAdmin(e.target.value)} placeholder="0" className="mt-1" min={0} max={100} />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Itens para Composição</h4>
          <Button variant="outline" size="sm" onClick={addItemRow}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
          </Button>
        </div>
        {itens.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5">
              <Label className="text-[10px]">Descrição *</Label>
              <Input value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Ex: Notebook Dell Inspiron 15" className="mt-0.5" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Qtd</Label>
              <Input value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} placeholder="1" className="mt-0.5" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Unidade</Label>
              <Select value={item.unidade} onValueChange={v => updateItem(idx, 'unidade', v)}>
                <SelectTrigger className="mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['UN', 'KG', 'M', 'M²', 'M³', 'L', 'CX', 'PCT', 'PAR', 'JG', 'GL', 'SC', 'TB', 'RL', 'FD', 'BL'].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Custo Unit. (R$) *</Label>
              <Input value={item.custoUnitario} onChange={e => updateItem(idx, 'custoUnitario', formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-0.5" />
            </div>
            <div className="col-span-1">
              {itens.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive h-8 w-8 p-0">×</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Send to Proposta */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked={enviarProposta} onCheckedChange={setEnviarProposta} />
            <div>
              <p className="text-sm font-medium">Integrar à Proposta Comercial</p>
              <p className="text-[10px] text-muted-foreground">Os itens serão enviados à Planilha de Preços</p>
            </div>
          </div>
          {enviarProposta && (
            <Button variant="outline" size="sm" onClick={enviarParaProposta2}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta
            </Button>
          )}
        </div>
      </div>

      {/* Generate Buttons */}
      <div className="space-y-3">
        <Button onClick={gerarComposicaoDeterministica} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12" size="lg">
          <Calculator className="w-5 h-5 mr-2" />
          Calcular Composição de Custo (Motor Determinístico)
        </Button>
        <Button onClick={gerarComposicaoIA} disabled={loading} variant="outline" className="w-full h-10" size="lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Gerar via IA Contábil (alternativo)
        </Button>
      </div>

      {/* Results */}
      {composicaoResult && (
        <ComposicaoDeterministica
          result={composicaoResult}
          onResultChange={setComposicaoResult}
          regimeLabel={regimeLabel}
          ufCalculo={ufCalculo}
          ufNome={ufInfo?.nome || ''}
        />
      )}

      {iaResult && !composicaoResult && (
        <ComposicaoResultado iaResult={iaResult} regimeLabel={regimeLabel} ufCalculo={ufCalculo} ufNome={ufInfo?.nome || ''} />
      )}
    </div>
  );
}
