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
import { Loader2, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { useEmpresa } from '@/contexts/EmpresaContext';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';
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
  const { empresaAtiva } = useEmpresa();
  const { arquivarProcesso, excluirProcesso, registrarPerda } = useLicitacaoIntegration();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);
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

    // Marcar como "Perdida" exige motivo — o banco recusa a mudança sem
    // registro em comercial_perdas. Salva o resto primeiro e delega o status
    // ao diálogo de perda.
    if (form.status === 'Perdida' && licitacao.status !== 'Perdida') {
      setPerdaAlvo({
        licitacaoId: licitacao.id,
        numero: form.numero || licitacao.numero,
        orgao: form.orgao || licitacao.orgao,
        modalidade: null,
        valorEstimado: form.valor_estimado ? parseBRL(form.valor_estimado) : null,
      });
      return;
    }

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
    // excluirProcesso remove também o compromisso vinculado — senão ele fica
    // órfão e continua listado na aba Compromissos
    const ok = await excluirProcesso(licitacao.id);
    setDeleting(false);
    if (!ok) { toast.error('Erro ao excluir processo.'); return; }
    onDeleted(licitacao.id);
    toast.success('Processo e compromisso removidos.');
    onOpenChange(false);
  };

  const confirmarPerda = async ({ motivoId, observacao }: { motivoId: string; observacao: string }) => {
    if (!perdaAlvo || !licitacao || !empresaAtiva) return;
    setSalvandoPerda(true);
    const ok = await registrarPerda({
      licitacaoId: perdaAlvo.licitacaoId,
      empresaId: empresaAtiva.id,
      motivoId,
      observacao,
      modalidade: perdaAlvo.modalidade,
      valorEstimado: perdaAlvo.valorEstimado,
    });
    setSalvandoPerda(false);
    if (!ok) return;

    // Demais campos do formulário, agora que o status já foi para "Perdida"
    await supabase
      .from('licitacoes')
      .update({
        numero: form.numero,
        orgao: form.orgao,
        objeto: form.objeto,
        valor_estimado: form.valor_estimado ? parseBRL(form.valor_estimado) : null,
        uf: form.uf || null,
        municipio: form.municipio || null,
        data_encerramento: form.data_encerramento || null,
      })
      .eq('id', licitacao.id)
      .eq('user_id', user!.id);

    onSaved({ ...licitacao, status: 'Perdida' });
    setPerdaAlvo(null);
    onOpenChange(false);
  };

  const handleArquivar = async () => {
    if (!licitacao) return;
    const restaurar = licitacao.status === 'Arquivada';
    setArquivando(true);
    const ok = await arquivarProcesso(licitacao.id, !restaurar);
    setArquivando(false);
    if (!ok) return;
    onSaved({ ...licitacao, status: restaurar ? 'Monitorando' : 'Arquivada' });
    toast.success(restaurar ? 'Processo restaurado.' : 'Processo arquivado no Kanban e nos Compromissos.');
    onOpenChange(false);
  };

  if (!licitacao) return null;

  return (
    <>
    <RegistrarPerdaDialog
      alvo={perdaAlvo}
      salvando={salvandoPerda}
      onCancelar={() => setPerdaAlvo(null)}
      onConfirmar={confirmarPerda}
    />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar Processo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Número</Label>
              <Input
                value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Status</Label>
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
            <Label className="text-sm">Órgão</Label>
            <Input
              value={form.orgao}
              onChange={e => setForm(f => ({ ...f, orgao: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Objeto</Label>
            <Textarea
              value={form.objeto}
              onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))}
              className="text-sm min-h-[70px]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Valor Estimado (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.valor_estimado}
                onChange={e => {
                  // Allow only digits, dots (thousand sep) and comma (decimal sep)
                  const raw = e.target.value.replace(/[^\d]/g, '');
                  if (!raw) { setForm(f => ({ ...f, valor_estimado: '' })); return; }
                  const cents = parseInt(raw, 10);
                  setForm(f => ({ ...f, valor_estimado: formatBRL(cents) }));
                }}
                className="h-9 text-sm"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">UF</Label>
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
              <Label className="text-sm">Município</Label>
              <Input
                value={form.municipio}
                onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Data de Encerramento</Label>
            <Input
              type="date"
              value={form.data_encerramento}
              onChange={e => setForm(f => ({ ...f, data_encerramento: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              className="text-sm min-h-[60px]"
              placeholder="Anotações sobre o processo..."
            />
          </div>

          {/* AURÉLIA — Análise automática */}
          <AureliaEditalPanel
            edital={{
              titulo: form.numero,
              objeto: form.objeto,
              orgao: form.orgao,
              valor: form.valor_estimado ? `R$ ${form.valor_estimado}` : 'Não informado',
              modalidade: form.status,
              uf: form.uf || undefined,
            }}
          />

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={handleArquivar}
              disabled={arquivando}
            >
              {arquivando
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : licitacao.status === 'Arquivada'
                ? <ArchiveRestore className="w-3.5 h-3.5" />
                : <Archive className="w-3.5 h-3.5" />}
              {licitacao.status === 'Arquivada' ? 'Restaurar' : 'Arquivar'}
            </Button>
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
                    Esta ação é irreversível. O processo <strong>{licitacao.numero}</strong> será removido
                    permanentemente da gestão, junto com o compromisso vinculado. Para tirar da tela sem
                    perder o histórico, use <strong>Arquivar</strong>.
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
            </div>

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
    </>
  );
}
