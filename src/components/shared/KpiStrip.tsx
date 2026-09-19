import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KpiItem {
  rotulo: string;
  valor: string | number;
  /** Subtexto ou delta abaixo do valor. */
  sub?: ReactNode;
  /** ícone lucide-react ou qualquer ReactNode. */
  icone?: ReactNode;
}

interface KpiStripProps {
  itens: KpiItem[];
  /** Quantas colunas forçar no desktop (padrão: auto — igual ao nº de itens, máx 6). */
  colunas?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

/**
 * Linha densa de KPIs — referência visual do praefectus-inteligencia-prototipo.
 * Alternativa mais compacta ao LinhaKpis (que usa cartões expandidos e ícones).
 * Use em telas de módulo onde a densidade de dados importa mais que a separação visual.
 */
export function KpiStrip({ itens, colunas, className }: KpiStripProps) {
  const cols = colunas ?? Math.min(itens.length, 6) as 2 | 3 | 4 | 5 | 6;
  const colMap: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  return (
    <div
      className={cn(
        'ds-kpi-strip',
        /* override de colunas no desktop quando explicitado */
        colunas && `md:[grid-template-columns:repeat(${cols},1fr)]`,
        className,
      )}
    >
      {itens.map((item, i) => (
        <div key={i} className="ds-kpi">
          <div className="ds-kpi__label">
            {item.icone && <span aria-hidden="true">{item.icone}</span>}
            {item.rotulo}
          </div>
          <div className="ds-kpi__value">
            {typeof item.valor === 'number'
              ? item.valor.toLocaleString('pt-BR')
              : item.valor}
          </div>
          {item.sub && <div className="ds-kpi__sub">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
