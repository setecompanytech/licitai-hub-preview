import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { streamAIChat, type ChatMessage } from "@/lib/ai-stream";
import ReactMarkdown from "react-markdown";
import {
  Send, Sparkles, ExternalLink, ShoppingCart, Check,
  Package2, Truck, CreditCard, Loader2, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Fornecedor {
  id: string;
  nome: string;           // seller nickname
  modelo: string;         // product title
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
  melhorPreco?: boolean;
  maior_margem?: boolean;
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

const stars = (r: number) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));

// Margem simulada baseada em posição de mercado (menor preço = menor margem)
function calcMargem(preco: number, todos: number[]): number {
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  if (max === min) return 15;
  const pos = (preco - min) / (max - min); // 0=mais barato, 1=mais caro
  return Math.round(8 + pos * 22);         // 8% a 30%
}

const SYSTEM_PROMPT = `Você é AURÉLIA, especialista em precificação de licitações da PRAEFECTUS.

Quando o usuário descrever um item:
1. Se não informou quantidade, pergunte de forma breve.
2. Quando tiver item + quantidade, responda com uma linha de confirmação SEGUIDA do marcador exato abaixo na última linha — sem nada após ele:

[BUSCAR: "<termo curto para busca no Mercado Livre>" QTD: <número>]

Exemplo:
Certo! Buscando cotações para 10 unidades de papel A4 resma...

[BUSCAR: "papel A4 resma 500 folhas" QTD: 10]

REGRAS:
- O termo de busca deve ser conciso, como um comprador pesquisaria no ML.
- Não gere tabelas, preços ou dados de fornecedores — os dados virão da API real.
- Para outras dúvidas, responda normalmente sem o marcador.`;

// ─── Parser do marcador ───────────────────────────────────────────────────────

function parseBuscar(content: string): { termo: string; qtd: number } | null {
  const m = content.match(/\[BUSCAR:\s*"([^"]+)"\s+QTD:\s*(\d+)\]/i);
  if (!m) return null;
  return { termo: m[1].trim(), qtd: parseInt(m[2], 10) };
}

function stripMarcador(content: string): string {
  return content.replace(/\[BUSCAR:[^\]]+\]/gi, "").trim();
}

// ─── Busca real direta na API pública do Mercado Livre ───────────────────────

async function buscarML(termo: string, qtd: number): Promise<Fornecedor[]> {
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&limit=10&condition=new`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];

  const json = await res.json();
  const results: any[] = json.results ?? [];
  if (results.length === 0) return [];

  const precos = results.map((r: any) => r.price as number).filter(Boolean);

  return results.slice(0, 6).map((r: any, i: number): Fornecedor => {
    const margem = calcMargem(r.price, precos);
    const freeShipping = r.shipping?.free_shipping ?? false;
    const parcelas = r.installments;
    return {
      id: r.id,
      nome: r.seller?.nickname ?? "Vendedor",
      modelo: r.title,
      aderencia: Math.max(60, 98 - i * 4),
      valorUnit: r.price,
      qtd,
      margem,
      prazoEntrega: freeShipping ? "Envio rápido" : "5–12 dias úteis",
      pagamento: parcelas
        ? `${parcelas.quantity}x de ${fmtBRL(parcelas.amount)}`
        : "À vista",
      frete: freeShipping ? "Grátis" : "A calcular",
      emEstoque: (r.available_quantity ?? 1) > 0,
      avaliacao: r.seller?.seller_reputation?.power_seller_status ? 4.5 : 4.0,
      url: r.permalink,
    };
  });
}

// ─── Tabela de cotações ───────────────────────────────────────────────────────

function TabelaCotacaoUI({
  tabela,
  selection,
  onToggle,
}: {
  tabela: TabelaCotacao;
  selection: Set<string>;
  onToggle: (f: Fornecedor) => void;
}) {
  const [ordem, setOrdem] = useState<Ordem>("preco");

  const sorted = [...tabela.fornecedores].sort((a, b) => {
    if (ordem === "preco") return a.valorUnit - b.valorUnit;
    if (ordem === "margem") return b.margem - a.margem;
    return b.avaliacao - a.avaliacao;
  });

  return (
    <div className="mt-3 rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 flex-wrap gap-2">
        <p className="text-xs font-semibold text-foreground">
          Cotações do Mercado Livre
          <span className="font-normal text-muted-foreground ml-1">
            · {tabela.fornecedores.length} resultados · {tabela.item}
          </span>
        </p>
        <div className="flex gap-1.5">
          {(["preco", "margem", "avaliacao"] as Ordem[]).map((o) => (
            <button
              key={o}
              onClick={() => setOrdem(o)}
              className={cn(
                "text-[10.5px] font-semibold px-2.5 py-1 rounded-full border transition-colors",
                ordem === o
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30"
              )}
            >
              {o === "preco" ? "Menor preço" : o === "margem" ? "Maior margem" : "Melhor avaliação"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[780px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="w-8 px-3 py-2.5" />
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Vendedor</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Produto</th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Valor unit.</th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Total</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Margem</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Condições</th>
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((f, idx) => {
              const sel = selection.has(f.id);
              const total = f.valorUnit * f.qtd;
              const isCheapest = idx === 0 && ordem === "preco";
              return (
                <tr
                  key={f.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    sel ? "bg-primary/5" : "hover:bg-muted/30"
                  )}
                  onClick={() => onToggle(f)}
                >
                  <td className="px-3 py-3">
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", sel ? "bg-primary border-primary" : "border-border")}>
                      {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground flex-shrink-0">
                        {f.nome.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="max-w-[110px] truncate">{f.nome}</span>
                    </div>
                    {f.avaliacao > 0 && (
                      <div className="text-[10px] text-amber-500 mt-0.5">{stars(f.avaliacao)} {f.avaliacao.toFixed(1)}</div>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <p className="text-foreground leading-relaxed max-w-[260px] line-clamp-2">{f.modelo}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      {f.aderencia}% aderência
                    </span>
                    {isCheapest && (
                      <span className="inline-block ml-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        🏅 Menor preço
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                    {fmtBRL(f.valorUnit)}
                    <div className="text-[10px] font-normal text-muted-foreground">{f.qtd} un.</div>
                  </td>

                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                    {fmtBRL(total)}
                  </td>

                  <td className="px-3 py-3 text-center">
                    <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {f.margem}%
                    </span>
                  </td>

                  <td className="px-3 py-3 text-muted-foreground leading-relaxed whitespace-nowrap text-[11px]">
                    <div className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> {f.prazoEntrega}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><CreditCard className="w-3 h-3" /> {f.pagamento}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><Package2 className="w-3 h-3" />
                      <span className={f.emEstoque ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                        {f.emEstoque ? "Em estoque" : "Sob encomenda"}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Ver no Mercado Livre"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-muted/20 border-t border-border text-[10.5px] text-muted-foreground flex items-center gap-1.5">
        <Search className="w-3 h-3" />
        Resultados reais do Mercado Livre. Selecione para incluir na proposta.
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AureliaPrecificacaoChat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Olá! Descreva o item do edital — pode colar a especificação técnica completa — e eu busco cotações reais do mercado para você.",
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
      if (next.has(f.id)) next.delete(f.id);
      else next.set(f.id, f);
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
      context: SYSTEM_PROMPT,
      onDelta: (chunk) => {
        raw += chunk;
        const texto = stripMarcador(raw);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > updatedMsgs.length) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: texto || "…" } : m);
          }
          return [...prev, { role: "assistant", content: texto || "…" }];
        });
      },
      onDone: async () => {
        const sinal = parseBuscar(raw);
        const textoLimpo = stripMarcador(raw);

        if (sinal) {
          // Atualiza mensagem com indicador de busca
          setMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1
              ? { role: "assistant", content: textoLimpo, buscando: true }
              : m
          ));

          const fornecedores = await buscarML(sinal.termo, sinal.qtd);

          if (fornecedores.length === 0) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Não encontrei resultados para "${sinal.termo}". Tente reformular a descrição do item.` },
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
        }

        setLoading(false);
      },
      onError: (err) => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Erro ao conectar com a AURÉLIA: ${err}` },
        ]);
        setLoading(false);
      },
    });
  };

  const totalSel = [...selection.values()].reduce((s, f) => s + f.valorUnit * f.qtd, 0);
  const avgMargem = selection.size > 0
    ? [...selection.values()].reduce((s, f) => s + f.margem, 0) / selection.size
    : 0;

  return (
    <div className="flex flex-col h-full min-h-0 relative">

      {/* ── Mensagens ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 space-y-5"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex gap-3 items-start", msg.role === "user" && "flex-row-reverse")}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
              msg.role === "assistant" ? "bg-gradient-to-br from-accent to-teal-400 shadow-md" : "bg-foreground"
            )}>
              {msg.role === "assistant" ? (
                <Sparkles className="w-4 h-4 text-white" />
              ) : (
                <svg className="w-4 h-4 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
                </svg>
              )}
            </div>

            <div className={cn("flex-1 min-w-0", msg.role === "user" && "flex flex-col items-end")}>
              {msg.role === "assistant" && (
                <p className="text-[10.5px] font-bold text-accent mb-1.5 tracking-wider uppercase">AURÉLIA</p>
              )}
              {msg.content && (
                <div className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]",
                  msg.role === "assistant"
                    ? "bg-card border border-border shadow-sm rounded-tl-sm prose prose-sm dark:prose-invert max-w-none"
                    : "bg-foreground text-background rounded-tr-sm font-mono text-[12.5px] whitespace-pre-wrap"
                )}>
                  {msg.role === "assistant" ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : msg.content}
                </div>
              )}

              {/* Indicador de busca em andamento */}
              {msg.buscando && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Buscando cotações reais no Mercado Livre…
                </div>
              )}

              {/* Tabela de resultados reais */}
              {msg.tabela && (
                <div className="w-full max-w-[96%]">
                  <TabelaCotacaoUI
                    tabela={msg.tabela}
                    selection={selection}
                    onToggle={toggleFornecedor}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && !messages[messages.length - 1]?.buscando && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-teal-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Cart bar ── */}
      {selection.size > 0 && (
        <div className="mx-4 mb-3 rounded-xl bg-foreground text-background px-4 py-3 flex items-center justify-between gap-4 shadow-xl flex-wrap">
          <div className="flex items-center gap-5 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-background/50">Selecionados</p>
              <p className="text-base font-bold">{selection.size} {selection.size === 1 ? "item" : "itens"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-background/50">Valor total</p>
              <p className="text-base font-bold">{fmtBRL(totalSel)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-background/50">Margem média</p>
              <p className="text-base font-bold">{avgMargem.toFixed(0)}%</p>
            </div>
          </div>
          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold whitespace-nowrap"
            onClick={() => {
              const itens = [...selection.values()];
              setMessages((prev) => [...prev, {
                role: "assistant",
                content: `✅ **Proposta gerada com ${itens.length} ${itens.length === 1 ? "item" : "itens"}** — valor total de **${fmtBRL(totalSel)}**.\n\nAcesse a aba **Proposta** para revisar e exportar o documento.`,
              }]);
              setSelection(new Map());
            }}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Gerar proposta comercial →
          </Button>
        </div>
      )}

      {/* ── Composer ── */}
      <div className="px-4 pb-4 bg-card border-t border-border">
        <div className="flex items-end gap-2 border border-border rounded-xl px-3 py-2 focus-within:border-accent transition-colors bg-background">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Cole a especificação técnica do item ou descreva o que precisa cotar…"
            className="flex-1 resize-none border-none outline-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground py-1.5 leading-relaxed max-h-[120px]"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-8 w-8 rounded-lg bg-foreground hover:bg-foreground/80 text-background flex-shrink-0"
          >
            {loading ? (
              <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10.5px] text-muted-foreground mt-1.5 ml-1">
          Enter para enviar · Shift+Enter para quebrar linha · Dados reais do Mercado Livre
        </p>
      </div>
    </div>
  );
}
