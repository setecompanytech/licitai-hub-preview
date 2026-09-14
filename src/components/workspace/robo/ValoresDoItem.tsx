import { AlertTriangle, HelpCircle } from 'lucide-react';
import { formatarMoeda } from './formatos';

/**
 * "Não informado" — o que o portal (ou o agente) não disse.
 *
 * Nunca "R$ 0,00" nem "—" sozinho: zero afirma um valor, e o traço solto não
 * diz se é ausência de dado ou de lance. O texto diz; o ícone só acelera.
 */
export function NaoInformado({ texto = 'Não informado' }: { texto?: string }) {
  return (
    <span className="g-meta inline-flex items-center gap-1 text-muted-foreground">
      <HelpCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {texto}
    </span>
  );
}

/**
 * Limite autorizado de um item, com a ressalva que o separa de "ativo".
 *
 * `precificacao_versao_id` diz de onde a configuração tirou o limite;
 * `limites_confirmados_em` diz que o SERVIÇO confirmou tê-lo aplicado. São
 * afirmações diferentes, e só a segunda garante que o robô respeita o número.
 */
export function LimiteDoItem({ valor, confirmado }: { valor: number | null; confirmado: boolean }) {
  const texto = formatarMoeda(valor);
  if (!texto) {
    return (
      <span className="g-meta inline-flex items-center gap-1 text-warning-ink">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Sem limite definido
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="tabular-nums">{texto}</span>
      {!confirmado && (
        <span className="g-meta inline-flex items-center gap-1 text-warning-ink">
          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          não confirmado pelo serviço
        </span>
      )}
    </span>
  );
}
