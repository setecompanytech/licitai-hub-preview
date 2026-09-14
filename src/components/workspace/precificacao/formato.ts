/**
 * Formatação e leitura de números da aprovação de precificação.
 *
 * Nada aqui CALCULA preço — isso é de `src/lib/precificacao/versao.ts`, que
 * arredonda ao centavo uma única vez. Este arquivo só traduz: centavo inteiro
 * para "R$ 1.234,56", percentual 0–100 para "15,00%", e o que a pessoa digita
 * ("12,5", "1.234,56", "R$ 0,0035") de volta para número.
 *
 * Percentual segue a convenção de alíquota do CLAUDE.md (0–100): `15` é 15%.
 * O nome do formatador declara isso — dois `formatPercent` com semânticas
 * opostas já foram o vetor de um erro de 100× neste repo.
 */
import { interpretarValorColado } from '@/lib/financeiro/valor-colado';
import type { CriterioDeDisputa, FonteDaPremissa } from '@/lib/precificacao/versao';
import type { CamadasPreco } from '@/lib/precificacao/formacao-preco';
import type { TomSituacao } from '@/components/gestao/SeloSituacao';

/** Centavos inteiros → "R$ 1.234,56". Nulo vira travessão, nunca "R$ 0,00". */
export function formatarCentavos(centavos: number | null | undefined): string {
  if (centavos == null || !Number.isFinite(Number(centavos))) return '—';
  return (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Reais com até quatro casas — custo unitário pode ser R$ 0,0035 por grama,
 * e mostrar "R$ 0,00" ali seria esconder o custo.
 */
export function formatarReais(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/** Percentual na convenção 0–100 (`15` → "15,00%"). */
export function formatPercentual(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  return `${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

/** Número para dentro de um campo de texto, com vírgula decimal e sem milhar. */
export function numeroParaCampo(valor: number | null | undefined, casas = 4): string {
  if (valor == null || !Number.isFinite(Number(valor))) return '';
  return Number(Number(valor).toFixed(casas)).toString().replace('.', ',');
}

export interface LeituraDeNumero {
  /** Campo em branco — "não informado", que é diferente de zero. */
  vazio: boolean;
  valor: number | null;
  erro: string | null;
}

/**
 * Lê o que foi digitado. Aceita vírgula decimal ("12,5"), milhar pt-BR
 * ("1.234,56"), prefixo "R$" e sufixo "%". Reaproveita o intérprete de valor
 * colado do Financeiro, que já resolve pt-BR × en-US pela posição do separador.
 */
export function lerNumero(
  texto: string,
  { minimo = 0, maximo }: { minimo?: number; maximo?: number } = {},
): LeituraDeNumero {
  const limpo = (texto ?? '').trim();
  if (!limpo) return { vazio: true, valor: null, erro: null };
  if (/[^\d.,\sR$%-]/i.test(limpo)) {
    return { vazio: false, valor: null, erro: 'Use apenas números, com vírgula para os centavos.' };
  }
  // "0.035" colado de planilha é custo por grama, não 35: o intérprete lê
  // ponto seguido de três dígitos como milhar, e com zero à esquerda essa
  // leitura nunca é a pretendida — erro de 1000× num custo.
  const zeroComPonto = /^-?0\.\d+$/.test(limpo.replace(/[R$%\s]/gi, ''));
  const valor = zeroComPonto ? Number(limpo.replace(/[R$%\s]/gi, '')) : interpretarValorColado(limpo);
  if (valor == null) return { vazio: false, valor: null, erro: 'Número inválido.' };
  if (valor < minimo) return { vazio: false, valor: null, erro: `O valor não pode ser menor que ${minimo}.` };
  if (maximo != null && valor > maximo) {
    return { vazio: false, valor: null, erro: `O valor não pode passar de ${maximo}.` };
  }
  return { vazio: false, valor, erro: null };
}

/** Data e hora no fuso do órgão — o horário que vale para o pregão. */
export function dataHoraDeBrasilia(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2026-08-31" → "31/08/2026", sem passar por fuso (é data, não instante). */
export function dataCurta(data: string | null | undefined): string {
  if (!data) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

// ── Vocabulário da tela ─────────────────────────────────────────────────────

/** Texto único para tabela/função de 14/09 ausente — o mesmo em toda tela. */
export const MENSAGEM_DE_MIGRACAO_PENDENTE =
  'Migração pendente — peça ao administrador para aplicar a atualização do banco';

/**
 * Espelho dos rótulos das camadas em `versao.ts` (que não os exporta). A
 * memória de cálculo usa o rótulo como identidade da linha; é por ele que a
 * tela sabe dizer "configuração pendente" em vez de exibir um 0% que ninguém
 * informou.
 */
export const ROTULO_DA_CAMADA: Record<keyof CamadasPreco, string> = {
  pctImpostos: 'Tributos sobre a venda',
  pctDespesasAdmin: 'Despesas administrativas',
  pctDespesasOperacionais: 'Despesas operacionais',
  pctMargem: 'Margem sobre a venda',
};

export const ORDEM_DAS_CAMADAS: Array<keyof CamadasPreco> = [
  'pctImpostos',
  'pctDespesasAdmin',
  'pctDespesasOperacionais',
  'pctMargem',
];

export const ROTULO_DA_FONTE: Record<FonteDaPremissa, string> = {
  indicadores_financeiro: 'Indicadores do Financeiro',
  configuracao_tributaria: 'Configuração tributária',
  informado_pelo_usuario: 'Informado nesta revisão',
  nao_configurado: 'Não configurado',
};

export const ROTULO_DO_CRITERIO: Record<CriterioDeDisputa, string> = {
  menor_preco_item: 'Menor preço por item',
  menor_preco_lote: 'Menor preço por lote',
  maior_desconto: 'Maior desconto',
  outro: 'Outro',
  nao_informado: 'Não informado',
};

export type SituacaoDaVersao = 'rascunho' | 'submetida' | 'aprovada' | 'substituida' | 'descartada';

export const SITUACAO_DA_VERSAO: Record<SituacaoDaVersao, { rotulo: string; tom: TomSituacao }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutro' },
  submetida: { rotulo: 'Aguardando aprovação', tom: 'atencao' },
  aprovada: { rotulo: 'Aprovada', tom: 'sucesso' },
  substituida: { rotulo: 'Substituída', tom: 'indisponivel' },
  descartada: { rotulo: 'Descartada', tom: 'indisponivel' },
};
