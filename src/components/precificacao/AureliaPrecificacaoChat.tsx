import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import SeloPraefectusIA from "@/components/shared/SeloPraefectusIA";
import { cn } from "@/lib/utils";
import { streamAIChat, type ChatMessage } from "@/lib/ai-stream";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import {
  Send, Sparkles, ExternalLink, ShoppingCart, Check,
  Package2, Truck, CreditCard, Loader2, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Fornecedor {
  id: string;
  nome: string;
  modelo: string;
  aderencia: number;
  valorUnit: number;
  qtd: number;
  margem: number;
  prazoEntrega: string;
  pagamento: string;
  frete: string;
  emEstoque: boolean;
  avaliacao: number;
  url: string;
  fonte: string; // "ML" | "Serper" | "IA"
}

interface TabelaCotacao {
  item: string;
  qtd: number;
  fornecedores: Fornecedor[];
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  tabela?: TabelaCotacao;
  buscando?: boolean;
}

type Ordem = "preco" | "margem" | "avaliacao";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const stars = (r: number) =>
  "★".repeat(Math.min(5, Math.round(r))) + "☆".repeat(Math.max(0, 5 - Math.round(r)));

function calcMargem(preco: number, todos: number[]): number {
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  if (max === min) return 18;
  const pos = (preco - min) / (max - min);
  return Math.round(10 + pos * 22);
}

function mlSearchUrl(termo: string): string {
  return `https://lista.mercadolivre.com.br/${encodeURIComponent(termo).replace(/%20/g, "-")}`;
}

// ─── Prompt do chat (coleta item + qtd) ──────────────────────────────────────

const SYSTEM_CHAT = `Você é AURÉLIA, especialista em precificação de licitações da PRAEFECTUS.
Seja breve e objetiva.

Quando o usuário descrever um item:
1. Se não informou quantidade, pergunte.
2. Quando tiver item + quantidade, responda com UMA linha de confirmação SEGUIDA do marcador abaixo na última linha (sem nada após ele):

[BUSCAR: "<termo de 2-4 palavras para pesquisa no Mercado Livre>" QTD: <número>]

Exemplo:
Certo! Buscando cotações para 10 notebooks Dell 8GB...

[BUSCAR: "notebook Dell 8GB 256GB" QTD: 10]

Para outras perguntas, responda normalmente sem o marcador.`;

// ─── Prompt do fallback IA (gera cotações realistas) ─────────────────────────

function promptCotacao(termo: string, qtd: number): string {
  return `Você é um especialista em pesquisa de preços para licitações brasileiras.

Gere EXATAMENTE 10 cotações realistas de mercado para o item abaixo, em formato JSON.
Os preços DEVEM refletir o mercado brasileiro de 2024-2025 em R$.

ITEM: ${termo}
QUANTIDADE: ${qtd} unidades

FAIXAS DE PREÇO POR CATEGORIA (use como referência):
- Notebooks/Computadores: R$ 1.800 – R$ 12.000
- Tablets/Celulares: R$ 600 – R$ 5.000
- Impressoras: R$ 400 – R$ 8.000
- Material de escritório (resmas, canetas, pastas): R$ 5 – R$ 200
- Produtos de limpeza e higiene: R$ 8 – R$ 150
- Móveis (cadeiras, mesas): R$ 200 – R$ 3.000
- Equipamentos médicos/hospitalares: R$ 50 – R$ 50.000
- Alimentos e gêneros: R$ 3 – R$ 300
- Ferramentas e equipamentos: R$ 50 – R$ 5.000
- Uniformes e EPIs: R$ 20 – R$ 500

Responda APENAS com o JSON abaixo, sem texto antes ou depois:
{
  "cotacoes": [
    {
      "id": "c1",
      "vendedor": "Nome da Loja (Mercado Livre / Amazon / Magazine Luiza / KaBuM / Shopee / etc.)",
      "produto": "Título exato como aparece no marketplace",
      "preco": 1234.56,
      "frete_gratis": true,
      "parcelas": "10x de R$ 123,45",
      "avaliacao": 4.6,
      "emEstoque": true,
      "prazoEntrega": "3 dias úteis"
    }
  ]
}

Gere 10 itens com preços variados e realistas. Varie as lojas (Mercado Livre, Amazon, Magazine Luiza, KaBuM, Shopee, Americanas). Os preços devem ser diferentes entre si (variação de 5% a 30%).`;
}

// ─── Busca em cascata ─────────────────────────────────────────────────────────

async function trySerper(termo: string): Promise<any[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("pesquisa-preco-real", {
      body: { termo },
    });
    const lista = data?.data?.fornecedores;
    if (!error && Array.isArray(lista) && lista.length > 0) return lista;
    return null;
  } catch {
    return null;
  }
}

async function tryML(termo: string): Promise<any[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("consulta-mercadolivre", {
      body: { termo, limite: 10 },
    });
    const lista = data?.produtos;
    if (!error && Array.isArray(lista) && lista.length > 0) return lista;
    return null;
  } catch {
    return null;
  }
}

function mapSerper(items: any[], qtd: number): Fornecedor[] {
  const precos = items.map((i: any) => i.preco as number).filter(Boolean);
  return items.slice(0, 10).map((i: any, idx: number): Fornecedor => ({
    id: `s${idx}`,
    nome: i.loja || "Marketplace",
    modelo: i.produto || i.titulo || "",
    aderencia: Math.max(65, 99 - idx * 3),
    valorUnit: i.preco,
    qtd,
    margem: calcMargem(i.preco, precos),
    prazoEntrega: i.frete?.toLowerCase().includes("grát") ? "Envio rápido" : "5-12 dias úteis",
    pagamento: "À vista / parcelas",
    frete: i.frete?.toLowerCase().includes("grát") ? "Grátis" : "A calcular",
    emEstoque: true,
    avaliacao: i.avaliacao ?? 4.2,
    url: i.url || mlSearchUrl(i.produto || ""),
    fonte: "Serper",
  }));
}

function mapML(items: any[], qtd: number): Fornecedor[] {
  const precos = items.map((i: any) => i.preco as number).filter(Boolean);
  return items.slice(0, 10).map((i: any, idx: number): Fornecedor => {
    const freeShipping = i.frete_gratis ?? false;
    return {
      id: `ml${idx}`,
      nome: i.vendedor?.nome || "ML Vendedor",
      modelo: i.titulo || "",
      aderencia: Math.max(65, 99 - idx * 3),
      valorUnit: i.preco,
      qtd,
      margem: calcMargem(i.preco, precos),
      prazoEntrega: freeShipping ? "Envio rápido" : "5-12 dias úteis",
      pagamento: i.parcelas ? `${i.parcelas.quantidade}x de ${fmtBRL(i.parcelas.amount)}` : "À vista",
      frete: freeShipping ? "Grátis" : "A calcular",
      emEstoque: (i.disponivel ?? 1) > 0,
      avaliacao: i.nota_avaliacao ?? 4.0,
      url: i.url || mlSearchUrl(i.titulo || ""),
      fonte: "ML",
    };
  });
}

async function gerarCotacoesIA(termo: string, qtd: number): Promise<Fornecedor[]> {
  return new Promise((resolve) => {
    let raw = "";
    const timeout = setTimeout(() => resolve([]), 20000);

    streamAIChat({
      messages: [{ role: "user", content: `Gere cotações para: ${termo}, quantidade: ${qtd}` }],
      action: "precificacao-cotacao-ia",
      context: promptCotacao(termo, qtd),
      onDelta: (c) => { raw += c; },
      onDone: () => {
        clearTimeout(timeout);
        try {
          const jsonMatch = raw.match(/\{[\s\S]*"cotacoes"[\s\S]*\}/);
          if (!jsonMatch) return resolve([]);
          const parsed = JSON.parse(jsonMatch[0]);
          const cotacoes: any[] = parsed.cotacoes ?? [];
          const precos = cotacoes.map((c: any) => c.preco as number).filter(Boolean);
          resolve(cotacoes.slice(0, 10).map((c: any, i: number): Fornecedor => ({
            id: `ia${i}`,
            nome: c.vendedor || "Marketplace",
            modelo: c.produto || termo,
            aderencia: Math.max(65, 99 - i * 3),
            valorUnit: c.preco,
            qtd,
            margem: calcMargem(c.preco, precos),
            prazoEntrega: c.prazoEntrega || "5-12 dias úteis",
            pagamento: c.parcelas || "À vista",
            frete: c.frete_gratis ? "Grátis" : "A calcular",
            emEstoque: c.emEstoque ?? true,
            avaliacao: c.avaliacao ?? 4.3,
            url: mlSearchUrl(termo),
            fonte: "IA",
          })));
        } catch {
          resolve([]);
        }
      },
      onError: () => { clearTimeout(timeout); resolve([]); },
    });
  });
}

async function buscarFornecedores(termo: string, qtd: number): Promise<{ fornecedores: Fornecedor[]; fonte: string }> {
  // 1ª tentativa: Serper (Google Shopping real)
  const serper = await trySerper(termo);
  if (serper) return { fornecedores: mapSerper(serper, qtd), fonte: "Google Shopping" };

  // 2ª tentativa: Mercado Livre API
  const ml = await tryML(termo);
  if (ml) return { fornecedores: mapML(ml, qtd), fonte: "Mercado Livre" };

  // 3ª tentativa: IA gera cotações realistas
  const ia = await gerarCotacoesIA(termo, qtd);
  return { fornecedores: ia, fonte: "Estimativa de mercado (IA)" };
}

// ─── Parser do marcador ───────────────────────────────────────────────────────

function parseBuscar(content: string): { termo: string; qtd: number } | null {
  const m = content.match(/\[BUSCAR:\s*"([^"]+)"\s+QTD:\s*(\d+)\]/i);
  return m ? { termo: m[1].trim(), qtd: parseInt(m[2], 10) } : null;
}

function stripMarcador(content: string): string {
  return content.replace(/\[BUSCAR:[^\]]+\]/gi, "").trim();
}

// ─── Tabela ───────────────────────────────────────────────────────────────────

function TabelaCotacaoUI({
  tabela,
  selection,
  onToggle,
}: {
  tabela: TabelaCotacao;
  /**
   * O que está selecionado, chaveado pelo id do fornecedor.
   *
   * Estava declarado `Set<string>` e recebe um `Map<string, Fornecedor>`. Só
   * não quebrou porque `Map.has(chave)` e `Set.has(valor)` têm o mesmo nome, e
   * é só `.has` que esta tabela usa — funcionava por coincidência de
   * vocabulário. Um `.add()` ou um `Array.from()` aqui dentro derrubaria a
   * tela, e o tipo declarado não avisaria ninguém.
   */
  selection: ReadonlyMap<string, Fornecedor>;
  onToggle: (f: Fornecedor) => void;
}) {
  const [ordem, setOrdem] = useState<Ordem>("preco");

  const sorted = [...tabela.fornecedores].sort((a, b) => {
    if (ordem === "preco") return a.valorUnit - b.valorUnit;
    if (ordem === "margem") return b.margem - a.margem;
    return b.avaliacao - a.avaliacao;
  });

  const fonte = tabela.fornecedores[0]?.fonte ?? "Mercado";

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary px-4 py-3">
        <p className="text-sm font-semibold text-foreground">
          {tabela.fornecedores.length} cotações encontradas
          <span className="ml-1 font-normal text-muted-foreground">· {tabela.item}</span>
        </p>
        {/* Ordenação como controle segmentado sóbrio (o mesmo do Financeiro):
            a opção ativa é o segmento branco em relevo, sem pílula verde. */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">via {fonte}</Badge>
          <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1" role="group" aria-label="Ordenar cotações">
            {(["preco", "margem", "avaliacao"] as Ordem[]).map((o) => (
              <Button
                key={o}
                type="button"
                size="sm"
                variant={ordem === o ? "outline" : "ghost"}
                aria-pressed={ordem === o}
                onClick={() => setOrdem(o)}
              >
                {o === "preco" ? "Menor preço" : o === "margem" ? "Maior margem" : "Melhor avaliação"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela na anatomia da `ui/table`; a linha escolhida usa o estado
          `selected` (tinta verde). A rolagem fica presa ao contêiner. */}
      <Table className="min-w-[780px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"><span className="sr-only">Selecionar</span></TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Valor unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Margem</TableHead>
            <TableHead>Condições</TableHead>
            <TableHead className="w-10"><span className="sr-only">Abrir</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((f, idx) => {
            const sel = selection.has(f.id);
            const total = f.valorUnit * f.qtd;
            const cheapest = idx === 0 && ordem === "preco";
            return (
              <TableRow
                key={f.id}
                onClick={() => onToggle(f)}
                data-state={sel ? "selected" : undefined}
                className="cursor-pointer"
              >
                <TableCell>
                  <div
                    role="checkbox"
                    aria-checked={sel}
                    aria-label={`Selecionar cotação de ${f.nome}`}
                    className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", sel ? "border-primary bg-primary" : "border-input bg-card")}
                  >
                    {sel && <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground" aria-hidden="true">
                      {f.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="max-w-[110px] truncate">{f.nome}</span>
                  </div>
                  {f.avaliacao > 0 && (
                    <div className="mt-0.5 text-xs text-warning-ink tabular-nums">{stars(f.avaliacao)} {f.avaliacao.toFixed(1)}</div>
                  )}
                </TableCell>
                <TableCell>
                  <p className="line-clamp-2 max-w-[260px] text-foreground">{f.modelo}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="ia" className="tabular-nums">{f.aderencia}% aderência</Badge>
                    {cheapest && (
                      <Badge variant="success">Menor preço</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground" nowrap>
                  {fmtBRL(f.valorUnit)}
                  <div className="text-xs font-normal text-muted-foreground">{f.qtd} un.</div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground" nowrap>
                  {fmtBRL(total)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="warning" className="tabular-nums">{f.margem}%</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground" nowrap>
                  <div className="flex items-center gap-1.5"><Truck className="h-3 w-3" aria-hidden="true" />{f.prazoEntrega}</div>
                  <div className="mt-0.5 flex items-center gap-1.5"><CreditCard className="h-3 w-3" aria-hidden="true" />{f.pagamento}</div>
                  <div className="mt-0.5 flex items-center gap-1.5"><Package2 className="h-3 w-3" aria-hidden="true" />
                    <span className={f.emEstoque ? "font-semibold text-success-ink" : "font-semibold text-warning-ink"}>
                      {f.emEstoque ? "Em estoque" : "Sob encomenda"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {f.url && (
                    <a
                      href={f.url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Ver produto"
                      aria-label={`Ver produto de ${f.nome}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-secondary px-4 py-2 text-xs text-muted-foreground">
        <Search className="h-3 w-3" aria-hidden="true" />
        Selecione os itens para incluir na proposta comercial.
        {fonte === "Estimativa de mercado (IA)" && (
          <span className="ml-1 text-warning-ink">· Valores estimados — confirme com fornecedores antes de submeter.</span>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AureliaPrecificacaoChat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Olá! Descreva o item do edital que você precisa cotar — pode colar a especificação técnica completa — e eu busco cotações de mercado para você.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Map<string, Fornecedor>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleFornecedor = useCallback((f: Fornecedor) => {
    setSelection((prev) => {
      const next = new Map(prev);
      next.has(f.id) ? next.delete(f.id) : next.set(f.id, f);
      return next;
    });
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { role: "user", content: text };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setInput("");
    setLoading(true);

    const chatHistory: ChatMessage[] = updatedMsgs.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let raw = "";

    await streamAIChat({
      messages: chatHistory,
      action: "precificacao-conversacional",
      context: SYSTEM_CHAT,
      onDelta: (chunk) => {
        raw += chunk;
        const texto = stripMarcador(raw);
        setMessages((prev) => {
          if (prev[prev.length - 1]?.role === "assistant" && prev.length > updatedMsgs.length) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: texto || "…" } : m);
          }
          return [...prev, { role: "assistant", content: texto || "…" }];
        });
      },
      onDone: async () => {
        const sinal = parseBuscar(raw);
        const textoLimpo = stripMarcador(raw);

        if (!sinal) {
          setLoading(false);
          return;
        }

        // Marca como buscando
        setMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 ? { role: "assistant", content: textoLimpo, buscando: true } : m
        ));

        const { fornecedores, fonte } = await buscarFornecedores(sinal.termo, sinal.qtd);

        if (fornecedores.length === 0) {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: textoLimpo },
            { role: "assistant", content: `Não consegui obter cotações para **"${sinal.termo}"**. Tente reformular a descrição do item.` },
          ]);
        } else {
          setMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1
              ? {
                  role: "assistant",
                  content: textoLimpo,
                  buscando: false,
                  tabela: { item: sinal.termo, qtd: sinal.qtd, fornecedores },
                }
              : m
          ));
        }

        setLoading(false);
      },
      onError: (err) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Erro: ${err}` }]);
        setLoading(false);
      },
    });
  };

  const totalSel = [...selection.values()].reduce((s, f) => s + f.valorUnit * f.qtd, 0);
  const avgMargem = selection.size > 0
    ? [...selection.values()].reduce((s, f) => s + f.margem, 0) / selection.size : 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* ── Cabeçalho do chat — recurso de IA leva o selo "Praefectus IA". ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-tint" aria-hidden="true">
          <Sparkles className="h-4 w-4 text-teal" />
        </span>
        <span className="text-sm font-semibold text-foreground">AURÉLIA</span>
        <SeloPraefectusIA />
      </div>

      {/* ── Mensagens — fio em max-w-3xl, balões rounded-lg (IA em cartão,
          usuário na tinta da ação). ── */}
      <div className="flex-1 overflow-y-auto bg-background px-4 py-5">
        <div className="mx-auto w-full max-w-3xl space-y-5">
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex items-start gap-3", msg.role === "user" && "flex-row-reverse")}>
            <div className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
              msg.role === "assistant" ? "bg-primary-tint text-teal" : "bg-muted text-muted-foreground")} aria-hidden="true">
              {msg.role === "assistant"
                ? <Sparkles className="h-4 w-4" />
                : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>
              }
            </div>
            <div className={cn("min-w-0 flex-1", msg.role === "user" && "flex flex-col items-end")}>
              {msg.role === "assistant" && (
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">AURÉLIA</p>
              )}
              {msg.content && (
                <div className={cn("max-w-[85%] rounded-lg px-4 py-3 text-sm",
                  msg.role === "assistant"
                    ? "prose prose-sm max-w-none border border-border bg-card shadow-sm dark:prose-invert"
                    : "whitespace-pre-wrap bg-primary text-primary-foreground")}>
                  {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                </div>
              )}
              {msg.buscando && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Buscando cotações de mercado…
                </div>
              )}
              {msg.tabela && (
                <div className="w-full max-w-[96%]">
                  <TabelaCotacaoUI tabela={msg.tabela} selection={selection} onToggle={toggleFornecedor} />
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && !messages[messages.length - 1]?.buscando && (
          <div className="flex items-start gap-3" role="status" aria-label="AURÉLIA está respondendo">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary-tint text-teal" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex gap-1.5" aria-hidden="true">{[0,1,2].map(i => (
                <div key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground-tertiary motion-reduce:animate-none" style={{ animationDelay: `${i*0.15}s` }} />
              ))}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Cart bar — superfície da ação (tinta), nunca escura. ── */}
      {selection.size > 0 && (
        <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary-line bg-primary-tint px-4 py-3 text-foreground">
          <div className="flex flex-wrap items-center gap-6">
            <div><p className="text-xs font-medium text-muted-foreground">Selecionados</p><p className="text-base font-semibold tabular-nums">{selection.size} {selection.size === 1 ? "item" : "itens"}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Valor total</p><p className="text-base font-semibold tabular-nums">{fmtBRL(totalSel)}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Margem média</p><p className="text-base font-semibold tabular-nums">{avgMargem.toFixed(0)}%</p></div>
          </div>
          <Button
            className="whitespace-nowrap"
            onClick={() => {
              const itens = [...selection.values()];
              setMessages(prev => [...prev, { role: "assistant", content: `✅ **Proposta gerada com ${itens.length} ${itens.length === 1 ? "item" : "itens"}** — valor total de **${fmtBRL(totalSel)}**.\n\nAcesse a aba **Proposta** para revisar e exportar.` }]);
              setSelection(new Map());
            }}
          >
            <ShoppingCart aria-hidden="true" />
            Gerar proposta comercial →
          </Button>
        </div>
      )}

      {/* ── Composer — entrada fixa embaixo, caixa de 44px que cresce até 120px. ── */}
      <div className="border-t border-border bg-card px-4 pb-4 pt-3">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-md border border-input bg-card px-3 py-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Textarea
            rows={1}
            aria-label="Descreva o item do edital para cotar"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Descreva o item do edital para cotar…"
            className="max-h-[120px] min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button size="icon-sm" onClick={handleSend} disabled={!input.trim() || loading}
            aria-label="Enviar mensagem"
            className="flex-shrink-0">
            {loading
              ? <Loader2 className="animate-spin" aria-hidden="true" />
              : <Send aria-hidden="true" />}
          </Button>
        </div>
        <p className="mx-auto mt-2 w-full max-w-3xl text-xs text-muted-foreground">
          Enter para enviar · Shift+Enter para quebrar linha
        </p>
      </div>
    </div>
  );
}
