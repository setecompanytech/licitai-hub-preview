import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Send, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, Globe, Shield, Package, DollarSign, Clock,
  Eye, Download, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ItemProposta = {
  id: string;
  item: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  marca: string;
  modelo: string;
};

export default function ComprasGovEnvio() {
  const [tab, setTab] = useState('preparar');
  const [numeroPregao, setNumeroPregao] = useState('');
  const [portal, setPortal] = useState('comprasgov');
  const [itens, setItens] = useState<ItemProposta[]>([
    { id: '1', item: '1', descricao: '', quantidade: 1, unidade: 'UN', valorUnitario: 0, marca: '', modelo: '' }
  ]);
  const [declaracoes, setDeclaracoes] = useState({
    meEpp: false,
    inexistenciaFato: false,
    menorAprendiz: false,
    elaboracaoIndep: false,
    reservadoMeEpp: false,
  });
  const [enviando, setEnviando] = useState(false);

  const addItem = () => {
    setItens(prev => [...prev, {
      id: crypto.randomUUID(),
      item: String(prev.length + 1),
      descricao: '',
      quantidade: 1,
      unidade: 'UN',
      valorUnitario: 0,
      marca: '',
      modelo: '',
    }]);
  };

  const removeItem = (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemProposta, value: any) => {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const totalProposta = itens.reduce((acc, i) => acc + (i.quantidade * i.valorUnitario), 0);

  const handleEnviar = async () => {
    if (!numeroPregao.trim()) {
      toast.error('Informe o número do pregão');
      return;
    }
    if (itens.some(i => !i.descricao || i.valorUnitario <= 0)) {
      toast.error('Preencha todos os itens da proposta corretamente');
      return;
    }

    setEnviando(true);
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 2000));
    setEnviando(false);
    toast.success('Proposta preparada com sucesso! Os dados estão prontos para envio no portal.');
    setTab('revisao');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Send className="w-6 h-6 text-accent" />
              Envio de Propostas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Prepare e envie propostas para portais de compras públicas
            </p>
          </div>
        </div>

        {/* Portal selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={portal} onValueChange={setPortal}>
            <SelectTrigger className="w-[220px]">
              <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comprasgov">Compras.gov.br</SelectItem>
              <SelectItem value="pncp">PNCP</SelectItem>
              <SelectItem value="bec">BEC/SP</SelectItem>
              <SelectItem value="bll">BLL Compras</SelectItem>
              <SelectItem value="licitacoes-e">Licitações-e (BB)</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Número do Pregão (ex: PE-001/2026)"
            value={numeroPregao}
            onChange={e => setNumeroPregao(e.target.value)}
            className="w-[280px]"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="preparar" className="flex items-center gap-1">
              <Package className="w-4 h-4" /> Itens da Proposta
            </TabsTrigger>
            <TabsTrigger value="declaracoes" className="flex items-center gap-1">
              <Shield className="w-4 h-4" /> Declarações
            </TabsTrigger>
            <TabsTrigger value="anexos" className="flex items-center gap-1">
              <FileText className="w-4 h-4" /> Anexos
            </TabsTrigger>
            <TabsTrigger value="revisao" className="flex items-center gap-1">
              <Eye className="w-4 h-4" /> Revisão & Envio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preparar" className="space-y-4">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 w-12">Item</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Descrição</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-2 w-20">Qtd</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-2 w-20">Un</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-32">Vl. Unit.</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 w-28">Marca</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 w-28">Modelo</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={item.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <Input value={item.descricao} onChange={e => updateItem(item.id, 'descricao', e.target.value)} placeholder="Descrição do item" className="h-8 text-sm" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" value={item.quantidade} onChange={e => updateItem(item.id, 'quantidade', Number(e.target.value))} className="h-8 text-sm text-center" min={1} />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={item.unidade} onValueChange={v => updateItem(item.id, 'unidade', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['UN', 'KG', 'M', 'M²', 'M³', 'L', 'CX', 'PCT', 'HR', 'SV', 'MÊS'].map(u => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" value={item.valorUnitario} onChange={e => updateItem(item.id, 'valorUnitario', Number(e.target.value))} className="h-8 text-sm text-right" min={0} step={0.01} />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={item.marca} onChange={e => updateItem(item.id, 'marca', e.target.value)} placeholder="Marca" className="h-8 text-sm" />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={item.modelo} onChange={e => updateItem(item.id, 'modelo', e.target.value)} placeholder="Modelo" className="h-8 text-sm" />
                        </td>
                        <td className="px-3 py-2">
                          {itens.length > 1 && (
                            <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-border/50 flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Item
                </Button>
                <div className="text-sm">
                  Total: <span className="font-bold text-accent">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalProposta)}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="declaracoes" className="space-y-3">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-sm mb-2">Declarações obrigatórias</h3>
              {[
                { key: 'meEpp', label: 'Declaração de enquadramento como ME/EPP', desc: 'Conforme LC 123/2006' },
                { key: 'inexistenciaFato', label: 'Inexistência de fato impeditivo', desc: 'Art. 63, §1º da Lei 14.133/2021' },
                { key: 'menorAprendiz', label: 'Não emprego de menor', desc: 'Art. 68, VI da Lei 14.133/2021' },
                { key: 'elaboracaoIndep', label: 'Elaboração independente de proposta', desc: 'Instrução Normativa nº 01/2009' },
                { key: 'reservadoMeEpp', label: 'Ciência de item reservado para ME/EPP', desc: 'Quando aplicável' },
              ].map(decl => (
                <label key={decl.key} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={(declaracoes as any)[decl.key]}
                    onChange={e => setDeclaracoes(prev => ({ ...prev, [decl.key]: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-accent"
                  />
                  <div>
                    <p className="text-sm font-medium">{decl.label}</p>
                    <p className="text-xs text-muted-foreground">{decl.desc}</p>
                  </div>
                </label>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="anexos" className="space-y-3">
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-4">Anexos da Proposta</h3>
              <label className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Arraste documentos ou clique para selecionar</span>
                <span className="text-xs text-muted-foreground/60 mt-1">Proposta comercial, planilhas, atestados, certidões</span>
                <input type="file" multiple className="hidden" />
              </label>
            </Card>
          </TabsContent>

          <TabsContent value="revisao" className="space-y-4">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-sm">Resumo da Proposta</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <Globe className="w-5 h-5 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">Portal</p>
                  <p className="text-sm font-semibold capitalize">{portal === 'comprasgov' ? 'Compras.gov.br' : portal.toUpperCase()}</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <Package className="w-5 h-5 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">Itens</p>
                  <p className="text-sm font-semibold">{itens.length}</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <DollarSign className="w-5 h-5 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-sm font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalProposta)}</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <Shield className="w-5 h-5 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">Declarações</p>
                  <p className="text-sm font-semibold">{Object.values(declaracoes).filter(Boolean).length}/5</p>
                </div>
              </div>

              {/* Warnings */}
              {itens.some(i => !i.descricao || i.valorUnitario <= 0) && (
                <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Há itens incompletos na proposta. Revise antes de enviar.
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-info/10 border border-info/30 rounded-lg text-sm text-info">
                <Clock className="w-4 h-4 flex-shrink-0" />
                A proposta será preparada para envio. Você precisará confirmar no portal oficial.
              </div>

              <Button onClick={handleEnviar} disabled={enviando} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                {enviando ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Preparando envio...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Preparar Proposta para Envio</>
                )}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
