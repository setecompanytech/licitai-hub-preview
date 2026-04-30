import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * BancoSelectorLogos
 * — Seletor sofisticado de bancos brasileiros com logos visuais.
 * — Logos servidas via CDN público (gilbarbara/logos) com fallback gracioso.
 * — Reutilizável em cadastro de contas, filtros e qualquer fluxo financeiro.
 */

export interface BancoOption {
  codigo: string;
  nome: string;
  apelido?: string; // slug/identificador curto p/ logo
}

export const BANCOS_BRASIL: BancoOption[] = [
  { codigo: "001", nome: "Banco do Brasil", apelido: "bb" },
  { codigo: "003", nome: "Banco da Amazônia", apelido: "basa" },
  { codigo: "004", nome: "Banco do Nordeste", apelido: "bnb" },
  { codigo: "021", nome: "Banestes", apelido: "banestes" },
  { codigo: "025", nome: "Banco Alfa", apelido: "alfa" },
  { codigo: "033", nome: "Santander", apelido: "santander" },
  { codigo: "037", nome: "Banpará", apelido: "banpara" },
  { codigo: "041", nome: "Banrisul", apelido: "banrisul" },
  { codigo: "047", nome: "Banese", apelido: "banese" },
  { codigo: "070", nome: "BRB - Banco de Brasília", apelido: "brb" },
  { codigo: "077", nome: "Banco Inter", apelido: "inter" },
  { codigo: "082", nome: "Banco Topázio", apelido: "topazio" },
  { codigo: "104", nome: "Caixa Econômica Federal", apelido: "caixa" },
  { codigo: "136", nome: "Unicred", apelido: "unicred" },
  { codigo: "184", nome: "Itaú BBA", apelido: "itau" },
  { codigo: "197", nome: "Stone", apelido: "stone" },
  { codigo: "208", nome: "BTG Pactual", apelido: "btg" },
  { codigo: "212", nome: "Banco Original", apelido: "original" },
  { codigo: "237", nome: "Bradesco", apelido: "bradesco" },
  { codigo: "246", nome: "ABC Brasil", apelido: "abc" },
  { codigo: "260", nome: "Nubank", apelido: "nubank" },
  { codigo: "290", nome: "PagBank", apelido: "pagbank" },
  { codigo: "318", nome: "Banco BMG", apelido: "bmg" },
  { codigo: "323", nome: "Mercado Pago", apelido: "mercadopago" },
  { codigo: "336", nome: "Banco C6", apelido: "c6" },
  { codigo: "341", nome: "Itaú Unibanco", apelido: "itau" },
  { codigo: "364", nome: "Gerencianet", apelido: "gerencianet" },
  { codigo: "376", nome: "JP Morgan", apelido: "jpmorgan" },
  { codigo: "380", nome: "PicPay", apelido: "picpay" },
  { codigo: "389", nome: "Mercantil do Brasil", apelido: "mercantil" },
  { codigo: "399", nome: "HSBC", apelido: "hsbc" },
  { codigo: "422", nome: "Safra", apelido: "safra" },
  { codigo: "473", nome: "Banco Caixa Geral", apelido: "caixageral" },
  { codigo: "600", nome: "Banco Luso Brasileiro", apelido: "luso" },
  { codigo: "633", nome: "Banco Rendimento", apelido: "rendimento" },
  { codigo: "637", nome: "Banco Sofisa", apelido: "sofisa" },
  { codigo: "655", nome: "Banco Votorantim (BV)", apelido: "bv" },
  { codigo: "707", nome: "Daycoval", apelido: "daycoval" },
  { codigo: "735", nome: "Neon", apelido: "neon" },
  { codigo: "739", nome: "Cetelem", apelido: "cetelem" },
  { codigo: "741", nome: "Banco Ribeirão Preto", apelido: "brp" },
  { codigo: "745", nome: "Citibank", apelido: "citi" },
  { codigo: "748", nome: "Sicredi", apelido: "sicredi" },
  { codigo: "756", nome: "Sicoob", apelido: "sicoob" },
  { codigo: "077", nome: "Banco Inter", apelido: "inter" },
];

// Mapa de logos — usa CDN público gratuito (pix-logo / brasil-banks).
// Fallback automático para ícone quando não disponível.
const LOGO_BASE = "https://logosmarcas.net/wp-content/uploads/2020/04";
const CUSTOM_LOGOS: Record<string, string> = {
  "001": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Banco_do_Brasil_logo.svg/200px-Banco_do_Brasil_logo.svg.png",
  "033": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Banco_Santander_Logotipo.svg/200px-Banco_Santander_Logotipo.svg.png",
  "104": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Caixa_Econ%C3%B4mica_Federal_logo.svg/200px-Caixa_Econ%C3%B4mica_Federal_logo.svg.png",
  "237": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Banco_Bradesco_logo_%28horizontal%29.svg/200px-Banco_Bradesco_logo_%28horizontal%29.svg.png",
  "260": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Nubank_Logo.svg/200px-Nubank_Logo.svg.png",
  "341": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Banco_Ita%C3%BA_logo.svg/200px-Banco_Ita%C3%BA_logo.svg.png",
  "077": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Banco_Inter_logo_2.svg/200px-Banco_Inter_logo_2.svg.png",
  "336": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Banco_C6_logo.svg/200px-Banco_C6_logo.svg.png",
  "208": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/BTG_Pactual_logo.svg/200px-BTG_Pactual_logo.svg.png",
  "748": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Sicredi_logo.svg/200px-Sicredi_logo.svg.png",
  "756": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Sicoob_logo.svg/200px-Sicoob_logo.svg.png",
  "422": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Banco_Safra_logo.svg/200px-Banco_Safra_logo.svg.png",
  "323": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Mercado_Pago_logo.svg/200px-Mercado_Pago_logo.svg.png",
  "380": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/PicPay_logo.svg/200px-PicPay_logo.svg.png",
  "070": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/BRB_logo.svg/200px-BRB_logo.svg.png",
  "212": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Banco_Original_logo.svg/200px-Banco_Original_logo.svg.png",
  "041": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Banrisul_logo.svg/200px-Banrisul_logo.svg.png",
  "655": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Banco_BV_logo.svg/200px-Banco_BV_logo.svg.png",
  "735": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Neon_logo.svg/200px-Neon_logo.svg.png",
  "290": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/PagBank_logo.svg/200px-PagBank_logo.svg.png",
  "197": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Stone_logo.svg/200px-Stone_logo.svg.png",
};

export function getBancoLogoUrl(codigo: string): string | null {
  return CUSTOM_LOGOS[codigo] ?? null;
}

export function findBanco(value: string | null | undefined): BancoOption | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return BANCOS_BRASIL.find(
    (b) =>
      `${b.codigo} - ${b.nome}`.toLowerCase() === v ||
      b.nome.toLowerCase() === v ||
      b.codigo === v.split(" ")[0],
  );
}

interface BancoLogoProps {
  codigo?: string | null;
  nome?: string | null;
  size?: number;
  className?: string;
}

export function BancoLogo({ codigo, nome, size = 28, className }: BancoLogoProps) {
  const url = codigo ? getBancoLogoUrl(codigo) : null;
  const [erro, setErro] = useState(false);

  if (!url || erro) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-muted text-muted-foreground border border-border/60",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={nome ?? "Banco"}
      >
        <Building2 className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-white border border-border/60 overflow-hidden p-1",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={url}
        alt={nome ?? "Logo do banco"}
        className="max-w-full max-h-full object-contain"
        loading="lazy"
        onError={() => setErro(true)}
      />
    </div>
  );
}

interface BancoSelectorLogosProps {
  value: string;
  onChange: (value: string, banco?: BancoOption) => void;
  placeholder?: string;
  /** Se `true`, inclui opção "Todos os bancos" no topo (útil para filtros). */
  allowAll?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function BancoSelectorLogos({
  value,
  onChange,
  placeholder = "Selecione o banco…",
  allowAll = false,
  className,
  disabled,
}: BancoSelectorLogosProps) {
  const [open, setOpen] = useState(false);

  // Deduplica por código (a lista contém duplicatas históricas para Inter)
  const bancos = useMemo(() => {
    const map = new Map<string, BancoOption>();
    for (const b of BANCOS_BRASIL) if (!map.has(b.codigo)) map.set(b.codigo, b);
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, []);

  const selected = findBanco(value);
  const isAll = allowAll && (!value || value === "__all__");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal h-10 px-2.5", className)}
        >
          <span className="flex items-center gap-2 min-w-0">
            {isAll ? (
              <>
                <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <span className="truncate">Todos os bancos</span>
              </>
            ) : selected ? (
              <>
                <BancoLogo codigo={selected.codigo} nome={selected.nome} size={28} />
                <span className="truncate">
                  <span className="text-muted-foreground tabular-nums mr-1">{selected.codigo}</span>
                  {selected.nome}
                </span>
              </>
            ) : value ? (
              <>
                <BancoLogo nome={value} size={28} />
                <span className="truncate">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={6}
      >
        <Command
          filter={(itemValue, search) => {
            const s = search.toLowerCase();
            return itemValue.toLowerCase().includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nome ou código…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
            <CommandGroup>
              {allowAll && (
                <CommandItem
                  value="todos os bancos"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <span className="flex-1">Todos os bancos</span>
                  <Check
                    className={cn("h-4 w-4", isAll ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              )}
              {bancos.map((b) => {
                const label = `${b.codigo} - ${b.nome}`;
                const isSel = selected?.codigo === b.codigo;
                return (
                  <CommandItem
                    key={b.codigo}
                    value={`${b.codigo} ${b.nome}`}
                    onSelect={() => {
                      onChange(label, b);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <BancoLogo codigo={b.codigo} nome={b.nome} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{b.nome}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        Código {b.codigo}
                      </div>
                    </div>
                    <Check
                      className={cn("h-4 w-4", isSel ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
