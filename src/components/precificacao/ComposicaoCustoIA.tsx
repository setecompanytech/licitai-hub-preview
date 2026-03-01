import { useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Calculator, Bot, Loader2, FileText, Plus, Download, ExternalLink, MapPin, Building2, ShieldCheck, Sparkles
} from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

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

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

  const gerarComposicao = async () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) {
      toast.error('Informe pelo menos um item com descrição e custo unitário.');
      return;
    }

    setLoading(true);
    setIaResult('');

    const itensTexto = validItens.map((item, idx) => {
      const custo = parseFloat(item.custoUnitario.replace(',', '.')) || 0;
      const qtd = parseFloat(item.quantidade) || 1;
      return `Item ${idx + 1}: ${item.descricao} | Qtd: ${qtd} ${item.unidade} | Custo Unitário: R$ ${custo.toFixed(2)}`;
    }).join('\n');

    const freteVal = parseFloat(frete.replace(',', '.')) || 0;
    const despAdm = parseFloat(despesasAdmin.replace(',', '.')) || 0;
    const margem = parseFloat(margemLucro) || 15;
    const rbt = parseFloat(rbt12.replace(/\D/g, '')) / 100 || 0;

    const prompt = `Gere a PLANILHA DE COMPOSIÇÃO DE CUSTO E FORMAÇÃO DE PREÇO conforme exigência da Lei nº 14.133/2021 para os itens abaixo.

DADOS DA EMPRESA:
- Regime Tributário: ${regimeLabel}
- UF da empresa: ${ufCalculo} (${ufInfo?.nome || ''})
- ICMS interno da UF: ${ufInfo?.icms_interno || 18}%
- ISS municipal (faixa): ${ufInfo?.iss_min || 2}% a ${ufInfo?.iss_max || 5}%
- Atividade principal: ${atividade}
${regime === 'simples_nacional' && rbt > 0 ? `- Faturamento 12 meses (RBT12): R$ ${rbt.toFixed(2)}` : ''}
- Margem de lucro desejada: ${margem}%
- Frete estimado: R$ ${freteVal.toFixed(2)}
- Despesas administrativas: R$ ${despAdm.toFixed(2)}

ITENS:
${itensTexto}

INSTRUÇÕES:
1. Para CADA item, monte a composição detalhada com:
   a) Custo direto do material/serviço
   b) Encargos sociais e trabalhistas (se aplicável)
   c) Tributos calculados REALMENTE conforme o regime ${regimeLabel} e UF ${ufCalculo}:
      ${regime === 'simples_nacional' ? '- Calcule a alíquota efetiva do DAS usando: [(RBT12 × Alíquota Nominal) - Parcela a Deduzir] / RBT12' : ''}
      ${regime === 'lucro_presumido' ? '- IRPJ (15% sobre base presumida), CSLL (9%), PIS (0,65%), COFINS (3%)' : ''}
      ${regime === 'lucro_real' ? '- IRPJ (15% + adicional 10%), CSLL (9%), PIS (1,65%), COFINS (7,6%) com créditos' : ''}
      - ICMS: ${ufInfo?.icms_interno || 18}% (alíquota interna de ${ufCalculo})
      ${atividade === 'servicos' ? `- ISS: considerar alíquota do município (${ufInfo?.iss_min}% a ${ufInfo?.iss_max}%)` : ''}
   d) BDI (Benefícios e Despesas Indiretas)
   e) Despesas administrativas/operacionais
   f) Frete e logística
   g) Margem de lucro (${margem}%)

2. Apresente em TABELA MARKDOWN com as colunas:
   | Componente | Base de Cálculo | Alíquota (%) | Valor (R$) |

3. Apresente o RESUMO FINAL com:
   - Custo total dos materiais/serviços
   - Total de tributos (detalhado por imposto)
   - BDI calculado
   - Preço unitário formado
   - Preço total formado
   - Preço por extenso

4. Ao final, emita parecer sobre a viabilidade econômica e margem líquida efetiva.

5. IMPORTANTE: Use as alíquotas REAIS e VIGENTES para ${ufCalculo}. Não use valores genéricos.`;

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'composicao_custo',
        onDelta: (d) => setIaResult(prev => prev + d),
        onDone: () => {
          setLoading(false);
          toast.success('Composição de custo gerada com sucesso!');
        },
        onError: (err) => {
          toast.error('Erro: ' + err);
          setLoading(false);
        },
      });
    } catch {
      setLoading(false);
      toast.error('Erro ao conectar com a IA contábil.');
    }
  };

  const enviarParaProposta = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) {
      toast.error('Nenhum item válido para enviar.');
      return;
    }

    validItens.forEach((item, idx) => {
      const custo = parseFloat(item.custoUnitario.replace(',', '.')) || 0;
      const qtd = parseFloat(item.quantidade) || 1;
      // Apply a rough markup based on regime for proposta price
      const margem = parseFloat(margemLucro) || 15;
      const markup = 1 + margem / 100;
      const precoUnit = custo * markup;
      const total = precoUnit * qtd;

      addItem({
        item: String(idx + 1),
        descricao: item.descricao,
        quantidade: String(qtd),
        unidade: item.unidade,
        marca: '',
        fabricante: '',
        modelo: '',
        valorUnitario: precoUnit.toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(precoUnit),
        valorTotal: total.toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(total),
      });
    });

    toast.success(`${validItens.length} item(ns) enviado(s) para a Proposta Técnica!`);
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
            <ShieldCheck className="w-3 h-3 mr-1" /> IA Contábil
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Gere a composição de custo e formação de preço exigida pela Nova Lei de Licitações, com cálculos tributários reais por regime e UF.
        </p>

        {/* Regime + UF Info */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge className="bg-accent/10 text-accent border-accent/20">
            <Building2 className="w-3 h-3 mr-1" /> {regimeLabel}
          </Badge>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <MapPin className="w-3 h-3 mr-1" /> {ufCalculo} — ICMS {ufInfo?.icms_interno || 18}%
          </Badge>
          {empresaAtiva && (
            <Badge variant="outline" className="text-[10px]">
              {empresaAtiva.razao_social}
            </Badge>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4 text-accent" />
          Parâmetros do Cálculo
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">UF para Cálculo *</Label>
            <Select value={ufCalculo} onValueChange={setUfCalculo}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(UF_ICMS).sort((a, b) => a[1].nome.localeCompare(b[1].nome)).map(([uf, info]) => (
                  <SelectItem key={uf} value={uf}>
                    {uf} — {info.nome} (ICMS {info.icms_interno}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Atividade Principal</Label>
            <Select value={atividade} onValueChange={(v: any) => setAtividade(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comercio">Comércio</SelectItem>
                <SelectItem value="servicos">Serviços</SelectItem>
                <SelectItem value="industria">Indústria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Margem de Lucro (%)</Label>
            <Input
              type="number"
              value={margemLucro}
              onChange={e => setMargemLucro(e.target.value)}
              placeholder="15"
              className="mt-1"
              min={0}
              max={100}
            />
          </div>
          {regime === 'simples_nacional' && (
            <div>
              <Label className="text-xs">RBT12 (Faturamento 12m)</Label>
              <Input
                value={rbt12}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  const num = parseInt(v || '0') / 100;
                  setRbt12(num > 0 ? num.toFixed(2).replace('.', ',') : '');
                }}
                placeholder="R$ 0,00"
                className="mt-1"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Frete Estimado (R$)</Label>
            <Input
              value={frete}
              onChange={e => setFrete(e.target.value)}
              placeholder="0,00"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Despesas Administrativas (R$)</Label>
            <Input
              value={despesasAdmin}
              onChange={e => setDespesasAdmin(e.target.value)}
              placeholder="0,00"
              className="mt-1"
            />
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
              <Input
                value={item.descricao}
                onChange={e => updateItem(idx, 'descricao', e.target.value)}
                placeholder="Ex: Notebook Dell Inspiron 15"
                className="mt-0.5"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Qtd</Label>
              <Input
                value={item.quantidade}
                onChange={e => updateItem(idx, 'quantidade', e.target.value)}
                placeholder="1"
                className="mt-0.5"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Unidade</Label>
              <Select value={item.unidade} onValueChange={v => updateItem(idx, 'unidade', v)}>
                <SelectTrigger className="mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['UN', 'KG', 'M', 'M²', 'M³', 'L', 'CX', 'PCT', 'PAR', 'JG', 'GL', 'SC', 'TB', 'RL', 'FD', 'BL'].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Custo Unit. (R$) *</Label>
              <Input
                value={item.custoUnitario}
                onChange={e => updateItem(idx, 'custoUnitario', e.target.value)}
                placeholder="0,00"
                className="mt-0.5"
              />
            </div>
            <div className="col-span-1">
              {itens.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive h-8 w-8 p-0">
                  ×
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Optional: Send to Proposta */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked={enviarProposta} onCheckedChange={setEnviarProposta} />
            <div>
              <p className="text-sm font-medium">Integrar à Proposta Técnica/Comercial</p>
              <p className="text-[10px] text-muted-foreground">
                Opcional — os itens serão enviados à Planilha de Preços da proposta na finalização
              </p>
            </div>
          </div>
          {enviarProposta && (
            <Button variant="outline" size="sm" onClick={enviarParaProposta}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta
            </Button>
          )}
        </div>
      </div>

      {/* Generate */}
      <Button
        onClick={gerarComposicao}
        disabled={loading}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12"
        size="lg"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <Sparkles className="w-5 h-5 mr-2" />
        )}
        Gerar Composição de Custo com IA Contábil
      </Button>

      {/* Result */}
      {iaResult && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-accent" />
              <h4 className="font-semibold text-sm">Composição de Custo Gerada</h4>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-accent/10 text-accent text-[10px]">
                {regimeLabel} • {ufCalculo}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(iaResult);
                toast.success('Composição copiada!');
              }}>
                <Download className="w-3.5 h-3.5 mr-1" /> Copiar
              </Button>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert text-xs overflow-auto">
            <ReactMarkdown>{iaResult}</ReactMarkdown>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Cálculo realizado por IA Contábil com alíquotas reais vigentes para {ufCalculo} ({ufInfo?.nome}).
            Para consulta oficial CBS/IBS, acesse a{' '}
            <a
              href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Calculadora da Receita Federal
            </a>.
          </p>
        </div>
      )}
    </div>
  );
}
