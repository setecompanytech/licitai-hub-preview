import { AlertTriangle, Ban, CheckCircle2, PenLine } from 'lucide-react';
import type { Pendencia } from '@/lib/precificacao/versao';
import type { ErroDoFormulario } from './estadoDaRevisao';

/**
 * O que impede a aprovação, separado do que só pede atenção.
 *
 * A distinção é por TEXTO e ícone, não por cor: "Bloqueiam a aprovação" e
 * "Avisos" são títulos de verdade, e cada linha diz o item a que se refere.
 * Campo digitado errado é uma terceira categoria — impede SALVAR, não só
 * aprovar — e por isso aparece à parte.
 */
function ondeEsta(numero?: number, lote?: string | null): string | null {
  if (numero == null) return null;
  return lote && lote !== 'Único' ? `Item ${numero} · Lote ${lote}` : `Item ${numero}`;
}

function Lista({
  titulo,
  icone: Icone,
  classeDoIcone,
  linhas,
  aoIrParaItem,
}: {
  titulo: string;
  icone: typeof Ban;
  classeDoIcone: string;
  linhas: { mensagem: string; numero?: number; lote?: string | null }[];
  aoIrParaItem?: (numero: number, lote: string | null) => void;
}) {
  if (!linhas.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="g-corpo flex items-center gap-2 font-semibold text-foreground">
        <Icone aria-hidden="true" className={`h-4 w-4 shrink-0 ${classeDoIcone}`} />
        {titulo} <span className="font-normal tabular-nums text-muted-foreground">({linhas.length})</span>
      </h3>
      <ul className="flex flex-col">
        {linhas.map((l, i) => {
          const onde = ondeEsta(l.numero, l.lote);
          return (
            <li key={`${l.numero ?? 'geral'}-${i}`} className="g-corpo flex flex-wrap items-baseline gap-x-2 border-b border-border/70 py-2 last:border-0">
              {onde &&
                (aoIrParaItem ? (
                  <button
                    type="button"
                    onClick={() => aoIrParaItem(l.numero as number, l.lote ?? null)}
                    className="shrink-0 rounded font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {onde}
                  </button>
                ) : (
                  <span className="shrink-0 font-medium text-foreground">{onde}</span>
                ))}
              <span className="min-w-0 text-foreground">{l.mensagem}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function PainelDePendencias({
  pendencias,
  erros,
  aoIrParaItem,
}: {
  pendencias: Pendencia[];
  erros: ErroDoFormulario[];
  aoIrParaItem?: (numero: number, lote: string | null) => void;
}) {
  const bloqueios = pendencias.filter((p) => p.gravidade === 'bloqueia');
  const avisos = pendencias.filter((p) => p.gravidade === 'aviso');

  if (!bloqueios.length && !avisos.length && !erros.length) {
    return (
      <p role="status" className="g-corpo flex items-center gap-2 text-success-ink">
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        Nenhuma pendência: os limites desta revisão podem ser aprovados.
      </p>
    );
  }

  return (
    <div className="g-cartao flex flex-col gap-4 p-4">
      <Lista
        titulo="Campos inválidos — impedem salvar"
        icone={PenLine}
        classeDoIcone="text-destructive-ink"
        linhas={erros.map((e) => ({ mensagem: e.mensagem, numero: e.numero }))}
        aoIrParaItem={aoIrParaItem}
      />
      <Lista
        titulo="Bloqueiam a aprovação"
        icone={Ban}
        classeDoIcone="text-destructive-ink"
        linhas={bloqueios}
        aoIrParaItem={aoIrParaItem}
      />
      <Lista titulo="Avisos" icone={AlertTriangle} classeDoIcone="text-warning-ink" linhas={avisos} aoIrParaItem={aoIrParaItem} />
    </div>
  );
}
