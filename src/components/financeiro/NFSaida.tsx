import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, FileText, Search, CheckCircle2,
  XCircle, Clock, Send, AlertTriangle, DollarSign,
  Building2, ChevronRight, ChevronLeft, Package, MapPin, Calculator,
  RotateCcw, Eye, ThumbsUp, ThumbsDown, Undo2
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type NotaFiscal = {
  id: string; tipo: string; numero_nf: string | null; serie: string | null;
  chave_acesso: string | null; protocolo_autorizacao: string | null;
  data_emissao: string | null; valor_total: number; valor_produtos: number;
  valor_servicos: number; status: string; destinatario_cnpj: string | null;
  destinatario_razao_social: string | null; natureza_operacao: string | null;
  cfop: string | null; observacoes: string | null; motivo_rejeicao: string | null;
  contrato_id: string | null; contrato_pedido_id: string | null;
  empresa_id: string | null; informacoes_complementares: string | null;
};

const statusCfg: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Clock },
  enviada: { label: 'Enviada', color: 'bg-accent/10 text-accent', icon: Send },
  autorizada: { label: 'Autorizada', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

const preNfStatusCfg: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Aguardando Aprovação', color: 'bg-warning/10 text-warning' },
  em_revisao: { label: 'Em Revisão', color: 'bg-accent/10 text-accent' },
  aprovada: { label: 'Aprovada', color: 'bg-success/10 text-success' },
  rejeitada: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive' },
  devolvida: { label: 'Devolvida ao Comercial', color: 'bg-warning/10 text-warning' },
};

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const CFOPS_SAIDA = [
  { value: '5101', label: '5101 - Venda produção (mesma UF)' },
  { value: '5102', label: '5102 - Venda mercadoria (mesma UF)' },
  { value: '5405', label: '5405 - Venda merc. adq. ST (mesma UF)' },
  { value: '5933', label: '5933 - Prestação de serviço tributado ISS' },
  { value: '5949', label: '5949 - Outra saída não especificada' },
  { value: '6101', label: '6101 - Venda produção (outra UF)' },
  { value: '6102', label: '6102 - Venda mercadoria (outra UF)' },
  { value: '6949', label: '6949 - Outra saída não especif. (outra UF)' },
];

const NATUREZAS = [
  'Venda de mercadoria',
  'Venda de produção',
  'Prestação de serviço',
  'Devolução de compra',
  'Remessa para conserto',
  'Transferência de mercadoria',
  'Outra saída',
];

type NFItem = {
  key: string; descricao: string; ncm: string; cfop: string;
  unidade: string; quantidade: string; valor_unitario: string;
  origem: string; cst_icms: string; cst_pis: string; cst_cofins: string;
};

export default function NFSaida() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [preNotas, setPreNotas] = useState<any[]>([]);
  const [preNotaItens, setPreNotaItens] = useState<Record<string, any[]>>({});
  const [preNotaExpanded, setPreNotaExpanded] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<{ id: string; action: string } | null>(null);
  const [reviewMotivo, setReviewMotivo] = useState('');
  // Wizard step
  const [step, setStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  // Form data
  const [form, setForm] = useState({
    tipo: 'nfe',
    serie: '1',
    natureza_operacao: '',
    cfop: '',
    finalidade: '1', // 1-Normal, 2-Complementar, 3-Ajuste, 4-Devolução
    indicador_consumidor_final: true,
    indicador_presenca: '1', // 1-Presencial, 2-Internet, 9-Outros
    // Destinatário
    dest_cnpj_cpf: '',
    dest_razao_social: '',
    dest_ie: '',
    dest_endereco: '',
    dest_numero: '',
    dest_bairro: '',
    dest_municipio: '',
    dest_uf: '',
    dest_cep: '',
    dest_telefone: '',
    dest_email: '',
    dest_contribuinte_icms: 'nao', // sim, isento, nao
    // Contrato vinculado
    contrato_id: '',
    // Observações
    informacoes_complementares: '',
    observacoes_internas: '',
    // Frete
    frete_modalidade: '9', // 0-Emitente, 1-Dest, 2-Terceiros, 9-Sem
    frete_valor: '0',
    // Pagamento
    forma_pagamento: '0', // 0-Dinheiro, 1-Cheque, 3-Cartão Crédito, etc
    condicao_pagamento: '0', // 0-À Vista, 1-A Prazo
  });

  const [nfItens, setNfItens] = useState<NFItem[]>([]);

  // Contratos for linking
  const [contratos, setContratos] = useState<{id: string; numero_contrato: string; orgao_contratante: string; valor_global: number}[]>([]);

  useEffect(() => { if (user && empresaAtiva) loadAll(); }, [user, empresaAtiva]);

  const loadAll = async () => {
    setLoading(true);
    const [notasRes, contratosRes, configRes, preNotasRes] = await Promise.all([
      supabase.from('notas_fiscais').select('*').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).order('created_at', { ascending: false }),
      supabase.from('contratos').select('id, numero_contrato, orgao_contratante, valor_global').eq('user_id', user!.id).eq('status', 'vigente'),
      supabase.from('nuvem_fiscal_config_safe' as any).select('ativo').eq('empresa_id', empresaAtiva!.id).eq('user_id', user!.id).maybeSingle(),
      supabase.from('pre_notas_fiscais' as any).select('*, contratos(numero_contrato, orgao_contratante)').eq('empresa_id', empresaAtiva!.id).in('status', ['pendente', 'em_revisao']).order('created_at', { ascending: false }),
    ]);
    setNotas((notasRes.data as any[]) || []);
    setContratos((contratosRes.data as any[]) || []);
    setApiConfigured(!!configRes.data?.ativo);
    setPreNotas((preNotasRes.data as any[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      tipo: 'nfe', serie: '1', natureza_operacao: '', cfop: '', finalidade: '1',
      indicador_consumidor_final: true, indicador_presenca: '1',
      dest_cnpj_cpf: '', dest_razao_social: '', dest_ie: '', dest_endereco: '',
      dest_numero: '', dest_bairro: '', dest_municipio: '', dest_uf: '', dest_cep: '',
      dest_telefone: '', dest_email: '', dest_contribuinte_icms: 'nao',
      contrato_id: '', informacoes_complementares: '', observacoes_internas: '',
      frete_modalidade: '9', frete_valor: '0',
      forma_pagamento: '0', condicao_pagamento: '0',
    });
    setNfItens([]);
    setStep(0);
    setStepErrors([]);
  };

  // ── Step validation (SEBRAE-style) ──
  const STEPS = [
    { title: 'Operação', icon: FileText },
    { title: 'Destinatário', icon: Building2 },
    { title: 'Produtos/Serviços', icon: Package },
    { title: 'Transporte e Pagamento', icon: MapPin },
    { title: 'Revisão', icon: CheckCircle2 },
  ];

  const validateStep = (stepIdx: number): string[] => {
    const errors: string[] = [];
    switch (stepIdx) {
      case 0: // Operação
        if (!form.natureza_operacao) errors.push('Natureza da Operação é obrigatória');
        if (!form.cfop) errors.push('CFOP é obrigatório');
        if (!form.serie) errors.push('Série é obrigatória');
        break;
      case 1: // Destinatário
        if (!form.dest_cnpj_cpf) errors.push('CNPJ/CPF do destinatário é obrigatório');
        if (!form.dest_razao_social) errors.push('Razão Social / Nome é obrigatório');
        if (!form.dest_uf) errors.push('UF do destinatário é obrigatória');
        if (!form.dest_municipio) errors.push('Município é obrigatório');
        if (!form.dest_endereco) errors.push('Endereço é obrigatório');
        if (!form.dest_cep) errors.push('CEP é obrigatório');
        if (form.dest_cnpj_cpf.replace(/\D/g, '').length !== 11 && form.dest_cnpj_cpf.replace(/\D/g, '').length !== 14) {
          errors.push('CNPJ deve ter 14 dígitos ou CPF 11 dígitos');
        }
        if (form.dest_contribuinte_icms === 'sim' && !form.dest_ie) {
          errors.push('IE é obrigatória para contribuinte ICMS');
        }
        break;
      case 2: // Itens
        if (nfItens.length === 0) errors.push('Adicione pelo menos um item');
        nfItens.forEach((item, idx) => {
          if (!item.descricao) errors.push(`Item ${idx + 1}: Descrição obrigatória`);
          if (form.tipo === 'nfe' && !item.ncm) errors.push(`Item ${idx + 1}: NCM obrigatório para NF-e`);
          if (!item.quantidade || parseFloat(item.quantidade) <= 0) errors.push(`Item ${idx + 1}: Quantidade inválida`);
          if (!item.valor_unitario || parseFloat(item.valor_unitario) <= 0) errors.push(`Item ${idx + 1}: Valor unitário inválido`);
        });
        break;
      case 3: // Transporte/Pagamento
        if (!form.frete_modalidade) errors.push('Modalidade de frete é obrigatória');
        if (!form.forma_pagamento) errors.push('Forma de pagamento é obrigatória');
        break;
    }
    return errors;
  };

  const goNextStep = () => {
    const errors = validateStep(step);
    setStepErrors(errors);
    if (errors.length > 0) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const addItem = () => {
    setNfItens(prev => [...prev, {
      key: crypto.randomUUID(), descricao: '', ncm: '', cfop: form.cfop || '5102',
      unidade: 'UN', quantidade: '1', valor_unitario: '0',
      origem: '0', cst_icms: '102', cst_pis: '49', cst_cofins: '49',
    }]);
  };

  const updateItem = (key: string, field: string, value: string) =>
    setNfItens(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));

  const removeItem = (key: string) => setNfItens(prev => prev.filter(i => i.key !== key));

  const totalItens = nfItens.reduce((s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.valor_unitario) || 0), 0);

  const handleSaveNF = async () => {
    // Final validation
    for (let s = 0; s < 4; s++) {
      const errs = validateStep(s);
      if (errs.length > 0) {
        setStep(s);
        setStepErrors(errs);
        toast.error(`Corrija os erros na etapa "${STEPS[s].title}"`);
        return;
      }
    }

    setSaving(true);
    const { data: nf, error } = await supabase.from('notas_fiscais').insert({
      user_id: user!.id,
      empresa_id: empresaAtiva!.id,
      contrato_id: form.contrato_id || null,
      tipo: form.tipo,
      serie: form.serie,
      natureza_operacao: form.natureza_operacao,
      cfop: form.cfop,
      destinatario_cnpj: form.dest_cnpj_cpf || null,
      destinatario_razao_social: form.dest_razao_social || null,
      destinatario_endereco: `${form.dest_endereco}, ${form.dest_numero} - ${form.dest_bairro}`,
      destinatario_uf: form.dest_uf || null,
      destinatario_municipio: form.dest_municipio || null,
      destinatario_ie: form.dest_ie || null,
      valor_total: totalItens + (parseFloat(form.frete_valor) || 0),
      valor_produtos: form.tipo === 'nfe' ? totalItens : 0,
      valor_servicos: form.tipo === 'nfse' ? totalItens : 0,
      status: 'rascunho',
      observacoes: form.observacoes_internas || null,
      informacoes_complementares: form.informacoes_complementares || null,
    } as any).select('id').single();

    if (error || !nf) {
      toast.error('Erro ao criar nota fiscal');
      setSaving(false);
      return;
    }

    // Insert items
    const itensInsert = nfItens.map((item, idx) => ({
      nota_fiscal_id: nf.id,
      numero_item: idx + 1,
      descricao: item.descricao,
      ncm: item.ncm || null,
      cfop: item.cfop || null,
      unidade: item.unidade,
      quantidade: parseFloat(item.quantidade) || 0,
      valor_unitario: parseFloat(item.valor_unitario) || 0,
      valor_total: (parseFloat(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0),
    }));

    await supabase.from('nota_fiscal_itens').insert(itensInsert as any);

    setSaving(false);
    toast.success('NF criada como rascunho. Revise e envie para autorização.');
    setDialogOpen(false);
    resetForm();
    loadAll();
  };

  const handleEnviarNF = async (nfId: string) => {
    if (!apiConfigured) {
      toast.error('Configure a API Nuvem Fiscal nas configurações para enviar.');
      return;
    }
    toast.info('Enviando NF para autorização...');
    const { data, error } = await supabase.functions.invoke('emissao-nf', {
      body: { action: 'emitir', nota_fiscal_id: nfId },
    });
    if (error || data?.error) { toast.error(data?.error || 'Erro ao enviar NF'); return; }
    toast.success('NF enviada para autorização!');
    loadAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('notas_fiscais').delete().eq('id', id);
    toast.success('Nota fiscal excluída');
    loadAll();
  };

  const filteredNotas = notas.filter(n => {
    if (statusFilter !== 'all' && n.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (n.numero_nf?.toLowerCase().includes(s) || n.destinatario_razao_social?.toLowerCase().includes(s) || n.destinatario_cnpj?.includes(s));
    }
    return true;
  });

  const totalEmitido = notas.filter(n => n.status === 'autorizada').reduce((s, n) => s + n.valor_total, 0);
  const totalPendente = notas.filter(n => ['rascunho', 'enviada'].includes(n.status)).reduce((s, n) => s + n.valor_total, 0);

  const loadPreNotaItens = async (preNotaId: string) => {
    if (preNotaItens[preNotaId]) return;
    const { data } = await supabase.from('pre_nota_itens' as any).select('*').eq('pre_nota_id', preNotaId);
    setPreNotaItens(prev => ({ ...prev, [preNotaId]: (data as any[]) || [] }));
  };

  const handlePreNotaAction = async (preNotaId: string, action: 'aprovar' | 'rejeitar' | 'devolver' | 'em_revisao') => {
    if ((action === 'rejeitar' || action === 'devolver') && !reviewMotivo.trim()) {
      toast.error(`Informe o motivo para ${action === 'rejeitar' ? 'rejeição' : 'devolução'}`);
      return;
    }

    const updates: any = { revisado_por: user!.id, data_revisao: new Date().toISOString() };
    if (action === 'aprovar') updates.status = 'aprovada';
    else if (action === 'rejeitar') { updates.status = 'rejeitada'; updates.motivo_rejeicao = reviewMotivo; }
    else if (action === 'devolver') { updates.status = 'devolvida'; updates.motivo_devolucao = reviewMotivo; }
    else if (action === 'em_revisao') updates.status = 'em_revisao';

    const { error } = await supabase.from('pre_notas_fiscais' as any).update(updates).eq('id', preNotaId);
    if (error) { toast.error('Erro ao processar ação'); return; }

    toast.success(
      action === 'aprovar' ? 'Pré-NF aprovada! Prossiga com a emissão da NF-e.' :
      action === 'rejeitar' ? 'Pré-NF rejeitada. O comercial será notificado.' :
      action === 'devolver' ? 'Pré-NF devolvida ao comercial para correção.' :
      'Pré-NF marcada como em revisão.'
    );
    setReviewAction(null);
    setReviewMotivo('');
    setPreNotaExpanded(null);
    loadAll();
  };

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Total NFs Saída</div><p className="text-lg font-bold">{notas.length}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Autorizadas</div><p className="text-lg font-bold text-success">{fmt(totalEmitido)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Pendentes</div><p className="text-lg font-bold text-warning">{fmt(totalPendente)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> API</div>
          {apiConfigured
            ? <Badge className="bg-success/10 text-success text-[10px] mt-1"><CheckCircle2 className="w-3 h-3 mr-1" /> Ativa</Badge>
            : <Badge variant="outline" className="text-[10px] text-warning mt-1"><AlertTriangle className="w-3 h-3 mr-1" /> Não config.</Badge>}
        </Card>
      </div>

      {/* Pré-NFs Pendentes do Comercial */}
      {preNotas.length > 0 && (
        <Card className="p-4 border-warning/30 bg-warning/5">
          <h4 className="text-xs font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Pré-Notas Fiscais Aguardando Aprovação
            <Badge className="bg-warning/20 text-warning text-[10px]">{preNotas.length}</Badge>
          </h4>
          <div className="space-y-2">
            {preNotas.map((pn: any) => {
              const st = preNfStatusCfg[pn.status] || preNfStatusCfg.pendente;
              const isExpanded = preNotaExpanded === pn.id;
              const contrato = pn.contratos;
              return (
                <Card key={pn.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                      <span className="text-xs font-medium">{pn.natureza_operacao}</span>
                      {contrato && <span className="text-[10px] text-muted-foreground">Contrato: {contrato.numero_contrato} — {contrato.orgao_contratante}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">{fmt(pn.valor_total)}</span>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => {
                        setPreNotaExpanded(isExpanded ? null : pn.id);
                        if (!isExpanded) loadPreNotaItens(pn.id);
                      }}>
                        <Eye className="w-3 h-3 mr-1" /> {isExpanded ? 'Fechar' : 'Detalhes'}
                      </Button>
                    </div>
                  </div>

                  {pn.observacoes && <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2">💬 {pn.observacoes}</p>}
                  {pn.justificativa && <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2">📋 {pn.justificativa}</p>}

                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t">
                      {/* Itens */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1">ITENS DA PRÉ-NF</p>
                        {(preNotaItens[pn.id] || []).length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">Carregando itens...</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[10px]">Descrição</TableHead>
                                <TableHead className="text-[10px] text-right">Qtd</TableHead>
                                <TableHead className="text-[10px]">Und</TableHead>
                                <TableHead className="text-[10px] text-right">Unit.</TableHead>
                                <TableHead className="text-[10px] text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(preNotaItens[pn.id] || []).map((item: any) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-[10px]">{item.descricao}</TableCell>
                                  <TableCell className="text-[10px] text-right">{item.quantidade}</TableCell>
                                  <TableCell className="text-[10px]">{item.unidade}</TableCell>
                                  <TableCell className="text-[10px] text-right">{fmt(item.valor_unitario)}</TableCell>
                                  <TableCell className="text-[10px] text-right font-medium">{fmt(item.valor_total)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>

                      {/* Transporte */}
                      {(pn.frete_modalidade !== '9' || pn.transportadora || pn.endereco_entrega) && (
                        <div className="text-[11px] space-y-1">
                          <p className="font-semibold text-muted-foreground">TRANSPORTE</p>
                          {pn.frete_modalidade !== '9' && <p>Frete: {pn.frete_modalidade === '0' ? 'Emitente' : pn.frete_modalidade === '1' ? 'Destinatário' : 'Terceiros'} — {fmt(pn.frete_valor || 0)}</p>}
                          {pn.transportadora && <p>Transportadora: {pn.transportadora}</p>}
                          {pn.endereco_entrega && <p>Entrega: {pn.endereco_entrega}</p>}
                        </div>
                      )}

                      {/* Review action dialog */}
                      {reviewAction?.id === pn.id ? (
                        <div className="p-3 rounded bg-muted/50 border space-y-2">
                          <p className="text-xs font-medium">
                            {reviewAction.action === 'rejeitar' ? '❌ Motivo da Rejeição' : '↩️ Motivo da Devolução'}
                          </p>
                          <Textarea value={reviewMotivo} onChange={e => setReviewMotivo(e.target.value)} rows={2} placeholder="Informe o motivo..." className="text-xs" />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setReviewAction(null); setReviewMotivo(''); }}>Cancelar</Button>
                            <Button size="sm" variant="destructive" onClick={() => handlePreNotaAction(pn.id, reviewAction.action as any)}>
                              Confirmar {reviewAction.action === 'rejeitar' ? 'Rejeição' : 'Devolução'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {pn.status === 'pendente' && (
                            <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => handlePreNotaAction(pn.id, 'em_revisao')}>
                              <Eye className="w-3 h-3 mr-1" /> Iniciar Revisão
                            </Button>
                          )}
                          <Button size="sm" className="text-[10px] h-7 bg-success hover:bg-success/90 text-success-foreground" onClick={() => handlePreNotaAction(pn.id, 'aprovar')}>
                            <ThumbsUp className="w-3 h-3 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="text-[10px] h-7 text-destructive border-destructive/30" onClick={() => setReviewAction({ id: pn.id, action: 'rejeitar' })}>
                            <ThumbsDown className="w-3 h-3 mr-1" /> Rejeitar
                          </Button>
                          <Button size="sm" variant="outline" className="text-[10px] h-7 text-warning border-warning/30" onClick={() => setReviewAction({ id: pn.id, action: 'devolver' })}>
                            <Undo2 className="w-3 h-3 mr-1" /> Devolver
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar NF por número, destinatário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Emitir NF-e/NFS-e</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Emissão de Nota Fiscal — Passo a Passo
              </DialogTitle>
            </DialogHeader>

            {/* ── Step indicator ── */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
              {STEPS.map((s, idx) => {
                const StepIcon = s.icon;
                const isActive = idx === step;
                const isDone = idx < step;
                return (
                  <button key={idx} onClick={() => { if (idx < step) setStep(idx); }} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                    <StepIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{s.title}</span>
                    <span className="sm:hidden">{idx + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Validation errors */}
            {stepErrors.length > 0 && (
              <Card className="p-3 border-destructive/30 bg-destructive/5 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    {stepErrors.map((e, i) => <p key={i} className="text-destructive">{e}</p>)}
                  </div>
                </div>
              </Card>
            )}

            {/* ── Step 0: Operação ── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Tipo de NF <span className="text-destructive">*</span></Label>
                    <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nfe">NF-e (Produtos)</SelectItem>
                        <SelectItem value="nfse">NFS-e (Serviços)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Finalidade <span className="text-destructive">*</span></Label>
                    <Select value={form.finalidade} onValueChange={v => setForm(f => ({ ...f, finalidade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Normal</SelectItem>
                        <SelectItem value="2">Complementar</SelectItem>
                        <SelectItem value="3">Ajuste</SelectItem>
                        <SelectItem value="4">Devolução</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Natureza da Operação <span className="text-destructive">*</span></Label>
                    <Select value={form.natureza_operacao} onValueChange={v => setForm(f => ({ ...f, natureza_operacao: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {NATUREZAS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">CFOP <span className="text-destructive">*</span></Label>
                    <Select value={form.cfop} onValueChange={v => setForm(f => ({ ...f, cfop: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione o CFOP..." /></SelectTrigger>
                      <SelectContent>
                        {CFOPS_SAIDA.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Série <span className="text-destructive">*</span></Label>
                    <Input value={form.serie} onChange={e => setForm(f => ({ ...f, serie: e.target.value }))} placeholder="1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Indicador de Presença</Label>
                    <Select value={form.indicador_presenca} onValueChange={v => setForm(f => ({ ...f, indicador_presenca: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Presencial</SelectItem>
                        <SelectItem value="2">Internet</SelectItem>
                        <SelectItem value="3">Teleatendimento</SelectItem>
                        <SelectItem value="9">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Vincular ao Contrato</Label>
                    <Select value={form.contrato_id} onValueChange={v => setForm(f => ({ ...f, contrato_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                      <SelectContent>
                        {contratos.map(c => <SelectItem key={c.id} value={c.id}>{c.numero_contrato} — {c.orgao_contratante}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                  <Checkbox checked={form.indicador_consumidor_final} onCheckedChange={(v) => setForm(f => ({ ...f, indicador_consumidor_final: !!v }))} id="consumidor-final" />
                  <Label htmlFor="consumidor-final" className="text-xs cursor-pointer">Consumidor Final</Label>
                </div>
              </div>
            )}

            {/* ── Step 1: Destinatário ── */}
            {step === 1 && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-primary" /> Dados do Destinatário</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">CNPJ / CPF <span className="text-destructive">*</span></Label>
                    <Input value={form.dest_cnpj_cpf} onChange={e => setForm(f => ({ ...f, dest_cnpj_cpf: e.target.value.replace(/[^\d./-]/g, '') }))} placeholder="00.000.000/0001-00" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{form.dest_cnpj_cpf.replace(/\D/g, '').length} dígitos</p>
                  </div>
                  <div>
                    <Label className="text-xs">Razão Social / Nome <span className="text-destructive">*</span></Label>
                    <Input value={form.dest_razao_social} onChange={e => setForm(f => ({ ...f, dest_razao_social: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Contribuinte ICMS <span className="text-destructive">*</span></Label>
                    <Select value={form.dest_contribuinte_icms} onValueChange={v => setForm(f => ({ ...f, dest_contribuinte_icms: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Contribuinte</SelectItem>
                        <SelectItem value="isento">Isento</SelectItem>
                        <SelectItem value="nao">Não Contribuinte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Inscrição Estadual {form.dest_contribuinte_icms === 'sim' && <span className="text-destructive">*</span>}</Label>
                    <Input value={form.dest_ie} onChange={e => setForm(f => ({ ...f, dest_ie: e.target.value }))} placeholder="Inscrição Estadual" />
                  </div>
                  <div>
                    <Label className="text-xs">E-mail</Label>
                    <Input type="email" value={form.dest_email} onChange={e => setForm(f => ({ ...f, dest_email: e.target.value }))} />
                  </div>
                </div>
                <Separator />
                <h4 className="text-xs font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary" /> Endereço do Destinatário</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Logradouro <span className="text-destructive">*</span></Label>
                    <Input value={form.dest_endereco} onChange={e => setForm(f => ({ ...f, dest_endereco: e.target.value }))} placeholder="Rua, Av..." />
                  </div>
                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input value={form.dest_numero} onChange={e => setForm(f => ({ ...f, dest_numero: e.target.value }))} placeholder="S/N" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input value={form.dest_bairro} onChange={e => setForm(f => ({ ...f, dest_bairro: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Município <span className="text-destructive">*</span></Label>
                    <Input value={form.dest_municipio} onChange={e => setForm(f => ({ ...f, dest_municipio: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">UF <span className="text-destructive">*</span></Label>
                    <Select value={form.dest_uf} onValueChange={v => setForm(f => ({ ...f, dest_uf: v }))}>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">CEP <span className="text-destructive">*</span></Label>
                    <Input value={form.dest_cep} onChange={e => setForm(f => ({ ...f, dest_cep: e.target.value.replace(/\D/g, '').slice(0, 8) }))} placeholder="00000-000" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={form.dest_telefone} onChange={e => setForm(f => ({ ...f, dest_telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
              </div>
            )}

            {/* ── Step 2: Itens ── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1"><Package className="w-3.5 h-3.5 text-primary" /> Produtos / Serviços</h4>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Adicionar Item</Button>
                </div>
                {nfItens.length === 0 ? (
                  <Card className="p-6 text-center text-xs text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    Nenhum item adicionado. Clique em "Adicionar Item" para iniciar.
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {nfItens.map((item, idx) => (
                      <Card key={item.key} className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">Item {idx + 1}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(item.key)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <Label className="text-[10px]">Descrição <span className="text-destructive">*</span></Label>
                            <Input className="text-xs h-8" value={item.descricao} onChange={e => updateItem(item.key, 'descricao', e.target.value)} placeholder="Nome do produto/serviço" />
                          </div>
                          <div>
                            <Label className="text-[10px]">NCM {form.tipo === 'nfe' && <span className="text-destructive">*</span>}</Label>
                            <Input className="text-xs h-8" value={item.ncm} onChange={e => updateItem(item.key, 'ncm', e.target.value)} placeholder="0000.00.00" />
                          </div>
                          <div>
                            <Label className="text-[10px]">CFOP</Label>
                            <Select value={item.cfop} onValueChange={v => updateItem(item.key, 'cfop', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{CFOPS_SAIDA.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          <div>
                            <Label className="text-[10px]">Unidade</Label>
                            <Select value={item.unidade} onValueChange={v => updateItem(item.key, 'unidade', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['UN','KG','LT','MT','M2','M3','CX','PC','PAR','JG','TON','HR','DZ'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Quantidade <span className="text-destructive">*</span></Label>
                            <Input className="text-xs h-8" type="number" step="0.001" value={item.quantidade} onChange={e => updateItem(item.key, 'quantidade', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Valor Unit. <span className="text-destructive">*</span></Label>
                            <Input className="text-xs h-8" type="number" step="0.01" value={item.valor_unitario} onChange={e => updateItem(item.key, 'valor_unitario', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Origem</Label>
                            <Select value={item.origem} onValueChange={v => updateItem(item.key, 'origem', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0 - Nacional</SelectItem>
                                <SelectItem value="1">1 - Estrangeira (Import. direta)</SelectItem>
                                <SelectItem value="2">2 - Estrangeira (merc. interna)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Total</Label>
                            <p className="text-xs font-bold h-8 flex items-center">{fmt((parseFloat(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0))}</p>
                          </div>
                        </div>
                        {form.tipo === 'nfe' && (
                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
                            <div>
                              <Label className="text-[10px]">CST ICMS</Label>
                              <Select value={item.cst_icms} onValueChange={v => updateItem(item.key, 'cst_icms', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="102">102 - Trib. SN sem crédito</SelectItem>
                                  <SelectItem value="103">103 - SN isento</SelectItem>
                                  <SelectItem value="300">300 - SN imune</SelectItem>
                                  <SelectItem value="00">00 - Tributado integralmente</SelectItem>
                                  <SelectItem value="10">10 - Trib. com ST</SelectItem>
                                  <SelectItem value="40">40 - Isento</SelectItem>
                                  <SelectItem value="41">41 - Não tributado</SelectItem>
                                  <SelectItem value="60">60 - ICMS cobrado ST</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px]">CST PIS</Label>
                              <Select value={item.cst_pis} onValueChange={v => updateItem(item.key, 'cst_pis', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="49">49 - Outras operações saída</SelectItem>
                                  <SelectItem value="01">01 - Op. tributável</SelectItem>
                                  <SelectItem value="06">06 - Alíquota zero</SelectItem>
                                  <SelectItem value="07">07 - Isenta</SelectItem>
                                  <SelectItem value="99">99 - Outras operações</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px]">CST COFINS</Label>
                              <Select value={item.cst_cofins} onValueChange={v => updateItem(item.key, 'cst_cofins', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="49">49 - Outras operações saída</SelectItem>
                                  <SelectItem value="01">01 - Op. tributável</SelectItem>
                                  <SelectItem value="06">06 - Alíquota zero</SelectItem>
                                  <SelectItem value="07">07 - Isenta</SelectItem>
                                  <SelectItem value="99">99 - Outras operações</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                    <Card className="p-3 bg-primary/5 border-primary/20">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">Total dos Itens</span>
                        <span className="text-lg font-bold text-primary">{fmt(totalItens)}</span>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Transporte e Pagamento ── */}
            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary" /> Transporte</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Modalidade de Frete <span className="text-destructive">*</span></Label>
                    <Select value={form.frete_modalidade} onValueChange={v => setForm(f => ({ ...f, frete_modalidade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - Por conta do Emitente</SelectItem>
                        <SelectItem value="1">1 - Por conta do Destinatário</SelectItem>
                        <SelectItem value="2">2 - Por conta de Terceiros</SelectItem>
                        <SelectItem value="9">9 - Sem frete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Valor do Frete (R$)</Label>
                    <Input type="number" step="0.01" value={form.frete_valor} onChange={e => setForm(f => ({ ...f, frete_valor: e.target.value }))} />
                  </div>
                </div>
                <Separator />
                <h4 className="text-xs font-semibold flex items-center gap-1"><Calculator className="w-3.5 h-3.5 text-primary" /> Pagamento</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Forma de Pagamento <span className="text-destructive">*</span></Label>
                    <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Dinheiro</SelectItem>
                        <SelectItem value="1">Cheque</SelectItem>
                        <SelectItem value="2">Cartão de Débito</SelectItem>
                        <SelectItem value="3">Cartão de Crédito</SelectItem>
                        <SelectItem value="5">Crédito Loja</SelectItem>
                        <SelectItem value="10">Vale Alimentação</SelectItem>
                        <SelectItem value="15">Boleto Bancário</SelectItem>
                        <SelectItem value="16">Depósito Bancário</SelectItem>
                        <SelectItem value="17">PIX</SelectItem>
                        <SelectItem value="99">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Condição</Label>
                    <Select value={form.condicao_pagamento} onValueChange={v => setForm(f => ({ ...f, condicao_pagamento: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">À Vista</SelectItem>
                        <SelectItem value="1">A Prazo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <h4 className="text-xs font-semibold">Informações Complementares</h4>
                <Textarea value={form.informacoes_complementares} onChange={e => setForm(f => ({ ...f, informacoes_complementares: e.target.value }))} rows={3} placeholder="Informações que aparecerão na DANFE (ex: regime tributário, contrato vinculado...)" />
                <div>
                  <Label className="text-xs">Observações Internas (não aparece na DANFE)</Label>
                  <Textarea value={form.observacoes_internas} onChange={e => setForm(f => ({ ...f, observacoes_internas: e.target.value }))} rows={2} />
                </div>
              </div>
            )}

            {/* ── Step 4: Revisão ── */}
            {step === 4 && (
              <div className="space-y-4">
                <Card className="p-4 bg-success/5 border-success/20">
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-success" /> Revisão da Nota Fiscal</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <p className="font-semibold text-muted-foreground">OPERAÇÃO</p>
                      <p>Tipo: <strong>{form.tipo === 'nfe' ? 'NF-e (Produtos)' : 'NFS-e (Serviços)'}</strong></p>
                      <p>Natureza: <strong>{form.natureza_operacao}</strong></p>
                      <p>CFOP: <strong>{form.cfop}</strong></p>
                      <p>Série: <strong>{form.serie}</strong></p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-muted-foreground">DESTINATÁRIO</p>
                      <p><strong>{form.dest_razao_social}</strong></p>
                      <p>CNPJ/CPF: {form.dest_cnpj_cpf}</p>
                      <p>{form.dest_endereco}, {form.dest_numero} — {form.dest_municipio}/{form.dest_uf}</p>
                      <p>CEP: {form.dest_cep}</p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="text-xs">
                    <p className="font-semibold text-muted-foreground mb-2">ITENS ({nfItens.length})</p>
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">#</TableHead>
                            <TableHead className="text-[10px]">Descrição</TableHead>
                            <TableHead className="text-[10px]">NCM</TableHead>
                            <TableHead className="text-[10px] text-right">Qtd</TableHead>
                            <TableHead className="text-[10px] text-right">Unit.</TableHead>
                            <TableHead className="text-[10px] text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nfItens.map((item, idx) => (
                            <TableRow key={item.key}>
                              <TableCell className="text-[10px]">{idx + 1}</TableCell>
                              <TableCell className="text-[10px] max-w-[200px] truncate">{item.descricao}</TableCell>
                              <TableCell className="text-[10px] font-mono">{item.ncm || '—'}</TableCell>
                              <TableCell className="text-[10px] text-right">{item.quantidade}</TableCell>
                              <TableCell className="text-[10px] text-right">{fmt(parseFloat(item.valor_unitario) || 0)}</TableCell>
                              <TableCell className="text-[10px] text-right font-medium">{fmt((parseFloat(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between items-center text-xs">
                    <span>Frete: {fmt(parseFloat(form.frete_valor) || 0)}</span>
                    <span>Pgto: {form.forma_pagamento === '17' ? 'PIX' : form.forma_pagamento === '15' ? 'Boleto' : form.forma_pagamento === '0' ? 'Dinheiro' : 'Outro'}</span>
                    <span className="text-base font-bold text-primary">Total: {fmt(totalItens + (parseFloat(form.frete_valor) || 0))}</span>
                  </div>
                </Card>
              </div>
            )}

            {/* ── Navigation ── */}
            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" onClick={() => { if (step === 0) { setDialogOpen(false); resetForm(); } else setStep(s => s - 1); }}>
                <ChevronLeft className="w-4 h-4 mr-1" /> {step === 0 ? 'Cancelar' : 'Voltar'}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={goNextStep}>
                  Próximo <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSaveNF} disabled={saving} className="bg-success hover:bg-success/90 text-success-foreground">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  Salvar Rascunho
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* NF List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filteredNotas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          Nenhuma nota fiscal de saída encontrada
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Número</TableHead>
                <TableHead className="text-xs">Destinatário</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
                <TableHead className="text-xs w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotas.map(nf => {
                const cfg = statusCfg[nf.status] || statusCfg.rascunho;
                const Icon = cfg.icon;
                return (
                  <TableRow key={nf.id}>
                    <TableCell><Badge className={`${cfg.color} text-[10px]`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge></TableCell>
                    <TableCell className="text-xs">{nf.tipo === 'nfse' ? 'NFS-e' : 'NF-e'}</TableCell>
                    <TableCell className="text-xs font-mono">{nf.numero_nf || '—'}</TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium truncate max-w-[180px]">{nf.destinatario_razao_social || '—'}</p>
                      {nf.destinatario_cnpj && <p className="text-[10px] text-muted-foreground">{nf.destinatario_cnpj}</p>}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(nf.valor_total)}</TableCell>
                    <TableCell className="text-xs text-center">{nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {nf.status === 'rascunho' && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleEnviarNF(nf.id)}>
                            <Send className="w-3 h-3 mr-1" /> Enviar
                          </Button>
                        )}
                        {['rascunho', 'rejeitada'].includes(nf.status) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(nf.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
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
