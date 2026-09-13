import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
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
  arquivado_em?: string | null;
};

// 'Arquivada' saiu da lista: arquivar não é mais um status, é o botão
// Arquivar/Restaurar no rodapé do diálogo. Deixá-la aqui permitiria gravar
// status='Arquivada' e voltar a apagar o desfecho.
const STATUS_OPTIONS = [
  'Monitorando', 'Em Análise', 'Proposta Enviada', 'Em Disputa',
  'Vencida', 'Homologada', 'Perdida',
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
        .eq('id', licitacao.id);  // policy de UPDATE por empresa decide quem pode

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
      .eq('id', licitacao.id);  // policy de UPDATE por empresa decide quem pode

    onSaved({ ...licitacao, status: 'Perdida' });
    setPerdaAlvo(null);
    onOpenChange(false);
  };

  const handleArquivar = async () => {
    if (!licitacao) return;
    // Arquivamento mora em `arquivado_em`, não em `status` — restaurar devolve
    // o processo com o desfecho que ele já tinha.
    const restaurar = !!licitacao.arquivado_em;
    setArquivando(true);
    const ok = await arquivarProcesso(licitacao.id, !restaurar);
    setArquivando(false);
    if (!ok) return;
    onSaved({ ...licitacao, arquivado_em: restaurar ? null : new Date().toISOString() });
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
      {/* Largo, em duas colunas com rolagem independente. Era `max-w-lg`
          (512px) com a análise da Aurélia empilhada embaixo do formulário, em
          duas colunas de ~200px — parágrafos inteiros viravam uma tira
          estreita, e o Ian pediu "expansivo, largo". Agora o formulário fica
          à esquerda e a Aurélia ocupa a altura toda à direita, com largura
          de leitura. O `grid-rows-[minmax(0,1fr)]` é o que deixa cada coluna
          rolar sozinha: sem ele a linha do grid cresce com o conteúdo e a
          rolagem volta a ser do modal inteiro. */}
      <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-5">
          <DialogTitle>Editar processo</DialogTitle>
          <DialogDescription className="truncate text-sm">
            {[form.numero, form.orgao].filter(Boolean).join(' · ') || 'Dados do processo e análise da Aurélia'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[26rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          {/* Coluna 1 — o formulário */}
          <div className="space-y-4 border-border px-6 py-5 lg:min-h-0 lg:overflow-y-auto lg:border-r">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-lic-numero">Número</Label>
              <Input
                id="edit-lic-numero"
                value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lic-status">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger id="edit-lic-status">
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

          <div className="space-y-2">
            <Label htmlFor="edit-lic-orgao">Órgão</Label>
            <Input
              id="edit-lic-orgao"
              value={form.orgao}
              onChange={e => setForm(f => ({ ...f, orgao: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-lic-objeto">Objeto</Label>
            <Textarea
              id="edit-lic-objeto"
              value={form.objeto}
              onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))}
              className="min-h-[110px]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="edit-lic-valor">Valor Estimado (R$)</Label>
              <Input
                id="edit-lic-valor"
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
                className="tabular-nums"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lic-uf">UF</Label>
              <Select value={form.uf || 'none'} onValueChange={v => setForm(f => ({ ...f, uf: v === 'none' ? '' : v }))}>
                <SelectTrigger id="edit-lic-uf">
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
            <div className="space-y-2">
              <Label htmlFor="edit-lic-municipio">Município</Label>
              <Input
                id="edit-lic-municipio"
                value={form.municipio}
                onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-lic-data">Data de Encerramento</Label>
            <Input
              id="edit-lic-data"
              type="date"
              value={form.data_encerramento}
              onChange={e => setForm(f => ({ ...f, data_encerramento: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-lic-obs">Observações</Label>
            <Textarea
              id="edit-lic-obs"
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              className="min-h-[90px]"
              placeholder="Anotações sobre o processo..."
            />
          </div>
          </div>

          {/* Coluna 2 — AURÉLIA, com a altura toda e largura de leitura */}
          <div className="min-w-0 bg-muted/30 px-6 py-5 lg:min-h-0 lg:overflow-y-auto">
            <AureliaEditalPanel
              colunas={1}
              edital={{
                titulo: form.numero,
                objeto: form.objeto,
                orgao: form.orgao,
                valor: form.valor_estimado ? `R$ ${form.valor_estimado}` : 'Não informado',
                modalidade: form.status,
                uf: form.uf || undefined,
              }}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={handleArquivar}
              disabled={arquivando}
            >
              {arquivando
                ? <Loader2 className="animate-spin" aria-hidden="true" />
                : licitacao.arquivado_em
                ? <ArchiveRestore aria-hidden="true" />
                : <Archive aria-hidden="true" />}
              {licitacao.arquivado_em ? 'Restaurar' : 'Arquivar'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:bg-destructive-tint hover:text-destructive">
                  <Trash2 aria-hidden="true" />
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
                    className={buttonVariants({ variant: 'destructive' })}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Excluir'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-w-24"
            >
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
