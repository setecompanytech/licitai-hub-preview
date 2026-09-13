import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, FolderOpen, Search } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { useEditalAutoIngest } from '@/hooks/useEditalAutoIngest';
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
  pncpNumero?: string | null;
  cnpjOrgao?: string | null;
  anoCompra?: number | string | null;
  sequencialCompra?: number | string | null;
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

// Duas saídas. As seis portas antigas (Kanban, Compromissos, Precificação,
// Proposta, Aurélia…) faziam TODAS a mesma ação e só mudavam a página de
// destino — e o prontuário do processo (/processo/:id) já reúne tudo isso em
// abas e atalhos. Uma topologia de navegação só: a mesma decisão da Onda 1,
// quando o Painel deixou de despejar o usuário em módulos soltos.
const DESTINOS = [
  { id: 'abrir',     label: 'Abrir o processo',        desc: 'Prontuário completo: Kanban, precificação, proposta, documentos e IA', icon: FolderOpen, route: '/processo' },
  { id: 'continuar', label: 'Continuar pesquisando',   desc: 'O processo fica criado na gestão; você permanece no Monitoramento',    icon: Search,     route: null },
] as const;

type DestinoId = typeof DESTINOS[number]['id'];

export default function EditalActionsModal({ open, onOpenChange, edital, existingId, onCreated, onCompromissoCreated }: Props) {
  const navigate = useNavigate();
  const { iniciarProcesso, criarCompromisso } = useLicitacaoIntegration();
  const { trigger: triggerIngest } = useEditalAutoIngest(null);
  const [working, setWorking] = useState<DestinoId | null>(null);

  const handleAcao = async (destino: typeof DESTINOS[number]) => {
    if (!edital) return;
    setWorking(destino.id);
    try {
      let licitacaoId: string | null = existingId || null;

      if (!licitacaoId) {
        const created = await iniciarProcesso(edital as any);
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

      // Dispara leitura automática do edital em background (silencioso).
      // Itens aparecem em Precificação/Proposta via Realtime conforme processados.
      void triggerIngest(licitacaoId, { silent: true });

      onOpenChange(false);

      if (destino.route) {
        navigate(`${destino.route}/${licitacaoId}`);
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
            {existingId ? 'Este edital já está na gestão' : 'Iniciar processo'}
          </DialogTitle>
          <DialogDescription>
            {edital?.numero} — {edital?.orgao}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {DESTINOS.map((d) => {
            const Icon = d.icon;
            const isLoading = working === d.id;
            return (
              <Button
                key={d.id}
                variant="outline"
                onClick={() => handleAcao(d)}
                disabled={!!working}
                className="group h-auto justify-start gap-3 px-3 py-2.5 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground group-hover:bg-primary-tint group-hover:text-primary">
                  {isLoading
                    ? <Loader2 className="animate-spin text-muted-foreground" aria-hidden="true" />
                    : <Icon aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{d.label}</span>
                  <span className="block whitespace-normal text-xs font-normal text-muted-foreground">{d.desc}</span>
                </span>
                <ArrowRight className="text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </Button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!working}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
