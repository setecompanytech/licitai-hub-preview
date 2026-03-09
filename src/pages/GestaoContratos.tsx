import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText, Plus, Search, Calendar, DollarSign, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, Building2, Loader2, Trash2, Edit
} from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  vigente: { label: 'Vigente', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  vencendo: { label: 'Vencendo', color: 'bg-warning/10 text-warning', icon: AlertTriangle },
  encerrado: { label: 'Encerrado', color: 'bg-muted text-muted-foreground', icon: Clock },
  suspenso: { label: 'Suspenso', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
};

type Contrato = {
  id: string;
  numero_contrato: string;
  objeto: string;
  orgao_contratante: string;
  valor_global: number;
  valor_consumido: number;
  saldo_remanescente: number;
  data_assinatura: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  vigencia_meses: number | null;
  status: string;
  modalidade: string | null;
  uf: string | null;
  municipio: string | null;
  fiscal_nome: string | null;
  fiscal_email: string | null;
  fiscal_telefone: string | null;
  observacoes: string | null;
};

export default function GestaoContratos() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero_contrato: '', objeto: '', orgao_contratante: '',
    valor_global: '', valor_consumido: '0', data_assinatura: '',
    data_inicio: '', data_fim: '', vigencia_meses: '',
    status: 'vigente', modalidade: '', uf: '', municipio: '',
    fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '',
  });

  useEffect(() => {
    if (user) loadContratos();
  }, [user]);

  const loadContratos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contratos')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setContratos((data as any[]) || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.numero_contrato || !form.objeto || !form.orgao_contratante) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('contratos').insert({
      user_id: user!.id,
      numero_contrato: form.numero_contrato,
      objeto: form.objeto,
      orgao_contratante: form.orgao_contratante,
      valor_global: parseFloat(form.valor_global) || 0,
      valor_consumido: parseFloat(form.valor_consumido) || 0,
      data_assinatura: form.data_assinatura || null,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      vigencia_meses: parseInt(form.vigencia_meses) || null,
      status: form.status,
      modalidade: form.modalidade || null,
      uf: form.uf || null,
      municipio: form.municipio || null,
      fiscal_nome: form.fiscal_nome || null,
      fiscal_email: form.fiscal_email || null,
      fiscal_telefone: form.fiscal_telefone || null,
      observacoes: form.observacoes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar contrato'); return; }
    toast.success('Contrato cadastrado com sucesso!');
    setDialogOpen(false);
    setForm({
      numero_contrato: '', objeto: '', orgao_contratante: '',
      valor_global: '', valor_consumido: '0', data_assinatura: '',
      data_inicio: '', data_fim: '', vigencia_meses: '',
      status: 'vigente', modalidade: '', uf: '', municipio: '',
      fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '',
    });
    loadContratos();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contratos').delete().eq('id', id);
    toast.success('Contrato excluído');
    loadContratos();
  };

  const filtered = contratos.filter((c) => {
    const matchSearch = !search || c.objeto.toLowerCase().includes(search.toLowerCase()) ||
      c.numero_contrato.toLowerCase().includes(search.toLowerCase()) ||
      c.orgao_contratante.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalValor = contratos.reduce((s, c) => s + c.valor_global, 0);
  const totalSaldo = contratos.reduce((s, c) => s + (c.saldo_remanescente || 0), 0);
  const vencendo = contratos.filter(c => {
    if (!c.data_fim) return false;
    const diff = (new Date(c.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 60;
  }).length;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe saldos, prazos e aditivos dos seus contratos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Contrato</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Contrato</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Nº Contrato *</Label>
                <Input value={form.numero_contrato} onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))} placeholder="CT-001/2025" />
              </div>
              <div>
                <Label>Órgão Contratante *</Label>
                <Input value={form.orgao_contratante} onChange={e => setForm(f => ({ ...f, orgao_contratante: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Objeto *</Label>
                <Textarea value={form.objeto} onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label>Valor Global (R$)</Label>
                <Input type="number" value={form.valor_global} onChange={e => setForm(f => ({ ...f, valor_global: e.target.value }))} />
              </div>
              <div>
                <Label>Valor Consumido (R$)</Label>
                <Input type="number" value={form.valor_consumido} onChange={e => setForm(f => ({ ...f, valor_consumido: e.target.value }))} />
              </div>
              <div>
                <Label>Data Assinatura</Label>
                <Input type="date" value={form.data_assinatura} onChange={e => setForm(f => ({ ...f, data_assinatura: e.target.value }))} />
              </div>
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
              <div>
                <Label>Vigência (meses)</Label>
                <Input type="number" value={form.vigencia_meses} onChange={e => setForm(f => ({ ...f, vigencia_meses: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="vencendo">Vencendo</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidade</Label>
                <Input value={form.modalidade} onChange={e => setForm(f => ({ ...f, modalidade: e.target.value }))} placeholder="Pregão Eletrônico" />
              </div>
              <div>
                <Label>UF</Label>
                <Input value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} maxLength={2} />
              </div>
              <div>
                <Label>Município</Label>
                <Input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} />
              </div>
              <div>
                <Label>Fiscal - Nome</Label>
                <Input value={form.fiscal_nome} onChange={e => setForm(f => ({ ...f, fiscal_nome: e.target.value }))} />
              </div>
              <div>
                <Label>Fiscal - E-mail</Label>
                <Input value={form.fiscal_email} onChange={e => setForm(f => ({ ...f, fiscal_email: e.target.value }))} />
              </div>
              <div>
                <Label>Fiscal - Telefone</Label>
                <Input value={form.fiscal_telefone} onChange={e => setForm(f => ({ ...f, fiscal_telefone: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Contrato
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-4 h-4" /> Total de Contratos</div>
          <p className="text-2xl font-bold">{contratos.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" /> Valor Total</div>
          <p className="text-2xl font-bold">{formatCurrency(totalValor)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-4 h-4" /> Saldo Total</div>
          <p className="text-2xl font-bold text-success">{formatCurrency(totalSaldo)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="w-4 h-4" /> Vencendo em 60d</div>
          <p className="text-2xl font-bold text-warning">{vencendo}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, objeto ou órgão..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="vigente">Vigente</SelectItem>
            <SelectItem value="vencendo">Vencendo</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum contrato encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre seu primeiro contrato para começar o acompanhamento</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const pct = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
            const cfg = statusConfig[c.status] || statusConfig.vigente;
            const Icon = cfg.icon;
            const diasRestantes = c.data_fim
              ? Math.ceil((new Date(c.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-accent">{c.numero_contrato}</span>
                      <Badge className={`${cfg.color} text-[10px]`}>
                        <Icon className="w-3 h-3 mr-1" />{cfg.label}
                      </Badge>
                      {diasRestantes !== null && diasRestantes <= 60 && diasRestantes > 0 && (
                        <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                          <Clock className="w-3 h-3 mr-1" />{diasRestantes}d restantes
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium line-clamp-2">{c.objeto}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.orgao_contratante}</span>
                      {c.uf && <span>{c.uf}{c.municipio ? `/${c.municipio}` : ''}</span>}
                      {c.data_fim && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Até {new Date(c.data_fim).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Consumido: {formatCurrency(c.valor_consumido)}</span>
                        <span>Saldo: {formatCurrency(c.saldo_remanescente || 0)}</span>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="h-2" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(1)}% do valor global ({formatCurrency(c.valor_global)})</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
