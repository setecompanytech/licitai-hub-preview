import * as React from "react";

import { cn } from "@/lib/utils";
import { useSombraDeRolagem } from "@/hooks/useSombraDeRolagem";
import { useTabelaEmpilhada } from "@/hooks/useTabelaEmpilhada";
import { CLASSE_TABELA_EMPILHADA } from "@/lib/ui/tabela-empilhada";
import { SombrasDeRolagem } from "./sombras-de-rolagem";

/**
 * Tabela — a peça central do Praefectus. Cabeçalho em superfície rebaixada
 * (`secondary`), rótulos de 12px em peso 600, linhas de 48px, corpo em 13px,
 * hover discreto e seleção na tinta verde. A rolagem horizontal fica presa
 * ao contêiner, nunca na página — e as sombras nas bordas dizem que há coluna
 * escondida (`useSombraDeRolagem`, o mesmo sinal da `TabelaGestao`).
 *
 * Até 22/09 o invólucro levava `contain-text`, cuja regra `overflow: hidden`
 * vencia o `overflow-auto` no CSS compilado: a tabela mais larga que a tela
 * era CORTADA, não rolável, em todas as telas ("Ações" virava "Aç…" em
 * Editais, 17/09; "FUNDA / ESTAD" no celular, 22/09).
 *
 * No celular, a tabela que não cabe vira uma pilha de registros, cada célula
 * com o título da própria coluna (`useTabelaEmpilhada` + `.tabela-empilhada`
 * em index.css). A que cabe continua tabela. A tela pode fixar o rótulo de
 * uma célula com `data-rotulo`; célula vazia some da pilha.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const caixa = React.useRef<HTMLDivElement>(null);
    const empilhada = useTabelaEmpilhada(caixa);
    const sombra = useSombraDeRolagem(caixa, [empilhada]);
    return (
      <div className="relative w-full min-w-0 max-w-full">
        <div ref={caixa} className={cn("w-full overflow-auto", empilhada && CLASSE_TABELA_EMPILHADA)}>
          <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
        </div>
        <SombrasDeRolagem sombra={sombra} />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("bg-secondary [&_tr]:border-b [&_tr]:border-border", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t border-border bg-secondary font-semibold [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border transition-colors duration-150 hover:bg-muted/60 data-[state=selected]:bg-primary-tint/60",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 whitespace-nowrap px-4 text-left align-middle text-xs font-semibold tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Trunca o conteúdo com reticências quando exceder o espaço disponível. */
  truncate?: boolean;
  /** Impede quebra de linha (útil para datas, valores e números de documento). */
  nowrap?: boolean;
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, truncate, nowrap, children, title, ...props }, ref) => {
    const inferredTitle =
      title ?? (truncate && typeof children === "string" ? children : undefined);
    return (
      <td
        ref={ref}
        className={cn(
          "h-12 px-4 py-2.5 align-middle text-sm text-foreground [&:has([role=checkbox])]:pr-0",
          truncate && "max-w-[280px] truncate",
          nowrap && "whitespace-nowrap",
          className,
        )}
        title={inferredTitle}
        {...props}
      >
        {children}
      </td>
    );
  },
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
