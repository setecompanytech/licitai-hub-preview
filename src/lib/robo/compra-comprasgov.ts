/**
 * A compra do Compras.gov na tela da disputa — itens, sessão e resumo.
 *
 * Fase 6 do robô (checklist do grupo, 14/09/2026). Quem busca é a edge function
 * `compra-comprasgov` (dados abertos do Compras.gov, por UASG + número/ano); a
 * regra de leitura da resposta crua mora em
 * `supabase/functions/_shared/compra-comprasgov.ts`.
 *
 * ESPELHO: os tipos abaixo repetem o contrato da resposta daquela função — o
 * front não importa código do Deno (mesmo padrão de `lib/licitacao/status.ts`).
 */
import type { DisputeItem } from '@/components/robo-lances/ConfigurarLanceDialog';
import { supabase } from '@/integrations/supabase/client';
import { sessaoDoProcesso, type SessaoDoProcesso } from '@/lib/robo/agendamento';

export interface ItemDaCompra {
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitarioEstimado: number | null;
  sigiloso: boolean;
  grupo: string | null;
  beneficio: string | null;
  situacao: string | null;
  criterio: string | null;
  materialOuServico: string | null;
}

export interface CompraDoComprasGov {
  idCompra: string;
  uasg: string;
  numero: number;
  ano: number;
  modalidade: string;
  orgao: string | null;
  unidade: string | null;
  uf: string | null;
  municipio: string | null;
  objeto: string | null;
  srp: boolean;
  modoDisputa: string | null;
  criterio: string | null;
  situacao: string | null;
  processo: string | null;
  aberturaPropostas: string | null;
  encerramentoPropostas: string | null;
  numeroControlePncp: string | null;
  urlPncp: string | null;
  itens: ItemDaCompra[];
}

/** Interface simples, e não união: o tsconfig do app não estreita uniões. */
export interface ResultadoDaBusca {
  ok: boolean;
  compras?: CompraDoComprasGov[];
  motivo?: string;
}

/**
 * O botão de busca só acende com o que a função exige: UASG de 6 dígitos e
 * número/ano (até 5 dígitos no número). Espelho de `lerNumeroEAno`/`uasgValida`.
 */
export function podeBuscarCompra(uasg: string, edital: string): boolean {
  const m = edital.match(/(\d{1,6})\s*\/\s*(\d{4})/);
  return /^\d{6}$/.test(uasg) && !!m && Number(m[1]) > 0 && Number(m[1]) <= 99999;
}

/** Busca a compra. Nunca lança: a tela mostra o motivo que vier. */
export async function buscarCompraDoComprasGov(uasg: string, edital: string): Promise<ResultadoDaBusca> {
  try {
    const { data, error } = await supabase.functions.invoke('compra-comprasgov', { body: { uasg, edital } });
    if (error) return { ok: false, motivo: `Não foi possível consultar o Compras.gov: ${error.message}` };
    if (!data?.success) return { ok: false, motivo: String(data?.error || 'O Compras.gov não devolveu a compra.') };
    return { ok: true, compras: (data.compras ?? []) as CompraDoComprasGov[] };
  } catch (e) {
    return { ok: false, motivo: `Não foi possível consultar o Compras.gov: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Benefícios que mudam quem pode disputar o item — vão para a descrição. */
const BENEFICIO_QUE_IMPORTA = /cota|exclusiva/i;

/**
 * Itens da compra → itens da disputa.
 *
 * O valor é o ESTIMADO PELO ÓRGÃO (teto), nunca o nosso preço: a origem
 * `comprasgov` diz isso na tela. Orçamento sigiloso vem sem valor, e o piso
 * vem vazio sempre — é decisão da empresa, não dado do edital.
 */
export function itensDaCompraParaDisputa(itens: ItemDaCompra[]): DisputeItem[] {
  return itens.map((item) => ({
    id: crypto.randomUUID(),
    licitacaoItemId: null,
    numero: item.numero,
    descricao:
      item.beneficio && BENEFICIO_QUE_IMPORTA.test(item.beneficio)
        ? `${item.descricao} (${item.beneficio})`
        : item.descricao,
    quantidade: item.quantidade,
    unidade: item.unidade,
    valorReferencia: item.valorUnitarioEstimado ?? 0,
    valorEstimadoOrgao: item.valorUnitarioEstimado,
    valorMinimo: null,
    origem: 'comprasgov',
    lote: item.grupo ?? 'Único',
    disputando: true,
    situacao: 'aguardando' as const,
    melhorLance: null,
    seuUltimoLance: null,
  }));
}

/**
 * Data e horário da sessão a partir da compra: o fim do prazo de propostas.
 * No Compras.gov a sessão abre em seguida (7/2026: propostas até 08:59, sessão
 * às 09:00). A abertura do prazo NÃO é a sessão, então não entra.
 */
export function sessaoDaCompra(compra: CompraDoComprasGov): SessaoDoProcesso | null {
  return sessaoDoProcesso({ data_abertura: null, data_encerramento: compra.encerramentoPropostas });
}

const dataHora = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
  return `${p('day')}/${p('month')}/${p('year')} às ${p('hour')}:${p('minute')}`;
};

/** A sessão abre logo depois do fim das propostas; até 1 hora depois ainda é "a mesma". */
export const MINUTOS_ENTRE_PROPOSTAS_E_SESSAO = 60;

/**
 * A data da disputa confere com a compra publicada?
 *
 * Disputa cadastrada à mão não tem processo, então o gatilho de "pregão
 * remarcado" (que olha o processo) não a alcança. A página da disputa lê a
 * compra ao vivo e diz quando o Compras.gov mostra outra data — antes de o
 * robô entrar na hora errada.
 *
 * @param inicioSessaoMs o instante da disputa (data + horário), ou nulo sem data
 * @returns o aviso, ou nulo quando confere ou quando a compra não tem prazo
 */
export function divergenciaDaSessao(compra: CompraDoComprasGov, inicioSessaoMs: number | null): string | null {
  if (!compra.encerramentoPropostas) return null;
  const fim = Date.parse(compra.encerramentoPropostas);
  if (Number.isNaN(fim)) return null;
  const publicado = dataHora(compra.encerramentoPropostas);
  if (inicioSessaoMs === null) {
    return `O Compras.gov mostra propostas até ${publicado}, e esta disputa está sem data — sem ela o robô não entra sozinho.`;
  }
  const minutos = (inicioSessaoMs - fim) / 60000;
  if (minutos >= 0 && minutos <= MINUTOS_ENTRE_PROPOSTAS_E_SESSAO) return null;
  return `O Compras.gov mostra propostas até ${publicado}, e esta disputa está marcada para ${dataHora(new Date(inicioSessaoMs).toISOString())}. Confira se o pregão foi remarcado.`;
}

/** As linhas do resumo que a tela mostra — em texto, testável. */
export function resumoDaCompra(compra: CompraDoComprasGov): { titulo: string; linhas: string[] } {
  const identificacao = [
    compra.modalidade || null,
    compra.srp ? 'SRP' : null,
    compra.modoDisputa ? `modo ${compra.modoDisputa}` : null,
    compra.criterio,
  ].filter(Boolean).join(' · ');
  const local = [compra.municipio, compra.uf].filter(Boolean).join('/');
  const orgao = compra.unidade || compra.orgao;
  const encerramento = dataHora(compra.encerramentoPropostas);
  const sigilosos = compra.itens.filter((i) => i.sigiloso).length;
  const linhas = [
    identificacao,
    orgao ? `${orgao}${local ? ` (${local})` : ''} · UASG ${compra.uasg}` : `UASG ${compra.uasg}`,
    compra.objeto ?? '',
    encerramento ? `Propostas até ${encerramento}` : '',
    `${compra.itens.length} ${compra.itens.length === 1 ? 'item' : 'itens'}${
      sigilosos === compra.itens.length && sigilosos > 0
        ? ' · orçamento sigiloso: o valor de cada item fica para a empresa preencher'
        : sigilosos > 0 ? ` · ${sigilosos} com orçamento sigiloso` : ''
    }`,
  ].filter(Boolean);
  return { titulo: `Compra ${compra.numero}/${compra.ano}`, linhas };
}
