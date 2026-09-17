/**
 * O que mudou na licitação desde que a disputa foi cadastrada (17/09/2026) —
 * a regra da tela "Conferir alterações".
 *
 * ESPELHO de `supabase/functions/_shared/robo-alteracoes-da-licitacao.ts`, onde
 * está a explicação inteira (o feedback do Rafael, a Lei 14.133 e o que conta
 * como mudança). O front não importa código do Deno; o teste
 * `alteracoes-da-licitacao.test.ts` roda os mesmos casos nas duas cópias e exige
 * a mesma resposta. Aqui mora também o que a tela faz com a resposta:
 * `atualizarDisputaComALicitacao`.
 */
import type { DisputeItem, LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';

export type CampoDoItem = 'descricao' | 'quantidade' | 'unidade';

export type ItemCadastrado = {
  numero: number | string | null | undefined;
  descricao?: string | null;
  quantidade?: number | string | null;
  unidade?: string | null;
  origem?: string | null;
};

export type ItemPublicado = {
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  situacao: string | null;
};

export type LicitacaoPublicada = {
  situacao: string | null;
  /** Fim das propostas (ISO): no Compras.gov a sessão abre em seguida. */
  encerramentoPropostas: string | null;
  itens: ReadonlyArray<ItemPublicado>;
};

export type AlteracaoDoItem = {
  numero: number;
  tipo: 'alterado' | 'removido' | 'cancelado' | 'suspenso';
  campos: Array<{ campo: CampoDoItem; antes: string; depois: string }>;
  /** A situação publicada, para cancelado e suspenso. */
  situacao: string | null;
};

export type ResultadoDaConferencia = 'revogada' | 'suspensa' | 'itens-mudaram' | 'so-data' | 'sem-mudanca';

export type AlteracoesDaLicitacao = {
  resultado: ResultadoDaConferencia;
  situacaoDaLicitacao: string | null;
  itens: AlteracaoDoItem[];
  /** Itens publicados que a disputa não tem (escolha da empresa, não mudança). */
  foraDaDisputa: number;
  /** Instante publicado da sessão (ISO), quando há. */
  sessaoPublicada: string | null;
  dataMudou: boolean;
  sessaoPublicadaPassou: boolean;
};

/** A sessão abre logo depois do fim das propostas; até 1 hora depois é 'a mesma'. */
const MINUTOS_ENTRE_PROPOSTAS_E_SESSAO = 60;

const REVOGADA = /revogad|anulad|cancelad/i;
const SUSPENSA = /suspens/i;
const ITEM_SEM_DISPUTA = /cancelad|desert|fracassad|anulad|revogad/i;

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizar = (s: unknown) =>
  semAcento(String(s ?? '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** O cadastro acrescenta '(Cota reservada…)' à descrição publicada — não é mudança. */
const semBeneficio = (s: unknown) => String(s ?? '').replace(/\s*\([^)]*(cota|exclusiva)[^)]*\)\s*$/i, '');

const numeroOuNulo = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const formatarQuantidade = (n: number) => String(n).replace('.', ',');

export function alteracoesDaLicitacao(e: {
  itens: ReadonlyArray<ItemCadastrado>;
  /** Início da sessão da disputa (ms), ou nulo sem data. */
  inicioSessaoMs: number | null;
  licitacao: LicitacaoPublicada;
  agora: Date;
}): AlteracoesDaLicitacao {
  const situacao = e.licitacao.situacao ? String(e.licitacao.situacao) : null;
  const publicados = new Map(e.licitacao.itens.map((i) => [Number(i.numero), i]));
  const cadastrados = new Set<number>();
  const itens: AlteracaoDoItem[] = [];

  // Sem itens publicados não há com o que comparar: não acusar 'sumiu' em todos.
  if (publicados.size > 0) {
    for (const cad of e.itens) {
      const numero = numeroOuNulo(cad.numero);
      if (numero === null) continue;
      cadastrados.add(numero);
      const pub = publicados.get(numero);
      if (!pub) {
        itens.push({ numero, tipo: 'removido', campos: [], situacao: null });
        continue;
      }
      if (pub.situacao && ITEM_SEM_DISPUTA.test(pub.situacao)) {
        itens.push({ numero, tipo: 'cancelado', campos: [], situacao: pub.situacao });
        continue;
      }
      if (pub.situacao && SUSPENSA.test(pub.situacao)) {
        itens.push({ numero, tipo: 'suspenso', campos: [], situacao: pub.situacao });
        continue;
      }
      const campos: AlteracaoDoItem['campos'] = [];
      const qtdAntes = numeroOuNulo(cad.quantidade);
      if (qtdAntes !== null && Math.abs(qtdAntes - Number(pub.quantidade)) > 1e-9) {
        campos.push({ campo: 'quantidade', antes: formatarQuantidade(qtdAntes), depois: formatarQuantidade(Number(pub.quantidade)) });
      }
      if (cad.origem === 'comprasgov') {
        if (normalizar(semBeneficio(cad.descricao)) !== normalizar(pub.descricao)) {
          campos.push({ campo: 'descricao', antes: String(cad.descricao ?? ''), depois: pub.descricao });
        }
        if (normalizar(cad.unidade) !== normalizar(pub.unidade)) {
          campos.push({ campo: 'unidade', antes: String(cad.unidade ?? ''), depois: pub.unidade });
        }
      }
      if (campos.length) itens.push({ numero, tipo: 'alterado', campos, situacao: null });
    }
  }
  itens.sort((a, b) => a.numero - b.numero);

  const foraDaDisputa = [...publicados.keys()].filter((n) => !cadastrados.has(n)).length;

  const fim = e.licitacao.encerramentoPropostas ? Date.parse(e.licitacao.encerramentoPropostas) : NaN;
  const temFim = Number.isFinite(fim);
  let dataMudou = false;
  if (temFim) {
    if (e.inicioSessaoMs === null) {
      dataMudou = true;
    } else {
      const minutos = (e.inicioSessaoMs - fim) / 60000;
      dataMudou = !(minutos >= 0 && minutos <= MINUTOS_ENTRE_PROPOSTAS_E_SESSAO);
    }
  }
  const sessaoPublicadaPassou = temFim && fim < e.agora.getTime();

  let resultado: ResultadoDaConferencia;
  if (situacao && REVOGADA.test(situacao)) resultado = 'revogada';
  else if (situacao && SUSPENSA.test(situacao)) resultado = 'suspensa';
  else if (itens.length > 0) resultado = 'itens-mudaram';
  else if (dataMudou && !sessaoPublicadaPassou) resultado = 'so-data';
  else resultado = 'sem-mudanca';

  return {
    resultado,
    situacaoDaLicitacao: situacao,
    itens,
    foraDaDisputa,
    sessaoPublicada: temFim ? new Date(fim).toISOString() : null,
    dataMudou,
    sessaoPublicadaPassou,
  };
}

/** O robô não dá lance nesta disputa até alguém conferir? */
export function alteracoesTravamLances(a: AlteracoesDaLicitacao): boolean {
  return a.resultado === 'revogada' || a.resultado === 'suspensa' || a.resultado === 'itens-mudaram';
}

const NOME_DO_CAMPO: Record<CampoDoItem, string> = { descricao: 'descrição', quantidade: 'quantidade', unidade: 'unidade' };

/** Uma linha por item, para a tela e para o aviso. */
export function linhasDasAlteracoes(a: AlteracoesDaLicitacao): string[] {
  return a.itens.map((i) => {
    if (i.tipo === 'removido') return `Item ${i.numero}: não existe mais na licitação`;
    if (i.tipo === 'cancelado') return `Item ${i.numero}: ${String(i.situacao).toLowerCase()}`;
    if (i.tipo === 'suspenso') return `Item ${i.numero}: ${String(i.situacao).toLowerCase()}`;
    const partes = i.campos.map((c) =>
      c.campo === 'descricao' ? 'descrição mudou' : `${NOME_DO_CAMPO[c.campo]} ${c.antes} → ${c.depois}`
    );
    return `Item ${i.numero}: ${partes.join('; ')}`;
  });
}

/** O resumo curto do aviso de 'o robô entrou sem lance'. */
export function resumoDasAlteracoes(a: AlteracoesDaLicitacao): string {
  if (a.resultado === 'revogada') return `a licitação consta como '${a.situacaoDaLicitacao}'`;
  if (a.resultado === 'suspensa') return `a licitação consta como '${a.situacaoDaLicitacao}'`;
  const linhas = linhasDasAlteracoes(a);
  const mostradas = linhas.slice(0, 3).join(' · ');
  return linhas.length > 3 ? `${mostradas} · e mais ${linhas.length - 3}` : mostradas;
}


// ── O que a tela faz com a resposta ─────────────────────────────────────────

/**
 * A disputa atualizada com a licitação publicada ("Atualizar a disputa").
 *
 * - item igual: fica como está — piso, estratégias, margem, marca/modelo;
 * - item alterado: passa a ter a descrição, a quantidade e a unidade publicadas,
 *   e perde piso, estratégias, margem, lance final e marca/modelo — decididos
 *   para o item antigo, não valem para o novo (o risco que o Rafael apontou);
 * - item que sumiu, ou foi cancelado/deserto/fracassado: sai da disputa;
 * - a data vem da licitação, quando a sessão publicada ainda não passou;
 * - com qualquer item mudado, o Modo Automático desliga e o valor mínimo geral
 *   da disputa zera: o robô usa o piso geral no item sem piso próprio, e o geral
 *   também foi pensado para os itens antigos.
 */
export function atualizarDisputaComALicitacao(
  lance: LanceConfig,
  licitacao: LicitacaoPublicada & { itens: ReadonlyArray<ItemPublicado & { valorUnitarioEstimado?: number | null }> },
  alteracoes: AlteracoesDaLicitacao,
  sessao: { dataSessao: string; horario: string | null } | null,
): LanceConfig {
  const porNumero = new Map(alteracoes.itens.map((a) => [a.numero, a]));
  const publicados = new Map<number, ItemPublicado & { valorUnitarioEstimado?: number | null }>(
    licitacao.itens.map((i) => [Number(i.numero), i]),
  );
  const itens: DisputeItem[] = [];
  for (const item of lance.itens) {
    const alteracao = porNumero.get(Number(item.numero));
    if (alteracao?.tipo === 'removido' || alteracao?.tipo === 'cancelado') continue;
    const pub = publicados.get(Number(item.numero));
    if (alteracao?.tipo === 'alterado' && pub) {
      itens.push({
        ...item,
        descricao: pub.descricao,
        quantidade: pub.quantidade,
        unidade: pub.unidade,
        valorReferencia: pub.valorUnitarioEstimado ?? item.valorReferencia,
        valorEstimadoOrgao: pub.valorUnitarioEstimado ?? null,
        valorMinimo: null,
        estrategias: undefined,
        estrategia: undefined,
        margemDesempate: null,
        lanceFinalFechado: null,
        marca: undefined,
        modelo: undefined,
      });
      continue;
    }
    itens.push(item);
  }
  const itensMudaram = alteracoes.itens.length > 0;
  const comData = sessao && !alteracoes.sessaoPublicadaPassou;
  return {
    ...lance,
    itens,
    dataSessao: comData ? sessao.dataSessao : lance.dataSessao,
    horario: comData ? sessao.horario ?? '' : lance.horario,
    valorReferencia: itens.reduce((soma, i) => soma + (i.valorReferencia || 0) * (i.quantidade || 0), 0),
    valorMinimo: itensMudaram ? 0 : lance.valorMinimo,
    modoAutomatico: itensMudaram ? false : lance.modoAutomatico,
  };
}
