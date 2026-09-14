// @ts-nocheck
/**
 * Leva o certificado A1 do Storage até o agente, onde ele passa a valer.
 *
 * O elo que faltava. O `.pfx` subia para o bucket `certificados` e parava ali:
 * nenhuma função o baixava, o agente não tinha rota para recebê-lo, e o Chrome
 * da VPS nunca teve o certificado na base NSS. A tela, mesmo assim, ficava
 * verde — porque olhava se o arquivo tinha chegado ao Storage, que é o único
 * passo que realmente acontecia.
 *
 * Mora em `_shared/` porque dois caminhos precisam dele: o upload (que instala
 * na hora, para a pessoa não ter de apertar um segundo botão) e o botão de
 * repetir do Checklist (para quando o agente estava fora do ar na hora).
 */

import { decrypt, deriveKey } from "./credenciais-cifra.ts";
import { chaveParaOAgente } from "./robo-acao.ts";

export type ResultadoInstalacao = {
  instalado: boolean;
  /** Por que não deu — em português, para virar mensagem de tela sem tradução. */
  motivo: string | null;
  /** O que o agente respondeu, quando respondeu. */
  certificado?: Record<string, unknown> | null;
};

/**
 * Busca o certificado mais recente do usuário, decifra a senha e manda instalar.
 *
 * Devolve `instalado: false` com motivo em vez de lançar: quem chama quer contar
 * o que houve, não interromper. No upload, especialmente, o arquivo já está
 * salvo — falhar o pedido inteiro por causa de um agente offline apagaria um
 * trabalho que deu certo.
 */
export async function instalarCertificadoNoAgente(
  adminClient: any,
  userId: string,
  /**
   * Agente a usar quando o usuário não tem agente próprio ativo. Sem ele, o
   * padrão é o agente da Praefectus (segredos AGENTE_URL_BASE + AGENTE_API_KEY).
   *
   * Desde 14/09/2026 o cliente não cadastra mais agente: quem não tem linha em
   * `agente_externo_config` usa o da plataforma. Sem este fallback, o upload
   * do certificado de um cliente novo nunca chegaria a agente nenhum.
   */
  agentePadrao?: { url_base?: string | null; api_key_hash?: string | null } | null,
): Promise<ResultadoInstalacao> {
  // 1. O envio mais recente que tem arquivo E senha.
  const { data: tokens, error: erroToken } = await adminClient
    .from("cert_upload_tokens")
    .select("id, cert_file_path, senha_cifrada")
    .eq("user_id", userId)
    .not("cert_file_path", "is", null)
    .order("used_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (erroToken) {
    return { instalado: false, motivo: `Não foi possível ler o registro do certificado: ${erroToken.message}` };
  }

  const token = tokens?.[0];
  if (!token?.cert_file_path) {
    return { instalado: false, motivo: "Nenhum certificado enviado ainda." };
  }

  if (!token.senha_cifrada) {
    // O caso dos certificados enviados antes de 09/09/2026: o arquivo existe,
    // a senha foi descartada no upload. Não há como recuperá-la — só reenviar.
    return {
      instalado: false,
      motivo:
        "O certificado foi enviado antes de o sistema passar a guardar a senha. " +
        "Envie novamente para que o robô possa instalá-lo.",
    };
  }

  // 2. O agente que vai recebê-lo.
  const { data: agentes, error: erroAgente } = await adminClient
    .from("agente_externo_config")
    .select("id, url_base, api_key_hash")
    .eq("user_id", userId)
    .eq("status", "ativo")
    .order("updated_at", { ascending: false });

  if (erroAgente) {
    return { instalado: false, motivo: `Não foi possível ler a configuração do agente: ${erroAgente.message}` };
  }

  const chaveGerenciada = Deno.env.get("AGENTE_API_KEY") || null;
  const urlGerenciada = (Deno.env.get("AGENTE_URL_BASE") || "").trim();
  const gerenciadoPorAmbiente = urlGerenciada ? { url_base: urlGerenciada, api_key_hash: chaveGerenciada } : null;
  const agente = agentes?.[0] ?? agentePadrao ?? gerenciadoPorAmbiente;
  if (!agente?.url_base) {
    return { instalado: false, motivo: "Nenhum agente ativo configurado para receber o certificado." };
  }

  // 3. O arquivo.
  const { data: arquivo, error: erroDownload } = await adminClient.storage
    .from("certificados")
    .download(token.cert_file_path);

  if (erroDownload || !arquivo) {
    return { instalado: false, motivo: `Não foi possível baixar o certificado: ${erroDownload?.message ?? "arquivo ausente"}` };
  }

  let senha: string;
  try {
    senha = await decrypt(token.senha_cifrada, await deriveKey());
  } catch (e: any) {
    return { instalado: false, motivo: `Não foi possível decifrar a senha do certificado: ${e.message}` };
  }

  // 4. Base64 sem estourar a pilha: `String.fromCharCode(...bytes)` com um
  // arquivo de alguns MB passa do limite de argumentos e lança RangeError.
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const base64 = btoa(binario);

  // 5. A entrega.
  const base = agente.url_base.replace(/\/$/, "");
  try {
    const resp = await fetch(`${base}/certificado`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A chave do agente gerenciado vem do segredo, nunca da linha — a que
        // estava gravada nas linhas vazou no bundle antigo (ver robo-acao.ts).
        "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
      },
      body: JSON.stringify({ arquivo_base64: base64, senha }),
      // Importar na base NSS envolve processo externo; 10s seria apertado.
      signal: AbortSignal.timeout(60000),
    });

    const corpo = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return {
        instalado: false,
        motivo: corpo?.error || `O agente recusou o certificado (HTTP ${resp.status}).`,
        certificado: corpo?.certificado ?? null,
      };
    }

    // O agente só diz `sucesso` quando as três condições valem: arquivo, chave
    // na base NSS e policy de auto-seleção. É essa resposta, e não a nossa
    // vontade, que marca a instalação.
    if (corpo?.sucesso === true) {
      await adminClient
        .from("cert_upload_tokens")
        .update({ instalado_no_agente_em: new Date().toISOString() })
        .eq("id", token.id);

      return { instalado: true, motivo: null, certificado: corpo.certificado ?? null };
    }

    return {
      instalado: false,
      motivo: corpo?.certificado?.motivo || "O agente recebeu o certificado mas não conseguiu deixá-lo utilizável.",
      certificado: corpo?.certificado ?? null,
    };
  } catch (e: any) {
    return { instalado: false, motivo: `Não foi possível falar com o agente: ${e.message}` };
  }
}
