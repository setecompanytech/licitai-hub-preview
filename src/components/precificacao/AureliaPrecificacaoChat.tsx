import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="mt-3 rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 flex-wrap gap-2">
        <p className="text-xs font-semibold text-foreground">
          {tabela.fornecedores.length} cotações encontradas
          <span className="font-normal text-muted-foreground ml-1">· {tabela.item}</span>
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
            via {fonte}
          </span>
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
              <th className="w-8 px-3 py-2" />
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Vendedor</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Produto</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Valor unit.</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Total</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Margem</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Condições</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((f, idx) => {
              const sel = selection.has(f.id);
              const total = f.valorUnit * f.qtd;
              const cheapest = idx === 0 && ordem === "preco";
              return (
                <tr
                  key={f.id}
                  onClick={() => onToggle(f)}
                  className={cn("cursor-pointer transition-colors", sel ? "bg-primary/5" : "hover:bg-muted/30")}
                >
                  <td className="px-3 py-3">
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center", sel ? "bg-primary border-primary" : "border-border")}>
                      {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
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
                    <p className="text-foreground max-w-[260px] line-clamp-2">{f.modelo}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">{f.aderencia}% aderência</span>
                      {cheapest && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">🏅 Menor preço</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                    {fmtBRL(f.valorUnit)}
                    <div className="text-[10px] font-normal text-muted-foreground">{f.qtd} un.</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                    {fmtBRL(total)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {f.margem}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-[11px] whitespace-nowrap">
                    <div className="flex items-center gap-1.5"><Truck className="w-3 h-3" />{f.prazoEntrega}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><CreditCard className="w-3 h-3" />{f.pagamento}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><Package2 className="w-3 h-3" />
                      <span className={f.emEstoque ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                        {f.emEstoque ? "Em estoque" : "Sob encomenda"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {f.url && (
                      <a
                        href={f.url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Ver produto"
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
        Selecione os itens para incluir na proposta comercial.
        {fonte === "Estimativa de mercado (IA)" && (
          <span className="text-amber-600 ml-1">· Valores estimados — confirme com fornecedores antes de submeter.</span>
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
    <div className="flex flex-col h-full min-h-0 relative">
      {/* ── Mensagens ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 space-y-5"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px,var(--border) 1px,transparent 1px)", backgroundSize: "22px 22px" }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex gap-3 items-start", msg.role === "user" && "flex-row-reverse")}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
              msg.role === "assistant" ? "bg-gradient-to-br from-accent to-teal-400 shadow-md" : "bg-foreground")}>
              {msg.role === "assistant"
                ? <Sparkles className="w-4 h-4 text-white" />
                : <svg className="w-4 h-4 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>
              }
            </div>
            <div className={cn("flex-1 min-w-0", msg.role === "user" && "flex flex-col items-end")}>
              {msg.role === "assistant" && (
                <p className="text-[10.5px] font-bold text-accent mb-1.5 tracking-wider uppercase">AURÉLIA</p>
              )}
              {msg.content && (
                <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]",
                  msg.role === "assistant"
                    ? "bg-card border border-border shadow-sm rounded-tl-sm prose prose-sm dark:prose-invert max-w-none"
                    : "bg-foreground text-background rounded-tr-sm font-mono text-[12.5px] whitespace-pre-wrap")}>
                  {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                </div>
              )}
              {msg.buscando && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-teal-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">{[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
              ))}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Cart bar ── */}
      {selection.size > 0 && (
        <div className="mx-4 mb-3 rounded-xl bg-foreground text-background px-4 py-3 flex items-center justify-between gap-4 shadow-xl flex-wrap">
          <div className="flex items-center gap-5 flex-wrap">
            <div><p className="text-[10px] uppercase tracking-wider text-background/50">Selecionados</p><p className="text-base font-bold">{selection.size} {selection.size === 1 ? "item" : "itens"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-background/50">Valor total</p><p className="text-base font-bold">{fmtBRL(totalSel)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-background/50">Margem média</p><p className="text-base font-bold">{avgMargem.toFixed(0)}%</p></div>
          </div>
          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold whitespace-nowrap"
            onClick={() => {
              const itens = [...selection.values()];
              setMessages(prev => [...prev, { role: "assistant", content: `✅ **Proposta gerada com ${itens.length} ${itens.length === 1 ? "item" : "itens"}** — valor total de **${fmtBRL(totalSel)}**.\n\nAcesse a aba **Proposta** para revisar e exportar.` }]);
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Descreva o item do edital para cotar…"
            className="flex-1 resize-none border-none outline-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground py-1.5 leading-relaxed max-h-[120px]"
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || loading}
            className="h-8 w-8 rounded-lg bg-foreground hover:bg-foreground/80 text-background flex-shrink-0">
            {loading
              ? <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-[10.5px] text-muted-foreground mt-1.5 ml-1">
          Enter para enviar · Shift+Enter para quebrar linha
        </p>
      </div>
    </div>
  );
}
