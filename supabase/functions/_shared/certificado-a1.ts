/**
 * O certificado A1 da empresa, para quem precisa falar com a SEFAZ (30/09).
 *
 * O .pfx vive no bucket privado `certificados` (enviado pelo link de
 * `gerar-link-certificado` → `upload-certificado`) e a senha fica cifrada em
 * `cert_upload_tokens.senha_cifrada` (cifra de `credenciais-cifra.ts`). Este
 * módulo devolve os dois em memória, para a chamada ao proxy — e nada mais:
 * nunca loga, nunca grava, nunca devolve ao navegador.
 */
import { decrypt, deriveKey } from "./credenciais-cifra.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export type CertificadoA1 = {
  pfxBase64: string;
  senha: string;
  arquivo: string;
  enviadoEm: string | null;
};

export type StatusDoCertificado = {
  tem_certificado: boolean;
  arquivo: string | null;
  enviado_em: string | null;
  com_senha: boolean;
};

async function ultimoEnvio(admin: Admin, empresaId: string) {
  const { data } = await admin
    .from("cert_upload_tokens")
    .select("cert_file_path, senha_cifrada, used_at")
    .eq("empresa_id", empresaId)
    .not("cert_file_path", "is", null)
    .order("used_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as { cert_file_path: string; senha_cifrada: string | null; used_at: string | null } | null;
}

export async function statusDoCertificado(admin: Admin, empresaId: string): Promise<StatusDoCertificado> {
  const envio = await ultimoEnvio(admin, empresaId);
  if (!envio) return { tem_certificado: false, arquivo: null, enviado_em: null, com_senha: false };
  return {
    tem_certificado: true,
    arquivo: envio.cert_file_path.split("/").pop() ?? envio.cert_file_path,
    enviado_em: envio.used_at,
    com_senha: !!envio.senha_cifrada,
  };
}

function paraBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let bin = "";
  const bloco = 0x8000;
  for (let i = 0; i < u8.length; i += bloco) bin += String.fromCharCode(...u8.subarray(i, i + bloco));
  return btoa(bin);
}

/** O .pfx e a senha em claro, ou o motivo de não haver. */
export async function carregarCertificadoA1(admin: Admin, empresaId: string): Promise<{ certificado: CertificadoA1 } | { erro: string; sem_certificado?: boolean }> {
  const envio = await ultimoEnvio(admin, empresaId);
  if (!envio) return { erro: "A empresa não tem certificado A1 cadastrado. Envie o .pfx em Financeiro › Integrações › Certificado digital A1.", sem_certificado: true };
  if (!envio.senha_cifrada) return { erro: "O certificado foi enviado sem a senha guardada — envie de novo pelo link de envio.", sem_certificado: true };
  const { data: arquivo, error } = await admin.storage.from("certificados").download(envio.cert_file_path);
  if (error || !arquivo) return { erro: `Não foi possível ler o certificado guardado: ${error?.message ?? "arquivo ausente"}` };
  let senha: string;
  try {
    senha = await decrypt(envio.senha_cifrada, await deriveKey());
  } catch {
    return { erro: "Não foi possível abrir a senha do certificado (chave de cifra ausente ou trocada)." };
  }
  return { certificado: { pfxBase64: paraBase64(await arquivo.arrayBuffer()), senha, arquivo: envio.cert_file_path, enviadoEm: envio.used_at } };
}
