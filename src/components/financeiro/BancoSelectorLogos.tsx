import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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

/**
 * Identidade visual oficial dos principais bancos brasileiros.
 * Renderizada via SVG inline (cor da marca + iniciais), garantindo
 * disponibilidade 100% offline, sem dependência de CDN externo.
 */
interface BrandStyle {
  bg: string;
  fg: string;
  initials: string; // 1-3 caracteres
}

const BRAND: Record<string, BrandStyle> = {
  "001": { bg: "#FAE128", fg: "#003A70", initials: "BB" },        // Banco do Brasil
  "003": { bg: "#005CA9", fg: "#FFFFFF", initials: "BASA" },      // Banco da Amazônia
  "004": { bg: "#A6192E", fg: "#FFFFFF", initials: "BNB" },       // Banco do Nordeste
  "021": { bg: "#0066B3", fg: "#FFFFFF", initials: "BTS" },       // Banestes
  "025": { bg: "#0033A0", fg: "#FFFFFF", initials: "α" },         // Banco Alfa
  "033": { bg: "#EC0000", fg: "#FFFFFF", initials: "S" },         // Santander
  "037": { bg: "#005DAA", fg: "#FFFFFF", initials: "BPA" },       // Banpará
  "041": { bg: "#005CA9", fg: "#FFFFFF", initials: "BR" },        // Banrisul
  "047": { bg: "#005CA9", fg: "#FFFFFF", initials: "BSE" },       // Banese
  "070": { bg: "#003F7F", fg: "#FFFFFF", initials: "BRB" },       // BRB
  "077": { bg: "#FF7A00", fg: "#FFFFFF", initials: "INT" },       // Banco Inter
  "082": { bg: "#0E2A47", fg: "#FFFFFF", initials: "TPZ" },       // Topázio
  "104": { bg: "#0070AF", fg: "#FFFFFF", initials: "CEF" },       // Caixa
  "136": { bg: "#00754A", fg: "#FFFFFF", initials: "UC" },        // Unicred
  "184": { bg: "#003399", fg: "#FF6900", initials: "IBA" },       // Itaú BBA
  "197": { bg: "#00A868", fg: "#FFFFFF", initials: "ST" },        // Stone
  "208": { bg: "#0F1B2D", fg: "#C8A04A", initials: "BTG" },       // BTG Pactual
  "212": { bg: "#00B259", fg: "#FFFFFF", initials: "ORG" },       // Original
  "237": { bg: "#CC092F", fg: "#FFFFFF", initials: "BD" },        // Bradesco
  "246": { bg: "#0033A0", fg: "#FFFFFF", initials: "ABC" },       // ABC Brasil
  "260": { bg: "#820AD1", fg: "#FFFFFF", initials: "Nu" },        // Nubank
  "290": { bg: "#FFC907", fg: "#1A1A1A", initials: "PB" },        // PagBank
  "318": { bg: "#FF6F00", fg: "#FFFFFF", initials: "BMG" },       // BMG
  "323": { bg: "#00B1EA", fg: "#FFFFFF", initials: "MP" },        // Mercado Pago
  "336": { bg: "#242424", fg: "#D4AF37", initials: "C6" },        // C6 Bank
  "341": { bg: "#FF6900", fg: "#003399", initials: "I" },         // Itaú
  "364": { bg: "#0E5BA0", fg: "#FFFFFF", initials: "GN" },        // Gerencianet (Efí)
  "376": { bg: "#0F4C81", fg: "#FFFFFF", initials: "JPM" },       // JP Morgan
  "380": { bg: "#21C25E", fg: "#FFFFFF", initials: "PP" },        // PicPay
  "389": { bg: "#FFB81C", fg: "#1F2A44", initials: "MB" },        // Mercantil
  "399": { bg: "#DB0011", fg: "#FFFFFF", initials: "HSBC" },      // HSBC
  "422": { bg: "#0E2A47", fg: "#C8A04A", initials: "SF" },        // Safra
  "473": { bg: "#005CA9", fg: "#FFFFFF", initials: "BCG" },       // Caixa Geral
  "600": { bg: "#0033A0", fg: "#FFFFFF", initials: "LB" },        // Luso Brasileiro
  "633": { bg: "#0F4C81", fg: "#FFFFFF", initials: "RD" },        // Rendimento
  "637": { bg: "#003D7C", fg: "#FFFFFF", initials: "SF" },        // Sofisa
  "655": { bg: "#FF6B00", fg: "#FFFFFF", initials: "BV" },        // BV
  "707": { bg: "#003D7C", fg: "#FFFFFF", initials: "DC" },        // Daycoval
  "735": { bg: "#0F1F35", fg: "#15E0A6", initials: "NE" },        // Neon
  "739": { bg: "#0033A0", fg: "#FFFFFF", initials: "CT" },        // Cetelem
  "741": { bg: "#0F4C81", fg: "#FFFFFF", initials: "BRP" },       // Ribeirão Preto
  "745": { bg: "#003B70", fg: "#FFFFFF", initials: "C" },         // Citibank
  "748": { bg: "#3FA535", fg: "#FFFFFF", initials: "SC" },        // Sicredi
  "756": { bg: "#003641", fg: "#7DB72F", initials: "SI" },        // Sicoob
};

const DEFAULT_BRAND: BrandStyle = { bg: "#1F2937", fg: "#9CA3AF", initials: "$" };

export function getBrandStyle(codigo?: string | null): BrandStyle {
  if (!codigo) return DEFAULT_BRAND;
  return BRAND[codigo] ?? DEFAULT_BRAND;
}

// Compatibilidade reversa (não há mais URL externa)
export function getBancoLogoUrl(_codigo: string): string | null {
  return null;
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

/**
 * Logos oficiais dos bancos.
 * Carregadas como assets locais via Vite (`src/assets/banks/{codigo}.svg`).
 * Para adicionar novas, basta soltar o SVG no diretório com o nome `{codigoCOMPE}.svg`.
 * Quando não há SVG oficial, exibe um monograma estilizado com a cor da marca.
 */
const LOGO_MODULES = import.meta.glob("@/assets/banks/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const LOGOS_OFICIAIS: Record<string, string> = Object.fromEntries(
  Object.entries(LOGO_MODULES).map(([path, url]) => {
    const codigo = path.split("/").pop()!.replace(".svg", "");
    return [codigo, url];
  }),
);

interface BancoLogoProps {
  codigo?: string | null;
  nome?: string | null;
  size?: number;
  className?: string;
}

export function BancoLogo({ codigo, nome, size = 28, className }: BancoLogoProps) {
  const logoUrl = codigo ? LOGOS_OFICIAIS[codigo] : undefined;
  const [erroImg, setErroImg] = useState(false);

  // Se houver SVG oficial e não falhou ao carregar → renderiza a logo real
  if (logoUrl && !erroImg) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-border/40 bg-white overflow-hidden shrink-0 shadow-sm p-1",
          className,
        )}
        style={{ width: size, height: size }}
        role="img"
        aria-label={nome ?? "Logo do banco"}
      >
        <img
          src={logoUrl}
          alt={nome ?? "Logo do banco"}
          className="max-w-full max-h-full object-contain"
          loading="lazy"
          onError={() => setErroImg(true)}
        />
      </div>
    );
  }

  // Fallback elegante: monograma com cor institucional da marca
  const brand = getBrandStyle(codigo);
  const initials = brand.initials;
  const fontSize =
    initials.length <= 2 ? size * 0.45 : initials.length === 3 ? size * 0.36 : size * 0.28;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-border/40 overflow-hidden shrink-0 shadow-sm",
        className,
      )}
      style={{ width: size, height: size, background: brand.bg }}
      role="img"
      aria-label={nome ?? "Logo do banco"}
    >
      <span
        className="font-bold leading-none tracking-tight tabular-nums select-none"
        style={{
          color: brand.fg,
          fontSize,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {initials}
      </span>
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
