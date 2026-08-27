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
import { BASES_META, type BaseMeta } from '@/lib/metas/painel';

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
  const [quitacao, setQuitacao] = useState(0);
  const [base, setBase] = useState<BaseMeta>('faturamento');
  const [contratos, setContratos] = useState('');
  const [participacoes, setParticipacoes] = useState('');
  const [observacao, setObservacao] = useState('');

  // Cada abertura reflete a meta do período selecionado, sem herdar a anterior.
  useEffect(() => {
    if (!aberto) return;
    setFaturamento(metaAtual ? Number(metaAtual.meta_faturamento) : 0);
    setQuitacao(metaAtual?.meta_quitacao != null ? Number(metaAtual.meta_quitacao) : 0);
    setBase(metaAtual?.base_meta ?? 'faturamento');
    setContratos(metaAtual?.meta_contratos != null ? String(metaAtual.meta_contratos) : '');
    setParticipacoes(metaAtual?.meta_participacoes != null ? String(metaAtual.meta_participacoes) : '');
    setObservacao(metaAtual?.observacao ?? '');
  }, [aberto, metaAtual]);

  /**
   * A meta eleita como principal precisa ter valor.
   *
   * Ela é a que dispara o alerta de risco. Deixar salvar uma principal vazia
   * produziria "0% de uma meta de R$ 0,00" no painel — barulho que ensina a
   * ignorar o alarme. As outras duas podem ficar em branco: nem toda meta se
   * define nas três pontas.
   */
  const valorDaPrincipal =
    base === 'faturamento' ? faturamento
    : base === 'nf_quitada' ? quitacao
    : Number(contratos) || 0;
  const podeSalvar = valorDaPrincipal > 0 && !salvar.isPending;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            {metaAtual ? 'Editar meta' : 'Definir meta'}
          </DialogTitle>
          <DialogDescription>
            {colaborador.nome} — {NOMES_MES[mes - 1]} de {ano}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* As três pontas da esteira, na ordem em que o dinheiro anda:
              o negócio fecha (contrato), a nota sai (faturamento), o dinheiro
              entra (quitação). Antes havia UM valor e uma escolha de contra o
              quê compará-lo — e olhar um ponto só esconde onde a esteira
              travou: contratos em dia com quitação zerada é ter fechado e não
              entregado, e o painel mostrava isso como meta batida. */}
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Metas do mês
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">
                  1 · Contratos a ganhar
                </Label>
                <Input
                  type="number" min={0} placeholder="—"
                  value={contratos}
                  onChange={(e) => setContratos(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">valor assinado</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">
                  Participações
                </Label>
                <Input
                  type="number" min={0} placeholder="—"
                  value={participacoes}
                  onChange={(e) => setParticipacoes(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">propostas a enviar</p>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">
                2 · Faturamento (R$)
              </Label>
              <MoneyInput autoFocus value={faturamento} onValueChange={setFaturamento} />
              <p className="text-[11px] text-muted-foreground mt-1">a nota saiu</p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">
                3 · NF-e quitada (R$)
              </Label>
              <MoneyInput value={quitacao} onValueChange={setQuitacao} />
              <p className="text-[11px] text-muted-foreground mt-1">o dinheiro entrou</p>
            </div>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Meta principal</Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseMeta)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento">{BASES_META.faturamento.label}</SelectItem>
                <SelectItem value="nf_quitada">{BASES_META.nf_quitada.label}</SelectItem>
                <SelectItem value="contratos_ganhos">{BASES_META.contratos_ganhos.label}</SelectItem>
              </SelectContent>
            </Select>
            {/* Uma só manda no alarme, senão o painel grita três vezes pelo
                mesmo mês e a pessoa aprende a ignorar os três. */}
            <p className="text-[11px] text-muted-foreground mt-1">
              É esta que dispara o alerta de risco e a projeção de fechamento.
              As outras duas continuam medidas e exibidas.
            </p>
            {valorDaPrincipal <= 0 && (
              <p className="text-[11px] text-warning mt-1">
                A meta principal precisa ter valor — sem ele o painel alertaria sobre zero.
              </p>
            )}
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
                  meta_quitacao: quitacao > 0 ? quitacao : null,
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
