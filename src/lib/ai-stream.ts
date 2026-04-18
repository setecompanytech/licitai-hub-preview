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
    // Use user's JWT token if available, fallback to anon key for public actions
    let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authToken = session.access_token;
      }
    } catch (error) { logger.warn("Falha ao obter sessão, usando anon key", error); }

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
      const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
      onError?.(err.error || `Erro ${resp.status}`);
      onDone();
      return;
    }

    if (!resp.body) {
      onError?.("Sem resposta do servidor");
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
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    console.error("Stream error:", e);
    onError?.(e instanceof Error ? e.message : "Erro de conexão");
    onDone();
  }
}
