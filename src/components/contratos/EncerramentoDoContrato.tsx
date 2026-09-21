import { useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatarBRL } from './formato';
import {
  MOTIVOS_ENCERRAMENTO,
  MOTIVOS_ESCOLHIVEIS,
  hojeEmSaoPaulo,
  type MotivoEncerramento,
} from '@/lib/contratos/encerramento';

/**
 * Os dois diálogos do encerramento — declarar e reabrir.
 *
 * Só eles escrevem: cada um chama a RPC correspondente (migration
 * 20260921000002), que grava a trilha e muda a situação numa transação só.
 * A tela nunca escreve `status = 'encerrado'` direto — se escrevesse, o
 * gatilho do banco criaria a trilha sem motivo, e é exatamente o registro
 * incompleto que este diálogo existe para evitar.
 */

export type EncerramentoRegistrado = {
  motivo: MotivoEncerramento;
  data_encerramento: string;
  saldo_nao_executado: number;
};

type Instrumento = 'contrato' | 'ata';
const nomeDo = (i: Instrumento) => (i === 'ata' ? 'a ata' : 'o contrato');

export function EncerrarContratoDialog({
  aberto,
  aoFechar,
  contratoId,
  instrumento,
  motivoSugerido,
  dataSugerida,
  completarMotivo = false,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  contratoId: string;
  instrumento: Instrumento;
  /** O motivo que o painel deduziu do sinal (saldo esgotado, prazo vencido). */
  motivoSugerido?: MotivoEncerramento | null;
  /** AAAA-MM-DD; sem ela, hoje. */
  dataSugerida?: string | null;
  /** O contrato já está encerrado sem motivo: o diálogo completa o registro. */
  completarMotivo?: boolean;
  aoConcluir: (r: EncerramentoRegistrado) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoEncerramento>('quantitativo_esgotado');
  const [data, setData] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const nome = nomeDo(instrumento);

  // Cada abertura parte da sugestão do momento, não do que ficou da anterior.
  useEffect(() => {
    if (!aberto) return;
    setMotivo(motivoSugerido && motivoSugerido !== 'nao_informado' ? motivoSugerido : 'quantitativo_esgotado');
    setData((dataSugerida ?? hojeEmSaoPaulo()).slice(0, 10));
    setObservacao('');
  }, [aberto, motivoSugerido, dataSugerida]);

  const confirmar = async () => {
    setSalvando(true);
    const { data: resposta, error } = await supabase.rpc('encerrar_contrato' as never, {
      p_contrato_id: contratoId,
      p_motivo: motivo,
      p_data_encerramento: data || null,
      p_observacao: observacao.trim() || null,
    } as never);
    setSalvando(false);
    if (error) {
      toast.error(`Não foi possível encerrar ${nome}`, { description: error.message });
      return;
    }
    const r = (resposta ?? {}) as { motivo?: MotivoEncerramento; data_encerramento?: string; saldo_nao_executado?: number };
    const saldo = Number(r.saldo_nao_executado) || 0;
    toast.success(
      completarMotivo ? 'Motivo do encerramento registrado.' : `${instrumento === 'ata' ? 'Ata encerrada' : 'Contrato encerrado'}.`,
      { description: saldo > 0 ? `Saldo não executado registrado na trilha: ${formatarBRL(saldo)}.` : undefined },
    );
    aoConcluir({ motivo: r.motivo ?? motivo, data_encerramento: r.data_encerramento ?? data, saldo_nao_executado: saldo });
    aoFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{completarMotivo ? 'Informar o motivo do encerramento' : `Encerrar ${nome}`}</DialogTitle>
          <DialogDescription>
            {completarMotivo
              ? `A situação já é Encerrado, mas o registro veio sem motivo. Diga por que ${nome} terminou e quando.`
              : `Encerrar declara que as obrigações terminaram: pedido novo fica barrado e o saldo sai da carteira. `
                + 'Pedidos, notas e quitações já lançados continuam como estão. Dá para reabrir.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="motivo-encerramento">Motivo</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoEncerramento)}>
              <SelectTrigger id="motivo-encerramento" aria-label="Motivo do encerramento"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_ESCOLHIVEIS.map((m) => (
                  <SelectItem key={m} value={m}>{MOTIVOS_ENCERRAMENTO[m].rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{MOTIVOS_ENCERRAMENTO[motivo].explicacao}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="data-encerramento">Data do encerramento</Label>
            <Input
              id="data-encerramento"
              type="date"
              value={data}
              max={hojeEmSaoPaulo()}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="observacao-encerramento">Observação (opcional)</Label>
            <Textarea
              id="observacao-encerramento"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: última entrega recebida em 15/09; nada mais a fornecer."
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={salvando || !data}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {completarMotivo ? 'Registrar motivo' : `Encerrar ${nome}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReabrirContratoDialog({
  aberto,
  aoFechar,
  contratoId,
  instrumento,
  aditivo,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  contratoId: string;
  instrumento: Instrumento;
  /** O aditivo assinado depois do encerramento, quando foi ele que motivou. */
  aditivo?: { id: string; numero: string } | null;
  aoConcluir: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const nome = nomeDo(instrumento);

  useEffect(() => {
    if (!aberto) return;
    setMotivo(aditivo ? `Aditivo ${aditivo.numero} assinado após o encerramento.` : '');
  }, [aberto, aditivo]);

  const confirmar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc('reabrir_contrato' as never, {
      p_contrato_id: contratoId,
      p_motivo: motivo.trim(),
      p_aditivo_id: aditivo?.id ?? null,
    } as never);
    setSalvando(false);
    if (error) {
      toast.error(`Não foi possível reabrir ${nome}`, { description: error.message });
      return;
    }
    toast.success(`${instrumento === 'ata' ? 'Ata reaberta' : 'Contrato reaberto'}.`, {
      description: 'A situação voltou a Vigente; o encerramento ficou na trilha, com o motivo da reabertura.',
    });
    aoConcluir();
    aoFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reabrir {nome}</DialogTitle>
          <DialogDescription>
            A situação volta a Vigente e o saldo volta à carteira. O encerramento não é apagado: fica na
            trilha, com quem reabriu, quando e por quê.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="motivo-reabertura">Motivo da reabertura</Label>
          <Textarea
            id="motivo-reabertura"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: aditivo de quantidade assinado em 20/09; fornecimento continua."
          />
          <p className="text-xs text-muted-foreground">Ao menos 5 caracteres.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={salvando || motivo.trim().length < 5}>
            {salvando
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            Reabrir {nome}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
