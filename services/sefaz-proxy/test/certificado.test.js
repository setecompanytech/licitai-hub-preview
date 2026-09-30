import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confereCnpj, inspecionarPfx } from '../lib/certificado.js';

const temOpenssl = spawnSync('openssl', ['version']).status === 0;

test('abre o .pfx com a senha certa, diz o CNPJ e a validade; senha errada é dita como tal', { skip: !temOpenssl && 'sem openssl' }, () => {
  const pasta = mkdtempSync(join(tmpdir(), 'pfxteste-'));
  try {
    const req = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(pasta, 'k.pem'), '-out', join(pasta, 'c.pem'), '-days', '2', '-subj', '/CN=EMPRESA TESTE LTDA:12345678000199/O=ICP-Brasil']);
    assert.equal(req.status, 0, req.stderr?.toString());
    const exp = spawnSync('openssl', ['pkcs12', '-export', '-out', join(pasta, 't.pfx'), '-inkey', join(pasta, 'k.pem'), '-in', join(pasta, 'c.pem'), '-passout', 'pass:abc123']);
    assert.equal(exp.status, 0, exp.stderr?.toString());
    const pfxBase64 = readFileSync(join(pasta, 't.pfx')).toString('base64');

    const certo = inspecionarPfx({ pfxBase64, senha: 'abc123' });
    assert.equal(certo.ok, true);
    assert.equal(certo.cnpj, '12345678000199');
    assert.equal(certo.titular, 'EMPRESA TESTE LTDA');
    assert.equal(certo.vencido, false);
    assert.equal(confereCnpj(certo, '12.345.678/0001-99'), true);
    assert.equal(confereCnpj(certo, '33734346000172'), false);

    const errado = inspecionarPfx({ pfxBase64, senha: 'outra' });
    assert.equal(errado.ok, false);
    assert.equal(errado.motivo, 'senha_incorreta');
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('sem certificado', () => {
  assert.equal(inspecionarPfx({ pfxBase64: '', senha: 'x' }).ok, false);
});
