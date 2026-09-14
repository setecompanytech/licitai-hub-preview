/**
 * Regras de exibição do painel de participações — o que é puro e testável
 * sem montar a tela: rótulos derivados, datas no fuso de Brasília e filtros.
 *
 * Nada aqui decide FASE nem ESTADO DO ROBÔ: isso é de
 * `lib/robo/situacao-da-participacao.ts`, e a tela só lê a projeção. Repetir a
 * regra aqui foi exatamente como painel e pasta passaram a discordar.
 */
import type { ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import type { AbaDoPainel, EstadoDoRobo } from '@/lib/robo/situacao-da-participacao';
import type { TomSituacao } from '@/components/gestao/SeloSituacao';

export const ABAS_DO_PAINEL: AbaDoPainel[] = ['cadastradas', 'configuradas', 'em_disputa', 'encerradas'];

/**
 * A aba padrão é FIXA em "Em disputa".
 *
 * Escolher a aba pelo conteúdo ("em disputa se houver alguma") faria a tela
 * nascer numa aba e pular para outra quando os dados chegam — e a URL limpa
 * passaria a significar coisas diferentes a cada leitura. "Em disputa" é a
 * pergunta que justifica abrir o robô; quando está vazia, o estado vazio aponta
 * a aba que tem registros.
 */
export const ABA_PADRAO: AbaDoPainel = 'em_disputa';

export function abaValida(valor: string | null | undefined): AbaDoPainel {
  return (ABAS_DO_PAINEL as string[]).includes(String(valor)) ? (valor as AbaDoPainel) : ABA_PADRAO;
}

export const TOM_DO_ESTADO_DO_ROBO: Record<EstadoDoRobo, TomSituacao> = {
  sem_sessao: 'neutro',
  simulacao: 'neutro',
  enviando: 'atencao',
  operando: 'ativo',
  sinal_desatualizado: 'atencao',
  parada_solicitada: 'atencao',
  parado: 'neutro',
  erro: 'critico',
  desconhecido: 'indisponivel',
};

// ── Preparação da estratégia ───────────────────────────────────────────────

export type PreparacaoDaEstrategia = 'configurada' | 'rascunho' | 'pendente';

export const ROTULO_DA_PREPARACAO: Record<PreparacaoDaEstrategia, string> = {
  configurada: 'Configurada',
  // Curto de propósito: selo não quebra linha, e o rótulo longo fazia a coluna
  // medir 272 px. "Sem versão aprovada" vai na explicação do selo.
  rascunho: 'Rascunho',
  pendente: 'Pendente',
};

/**
 * "Configurada" usa o MESMO critério que leva a participação à aba
 * Configuradas (portal, preço inicial, limite em todos os itens e versão
 * aprovada). Parâmetros preenchidos sem versão aprovada são rascunho: a
 * estratégia existe, mas ninguém a aprovou na Precificação.
 */
export function preparacaoDaEstrategia(p: ParticipacaoCarregada): PreparacaoDaEstrategia {
  const d = p.disputa;
  const temPortal = !!String(d.portal ?? '').trim();
  const temPrecoInicial = Number(d.valor_inicial) > 0;
  const aprovada = !!d.precificacao_versao_id;

  if (temPortal && temPrecoInicial && p.projecao.itensSemLimite === 0 && aprovada) return 'configurada';

  const temParametros =
    temPrecoInicial || Number(d.valor_minimo) > 0 || (Array.isArray(d.itens) && d.itens.length > 0);
  if (temParametros && !aprovada) return 'rascunho';
  return 'pendente';
}

// ── Datas em Brasília ──────────────────────────────────────────────────────

const FUSO = 'America/Sao_Paulo';
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

const HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const DIA_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

export function horaEmBrasilia(data: Date): string {
  return HORA.format(data);
}

/**
 * Abertura como a pessoa lê no edital. Coluna só com data (`2026-09-20`) NÃO
 * passa por `new Date`: o JavaScript a lê como meia-noite UTC, e em Brasília
 * ela viraria o dia anterior às 21h.
 */
export function aberturaEmBrasilia(valor: string): { texto: string; temHorario: boolean } | null {
  if (SO_DATA.test(valor)) {
    const [a, m, d] = valor.split('-');
    return { texto: `${d}/${m}/${a}`, temHorario: false };
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return { texto: DATA_HORA.format(data).replace(',', ''), temHorario: true };
}

/** Dia (AAAA-MM-DD) da abertura no fuso de Brasília — base do filtro de período. */
export function diaDaAbertura(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (SO_DATA.test(valor)) return valor;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : DIA_ISO.format(data);
}

// ── Filtros ────────────────────────────────────────────────────────────────

export const TODOS = '__todos__';
export const SEM_PORTAL = '__sem_portal__';

export interface FiltrosDoPainel {
  busca: string;
  portal: string;
  responsavel: 'todos' | 'meus';
  de: string;
  ate: string;
  soComPendencia: boolean;
  modo: 'todos' | 'automatico' | 'manual';
}

export const FILTROS_VAZIOS: Omit<FiltrosDoPainel, 'busca'> = {
  portal: TODOS,
  responsavel: 'todos',
  de: '',
  ate: '',
  soComPendencia: false,
  modo: 'todos',
};

const normalizar = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function portaisDasParticipacoes(lista: ParticipacaoCarregada[]): { valores: string[]; algumSemPortal: boolean } {
  const valores = new Set<string>();
  let algumSemPortal = false;
  lista.forEach((p) => {
    const portal = String(p.disputa.portal ?? '').trim();
    if (portal) valores.add(portal);
    else algumSemPortal = true;
  });
  return { valores: [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR')), algumSemPortal };
}

export function contarFiltrosAplicados(f: FiltrosDoPainel): number {
  return [
    f.busca.trim() !== '',
    f.portal !== TODOS,
    f.responsavel !== 'todos',
    f.de !== '' || f.ate !== '',
    f.soComPendencia,
    f.modo !== 'todos',
  ].filter(Boolean).length;
}

/** Quantos dos filtros recolhidos ("Mais filtros") estão aplicados. */
export function contarFiltrosExtras(f: FiltrosDoPainel): number {
  return [f.de !== '' || f.ate !== '', f.modo !== 'todos'].filter(Boolean).length;
}

export function filtrarParticipacoes(
  lista: ParticipacaoCarregada[],
  f: FiltrosDoPainel,
  usuarioId: string | null,
): ParticipacaoCarregada[] {
  const termo = normalizar(f.busca.trim());
  return lista.filter((p) => {
    if (termo) {
      const alvo = [p.processo?.numero, p.processo?.objeto, p.disputa.edital].map(normalizar).join(' ');
      if (!alvo.includes(termo)) return false;
    }
    if (f.portal !== TODOS) {
      const portal = String(p.disputa.portal ?? '').trim();
      if (f.portal === SEM_PORTAL ? portal !== '' : portal !== f.portal) return false;
    }
    // "Somente os meus" é o operador do PROCESSO. Participação sem processo
    // vinculado não tem responsável registrado — sai do filtro, não entra por
    // suposição.
    if (f.responsavel === 'meus' && (!usuarioId || p.processo?.operador_id !== usuarioId)) return false;
    if (f.de || f.ate) {
      const dia = diaDaAbertura(p.processo?.data_abertura);
      if (!dia) return false;
      if (f.de && dia < f.de) return false;
      if (f.ate && dia > f.ate) return false;
    }
    if (f.soComPendencia && !p.projecao.pendenciaPrincipal) return false;
    if (f.modo === 'automatico' && p.disputa.modo_automatico !== true) return false;
    if (f.modo === 'manual' && p.disputa.modo_automatico !== false) return false;
    return true;
  });
}

export function contarPorAba(lista: ParticipacaoCarregada[]): Record<AbaDoPainel, number> {
  const contagem: Record<AbaDoPainel, number> = { cadastradas: 0, configuradas: 0, em_disputa: 0, encerradas: 0 };
  lista.forEach((p) => {
    contagem[p.projecao.aba] += 1;
  });
  return contagem;
}
