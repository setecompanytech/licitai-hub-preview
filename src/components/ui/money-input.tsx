import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { interpretarValorColado } from "@/lib/financeiro/valor-colado";

/**
 * MoneyInput — campo de entrada formatado em padrão monetário pt-BR (R$ 1.234,56).
 *
 * - Exibe sempre com prefixo "R$" e separadores brasileiros (ponto = milhar, vírgula = decimal).
 * - Mantém o valor interno como `number` (ex.: 5400 → "R$ 5.400,00").
 * - Aceita digitação livre: o usuário digita apenas dígitos e o componente formata em tempo real,
 *   evitando o spinner do `<input type="number">`.
 *
 * Uso:
 *   <MoneyInput value={preco} onValueChange={setPreco} />
 */

const formatBRL = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

const toCents = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
};

export interface MoneyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "defaultValue"
  > {
  /** Valor em reais (ex.: 5400 = R$ 5.400,00). */
  value: number | string | null | undefined;
  /** Recebe o valor numérico em reais (não em centavos). */
  onValueChange: (value: number) => void;
  /** Permite valor negativo. Default: false. */
  allowNegative?: boolean;
  /**
   * Máximo de dígitos aceitos (inteiros + 2 decimais). Default 14, que é o
   * teto de numeric(14,2) — evita tanto o "numeric field overflow" no submit
   * quanto dígitos mudando sozinhos além da precisão do JS.
   */
  maxDigits?: number;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, allowNegative = false, maxDigits = 14, className, onBlur, onFocus, onPaste, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(() => formatBRL(toCents(value)));
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
      if (!isFocused) setDisplay(formatBRL(toCents(value)));
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const negative = allowNegative && raw.trim().startsWith("-");
      // O corte em maxDigits descarta a tecla excedente em vez de deixar o
      // parseInt passar da precisão do JS e "mudar" dígitos já exibidos.
      const digits = raw.replace(/\D/g, "").slice(0, maxDigits);
      const cents = digits === "" ? 0 : parseInt(digits, 10);
      const signed = negative ? -cents : cents;
      setDisplay(formatBRL(signed));
      onValueChange(signed / 100);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      onPaste?.(e);
      if (e.defaultPrevented) return;

      const interpretado = interpretarValorColado(e.clipboardData.getData("text"));
      if (interpretado === null) return; // sem número legível: segue a máscara

      e.preventDefault();
      const semSinal = allowNegative ? interpretado : Math.abs(interpretado);
      const cents = Math.round(semSinal * 100);
      // Valor colado acima do teto: melhor não fazer nada do que truncar em
      // silêncio um número que o usuário conferiu na origem.
      if (String(Math.abs(cents)).length > maxDigits) return;

      setDisplay(formatBRL(cents));
      onValueChange(cents / 100);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={(e) => {
          setIsFocused(true);
          // Posiciona o cursor no final para edição natural
          requestAnimationFrame(() => {
            const len = e.target.value.length;
            try {
              e.target.setSelectionRange(len, len);
            } catch {
              /* noop */
            }
          });
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          setDisplay(formatBRL(toCents(value)));
          onBlur?.(e);
        }}
        className={cn("text-right tabular-nums", className)}
        {...props}
      />
    );
  }
);
MoneyInput.displayName = "MoneyInput";

export default MoneyInput;
