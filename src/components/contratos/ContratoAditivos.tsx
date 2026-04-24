import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Loader2, FilePlus2, DollarSign, Calendar, Package, Layers
} from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtQty = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

const TIPOS_ADITIVO: Record<string, { label: string; icon: typeof DollarSign; color: string }> = {
  valor: { label: 'Valor', icon: DollarSign, color: 'bg-success/10 text-success' },
  quantidade: { label: 'Quantidade', icon: Package, color: 'bg-accent/10 text-accent' },
  valor_quantidade: { label: 'Valor e Qtde', icon: Layers, color: 'bg-blue-500/10 text-blue-600' },
  prazo: { label: 'Prazo', icon: Calendar, color: 'bg-warning/10 text-warning' },
  escopo: { label: 'Escopo', icon: FilePlus2, color: 'bg-primary/10 text-primary' },
};

type Aditivo = {
  id: string;
  contrato_id: string;
  numero_aditivo: string;
  tipo: string;
  referencia_tipo?: 'contrato' | 'ata_srp' | null;
  valor_acrescimo: number;
  valor_supressao: number;
  valor_aditivo: number;
  quantidade_acrescimo: number;
  quantidade_supressao: number;
  nova_data_fim: string | null;
  data_assinatura: string | null;
  data_aditivo: string | null;
  justificativa: string | null;
  observacoes: string | null;
  created_at: string;
};

type DocAlvo = {
  id: string;
  numero_contrato: string | null;
  numero_ata: string | null;
  tipo_documento: 'contrato' | 'ata_srp' | string;
  ata_srp_id: string | null;
};

const emptyForm = {
  numero_aditivo: '',
  tipo: 'valor',
  alvo_id: '',
  alvo_referencia_tipo: 'contrato' as 'contrato' | 'ata_srp',
  valor_acrescimo: '',
  valor_supressao: '',
  quantidade_acrescimo: '',
  quantidade_supressao: '',
  nova_data_fim: '',
  data_assinatura: '',
  justificativa: '',
  observacoes: '',
};

const showValueFields = (tipo: string) => ['valor', 'valor_quantidade', 'escopo', 'prazo'].includes(tipo);
const showQtyFields = (tipo: string) => ['quantidade', 'valor_quantidade', 'prazo'].includes(tipo);

export default function ContratoAditivos({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [docAtual, setDocAtual] = useState<DocAlvo | null>(null);
  const [alvosDisponiveis, setAlvosDisponiveis] = useState<DocAlvo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Aditivo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadAditivos = async () => {
    setLoading(true);
    const [adtRes, docRes] = await Promise.all([
      supabase.from('contrato_aditivos').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('contratos').select('id, numero_contrato, numero_ata, tipo_documento, ata_srp_id').eq('id', contratoId).maybeSingle(),
    ]);
    setAditivos((adtRes.data as any[]) || []);
    const doc = docRes.data as DocAlvo | null;
    setDocAtual(doc);

    const alvos: DocAlvo[] = doc ? [doc] : [];
    if (doc?.tipo_documento === 'ata_srp') {
      const derivRes = await supabase.from('contratos')
        .select('id, numero_contrato, numero_ata, tipo_documento, ata_srp_id')
        .eq('ata_srp_id', doc.id);
      (derivRes.data as DocAlvo[] || []).forEach(d => alvos.push(d));
    } else if (doc?.tipo_documento === 'contrato' && doc.ata_srp_id) {
      const ataRes = await supabase.from('contratos')
        .select('id, numero_contrato, numero_ata, tipo_documento, ata_srp_id')
        .eq('id', doc.ata_srp_id).maybeSingle();
      if (ataRes.data) alvos.push(ataRes.data as DocAlvo);
    }
    setAlvosDisponiveis(alvos);
    setLoading(false);
  };

  useEffect(() => { loadAditivos(); }, [contratoId]);

  const labelAlvo = (d: DocAlvo) => {
    const isAta = d.tipo_documento === 'ata_srp';
    const num = isAta ? (d.numero_ata || 'ATA') : (d.numero_contrato || 'Contrato');
    return `${isAta ? '📋 ATA SRP' : '📄 Contrato'} ${num}${d.id === contratoId ? ' (atual)' : ''}`;
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      numero_aditivo: `${aditivos.length + 1}º Aditivo`,
      alvo_id: docAtual?.id || '',
      alvo_referencia_tipo: docAtual?.tipo_documento === 'ata_srp' ? 'ata_srp' : 'contrato',
    });
    setDialogOpen(true);
  };

  const openEdit = (a: Aditivo) => {
    setEditing(a);
    setForm({
      numero_aditivo: a.numero_aditivo,
      tipo: a.tipo || 'valor',
      alvo_id: a.contrato_id,
      alvo_referencia_tipo: a.referencia_tipo === 'ata_srp' ? 'ata_srp' : 'contrato',
      valor_acrescimo: a.valor_acrescimo ? String(a.valor_acrescimo) : '',
      valor_supressao: a.valor_supressao ? String(a.valor_supressao) : '',
      quantidade_acrescimo: a.quantidade_acrescimo ? String(a.quantidade_acrescimo) : '',
      quantidade_supressao: a.quantidade_supressao ? String(a.quantidade_supressao) : '',
      nova_data_fim: a.nova_data_fim || '',
      data_assinatura: a.data_assinatura || a.data_aditivo || '',
      justificativa: a.justificativa || '',
      observacoes: a.observacoes || '',
    });
    setDialogOpen(true);
  };

  const onAlvoChange = (id: string) => {
    const alvo = alvosDisponiveis.find(d => d.id === id);
    setForm(f => ({
      ...f,
      alvo_id: id,
      alvo_referencia_tipo: alvo?.tipo_documento === 'ata_srp' ? 'ata_srp' : 'contrato',
    }));
  };

  const handleSave = async () => {
    if (!form.numero_aditivo || !user) {
      toast.error('Preencha o número do aditivo');
      return;
    }
    if (!form.alvo_id) {
      toast.error('Selecione o documento alvo do aditivo (Contrato ou ATA SRP)');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        contrato_id: form.alvo_id,
        user_id: user.id,
        numero_aditivo: form.numero_aditivo,
        tipo: form.tipo,
        referencia_tipo: form.alvo_referencia_tipo,
        valor_acrescimo: showValueFields(form.tipo) ? (parseFloat(form.valor_acrescimo) || 0) : 0,
        valor_supressao: showValueFields(form.tipo) ? (parseFloat(form.valor_supressao) || 0) : 0,
        quantidade_acrescimo: showQtyFields(form.tipo) ? (parseFloat(form.quantidade_acrescimo) || 0) : 0,
        quantidade_supressao: showQtyFields(form.tipo) ? (parseFloat(form.quantidade_supressao) || 0) : 0,
        nova_data_fim: form.nova_data_fim || null,
        data_assinatura: form.data_assinatura || null,
        data_aditivo: form.data_assinatura || null,
        justificativa: form.justificativa || null,
        observacoes: form.observacoes || null,
      };

      payload.valor_aditivo = payload.valor_acrescimo - payload.valor_supressao;

      if (editing) {
        const { error } = await supabase.from('contrato_aditivos').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Aditivo atualizado!');
      } else {
        const { error } = await supabase.from('contrato_aditivos').insert(payload);
        if (error) throw error;
        toast.success('Aditivo registrado!');
      }

      setDialogOpen(false);
      loadAditivos();
    } catch (err: any) {
      toast.error('Erro ao salvar aditivo', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este aditivo?')) return;
    await supabase.from('contrato_aditivos').delete().eq('id', id);
    toast.success('Aditivo excluído');
    loadAditivos();
  };

  // Summaries
  const totalAcrescimo = aditivos.reduce((s, a) => s + (a.valor_acrescimo || 0), 0);
  const totalSupressao = aditivos.reduce((s, a) => s + (a.valor_supressao || 0), 0);
  const saldoAditivos = totalAcrescimo - totalSupressao;
  const totalQtyAcrescimo = aditivos.reduce((s, a) => s + (a.quantidade_acrescimo || 0), 0);
  const totalQtySupressao = aditivos.reduce((s, a) => s + (a.quantidade_supressao || 0), 0);
  const saldoQty = totalQtyAcrescimo - totalQtySupressao;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {aditivos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Acréscimos (R$)</div>
            <p className="text-sm font-bold text-success">{fmt(totalAcrescimo)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Supressões (R$)</div>
            <p className="text-sm font-bold text-destructive">{fmt(totalSupressao)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Saldo Valor</div>
            <p className={`text-sm font-bold ${saldoAditivos >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(saldoAditivos)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Acrésc. Qtde</div>
            <p className="text-sm font-bold text-success">+{fmtQty(totalQtyAcrescimo)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Supr. Qtde</div>
            <p className="text-sm font-bold text-destructive">-{fmtQty(totalQtySupressao)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Saldo Qtde</div>
            <p className={`text-sm font-bold ${saldoQty >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtQty(saldoQty)}</p>
          </Card>
        </div>
      )}

      {/* Add button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo Aditivo
        </Button>
      </div>

      {/* Aditivos list */}
      {aditivos.length === 0 ? (
        <Card className="p-8 text-center">
          <FilePlus2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum aditivo contratual registrado</p>
          <p className="text-xs text-muted-foreground mt-1">Registre aditivos de valor, quantidade ou prazo.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {aditivos.map((a) => {
            const tipoConfig = TIPOS_ADITIVO[a.tipo] || TIPOS_ADITIVO.valor;
            const Icon = tipoConfig.icon;
            const saldoValor = (a.valor_acrescimo || 0) - (a.valor_supressao || 0);
            const saldoQtyItem = (a.quantidade_acrescimo || 0) - (a.quantidade_supressao || 0);
            return (
              <Card key={a.id} className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${tipoConfig.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{a.numero_aditivo}</span>
                      <Badge className={`text-[9px] ${tipoConfig.color}`}>{tipoConfig.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {(a.valor_acrescimo || 0) > 0 && (
                        <span className="text-success">+{fmt(a.valor_acrescimo)}</span>
                      )}
                      {(a.valor_supressao || 0) > 0 && (
                        <span className="text-destructive">-{fmt(a.valor_supressao)}</span>
                      )}
                      {(a.quantidade_acrescimo || 0) > 0 && (
                        <span className="text-success">+{fmtQty(a.quantidade_acrescimo)} un</span>
                      )}
                      {(a.quantidade_supressao || 0) > 0 && (
                        <span className="text-destructive">-{fmtQty(a.quantidade_supressao)} un</span>
                      )}
                      {a.nova_data_fim && (
                        <span>Nova vigência: {new Date(a.nova_data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      )}
                      {(a.data_assinatura || a.data_aditivo) && (
                        <span>Assinatura: {new Date((a.data_assinatura || a.data_aditivo!) + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                    {a.justificativa && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.justificativa}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Per-aditivo summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Acréscimos (R$)</div>
                    <p className="text-xs font-bold text-success">{fmt(a.valor_acrescimo || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Supressões (R$)</div>
                    <p className="text-xs font-bold text-destructive">{fmt(a.valor_supressao || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Saldo Valor</div>
                    <p className={`text-xs font-bold ${saldoValor >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(saldoValor)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Acrésc. Qtde</div>
                    <p className="text-xs font-bold text-success">+{fmtQty(a.quantidade_acrescimo || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Supr. Qtde</div>
                    <p className="text-xs font-bold text-destructive">-{fmtQty(a.quantidade_supressao || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Saldo Qtde</div>
                    <p className={`text-xs font-bold ${saldoQtyItem >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtQty(saldoQtyItem)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Aditivo' : 'Novo Aditivo Contratual'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Aditivo de qual documento? *</Label>
              <Select value={form.alvo_id} onValueChange={onAlvoChange}>
                <SelectTrigger><SelectValue placeholder="Selecionar Contrato ou ATA SRP" /></SelectTrigger>
                <SelectContent>
                  {alvosDisponiveis.map(d => (
                    <SelectItem key={d.id} value={d.id}>{labelAlvo(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Os saldos e valores serão recalculados no documento selecionado.
              </p>
            </div>
            <div>
              <Label className="text-xs">Nº/Identificação *</Label>
              <Input value={form.numero_aditivo} onChange={(e) => setForm(f => ({ ...f, numero_aditivo: e.target.value }))} placeholder="1º Aditivo" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_ADITIVO).map(([k, { label }]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            {showValueFields(form.tipo) && (
              <>
                <div>
                  <Label className="text-xs">Valor Acréscimo (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_acrescimo} onChange={(e) => setForm(f => ({ ...f, valor_acrescimo: e.target.value }))} placeholder="0,00" />
                </div>
                <div>
                  <Label className="text-xs">Valor Supressão (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_supressao} onChange={(e) => setForm(f => ({ ...f, valor_supressao: e.target.value }))} placeholder="0,00" />
                </div>
              </>
            )}

            {showQtyFields(form.tipo) && (
              <>
                <div>
                  <Label className="text-xs">Qtde Acréscimo</Label>
                  <Input type="number" step="1" value={form.quantidade_acrescimo} onChange={(e) => setForm(f => ({ ...f, quantidade_acrescimo: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">Qtde Supressão</Label>
                  <Input type="number" step="1" value={form.quantidade_supressao} onChange={(e) => setForm(f => ({ ...f, quantidade_supressao: e.target.value }))} placeholder="0" />
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Nova Data Fim (se prorrogação)</Label>
              <Input type="date" value={form.nova_data_fim} onChange={(e) => setForm(f => ({ ...f, nova_data_fim: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Data Assinatura</Label>
              <Input type="date" value={form.data_assinatura} onChange={(e) => setForm(f => ({ ...f, data_assinatura: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Justificativa / Fundamentação</Label>
              <Textarea value={form.justificativa} onChange={(e) => setForm(f => ({ ...f, justificativa: e.target.value }))} rows={2} placeholder="Fundamentação legal do aditivo" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>

          {/* Live preview */}
          {(showValueFields(form.tipo) || showQtyFields(form.tipo)) && (
            <Card className="p-3 mt-2 bg-muted/50">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">Resumo do Aditivo</p>
              <div className="flex flex-wrap gap-4 text-xs">
                {showValueFields(form.tipo) && (
                  <span className={`font-semibold ${(parseFloat(form.valor_acrescimo) || 0) - (parseFloat(form.valor_supressao) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    Saldo Valor: {fmt((parseFloat(form.valor_acrescimo) || 0) - (parseFloat(form.valor_supressao) || 0))}
                  </span>
                )}
                {showQtyFields(form.tipo) && (
                  <span className={`font-semibold ${(parseFloat(form.quantidade_acrescimo) || 0) - (parseFloat(form.quantidade_supressao) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    Saldo Qtde: {fmtQty((parseFloat(form.quantidade_acrescimo) || 0) - (parseFloat(form.quantidade_supressao) || 0))}
                  </span>
                )}
              </div>
            </Card>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Atualizar' : 'Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
