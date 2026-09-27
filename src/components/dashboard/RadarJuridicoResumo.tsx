import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRadarJuridico } from '@/hooks/useRadarJuridico';

/**
 * O Radar Jurídico no Painel geral (F2, 27/09/2026): quantas providências
 * jurídicas os dados apontam, quantas críticas, e o caminho para a aba
 * Radar, onde cada uma abre a peça com o caso montado. Sem pendência o
 * bloco não aparece — mesma regra do bloco de contratos aguardando decisão.
 */
export default function RadarJuridicoResumo() {
  const { data, isLoading, error } = useRadarJuridico();
  if (isLoading || error || !data || data.length === 0) return null;
  const criticos = data.filter((e) => e.gravidade === 'critico').length;
  const atencao = data.length - criticos;
  const primeiro = data[0];
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-sm" data-testid="radar-juridico-resumo">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${criticos > 0 ? 'bg-destructive-tint text-destructive-ink' : 'bg-warning-tint text-warning-ink'}`} aria-hidden="true">
          <Scale className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 grow basis-56">
          <p className="text-base font-semibold leading-6 text-foreground">
            {data.length === 1 ? '1 providência jurídica apontada pelos dados' : `${data.length} providências jurídicas apontadas pelos dados`}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={primeiro.titulo}>
            {primeiro.caso}: {primeiro.titulo}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {criticos > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-destructive-line bg-destructive-tint px-2 py-0.5 text-xs font-semibold text-destructive-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
              {criticos} crítica(s)
            </span>
          )}
          {atencao > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-warning-line bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
              {atencao} atenção
            </span>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/apoio-juridico">Abrir o Radar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
