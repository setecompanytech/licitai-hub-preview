// @ts-nocheck
/**
 * Cifra das senhas de portal — autoridade única.
 *
 * Nasceu dentro de `credenciais-portal/index.ts`, que era o único lugar que
 * cifrava e decifrava. Quando o `robo-lances-webhook` passou a precisar da senha
 * em claro — para entregá-la ao agente na hora de abrir a sessão —, copiar as
 * três funções para lá criaria duas cópias de código de segurança, com o risco
 * clássico: alguém troca o `salt` ou o número de iterações num arquivo e o
 * outro para de decifrar, em silêncio, meses depois.
 *
 * É o princípio 1 do CLAUDE.md aplicado a cripto: uma autoridade, nunca duas.
 */

// Prefixo gravado junto do valor cifrado. Existe para que a PRÓXIMA troca de
// chave saiba, olhando a linha, com qual chave ela foi escrita.
export const VERSAO_CIFRA = "v2";

/**
 * A cifra tem chave própria, separada da credencial de infraestrutura. Antes
 * ela era derivada da SUPABASE_SERVICE_ROLE_KEY, e isso custava duas coisas:
 * rotacionar a service role key — prática normal — tornava toda senha de portal
 * indecifrável, e quem obtivesse essa chave decifrava a senha de portal de
 * todos os assinantes.
 */
export function segredoDeCifra(): string {
  const secret = Deno.env.get("CREDENCIAIS_ENCRYPTION_KEY");
  if (!secret) {
    // Falha alta de propósito: cair de volta para a service role key
    // reintroduziria o acoplamento em silêncio, e ninguém perceberia até a
    // próxima rotação.
    throw new Error(
      "CREDENCIAIS_ENCRYPTION_KEY não configurada — cadastre o segredo nas Edge Functions antes de usar credenciais de portal"
    );
  }
  return secret;
}

export async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredoDeCifra()),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("praefectus-credenciais-v2"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // versao:iv:ciphertext em base64 — o alfabeto base64 não usa ":", então o
  // split é seguro.
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${VERSAO_CIFRA}:${ivB64}:${ctB64}`;
}

export async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  const [versao, ivB64, ctB64] = encrypted.split(":");
  // Recusa o que não reconhece em vez de tentar adivinhar: senha devolvida
  // errada é pior que erro, porque vira tentativa de login falha no portal sem
  // explicação.
  if (versao !== VERSAO_CIFRA || !ivB64 || !ctB64) {
    throw new Error("Formato de senha cifrada não reconhecido");
  }
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Busca a credencial de um portal e devolve login e senha EM CLARO, prontos
 * para entregar ao agente.
 *
 * Por que a busca é por `portal_id` e não pelo id da linha: o cliente não
 * precisa saber — nem deveria carregar — o identificador interno da credencial.
 * A disputa já sabe em qual portal acontece, e user + portal identificam a
 * credencial de forma única (é a chave do upsert em `credenciais-portal`).
 *
 * Devolve `null` quando não há credencial cadastrada, para quem chama poder
 * dizer isso ao usuário em vez de mandar o robô tentar entrar sem senha.
 */
export async function credencialEmClaro(
  adminClient: any,
  userId: string,
  portalId: string
): Promise<{ login: string; senha: string } | null> {
  const { data, error } = await adminClient
    .from("credenciais_portais")
    .select("login, senha_hash, status")
    .eq("user_id", userId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.status && data.status !== "ativo") return null;
  if (!data.login || !data.senha_hash) return null;

  return {
    login: data.login,
    senha: await decrypt(data.senha_hash, await deriveKey()),
  };
}
