import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  em_analise: { label: 'Em análise', color: 'bg-primary/10 text-primary border-primary/20', icon: Loader2 },
  concluida: { label: 'Concluída', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 },
  recusada: { label: 'Recusada', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertCircle },
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
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Meus Dados (LGPD — Art. 18)</h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Send className="w-3 h-3 mr-1" />
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
                <label className="text-xs font-medium mb-1.5 block">Tipo de solicitação *</label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
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
                <label className="text-xs font-medium mb-1.5 block">Descrição (opcional)</label>
                <Textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Descreva detalhes adicionais sobre sua solicitação..."
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !tipo}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar Solicitação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados pessoais a qualquer momento, conforme previsto na LGPD.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          Nenhuma solicitação registrada.
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {requests.map(req => {
            const statusInfo = STATUS_MAP[req.status] || STATUS_MAP.pendente;
            const StatusIcon = statusInfo.icon;
            return (
              <div key={req.id} className="flex items-center justify-between text-xs py-2.5 px-3 border border-border/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusInfo.color}>
                    <StatusIcon className={`w-3 h-3 mr-1 ${req.status === 'em_analise' ? 'animate-spin' : ''}`} />
                    {statusInfo.label}
                  </Badge>
                  <span className="font-medium">{TIPOS.find(t => t.value === req.tipo)?.label || req.tipo}</span>
                </div>
                <span className="text-muted-foreground">
                  {new Date(req.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground">
          Contato do DPO: <a href="mailto:dpo@praefectus.com.br" className="text-accent hover:underline">dpo@praefectus.com.br</a> | 
          Prazo legal de resposta: 15 dias (Art. 18, §5º da LGPD)
        </p>
      </div>
    </section>
  );
}
