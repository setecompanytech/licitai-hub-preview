import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Target } from 'lucide-react';
import { useSalvarMeta, type Meta } from '@/hooks/useMetasComercial';
import { MoneyInput } from '@/components/ui/money-input';
import type { BaseMeta } from '@/lib/metas/painel';

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

type Props = {
  aberto: boolean;
  onFechar: () => void;
  colaborador: { user_id: string; nome: string };
  ano: number;
  mes: number;
  /** Meta já existente do período, quando houver — o diálogo edita no lugar de criar. */
  metaAtual: Meta | null;
};

/**
 * Define a meta mensal de um colaborador.
 *
 * `base_meta` decide o que o painel compara contra a meta: faturamento (pedido
 * faturado) ou valor de contrato ganho. Trocar a base muda o realizado exibido,
 * então a escolha fica visível aqui em vez de escondida na parametrização.
 */
export default function DefinirMetaDialog({ aberto, onFechar, colaborador, ano, mes, metaAtual }: Props) {
  const salvar = useSalvarMeta();

  const [faturamento, setFaturamento] = useState(0);
  const [base, setBase] = useState<BaseMeta>('faturamento');
  const [contratos, setContratos] = useState('');
  const [participacoes, setParticipacoes] = useState('');
  const [observacao, setObservacao] = useState('');

  // Cada abertura reflete a meta do período selecionado, sem herdar a anterior.
  useEffect(() => {
    if (!aberto) return;
    setFaturamento(metaAtual ? Number(metaAtual.meta_faturamento) : 0);
    setBase(metaAtual?.base_meta ?? 'faturamento');
    setContratos(metaAtual?.meta_contratos != null ? String(metaAtual.meta_contratos) : '');
    setParticipacoes(metaAtual?.meta_participacoes != null ? String(metaAtual.meta_participacoes) : '');
    setObservacao(metaAtual?.observacao ?? '');
  }, [aberto, metaAtual]);

  const podeSalvar = faturamento > 0 && !salvar.isPending;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            {metaAtual ? 'Editar meta' : 'Definir meta'}
          </DialogTitle>
          <DialogDescription>
            {colaborador.nome} — {NOMES_MES[mes - 1]} de {ano}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Meta do mês (R$)</Label>
            <MoneyInput
              autoFocus
              value={faturamento}
              onValueChange={setFaturamento}
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Medida sobre</Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseMeta)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento">Faturamento (pedido faturado)</SelectItem>
                <SelectItem value="contratos_ganhos">Contratos ganhos (valor assinado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Contratos (opcional)</Label>
              <Input
                type="number" min={0} placeholder="—"
                value={contratos}
                onChange={(e) => setContratos(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Participações (opcional)</Label>
              <Input
                type="number" min={0} placeholder="—"
                value={participacoes}
                onChange={(e) => setParticipacoes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Observação (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Contexto da meta, acordo com o colaborador…"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvar.isPending}>Cancelar</Button>
          <Button
            disabled={!podeSalvar}
            onClick={() =>
              salvar.mutate(
                {
                  user_id: colaborador.user_id,
                  ano,
                  mes,
                  meta_faturamento: faturamento,
                  meta_contratos: contratos === '' ? null : Number(contratos),
                  meta_participacoes: participacoes === '' ? null : Number(participacoes),
                  base_meta: base,
                  observacao: observacao.trim() || null,
                },
                { onSuccess: onFechar },
              )
            }
          >
            {salvar.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Salvar meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
