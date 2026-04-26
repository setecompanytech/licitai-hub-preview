import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CFOPS_COMPLETOS, type CFOPCompleto } from "@/lib/cfopCompleto";
import { validarCFOP } from "@/lib/nfeReference";

interface CFOPSelectProps {
  value: string;
  onChange: (codigo: string) => void;
  /** Restringe à direção da operação (saída por padrão para emissão de NF-e). */
  tipo?: "saida" | "entrada";
  /** Restringe ao destino (mesma UF / outra UF / exterior). */
  ufDestino?: "mesma" | "outra" | "exterior";
  /** UF do emitente (para validação anti-rejeição 733). */
  ufEmitente?: string;
  /** UF do destinatário (para validação anti-rejeição 733). */
  ufDestinatario?: string;
  /** Finalidade da NF-e (1 normal, 2 complementar, 3 ajuste, 4 devolução). */
  finalidade?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Seletor de CFOP com busca por código ou descrição, agrupado por categoria
 * oficial da Receita Federal. Inclui validação preventiva contra as rejeições
 * mais comuns da SEFAZ (327 — devolução; 733 — UF incompatível) e tooltip
 * explicativo da estrutura dos 4 dígitos.
 */
export function CFOPSelect({
  value, onChange, tipo = "saida", ufDestino, ufEmitente, ufDestinatario,
  finalidade, placeholder = "Buscar CFOP...", className, disabled,
}: CFOPSelectProps) {
  const [open, setOpen] = useState(false);

  const opcoes = useMemo<CFOPCompleto[]>(
    () => CFOPS_COMPLETOS.filter(
      (c) => c.tipo === tipo && (!ufDestino || c.uf_destino === ufDestino)
    ),
    [tipo, ufDestino]
  );

  const grupos = useMemo(() => {
    const map = new Map<string, CFOPCompleto[]>();
    for (const c of opcoes) {
      const arr = map.get(c.categoria) ?? [];
      arr.push(c);
      map.set(c.categoria, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [opcoes]);

  const selecionado = opcoes.find((c) => c.codigo === value);

  const validacao = useMemo(
    () => (value ? validarCFOP(value, { ufEmitente, ufDestinatario, finalidade }) : { ok: true }),
    [value, ufEmitente, ufDestinatario, finalidade]
  );

  return (
    <div className={cn("space-y-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !validacao.ok && "border-destructive"
            )}
          >
            {selecionado ? (
              <span className="flex items-center gap-2 truncate">
                <Badge variant="secondary" className="font-mono">{selecionado.codigo}</Badge>
                <span className="truncate text-sm">{selecionado.descricao}</span>
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-2">
                <Search className="w-4 h-4" />
                {placeholder}
              </span>
            )}
            <span className="ml-2 flex items-center gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Info className="h-4 w-4 opacity-50 hover:opacity-100" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-xs space-y-1">
                    <p className="font-semibold">Estrutura do CFOP (4 dígitos)</p>
                    <p><b>1º</b> – Origem/destino: 1/5 mesma UF · 2/6 outra UF · 3/7 exterior</p>
                    <p><b>2º</b> – Grupo da operação (compra, venda, devolução…)</p>
                    <p><b>3º e 4º</b> – Especificação detalhada (ex.: 102 = comercialização)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[520px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Digite código ou descrição..." />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>Nenhum CFOP encontrado.</CommandEmpty>
              {grupos.map(([categoria, lista]) => (
                <CommandGroup key={categoria} heading={categoria}>
                  {lista.map((c) => (
                    <CommandItem
                      key={c.codigo}
                      value={`${c.codigo} ${c.descricao}`}
                      onSelect={() => { onChange(c.codigo); setOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === c.codigo ? "opacity-100" : "opacity-0")} />
                      <Badge variant="outline" className="mr-2 font-mono shrink-0">{c.codigo}</Badge>
                      <span className="text-xs">{c.descricao}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {!validacao.ok && validacao.alerta && (
        <p className="text-xs text-destructive flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            {validacao.codigoRejeicao && (
              <span className="font-semibold">Rejeição {validacao.codigoRejeicao}: </span>
            )}
            {validacao.alerta}
          </span>
        </p>
      )}
    </div>
  );
}
