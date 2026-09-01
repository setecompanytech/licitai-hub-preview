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
import { empenhoCancelado, ROTULO_DO_EMPENHO } from "@/lib/contratos/empenho";
import { quantidadeConfiavel } from "@/lib/financeiro/quantidade-da-nota";
import { Checkbox } from "@/components/ui/checkbox";
import { Link2, FileText, Loader2, Check, ChevronsUpDown, X, AlertTriangle, AlertCircle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface VinculoContratoValue {
  contrato_id: string | null;
  /** De qual empenho o pedido sai — é por ele que o saldo do empenho baixa. */
  empenho_id?: string | null;
  /** Herdada quando o empenho tem uma cota só; rateio não é decisão desta tela. */
  cota?: string | null;
  /** Mantido por compatibilidade — corresponde ao primeiro item de `contrato_item_ids`. */
  contrato_item_id: string | null;
  /** Permite vincular um único documento a múltiplos itens do contrato
   *  (ex.: cota principal + cota reservada — Lei 14.133/21). */
  contrato_item_ids?: string[];
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
  /**
   * A quantidade que a NOTA declara (QTD. do DANFE / soma de q_com do XML).
   *
   * Sem ela, a sugestão era valorTotal ÷ preço do CONTRATO — que produzia
   * 498,8914 caixas para uma nota de 500 CX a R$ 22,50, porque o preço
   * faturado (22,50) difere do contratado (22,55). Quantidade é o que a nota
   * ATESTA; dividir dinheiro por preço é conta de cabeça, e fracionária.
   */
  quantidadeDaNota?: number | null;
  value: VinculoContratoValue;
  onChange: (v: VinculoContratoValue) => void;
  /** Em a_receber, listamos contratos onde o órgão é o pagador (cliente). Em a_pagar, idem (fornecedor). */
  tipo: "a_receber" | "a_pagar";
}

export default function VinculoContratoSelector({
  hintNome,
  hintCnpj,
  valorTotal,
  quantidadeDaNota,
  value,
  onChange,
  tipo,
}: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  const [contratos, setContratos] = useState<ContratoOpcao[]>([]);
  const [itens, setItens] = useState<ItemOpcao[]>([]);
  const [aditivos, setAditivos] = useState<AditivoOpcao[]>([]);
  /**
   * Os empenhos do contrato, para o pedido nascer apontando de qual sai.
   *
   * "O empenho autoriza; o pedido consome" — sem este vínculo, o saldo do
   * empenho não baixa pelo caminho da Extração, e foi exatamente o que o dono
   * do produto flagrou em 01/09: empenhos registrados na Gestão e o DANFE
   * subindo sem poder apontá-los.
   */
  const [empenhos, setEmpenhos] = useState<Array<{
    id: string; numero: string; tipo: string;
    saldoValor: number; cancelado: boolean; cotas: string[];
  }>>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  /** Selecionar fecha a lista — dropdown que fica aberto após o clique parece
   *  não ter reagido, e a pessoa clica de novo. */
  const [listaAberta, setListaAberta] = useState(false);
  /** O contrato foi pré-selecionado pelo destinatário lido do documento? A
   *  tela diz — seleção silenciosa parece campo que "já veio assim", e a
   *  pessoa não sabe se pode confiar nem que pode trocar. */
  const [escolhidoPelaLeitura, setEscolhidoPelaLeitura] = useState(false);
  const [loadingItens, setLoadingItens] = useState(false);

  // ── Por que esta consulta NÃO filtra por user_id nem por status ─────────
  //
  // A versão anterior fazia os dois, e cada um escondia contratos reais:
  //
  //   .eq("user_id", ...)   Contrato é da EMPRESA (princípio 2 do CLAUDE.md).
  //                         Filtrar pelo usuário sumia com o que o colega
  //                         cadastrou — o mesmo defeito que já barrou colegas
  //                         no espelho PNCP. O alcance é do RLS; o pós-filtro
  //                         abaixo prioriza a empresa ativa e mantém os
  //                         legados sem empresa_id.
  //
  //   .in("status", [...])  Lista de status redeclarada na tela (princípio 1:
  //                         três cópias divergentes mantiveram o arquivamento
  //                         quebrado por meses). E o filtro excluía justamente
  //                         o caso de uso: NOTA FISCAL CHEGA DEPOIS. A NF-e
  //                         retroativa de contrato vencendo ou encerrado é o
  //                         lançamento mais comum desta tela — o 149/2024 tem
  //                         nove delas. Contrato de qualquer status aparece,
  //                         com o status dito na linha; quem lança decide.
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = supabase
      .from("contratos")
      .select(
        "id, numero_contrato, objeto, orgao_contratante, tipo_documento, saldo_remanescente, valor_global, status, empresa_id",
      )
      .order("data_assinatura", { ascending: false, nullsFirst: false })
      .limit(300);
    q.then(({ data, error }) => {
      if (error) {
        console.error("[VinculoContratoSelector] erro ao carregar contratos:", error);
        setContratos([]);
      } else {
        // Quando há empresa ativa, prioriza contratos dela ou sem empresa (legados)
        const all = (data ?? []) as (ContratoOpcao & { empresa_id: string | null })[];
        const filtrados = empresaAtiva
          ? all.filter((c) => !c.empresa_id || c.empresa_id === empresaAtiva.id)
          : all;
        setContratos(filtrados);
      }
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

  useEffect(() => {
    if (!value.contrato_id) { setEmpenhos([]); return; }
    let vivo = true;
    (async () => {
      const { data: es } = await supabase
        .from("contrato_empenhos" as never)
        .select("id, numero, tipo")
        .eq("contrato_id", value.contrato_id)
        .order("numero");
      const lista = await Promise.all(
        ((es ?? []) as unknown as Array<{ id: string; numero: string; tipo: string }>).map(async (e) => {
          const [{ data: vig }, { data: cot }] = await Promise.all([
            supabase.rpc("contrato_empenho_valor_vigente" as never, { p_empenho_id: e.id } as never),
            supabase.rpc("contrato_empenho_saldo_por_cota" as never, { p_empenho_id: e.id } as never),
          ]);
          const v = ((vig ?? []) as unknown as Array<{ valor_original: number; reforcos: number; anulacoes: number; valor_vigente: number }>)[0];
          const cotas = ((cot ?? []) as unknown as Array<{ cota: string; saldo_valor: number }>);
          return {
            id: e.id, numero: e.numero, tipo: e.tipo,
            saldoValor: cotas.reduce((s, c) => s + (Number(c.saldo_valor) || 0), 0),
            cancelado: empenhoCancelado({
              valorOriginal: v?.valor_original, reforcos: v?.reforcos, anulacoes: v?.anulacoes,
            }),
            cotas: cotas.map((c) => c.cota).filter(Boolean),
          };
        }),
      );
      if (!vivo) return;
      setEmpenhos(lista);
      // Um único empenho vivo dispensa a pergunta — pré-seleciona, com a cota
      // herdada quando ela é uma só.
      const vivos = lista.filter((e) => !e.cancelado);
      if (vivos.length === 1 && !value.empenho_id) {
        onChange({
          ...value,
          empenho_id: vivos[0].id,
          cota: vivos[0].cotas.length === 1 ? vivos[0].cotas[0] : null,
        });
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setEscolhidoPelaLeitura(true);
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

  // Lista canônica de itens vinculados (suporte a múltiplos)
  const itemIds = useMemo<string[]>(() => {
    if (value.contrato_item_ids && value.contrato_item_ids.length > 0) return value.contrato_item_ids;
    if (value.contrato_item_id) return [value.contrato_item_id];
    return [];
  }, [value.contrato_item_ids, value.contrato_item_id]);

  const itensSelecionados = useMemo(
    () => itens.filter((i) => itemIds.includes(i.id)),
    [itens, itemIds],
  );

  // Quando há vários itens marcados, agregamos saldos para validação consolidada.
  const itemSel = useMemo<ItemOpcao | null>(() => {
    if (itensSelecionados.length === 0) return null;
    if (itensSelecionados.length === 1) return itensSelecionados[0];
    const sum = (xs: (number | null)[]) =>
      xs.reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
    // Valor unitário "médio" só faz sentido se forem o mesmo objeto;
    // para validação usamos o maior (mais conservador para alerta de divergência).
    const vuMax = Math.max(...itensSelecionados.map((i) => Number(i.valor_unitario) || 0));
    return {
      id: "__multi__",
      descricao: `${itensSelecionados.length} itens agrupados (cota principal + reservada)`,
      unidade: itensSelecionados[0].unidade,
      valor_unitario: vuMax,
      saldo_quantitativo: sum(itensSelecionados.map((i) => i.saldo_quantitativo)),
      saldo_financeiro: sum(itensSelecionados.map((i) => i.saldo_financeiro)),
      origem_aditivo_id: itensSelecionados[0].origem_aditivo_id,
    };
  }, [itensSelecionados]);

  // ===== Divergências entre documento extraído × saldo do contrato/item =====
  // Tolerância de 1 centavo / 0,0001 unidade para evitar falso-positivo de arredondamento.
  const TOL_VALOR = 0.01;
  const TOL_QTD = 0.0001;

  const divergencias = useMemo(() => {
    const alerts: Array<{
      level: "warning" | "error";
      titulo: string;
      detalhe: string;
    }> = [];
    if (!contratoSel) return alerts;

    const valorLancamento = Number(
      valorTotal ?? (value.quantidade || 0) * (value.valor_unitario || 0),
    );

    // 0) Preço faturado ≠ preço contratado — informativo, não barra.
    //    A nota de 500 CX saiu a R$ 22,50 num contrato de R$ 22,55: pode ser
    //    desconto, reajuste ou erro do emissor. O pedido usa o faturado (é o
    //    que foi cobrado); quem confere precisa VER a diferença.
    if (
      itemSel?.valor_unitario &&
      value.quantidade > 0 &&
      valorLancamento > 0
    ) {
      const vuFaturado = valorLancamento / value.quantidade;
      const vuContratado = Number(itemSel.valor_unitario);
      if (Math.abs(vuFaturado - vuContratado) > 0.005) {
        alerts.push({
          level: "warning",
          titulo: "Preço faturado difere do contratado",
          detalhe: `Nota: ${fmt(vuFaturado)}/un · Contrato: ${fmt(vuContratado)}/un. O pedido usa o faturado — confira se há reajuste, desconto ou erro do emissor.`,
        });
      }
    }

    // 1) Valor do documento > saldo remanescente do CONTRATO
    const saldoContrato = Number(contratoSel.saldo_remanescente ?? contratoSel.valor_global);
    if (valorLancamento > 0 && valorLancamento - saldoContrato > TOL_VALOR) {
      alerts.push({
        level: "error",
        titulo: "Valor excede o saldo do contrato",
        detalhe: `Documento: ${fmt(valorLancamento)} · Saldo disponível: ${fmt(saldoContrato)} · Excedente: ${fmt(valorLancamento - saldoContrato)}.`,
      });
    } else if (
      valorLancamento > 0 &&
      saldoContrato > 0 &&
      valorLancamento / saldoContrato >= 0.9 &&
      valorLancamento <= saldoContrato + TOL_VALOR
    ) {
      alerts.push({
        level: "warning",
        titulo: "Saldo do contrato quase esgotado",
        detalhe: `Após este lançamento restará apenas ${fmt(saldoContrato - valorLancamento)} (${Math.round((1 - valorLancamento / saldoContrato) * 100)}%).`,
      });
    }

    // 2) Validações específicas do ITEM (quando vinculado)
    if (itemSel) {
      const qtd = Number(value.quantidade || 0);
      const vu = Number(value.valor_unitario || itemSel.valor_unitario || 0);
      const valorItem = qtd * vu;

      // 2a) Valor unitário diferente do contratado
      const vuContrato = Number(itemSel.valor_unitario || 0);
      if (vuContrato > 0 && vu > 0 && Math.abs(vu - vuContrato) > TOL_VALOR) {
        const pct = ((vu - vuContrato) / vuContrato) * 100;
        alerts.push({
          level: Math.abs(pct) > 5 ? "error" : "warning",
          titulo: "Valor unitário diverge do contrato",
          detalhe: `Documento: ${fmt(vu)} · Contrato: ${fmt(vuContrato)} · Diferença: ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%.`,
        });
      }

      // 2b) Quantidade extraída > saldo quantitativo do item
      const saldoQtd = Number(itemSel.saldo_quantitativo ?? 0);
      if (itemSel.saldo_quantitativo != null && qtd - saldoQtd > TOL_QTD) {
        alerts.push({
          level: "error",
          titulo: "Quantidade excede o saldo do item",
          detalhe: `Documento: ${qtd.toLocaleString("pt-BR")} ${itemSel.unidade ?? ""} · Saldo: ${saldoQtd.toLocaleString("pt-BR")} ${itemSel.unidade ?? ""} · Excedente: ${(qtd - saldoQtd).toLocaleString("pt-BR")}.`,
        });
      }

      // 2c) Valor total do item > saldo financeiro do item
      const saldoFinItem = Number(itemSel.saldo_financeiro ?? 0);
      if (itemSel.saldo_financeiro != null && valorItem - saldoFinItem > TOL_VALOR) {
        alerts.push({
          level: "error",
          titulo: "Valor do item excede o saldo financeiro",
          detalhe: `Documento: ${fmt(valorItem)} · Saldo financeiro do item: ${fmt(saldoFinItem)}.`,
        });
      }
    }

    return alerts;
  }, [contratoSel, itemSel, value.quantidade, value.valor_unitario, valorTotal]);

  const setContrato = (id: string) => {
    setListaAberta(false);
    setEscolhidoPelaLeitura(false);
    onChange({
      ...value,
      contrato_id: id || null,
      contrato_item_id: null,
      contrato_item_ids: [],
      origem_aditivo_id: null,
    });
  };

  const toggleItem = (id: string, checked: boolean) => {
    const atuais = new Set(itemIds);
    if (checked) atuais.add(id);
    else atuais.delete(id);
    const novos = Array.from(atuais);
    const itensMarcados = itens.filter((i) => novos.includes(i.id));

    // A quantidade da NOTA manda; a divisão por preço é último recurso.
    // E quando a quantidade vem da nota, o VU sugerido é o FATURADO
    // (valorTotal ÷ qtd) — senão 500 × 22,55 ≠ 11.250 e o pedido nasceria
    // internamente incoerente.
    // A leitura só vale se fizer sentido aritmético: a IA já devolveu "1"
    // para uma nota de 1.300 (leu "quantidade de itens"), e o VU implícito
    // ficou 1.300× fora do contrato. Leitura rejeitada volta à derivação.
    const qtdDaNota = quantidadeConfiavel({
      qtdLida: quantidadeDaNota,
      valorTotal,
      vuReferencia: itensMarcados[0]?.valor_unitario,
    }) ?? 0;
    const qtdSugerida = qtdDaNota > 0
      ? qtdDaNota
      : itensMarcados.length > 0 && valorTotal && itensMarcados[0].valor_unitario
        ? Number((Number(valorTotal) / Number(itensMarcados[0].valor_unitario)).toFixed(4))
        : value.quantidade;
    const vuSugerido = qtdDaNota > 0 && valorTotal
      ? Number((Number(valorTotal) / qtdDaNota).toFixed(4))
      : itensMarcados[0]?.valor_unitario ?? value.valor_unitario;

    onChange({
      ...value,
      contrato_item_ids: novos,
      contrato_item_id: novos[0] ?? null,
      origem_aditivo_id:
        itensMarcados[0]?.origem_aditivo_id ?? value.origem_aditivo_id ?? null,
      valor_unitario: vuSugerido,
      quantidade:
        value.quantidade && value.quantidade > 0 ? value.quantidade : qtdSugerida,
    });
  };

  return (
    <Card className="border-border">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Vincular a um Contrato / ATA SRP {tipo === "a_receber" ? "(cliente)" : "(fornecedor)"}
          </span>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="text-xs text-muted-foreground -mt-1">
          Opcional. Se vinculado, o sistema cria automaticamente um pedido no contrato e
          recalcula saldo financeiro/quantitativo (e da ATA SRP, quando aplicável).
        </div>

        {/* Combobox único: lista filtrada de contratos pré-cadastrados em GESTÃO */}
        <div>
          <Label className="text-xs">Contrato / ATA SRP</Label>
          <Popover open={listaAberta} onOpenChange={setListaAberta}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="h-9 w-full justify-between mt-1 text-xs font-normal"
                disabled={loading}
              >
                {contratoSel ? (
                  <span className="flex items-center gap-1.5 truncate text-left">
                    {contratoSel.tipo_documento === "ata_srp" && (
                      <Badge variant="outline" className="text-xs py-0 px-1 shrink-0">
                        ATA
                      </Badge>
                    )}
                    <b className="shrink-0">{contratoSel.numero_contrato}</b>
                    <span className="text-muted-foreground truncate">
                      — {contratoSel.orgao_contratante}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {loading
                      ? "Carregando contratos…"
                      : contratos.length === 0
                        ? "Nenhum contrato vigente cadastrado em Gestão"
                        : `Selecione um contrato (${contratos.length} disponíveis)…`}
                  </span>
                )}
                <ChevronsUpDown className="w-3.5 h-3.5 ml-2 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-[--radix-popover-trigger-width] min-w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden"
              align="start"
              sideOffset={4}
              avoidCollisions={false}
              // Evita que o Dialog/Modal pai roube o foco e o evento de wheel
              onWheel={(e) => e.stopPropagation()}
              onPointerDownOutside={(e) => {
                // Mantém comportamento padrão de fechar ao clicar fora,
                // mas evita conflito com overlay do Dialog em alguns navegadores.
                const target = e.target as HTMLElement;
                if (target.closest("[data-radix-popper-content-wrapper]")) {
                  e.preventDefault();
                }
              }}
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Buscar por nº, órgão ou objeto…"
                  value={busca}
                  onValueChange={setBusca}
                  className="text-xs"
                />
                {/*
                  CommandList: força altura máxima e overflow-y SEMPRE visível
                  (não apenas auto) para que o scroll do mouse funcione mesmo
                  dentro de Dialog. O onWheel garante que o evento role aqui
                  e não escape para containers ancestrais.
                */}
                <CommandList
                  // max-h, não h: com um resultado só, altura FIXA de 340px
                  // vira um mar de branco abaixo da lista — a "tela quebrada"
                  // relatada em 01/09. A lista cresce até o teto; não estica.
                  className="max-h-[min(42vh,340px)] overflow-y-auto overscroll-contain"
                  onWheel={(e) => {
                    // Permite scroll nativo do mouse mesmo quando há foco
                    // capturado pelo CommandInput (cmdk às vezes consome o evento).
                    e.stopPropagation();
                  }}
                >
                  <CommandEmpty className="py-4 text-xs text-muted-foreground text-center">
                    Nenhum contrato vigente corresponde à busca.
                  </CommandEmpty>
                  <CommandGroup>
                    {filtrados.slice(0, 80).map((c) => {
                      const selecionado = value.contrato_id === c.id;
                      const saldo = Number(c.saldo_remanescente ?? c.valor_global);
                      return (
                        <CommandItem
                          key={c.id}
                          value={c.id}
                          onSelect={() => setContrato(c.id)}
                          // O destaque padrão pinta bg-accent CHAPADO — o
                          // laranja da marca em força total — e os textos
                          // internos (muted, saldo verde/vermelho) somem nele.
                          // Fundo a 15% destaca sem engolir o texto.
                          className="flex items-start gap-2 text-xs cursor-pointer data-[selected=true]:bg-accent/15 data-[selected=true]:text-foreground"
                        >
                          <Check
                            className={cn(
                              "w-3.5 h-3.5 mt-0.5 shrink-0",
                              selecionado ? "opacity-100 text-primary" : "opacity-0",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {c.tipo_documento === "ata_srp" && (
                                <Badge variant="outline" className="text-xs py-0 px-1">
                                  ATA SRP
                                </Badge>
                              )}
                              <b className="shrink-0">{c.numero_contrato}</b>
                              {/* Contrato fora de execução continua na lista —
                                  a nota retroativa é dele —, mas rotulado,
                                  para ninguém escolhê-lo sem ver. */}
                              {c.status && !["vigente", "ativo", "em_execucao", "ativa"].includes(c.status) && (
                                <Badge variant="outline" className="text-xs py-0 px-1 text-warning border-warning/40">
                                  {c.status}
                                </Badge>
                              )}
                              <span className="text-muted-foreground truncate">
                                — {c.orgao_contratante}
                              </span>
                            </div>
                            {c.objeto && (
                              <div
                                className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
                                title={c.objeto}
                              >
                                {c.objeto}
                              </div>
                            )}
                            <div className="text-xs mt-0.5 flex gap-3 flex-wrap">
                              <span>
                                Saldo:{" "}
                                <b className={saldo > 0 ? "text-success" : "text-destructive"}>
                                  {fmt(saldo)}
                                </b>
                              </span>
                              <span className="text-muted-foreground">
                                Global: {fmt(c.valor_global)}
                              </span>
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {contratoSel && escolhidoPelaLeitura && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Selecionado automaticamente pelo destinatário lido do documento — confira e troque se não for este.
            </p>
          )}
          {contratoSel && (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-muted-foreground truncate">
                Saldo remanescente:{" "}
                <b>{fmt(Number(contratoSel.saldo_remanescente ?? contratoSel.valor_global))}</b>
                {" · "}Global: {fmt(contratoSel.valor_global)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setContrato("")}
              >
                <X className="w-3 h-3 mr-0.5" />
                Limpar
              </Button>
            </div>
          )}
        </div>

        {/* ===== Alertas de divergência (documento × contrato) ===== */}
        {divergencias.length > 0 && (
          <div className="space-y-1.5">
            {divergencias.map((d, i) => {
              const isError = d.level === "error";
              const Icon = isError ? AlertCircle : AlertTriangle;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2 rounded-md border p-2 text-xs",
                    isError
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-warning/40 bg-warning/10 text-warning",
                  )}
                  role="alert"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{d.titulo}</div>
                    <div className="text-xs opacity-90">{d.detalhe}</div>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground italic px-0.5">
              Os alertas são informativos — você pode prosseguir com o lançamento, mas confirme os
              valores antes de impactar o saldo do contrato.
            </p>
          </div>
        )}

        {/* ── O empenho que autoriza ──────────────────────────────────────
            O pedido criado por esta tela nasce apontando de qual empenho sai
            — é por esse vínculo que o saldo do empenho baixa (art. 60). Um
            único empenho vivo é pré-selecionado; cancelado fica na lista
            marcado, porque entrega ANTERIOR ao cancelamento é lançamento
            legítimo. Contrato sem empenho registrado não mostra o bloco. */}
        {value.contrato_id && empenhos.length > 0 && (
          <div>
            <Label className="text-xs">Empenho que autoriza (art. 60)</Label>
            <Select
              value={value.empenho_id ?? "nenhum"}
              onValueChange={(id) => {
                const e = empenhos.find((x) => x.id === id);
                onChange({
                  ...value,
                  empenho_id: id === "nenhum" ? null : id,
                  cota: e && e.cotas.length === 1 ? e.cotas[0] : null,
                });
              }}
            >
              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum" className="text-xs">Sem vínculo com empenho</SelectItem>
                {empenhos.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.numero} — {ROTULO_DO_EMPENHO[e.tipo as 'ordinario'] ?? e.tipo}
                    {e.cancelado
                      ? " · CANCELADO"
                      : ` · saldo ${e.saldoValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Itens do contrato — múltipla seleção (cota principal + cota reservada) */}
        {value.contrato_id && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs flex items-center gap-1.5">
                Itens do contrato (opcional)
                {itensSelecionados.length > 1 && (
                  <Badge variant="secondary" className="text-xs py-0 px-1.5 gap-1">
                    <Layers className="w-2.5 h-2.5" />
                    {itensSelecionados.length} agrupados
                  </Badge>
                )}
              </Label>
              {itemIds.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    onChange({ ...value, contrato_item_ids: [], contrato_item_id: null })
                  }
                >
                  <X className="w-3 h-3 mr-0.5" /> Limpar
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground mb-1.5">
              Marque um ou mais itens. Para contratos com <b>cota principal e cota reservada</b> do
              mesmo objeto (Lei 14.133/21), o sistema soma os saldos e rateia o valor do documento
              proporcionalmente entre os itens marcados.
            </div>

            {loadingItens ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando itens…
              </div>
            ) : itens.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-2">
                Este contrato não possui itens cadastrados.
              </div>
            ) : (
              <div
                className="h-[min(34vh,260px)] min-h-[120px] overflow-y-auto overscroll-contain rounded-md border border-border/60 divide-y divide-border/40"
                onWheel={(e) => e.stopPropagation()}
              >
                {itens.map((i) => {
                  const checked = itemIds.includes(i.id);
                  const saldoFin = Number(i.saldo_financeiro ?? 0);
                  const saldoQtd = Number(i.saldo_quantitativo ?? 0);
                  return (
                    <label
                      key={i.id}
                      className={cn(
                        "flex items-start gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors",
                        checked && "bg-primary/5",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleItem(i.id, v === true)}
                        className="mt-0.5 shrink-0"
                      />
                      <FileText className="w-3 h-3 mt-1 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="line-clamp-2 leading-tight" title={i.descricao}>
                          {i.descricao}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          <span>
                            Saldo financeiro:{" "}
                            <b className={saldoFin > 0 ? "text-success" : "text-destructive"}>
                              {fmt(saldoFin)}
                            </b>
                          </span>
                          {i.saldo_quantitativo != null && (
                            <span>
                              Saldo qtd:{" "}
                              <b>
                                {saldoQtd.toLocaleString("pt-BR")} {i.unidade ?? ""}
                              </b>
                            </span>
                          )}
                          <span>VU: {fmt(Number(i.valor_unitario))}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {itensSelecionados.length > 1 && (
              <div className="mt-1.5 rounded-md bg-muted/40 border border-border/60 p-2 text-xs">
                <div className="font-medium text-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Saldos somados dos itens marcados:
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>
                    Quantidade:{" "}
                    <b className="text-foreground">
                      {Number(itemSel?.saldo_quantitativo ?? 0).toLocaleString("pt-BR")}{" "}
                      {itensSelecionados[0].unidade ?? ""}
                    </b>
                  </span>
                  <span>
                    Financeiro:{" "}
                    <b className="text-foreground">{fmt(Number(itemSel?.saldo_financeiro ?? 0))}</b>
                  </span>
                </div>
                <div className="text-xs mt-1 italic text-muted-foreground">
                  O valor do documento será rateado proporcionalmente ao saldo financeiro de cada
                  item ao lançar.
                </div>
              </div>
            )}
          </div>
        )}
        {value.contrato_id && itemSel && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">
                Quantidade {itensSelecionados.length > 1 && "(total a ratear)"}
              </Label>
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
              <Label className="text-xs">Valor unitário</Label>
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
