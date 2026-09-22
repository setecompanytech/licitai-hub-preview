import { useState, useMemo } from "react";
import { hojeLocal } from "@/lib/financeiro/data-local";
import { formatBRL } from "@/lib/financeiro/formatters";
import { buscarTodos } from "@/lib/financeiro/paginar";
import { estaEmAtraso } from "@/lib/financeiro/atraso";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCheck, Loader2, Search } from "lucide-react";
import { useContas, useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

type Tipo = "a_pagar" | "a_receber";

export default function FinBaixaLote() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const { data: contas = [] } = useContas();
  const [tipo, setTipo] = useState<Tipo>("a_pagar");
  const [busca, setBusca] = useState("");
  const [contaPadrao, setContaPadrao] = useState<string>("");
  const [dataPadrao, setDataPadrao] = useState<string>(hojeLocal());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["fin-baixa-lote-pendentes", empresaId, tipo],
    enabled: !!empresaId,
    queryFn: async () =>
      // A carteira em aberto inteira: o `.limit(500)` deixava título de fora
      // da baixa em lote sem dizer nada (21/09).
      buscarTodos<{
        id: string; descricao: string; valor: number; data_vencimento: string | null;
        data_competencia: string; status: string; pessoa_id: string | null;
      }>((de, ate) =>
        supabase
          .from("financeiro_lancamentos")
          .select("id, descricao, valor, data_vencimento, data_competencia, status, pessoa_id")
          .eq("empresa_id", empresaId!)
          .eq("tipo", tipo)
          .in("status", ["previsto", "em_atraso"])
          .order("data_vencimento", { ascending: true, nullsFirst: false })
          .order("id")
          .range(de, ate)),
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pendentes;
    return pendentes.filter((l) => l.descricao.toLowerCase().includes(q));
  }, [busca, pendentes]);

  const toggle = (id: string) => {
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selecionados.size === filtrados.length) setSelecionados(new Set());
    else setSelecionados(new Set(filtrados.map((l) => l.id)));
  };

  const totalSelecionado = useMemo(
    () => filtrados.filter((l) => selecionados.has(l.id)).reduce((acc, l) => acc + Number(l.valor), 0),
    [filtrados, selecionados]
  );

  async function handleBaixar() {
    if (selecionados.size === 0 || !contaPadrao) return;
    setSaving(true);
    try {
      const ids = Array.from(selecionados);
      const { error } = await supabase
        .from("financeiro_lancamentos")
        .update({
          status: "realizado",
          data_realizado: dataPadrao,
          conta_id: contaPadrao,
        })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} lançamento(s) baixado(s) com sucesso.`);
      setSelecionados(new Set());
      qc.invalidateQueries({ queryKey: ["fin-baixa-lote-pendentes"] });
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
      // A baixa mexe no saldo das contas e no resultado: sem estas, o painel
      // e o DRE ficavam com o número de antes até outra ação qualquer.
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
      qc.invalidateQueries({ queryKey: ["fin-dashboard-executivo"] });
      qc.invalidateQueries({ queryKey: ["fin-dre"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar em lote");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* A tela já se identifica no cabeçalho da subtela; aqui fica só a
          escolha da carteira que vai ser baixada. */}
      <div className="flex flex-wrap justify-end gap-2">
        <Tabs value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setSelecionados(new Set()); }}>
          <TabsList>
            <TabsTrigger value="a_pagar">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="a_receber">Contas a Receber</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="space-y-6 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="fin-baixa-conta">Conta para liquidação</Label>
              <Select value={contaPadrao} onValueChange={setContaPadrao}>
                <SelectTrigger id="fin-baixa-conta"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter((c) => c.ativa).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fin-baixa-data">Data do pagamento</Label>
              <Input
                id="fin-baixa-data"
                type="date"
                value={dataPadrao}
                onChange={(e) => setDataPadrao(e.target.value)}
                aria-describedby="fin-baixa-data-ajuda"
              />
              <p id="fin-baixa-data-ajuda" className="text-xs text-muted-foreground">
                A do extrato — o dia em que o dinheiro de fato saiu. Com outra
                data, os lançamentos contam no mês errado.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fin-baixa-busca">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="fin-baixa-busca" className="pl-9" placeholder="Filtrar descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
          </div>

          {/* A altura máxima vai no scroller da própria Table (o div que
              ui/table.tsx cria): dois contêineres de rolagem aninhados
              deixariam o `sticky` preso ao de dentro, que nunca rola — e o
              "selecionar todos" sumiria ao rolar, justamente na tela cujo
              gesto principal é selecionar em lote. */}
          <div className="rounded-lg border border-border [&>div]:max-h-[400px]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-secondary">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filtrados.length > 0 && selecionados.size === filtrados.length}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todos os lançamentos listados"
                    />
                  </TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[140px] text-right">Vencimento</TableHead>
                  <TableHead className="w-[170px] text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Espera na forma das linhas — caixa, descrição, data e
                  // valor —, não um spinner no centro (Design System v3).
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      <div role="status" className="flex flex-col gap-px bg-border">
                        <span className="sr-only">Carregando lançamentos</span>
                        {Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="ml-auto h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      <EstadoVazio
                        tamanho="compacto"
                        icone={<CheckCheck />}
                        titulo="Nenhum lançamento pendente"
                        descricao="Não há nada em aberto nesta carteira com o filtro atual."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((l) => {
                    const checked = selecionados.has(l.id);
                    const atrasado = estaEmAtraso(l);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(l.id)}
                            aria-label={`Selecionar ${l.descricao}`}
                          />
                        </TableCell>
                        {/* O teto de largura mora na CÉLULA: sem ele o
                            `truncate` (que traz `whitespace-nowrap`) faria a
                            coluna crescer até caber a descrição inteira, e a
                            tabela ganharia rolagem horizontal no lugar das
                            reticências. */}
                        <TableCell className="max-w-[320px]">
                          <p className="truncate text-sm" title={l.descricao}>{l.descricao}</p>
                          {atrasado && <Badge variant="danger" className="mt-1">Em atraso</Badge>}
                        </TableCell>
                        {/* Título sem vencimento (NF-e sem duplicata): a competência
                            no lugar, marcada — o traço deixava a coluna inteira em
                            branco em Contas a Receber (19/09). */}
                        <TableCell className="text-right tabular-nums text-muted-foreground" nowrap>
                          {l.data_vencimento
                            ? format(new Date(l.data_vencimento + "T00:00:00"), "dd/MM/yyyy")
                            : l.data_competencia
                              ? <span title="Sem vencimento registrado — data de competência">{format(new Date(l.data_competencia + "T00:00:00"), "dd/MM/yyyy")} <span className="text-xs">(comp.)</span></span>
                              : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums" nowrap>
                          {formatBRL(Number(l.valor))}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Barra da baixa em lote: na tinta verde enquanto há seleção — a
              cor da seleção em todo o sistema —, neutra com nada marcado,
              para não anunciar uma seleção que não existe. */}
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 transition-colors duration-150",
              selecionados.size > 0 ? "border-primary-line bg-primary-tint" : "border-border bg-secondary",
            )}
          >
            <div className="text-sm">
              <span className="text-muted-foreground">Selecionados:</span>{" "}
              <span className="font-semibold tabular-nums">{selecionados.size}</span>
              <span className="text-muted-foreground"> · Total:</span>{" "}
              <span className="font-semibold tabular-nums">
                {formatBRL(totalSelecionado)}
              </span>
            </div>
            <Button onClick={handleBaixar} disabled={!contaPadrao || selecionados.size === 0 || saving}>
              {saving
                ? <Loader2 className="animate-spin" aria-hidden="true" />
                : <CheckCheck aria-hidden="true" />}
              Baixar {selecionados.size} lançamento(s)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
