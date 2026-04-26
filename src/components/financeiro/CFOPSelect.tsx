import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CFOPS_COMPLETOS, type CFOPCompleto } from "@/lib/cfopCompleto";

interface CFOPSelectProps {
  value: string;
  onChange: (codigo: string) => void;
  /** Restringe à direção da operação (saída por padrão para emissão de NF-e). */
  tipo?: "saida" | "entrada";
  /** Restringe ao destino (mesma UF / outra UF / exterior). */
  ufDestino?: "mesma" | "outra" | "exterior";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Seletor de CFOP com busca por código ou descrição, agrupado por categoria
 * oficial da Receita Federal. Consulta os 296 códigos do anexo CFOP/ECF.
 */
export function CFOPSelect({
  value, onChange, tipo = "saida", ufDestino, placeholder = "Buscar CFOP...",
  className, disabled,
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
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
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
  );
}
