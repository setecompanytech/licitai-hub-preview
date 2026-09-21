import { Link } from 'react-router-dom';
import { ChevronRight, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContratosAguardandoDecisao } from '@/hooks/useContratosAguardandoDecisao';
import { rotuloDoMotivo } from '@/lib/contratos/encerramento';

/**
 * Contratos esperando a decisão de fim — o bloco do Painel geral (decisão 4
 * do dono, 21/09).
 *
 * O Resumo de cada contrato já pergunta "chegou ao fim?" quando o saldo se
 * esgota ou a vigência vence; quem não abre o contrato não vê a pergunta.
 * Este bloco cobra a decisão de quem gere: quantos contratos esperam, qual
 * o sinal de cada um, e o caminho para decidir — que continua sendo o
 * Resumo, onde estão saldo, vigência, aditivos e pedidos. Aqui não se
 * encerra nada.
 *
 * Sem pendência o bloco não aparece: o Painel já tem o que mostrar, e uma
 * faixa verde "nenhum contrato esperando" seria ruído.
 */
export default function ContratosAguardandoDecisao() {
  const { data, isLoading, error } = useContratosAguardandoDecisao();

  if (isLoading || error || !data || data.length === 0) return null;

  const esgotados = data.filter((c) => c.sugestao.motivo !== 'prazo_vencido').length;
  const vencidos = data.length - esgotados;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-sm" data-testid="contratos-aguardando-decisao">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning-tint text-warning-ink" aria-hidden="true">
          <FileSignature className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-6 text-foreground">
            {data.length === 1 ? '1 contrato espera uma decisão' : `${data.length} contratos esperam uma decisão`}
          </p>
          <p className="text-xs text-muted-foreground">
            Saldo esgotado ou vigência vencida sem encerramento declarado: registrar aditivo ou encerrar
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {esgotados > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-warning-line bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
              {esgotados} saldo esgotado
            </span>
          )}
          {vencidos > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-destructive-line bg-destructive-tint px-2 py-0.5 text-xs font-semibold text-destructive-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
              {vencidos} vigência vencida
            </span>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/gestao-contratos">Abrir contratos</Link>
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {data.slice(0, 5).map((c) => (
          <li key={c.id}>
            <Link
              to={`/gestao-contratos?contrato=${c.id}&aba=dashboard`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.instrumento === 'ata' ? 'Ata' : 'Contrato'} {c.numero}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.sugestao.titulo}</p>
              </div>
              <p className="shrink-0 text-xs font-medium text-muted-foreground">{rotuloDoMotivo(c.sugestao.motivo)}</p>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
        {data.length > 5 && (
          <li className="px-4 py-2 text-xs text-muted-foreground">
            e mais {data.length - 5}: veja em Gestão de Contratos, filtro "Em andamento".
          </li>
        )}
      </ul>
    </div>
  );
}
