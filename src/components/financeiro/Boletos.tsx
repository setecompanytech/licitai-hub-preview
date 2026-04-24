import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoneyInput } from '@/components/ui/money-input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, CheckCircle2, Clock,
  AlertTriangle, Search, Copy, Barcode, Send, ExternalLink
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Boleto = {
  id: string; numero_documento: string | null; nosso_numero: string | null;
  linha_digitavel: string | null; codigo_barras: string | null;
  valor_nominal: number; data_vencimento: string; data_pagamento: string | null;
  sacado_nome: string | null; sacado_cnpj_cpf: string | null;
  sacado_endereco: string | null; sacado_cidade: string | null;
  sacado_uf: string | null; sacado_cep: string | null;
  status: string; instrucoes: string | null; observacoes: string | null;
  contrato_id: string | null; conta_receber_id: string | null;
  api_response: any;
};

const statusCfg: Record<string, { label: string; color: string }> = {
  emitido: { label: 'Emitido', color: 'bg-accent/10 text-accent' },
  registrado: { label: 'Registrado', color: 'bg-warning/10 text-warning' },
  pago: { label: 'Pago', color: 'bg-success/10 text-success' },
  vencido: { label: 'Vencido', color: 'bg-destructive/10 text-destructive' },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground' },
};

export default function Boletos() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [apiConfigurada, setApiConfigurada] = useState(false);
  const [checkingApi, setCheckingApi] = useState(true);
  const [form, setForm] = useState({
    numero_documento: '', valor_nominal: '', data_vencimento: '',
    sacado_nome: '', sacado_cnpj_cpf: '', sacado_endereco: '',
    sacado_cidade: '', sacado_uf: '', sacado_cep: '',
    instrucoes: '', observacoes: '',
  });

  useEffect(() => { if (user && empresaAtiva) { checkApiStatus(); load(); } }, [user, empresaAtiva]);

  const checkApiStatus = async () => {
    setCheckingApi(true);
    try {
      const { data, error } = await supabase.functions.invoke('emitir-boleto', {
        body: { check: true },
      });
      setApiConfigurada(data?.configured === true && !error);
    } catch {
      setApiConfigurada(false);
    }
    setCheckingApi(false);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('boletos')
      .select('*').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
      .order('data_vencimento', { ascending: false });
    const today = new Date().toISOString().split('T')[0];
    const list = ((data as any[]) || []).map(b => ({
      ...b,
      status: b.status === 'emitido' && b.data_vencimento < today ? 'vencido' : b.status,
    }));
    setBoletos(list);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.valor_nominal || !form.data_vencimento || !form.sacado_nome) {
      toast.error('Preencha valor, vencimento e sacado'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('boletos').insert({
      user_id: user!.id, empresa_id: empresaAtiva!.id,
      numero_documento: form.numero_documento || null,
      valor_nominal: parseFloat(form.valor_nominal) || 0,
      data_vencimento: form.data_vencimento,
      sacado_nome: form.sacado_nome, sacado_cnpj_cpf: form.sacado_cnpj_cpf || null,
      sacado_endereco: form.sacado_endereco || null,
      sacado_cidade: form.sacado_cidade || null, sacado_uf: form.sacado_uf || null,
      sacado_cep: form.sacado_cep || null,
      instrucoes: form.instrucoes || null, observacoes: form.observacoes || null,
      status: 'emitido',
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar boleto'); return; }
    toast.success(apiConfigurada
      ? 'Boleto salvo! Clique em "Registrar" para emiti-lo via Stripe.'
      : 'Boleto registrado localmente.');
    setDialogOpen(false);
    setForm({ numero_documento: '', valor_nominal: '', data_vencimento: '', sacado_nome: '', sacado_cnpj_cpf: '', sacado_endereco: '', sacado_cidade: '', sacado_uf: '', sacado_cep: '', instrucoes: '', observacoes: '' });
    load();
  };

  const handleRegistrar = async (boleto: Boleto) => {
    if (!apiConfigurada) {
      toast.error('Stripe não disponível para emissão de boletos. Verifique a configuração.');
      return;
    }
    setRegistrando(boleto.id);
    try {
      const { data, error } = await supabase.functions.invoke('emitir-boleto', {
        body: {
          boleto_id: boleto.id,
          valor: boleto.valor_nominal,
          vencimento: boleto.data_vencimento,
          sacado_nome: boleto.sacado_nome,
          sacado_cpf_cnpj: boleto.sacado_cnpj_cpf,
          sacado_endereco: boleto.sacado_endereco,
          sacado_cidade: boleto.sacado_cidade,
          sacado_uf: boleto.sacado_uf,
          sacado_cep: boleto.sacado_cep,
          descricao: boleto.instrucoes || `Boleto ${boleto.numero_documento || ''}`,
          numero_documento: boleto.numero_documento,
          empresa_id: empresaAtiva!.id,
        },
      });

      if (error || data?.error) {
        toast.error(`Erro ao registrar boleto: ${data?.error || error?.message || 'Erro desconhecido'}`);
        return;
      }

      if (data?.url_pagamento) {
        toast.success(
          <div className="space-y-1">
            <p className="font-medium">Boleto registrado com sucesso!</p>
            <a href={data.url_pagamento} target="_blank" rel="noopener noreferrer"
              className="text-primary underline text-xs flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Ver boleto
            </a>
          </div>,
          { duration: 10000 }
        );
      } else {
        toast.success('Boleto registrado via Stripe!');
      }
      load();
    } catch (err) {
      toast.error('Falha ao comunicar com o serviço de boletos.');
      console.error('[Boletos] Registro falhou:', err);
    } finally {
      setRegistrando(null);
    }
  };

  const copiarLinha = (linha: string) => {
    navigator.clipboard.writeText(linha);
    toast.success('Linha digitável copiada!');
  };

  const abrirBoleto = (boleto: Boleto) => {
    const url = boleto.api_response?.url_pagamento;
    if (url) window.open(url, '_blank');
    else toast.info('URL do boleto não disponível.');
  };

  const handleDelete = async (id: string) => {
    await supabase.from('boletos').delete().eq('id', id);
    toast.success('Boleto excluído'); load();
  };

  const filtered = boletos.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return b.sacado_nome?.toLowerCase().includes(s) || b.numero_documento?.toLowerCase().includes(s) || b.sacado_cnpj_cpf?.includes(s);
  });

  const totalEmitido = boletos.filter(b => ['emitido', 'registrado'].includes(b.status)).reduce((s, b) => s + b.valor_nominal, 0);
  const totalPago = boletos.filter(b => b.status === 'pago').reduce((s, b) => s + b.valor_nominal, 0);
  const totalVencido = boletos.filter(b => b.status === 'vencido').reduce((s, b) => s + b.valor_nominal, 0);

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;

  return (
    <div className="space-y-4">
      {/* API Status Banner */}
      <Card className={`p-3 ${apiConfigurada ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
        <div className="flex items-center gap-2 text-xs">
          {checkingApi ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : apiConfigurada ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-warning" />
          )}
          <div className="flex-1">
            <span className="font-medium">Stripe Boletos: </span>
            {checkingApi ? (
              <span className="text-muted-foreground">Verificando conexão...</span>
            ) : apiConfigurada ? (
              <span className="text-success">Conectado. Boletos serão emitidos via Stripe.</span>
            ) : (
              <span className="text-muted-foreground">Não disponível. Boletos são registrados apenas localmente.</span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Em aberto</div><p className="text-lg font-bold text-warning">{fmt(totalEmitido)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Pagos</div><p className="text-lg font-bold text-success">{fmt(totalPago)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vencidos</div><p className="text-lg font-bold text-destructive">{fmt(totalVencido)}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por sacado, documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Boleto</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Barcode className="w-5 h-5 text-primary" /> Emitir Boleto</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nº Documento</Label><Input value={form.numero_documento} onChange={e => setForm(f => ({ ...f, numero_documento: e.target.value }))} /></div>
                <div><Label className="text-xs">Valor (R$) *</Label><MoneyInput value={Number(form.valor_nominal) || 0} onValueChange={v => setForm(f => ({ ...f, valor_nominal: String(v) }))} /></div>
              </div>
              <div><Label className="text-xs">Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} /></div>
              <div className="border-t pt-3 mt-2"><p className="text-xs font-semibold mb-2">Dados do Sacado (Pagador)</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome / Razão Social *</Label><Input value={form.sacado_nome} onChange={e => setForm(f => ({ ...f, sacado_nome: e.target.value }))} /></div>
                <div><Label className="text-xs">CNPJ / CPF *</Label><Input value={form.sacado_cnpj_cpf} onChange={e => setForm(f => ({ ...f, sacado_cnpj_cpf: e.target.value }))} placeholder="Obrigatório para Stripe" /></div>
              </div>
              <div><Label className="text-xs">Endereço</Label><Input value={form.sacado_endereco} onChange={e => setForm(f => ({ ...f, sacado_endereco: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Cidade</Label><Input value={form.sacado_cidade} onChange={e => setForm(f => ({ ...f, sacado_cidade: e.target.value }))} /></div>
                <div><Label className="text-xs">UF</Label><Input value={form.sacado_uf} onChange={e => setForm(f => ({ ...f, sacado_uf: e.target.value }))} maxLength={2} /></div>
                <div><Label className="text-xs">CEP</Label><Input value={form.sacado_cep} onChange={e => setForm(f => ({ ...f, sacado_cep: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Instruções</Label><Textarea value={form.instrucoes} onChange={e => setForm(f => ({ ...f, instrucoes: e.target.value }))} rows={2} placeholder="Não receber após vencimento..." /></div>
              <div><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar Boleto</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <Barcode className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          Nenhum boleto emitido
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Sacado</TableHead>
                <TableHead className="text-xs">Documento</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Vencimento</TableHead>
                <TableHead className="text-xs w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(b => {
                const cfg = statusCfg[b.status] || statusCfg.emitido;
                return (
                  <TableRow key={b.id}>
                    <TableCell><Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge></TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium truncate max-w-[150px]">{b.sacado_nome || '—'}</p>
                      {b.sacado_cnpj_cpf && <p className="text-[10px] text-muted-foreground">{b.sacado_cnpj_cpf}</p>}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{b.numero_documento || '—'}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(b.valor_nominal)}</TableCell>
                    <TableCell className="text-xs text-center">{new Date(b.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {b.linha_digitavel && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copiarLinha(b.linha_digitavel!)} title="Copiar linha digitável">
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {b.api_response?.url_pagamento && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirBoleto(b)} title="Ver boleto">
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        )}
                        {b.status === 'emitido' && apiConfigurada && (
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => handleRegistrar(b)}
                            disabled={registrando === b.id}
                            title="Registrar via Stripe">
                            {registrando === b.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Send className="w-3.5 h-3.5 text-accent" />}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(b.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
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
