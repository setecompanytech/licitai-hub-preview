/**
 * A versão da precificação — o cálculo que vira limite do robô.
 *
 * `formacao-preco.ts` responde "qual o preço para esta margem". Este arquivo
 * responde a pergunta seguinte, a que a aprovação precisa: "estes números
 * podem ser AUTORIZADOS?". Três obrigações que a tela sozinha não garantia:
 *
 *  1. DETERMINISMO. O mesmo item com as mesmas premissas dá o mesmo centavo,
 *     sempre. Todo valor de preço é arredondado UMA vez, aqui, para centavos
 *     inteiros (meio para cima), e é o inteiro que se grava. Arredondar de novo
 *     em cada tela é como R$ 178,57 vira R$ 178,58 no PDF.
 *
 *  2. MEMÓRIA DE CÁLCULO. Cada item leva as linhas que o produziram — custo,
 *     despesas do item, camadas percentuais, divisor, preço — para que quem
 *     aprova confira o caminho, não só o resultado.
 *
 *  3. PENDÊNCIA DECLARADA, NUNCA PREENCHIDA. Política financeira não
 *     configurada bloqueia a aprovação; o código não inventa percentual.
 *     Frete lançado em reais no item E como despesa operacional percentual é
 *     frete contado duas vezes — bloqueia também.
 *
 * Margem é SOBRE A VENDA (método do divisor). O acréscimo sobre o custo
 * aparece na memória só para conferência, com o nome certo: são números
 * diferentes, e confundi-los foi o erro do multiplicador (ver formacao-preco).
 */
import {
  formarPreco,
  lucroNoPreco,
  exigeDemonstracaoDeExequibilidade,
  PrecoImpossivelError,
  type CamadasPreco,
} from './formacao-preco';

// ── Dinheiro ────────────────────────────────────────────────────────────────

/**
 * Reais → centavos inteiros, meio para cima.
 *
 * `Math.round(1.005 * 100)` dá 100, não 101: `1.005 * 100` é
 * `100.49999999999999` em ponto flutuante. O `toFixed(6)` descarta o ruído
 * abaixo de um milionésimo de centavo antes de arredondar — nenhum preço
 * real tem essa precisão, e o ruído deixa de decidir o centavo.
 */
export function paraCentavos(valor: number): number {
  const v = Number(valor);
  if (!Number.isFinite(v)) throw new RangeError(`Valor monetário inválido: ${valor}`);
  const escalado = Number((Math.abs(v) * 100).toFixed(6));
  return v < 0 ? -Math.round(escalado) : Math.round(escalado);
}

/** Centavos × quantidade (que pode ser fracionária), com o mesmo arredondamento. */
export function multiplicarCentavos(centavos: number, quantidade: number): number {
  const produto = Number((centavos * quantidade).toFixed(6));
  return produto < 0 ? -Math.round(-produto) : Math.round(produto);
}

function brl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Custo unitário pode ter mais de duas casas (R$ 0,0035 por grama). */
function quatroCasas(v: number): number {
  return Number(Number(v).toFixed(4));
}

// ── Premissas ───────────────────────────────────────────────────────────────

export type FonteDaPremissa =
  | 'indicadores_financeiro'
  | 'configuracao_tributaria'
  | 'informado_pelo_usuario'
  | 'nao_configurado';

export interface OrigemDaPremissa {
  fonte: FonteDaPremissa;
  /** Id ou descrição do registro de origem (ex.: indicador adotado nº 12). */
  referencia?: string | null;
  /** Período considerado (ex.: "09/2025 a 08/2026"). */
  periodo?: string | null;
}

export type CriterioDeDisputa =
  | 'menor_preco_item'
  | 'menor_preco_lote'
  | 'maior_desconto'
  | 'outro'
  | 'nao_informado';

export interface PremissasDaVersao {
  camadas: CamadasPreco;
  origem: Record<keyof CamadasPreco, OrigemDaPremissa>;
  criterio: CriterioDeDisputa;
}

const NOME_DA_CAMADA: Record<keyof CamadasPreco, string> = {
  pctImpostos: 'Tributos sobre a venda',
  pctDespesasAdmin: 'Despesas administrativas',
  pctDespesasOperacionais: 'Despesas operacionais',
  pctMargem: 'Margem sobre a venda',
};

// ── Itens ───────────────────────────────────────────────────────────────────

export interface ItemDePrecificacao {
  /** Id estável em `licitacao_itens`. Nulo só para item ainda não gravado. */
  licitacaoItemId: string | null;
  numero: number;
  lote: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number | null;
  freteUnitario?: number | null;
  seguroUnitario?: number | null;
  outrasDespesasUnitario?: number | null;
  valorEstimadoOrgao?: number | null;
  marca?: string | null;
  fabricante?: string | null;
  modelo?: string | null;
  fornecedor?: string | null;
  cotacaoReferencia?: string | null;
  cotacaoData?: string | null;
  cotacaoValidade?: string | null;
  /** Preço inicial escolhido. Ausente → usa o sugerido. */
  precoInicial?: number | null;
  /** Limite autorizado para o robô, em reais por unidade. */
  limite?: number | null;
  /** Item fora da disputa desta versão. Padrão: autorizado. */
  autorizado?: boolean;
}

export type Gravidade = 'bloqueia' | 'aviso';

export interface Pendencia {
  codigo: string;
  mensagem: string;
  gravidade: Gravidade;
  numero?: number;
  lote?: string | null;
}

export interface LinhaDaMemoria {
  rotulo: string;
  /** Exatamente um dos dois. */
  centavos?: number;
  percentual?: number;
  /** Como a linha foi obtida, em palavras. */
  formula?: string;
}

export interface ItemCalculado {
  item: ItemDePrecificacao;
  chave: string;
  autorizado: boolean;
  custoBase: number | null;
  precoSugeridoCentavos: number | null;
  precoInicialCentavos: number | null;
  limiteCentavos: number | null;
  totalInicialCentavos: number | null;
  /** Conferência: quanto o preço inicial está acima do custo, em %. NÃO é margem. */
  acrescimoSobreCustoPct: number | null;
  memoria: LinhaDaMemoria[];
  pendencias: Pendencia[];
}

export interface LoteCalculado {
  lote: string;
  numeros: number[];
  totalInicialCentavos: number | null;
  limiteTotalCentavos: number | null;
}

export interface VersaoCalculada {
  itens: ItemCalculado[];
  lotes: LoteCalculado[];
  totalInicialCentavos: number;
  pendencias: Pendencia[];
  podeAprovar: boolean;
}

/**
 * Chave de comparação entre versões. Id estável primeiro; na falta dele,
 * lote + número. NUNCA descrição nem posição na lista: reordenar itens ou
 * corrigir uma vírgula na descrição não pode parecer troca de item.
 */
export function chaveDoItem(i: Pick<ItemDePrecificacao, 'licitacaoItemId' | 'numero' | 'lote'>): string {
  return i.licitacaoItemId ?? `lote:${i.lote ?? '—'}#item:${i.numero}`;
}

function positivo(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function calcularItem(item: ItemDePrecificacao, premissas: PremissasDaVersao): ItemCalculado {
  const pendencias: Pendencia[] = [];
  const memoria: LinhaDaMemoria[] = [];
  const onde = { numero: item.numero, lote: item.lote };
  const autorizado = item.autorizado !== false;
  const { camadas } = premissas;

  const custo = positivo(item.custoUnitario);
  const frete = positivo(item.freteUnitario);
  const seguro = positivo(item.seguroUnitario);
  const outras = positivo(item.outrasDespesasUnitario);

  if (custo <= 0) {
    pendencias.push({ ...onde, codigo: 'custo_ausente', gravidade: 'bloqueia', mensagem: 'Custo de aquisição não informado.' });
  }
  if (frete > 0 && positivo(camadas.pctDespesasOperacionais) > 0) {
    pendencias.push({
      ...onde,
      codigo: 'frete_em_duplicidade',
      gravidade: 'bloqueia',
      mensagem:
        'Frete lançado no item e também como despesa operacional percentual — seria contado duas vezes. ' +
        'Mantenha um dos dois.',
    });
  }

  const custoBase = custo > 0 ? quatroCasas(custo + frete + seguro + outras) : null;
  let precoSugeridoCentavos: number | null = null;

  if (custoBase != null) {
    memoria.push({ rotulo: 'Custo de aquisição', centavos: paraCentavos(custo) });
    if (frete > 0) memoria.push({ rotulo: 'Frete unitário', centavos: paraCentavos(frete) });
    if (seguro > 0) memoria.push({ rotulo: 'Seguro unitário', centavos: paraCentavos(seguro) });
    if (outras > 0) memoria.push({ rotulo: 'Outras despesas unitárias', centavos: paraCentavos(outras) });
    memoria.push({
      rotulo: 'Total antes das despesas sobre venda',
      centavos: paraCentavos(custoBase),
      formula: 'custo + frete + seguro + outras despesas do item',
    });
    (Object.keys(NOME_DA_CAMADA) as Array<keyof CamadasPreco>).forEach((k) => {
      memoria.push({ rotulo: NOME_DA_CAMADA[k], percentual: Number(camadas[k]) || 0 });
    });

    try {
      const formado = formarPreco(custoBase, item.quantidade, camadas);
      precoSugeridoCentavos = paraCentavos(formado.precoUnitario);
      memoria.push({
        rotulo: 'Divisor',
        percentual: Number((formado.divisor * 100).toFixed(4)),
        formula: '100% − (tributos + despesas + margem)',
      });
      memoria.push({
        rotulo: 'Preço sugerido',
        centavos: precoSugeridoCentavos,
        formula: 'total antes das despesas ÷ divisor, arredondado ao centavo (meio para cima)',
      });
    } catch (e) {
      if (!(e instanceof PrecoImpossivelError)) throw e;
      pendencias.push({ ...onde, codigo: 'preco_impossivel', gravidade: 'bloqueia', mensagem: e.message });
    }
  }

  const precoInicialCentavos =
    item.precoInicial != null && Number(item.precoInicial) > 0
      ? paraCentavos(item.precoInicial)
      : precoSugeridoCentavos;
  const limiteCentavos = item.limite != null && item.limite !== ('' as unknown) ? paraCentavos(item.limite) : null;

  if (precoInicialCentavos != null) {
    memoria.push({
      rotulo: 'Preço inicial da proposta',
      centavos: precoInicialCentavos,
      formula: item.precoInicial != null && Number(item.precoInicial) > 0 ? 'definido na revisão' : 'igual ao sugerido',
    });
  }
  if (limiteCentavos != null) {
    memoria.push({ rotulo: 'Limite autorizado para o robô', centavos: limiteCentavos });
  }

  if (autorizado) {
    if (precoInicialCentavos == null) {
      pendencias.push({ ...onde, codigo: 'preco_inicial_ausente', gravidade: 'bloqueia', mensagem: 'Preço inicial não definido.' });
    }
    if (limiteCentavos == null) {
      pendencias.push({ ...onde, codigo: 'limite_ausente', gravidade: 'bloqueia', mensagem: 'Limite autorizado não definido.' });
    } else if (limiteCentavos <= 0) {
      pendencias.push({ ...onde, codigo: 'limite_invalido', gravidade: 'bloqueia', mensagem: 'Limite precisa ser maior que zero.' });
    } else if (precoInicialCentavos != null && limiteCentavos > precoInicialCentavos) {
      pendencias.push({
        ...onde,
        codigo: 'limite_acima_do_inicial',
        gravidade: 'bloqueia',
        mensagem: `Limite (${brl(limiteCentavos)}) acima do preço inicial (${brl(precoInicialCentavos)}).`,
      });
    }

    if (limiteCentavos != null && limiteCentavos > 0 && custoBase != null) {
      const noLimite = lucroNoPreco(limiteCentavos / 100, custoBase, {
        pctImpostos: camadas.pctImpostos,
        pctDespesasAdmin: camadas.pctDespesasAdmin,
        pctDespesasOperacionais: camadas.pctDespesasOperacionais,
      });
      if (!noLimite.viavel) {
        pendencias.push({
          ...onde,
          codigo: 'limite_abaixo_do_equilibrio',
          gravidade: 'aviso',
          mensagem: `No limite, prejuízo de ${brl(paraCentavos(-noLimite.lucroUnitario))} por unidade.`,
        });
      }
    }

    const estimado = positivo(item.valorEstimadoOrgao);
    if (estimado > 0 && precoInicialCentavos != null && precoInicialCentavos > paraCentavos(estimado)) {
      pendencias.push({
        ...onde,
        codigo: 'acima_do_estimado',
        gravidade: 'aviso',
        mensagem: `Preço inicial acima do valor estimado pelo órgão (${brl(paraCentavos(estimado))}).`,
      });
    }
    if (estimado > 0 && limiteCentavos != null && limiteCentavos > 0) {
      const exequibilidade = exigeDemonstracaoDeExequibilidade(limiteCentavos / 100, estimado);
      if (exequibilidade.exige) {
        pendencias.push({
          ...onde,
          codigo: 'exequibilidade',
          gravidade: 'aviso',
          mensagem:
            `Limite em ${exequibilidade.percentualDoEstimado.toFixed(1).replace('.', ',')}% do estimado — ` +
            'pode exigir demonstração de exequibilidade, conforme o edital.',
        });
      }
    }
  }

  const acrescimoSobreCustoPct =
    precoInicialCentavos != null && custoBase != null && custoBase > 0
      ? Number((((precoInicialCentavos / 100) / custoBase - 1) * 100).toFixed(2))
      : null;
  if (acrescimoSobreCustoPct != null) {
    memoria.push({
      rotulo: 'Acréscimo sobre o custo (conferência)',
      percentual: acrescimoSobreCustoPct,
      formula: 'não é margem: margem incide sobre a venda',
    });
  }

  return {
    item,
    chave: chaveDoItem(item),
    autorizado,
    custoBase,
    precoSugeridoCentavos,
    precoInicialCentavos,
    limiteCentavos,
    totalInicialCentavos:
      precoInicialCentavos != null ? multiplicarCentavos(precoInicialCentavos, Number(item.quantidade) || 0) : null,
    acrescimoSobreCustoPct,
    memoria,
    pendencias,
  };
}

/**
 * Calcula a versão inteira: itens, lotes e as pendências que decidem se ela
 * pode ser aprovada. Função pura — sem banco, sem relógio, sem aleatoriedade.
 */
export function calcularVersao(itens: ItemDePrecificacao[], premissas: PremissasDaVersao): VersaoCalculada {
  const pendencias: Pendencia[] = [];

  (Object.keys(NOME_DA_CAMADA) as Array<keyof CamadasPreco>).forEach((k) => {
    if (premissas.origem?.[k]?.fonte === 'nao_configurado' || !premissas.origem?.[k]) {
      pendencias.push({
        codigo: 'politica_pendente',
        gravidade: 'bloqueia',
        mensagem: `${NOME_DA_CAMADA[k]}: configuração pendente. Informe a origem antes de aprovar.`,
      });
    }
  });

  switch (premissas.criterio) {
    case 'nao_informado':
      pendencias.push({
        codigo: 'criterio_nao_informado',
        gravidade: 'bloqueia',
        mensagem: 'Critério de disputa não informado — ele decide se o limite é por item ou por lote.',
      });
      break;
    case 'maior_desconto':
      pendencias.push({
        codigo: 'criterio_nao_suportado',
        gravidade: 'bloqueia',
        mensagem: 'Disputa por maior desconto: o limite se expressa em percentual de desconto, ainda não suportado.',
      });
      break;
    case 'outro':
      pendencias.push({
        codigo: 'criterio_nao_suportado',
        gravidade: 'bloqueia',
        mensagem: 'Critério de disputa sem regra de limite definida nesta versão.',
      });
      break;
    default:
      break;
  }

  const calculados = itens.map((i) => calcularItem(i, premissas));
  calculados.forEach((c) => pendencias.push(...c.pendencias));

  if (!calculados.some((c) => c.autorizado)) {
    pendencias.push({ codigo: 'nenhum_item_autorizado', gravidade: 'bloqueia', mensagem: 'Nenhum item autorizado nesta versão.' });
  }

  // Lotes: na disputa por lote o lance é o TOTAL do lote. O limite do lote é
  // a soma dos limites × quantidades, e só existe se todo item autorizado do
  // lote tiver limite — lote com buraco não tem limite, tem pendência.
  const porLote = new Map<string, ItemCalculado[]>();
  calculados
    .filter((c) => c.autorizado)
    .forEach((c) => {
      const nome = c.item.lote ?? 'Único';
      porLote.set(nome, [...(porLote.get(nome) ?? []), c]);
    });

  const lotes: LoteCalculado[] = [...porLote.entries()].map(([lote, doLote]) => {
    const completo = doLote.every((c) => c.limiteCentavos != null && c.limiteCentavos > 0);
    const totalCompleto = doLote.every((c) => c.totalInicialCentavos != null);
    return {
      lote,
      numeros: doLote.map((c) => c.item.numero),
      totalInicialCentavos: totalCompleto ? doLote.reduce((s, c) => s + (c.totalInicialCentavos ?? 0), 0) : null,
      limiteTotalCentavos: completo
        ? doLote.reduce((s, c) => s + multiplicarCentavos(c.limiteCentavos ?? 0, Number(c.item.quantidade) || 0), 0)
        : null,
    };
  });

  const totalInicialCentavos = calculados
    .filter((c) => c.autorizado)
    .reduce((s, c) => s + (c.totalInicialCentavos ?? 0), 0);

  return {
    itens: calculados,
    lotes,
    totalInicialCentavos,
    pendencias,
    podeAprovar: !pendencias.some((p) => p.gravidade === 'bloqueia'),
  };
}

// ── Diferenças entre versões ────────────────────────────────────────────────

export type CampoComparado = 'incluido' | 'removido' | 'autorizado' | 'custo' | 'preco_inicial' | 'limite';

export interface Diferenca {
  chave: string;
  numero: number;
  lote: string | null;
  campo: CampoComparado;
  de: number | boolean | null;
  para: number | boolean | null;
}

/**
 * O que muda de uma versão para outra — o que a pessoa precisa ver antes de
 * autorizar a troca de limites. Comparação por `chaveDoItem`.
 */
export function diferencasEntreVersoes(anterior: ItemCalculado[], atual: ItemCalculado[]): Diferenca[] {
  const antes = new Map(anterior.map((c) => [c.chave, c]));
  const depois = new Map(atual.map((c) => [c.chave, c]));
  const saida: Diferenca[] = [];

  depois.forEach((novo, chave) => {
    const onde = { chave, numero: novo.item.numero, lote: novo.item.lote };
    const velho = antes.get(chave);
    if (!velho) {
      saida.push({ ...onde, campo: 'incluido', de: null, para: novo.limiteCentavos });
      return;
    }
    if (velho.autorizado !== novo.autorizado) {
      saida.push({ ...onde, campo: 'autorizado', de: velho.autorizado, para: novo.autorizado });
    }
    if ((velho.custoBase ?? null) !== (novo.custoBase ?? null)) {
      saida.push({ ...onde, campo: 'custo', de: velho.custoBase, para: novo.custoBase });
    }
    if (velho.precoInicialCentavos !== novo.precoInicialCentavos) {
      saida.push({ ...onde, campo: 'preco_inicial', de: velho.precoInicialCentavos, para: novo.precoInicialCentavos });
    }
    if (velho.limiteCentavos !== novo.limiteCentavos) {
      saida.push({ ...onde, campo: 'limite', de: velho.limiteCentavos, para: novo.limiteCentavos });
    }
  });

  antes.forEach((velho, chave) => {
    if (!depois.has(chave)) {
      saida.push({ chave, numero: velho.item.numero, lote: velho.item.lote, campo: 'removido', de: velho.limiteCentavos, para: null });
    }
  });

  return saida.sort((a, b) => (a.lote ?? '').localeCompare(b.lote ?? '') || a.numero - b.numero);
}
