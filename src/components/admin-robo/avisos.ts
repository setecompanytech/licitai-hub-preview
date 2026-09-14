/**
 * Avisos da operação aos clientes do Robô de Lances — as regras, sem tela.
 *
 * Mora num `.ts`, e não dentro do `GestorDeAvisos`, por dois motivos. O
 * prático: constante exportada de arquivo de componente desliga a atualização
 * instantânea daquele arquivo. O de fundo: a situação de um aviso ("vigente",
 * "agendado"…) é a MESMA regra que a policy "Clientes leem avisos vigentes" da
 * migration 20260914000004 aplica no banco. Escrita uma vez aqui, testável sem
 * renderizar nada, a tela de gestão não consegue dizer "vigente" de um aviso
 * que o cliente não está lendo.
 *
 * ─── Horário ────────────────────────────────────────────────────────────────
 *
 * Início e fim são digitados em horário de Brasília — o horário do pregão e o
 * de quem opera a plataforma. O `datetime-local` do navegador, porém, não
 * carrega fuso: lido com `new Date(valor)`, vira o fuso da MÁQUINA de quem
 * digitou, e um operador em viagem publicaria o aviso horas fora do combinado.
 * A conversão aqui fixa −03:00, que é o fuso de Brasília o ano inteiro desde
 * o fim do horário de verão (Decreto 9.772/2019).
 */
import { acharPortal } from '@/lib/robo/portais';

export type SeveridadeDoAviso = 'informativo' | 'atencao' | 'critico';
export type SituacaoDoAviso = 'vigente' | 'agendado' | 'encerrado' | 'inativo';

/** Linha de `robo_avisos_portal`. */
export interface AvisoDoPortal {
  id: string;
  /** Id do portal (vocabulário de `lib/robo/portais.ts`). Nulo = todos. */
  portal_id: string | null;
  severidade: SeveridadeDoAviso;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  inicio_em: string;
  fim_em: string | null;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const SEVERIDADES: readonly SeveridadeDoAviso[] = ['informativo', 'atencao', 'critico'];

export const ROTULO_DA_SEVERIDADE: Record<SeveridadeDoAviso, string> = {
  informativo: 'Informativo',
  atencao: 'Atenção',
  critico: 'Crítico',
};

export const ROTULO_DA_SITUACAO: Record<SituacaoDoAviso, string> = {
  vigente: 'Vigente',
  agendado: 'Agendado',
  encerrado: 'Encerrado',
  inativo: 'Inativo',
};

/**
 * Valor do seletor para "Todos os portais". O Select do Radix não aceita item
 * com valor vazio, e o banco guarda "todos" como nulo: este sentinela só vive
 * entre o seletor e `payloadDoAviso`, nunca chega ao banco.
 */
export const TODOS_OS_PORTAIS = '__todos__';

export function nomeDoPortalDoAviso(portalId: string | null | undefined): string {
  if (!portalId || portalId === TODOS_OS_PORTAIS) return 'Todos os portais';
  return acharPortal(portalId)?.nome ?? portalId;
}

/**
 * A situação do aviso diante do cliente.
 *
 * Espelho da policy do banco: o cliente lê quando
 * `ativo AND inicio_em <= now() AND (fim_em IS NULL OR fim_em > now())`.
 * Desligado vence o calendário — por isso `inativo` é conferido primeiro.
 */
export function situacaoDoAviso(
  aviso: Pick<AvisoDoPortal, 'ativo' | 'inicio_em' | 'fim_em'>,
  agora: Date = new Date(),
): SituacaoDoAviso {
  if (!aviso.ativo) return 'inativo';
  const t = agora.getTime();
  const inicio = Date.parse(aviso.inicio_em);
  if (Number.isFinite(inicio) && inicio > t) return 'agendado';
  if (aviso.fim_em) {
    const fim = Date.parse(aviso.fim_em);
    if (Number.isFinite(fim) && fim <= t) return 'encerrado';
  }
  return 'vigente';
}

const ORDEM_DA_SITUACAO: Record<SituacaoDoAviso, number> = {
  vigente: 0,
  agendado: 1,
  inativo: 2,
  encerrado: 3,
};

export interface AvisoComSituacao {
  aviso: AvisoDoPortal;
  situacao: SituacaoDoAviso;
}

/** O que o cliente lê agora vem primeiro; dentro de cada situação, o mais novo. */
export function ordenarAvisos(
  avisos: readonly AvisoDoPortal[],
  agora: Date = new Date(),
): AvisoComSituacao[] {
  return avisos
    .map((aviso) => ({ aviso, situacao: situacaoDoAviso(aviso, agora) }))
    .sort(
      (a, b) =>
        ORDEM_DA_SITUACAO[a.situacao] - ORDEM_DA_SITUACAO[b.situacao] ||
        (Date.parse(b.aviso.inicio_em) || 0) - (Date.parse(a.aviso.inicio_em) || 0),
    );
}

// ── Horário de Brasília ↔ instante ─────────────────────────────────────────

const DESLOCAMENTO_DE_BRASILIA_MS = 3 * 60 * 60 * 1000;
const CAMPO_DATA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Instante do banco → valor do `datetime-local`, em horário de Brasília. */
export function isoParaCampoDeBrasilia(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t - DESLOCAMENTO_DE_BRASILIA_MS).toISOString().slice(0, 16);
}

/** Valor do `datetime-local`, lido como horário de Brasília → instante ISO. */
export function campoDeBrasiliaParaIso(campo: string | null | undefined): string | null {
  const m = CAMPO_DATA_HORA.exec(String(campo ?? '').trim());
  if (!m) return null;
  const [, ano, mes, dia, hora, minuto, segundo = '00'] = m;
  const t =
    Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo)) +
    DESLOCAMENTO_DE_BRASILIA_MS;
  const iso = new Date(t).toISOString();
  // `Date.UTC` transforma 31/02 em 03/03 sem reclamar. Data que não existe no
  // calendário é recusada, não corrigida por conta própria.
  if (isoParaCampoDeBrasilia(iso) !== `${ano}-${mes}-${dia}T${hora}:${minuto}`) return null;
  return iso;
}

// ── Formulário ─────────────────────────────────────────────────────────────

/** O que o formulário edita. Datas no formato do `datetime-local`. */
export interface RascunhoDoAviso {
  /** Id do portal ou `TODOS_OS_PORTAIS`. */
  portal: string;
  severidade: SeveridadeDoAviso;
  titulo: string;
  mensagem: string;
  inicio: string;
  fim: string;
  ativo: boolean;
}

export function rascunhoNovo(agora: Date = new Date()): RascunhoDoAviso {
  return {
    portal: TODOS_OS_PORTAIS,
    // O mesmo padrão da coluna no banco.
    severidade: 'atencao',
    titulo: '',
    mensagem: '',
    inicio: isoParaCampoDeBrasilia(agora.toISOString()),
    fim: '',
    ativo: true,
  };
}

export function rascunhoDoAviso(aviso: AvisoDoPortal): RascunhoDoAviso {
  return {
    portal: aviso.portal_id ?? TODOS_OS_PORTAIS,
    severidade: aviso.severidade,
    titulo: aviso.titulo ?? '',
    mensagem: aviso.mensagem ?? '',
    inicio: isoParaCampoDeBrasilia(aviso.inicio_em),
    fim: isoParaCampoDeBrasilia(aviso.fim_em),
    ativo: aviso.ativo,
  };
}

export type CampoDoAviso = 'titulo' | 'mensagem' | 'inicio' | 'fim';
export type ErrosDoAviso = Partial<Record<CampoDoAviso, string>>;

/**
 * Título e mensagem obrigatórios; início válido; fim, quando houver, depois do
 * início. A última regra é o `CHECK (fim_em IS NULL OR fim_em > inicio_em)` da
 * tabela — conferida aqui para virar uma frase ao lado do campo, e não um
 * "violates check constraint" no toast.
 */
export function validarAviso(r: RascunhoDoAviso): ErrosDoAviso {
  const erros: ErrosDoAviso = {};
  if (!r.titulo.trim()) erros.titulo = 'Escreva o título do aviso.';
  if (!r.mensagem.trim()) erros.mensagem = 'Escreva a mensagem que o cliente vai ler.';
  const inicio = campoDeBrasiliaParaIso(r.inicio);
  if (!inicio) erros.inicio = 'Informe quando o aviso começa a valer.';
  if (r.fim.trim()) {
    const fim = campoDeBrasiliaParaIso(r.fim);
    if (!fim) erros.fim = 'Informe uma data de fim válida, ou deixe em branco.';
    else if (inicio && Date.parse(fim) <= Date.parse(inicio)) erros.fim = 'O fim precisa ser depois do início.';
  }
  return erros;
}

export interface PayloadDoAviso {
  portal_id: string | null;
  severidade: SeveridadeDoAviso;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  inicio_em: string;
  fim_em: string | null;
}

/**
 * A linha que vai ao banco. Só chame depois de `validarAviso` sem erros.
 *
 * `criado_por` não vai: o banco preenche com `auth.uid()`. Quem assina o
 * aviso não é decisão do navegador.
 */
export function payloadDoAviso(r: RascunhoDoAviso): PayloadDoAviso {
  return {
    portal_id: !r.portal || r.portal === TODOS_OS_PORTAIS ? null : r.portal,
    severidade: r.severidade,
    titulo: r.titulo.trim(),
    mensagem: r.mensagem.trim(),
    ativo: r.ativo,
    inicio_em: campoDeBrasiliaParaIso(r.inicio) as string,
    fim_em: r.fim.trim() ? campoDeBrasiliaParaIso(r.fim) : null,
  };
}
