import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/shared/BrandLogo';
import { cn } from '@/lib/utils';
import { useVencimentosDeDocumentos } from '@/hooks/useVencimentosDeDocumentos';

/**
 * Central de criticidade documental — cartão único do topo do painel,
 * exatamente como o modelo aprovado: selo com a marca, título e contadores
 * por severidade numa faixa, e as duas frentes (regularizar agora / renovar
 * antes que vença) lado a lado abaixo.
 *
 * "Bloqueante" agrupa vencido + vence_hoje: os dois já impedem habilitação
 * hoje, e é essa urgência — não a data exata — que separa o vermelho do
 * amarelo no modelo.
 */
export default function PendenciasPrioritarias() {
  const { documentos, carregando, erro, recarregar } = useVencimentosDeDocumentos();

  if (carregando) {
    return (
      <div role="status" aria-busy="true" className="overflow-hidden rounded-lg border border-border bg-card">
        <span className="sr-only">Carregando pendências</span>
        <div className="skeleton" style={{ height: 68 }} />
        <div className="skeleton" style={{ height: 64, opacity: 0.7 }} />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="ds-alert-line red">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <strong>Não foi possível ler os vencimentos</strong>
          <span>{erro.message}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-1 shrink-0"
          onClick={recarregar}
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const bloqueantes = documentos.filter((d) => d.situacao === 'vencido' || d.situacao === 'vence_hoje').length;
  const atencao = documentos.filter((d) => d.situacao === 'vencendo').length;
  const total = bloqueantes + atencao;

  if (total === 0) {
    return (
      <div
        className="ds-alert-line"
        style={{ background: '#ecf8f3', borderColor: '#b9dfd0', color: '#087b62' }}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <strong>Documentação em dia</strong>
          <span>Nenhum documento vencido ou a vencer nos próximos 30 dias.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Cabeçalho: selo da marca, título, contadores e a ação principal */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="brand-mark-badge" aria-hidden="true">
          <BrandLogo variant="dark" mode="symbol" width={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">Central de criticidade documental</p>
          <p className="text-xs text-muted-foreground">
            {total} pendência{total > 1 ? 's' : ''} pode{total > 1 ? 'm' : ''} afetar sua participação em licitações
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {bloqueantes > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive-line bg-destructive-tint px-2.5 py-1 text-xs font-semibold text-destructive-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
              {bloqueantes} bloqueante{bloqueantes > 1 ? 's' : ''}
            </span>
          )}
          {atencao > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-tint px-2.5 py-1 text-xs font-semibold text-warning-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
              {atencao} atenção
            </span>
          )}
          <Button asChild size="sm">
            <Link to="/calendario">Revisar documentos</Link>
          </Button>
        </div>
      </div>

      {/* Corpo: uma frente por severidade, lado a lado quando as duas existem */}
      <div
        className={cn(
          'grid divide-y divide-border',
          bloqueantes > 0 && atencao > 0 && 'sm:grid-cols-2 sm:divide-y-0 sm:divide-x',
        )}
      >
        {bloqueantes > 0 && (
          <Link
            to="/calendario"
            className="flex items-center gap-3 border-l-4 border-l-destructive px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Regularização necessária</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Documentos vencidos impedem a habilitação da empresa
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums text-foreground">
                {bloqueantes} documento{bloqueantes > 1 ? 's' : ''}
              </p>
              <p className="text-[11px] font-medium text-destructive">Bloqueia habilitação</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
        {atencao > 0 && (
          <Link
            to="/calendario"
            className="flex items-center gap-3 border-l-4 border-l-warning px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Renovação preventiva</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Documento{atencao > 1 ? 's' : ''} próximo{atencao > 1 ? 's' : ''} do vencimento nos próximos 30 dias
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums text-foreground">
                {atencao} documento{atencao > 1 ? 's' : ''}
              </p>
              <p className="text-[11px] font-medium text-warning">Vence em 30 dias</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
