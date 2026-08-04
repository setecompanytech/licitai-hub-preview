import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { useMotivosPerda } from '@/hooks/useMetasComercial';

export type PerdaAlvo = {
  licitacaoId: string;
  numero: string;
  orgao?: string;
  modalidade?: string | null;
  valorEstimado?: number | null;
};

type Props = {
  alvo: PerdaAlvo | null;
  onCancelar: () => void;
  onConfirmar: (dados: { motivoId: string; observacao: string }) => Promise<void> | void;
  salvando?: boolean;
};

/**
 * Motivo da perda é obrigatório — a regra vale na interface, no NOT NULL de
 * `comercial_perdas.motivo_id` e no trigger que barra a licitação de virar
 * "Perdida" sem registro. Este diálogo é a primeira das três camadas.
 */
export default function RegistrarPerdaDialog({ alvo, onCancelar, onConfirmar, salvando = false }: Props) {
  const { data: motivos, isLoading } = useMotivosPerda(true);
  const [motivoId, setMotivoId] = useState<string>('');
  const [observacao, setObservacao] = useState('');

  // Cada abertura começa limpa, para não herdar o motivo do processo anterior
  useEffect(() => {
    if (alvo) { setMotivoId(''); setObservacao(''); }
  }, [alvo]);

  const podeConfirmar = !!motivoId && !salvando;

  return (
    <Dialog open={!!alvo} onOpenChange={(aberto) => { if (!aberto) onCancelar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            Registrar perda do processo
          </DialogTitle>
          <DialogDescription>
            <strong>{alvo?.numero}</strong>{alvo?.orgao ? ` — ${alvo.orgao}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Select value={motivoId} onValueChange={setMotivoId} disabled={isLoading}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={isLoading ? 'Carregando…' : 'Selecione o motivo da perda'} />
              </SelectTrigger>
              <SelectContent>
                {(motivos ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && (motivos?.length ?? 0) === 0 && (
              <p className="flex items-start gap-1.5 text-base text-warning">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Nenhum motivo ativo cadastrado. Um administrador precisa configurá-los em
                Metas do Comercial → Parametrização.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhe o que levou à perda (opcional, mas ajuda na análise do mês)."
              className="min-h-[90px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{observacao.length}/500</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            disabled={!podeConfirmar}
            onClick={() => onConfirmar({ motivoId, observacao: observacao.trim() })}
          >
            {salvando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
