/**
 * Espelho do Comprovante de Inscrição e de Situação Cadastral (22/09/2026).
 *
 * A Consulta CNPJ recebe da fonte pública os mesmos campos que o comprovante
 * da Receita mostra, mas a tela desenhava uma lista genérica de rótulo e
 * valor e descartava metade (print do dono, 22/09: "por que o sistema não
 * espelha o modelo da Receita, se ele extrai as informações?"). Aqui mora a
 * estrutura do formulário — as caixas, na ordem e com os rótulos do
 * comprovante — que a tela e a impressão desenham a partir de uma fonte só.
 *
 * Na tarde de 22/09 o dono pediu UM quadro só, fiel ao da Receita: o campo
 * sem valor sai como o comprovante imprime ("********"); o quadro de sócios
 * segue a consulta oficial de QSA (capital social, nome e qualificação com o
 * código da tabela da Receita, representante legal quando há); e nada de
 * estimativa — a faixa etária do sócio, que é intervalo da base pública e não
 * consta de documento oficial, saiu.
 *
 * O que o espelho NÃO é: o comprovante oficial. A base pública é republicada
 * mensalmente e não carrega hora de emissão; o oficial sai só no site da
 * Receita, atrás do "Sou humano". O rodapé diz isso, sempre.
 */
import { valorPorExtenso } from '@/lib/numero-extenso';

export const URL_COMPROVANTE_OFICIAL = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/';
export const URL_QSA_OFICIAL = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_qsa.asp';

export interface SocioDoEspelho {
  nome: string;
  qualificacao: string;
  /** O código da qualificação na tabela da Receita (49 = Sócio-Administrador). */
  qualificacaoCodigo?: string;
  representanteLegal?: string;
  qualificacaoRepresentante?: string;
  qualificacaoRepresentanteCodigo?: string;
  dataEntrada?: string;
  /** Intervalo estimado pela base pública; não entra no espelho (22/09). */
  faixaEtaria?: string;
  cnpjCpf?: string;
}

export interface CnaeDoEspelho {
  codigo: string;
  descricao: string;
}

/** O que a função `consulta-cnpj` devolve; os campos novos são opcionais até a edge ser implantada. */
export interface DadosDoEspelho {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao?: string;
  dataAbertura?: string;
  naturezaJuridica?: string;
  naturezaJuridicaCodigo?: string;
  naturezaJuridicaDescricao?: string;
  cnaePrincipal?: string;
  cnaePrincipalCodigo?: string;
  cnaePrincipalDescricao?: string;
  cnaesSecundarios?: string[];
  cnaesSecundariosDetalhados?: CnaeDoEspelho[];
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
  email?: string;
  telefone?: string;
  porte?: string;
  capitalSocial?: string | number;
  matrizFilial?: string;
  dataSituacaoCadastral?: string;
  motivoSituacaoCadastral?: string;
  situacaoEspecial?: string;
  dataSituacaoEspecial?: string;
  enteFederativoResponsavel?: string;
  qsa?: SocioDoEspelho[];
  fonte?: string;
  consultadoEm?: string;
}

/** Uma caixa do formulário: rótulo em cima, valor embaixo; `largura` em doze avos da linha. */
export interface CaixaDoEspelho {
  rotulo: string;
  valor: string;
  /** Segunda linha do valor (MATRIZ sob o número de inscrição). */
  subvalor?: string;
  /** Caixa de lista (as atividades secundárias). */
  lista?: string[];
  /** Caixa de título, sem rótulo, centralizada. */
  titulo?: boolean;
  largura: number;
}

export type LinhaDoEspelho = CaixaDoEspelho[];

export const VAZIO = '—';
/** O comprovante da Receita imprime asteriscos no campo sem valor. */
export const VAZIO_DO_COMPROVANTE = '********';

const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const ou = (v: unknown) => {
  const s = String(v ?? '').trim();
  return s ? s : VAZIO_DO_COMPROVANTE;
};

/** 4712100 → 47.12-1-00; já formatado passa como veio. */
export function formatarCnae(codigo: unknown): string {
  const d = digitos(codigo);
  if (d.length !== 7) return String(codigo ?? '').trim();
  return `${d.slice(0, 2)}.${d.slice(2, 4)}-${d.slice(4, 5)}-${d.slice(5, 7)}`;
}

/** 2062 → 206-2. */
export function formatarNaturezaJuridica(codigo: unknown): string {
  const d = digitos(codigo);
  if (d.length !== 4) return String(codigo ?? '').trim();
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

/** 66640085 → 66.640-085, como no comprovante. */
export function formatarCep(cep: unknown): string {
  const d = digitos(cep);
  if (d.length !== 8) return String(cep ?? '').trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
}

/** 2016-04-28 → 28/04/2016; o que não for ISO passa como veio. */
export function dataBr(valor: unknown): string {
  const s = String(valor ?? '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : s;
}

export function dataHoraBr(iso: unknown): string {
  const s = String(iso ?? '');
  const d = new Date(s);
  if (!s || Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** O comprovante escreve a sigla: ME, EPP, DEMAIS. */
export function siglaDoPorte(porte: unknown): string {
  const p = String(porte ?? '').trim().toUpperCase();
  if (!p) return VAZIO_DO_COMPROVANTE;
  if (p === 'ME' || p.startsWith('MICRO')) return 'ME';
  if (p === 'EPP' || p.includes('PEQUENO PORTE')) return 'EPP';
  return p;
}

export function nomeDaFonte(fonte: unknown): string {
  switch (String(fonte ?? '')) {
    case 'cnpj.ws': return 'CNPJ.ws';
    case 'cnpja': return 'CNPJA';
    case 'receitaws': return 'ReceitaWS';
    default: return 'BrasilAPI';
  }
}

/** "4712100 - Comércio…" (formato antigo da edge) ou código + descrição separados. */
function codigoEDescricao(codigo: unknown, descricao: unknown, junto: unknown, formatar: (c: unknown) => string): string {
  if (String(codigo ?? '').trim() || String(descricao ?? '').trim()) {
    return `${formatar(codigo)} - ${String(descricao ?? '').trim()}`.replace(/^ - /, '').replace(/ - $/, '');
  }
  const s = String(junto ?? '').trim();
  if (!s || s === ' - ' || s === '-') return VAZIO_DO_COMPROVANTE;
  const [cod, ...resto] = s.split(' - ');
  return resto.length > 0 ? `${formatar(cod)} - ${resto.join(' - ')}` : s;
}

export function atividadesSecundarias(d: DadosDoEspelho): string[] {
  if (d.cnaesSecundariosDetalhados && d.cnaesSecundariosDetalhados.length > 0) {
    return d.cnaesSecundariosDetalhados.map((c) => `${formatarCnae(c.codigo)} - ${c.descricao}`);
  }
  return (d.cnaesSecundarios ?? []).map((s) => codigoEDescricao('', '', s, formatarCnae));
}

/** As caixas do comprovante, na ordem e com os rótulos da Receita. */
export function caixasDoEspelho(d: DadosDoEspelho): LinhaDoEspelho[] {
  const secundarias = atividadesSecundarias(d);
  return [
    [
      { rotulo: 'Número de inscrição', valor: ou(d.cnpj), subvalor: d.matrizFilial ? String(d.matrizFilial).toUpperCase() : undefined, largura: 3 },
      { rotulo: '', valor: 'Espelho do comprovante de inscrição e de situação cadastral', titulo: true, largura: 6 },
      { rotulo: 'Data de abertura', valor: ou(dataBr(d.dataAbertura)), largura: 3 },
    ],
    [{ rotulo: 'Nome empresarial', valor: ou(d.razaoSocial), largura: 12 }],
    [
      { rotulo: 'Título do estabelecimento (nome de fantasia)', valor: ou(d.nomeFantasia), largura: 10 },
      { rotulo: 'Porte', valor: siglaDoPorte(d.porte), largura: 2 },
    ],
    [{
      rotulo: 'Código e descrição da atividade econômica principal',
      valor: codigoEDescricao(d.cnaePrincipalCodigo, d.cnaePrincipalDescricao, d.cnaePrincipal, formatarCnae),
      largura: 12,
    }],
    [{
      rotulo: 'Código e descrição das atividades econômicas secundárias',
      valor: secundarias.length > 0 ? '' : 'Não informada',
      lista: secundarias.length > 0 ? secundarias : undefined,
      largura: 12,
    }],
    [{
      rotulo: 'Código e descrição da natureza jurídica',
      valor: codigoEDescricao(d.naturezaJuridicaCodigo, d.naturezaJuridicaDescricao, d.naturezaJuridica, formatarNaturezaJuridica),
      largura: 12,
    }],
    [
      { rotulo: 'Logradouro', valor: ou(d.logradouro), largura: 6 },
      { rotulo: 'Número', valor: ou(d.numero), largura: 2 },
      { rotulo: 'Complemento', valor: ou(d.complemento), largura: 4 },
    ],
    [
      { rotulo: 'CEP', valor: d.cep ? formatarCep(d.cep) : VAZIO_DO_COMPROVANTE, largura: 2 },
      { rotulo: 'Bairro/Distrito', valor: ou(d.bairro), largura: 4 },
      { rotulo: 'Município', valor: ou(d.municipio), largura: 4 },
      { rotulo: 'UF', valor: ou(d.uf), largura: 2 },
    ],
    [
      { rotulo: 'Endereço eletrônico', valor: ou(d.email), largura: 6 },
      { rotulo: 'Telefone', valor: ou(d.telefone), largura: 6 },
    ],
    [{ rotulo: 'Ente federativo responsável (EFR)', valor: ou(d.enteFederativoResponsavel), largura: 12 }],
    [
      { rotulo: 'Situação cadastral', valor: ou(d.situacao), largura: 8 },
      { rotulo: 'Data da situação cadastral', valor: ou(dataBr(d.dataSituacaoCadastral)), largura: 4 },
    ],
    [{ rotulo: 'Motivo de situação cadastral', valor: ou(d.motivoSituacaoCadastral), largura: 12 }],
    [
      { rotulo: 'Situação especial', valor: ou(d.situacaoEspecial), largura: 8 },
      { rotulo: 'Data da situação especial', valor: ou(dataBr(d.dataSituacaoEspecial)), largura: 4 },
    ],
  ];
}

// ── O quadro de sócios e administradores, como a consulta oficial de QSA ────

export function sociosDoEspelho(d: DadosDoEspelho): SocioDoEspelho[] {
  return (d.qsa ?? []).filter((s) => String(s?.nome ?? '').trim());
}

/** "49-Sócio-Administrador": o código da tabela da Receita e a descrição, como a consulta de QSA escreve. */
export function qualificacaoDoSocio(s: Pick<SocioDoEspelho, 'qualificacao' | 'qualificacaoCodigo'>): string {
  const descricao = String(s.qualificacao ?? '').trim();
  const codigo = digitos(s.qualificacaoCodigo);
  if (codigo && descricao) return `${codigo}-${descricao}`;
  return descricao || codigo || VAZIO_DO_COMPROVANTE;
}

/** O capital social como número: "R$ 500.000,00", "500000", 500000 → 500000; sem valor legível, null. */
export function numeroDoCapital(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const limpo = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (!/\d/.test(limpo)) return null;
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : /\.\d{3}$/.test(limpo) ? limpo.replace(/\./g, '') : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** "R$ 500.000,00 (Quinhentos mil reais)", como a consulta de QSA da Receita escreve; sem valor, vazio. */
export function capitalSocialLegivel(capital: unknown): string {
  const valor = numeroDoCapital(capital);
  if (valor === null) return '';
  // Espaço comum entre "R$" e o número, como a consulta da Receita escreve
  // (o formatador põe espaço inseparável).
  const moeda = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
  const extenso = valorPorExtenso(valor);
  return extenso ? `${moeda} (${extenso.charAt(0).toUpperCase()}${extenso.slice(1)})` : moeda;
}

export interface LinhaDoQsa {
  nome: string;
  qualificacao: string;
  representante: string;
  qualificacaoRepresentante: string;
}

/** As linhas do QSA: nome, qualificação com código, representante legal quando há. Nada de faixa etária. */
export function linhasDoQsa(d: DadosDoEspelho): LinhaDoQsa[] {
  return sociosDoEspelho(d).map((s) => ({
    nome: String(s.nome).trim(),
    qualificacao: qualificacaoDoSocio(s),
    representante: String(s.representanteLegal ?? '').trim(),
    qualificacaoRepresentante: String(s.representanteLegal ?? '').trim()
      ? qualificacaoDoSocio({ qualificacao: s.qualificacaoRepresentante ?? '', qualificacaoCodigo: s.qualificacaoRepresentanteCodigo })
      : '',
  }));
}

export const qsaTemRepresentante = (linhas: LinhaDoQsa[]): boolean => linhas.some((l) => l.representante);

/** O rodapé que separa espelho de comprovante — sempre presente. */
export function rodapeDoEspelho(d: DadosDoEspelho): string {
  const quando = dataHoraBr(d.consultadoEm);
  return `Consultado ${quando ? `em ${quando} ` : ''}pela ${nomeDaFonte(d.fonte)}, que redistribui a base pública de CNPJ da Receita Federal, republicada mensalmente. `
    + `Espelho para consulta: não substitui o comprovante oficial, emitido em ${URL_COMPROVANTE_OFICIAL}.`;
}

const escapar = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** O documento para imprimir ou salvar em PDF, desenhado das mesmas caixas. */
export function htmlDoEspelho(d: DadosDoEspelho): string {
  const linhas = caixasDoEspelho(d).map((linha) =>
    `<div class="linha">${linha.map((c) => {
      const miolo = c.lista
        ? `<ul>${c.lista.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`
        : `<span class="valor">${escapar(c.valor)}</span>${c.subvalor ? `<span class="valor">${escapar(c.subvalor)}</span>` : ''}`;
      return `<div class="caixa${c.titulo ? ' titulo' : ''}" style="flex:${c.largura}">`
        + (c.rotulo ? `<span class="rotulo">${escapar(c.rotulo)}</span>` : '')
        + miolo + '</div>';
    }).join('')}</div>`,
  ).join('');
  const socios = linhasDoQsa(d);
  const capital = capitalSocialLegivel(d.capitalSocial);
  const comRepresentante = qsaTemRepresentante(socios);
  const qsa = socios.length > 0
    ? `<h2>Quadro de sócios e administradores</h2>`
      + (capital ? `<p class="capital">CAPITAL SOCIAL: ${escapar(capital)}</p>` : '')
      + `<table><tr><th>Nome/Nome empresarial</th><th>Qualificação</th>${comRepresentante ? '<th>Representante legal</th><th>Qualificação do representante</th>' : ''}</tr>${
        socios.map((s) => `<tr><td>${escapar(s.nome)}</td><td>${escapar(s.qualificacao)}</td>${
          comRepresentante ? `<td>${escapar(s.representante || VAZIO_DO_COMPROVANTE)}</td><td>${escapar(s.qualificacaoRepresentante || VAZIO_DO_COMPROVANTE)}</td>` : ''
        }</tr>`).join('')
      }</table>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Espelho do comprovante — ${escapar(d.cnpj)}</title><style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:760px;margin:2rem auto;padding:0 1.5rem;font-size:12px;line-height:1.4}
  h1{font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:.03em;margin:0 0 2px}
  .sub{text-align:center;color:#555;margin:0 0 14px;font-size:11px}
  .documento{border:1px solid #333;padding:4px}
  .linha{display:flex;gap:4px;margin-bottom:4px}
  .caixa{border:1px solid #444;padding:3px 6px;min-height:34px;display:flex;flex-direction:column;justify-content:flex-start}
  .caixa.titulo{align-items:center;justify-content:center;text-align:center;font-weight:700;text-transform:uppercase;font-size:12px}
  .rotulo{font-size:8px;text-transform:uppercase;color:#333;letter-spacing:.02em}
  .valor{font-weight:700;font-size:11px;word-break:break-word}
  ul{margin:2px 0 0;padding-left:0;list-style:none} li{font-weight:700;font-size:11px}
  h2{font-size:12px;text-transform:uppercase;margin:16px 0 6px;border-bottom:1px solid #999;padding-bottom:2px}
  .capital{font-weight:700;font-size:11px;margin:0 0 6px}
  table{width:100%;border-collapse:collapse} th,td{border:1px solid #bbb;padding:3px 6px;text-align:left;font-size:11px} th{background:#f0f0f0}
  .rodape{margin-top:14px;font-size:10px;color:#444}
  @media print{body{margin:0 auto}}
</style></head><body>
<h1>Espelho do Comprovante de Inscrição e de Situação Cadastral</h1>
<p class="sub">Cadastro Nacional da Pessoa Jurídica · dados públicos da Receita Federal</p>
<div class="documento">${linhas}</div>
${qsa}
<p class="rodape">${escapar(rodapeDoEspelho(d))}</p>
<script>window.print()</script>
</body></html>`;
}
