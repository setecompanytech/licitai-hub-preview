import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileWarning, Loader2, Send, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import EstadoVazio from '@/components/shared/EstadoVazio';

type LgpdRequest = {
  id: string;
  tipo: string;
  status: string;
  descricao: string | null;
  resposta: string | null;
  created_at: string;
  prazo_resposta: string;
};

const TIPOS = [
  { value: 'exclusao', label: 'Exclusão de dados' },
  { value: 'acesso', label: 'Acesso aos meus dados' },
  { value: 'correcao', label: 'Correção de dados' },
  { value: 'portabilidade', label: 'Portabilidade de dados' },
];

type VarianteStatus = 'warning' | 'info' | 'success' | 'danger';

const STATUS_MAP: Record<string, { label: string; variant: VarianteStatus; icon: typeof Clock }> = {
  pendente: { label: 'Pendente', variant: 'warning', icon: Clock },
  em_analise: { label: 'Em análise', variant: 'info', icon: Loader2 },
  concluida: { label: 'Concluída', variant: 'success', icon: CheckCircle2 },
  recusada: { label: 'Recusada', variant: 'danger', icon: AlertCircle },
};

export default function SolicitacaoLgpd() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LgpdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('solicitacoes_lgpd')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRequests((data as LgpdRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [user]);

  const handleSubmit = async () => {
    if (!tipo) { toast.error('Selecione o tipo de solicitação'); return; }
    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_lgpd')
        .insert({ user_id: user.id, tipo, descricao: descricao || null });
      if (error) throw error;

      toast.success('Solicitação registrada com sucesso. Prazo de resposta: 15 dias.');
      setDialogOpen(false);
      setTipo('');
      setDescricao('');
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Meus Dados (LGPD — Art. 18)</h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Send aria-hidden="true" />
              Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitação de Dados (LGPD)</DialogTitle>
              <DialogDescription>
                Exerça seus direitos conforme o Art. 18 da Lei Geral de Proteção de Dados. Prazo de resposta: até 15 dias.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="lgpd-tipo" className="mb-2 block">Tipo de solicitação *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="lgpd-tipo">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lgpd-descricao" className="mb-2 block">Descrição (opcional)</Label>
                <Textarea
                  id="lgpd-descricao"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Descreva detalhes adicionais sobre sua solicitação..."
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !tipo}
                className="w-full"
              >
                {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                Enviar Solicitação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados pessoais a qualquer momento, conforme previsto na LGPD.
      </p>

      {loading ? (
        <div role="status" aria-busy="true" className="space-y-2">
          <span className="sr-only">Carregando solicitações</span>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : requests.length === 0 ? (
        <EstadoVazio
          tamanho="compacto"
          icone={<FileWarning aria-hidden="true" />}
          titulo="Nenhuma solicitação registrada"
          descricao="Abra uma solicitação para exercer seus direitos de acesso, correção, exclusão ou portabilidade."
          acao={<Button variant="outline" onClick={() => setDialogOpen(true)}><Send aria-hidden="true" /> Nova Solicitação</Button>}
        />
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {requests.map(req => {
            const statusInfo = STATUS_MAP[req.status] || STATUS_MAP.pendente;
            const StatusIcon = statusInfo.icon;
            return (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusInfo.variant} className="gap-1">
                    <StatusIcon className={`h-4 w-4 ${req.status === 'em_analise' ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {statusInfo.label}
                  </Badge>
                  <span className="font-medium text-foreground">{TIPOS.find(t => t.value === req.tipo)?.label || req.tipo}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(req.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Contato do DPO: <a href="mailto:dpo@praefectus.com.br" className="text-primary hover:underline">dpo@praefectus.com.br</a> |
          Prazo legal de resposta: 15 dias (Art. 18, §5º da LGPD)
        </p>
      </div>
    </section>
  );
}
