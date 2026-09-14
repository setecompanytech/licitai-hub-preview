import type { ElementType } from 'react';
import {
  AlertTriangle, CalendarOff, CheckCircle2, Clock, FileX, HelpCircle,
} from 'lucide-react';
import type { TomSituacao } from '@/components/gestao/SeloSituacao';
import { VAGAS_PREVISTAS, type CategoriaPrevista } from '@/lib/documentos/previstos';
import {
  ROTULO_DO_DOCUMENTO, contaComoRegular, ehRegularMasVencendo, situacaoDoDocumento,
  DIAS_DE_ANTECEDENCIA, type SituacaoDocumento,
} from '@/lib/documentos/situacao';

/**
 * Uma LINHA DA TELA do cofre: a vaga prevista, mais o que houver de arquivo.
 *
 * O ponto central e a razão de este módulo existir: a lista da tela é a lista
 * das VAGAS, não a das linhas gravadas. A vaga sem arquivo tem de aparecer —
 * ela é a pendência —, e só uma tabela montada a partir de `VAGAS_PREVISTAS`
 * consegue mostrar o que NÃO foi enviado. Uma tabela montada a partir do
 * `select` mostraria um cofre vazio como uma tela vazia.
 */
export interface LinhaGravada {
  id: string;
  nome: string;
  validade: string | null;
  arquivo_path: string | null;
  empresa_id: string | null;
  user_id: string;
  tamanho_bytes: number | null;
  created_at: string | null;
  updated_at: string | null;
  descricao: string | null;
}

export interface ItemDoCofre {
  /** ⚠️ Nome da vaga — chave de casamento com `documentos.nome`. */
  nome: string;
  categoria: CategoriaPrevista;
  artigo: string;
  /** De `VAGAS_PREVISTAS.vence`. O banco não sabe disso; o domínio sabe. */
  vencePorNatureza: boolean;
  situacao: SituacaoDocumento;
  /** Id da linha no banco — é por ele que substituição e remoção acontecem. */
  dbId?: string;
  arquivoPath?: string;
  validade?: string;
  tamanhoBytes?: number;
  criadoEm?: string;
  atualizadoEm?: string;
  /**
   * `empresa_id` COMO ESTÁ GRAVADO. Guardado porque a substituição precisa
   * preservá-lo: gravar `empresaAtiva?.id ?? null` sem empresa ativa
   * DESCOMPARTILHAVA em silêncio uma linha que a equipe inteira via.
   */
  empresaIdGravado?: string | null;
  /** Linha anterior à conversão para empresa: só o dono vê, até compartilhar. */
  legadoPrivado?: boolean;
}

/**
 * Casa as vagas com as linhas gravadas e classifica cada uma.
 *
 * Duas regras herdadas da tela anterior, preservadas de propósito:
 *  - a linha DA EMPRESA vence a linha privada de mesmo nome;
 *  - a classificação sai de `situacaoDoDocumento`, a autoridade única — e não
 *    de uma comparação de datas escrita aqui. A tela tinha DOIS cálculos de
 *    "vencido" divergentes, e o segundo comparava meia-noite UTC com a hora
 *    corrente: às 9h em Belém, documento válido o dia todo aparecia vencido.
 */
export function montarItensDoCofre(
  linhas: LinhaGravada[],
  opcoes?: { hoje?: Date },
): ItemDoCofre[] {
  return VAGAS_PREVISTAS.map((vaga) => {
    const casada =
      linhas.find((l) => l.nome === vaga.nome && l.empresa_id) ??
      linhas.find((l) => l.nome === vaga.nome);

    const arquivoPath = casada?.arquivo_path ?? undefined;
    const validade = casada?.validade ?? undefined;

    return {
      nome: vaga.nome,
      categoria: vaga.categoria,
      artigo: vaga.artigo,
      vencePorNatureza: vaga.vence,
      situacao: situacaoDoDocumento(
        { arquivoPath, validade, vencePorNatureza: vaga.vence },
        opcoes,
      ),
      dbId: casada?.id,
      arquivoPath,
      validade,
      tamanhoBytes: casada?.tamanho_bytes ?? undefined,
      criadoEm: casada?.created_at ?? undefined,
      atualizadoEm: casada?.updated_at ?? undefined,
      empresaIdGravado: casada ? casada.empresa_id : undefined,
      legadoPrivado: casada ? !casada.empresa_id : undefined,
    } satisfies ItemDoCofre;
  });
}

/**
 * Nome do arquivo sem o caminho interno do armazenamento.
 *
 * O caminho gravado inclui a pasta (`empresa/<uuid>/…`) — 36 caracteres que
 * não dizem nada a quem confere documento e empurram o nome real para fora da
 * vista.
 */
export function nomeDoArquivo(caminho: string): string {
  return caminho.split('/').pop() || caminho;
}

/** Tamanho legível. `null`/0 não vira "0 B": vira ausência, que é o que é. */
export function tamanhoLegivel(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ───────────────────────────────────────────────────────────────────────────
   O VOCABULÁRIO DA TELA — tom, ícone, ordem e filtro de cada situação.

   Mora neste módulo, e não dentro de um componente, por dois motivos. O
   primeiro é técnico: constante exportada de arquivo `.tsx` quebra o recarregar
   rápido do Vite (`react-refresh/only-export-components`). O segundo é o que
   importa: três lugares consomem o MESMO par (tom, ícone) — a célula da tabela,
   o painel e a faixa de indicadores —, e foi com duas cópias divergentes que o
   app chegou a ter "Regular" verde no selo e âmbar na barra contando a mesma
   linha.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * A régua visual de cada situação.
 *
 * O comando exige texto + ícone + cor, nunca só cor — e cada situação recebe um
 * ÍCONE PRÓPRIO porque três delas dividem o âmbar ("Vencendo", "Vence hoje" e
 * "Ausente"): quem varre a tela pelo formato precisa distingui-las sem ler a
 * cor. O rótulo continua saindo de `ROTULO_DO_DOCUMENTO`, a autoridade única.
 *
 * `sem_validade` usa o tom `indisponivel` (cinza tracejado) de propósito: não é
 * um estado do documento, é a AUSÊNCIA de uma informação sobre ele — a mesma
 * distinção que `ValorIndisponivel` faz com números não apurados. Pintá-lo de
 * verde era exatamente o defeito que inflava a conformidade.
 */
export const APRESENTACAO_DA_SITUACAO: Record<
  SituacaoDocumento,
  { tom: TomSituacao; icone: ElementType; explicacao: string }
> = {
  ok: { tom: 'sucesso', icone: CheckCircle2, explicacao: 'Arquivo anexado e validade em dia.' },
  vencendo: {
    tom: 'atencao',
    icone: Clock,
    explicacao: `Ainda válido — vence dentro de ${DIAS_DE_ANTECEDENCIA} dias. Continua contando como regular.`,
  },
  vence_hoje: {
    tom: 'atencao',
    icone: AlertTriangle,
    explicacao: 'Último dia de validade. Vale hoje; amanhã, não.',
  },
  vencido: {
    tom: 'critico',
    icone: AlertTriangle,
    explicacao: 'Fora do prazo — impede a habilitação até ser renovado.',
  },
  ausente: {
    tom: 'atencao',
    icone: FileX,
    explicacao: 'A vaga existe no checklist e não há arquivo anexado.',
  },
  sem_validade: {
    tom: 'indisponivel',
    icone: HelpCircle,
    explicacao:
      'Há arquivo, o documento vence por natureza e ninguém informou até quando. Não conta como regular.',
  },
  nao_se_aplica: {
    tom: 'neutro',
    icone: CalendarOff,
    explicacao: 'Documento sem prazo por natureza (ato constitutivo, cadastro, declaração).',
  },
};

/**
 * Ordem de leitura da tabela: primeiro o que impede a empresa de disputar hoje,
 * por último o que não pede nada.
 *
 * Não reaproveita `ORDEM_DE_URGENCIA` de `situacao.ts` porque aquela cobre só
 * os quatro estados de PRAZO; aqui entram `ausente` e `sem_validade`, que não
 * são prazo.
 */
export const ORDEM_NA_TELA: Record<SituacaoDocumento, number> = {
  vencido: 0,
  vence_hoje: 1,
  ausente: 2,
  sem_validade: 3,
  vencendo: 4,
  ok: 5,
  nao_se_aplica: 6,
};

/**
 * O vocabulário de filtro da tela — o que os indicadores emitem ao serem
 * clicados e o que o select da barra de ferramentas oferece.
 *
 * `regulares` NÃO é uma situação: é o BALDE do indicador, que agrupa quatro
 * situações (`ok`, `vencendo`, `vence_hoje`, `nao_se_aplica`). Balde e situação
 * convivem no mesmo tipo de propósito — o filtro precisa conseguir dizer
 * "mostre o indicador que eu cliquei", e o indicador conta baldes.
 */
export type FiltroSituacao =
  | 'todas'
  | 'regulares'
  | 'vencendo'
  | 'vencido'
  | 'ausente'
  | 'sem_validade'
  | 'nao_se_aplica';

export const FILTROS_DE_SITUACAO: FiltroSituacao[] = [
  'todas', 'regulares', 'vencendo', 'vencido', 'ausente', 'sem_validade', 'nao_se_aplica',
];

export const ROTULO_DO_FILTRO: Record<FiltroSituacao, string> = {
  todas: 'Todas as situações',
  regulares: 'Regulares',
  vencendo: `Vencem em até ${DIAS_DE_ANTECEDENCIA} dias`,
  vencido: ROTULO_DO_DOCUMENTO.vencido,
  ausente: ROTULO_DO_DOCUMENTO.ausente,
  sem_validade: ROTULO_DO_DOCUMENTO.sem_validade,
  nao_se_aplica: ROTULO_DO_DOCUMENTO.nao_se_aplica,
};

/** A régua única do filtro — tabela e indicadores usam esta, e só esta. */
export function casaComFiltro(situacao: SituacaoDocumento, filtro: FiltroSituacao): boolean {
  if (filtro === 'todas') return true;
  if (filtro === 'regulares') return contaComoRegular(situacao);
  if (filtro === 'vencendo') return ehRegularMasVencendo(situacao);
  return situacao === filtro;
}

/**
 * Os quatro baldes do cofre, mais o subconjunto que o comando manda declarar.
 *
 * A propriedade que sustenta a faixa inteira, travada em
 * `situacao-documento.test.ts`: previstos = regulares + vencidos + ausentes +
 * sem validade, SEM interseção. `vencendo` é a exceção declarada — ele já está
 * DENTRO de `regulares` e não pode ser somado de novo em lugar nenhum.
 */
export interface ContagemDoCofre {
  previstos: number;
  regulares: number;
  /** Subconjunto de `regulares`. NUNCA somar ao total. */
  vencendo: number;
  vencidos: number;
  ausentes: number;
  semValidade: number;
}

export function contarCofre(situacoes: SituacaoDocumento[], previstos: number): ContagemDoCofre {
  return {
    previstos,
    regulares: situacoes.filter(contaComoRegular).length,
    vencendo: situacoes.filter(ehRegularMasVencendo).length,
    vencidos: situacoes.filter((s) => s === 'vencido').length,
    ausentes: situacoes.filter((s) => s === 'ausente').length,
    semValidade: situacoes.filter((s) => s === 'sem_validade').length,
  };
}
