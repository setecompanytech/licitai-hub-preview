import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { HUB_ITEMS } from "@/components/financeiro/FinHomeHub";

interface Props {
  onNavigate: (id: string) => void;
}

export default function FinCommandPalette({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const groups = ["operacao", "bancos", "fiscal", "relatorios", "cadastros"] as const;
  const labels: Record<string, string> = {
    operacao: "Operação Diária",
    bancos: "Bancos",
    fiscal: "Fiscal",
    relatorios: "Relatórios",
    cadastros: "Cadastros",
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar funcionalidade do Financeiro..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {groups.map((g) => {
          const items = HUB_ITEMS.filter((i) => i.group === g);
          if (!items.length) return null;
          return (
            <CommandGroup key={g} heading={labels[g]}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => {
                      onNavigate(item.id);
                      setOpen(false);
                    }}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span>{item.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground truncate">{item.description}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
