/**
 * As linhas de um termo aditivo, item a item.
 *
 * Um termo de reequilíbrio muda o preço de alguns itens; uma renovação repõe
 * as quantidades de todos; uma alteração quantitativa acresce ou suprime
 * alguns. O registro do termo dizia só o total do contrato, e a aba Itens
 * ficava sem saber o que mudou em cada linha (26/09/2026, contrato 772/2024:
 * doze itens reequilibrados no 1º TA, quatro no 4º).
 *
 * Aqui vive a regra pura: que tipo de termo mexe em quê, o fundamento legal
 * de cada um, como casar as linhas lidas do anexo com os itens cadastrados,
 * quanto cada linha impacta e que avisos jurídicos a data e os números
 * disparam. O componente só desenha; a função de banco só aplica.
 */
import { somarDias, somarMeses } from './vigencia';

export type Modo = 'preco' | 'quantidade' | 'ambos';

export type ItemDoContrato = {
  id: string;
  codigo_item: string | null;
  descricao: string;
  unidade: string;
  valor_unitario: number;
  valor_unitario_original?: number | null;
  quantidade_contratada: number;
  saldo_quantitativo: number;
  numero_lote?: string | null;
};

/** Uma linha como o anexo a escreveu, já normalizada pela leitura. */
export type LinhaLida = {
  numero_item: string | null;
  numero_lote: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number | null;
  valor_atual: number | null;
  valor_novo: number | null;
};

/** O estado de uma linha na tabela: sempre um por item, mude ou não. */
export type LinhaDoTermo = {
  contrato_item_id: string;
  valor_novo: number;
  quantidade_acrescimo: number;
  quantidade_supressao: number;
  origem: 'leitura' | 'manual';
  valor_lido: number | null;
  quantidade_lida: number | null;
  numero_item_lido: string | null;
  descricao_lida: string | null;
};

/**
 * Que tipo de arquivo abre a tabela de itens, e o que ele pode mudar.
 * Chaves de `TIPOS_ARQUIVO` em `ContratoArquivos.tsx`.
 */
const MODO_DO_TIPO: Record<string, Modo> = {
  aditivo_reequilibrio: 'preco',
  aditivo_revisao: 'preco',
  aditivo_repactuacao: 'preco',
  aditivo_reajuste: 'preco',
  apostilamento_reajuste: 'preco',
  ata_aditivo_revisao: 'preco',
  aditivo_quantidade: 'quantidade',
  aditivo_prazo_quantidade: 'quantidade',
  aditivo_valor: 'ambos',
  aditivo_valor_quantidade: 'ambos',
  aditivo_prazo_valor: 'ambos',
  aditivo_prazo_alteracao: 'ambos',
  prorrogacao_continuo: 'ambos',
};

export function modoDoTipo(tipoArquivo: string | null | undefined): Modo | null {
  if (!tipoArquivo) return null;
  return MODO_DO_TIPO[tipoArquivo] ?? null;
}

/**
 * O amparo de cada tipo, conferido contra o texto de 2021 da Lei 14.133 (a
 * auditoria de 31/08 é o parâmetro: prazo por escopo é art. 111; contínuo,
 * art. 107, com teto decenal). A periodicidade anual do reajuste é de outra
 * lei, dita com o nome.
 */
const FUNDAMENTO_DO_TIPO: Record<string, string> = {
  aditivo_reequilibrio: 'Lei 14.133/2021, art. 124, II, "d" — revisão para reequilíbrio econômico-financeiro; fora do limite do art. 125',
  aditivo_revisao: 'Lei 14.133/2021, art. 124, II, "d" — revisão para reequilíbrio econômico-financeiro; fora do limite do art. 125',
  aditivo_repactuacao: 'Lei 14.133/2021, art. 135 — repactuação de serviços contínuos com dedicação exclusiva de mão de obra',
  aditivo_reajuste: 'Lei 14.133/2021, art. 136, I, c/c art. 92, V — reajuste pelo índice do contrato; periodicidade mínima anual (Lei 10.192/2001, art. 2º, § 1º)',
  apostilamento_reajuste: 'Lei 14.133/2021, art. 136, I, c/c art. 92, V — reajuste por apostila; periodicidade mínima anual (Lei 10.192/2001, art. 2º, § 1º)',
  ata_aditivo_revisao: 'Decreto 11.462/2023, arts. 26 e 27 — revisão dos preços registrados',
  prorrogacao_continuo: 'Lei 14.133/2021, art. 107 — prorrogação sucessiva de fornecimento contínuo, vigência máxima decenal, vantajosidade atestada',
  aditivo_prazo: 'Lei 14.133/2021, art. 111 — prorrogação de contrato por escopo',
  aditivo_prazo_valor: 'Lei 14.133/2021, arts. 107 e 124, I, "b" — prorrogação com alteração quantitativa; limite do art. 125',
  aditivo_prazo_quantidade: 'Lei 14.133/2021, arts. 107 e 124, I, "b" — prorrogação com alteração quantitativa; limite do art. 125',
  aditivo_prazo_alteracao: 'Lei 14.133/2021, arts. 107 e 124, I, "b" — prorrogação com alteração quantitativa; limite do art. 125',
  aditivo_valor: 'Lei 14.133/2021, art. 124, I, "b" — alteração quantitativa; limite do art. 125',
  aditivo_quantidade: 'Lei 14.133/2021, art. 124, I, "b" — alteração quantitativa; limite do art. 125',
  aditivo_valor_quantidade: 'Lei 14.133/2021, art. 124, I, "b" — alteração quantitativa; limite do art. 125',
  aditivo_escopo: 'Lei 14.133/2021, art. 124, I, "a" — alteração qualitativa; o objeto não se transfigura (art. 126)',
  apostilamento_razao_social: 'Lei 14.133/2021, art. 136, III — alteração da razão ou denominação social, por apostila',
  apostilamento_financeiro: 'Lei 14.133/2021, art. 136, II — atualizações, compensações ou penalizações financeiras, por apostila',
  apostilamento_empenho: 'Lei 14.133/2021, art. 136, IV — empenho de dotações orçamentárias, por apostila',
  ata_aditivo_prazo: 'Lei 14.133/2021, art. 84 — vigência da ata: 1 ano, prorrogável por igual período',
};

export function fundamentoDoTipo(tipoArquivo: string | null | undefined): string | null {
  if (!tipoArquivo) return null;
  return FUNDAMENTO_DO_TIPO[tipoArquivo] ?? null;
}

/** Tipos que mudam PREÇO por índice ou fato superveniente, sem quantidade. */
const TIPOS_DE_REAJUSTE = ['aditivo_reajuste', 'apostilamento_reajuste'];

// ── Número e semelhança ──────────────────────────────────────────────────────

/**
 * O número do item como os termos o citam. Só o código numérico curto serve
 * ("3", "18"); "3.3.90.32.03" é elemento de despesa, não número de item, e
 * a posição na lista não é confiável (a importação não preserva a ordem do
 * documento). Sem número, o casamento é pela descrição.
 */
export function numeroDoItem(item: Pick<ItemDoContrato, 'codigo_item'>): number | null {
  const codigo = (item.codigo_item ?? '').trim();
  if (!/^\d{1,4}$/.test(codigo)) return null;
  const n = Number(codigo);
  return n > 0 ? n : null;
}

/**
 * A ordem em que as pessoas leem um contrato: lote, depois o número do item,
 * depois a descrição. A importação grava os itens na ordem em que a leitura os
 * devolveu, e a tabela saía 6, 7, 18, 8, 16… (26/09). Item sem número vai
 * depois dos numerados, em ordem alfabética.
 */
export function ordenarItensPorNumero<T extends Pick<ItemDoContrato, 'codigo_item' | 'descricao' | 'numero_lote'>>(itens: T[]): T[] {
  const loteDe = (i: T): number => {
    const n = Number(String(i.numero_lote ?? '').replace(/\D/g, ''));
    return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
  };
  return [...itens].sort((a, b) => {
    const la = loteDe(a); const lb = loteDe(b);
    if (la !== lb) return la - lb;
    const na = numeroDoItem(a); const nb = numeroDoItem(b);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na === null && nb !== null) return 1;
    if (na !== null && nb === null) return -1;
    return a.descricao.localeCompare(b.descricao, 'pt-BR');
  });
}

function palavras(texto: string | null | undefined): Set<string> {
  const limpo = String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  return new Set(limpo.split(' ').filter((p) => p.length >= 3));
}

/** Dice sobre as palavras (≥ 3 letras, sem acento): 0 a 1. */
export function semelhanca(a: string | null | undefined, b: string | null | undefined): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;
  return (2 * comuns) / (pa.size + pb.size);
}

// ── Casamento das linhas lidas com os itens ──────────────────────────────────

export type Casamento = {
  linha: LinhaLida;
  itemId: string;
  criterio: 'lote_e_numero' | 'numero' | 'descricao';
  semelhanca: number;
};

export type ResultadoDoCasamento = {
  casadas: Casamento[];
  semItem: LinhaLida[];
};

const SEMELHANCA_MINIMA_COM_NUMERO = 0.35;
const SEMELHANCA_MINIMA_SEM_NUMERO = 0.6;

/**
 * Cada linha lida vai para UM item, e cada item recebe no máximo UMA linha.
 * Número do item (dentro do lote, quando há) manda, desde que a descrição
 * não desminta; sem número confiável, a descrição decide. Linha que não acha
 * item — ou que disputa um item já tomado — fica "sem item", para a pessoa
 * apontar à mão.
 */
export function casarLinhasLidas(linhas: LinhaLida[], itens: ItemDoContrato[]): ResultadoDoCasamento {
  const casadas: Casamento[] = [];
  const semItem: LinhaLida[] = [];
  const tomados = new Map<string, Casamento>();

  const numeroDe = (l: LinhaLida): number | null => {
    const n = Number(String(l.numero_item ?? '').replace(/\D/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  for (const linha of linhas) {
    const numero = numeroDe(linha);
    const loteDaLinha = (linha.numero_lote ?? '').replace(/\D/g, '');
    const candidatos = itens.filter((it) => {
      const loteDoItem = (it.numero_lote ?? '').replace(/\D/g, '');
      return !loteDaLinha || !loteDoItem || loteDaLinha === loteDoItem;
    });

    let escolhido: Casamento | null = null;
    if (numero !== null) {
      const porNumero = candidatos.filter((it) => numeroDoItem(it) === numero);
      if (porNumero.length === 1) {
        const s = semelhanca(linha.descricao, porNumero[0].descricao);
        if (!linha.descricao || s >= SEMELHANCA_MINIMA_COM_NUMERO) {
          escolhido = {
            linha, itemId: porNumero[0].id,
            criterio: loteDaLinha && porNumero[0].numero_lote ? 'lote_e_numero' : 'numero',
            semelhanca: s,
          };
        }
      }
    }
    if (!escolhido && linha.descricao) {
      let melhor: { it: ItemDoContrato; s: number } | null = null;
      for (const it of candidatos) {
        const s = semelhanca(linha.descricao, it.descricao);
        if (s >= SEMELHANCA_MINIMA_SEM_NUMERO && (!melhor || s > melhor.s)) melhor = { it, s };
      }
      if (melhor) escolhido = { linha, itemId: melhor.it.id, criterio: 'descricao', semelhanca: melhor.s };
    }

    if (!escolhido) { semItem.push(linha); continue; }
    const anterior = tomados.get(escolhido.itemId);
    if (anterior) {
      // Duas linhas para o mesmo item: fica a mais parecida; a outra vai para
      // a pessoa decidir. Nunca se sobrescreve em silêncio.
      if (escolhido.semelhanca > anterior.semelhanca) {
        semItem.push(anterior.linha);
        tomados.set(escolhido.itemId, escolhido);
      } else {
        semItem.push(linha);
      }
      continue;
    }
    tomados.set(escolhido.itemId, escolhido);
  }
  for (const c of tomados.values()) casadas.push(c);
  return { casadas, semItem };
}

// ── Linhas: estado inicial, impacto, totais ──────────────────────────────────

export function linhaSemMudanca(item: ItemDoContrato): LinhaDoTermo {
  return {
    contrato_item_id: item.id,
    valor_novo: Number(item.valor_unitario) || 0,
    quantidade_acrescimo: 0,
    quantidade_supressao: 0,
    origem: 'manual',
    valor_lido: null,
    quantidade_lida: null,
    numero_item_lido: null,
    descricao_lida: null,
  };
}

/** A linha lida vira estado da tabela, conforme o que o tipo pode mudar. */
export function linhaDaLeitura(item: ItemDoContrato, lida: LinhaLida, modo: Modo): LinhaDoTermo {
  const base = linhaSemMudanca(item);
  const precoLido = lida.valor_novo ?? null;
  const qtdLida = lida.quantidade ?? null;
  return {
    ...base,
    origem: 'leitura',
    valor_novo: modo !== 'quantidade' && precoLido !== null && precoLido > 0 ? precoLido : base.valor_novo,
    quantidade_acrescimo: modo !== 'preco' && qtdLida !== null && qtdLida > 0 ? qtdLida : 0,
    valor_lido: modo !== 'quantidade' ? precoLido : null,
    quantidade_lida: modo !== 'preco' ? qtdLida : null,
    numero_item_lido: lida.numero_item,
    descricao_lida: lida.descricao,
  };
}

const iguais = (a: number, b: number) => Math.abs(a - b) < 0.005;

export function linhaMudaAlgo(linha: LinhaDoTermo, item: ItemDoContrato): boolean {
  return !iguais(linha.valor_novo, Number(item.valor_unitario) || 0)
    || linha.quantidade_acrescimo > 0
    || linha.quantidade_supressao > 0;
}

/** A pessoa mexeu no que a leitura trouxe? */
export function linhaFoiEditada(linha: LinhaDoTermo): boolean {
  if (linha.origem !== 'leitura') return false;
  if (linha.valor_lido !== null && !iguais(linha.valor_novo, linha.valor_lido)) return true;
  if (linha.quantidade_lida !== null && !iguais(linha.quantidade_acrescimo, linha.quantidade_lida)) return true;
  return false;
}

export type Impacto = {
  vigente: number;
  deltaPreco: number;
  variacaoPct: number | null;
  /** Δ preço × saldo de quantidade: o reequilíbrio vale sobre o que resta. */
  impactoPreco: number;
  /** (acréscimo − supressão) × preço novo. */
  impactoQuantidade: number;
  total: number;
};

export function impactoDaLinha(linha: LinhaDoTermo, item: ItemDoContrato): Impacto {
  const vigente = Number(item.valor_unitario) || 0;
  const deltaPreco = iguais(linha.valor_novo, vigente) ? 0 : linha.valor_novo - vigente;
  const variacaoPct = vigente > 0 && deltaPreco !== 0 ? (deltaPreco / vigente) * 100 : null;
  const saldo = Math.max(Number(item.saldo_quantitativo) || 0, 0);
  const impactoPreco = arredonda(deltaPreco * saldo);
  const impactoQuantidade = arredonda((linha.quantidade_acrescimo - linha.quantidade_supressao) * linha.valor_novo);
  return { vigente, deltaPreco, variacaoPct, impactoPreco, impactoQuantidade, total: arredonda(impactoPreco + impactoQuantidade) };
}

function arredonda(v: number): number {
  return Math.round(v * 100) / 100;
}

export type Resumo = {
  itensAlterados: number;
  valorAcrescimo: number;
  valorSupressao: number;
  quantidadeAcrescimo: number;
  quantidadeSupressao: number;
};

/** Os totais que vão para o termo: acréscimo e supressão em valor e quantidade. */
export function resumoDoTermo(linhas: Record<string, LinhaDoTermo>, itens: ItemDoContrato[]): Resumo {
  const r: Resumo = { itensAlterados: 0, valorAcrescimo: 0, valorSupressao: 0, quantidadeAcrescimo: 0, quantidadeSupressao: 0 };
  for (const item of itens) {
    const linha = linhas[item.id];
    if (!linha || !linhaMudaAlgo(linha, item)) continue;
    r.itensAlterados++;
    const { total } = impactoDaLinha(linha, item);
    if (total >= 0) r.valorAcrescimo += total; else r.valorSupressao += -total;
    r.quantidadeAcrescimo += linha.quantidade_acrescimo;
    r.quantidadeSupressao += linha.quantidade_supressao;
  }
  r.valorAcrescimo = arredonda(r.valorAcrescimo);
  r.valorSupressao = arredonda(r.valorSupressao);
  return r;
}

/** Só as linhas que mudam algo, prontas para gravar em contrato_aditivo_itens. */
export function linhasParaGravar(linhas: Record<string, LinhaDoTermo>, itens: ItemDoContrato[]) {
  const saida: Array<{
    contrato_item_id: string;
    valor_unitario_anterior: number;
    valor_unitario_novo: number | null;
    quantidade_acrescimo: number;
    quantidade_supressao: number;
    origem: 'leitura' | 'manual';
    editado: boolean;
    valor_lido: number | null;
    quantidade_lida: number | null;
    numero_item_lido: string | null;
    descricao_lida: string | null;
  }> = [];
  for (const item of itens) {
    const linha = linhas[item.id];
    if (!linha || !linhaMudaAlgo(linha, item)) continue;
    const vigente = Number(item.valor_unitario) || 0;
    saida.push({
      contrato_item_id: item.id,
      valor_unitario_anterior: vigente,
      valor_unitario_novo: iguais(linha.valor_novo, vigente) ? null : linha.valor_novo,
      quantidade_acrescimo: linha.quantidade_acrescimo,
      quantidade_supressao: linha.quantidade_supressao,
      origem: linha.origem,
      editado: linhaFoiEditada(linha),
      valor_lido: linha.valor_lido,
      quantidade_lida: linha.quantidade_lida,
      numero_item_lido: linha.numero_item_lido,
      descricao_lida: linha.descricao_lida,
    });
  }
  return saida;
}

// ── Validação e avisos jurídicos ─────────────────────────────────────────────

export function errosDasLinhas(linhas: Record<string, LinhaDoTermo>, itens: ItemDoContrato[], modo: Modo): string[] {
  const erros: string[] = [];
  for (const item of itens) {
    const linha = linhas[item.id];
    if (!linha) continue;
    const nome = item.descricao.slice(0, 40);
    if (!(linha.valor_novo > 0)) erros.push(`${nome}: preço novo tem de ser maior que zero.`);
    if (linha.quantidade_acrescimo < 0 || linha.quantidade_supressao < 0) erros.push(`${nome}: quantidade negativa.`);
    if (modo === 'preco' && (linha.quantidade_acrescimo > 0 || linha.quantidade_supressao > 0)) {
      erros.push(`${nome}: este tipo de termo muda preço, não quantidade.`);
    }
    if (modo === 'quantidade' && !iguais(linha.valor_novo, Number(item.valor_unitario) || 0)) {
      erros.push(`${nome}: este tipo de termo muda quantidade, não preço.`);
    }
    if (linha.quantidade_supressao > Math.max(Number(item.saldo_quantitativo) || 0, 0)) {
      erros.push(`${nome}: supressão maior que o saldo de ${item.saldo_quantitativo} ${item.unidade}.`);
    }
  }
  return erros;
}

export type Aviso = { nivel: 'bloqueia' | 'ressalva' | 'info'; texto: string };

export type EntradaDosAvisos = {
  tipoArquivo: string;
  dataAssinatura: string | null;
  dataEfeitos: string | null;
  dataBaseReajuste: string | null;
  dataInicioContrato: string | null;
  dataFimAtual: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  valorGlobalOriginal: number | null;
  resumo: Resumo;
};

const dataBr = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/**
 * O que a lei diz sobre este termo, com os números na mão. "bloqueia" não
 * salva; "ressalva" salva só com a caixa "registrado com ressalva" marcada;
 * "info" só informa.
 */
export function avisosJuridicos(e: EntradaDosAvisos): Aviso[] {
  const avisos: Aviso[] = [];
  const modo = modoDoTipo(e.tipoArquivo);

  if (TIPOS_DE_REAJUSTE.includes(e.tipoArquivo) && e.dataBaseReajuste && e.dataEfeitos) {
    const aniversario = somarMeses(e.dataBaseReajuste, 12);
    if (aniversario && e.dataEfeitos < aniversario) {
      avisos.push({
        nivel: 'ressalva',
        texto: `Reajuste com efeitos em ${dataBr(e.dataEfeitos)}, antes de 12 meses da data-base (${dataBr(e.dataBaseReajuste)}): a periodicidade mínima é anual (Lei 10.192/2001, art. 2º, § 1º; Lei 14.133/2021, art. 92, V). Confira a data-base ou registre com ressalva.`,
      });
    }
  }

  if (e.dataAssinatura && e.dataEfeitos) {
    const umMesAntes = somarMeses(e.dataAssinatura, -1);
    if (umMesAntes && e.dataEfeitos < umMesAntes) {
      avisos.push({
        nivel: 'ressalva',
        texto: `Efeitos desde ${dataBr(e.dataEfeitos)}, mais de um mês antes da assinatura (${dataBr(e.dataAssinatura)}): a antecipação de efeitos exige formalização em até um mês (Lei 14.133/2021, art. 132). Registre com ressalva.`,
      });
    }
  }

  if (e.tipoArquivo === 'prorrogacao_continuo') {
    if (e.periodoInicio && e.dataFimAtual) {
      const diaSeguinte = somarDias(e.dataFimAtual, 1);
      if (diaSeguinte && e.periodoInicio !== diaSeguinte) {
        avisos.push({
          nivel: 'info',
          texto: `O período começa em ${dataBr(e.periodoInicio)} e a vigência atual termina em ${dataBr(e.dataFimAtual)}: a prorrogação sucessiva é contínua (art. 107). Confira as datas.`,
        });
      }
    }
    if (e.periodoFim && e.dataInicioContrato) {
      const teto = somarMeses(e.dataInicioContrato, 120);
      if (teto && e.periodoFim > teto) {
        avisos.push({
          nivel: 'bloqueia',
          texto: `O período termina em ${dataBr(e.periodoFim)}, além do teto decenal contado de ${dataBr(e.dataInicioContrato)} (Lei 14.133/2021, art. 107).`,
        });
      }
    }
    if (e.periodoInicio && e.periodoFim && e.periodoFim <= e.periodoInicio) {
      avisos.push({ nivel: 'bloqueia', texto: 'O fim do período tem de ser posterior ao início.' });
    }
  }

  if (modo === 'preco' && (e.resumo.quantidadeAcrescimo > 0 || e.resumo.quantidadeSupressao > 0)) {
    avisos.push({
      nivel: 'bloqueia',
      texto: 'Reequilíbrio, reajuste e repactuação mudam PREÇO; acréscimo ou supressão de quantidade é alteração quantitativa (Lei 14.133/2021, art. 124, I, "b") e vai em termo próprio.',
    });
  }

  const contaNoLimite = ['aditivo_valor', 'aditivo_quantidade', 'aditivo_valor_quantidade', 'aditivo_prazo_valor', 'aditivo_prazo_quantidade', 'aditivo_prazo_alteracao', 'aditivo_escopo'];
  if (contaNoLimite.includes(e.tipoArquivo) && e.valorGlobalOriginal && e.valorGlobalOriginal > 0) {
    const pct = (e.resumo.valorAcrescimo / e.valorGlobalOriginal) * 100;
    if (pct > 25) {
      avisos.push({
        nivel: 'ressalva',
        texto: `Acréscimo de ${pct.toFixed(1)}% do valor inicial do contrato: acima dos 25% que o contratado é obrigado a aceitar (Lei 14.133/2021, art. 125; 50% só para reforma de edifício ou equipamento). Registre com ressalva.`,
      });
    }
  }

  return avisos;
}

export function avisoBloqueia(avisos: Aviso[]): boolean {
  return avisos.some((a) => a.nivel === 'bloqueia');
}

export function avisoExigeRessalva(avisos: Aviso[]): boolean {
  return avisos.some((a) => a.nivel === 'ressalva');
}

/** "Original R$ 5,04 → 1º TA R$ 6,81 → 4º TA R$ 8,95", para a coluna Situação. */
export type PassoDoPreco = { rotulo: string; data: string | null; valor: number; variacaoPct: number | null };

export function trajetoriaDoPreco(
  original: number,
  passos: Array<{ rotulo: string; data: string | null; valor: number }>,
): PassoDoPreco[] {
  const saida: PassoDoPreco[] = [{ rotulo: 'Original', data: null, valor: original, variacaoPct: null }];
  let anterior = original;
  for (const p of passos) {
    saida.push({
      rotulo: p.rotulo,
      data: p.data,
      valor: p.valor,
      variacaoPct: anterior > 0 ? ((p.valor - anterior) / anterior) * 100 : null,
    });
    anterior = p.valor;
  }
  return saida;
}
