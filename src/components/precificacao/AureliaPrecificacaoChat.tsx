import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { streamAIChat, type ChatMessage } from "@/lib/ai-stream";
import ReactMarkdown from "react-markdown";
import {
  Send, Sparkles, ChevronDown, ChevronUp, Star, ExternalLink,
  ShoppingCart, Check, ArrowDownUp, Package2, Truck, CreditCard,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  modelo: string;
  aderencia: number;         // 0-100
  valorUnit: number;
  qtd: number;
  margem: number;
  prazoEntrega: string;
  pagamento: string;
  frete: string;
  emEstoque: boolean;
  avaliacao: number;         // 0-5
  url?: string;
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
}

type Ordem = "preco" | "margem" | "avaliacao";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const stars = (r: number) => {
  const full = Math.round(r);
  return "★".repeat(full) + "☆".repeat(5 - full);
};

const SYSTEM_PROMPT = `Você é AURÉLIA, especialista em precificação de licitações públicas da PRAEFECTUS.

Quando o usuário descrever um item de edital:
1. Se não informou quantidade, pergunte.
2. Quando tiver item + quantidade, responda EXATAMENTE no formato abaixo (sem mais texto depois do JSON):

<texto natural curto confirmando que encontrou cotações>

\`\`\`json-cotacao
{
  "item": "<nome curto do item>",
  "qtd": <número>,
  "fornecedores": [
    {
      "id": "f1",
      "nome": "<nome do fornecedor>",
      "cnpj": "<CNPJ formatado>",
      "modelo": "<descrição técnica do modelo/especificação>",
      "aderencia": <0-100>,
      "valorUnit": <valor numérico>,
      "qtd": <quantidade>,
      "margem": <% margem inteiro>,
      "prazoEntrega": "<ex: 5 dias úteis>",
      "pagamento": "<ex: 30/60 dias>",
      "frete": "<ex: Incluso ou + R$ XX,00>",
      "emEstoque": <true|false>,
      "avaliacao": <3.5-5.0>,
      "url": "<URL real do produto ou da página do fornecedor — Mercado Livre, Amazon, site próprio, etc.>"
    }
  ]
}
\`\`\`

Gere EXATAMENTE 3 fornecedores realistas para licitação, com valores coerentes para o mercado brasileiro. O menor preço marque melhorPreco:true. Valores devem ser competitivos e reais.

Para outras perguntas, responda normalmente sem o bloco JSON.`;

// ─── Parsing do JSON-cotacao ──────────────────────────────────────────────────

function parseTabela(content: string): { texto: string; tabela?: TabelaCotacao } {
  const m = content.match(/```json-cotacao\s*([\s\S]*?)```/);
  if (!m) return { texto: content };
  try {
    const data = JSON.parse(m[1].trim()) as TabelaCotacao;
    // decora melhor preço e maior margem
    const sorted = [...data.fornecedores].sort((a, b) => a.valorUnit - b.valorUnit);
    sorted[0].melhorPreco = true;
    const sortedM = [...data.fornecedores].sort((a, b) => b.margem - a.margem);
    sortedM[0].maior_margem = true;
    const texto = content.replace(/```json-cotacao[\s\S]*?```/, "").trim();
    return { texto, tabela: data };
  } catch {
    return { texto: content };
  }
}

// ─── Componente da tabela ─────────────────────────────────────────────────────

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
      {/* cabeçalho */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <p className="text-xs font-semibold text-foreground">
          Cotações encontradas
          <span className="font-normal text-muted-foreground ml-1">
            · {tabela.fornecedores.length} fornecedores
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

      {/* tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[860px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="w-8 px-3 py-2.5" />
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Fornecedor</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Especificação</th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Valor unit.</th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Total</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Margem</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Condições</th>
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((f) => {
              const sel = selection.has(f.id);
              const total = f.valorUnit * f.qtd;
              return (
                <tr
                  key={f.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    sel ? "bg-primary/5" : "hover:bg-muted/30"
                  )}
                  onClick={() => onToggle(f)}
                >
                  {/* checkbox */}
                  <td className="px-3 py-3">
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        sel ? "bg-primary border-primary" : "border-border"
                      )}
                    >
                      {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                  </td>

                  {/* fornecedor */}
                  <td className="px-3 py-3">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span
                        className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground flex-shrink-0"
                      >
                        {f.nome.slice(0, 2).toUpperCase()}
                      </span>
                      {f.nome}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{f.cnpj}</div>
                    <div className="text-[10px] text-amber-500 mt-0.5">{stars(f.avaliacao)} {f.avaliacao.toFixed(1)}</div>
                  </td>

                  {/* especificação */}
                  <td className="px-3 py-3">
                    <p className="text-foreground leading-relaxed max-w-[220px]">{f.modelo}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      {f.aderencia}% aderência
                    </span>
                    {f.melhorPreco && (
                      <span className="inline-block ml-1.5 mt-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        🏅 Melhor preço
                      </span>
                    )}
                  </td>

                  {/* valor unit */}
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                    {fmtBRL(f.valorUnit)}
                    <div className="text-[10px] font-normal text-muted-foreground">{f.qtd} un.</div>
                  </td>

                  {/* total */}
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                    {fmtBRL(total)}
                  </td>

                  {/* margem */}
                  <td className="px-3 py-3 text-center">
                    <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {f.margem}%
                    </span>
                  </td>

                  {/* condições */}
                  <td className="px-3 py-3 text-muted-foreground leading-relaxed whitespace-nowrap">
                    <div className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> {f.prazoEntrega}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><CreditCard className="w-3 h-3" /> {f.pagamento}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><Package2 className="w-3 h-3" />
                      <span className={f.emEstoque ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                        {f.emEstoque ? "Em estoque" : "Sob encomenda"}
                      </span>
                    </div>
                  </td>

                  {/* link */}
                  <td className="px-3 py-3">
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Ver produto"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-muted/20 border-t border-border text-[10.5px] text-muted-foreground">
        Selecione as cotações para incluir na proposta comercial.
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AureliaPrecificacaoChat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Descreva o item do edital e eu busco cotações comparadas para você.\n\nPode colar a especificação técnica completa — quanto mais detalhe, mais precisa é a busca.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Map<string, Fornecedor>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    // adapta para ChatMessage (sem campo tabela)
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
        // atualiza enquanto stream vem (sem parsear tabela ainda)
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last === prev.at(-1) && prev.length > updatedMsgs.length) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: raw } : m
            );
          }
          return [...prev, { role: "assistant", content: raw }];
        });
      },
      onDone: () => {
        // parseia tabela ao final do stream
        const { texto, tabela } = parseTabela(raw);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { role: "assistant", content: texto, tabela } : m
            );
          }
          return [...prev, { role: "assistant", content: texto, tabela }];
        });
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

  const totalSel = [...selection.values()].reduce(
    (s, f) => s + f.valorUnit * f.qtd,
    0
  );
  const avgMargem =
    selection.size > 0
      ? [...selection.values()].reduce((s, f) => s + f.margem, 0) / selection.size
      : 0;

  return (
    <div className="flex flex-col h-full min-h-0 relative">

      {/* ── Área de mensagens ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 space-y-5"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn("flex gap-3 items-start", msg.role === "user" && "flex-row-reverse")}
          >
            {/* avatar */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-accent to-teal-400 shadow-md"
                  : "bg-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <Sparkles className="w-4 h-4 text-white" />
              ) : (
                <svg className="w-4 h-4 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
                </svg>
              )}
            </div>

            {/* conteúdo */}
            <div className={cn("flex-1 min-w-0", msg.role === "user" && "flex flex-col items-end")}>
              {msg.role === "assistant" && (
                <p className="text-[10.5px] font-bold text-accent mb-1.5 tracking-wider uppercase">AURÉLIA</p>
              )}
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]",
                  msg.role === "assistant"
                    ? "bg-card border border-border shadow-sm rounded-tl-sm prose prose-sm dark:prose-invert max-w-none"
                    : "bg-foreground text-background rounded-tr-sm font-mono text-[12.5px] whitespace-pre-wrap"
                )}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {/* tabela de cotações */}
              {msg.tabela && (
                <div className="w-full max-w-[95%]">
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

        {/* typing indicator */}
        {loading && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-teal-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Cart bar (aparece quando tem seleção) ── */}
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
              // integração com proposta: gera mensagem no chat
              const itens = [...selection.values()];
              const msg: Msg = {
                role: "assistant",
                content: `✅ **Proposta gerada com ${itens.length} ${itens.length === 1 ? "item" : "itens"}** — valor total de **${fmtBRL(totalSel)}**.\n\nAcesse a aba **Proposta** para revisar e exportar o documento.`,
              };
              setMessages((prev) => [...prev, msg]);
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
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Cole a especificação técnica do item ou envie uma mensagem para a AURÉLIA…"
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
          Enter para enviar · Shift+Enter para quebrar linha
        </p>
      </div>
    </div>
  );
}
