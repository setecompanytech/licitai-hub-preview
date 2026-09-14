import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { HUB_ITEMS } from "@/components/financeiro/FinHomeHub";

interface Props {
  onNavigate: (id: string) => void;
}

export default function FinCommandPalette({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);

  /**
   * Esta paleta NÃO responde mais a Ctrl+K (13/09/2026).
   *
   * Ela disputava a tecla com a busca global (`GlobalSearch`), que é montada em
   * toda tela interna pelo `AppLayout`. Dentro do Financeiro, portanto, um
   * Ctrl+K abria DOIS diálogos empilhados — e o de cima era decidido pela ordem
   * de montagem, não por escolha de ninguém.
   *
   * Quem fica com a tecla é a busca global, porque atende as 56 telas e conhece
   * também os módulos do Financeiro (`GlobalSearch` indexa `HUB_ITEMS`): quem
   * digita Ctrl+K aqui continua achando o que procurava. Esta paleta segue viva
   * pelo gatilho da própria tela e pelo evento abaixo.
   */
  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener("praefectus:abrir-paleta-financeiro", abrir);
    return () => window.removeEventListener("praefectus:abrir-paleta-financeiro", abrir);
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
      {/* O CommandDialog monta um DialogContent sem título: sem isto o leitor de
          tela anuncia "diálogo" sem nome e o Radix avisa no console. O Radix
          resolve o aria-labelledby mesmo com o título dentro do Command. */}
      <DialogTitle className="sr-only">Buscar no Financeiro</DialogTitle>
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
                    <Icon className="w-4 h-4 mr-2" aria-hidden="true" />
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
