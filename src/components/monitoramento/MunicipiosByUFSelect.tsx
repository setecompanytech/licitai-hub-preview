import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchMunicipiosUF, type IBGEMunicipio } from "@/lib/ibge-municipios";

interface Props {
  label: string;
  ufs: string[]; // UFs selecionadas no filtro de Unidades da Federação
  selecionados: string[]; // valores no formato "Município/UF"
  onToggle: (valor: string) => void;
  onClear: () => void;
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
      <Label className="md:col-span-2 pt-2 text-sm text-foreground">
        {label}
      </Label>
      <div className="md:col-span-10 space-y-2">
        <p className="text-sm text-muted-foreground">
          {ufsVazias
            ? "Selecione uma ou mais UFs acima para listar municípios"
            : `${municipios.length.toLocaleString("pt-BR")} municípios disponíveis (IBGE) para ${ufs.join(", ")}`}
        </p>

        <div
          className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 shadow-sm transition-colors duration-150 ${!ufsVazias ? "cursor-pointer bg-card hover:border-foreground-tertiary" : "bg-muted"}`}
          onClick={() => { if (!ufsVazias) setOpen((o) => !o); }}
        >
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
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground"
              >
                {v}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(v); }}
                  className="rounded-sm hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                  aria-label={`Remover ${v}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))
          )}
          <div className="ml-auto flex items-center gap-1">
            {selecionados.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive-ink"
                type="button"
              >
                Excluir
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); if (!ufsVazias) setOpen((o) => !o); }}
              disabled={ufsVazias}
              type="button"
              aria-expanded={open}
              className="h-8 px-2 text-xs"
            >
              {open ? (
                <ChevronUp aria-hidden="true" />
              ) : (
                <ChevronDown aria-hidden="true" />
              )}
              Selecionar
            </Button>
          </div>
        </div>

        {open && !ufsVazias && (
          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar município…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8"
              />
            </div>

            {carregando && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Carregando municípios do IBGE…
              </div>
            )}
            {erro && (
              <p className="text-sm text-destructive-ink" role="alert">{erro}</p>
            )}

            {!carregando && !erro && (
              <>
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  {filtrados.length === 0 ? (
                    <p className="p-3 text-center text-sm text-muted-foreground">
                      Nenhum município encontrado.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filtrados.map((m) => {
                        const valor = `${m.nome}/${m.uf}`;
                        const ativo = selecionados.includes(valor);
                        return (
                          <li key={`${m.uf}-${m.id}`}>
                            <button
                              type="button"
                              onClick={() => onToggle(valor)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                                ativo ? "bg-primary-tint font-medium text-primary" : "text-foreground"
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
                  <p className="text-xs text-muted-foreground text-center">
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
