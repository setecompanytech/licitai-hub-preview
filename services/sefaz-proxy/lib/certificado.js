/**
 * O certificado A1 aberto pelo OpenSSL — para dizer, antes de falar com a
 * SEFAZ, se a senha abre o .pfx, de quem ele é e até quando vale.
 *
 * "mac verify failure" na chamada mTLS não diz nada a quem opera. Aqui o
 * .pfx vai a um arquivo temporário (0600, apagado em seguida), a senha vai
 * por variável de ambiente (nunca em argumento, que aparece em `ps`), e a
 * saída é só o certificado público (-nokeys). Nada é logado.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { X509Certificate } from 'node:crypto';

const digitos = (s) => String(s ?? '').replace(/\D/g, '');

function rodarOpenssl(args, senha) {
  return spawnSync('openssl', args, { env: { ...process.env, PFX_SENHA: senha }, encoding: 'utf8', timeout: 15000 });
}

/**
 * @returns {{ ok: true, cn, cnpj, titular, emissor, valido_de, valido_ate, vencido, serial }
 *         | { ok: false, motivo: 'senha_incorreta'|'formato'|'openssl_ausente'|'invalido', mensagem }}
 */
export function inspecionarPfx({ pfxBase64, senha }) {
  if (!pfxBase64) return { ok: false, motivo: 'invalido', mensagem: 'Certificado ausente.' };
  const pasta = mkdtempSync(join(tmpdir(), 'pfx-'));
  const arquivo = join(pasta, 'c.pfx');
  try {
    writeFileSync(arquivo, Buffer.from(pfxBase64, 'base64'), { mode: 0o600 });
    const base = ['pkcs12', '-in', arquivo, '-clcerts', '-nokeys', '-passin', 'env:PFX_SENHA'];
    let r = rodarOpenssl(base, senha ?? '');
    if (r.error && r.error.code === 'ENOENT') return { ok: false, motivo: 'openssl_ausente', mensagem: 'O proxy não tem o OpenSSL instalado.' };
    let saida = r.stdout ?? '';
    let erro = (r.stderr ?? '') + (r.error ? String(r.error.message) : '');
    // OpenSSL 3 recusa .pfx antigo (RC2/3DES) sem -legacy; LibreSSL não conhece a opção.
    if (r.status !== 0 && /unsupported|legacy/i.test(erro)) {
      const r2 = rodarOpenssl([...base, '-legacy'], senha ?? '');
      if (r2.status === 0) { saida = r2.stdout ?? ''; erro = ''; r = r2; }
      else erro += ' ' + (r2.stderr ?? '');
    }
    if (r.status !== 0 || !/-----BEGIN CERTIFICATE-----/.test(saida)) {
      if (/mac verify|invalid password|password/i.test(erro)) return { ok: false, motivo: 'senha_incorreta', mensagem: 'A senha informada não abre este .pfx. Envie o certificado de novo com a senha correta.' };
      if (/unsupported|legacy/i.test(erro)) return { ok: false, motivo: 'formato', mensagem: 'O .pfx usa um formato antigo que o OpenSSL do proxy não abre; exporte-o de novo (AES) no gerenciador de certificados.' };
      return { ok: false, motivo: 'invalido', mensagem: `O OpenSSL não abriu o .pfx: ${erro.trim().split('\n').slice(-1)[0] || 'arquivo inválido'}` };
    }
    const pem = saida.slice(saida.indexOf('-----BEGIN CERTIFICATE-----'), saida.indexOf('-----END CERTIFICATE-----') + '-----END CERTIFICATE-----'.length);
    const cert = new X509Certificate(pem);
    const cn = /CN=([^\n,/]+)/.exec(cert.subject)?.[1]?.trim() ?? cert.subject;
    const cnpjNoCn = /:(\d{14})\b/.exec(cn)?.[1] ?? null;
    const validoAte = new Date(cert.validTo);
    return {
      ok: true,
      cn,
      titular: cn.split(':')[0].trim(),
      cnpj: cnpjNoCn,
      emissor: /CN=([^\n,/]+)/.exec(cert.issuer)?.[1]?.trim() ?? cert.issuer,
      valido_de: new Date(cert.validFrom).toISOString(),
      valido_ate: validoAte.toISOString(),
      vencido: validoAte.getTime() < Date.now(),
      serial: cert.serialNumber,
    };
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

/** O certificado serve para consultar este CNPJ? (o A1 é do próprio interessado) */
export function confereCnpj(inspecao, cnpj) {
  if (!inspecao?.ok || !inspecao.cnpj) return null;
  return inspecao.cnpj === digitos(cnpj);
}
