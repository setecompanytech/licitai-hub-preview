import { AlertTriangle, CalendarClock, CheckCircle2, MapPin, Info } from 'lucide-react';
import { situacaoDoPrazo, type PrazoDoContrato } from '@/lib/contratos/prazo-de-entrega';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  /** Na tabela (30/09): só o ícone e uma palavra; a frase inteira abre ao clicar. */
  resumido?: boolean;
};

const ESTILO = {
  vencido: { cor: 'text-destructive-ink', fundo: 'bg-destructive-tint border-destructive-line', Icone: AlertTriangle },
  vence_hoje: { cor: 'text-destructive-ink', fundo: 'bg-destructive-tint border-destructive-line', Icone: AlertTriangle },
  apertado: { cor: 'text-warning-ink', fundo: 'bg-warning-tint border-warning-line', Icone: CalendarClock },
  no_prazo: { cor: 'text-muted-foreground', fundo: 'bg-muted border-border', Icone: CalendarClock },
  entregue: { cor: 'text-muted-foreground', fundo: 'bg-muted border-border', Icone: CheckCircle2 },
  sem_prazo: { cor: 'text-warning-ink', fundo: 'bg-warning-tint border-warning-line', Icone: Info },
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
export default function AvisoDePrazoDeEntrega({ contrato, dataDoPedido, dataDeEntrega, compacto, resumido }: Props) {
  const prazo: PrazoDoContrato = {
    dias: contrato?.prazo_entrega_dias ?? null,
    unidade: (contrato?.prazo_entrega_unidade as PrazoDoContrato['unidade']) ?? null,
  };
  const s = situacaoDoPrazo(dataDoPedido, prazo, { entregueEm: dataDeEntrega });
  const { cor, fundo, Icone } = ESTILO[s.estado];

  // Resumido (30/09): a frase vermelha em cada linha era ruído — fica o ícone
  // e uma palavra, e a frase inteira abre ao clicar.
  if (resumido) {
    if (s.estado === 'sem_prazo') return null;
    const palavra = s.estado === 'vencido' ? 'vencido' : s.estado === 'entregue' ? 'entregue' : s.estado === 'vence_hoje' ? 'vence hoje' : s.estado === 'apertado' ? 'apertado' : 'no prazo';
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={`inline-flex items-center gap-1 rounded text-xs ${cor} hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} title="Ver o prazo" aria-label={`Prazo: ${s.frase}`}>
            <Icone aria-hidden="true" className="h-3 w-3 shrink-0" />{palavra}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-72 text-sm">
          <p className={`flex items-start gap-1.5 font-medium ${cor}`}><Icone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{s.frase}</p>
        </PopoverContent>
      </Popover>
    );
  }

  // Na linha da tabela, só o essencial: o resto tem lugar no detalhe do pedido.
  if (compacto) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${cor}`} title={s.frase}>
        <Icone aria-hidden="true" className="h-3 w-3 shrink-0" />
        {s.estado === 'sem_prazo' ? 'sem prazo' : s.frase}
      </span>
    );
  }

  return (
    <div className={`space-y-1.5 rounded-lg border p-3 ${fundo}`}>
      <p className={`flex items-center gap-1.5 text-sm font-medium ${cor}`}>
        <Icone aria-hidden="true" className="h-4 w-4 shrink-0" />
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
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
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
            <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 mt-1">
              “{contrato.prazo_entrega_clausula}”
            </p>
          )}
        </>
      )}
    </div>
  );
}
