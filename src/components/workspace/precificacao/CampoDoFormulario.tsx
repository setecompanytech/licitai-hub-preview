import { useId, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Campo rotulado da revisão de preço, com ajuda e erro AMARRADOS ao input.
 *
 * `aria-describedby` aponta para os dois: quem navega por leitor de tela ouve
 * "Limite autorizado, inválido, O valor não pode ser menor que 0" ao entrar
 * no campo — e não precisa caçar a mensagem vermelha em outro canto.
 *
 * Número vai em `type="text"` com `inputMode="decimal"`: o `type="number"`
 * recusa a vírgula no Safari e apaga "12," no meio da digitação.
 */
export default function CampoDoFormulario({
  rotulo,
  valor,
  aoAlterar,
  erro,
  ajuda,
  tipo = 'text',
  numerico = false,
  sufixo,
  rotuloDoSufixo,
  placeholder,
  desabilitado = false,
  className,
}: {
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  erro?: string | null;
  ajuda?: ReactNode;
  tipo?: 'text' | 'date';
  numerico?: boolean;
  /** Unidade exibida dentro do campo ("%"). */
  sufixo?: string;
  /** Unidade por extenso para o leitor de tela ("em percentual"). */
  rotuloDoSufixo?: string;
  placeholder?: string;
  desabilitado?: boolean;
  className?: string;
}) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const descritores = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <Label htmlFor={id} className="g-corpo font-medium text-foreground">
        {rotulo}
        {rotuloDoSufixo && <span className="sr-only"> ({rotuloDoSufixo})</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={tipo}
          inputMode={numerico ? 'decimal' : undefined}
          autoComplete="off"
          value={valor}
          placeholder={placeholder}
          disabled={desabilitado}
          onChange={(e) => aoAlterar(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritores}
          className={cn(
            'g-controle h-10 rounded-[var(--g-raio)]',
            numerico && 'text-right tabular-nums',
            sufixo && 'pr-8',
            erro && 'border-destructive-line',
          )}
        />
        {sufixo && (
          <span
            aria-hidden="true"
            className="g-corpo pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground"
          >
            {sufixo}
          </span>
        )}
      </div>
      {ajuda && (
        <p id={idAjuda} className="g-meta text-muted-foreground">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className="g-meta text-destructive-ink">
          {erro}
        </p>
      )}
    </div>
  );
}
