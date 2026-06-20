import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/services/logger";

const logger = createLogger("AIStream");
const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const AURELIA_TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aurelia-tools-search`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ToolEvent = {
  type: "running" | "done";
  name: string;
  id?: string;
  args?: Record<string, unknown>;
  resumo?: { total?: number; retornados?: number; erro?: string };
};

export async function streamAIChat({
  messages,
  action = "assistente",
  context,
  onDelta,
  onDone,
  onError,
  onToolEvent,
  endpoint,
}: {
  messages: ChatMessage[];
  action?: string;
  context?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
  onToolEvent?: (evt: ToolEvent) => void;
  /** Quando "aurelia-tools" usa a edge function com tool calling sobre o cache */
  endpoint?: "ai-chat" | "aurelia-tools";
}) {
  try {
    // Resolve user JWT via getUser() — auto-refreshes expired tokens internally
    let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        onError?.("Sessão expirada. Por favor, recarregue a página e faça login novamente.");
        onDone();
        return;
      }
      // getUser() refreshes the token if needed; getSession() now returns the fresh token
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authToken = session.access_token;
      }
    } catch (error) {
      logger.warn("Falha ao obter sessão", error);
    }

    const url = endpoint === "aurelia-tools" ? AURELIA_TOOLS_URL : AI_CHAT_URL;
    const body = endpoint === "aurelia-tools"
      ? JSON.stringify({ messages, context })
      : JSON.stringify({ messages, action, context });

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const httpMsg: Record<number, string> = {
        401: `Sessão inválida ou expirada — recarregue a página (F5) e tente novamente.`,
        402: `Créditos de IA insuficientes (402) — verifique o plano da conta.`,
        403: `Acesso negado (403) — verifique suas permissões.`,
        429: `Muitas requisições (429) — aguarde alguns segundos e tente novamente.`,
        500: `Erro interno no servidor de IA (500) — tente novamente em instantes.`,
        502: `Serviço de IA inacessível (502) — tente novamente.`,
        503: `Serviço de IA indisponível (503) — tente novamente em instantes.`,
        504: `Tempo de resposta excedido (504) — tente novamente.`,
      };
      const errMsg = err.error || httpMsg[resp.status] || `Erro HTTP ${resp.status} ao comunicar com o servidor.`;
      onError?.(errMsg);
      onDone();
      return;
    }

    if (!resp.body) {
      onError?.("Resposta vazia do servidor — tente novamente.");
      onDone();
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.tool_event) { onToolEvent?.(parsed.tool_event as ToolEvent); continue; }
          if (parsed.error) { onError?.(parsed.error); continue; }
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    // Flush remaining
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw || !raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.tool_event) { onToolEvent?.(parsed.tool_event as ToolEvent); continue; }
          if (parsed.error) { onError?.(parsed.error); continue; }
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    console.error("Stream error:", e);
    let errMsg = "Erro de conexão desconhecido.";
    if (e instanceof TypeError && e.message.toLowerCase().includes("fetch")) {
      errMsg = "Falha de rede — verifique sua conexão com a internet.";
    } else if (e instanceof Error && /timeout|timed out/i.test(e.message)) {
      errMsg = "Tempo de resposta excedido — tente novamente.";
    } else if (e instanceof Error) {
      errMsg = e.message;
    }
    onError?.(errMsg);
    onDone();
  }
}
