/**
 * Cliente Claude para edge functions do Praefectus.
 * Usado para processamento nativo de PDFs (sem conversão para imagem).
 * Complementa o Lovable AI Gateway (Gemini) que é usado para texto puro.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODELO_PADRAO = "gpt-4o";

export interface ClaudeDocumentoInput {
  pdfBase64?: string;
  imageBase64?: string;
  texto?: string;
  mimeType?: string;
}

export interface ClaudeOpcoes {
  maxTokens?: number;
  sistema?: string;
  cacheEphemeral?: boolean;
  timeoutMs?: number;
}

export async function chamarClaude(
  instrucao: string,
  documento: ClaudeDocumentoInput,
  opcoes: ClaudeOpcoes = {}
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const {
    maxTokens = 8000,
    sistema = "Você é especialista em licitações públicas brasileiras (Lei 14.133/2021). Retorne apenas JSON válido conforme solicitado, sem markdown.",
    cacheEphemeral = true,
    timeoutMs = 90000,
  } = opcoes;

  const blocoDocumento = montarBlocoDocumento(documento, cacheEphemeral);

  const payload = {
    model: MODELO_PADRAO,
    max_tokens: maxTokens,
    system: sistema,
    messages: [
      {
        role: "user",
        content: [
          blocoDocumento,
          { type: "text", text: instrucao },
        ].filter(Boolean),
      },
    ],
  };

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${err.slice(0, 300)}`);
  }

  const data = await resp.json();
  const texto = data.content
    ?.filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("") ?? "";

  return limparJson(texto);
}

function montarBlocoDocumento(
  doc: ClaudeDocumentoInput,
  cache: boolean
): any {
  if (doc.pdfBase64) {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: doc.pdfBase64,
      },
      ...(cache ? { cache_control: { type: "ephemeral" } } : {}),
    };
  }
  if (doc.imageBase64) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: doc.mimeType ?? "image/jpeg",
        data: doc.imageBase64,
      },
      ...(cache ? { cache_control: { type: "ephemeral" } } : {}),
    };
  }
  if (doc.texto) {
    return { type: "text", text: doc.texto };
  }
  return null;
}

export function limparJson(texto: string): string {
  return texto
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```$/im, "")
    .replace(/[\u0000]/g, "")
    .trim();
}

export function parsearJson<T = any>(texto: string): T {
  try {
    return JSON.parse(texto) as T;
  } catch {
    const match = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Resposta não contém JSON válido: " + texto.slice(0, 200));
  }
}

export async function arrayParaBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + SIZE)));
  }
  return btoa(chunks.join(""));
}
