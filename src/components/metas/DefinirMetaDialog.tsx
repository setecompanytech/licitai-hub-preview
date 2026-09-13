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
import { APURACAO, AVISO_CRITERIOS_DISTINTOS } from '@/lib/metas/apuracao';
import { LinhaApuracao } from './comuns';

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
            <Target aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
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
          <div className="rounded-lg border border-border p-4 space-y-4">
            <p className="g-corpo font-semibold text-foreground">
              Metas do mês
            </p>
            {/* Quem escreve o alvo precisa saber por qual DATA ele será
                cobrado: as três pontas caem em meses diferentes, e um contrato
                assinado em 31/03 vira faturamento de abril. */}
            <p className="g-meta text-muted-foreground">{AVISO_CRITERIOS_DISTINTOS}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="meta-contratos" className="g-meta mb-1 block text-muted-foreground">
                  1 · Contratos a ganhar
                </Label>
                <Input
                  id="meta-contratos"
                  type="number" min={0} placeholder="—"
                  className="g-controle"
                  value={contratos}
                  onChange={(e) => setContratos(e.target.value)}
                />
                <LinhaApuracao
                  className="mt-1"
                  curto={`quantidade · ${APURACAO.ganhos.curto}`}
                  explicacao={APURACAO.ganhos.explicacao}
                />
              </div>
              <div>
                <Label htmlFor="meta-participacoes" className="g-meta mb-1 block text-muted-foreground">
                  Participações
                </Label>
                <Input
                  id="meta-participacoes"
                  type="number" min={0} placeholder="—"
                  className="g-controle"
                  value={participacoes}
                  onChange={(e) => setParticipacoes(e.target.value)}
                />
                <LinhaApuracao
                  className="mt-1"
                  curto={`propostas · ${APURACAO.participados.curto}`}
                  explicacao={APURACAO.participados.explicacao}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="meta-faturamento" className="g-meta mb-1 block text-muted-foreground">
                2 · Faturamento (R$)
              </Label>
              <MoneyInput id="meta-faturamento" autoFocus className="g-controle" value={faturamento} onValueChange={setFaturamento} />
              <LinhaApuracao
                className="mt-1"
                curto={`a nota saiu · ${APURACAO.pedidos_faturados.curto}`}
                explicacao={APURACAO.pedidos_faturados.explicacao}
              />
            </div>

            <div>
              <Label htmlFor="meta-quitacao" className="g-meta mb-1 block text-muted-foreground">
                3 · NF-e quitada (R$)
              </Label>
              <MoneyInput id="meta-quitacao" className="g-controle" value={quitacao} onValueChange={setQuitacao} />
              <LinhaApuracao
                className="mt-1"
                curto={`o dinheiro entrou · ${APURACAO.nfe_quitadas.curto}`}
                explicacao={APURACAO.nfe_quitadas.explicacao}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="meta-principal" className="g-meta mb-1 block text-muted-foreground">Meta principal</Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseMeta)}>
              <SelectTrigger id="meta-principal" className="g-controle"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento">{BASES_META.faturamento.label}</SelectItem>
                <SelectItem value="nf_quitada">{BASES_META.nf_quitada.label}</SelectItem>
                <SelectItem value="contratos_ganhos">{BASES_META.contratos_ganhos.label}</SelectItem>
              </SelectContent>
            </Select>
            {/* Uma só manda no alarme, senão o painel grita três vezes pelo
                mesmo mês e a pessoa aprende a ignorar os três. */}
            <p className="g-meta mt-1 text-muted-foreground">
              É esta que dispara o alerta de risco e a projeção de fechamento.
              As outras duas continuam medidas e exibidas.
            </p>
            {/* A projeção monetária do painel é sempre construída sobre o
                faturamento. Escolher outra principal sem escrever faturamento
                deixa o painel sem alvo em reais — e ele passa a declarar isso
                em vez de mostrar "Falta R$ 0,00 · Meta batida". */}
            {base !== 'faturamento' && faturamento <= 0 && (
              <p className="g-meta mt-1 text-warning-ink">
                Sem meta de faturamento, o painel não projeta valores em reais — só acompanha
                a ponta escolhida como principal.
              </p>
            )}
            {valorDaPrincipal <= 0 && (
              <p className="g-meta mt-1 text-warning-ink">
                A meta principal precisa ter valor — sem ele o painel alertaria sobre zero.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="meta-observacao" className="g-meta mb-1 block text-muted-foreground">Observação (opcional)</Label>
            <Textarea
              id="meta-observacao"
              rows={2}
              placeholder="Contexto da meta, acordo com o colaborador…"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>Cancelar</Button>
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
            {salvar.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            Salvar meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
