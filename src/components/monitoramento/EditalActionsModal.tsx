import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, LayoutDashboard, Calculator, FileText, MessageSquare, Search, ListChecks } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { toast } from 'sonner';

export interface EditalSeed {
  numero: string;
  orgao: string;
  objeto: string;
  modalidade?: string;
  valor_estimado?: number | null;
  uf?: string | null;
  municipio?: string | null;
  data_encerramento?: string | null;
  portal?: string | null;
  url?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edital: EditalSeed | null;
  /** Existing licitacao id when the edital is already in the user's gestão */
  existingId?: string | null;
  onCreated?: (licitacaoId: string) => void;
  /** Called after a compromisso is auto-created/reused */
  onCompromissoCreated?: (compromissoId: string) => void;
}

const DESTINOS = [
  { id: 'gestao',         label: 'Gestão de Licitações',   desc: 'Acompanhar no Kanban',                   icon: LayoutDashboard, route: '/kanban' },
  { id: 'compromissos',   label: 'Meus Compromissos',      desc: 'Gerir prazos, alertas e análise IA',     icon: ListChecks,      route: '/meus-compromissos' },
  { id: 'precificacao',   label: 'Precificação',           desc: 'Extrair itens e calcular preços',        icon: Calculator,      route: '/precificacao' },
  { id: 'proposta',       label: 'Proposta Comercial',     desc: 'Gerar proposta comercial',               icon: FileText,        route: '/proposta-comercial' },
  { id: 'aurelia',        label: 'Aurélia (Análise IA)',   desc: 'Análise jurídica e estratégica',         icon: MessageSquare,   route: '/aurelia' },
  { id: 'continuar',      label: 'Continuar pesquisando',  desc: 'Permanecer no Monitoramento',            icon: Search,          route: null },
] as const;

type DestinoId = typeof DESTINOS[number]['id'];

export default function EditalActionsModal({ open, onOpenChange, edital, existingId, onCreated, onCompromissoCreated }: Props) {
  const navigate = useNavigate();
  const { iniciarProcesso, criarCompromisso } = useLicitacaoIntegration();
  const [working, setWorking] = useState<DestinoId | null>(null);

  const handleAcao = async (destino: typeof DESTINOS[number]) => {
    if (!edital) return;
    setWorking(destino.id);
    try {
      let licitacaoId: string | null = existingId || null;

      if (!licitacaoId) {
        const created = await iniciarProcesso(edital);
        licitacaoId = created || null;
        if (!licitacaoId) {
          toast.error('Não foi possível iniciar o processo.');
          return;
        }
        onCreated?.(licitacaoId);
      } else {
        toast.info('Processo já existente reaproveitado.');
      }

      // Auto-create/reuse compromisso linked to the licitação
      // ensures Monitoramento ↔ Compromissos ↔ Gestão stay in sync.
      const compromissoId = await criarCompromisso(edital, licitacaoId);
      if (compromissoId) onCompromissoCreated?.(compromissoId);

      onOpenChange(false);

      if (destino.route) {
        // Compromissos route does not use ?lid; others do.
        const url = destino.id === 'compromissos'
          ? destino.route
          : `${destino.route}?lid=${licitacaoId}`;
        navigate(url);
      }
    } finally {
      setWorking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existingId ? 'Abrir processo existente em…' : 'Iniciar processo e abrir em…'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {edital?.numero} — {edital?.orgao}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {DESTINOS.map((d) => {
            const Icon = d.icon;
            const isLoading = working === d.id;
            return (
              <button
                key={d.id}
                onClick={() => handleAcao(d)}
                disabled={!!working}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors text-left disabled:opacity-50"
              >
                <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent/10">
                  {isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    : <Icon className="w-4 h-4 text-foreground/80 group-hover:text-accent" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={!!working}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
