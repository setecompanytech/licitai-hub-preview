import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface IBGEMunicipio {
  id: number;
  nome: string;
  uf: string;
}

interface Props {
  label: string;
  ufs: string[]; // UFs selecionadas no filtro de Unidades da Federação
  selecionados: string[]; // valores no formato "Município/UF"
  onToggle: (valor: string) => void;
  onClear: () => void;
}

// Cache em memória durante a sessão
const cache = new Map<string, IBGEMunicipio[]>();

async function fetchMunicipiosUF(uf: string): Promise<IBGEMunicipio[]> {
  if (cache.has(uf)) return cache.get(uf)!;
  const resp = await fetch(
    `https://servicosdados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  );
  if (!resp.ok) throw new Error(`Falha IBGE ${uf}`);
  const data: any[] = await resp.json();
  const list: IBGEMunicipio[] = data.map((m) => ({
    id: m.id,
    nome: m.nome,
    uf,
  }));
  cache.set(uf, list);
  return list;
}

export default function MunicipiosByUFSelect({
  label,
  ufs,
  selecionados,
  onToggle,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [municipios, setMunicipios] = useState<IBGEMunicipio[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (ufs.length === 0) {
        setMunicipios([]);
        return;
      }
      setCarregando(true);
      setErro(null);
      try {
        const todos = await Promise.all(ufs.map(fetchMunicipiosUF));
        if (cancelado) return;
        const merged = todos.flat();
        merged.sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
        );
        setMunicipios(merged);
      } catch (e: any) {
        if (!cancelado) setErro(e.message || "Erro ao carregar municípios");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ufs.join(",")]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return municipios.slice(0, 300);
    const q = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Mn}/gu, "");
    return municipios
      .filter((m) =>
        m.nome
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Mn}/gu, "")
          .includes(q)
      )
      .slice(0, 300);
  }, [municipios, busca]);

  const ufsVazias = ufs.length === 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
      <Label className="md:col-span-2 text-xs text-muted-foreground pt-2">
        {label}
      </Label>
      <div className="md:col-span-10 space-y-2">
        <p className="text-[11px] text-muted-foreground">
          {ufsVazias
            ? "Selecione uma ou mais UFs acima para listar municípios"
            : `${municipios.length.toLocaleString("pt-BR")} municípios disponíveis (IBGE) para ${ufs.join(", ")}`}
        </p>

        <div className="rounded-md border border-border bg-background min-h-[40px] px-2 py-1.5 flex flex-wrap gap-1.5 items-center">
          {selecionados.length === 0 ? (
            <span className="text-xs text-muted-foreground px-1.5">
              {ufsVazias
                ? "Indisponível sem UF"
                : "Nenhum município selecionado"}
            </span>
          ) : (
            selecionados.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-medium"
              >
                {v}
                <button
                  onClick={() => onToggle(v)}
                  className="hover:text-accent-foreground"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          <div className="ml-auto flex items-center gap-1">
            {selecionados.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-destructive"
                type="button"
              >
                Excluir
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((o) => !o)}
              disabled={ufsVazias}
              type="button"
              className="h-6 text-[11px] px-2"
            >
              {open ? (
                <ChevronUp className="w-3 h-3 mr-1" />
              ) : (
                <ChevronDown className="w-3 h-3 mr-1" />
              )}
              Selecionar
            </Button>
          </div>
        </div>

        {open && !ufsVazias && (
          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar município…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {carregando && (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando municípios do IBGE…
              </div>
            )}
            {erro && (
              <p className="text-xs text-destructive">{erro}</p>
            )}

            {!carregando && !erro && (
              <>
                <div className="max-h-64 overflow-y-auto rounded border border-border/60">
                  {filtrados.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      Nenhum município encontrado.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {filtrados.map((m) => {
                        const valor = `${m.nome}/${m.uf}`;
                        const ativo = selecionados.includes(valor);
                        return (
                          <li key={`${m.uf}-${m.id}`}>
                            <button
                              type="button"
                              onClick={() => onToggle(valor)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors ${
                                ativo ? "text-accent font-medium" : "text-foreground/80"
                              }`}
                            >
                              <span>
                                {m.nome}{" "}
                                <span className="text-muted-foreground">
                                  / {m.uf}
                                </span>
                              </span>
                              {ativo && <Check className="w-3.5 h-3.5" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {municipios.length > filtrados.length && !busca && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Exibindo 300 de {municipios.length.toLocaleString("pt-BR")} —
                    use a busca para refinar.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
