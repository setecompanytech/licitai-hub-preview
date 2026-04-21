import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export type DetectionResult = {
  tipo_documento_detectado?: 'ata_srp' | 'contrato' | 'aditivo' | 'outro' | null;
  numero_contrato?: string | null;
  numero_ata?: string | null;
  objeto?: string | null;
  valor_global?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  aditivo?: {
    numero_aditivo?: string | null;
    tipo_aditivo?: string | null;
    valor_acrescimo?: number | null;
    valor_supressao?: number | null;
    quantidade_acrescimo?: number | null;
    quantidade_supressao?: number | null;
    nova_data_fim?: string | null;
    contrato_referencia?: string | null;
    ata_referencia?: string | null;
    justificativa?: string | null;
  } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detection: DetectionResult | null;
  /** the parent registry currently open (ata_srp or contrato) */
  parentTipoDocumento: 'ata_srp' | 'contrato' | null;
  fileName: string;
  /** User chose to create a separate registry linked to the current one */
  onCreateLinkedRegistry: (data: DetectionResult) => Promise<void> | void;
  /** User chose to register an additive (aditivo) using the form values */
  onConfirmAditivo: (form: {
    numero_aditivo: string;
    valor_acrescimo: number;
    valor_supressao: number;
    quantidade_acrescimo: number;
    quantidade_supressao: number;
    nova_data_fim: string | null;
    justificativa: string | null;
    target: 'contrato' | 'ata_srp';
  }) => Promise<void> | void;
  /** User dismisses the suggestion and keeps the file as-is */
  onIgnore: () => void;
};

export default function DocumentDetectionDialog({
  open,
  onOpenChange,
  detection,
  parentTipoDocumento,
  fileName,
  onCreateLinkedRegistry,
  onConfirmAditivo,
  onIgnore,
}: Props) {
  const [working, setWorking] = useState(false);
  const [adForm, setAdForm] = useState({
    numero_aditivo: '',
    valor_acrescimo: '',
    valor_supressao: '',
    quantidade_acrescimo: '',
    quantidade_supressao: '',
    nova_data_fim: '',
    justificativa: '',
  });

  useEffect(() => {
    if (detection?.aditivo) {
      const a = detection.aditivo;
      setAdForm({
        numero_aditivo: a.numero_aditivo || '',
        valor_acrescimo: a.valor_acrescimo ? String(a.valor_acrescimo) : '',
        valor_supressao: a.valor_supressao ? String(a.valor_supressao) : '',
        quantidade_acrescimo: a.quantidade_acrescimo ? String(a.quantidade_acrescimo) : '',
        quantidade_supressao: a.quantidade_supressao ? String(a.quantidade_supressao) : '',
        nova_data_fim: a.nova_data_fim || '',
        justificativa: a.justificativa || '',
      });
    } else {
      setAdForm({
        numero_aditivo: '', valor_acrescimo: '', valor_supressao: '',
        quantidade_acrescimo: '', quantidade_supressao: '', nova_data_fim: '', justificativa: '',
      });
    }
  }, [detection]);

  if (!detection) return null;

  const detectedType = detection.tipo_documento_detectado;
  const isAditivo = detectedType === 'aditivo';
  const typeMismatch = !isAditivo && detectedType && parentTipoDocumento &&
    ((parentTipoDocumento === 'contrato' && detectedType === 'ata_srp') ||
     (parentTipoDocumento === 'ata_srp' && detectedType === 'contrato'));

  const labelDetected =
    detectedType === 'ata_srp' ? 'ATA de Registro de Preços' :
    detectedType === 'contrato' ? 'Contrato Administrativo' :
    detectedType === 'aditivo' ? 'Termo Aditivo' : 'Outro documento';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            IA detectou: {labelDetected}
          </DialogTitle>
          <DialogDescription>
            Arquivo: <span className="font-medium">{fileName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Caso 1: tipo divergente do registro pai */}
        {typeMismatch && (
          <Card className="p-4 border-warning/40 bg-warning/5 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">Documento de tipo diferente do registro atual</p>
                <p className="text-muted-foreground">
                  Você está nesta página de um <strong>{parentTipoDocumento === 'ata_srp' ? 'ATA SRP' : 'Contrato'}</strong>,
                  mas o arquivo enviado parece ser um <strong>{labelDetected}</strong>.
                </p>
                <p className="text-muted-foreground">
                  O recomendado é criar um <strong>registro separado</strong> vinculado a este, para que os saldos
                  (quantitativos e financeiros) sejam calculados corretamente em cascata.
                </p>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground border-t pt-2 space-y-0.5">
              {detection.numero_contrato && <div>📄 Nº Contrato: <strong>{detection.numero_contrato}</strong></div>}
              {detection.numero_ata && <div>📋 Nº ATA: <strong>{detection.numero_ata}</strong></div>}
              {detection.valor_global && <div>💰 Valor Global: <strong>{fmt(detection.valor_global)}</strong></div>}
              {detection.data_inicio && detection.data_fim && (
                <div>📅 Vigência: <strong>{detection.data_inicio}</strong> a <strong>{detection.data_fim}</strong></div>
              )}
            </div>
          </Card>
        )}

        {/* Caso 2: aditivo detectado */}
        {isAditivo && (
          <Card className="p-4 border-accent/40 bg-accent/5 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold">A IA pré-preencheu os dados do aditivo abaixo.</p>
                <p className="text-muted-foreground">Revise, ajuste se necessário e confirme o registro.</p>
                {detection.aditivo?.contrato_referencia && (
                  <p className="text-muted-foreground mt-1">
                    Contrato referenciado pelo aditivo: <strong>{detection.aditivo.contrato_referencia}</strong>
                  </p>
                )}
                {detection.aditivo?.ata_referencia && (
                  <p className="text-muted-foreground mt-1">
                    ATA referenciada pelo aditivo: <strong>{detection.aditivo.ata_referencia}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Número/Identificação</Label>
                <Input value={adForm.numero_aditivo} onChange={e => setAdForm(f => ({ ...f, numero_aditivo: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valor Acréscimo (R$)</Label>
                <Input type="number" step="0.01" value={adForm.valor_acrescimo} onChange={e => setAdForm(f => ({ ...f, valor_acrescimo: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valor Supressão (R$)</Label>
                <Input type="number" step="0.01" value={adForm.valor_supressao} onChange={e => setAdForm(f => ({ ...f, valor_supressao: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Qtde Acréscimo</Label>
                <Input type="number" step="0.01" value={adForm.quantidade_acrescimo} onChange={e => setAdForm(f => ({ ...f, quantidade_acrescimo: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Qtde Supressão</Label>
                <Input type="number" step="0.01" value={adForm.quantidade_supressao} onChange={e => setAdForm(f => ({ ...f, quantidade_supressao: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nova Data Fim (se houver prorrogação)</Label>
                <Input type="date" value={adForm.nova_data_fim} onChange={e => setAdForm(f => ({ ...f, nova_data_fim: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Justificativa</Label>
                <Textarea rows={2} value={adForm.justificativa} onChange={e => setAdForm(f => ({ ...f, justificativa: e.target.value }))} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Este aditivo será registrado como pertencente ao{' '}
              <Badge variant="outline" className="text-[9px]">
                {parentTipoDocumento === 'ata_srp' ? 'ATA SRP' : 'Contrato'} atual
              </Badge>{' '}
              e atualizará os saldos.
            </p>
          </Card>
        )}

        {/* Outro */}
        {!typeMismatch && !isAditivo && (
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              A IA não conseguiu reconhecer um padrão de ATA SRP, Contrato ou Aditivo.
              O arquivo será mantido apenas como anexo.
            </p>
          </Card>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onIgnore} disabled={working}>Ignorar sugestão</Button>
          {typeMismatch && (
            <Button
              onClick={async () => { setWorking(true); try { await onCreateLinkedRegistry(detection); } finally { setWorking(false); } }}
              disabled={working}
            >
              {working && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar registro separado e vincular
            </Button>
          )}
          {isAditivo && (
            <Button
              onClick={async () => {
                setWorking(true);
                try {
                  await onConfirmAditivo({
                    numero_aditivo: adForm.numero_aditivo || '1º Aditivo',
                    valor_acrescimo: parseFloat(adForm.valor_acrescimo) || 0,
                    valor_supressao: parseFloat(adForm.valor_supressao) || 0,
                    quantidade_acrescimo: parseFloat(adForm.quantidade_acrescimo) || 0,
                    quantidade_supressao: parseFloat(adForm.quantidade_supressao) || 0,
                    nova_data_fim: adForm.nova_data_fim || null,
                    justificativa: adForm.justificativa || null,
                    target: parentTipoDocumento === 'ata_srp' ? 'ata_srp' : 'contrato',
                  });
                } finally { setWorking(false); }
              }}
              disabled={working}
            >
              {working && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar registro do aditivo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
