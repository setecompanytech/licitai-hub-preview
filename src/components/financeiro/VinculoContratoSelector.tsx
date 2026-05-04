import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, FileText, Loader2, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface VinculoContratoValue {
  contrato_id: string | null;
  contrato_item_id: string | null;
  origem_aditivo_id: string | null;
  quantidade: number;
  valor_unitario: number;
}

export interface ContratoOpcao {
  id: string;
  numero_contrato: string;
  objeto: string;
  orgao_contratante: string;
  tipo_documento: "contrato" | "ata_srp";
  saldo_remanescente: number | null;
  valor_global: number;
  status: string;
}

interface ItemOpcao {
  id: string;
  descricao: string;
  unidade: string | null;
  valor_unitario: number;
  saldo_quantitativo: number | null;
  saldo_financeiro: number | null;
  origem_aditivo_id: string | null;
}

interface AditivoOpcao {
  id: string;
  numero_aditivo: string;
  tipo: string;
}

interface Props {
  /** Hint do nome/CNPJ extraído do documento — usado para sugestão automática */
  hintNome?: string | null;
  hintCnpj?: string | null;
  valorTotal?: number | null;
  value: VinculoContratoValue;
  onChange: (v: VinculoContratoValue) => void;
  /** Em a_receber, listamos contratos onde o órgão é o pagador (cliente). Em a_pagar, idem (fornecedor). */
  tipo: "a_receber" | "a_pagar";
}

export default function VinculoContratoSelector({
  hintNome,
  hintCnpj,
  valorTotal,
  value,
  onChange,
  tipo,
}: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  const [contratos, setContratos] = useState<ContratoOpcao[]>([]);
  const [itens, setItens] = useState<ItemOpcao[]>([]);
  const [aditivos, setAditivos] = useState<AditivoOpcao[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingItens, setLoadingItens] = useState(false);

  // Carrega contratos da empresa
  useEffect(() => {
    if (!user || !empresaAtiva) return;
    setLoading(true);
    supabase
      .from("contratos")
      .select(
        "id, numero_contrato, objeto, orgao_contratante, tipo_documento, saldo_remanescente, valor_global, status"
      )
      .eq("user_id", user.id)
      .eq("empresa_id", empresaAtiva.id)
      .in("status", ["vigente", "ativo"])
      .order("data_assinatura", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setContratos((data ?? []) as ContratoOpcao[]);
        setLoading(false);
      });
  }, [user, empresaAtiva]);

  // Carrega itens + aditivos quando contrato selecionado
  useEffect(() => {
    if (!value.contrato_id) {
      setItens([]);
      setAditivos([]);
      return;
    }
    setLoadingItens(true);
    Promise.all([
      supabase
        .from("contrato_itens")
        .select(
          "id, descricao, unidade, valor_unitario, saldo_quantitativo, saldo_financeiro, origem_aditivo_id"
        )
        .eq("contrato_id", value.contrato_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("contrato_aditivos")
        .select("id, numero_aditivo, tipo")
        .eq("contrato_id", value.contrato_id)
        .order("created_at", { ascending: true }),
    ]).then(([iRes, aRes]) => {
      setItens((iRes.data ?? []) as ItemOpcao[]);
      setAditivos((aRes.data ?? []) as AditivoOpcao[]);
      setLoadingItens(false);
    });
  }, [value.contrato_id]);

  // Sugestão automática por nome do órgão / CNPJ
  useEffect(() => {
    if (value.contrato_id || !hintNome || contratos.length === 0) return;
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const target = norm(hintNome);
    if (!target) return;
    const tokens = target.split(" ").filter((t) => t.length >= 4);
    const match = contratos.find((c) => {
      const orgao = norm(c.orgao_contratante || "");
      return tokens.some((t) => orgao.includes(t));
    });
    if (match) {
      setBusca(match.orgao_contratante);
      onChange({ ...value, contrato_id: match.id });
    }
  }, [hintNome, contratos]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return contratos;
    return contratos.filter(
      (c) =>
        c.numero_contrato.toLowerCase().includes(t) ||
        c.orgao_contratante.toLowerCase().includes(t) ||
        c.objeto.toLowerCase().includes(t)
    );
  }, [busca, contratos]);

  const contratoSel = contratos.find((c) => c.id === value.contrato_id);
  const itemSel = itens.find((i) => i.id === value.contrato_item_id);

  const setContrato = (id: string) => {
    onChange({
      ...value,
      contrato_id: id || null,
      contrato_item_id: null,
      origem_aditivo_id: null,
    });
  };

  const setItem = (id: string) => {
    const item = itens.find((i) => i.id === id);
    onChange({
      ...value,
      contrato_item_id: id || null,
      origem_aditivo_id: item?.origem_aditivo_id ?? value.origem_aditivo_id ?? null,
      valor_unitario: item?.valor_unitario ?? value.valor_unitario,
      quantidade:
        value.quantidade && value.quantidade > 0
          ? value.quantidade
          : valorTotal && item?.valor_unitario
            ? Number((valorTotal / item.valor_unitario).toFixed(4))
            : value.quantidade,
    });
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Vincular a um Contrato / ATA SRP {tipo === "a_receber" ? "(cliente)" : "(fornecedor)"}
          </span>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="text-xs text-muted-foreground -mt-1">
          Opcional. Se vinculado, o sistema cria automaticamente um pedido no contrato e
          recalcula saldo financeiro/quantitativo (e da ATA SRP, quando aplicável).
        </div>

        {/* Busca/seleção de contrato */}
        <div>
          <Label className="text-xs">Contrato / ATA</Label>
          <div className="flex gap-2 mt-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nº, órgão ou objeto…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Select value={value.contrato_id ?? ""} onValueChange={setContrato}>
              <SelectTrigger className="h-8 w-[260px] text-xs">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {filtrados.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhum contrato vigente encontrado.
                  </div>
                ) : (
                  filtrados.slice(0, 50).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        {c.tipo_documento === "ata_srp" && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1">
                            ATA
                          </Badge>
                        )}
                        <b>{c.numero_contrato}</b> — {c.orgao_contratante}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {contratoSel && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              Saldo:{" "}
              <b>{fmt(Number(contratoSel.saldo_remanescente ?? contratoSel.valor_global))}</b>{" "}
              · Global: {fmt(contratoSel.valor_global)}
            </p>
          )}
        </div>

        {/* Item do contrato */}
        {value.contrato_id && (
          <div>
            <Label className="text-xs">Item do contrato (opcional)</Label>
            <Select
              value={value.contrato_item_id ?? "__nenhum__"}
              onValueChange={(v) => setItem(v === "__nenhum__" ? "" : v)}
              disabled={loadingItens}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Selecione um item…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__" className="text-xs">
                  — Sem vínculo a item específico —
                </SelectItem>
                {itens.map((i) => (
                  <SelectItem key={i.id} value={i.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[420px]">{i.descricao}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        Saldo: {fmt(Number(i.saldo_financeiro ?? 0))}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {itemSel && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[11px]">Quantidade</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={value.quantidade || ""}
                    onChange={(e) =>
                      onChange({ ...value, quantidade: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Valor unitário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={value.valor_unitario || ""}
                    onChange={(e) =>
                      onChange({ ...value, valor_unitario: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aditivo origem */}
        {value.contrato_id && aditivos.length > 0 && (
          <div>
            <Label className="text-xs">Aditivo de origem (opcional)</Label>
            <Select
              value={value.origem_aditivo_id ?? "__contrato__"}
              onValueChange={(v) =>
                onChange({
                  ...value,
                  origem_aditivo_id: v === "__contrato__" ? null : v,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__contrato__" className="text-xs">
                  📄 Contrato Original
                </SelectItem>
                {aditivos.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    📎 {a.numero_aditivo} ({a.tipo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
