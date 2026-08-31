import type { NFeData } from '@/lib/parseNFe';

/**
 * O espelho da nota, para quando só existe o XML.
 *
 * Quem anexa apenas o XML não consegue VER a nota: o navegador abre marcação
 * crua. O dado está todo ali — `parseNFe` já o extrai por inteiro —, só não
 * havia como lê-lo com olhos humanos.
 *
 * ── Por que "espelho", e não "DANFE" ────────────────────────────────────────
 *
 * O DANFE é o documento auxiliar oficial: layout definido no Manual de
 * Orientação do Contribuinte, com código de barras e área reservada ao Fisco.
 * Reproduzi-lo de aproximação e chamá-lo de DANFE convidaria alguém a
 * apresentá-lo como se fosse o oficial — e ele não é.
 *
 * Isto é uma leitura do XML, dita como tal na própria folha. Serve para
 * conferir, discutir e arquivar; não substitui o DANFE, que se obtém de quem
 * emitiu ou do portal da SEFAZ.
 */

const brl = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const qtd = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });

const data = (v: string | null | undefined) => {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || '—');
};

const doc = (v: string | null | undefined) => {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v || '—';
};

/** A chave em grupos de quatro, como o papel a imprime. */
const chave = (v: string | null | undefined) =>
  String(v ?? '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim() || '—';

const escapar = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * Monta a folha em HTML.
 *
 * HTML e não PDF: o navegador imprime em PDF quando se quer o arquivo, e uma
 * folha que se lê na tela resolve o caso comum — conferir a nota — sem
 * carregar um gerador de PDF para dentro do pacote.
 */
export function espelhoDaNfe(nfe: NFeData): string {
  const itens = (nfe.itens ?? []).map((i) => `
    <tr>
      <td class="n">${escapar(i.n_item)}</td>
      <td>${escapar(i.x_prod)}</td>
      <td class="n">${escapar(i.ncm)}</td>
      <td class="n">${escapar(i.cfop)}</td>
      <td class="n">${escapar(i.u_com)}</td>
      <td class="n num">${qtd(i.q_com)}</td>
      <td class="n num">${brl(i.v_un_com)}</td>
      <td class="n num">${brl(i.v_prod)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Espelho da NF-e ${escapar(nfe.numero_nf)}</title>
<style>
  :root { --tinta:#14181e; --fraca:#6b7480; --regua:#d9dde3; }
  * { box-sizing:border-box; }
  body { font:13px/1.5 system-ui,-apple-system,sans-serif; color:var(--tinta);
         margin:0; padding:24px; background:#fff; }
  .folha { max-width:52rem; margin:0 auto; }
  .aviso { border:1px solid #c9a227; background:#fdf8e7; color:#6b5310;
           padding:10px 12px; border-radius:6px; font-size:12px; margin-bottom:18px; }
  h1 { font-size:19px; margin:0 0 2px; }
  .sub { color:var(--fraca); font-size:12px; margin:0 0 18px; }
  .grade { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; }
  .bloco { border:1px solid var(--regua); border-radius:6px; padding:10px 12px; }
  .bloco h2 { font-size:11px; text-transform:uppercase; letter-spacing:.08em;
              color:var(--fraca); margin:0 0 6px; font-weight:600; }
  .linha { display:flex; justify-content:space-between; gap:12px; padding:2px 0; }
  .linha span:first-child { color:var(--fraca); }
  .chave { font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px;
           word-break:break-all; }
  table { border-collapse:collapse; width:100%; font-size:12px; margin-bottom:18px; }
  th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.06em;
       color:var(--fraca); border-bottom:1px solid var(--regua); padding:0 8px 5px 0; }
  td { padding:5px 8px 5px 0; border-bottom:1px solid #eef0f3; vertical-align:top; }
  td.n { white-space:nowrap; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .totais { margin-left:auto; width:22rem; }
  .totais .linha { border-bottom:1px solid #eef0f3; padding:5px 0; }
  .totais .total { font-weight:600; font-size:15px; border-bottom:0; padding-top:8px; }
  @media print { body { padding:0; } .naoimprime { display:none; } }
  button { font:inherit; padding:6px 14px; border:1px solid var(--regua);
           border-radius:6px; background:#fff; cursor:pointer; }
</style></head>
<body><div class="folha">
  <div class="aviso">
    <b>Espelho da nota — leitura do XML.</b> Não é o DANFE e não o substitui:
    o documento auxiliar oficial tem layout próprio, definido no Manual de
    Orientação do Contribuinte, e se obtém de quem emitiu ou do portal da SEFAZ.
  </div>

  <h1>NF-e nº ${escapar(nfe.numero_nf)} · série ${escapar(nfe.serie)}</h1>
  <p class="sub">Emitida em ${data(nfe.data_emissao)} · ${escapar(nfe.nat_op || 'natureza não informada')}</p>

  <div class="grade">
    <div class="bloco">
      <h2>Emitente</h2>
      <div><b>${escapar(nfe.nome_emitente)}</b></div>
      <div class="linha"><span>CNPJ</span><span>${doc(nfe.cnpj_emitente)}</span></div>
      <div class="linha"><span>IE</span><span>${escapar(nfe.ie_emitente || '—')}</span></div>
      <div class="linha"><span>Município</span><span>${escapar(nfe.municipio_emitente || '—')}/${escapar(nfe.uf_emitente || '')}</span></div>
    </div>
    <div class="bloco">
      <h2>Destinatário</h2>
      <div><b>${escapar(nfe.nome_dest)}</b></div>
      <div class="linha"><span>CNPJ/CPF</span><span>${doc(nfe.cnpj_dest || nfe.cpf_dest)}</span></div>
      <div class="linha"><span>IE</span><span>${escapar(nfe.ie_dest || '—')}</span></div>
      <div class="linha"><span>UF</span><span>${escapar(nfe.uf_dest || '—')}</span></div>
    </div>
  </div>

  <div class="bloco" style="margin-bottom:18px">
    <h2>Chave de acesso</h2>
    <div class="chave">${chave(nfe.chave_acesso)}</div>
    ${nfe.protocolo_auth ? `<div class="linha" style="margin-top:6px"><span>Protocolo de autorização</span><span>${escapar(nfe.protocolo_auth)}</span></div>` : ''}
    ${nfe.status_sefaz ? `<div class="linha"><span>Situação na SEFAZ</span><span>${escapar(nfe.status_sefaz)}</span></div>` : ''}
  </div>

  ${itens ? `<table>
    <thead><tr>
      <th>#</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>Un.</th>
      <th class="num">Qtd.</th><th class="num">Unitário</th><th class="num">Total</th>
    </tr></thead>
    <tbody>${itens}</tbody>
  </table>` : '<p class="sub">O XML não trouxe itens.</p>'}

  <div class="bloco totais">
    <div class="linha"><span>Produtos</span><span>${brl(nfe.v_prod)}</span></div>
    ${nfe.v_frete ? `<div class="linha"><span>Frete</span><span>${brl(nfe.v_frete)}</span></div>` : ''}
    ${nfe.v_desc ? `<div class="linha"><span>Desconto</span><span>− ${brl(nfe.v_desc)}</span></div>` : ''}
    ${nfe.v_icms ? `<div class="linha"><span>ICMS</span><span>${brl(nfe.v_icms)}</span></div>` : ''}
    <div class="linha total"><span>Total da nota</span><span>${brl(nfe.v_nf)}</span></div>
  </div>

  ${nfe.inf_compl ? `<div class="bloco" style="margin-top:18px"><h2>Informações complementares</h2><div>${escapar(nfe.inf_compl)}</div></div>` : ''}

  <p class="naoimprime" style="margin-top:22px">
    <button onclick="window.print()">Imprimir ou salvar em PDF</button>
  </p>
</div></body></html>`;
}

/** Abre o espelho numa aba nova. */
export function abrirEspelho(nfe: NFeData): boolean {
  const janela = window.open('', '_blank', 'noopener,noreferrer');
  // Bloqueador de pop-up devolve null. Dizer isso é melhor do que a aba não
  // abrir e ninguém saber por quê.
  if (!janela) return false;
  janela.document.write(espelhoDaNfe(nfe));
  janela.document.close();
  return true;
}
