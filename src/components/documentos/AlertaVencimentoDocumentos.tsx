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
      <div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>Todos os documentos estão regulares e dentro do prazo de validade.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {vencidos.length > 0 && (
        <SecaoRecolhivel
          id="documentos-vencidos"
          className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm animate-fade-in"
          icone={<AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />}
          classNameIcone="text-destructive/70"
          titulo={
            <span className="text-base font-semibold text-destructive">
              {vencidos.length} documento{vencidos.length > 1 ? 's' : ''} vencido{vencidos.length > 1 ? 's' : ''}
            </span>
          }
        >
          <ul className="mt-1 space-y-0.5">
            {vencidos.map((d) => (
              <li key={d.nome} className="text-sm text-destructive/80">
                • {d.nome} {d.validade && `— venceu em ${dataBr(d.validade)}`}
              </li>
            ))}
          </ul>
          <p className="text-sm text-destructive/70 mt-1.5">
            ⚠️ Documentos vencidos impedem a habilitação em licitações. Regularize imediatamente.
          </p>
        </SecaoRecolhivel>
      )}

      {proximos.length > 0 && (
        <SecaoRecolhivel
          id="documentos-proximos-vencimento"
          className="px-4 py-3 bg-warning/10 border border-warning/20 rounded-lg text-sm animate-fade-in"
          icone={<Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />}
          classNameIcone="text-warning/70"
          titulo={
            <span className="text-base font-semibold text-warning">
              {proximos.length} documento{proximos.length > 1 ? 's' : ''} próximo
              {proximos.length > 1 ? 's' : ''} do vencimento
            </span>
          }
        >
          <ul className="mt-1 space-y-0.5">
            {proximos.map((d) => {
              const dias = diasAteVencer(d.validade!) ?? 0;
              return (
                <li key={d.nome} className="text-sm text-warning/80">
                  • {d.nome} — vence em <strong>{dias} dia{dias === 1 ? '' : 's'}</strong> ({dataBr(d.validade!)})
                </li>
              );
            })}
          </ul>
        </SecaoRecolhivel>
      )}

      {ausentes.length > 0 && (
        <SecaoRecolhivel
          id="documentos-ausentes"
          className="px-4 py-3 bg-info/10 border border-info/20 rounded-lg text-sm animate-fade-in"
          icone={<AlertTriangle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />}
          classNameIcone="text-info/70"
          titulo={
            <span className="text-base font-semibold text-info">
              {ausentes.length} documento{ausentes.length > 1 ? 's' : ''} ausente{ausentes.length > 1 ? 's' : ''}
            </span>
          }
        >
          <ul className="mt-1 space-y-0.5">
            {ausentes.map((d) => (
              <li key={d.nome} className="text-sm text-info/80">• {d.nome}</li>
            ))}
          </ul>
        </SecaoRecolhivel>
      )}
    </div>
  );
}
