import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import SecaoRecolhivel from '@/components/ui/secao-recolhivel';

type DocStatus = 'ok' | 'vencido' | 'ausente';

interface Documento {
  nome: string;
  status: DocStatus;
  validade?: string;
}

interface Props {
  documentos: Documento[];
}

/** Dias até a validade, contados por DATA — hora não entra, fuso não desloca. */
const diasAteVencer = (validade: string): number | null => {
  const m = String(validade).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const agora = new Date();
  return Math.round(
    (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) -
      Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())) /
      86400000,
  );
};

const dataBr = (validade: string) =>
  new Date(`${String(validade).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');

export default function AlertaVencimentoDocumentos({ documentos }: Props) {
  const vencidos = documentos.filter((d) => d.status === 'vencido');

  const proximos = documentos.filter((d) => {
    if (!d.validade || d.status === 'vencido') return false;
    const dias = diasAteVencer(d.validade);
    return dias !== null && dias >= 0 && dias <= 30;
  });

  const ausentes = documentos.filter((d) => d.status === 'ausente');

  if (vencidos.length === 0 && proximos.length === 0 && ausentes.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success-line bg-success-tint px-4 py-3 text-sm text-success-ink">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Todos os documentos estão regulares e dentro do prazo de validade.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {vencidos.length > 0 && (
        <SecaoRecolhivel
          id="documentos-vencidos"
          className="animate-fade-in rounded-lg border border-destructive-line bg-destructive-tint px-4 py-3 text-sm text-destructive-ink"
          icone={<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive-ink" aria-hidden="true" />}
          classNameIcone="text-destructive-ink"
          titulo={
            <span className="text-base font-semibold text-destructive-ink">
              {vencidos.length} documento{vencidos.length > 1 ? 's' : ''} vencido{vencidos.length > 1 ? 's' : ''}
            </span>
          }
        >
          <ul className="mt-2 space-y-1">
            {vencidos.map((d) => (
              <li key={d.nome} className="text-sm text-destructive-ink">
                • {d.nome} {d.validade && `— venceu em ${dataBr(d.validade)}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-medium text-destructive-ink">
            Documentos vencidos impedem a habilitação em licitações. Regularize imediatamente.
          </p>
        </SecaoRecolhivel>
      )}

      {proximos.length > 0 && (
        <SecaoRecolhivel
          id="documentos-proximos-vencimento"
          className="animate-fade-in rounded-lg border border-warning-line bg-warning-tint px-4 py-3 text-sm text-warning-ink"
          icone={<Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" aria-hidden="true" />}
          classNameIcone="text-warning-ink"
          titulo={
            <span className="text-base font-semibold text-warning-ink">
              {proximos.length} documento{proximos.length > 1 ? 's' : ''} próximo
              {proximos.length > 1 ? 's' : ''} do vencimento
            </span>
          }
        >
          <ul className="mt-2 space-y-1">
            {proximos.map((d) => {
              const dias = diasAteVencer(d.validade!) ?? 0;
              return (
                <li key={d.nome} className="text-sm text-warning-ink">
                  • {d.nome} — vence em <strong>{dias} dia{dias === 1 ? '' : 's'}</strong> ({dataBr(d.validade!)})
                </li>
              );
            })}
          </ul>
        </SecaoRecolhivel>
      )}

      {/* Ausente não é o mesmo grau que vencido: falta pedir, não barra hoje.
          Neutro tingido é o tom `info` do vocabulário (Badge/Alert variant
          "info" = bg-muted sobre border-border) — sem inventar token novo. */}
      {ausentes.length > 0 && (
        <SecaoRecolhivel
          id="documentos-ausentes"
          className="animate-fade-in rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground"
          icone={<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          classNameIcone="text-muted-foreground"
          titulo={
            <span className="text-base font-semibold text-foreground">
              {ausentes.length} documento{ausentes.length > 1 ? 's' : ''} ausente{ausentes.length > 1 ? 's' : ''}
            </span>
          }
        >
          <ul className="mt-2 space-y-1">
            {ausentes.map((d) => (
              <li key={d.nome} className="text-sm text-muted-foreground">• {d.nome}</li>
            ))}
          </ul>
        </SecaoRecolhivel>
      )}
    </div>
  );
}
