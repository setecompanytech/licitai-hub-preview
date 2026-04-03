import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import AureliaEditalPanel from '@/components/aurelia/AureliaEditalPanel';

type LicitacaoKanban = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
};

const STATUS_OPTIONS = [
  'Monitorando', 'Em Análise', 'Proposta Enviada', 'Em Disputa',
  'Vencida', 'Homologada', 'Perdida', 'Arquivada',
];

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

type Props = {
  licitacao: LicitacaoKanban | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: LicitacaoKanban) => void;
  onDeleted: (id: string) => void;
};

/** Format a numeric value (in cents) to BRL display string */
const formatBRL = (cents: number): string => {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Parse a BRL formatted string to raw number (float) */
const parseBRL = (display: string): number | null => {
  const cleaned = display.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

/** Convert raw float to cents integer for internal state */
const toCents = (value: number | null): number => {
  if (value === null || isNaN(value)) return 0;
  return Math.round(value * 100);
};

export default function EditLicitacaoDialog({ licitacao, open, onOpenChange, onSaved, onDeleted }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    numero: '',
    orgao: '',
    objeto: '',
    status: 'Monitorando',
    valor_estimado: '',
    uf: '',
    municipio: '',
    data_encerramento: '',
    observacoes: '',
  });

  useEffect(() => {
    if (licitacao) {
      setForm({
        numero: licitacao.numero || '',
        orgao: licitacao.orgao || '',
        objeto: licitacao.objeto || '',
        status: licitacao.status || 'Monitorando',
        valor_estimado: licitacao.valor_estimado ? formatBRL(toCents(licitacao.valor_estimado)) : '',
        uf: licitacao.uf || '',
        municipio: licitacao.municipio || '',
        data_encerramento: licitacao.data_encerramento
          ? new Date(licitacao.data_encerramento).toISOString().split('T')[0]
          : '',
        observacoes: '',
      });
    }
  }, [licitacao]);

  const handleSave = async () => {
    if (!user || !licitacao) return;
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        numero: form.numero,
        orgao: form.orgao,
        objeto: form.objeto,
        status: form.status,
        valor_estimado: form.valor_estimado ? parseBRL(form.valor_estimado) : null,
        uf: form.uf || null,
        municipio: form.municipio || null,
        data_encerramento: form.data_encerramento || null,
      };
      if (form.observacoes.trim()) {
        updateData.observacoes = form.observacoes;
      }

      const { error } = await supabase
        .from('licitacoes')
        .update(updateData)
        .eq('id', licitacao.id)
        .eq('user_id', user.id);

      if (error) throw error;

      onSaved({
        ...licitacao,
        numero: form.numero,
        orgao: form.orgao,
        objeto: form.objeto,
        status: form.status,
        valor_estimado: form.valor_estimado ? parseBRL(form.valor_estimado) : null,
        uf: form.uf || null,
        municipio: form.municipio || null,
        data_encerramento: form.data_encerramento || null,
      });
      toast.success('Processo atualizado com sucesso!');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !licitacao) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('licitacoes')
        .delete()
        .eq('id', licitacao.id)
        .eq('user_id', user.id);

      if (error) throw error;

      onDeleted(licitacao.id);
      toast.success('Processo removido.');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir processo.');
    } finally {
      setDeleting(false);
    }
  };

  if (!licitacao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar Processo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Número</Label>
              <Input
                value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Órgão</Label>
            <Input
              value={form.orgao}
              onChange={e => setForm(f => ({ ...f, orgao: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Objeto</Label>
            <Textarea
              value={form.objeto}
              onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))}
              className="text-sm min-h-[70px]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor Estimado (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.valor_estimado}
                onChange={e => {
                  // Allow only digits, dots (thousand sep) and comma (decimal sep)
                  let raw = e.target.value.replace(/[^\d]/g, '');
                  if (!raw) { setForm(f => ({ ...f, valor_estimado: '' })); return; }
                  const cents = parseInt(raw, 10);
                  setForm(f => ({ ...f, valor_estimado: formatBRL(cents) }));
                }}
                className="h-9 text-sm"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">UF</Label>
              <Select value={form.uf || 'none'} onValueChange={v => setForm(f => ({ ...f, uf: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {UFS.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Município</Label>
              <Input
                value={form.municipio}
                onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data de Encerramento</Label>
            <Input
              type="date"
              value={form.data_encerramento}
              onChange={e => setForm(f => ({ ...f, data_encerramento: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              className="text-sm min-h-[60px]"
              placeholder="Anotações sobre o processo..."
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs">
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. O processo <strong>{licitacao.numero}</strong> será removido permanentemente da gestão.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
