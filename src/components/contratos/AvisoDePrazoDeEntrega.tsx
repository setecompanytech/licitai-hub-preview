import { AlertTriangle, CalendarClock, CheckCircle2, MapPin, Info } from 'lucide-react';
import { situacaoDoPrazo, type PrazoDoContrato } from '@/lib/contratos/prazo-de-entrega';

export type PrazosDoContrato = {
  prazo_entrega_dias: number | null;
  prazo_entrega_unidade: string | null;
  prazo_entrega_clausula: string | null;
  local_entrega: string | null;
  prazo_recebimento_dias: number | null;
  prazo_recebimento_unidade: string | null;
};

type Props = {
  contrato: PrazosDoContrato | null;
  /** Data do pedido recém-lançado, ISO. */
  dataDoPedido: string | null | undefined;
  dataDeEntrega?: string | null;
  compacto?: boolean;
};

const ESTILO = {
  vencido: { cor: 'text-destructive', fundo: 'bg-destructive/5 border-destructive/30', Icone: AlertTriangle },
  vence_hoje: { cor: 'text-destructive', fundo: 'bg-destructive/5 border-destructive/30', Icone: AlertTriangle },
  apertado: { cor: 'text-warning', fundo: 'bg-warning/5 border-warning/30', Icone: CalendarClock },
  no_prazo: { cor: 'text-muted-foreground', fundo: 'bg-muted/30 border-border', Icone: CalendarClock },
  entregue: { cor: 'text-muted-foreground', fundo: 'bg-muted/30 border-border', Icone: CheckCircle2 },
  sem_prazo: { cor: 'text-warning', fundo: 'bg-warning/5 border-warning/30', Icone: Info },
} as const;

/**
 * O que o contrato exige do pedido que acabou de ser lançado.
 *
 * Lançar um pedido dispara uma obrigação com prazo: entregar em N dias
 * contados da ordem de fornecimento. Estourar isso é inadimplemento (Lei
 * 14.133/2021, art. 137, II) e abre caminho para as sanções do art. 156 —
 * inclusive impedimento de licitar, que trava a empresa nos certames
 * seguintes.
 *
 * Até aqui a tela mostrava a data do pedido e mais nada: o prazo corria sem
 * ninguém ver.
 *
 * O estado `sem_prazo` não é decorativo. Quando o contrato não registra o
 * prazo, o aviso diz isso em vez de calcular — e diz onde resolver. Inventar
 * "30 dias porque é o usual" produziria uma obrigação que ninguém pactuou,
 * com a aparência de cláusula.
 */
export default function AvisoDePrazoDeEntrega({ contrato, dataDoPedido, dataDeEntrega, compacto }: Props) {
  const prazo: PrazoDoContrato = {
    dias: contrato?.prazo_entrega_dias ?? null,
    unidade: (contrato?.prazo_entrega_unidade as PrazoDoContrato['unidade']) ?? null,
  };
  const s = situacaoDoPrazo(dataDoPedido, prazo, { entregueEm: dataDeEntrega });
  const { cor, fundo, Icone } = ESTILO[s.estado];

  // Na linha da tabela, só o essencial: o resto tem lugar no detalhe do pedido.
  if (compacto) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${cor}`} title={s.frase}>
        <Icone className="w-3 h-3 shrink-0" />
        {s.estado === 'sem_prazo' ? 'sem prazo' : s.frase}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${fundo}`}>
      <p className={`text-sm font-medium flex items-center gap-1.5 ${cor}`}>
        <Icone className="w-4 h-4 shrink-0" />
        {s.frase}
      </p>

      {s.estado === 'sem_prazo' ? (
        <p className="text-xs text-muted-foreground">
          O contrato não tem prazo de entrega cadastrado, então o sistema não
          calcula a data-limite deste pedido. Reenvie o PDF do contrato para a
          leitura automática, ou preencha em Dashboard → Vigência.
        </p>
      ) : (
        <>
          {contrato?.local_entrega && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Entregar em: {contrato.local_entrega}</span>
            </p>
          )}
          {contrato?.prazo_recebimento_dias && (
            <p className="text-xs text-muted-foreground">
              Depois da entrega, o órgão tem {contrato.prazo_recebimento_dias} dia(s){' '}
              {contrato.prazo_recebimento_unidade === 'uteis' ? 'úteis' : 'corridos'} para
              receber e atestar (art. 140) — a nota só pode ser paga depois disso.
            </p>
          )}
          {contrato?.prazo_entrega_clausula && (
            <p className="text-[11px] text-muted-foreground/80 italic border-l-2 border-border pl-2 mt-1">
              “{contrato.prazo_entrega_clausula}”
            </p>
          )}
        </>
      )}
    </div>
  );
}
