import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, allowNegative = false, className, onBlur, onFocus, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(() => formatBRL(toCents(value)));
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
      if (!isFocused) setDisplay(formatBRL(toCents(value)));
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const negative = allowNegative && raw.trim().startsWith("-");
      const digits = raw.replace(/\D/g, "");
      const cents = digits === "" ? 0 : parseInt(digits, 10);
      const signed = negative ? -cents : cents;
      setDisplay(formatBRL(signed));
      onValueChange(signed / 100);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
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
