import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DocStatus = 'ok' | 'pendente' | 'vencido' | 'ausente';

interface Documento {
  nome: string;
  status: DocStatus;
  validade?: string;
}

interface Props {
  documentos: Documento[];
}

export default function AlertaVencimentoDocumentos({ documentos }: Props) {
  const hoje = new Date();
  
  const vencidos = documentos.filter(d => d.status === 'vencido' || 
    (d.validade && new Date(d.validade) < hoje));
  
  const proximos = documentos.filter(d => {
    if (!d.validade || d.status === 'vencido') return false;
    const val = new Date(d.validade);
    const diffDias = Math.ceil((val.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diffDias > 0 && diffDias <= 30;
  });
  
  const ausentes = documentos.filter(d => d.status === 'ausente' || d.status === 'pendente');

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
        <div className="flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">
              {vencidos.length} documento{vencidos.length > 1 ? 's' : ''} vencido{vencidos.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 space-y-0.5">
              {vencidos.map(d => (
                <li key={d.nome} className="text-xs text-destructive/80">
                  • {d.nome} {d.validade && `— venceu em ${new Date(d.validade).toLocaleDateString('pt-BR')}`}
                </li>
              ))}
            </ul>
            <p className="text-xs text-destructive/70 mt-1.5">
              ⚠️ Documentos vencidos impedem a habilitação em licitações. Regularize imediatamente.
            </p>
          </div>
        </div>
      )}

      {proximos.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-warning/10 border border-warning/20 rounded-lg text-sm animate-fade-in">
          <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-warning">
              {proximos.length} documento{proximos.length > 1 ? 's' : ''} próximo{proximos.length > 1 ? 's' : ''} do vencimento
            </p>
            <ul className="mt-1 space-y-0.5">
              {proximos.map(d => {
                const diffDias = Math.ceil((new Date(d.validade!).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <li key={d.nome} className="text-xs text-warning/80">
                    • {d.nome} — vence em <strong>{diffDias} dia{diffDias > 1 ? 's' : ''}</strong> ({new Date(d.validade!).toLocaleDateString('pt-BR')})
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {ausentes.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-info/10 border border-info/20 rounded-lg text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-info">
              {ausentes.length} documento{ausentes.length > 1 ? 's' : ''} pendente{ausentes.length > 1 ? 's' : ''}/ausente{ausentes.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 space-y-0.5">
              {ausentes.map(d => (
                <li key={d.nome} className="text-xs text-info/80">• {d.nome}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
