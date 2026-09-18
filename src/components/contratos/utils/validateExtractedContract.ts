/**
 * Valida e normaliza os campos extraídos pela IA antes de aplicá-los ao
 * registro pai (`contratos`). Garante que o Dashboard não receba dados
 * inválidos (datas inconsistentes, valores absurdos, strings vazias, etc.).
 */

import { clausulaFalaDePrazo } from '@/lib/contratos/prazo-de-entrega';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const MAX_VALOR = 1_000_000_000_000; // R$ 1 trilhão — sanity ceiling
const MAX_MESES = 120; // 10 anos

function toIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (ISO_DATE.test(s)) {
    const d = new Date(s + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : s;
  }
  const m = s.match(BR_DATE);
  if (m) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

function toPositiveNumber(v: unknown, max = MAX_VALOR): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return n;
}

function toCleanString(v: unknown, maxLen = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > maxLen) return null;
  return s;
}

export interface NormalizedExtraction {
  numero_contrato?: string;
  numero_ata?: string;
  objeto?: string;
  orgao_contratante?: string;
  modalidade?: string;
  valor_global?: number;
  data_assinatura?: string;
  data_inicio?: string;
  data_fim?: string;
  vigencia_meses?: number;
  validade_ata_meses?: number;
  prazo_entrega_dias?: number;
  prazo_entrega_unidade?: 'uteis' | 'corridos';
  prazo_entrega_clausula?: string;
  local_entrega?: string;
  local_entrega_clausula?: string;
  prazo_recebimento_dias?: number;
  prazo_recebimento_unidade?: 'uteis' | 'corridos';
  prazo_recebimento_clausula?: string;
  prazo_pagamento_dias?: number;
  prazo_pagamento_unidade?: 'uteis' | 'corridos';
  prazo_pagamento_marco?: 'ateste' | 'nota_fiscal' | 'protocolo' | 'entrega';
  prazo_pagamento_clausula?: string;
  assinatura_situacao?: 'ambas' | 'so_contratada' | 'so_orgao' | 'nenhuma';
  assinatura_orgao?: string;
  assinatura_contratada?: string;
  assinatura_observacao?: string;
  indice_reajuste?: string;
  data_base_reajuste?: string;
  reajuste_clausula?: string;
}

/** Dias de prazo plausíveis: 1..1825. Fora disso é data lida como prazo. */
const MAX_DIAS_DE_PRAZO = 1825;

/** Só as duas unidades que existem em contrato público. Resto vira undefined. */
function unidadeDePrazo(v: unknown): 'uteis' | 'corridos' | undefined {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (/[uú]tei?s?/.test(t)) return 'uteis';
  if (/corrid/.test(t)) return 'corridos';
  return undefined;
}

export interface ValidationReport {
  normalized: NormalizedExtraction;
  rejected: string[];
}

/**
 * Recebe o payload bruto da IA e retorna apenas os campos que passaram nas
 * validações de tipo, intervalo e coerência. Campos rejeitados são listados.
 */
export function validateExtractedContract(raw: any): ValidationReport {
  const out: NormalizedExtraction = {};
  const rejected: string[] = [];
  if (!raw || typeof raw !== 'object') return { normalized: out, rejected: ['payload_vazio'] };

  const numContrato = toCleanString(raw.numero_contrato, 80);
  if (numContrato) out.numero_contrato = numContrato;
  else if (raw.numero_contrato) rejected.push('numero_contrato');

  const numAta = toCleanString(raw.numero_ata, 80);
  if (numAta) out.numero_ata = numAta;
  else if (raw.numero_ata) rejected.push('numero_ata');

  const objeto = toCleanString(raw.objeto, 2000);
  if (objeto) out.objeto = objeto;
  else if (raw.objeto) rejected.push('objeto');

  const orgao = toCleanString(raw.orgao_contratante ?? raw.orgao, 300);
  if (orgao) out.orgao_contratante = orgao;
  else if (raw.orgao_contratante || raw.orgao) rejected.push('orgao_contratante');

  const modalidade = toCleanString(raw.modalidade, 80);
  if (modalidade) out.modalidade = modalidade;
  else if (raw.modalidade) rejected.push('modalidade');

  const valor = toPositiveNumber(raw.valor_global);
  if (valor !== null) out.valor_global = valor;
  else if (raw.valor_global !== undefined && raw.valor_global !== null) rejected.push('valor_global');

  const dAssinatura = toIsoDate(raw.data_assinatura);
  if (dAssinatura) out.data_assinatura = dAssinatura;
  else if (raw.data_assinatura) rejected.push('data_assinatura');

  const dInicio = toIsoDate(raw.data_inicio);
  if (dInicio) out.data_inicio = dInicio;
  else if (raw.data_inicio) rejected.push('data_inicio');

  const dFim = toIsoDate(raw.data_fim);
  if (dFim) out.data_fim = dFim;
  else if (raw.data_fim) rejected.push('data_fim');

  // Coerência: data_inicio ≤ data_fim. Se inválido, descarta data_fim.
  if (out.data_inicio && out.data_fim && out.data_inicio > out.data_fim) {
    rejected.push('data_fim_anterior_a_inicio');
    delete out.data_fim;
  }
  // Coerência: data_assinatura ≤ data_inicio (assinatura não pode ser depois).
  if (out.data_assinatura && out.data_inicio && out.data_assinatura > out.data_inicio) {
    rejected.push('data_assinatura_posterior_a_inicio');
    delete out.data_assinatura;
  }

  const vigMeses = toPositiveNumber(raw.vigencia_meses, MAX_MESES);
  if (vigMeses !== null && Number.isInteger(vigMeses)) out.vigencia_meses = vigMeses;
  else if (raw.vigencia_meses) rejected.push('vigencia_meses');

  const valMeses = toPositiveNumber(raw.validade_ata_meses, MAX_MESES);
  if (valMeses !== null && Number.isInteger(valMeses)) out.validade_ata_meses = valMeses;
  else if (raw.validade_ata_meses) rejected.push('validade_ata_meses');

  // ── Prazo e local de entrega ──────────────────────────────────────────────
  // A unidade é validada JUNTO com os dias: prazo sem unidade seria contado
  // como corrido por omissão, e "10 dias" lido de uma cláusula que dizia
  // "10 dias úteis" põe a data-limite quatro dias antes da real. O CHECK do
  // banco recusaria a gravação, então o par tem de sair coerente daqui.
  //
  // E o número só entra COM a frase que o sustenta. Em 17/09 a leitura devolveu
  // "481 dias" citando uma linha de tabela de itens ("23/04/2026 Inclusão
  // 481,78950 38,0000 18.308,00" — 481,79 kg × R$ 38,00): número sem cláusula
  // que fale em prazo é quantidade, valor ou data lida no lugar errado. Fica de
  // fora, com o motivo na trilha (`*_sem_evidencia`).
  const clEnt = toCleanString(raw.prazo_entrega_clausula, 900);
  const dEnt = toPositiveNumber(raw.prazo_entrega_dias, MAX_DIAS_DE_PRAZO);
  if (dEnt !== null && Number.isInteger(dEnt) && !clausulaFalaDePrazo(clEnt)) {
    rejected.push('prazo_entrega_sem_evidencia');
  } else if (dEnt !== null && Number.isInteger(dEnt)) {
    out.prazo_entrega_dias = dEnt;
    const un = unidadeDePrazo(raw.prazo_entrega_unidade);
    // Sem menção expressa, conta-se em dias corridos — regra geral de contagem
    // de prazos (Código Civil, art. 132), não invenção nossa.
    out.prazo_entrega_unidade = un ?? 'corridos';
    if (clEnt) out.prazo_entrega_clausula = clEnt;
  } else if (raw.prazo_entrega_dias) {
    rejected.push('prazo_entrega_dias');
  }

  const local = toCleanString(raw.local_entrega, 400);
  if (local) out.local_entrega = local;
  const clLocal = toCleanString(raw.local_entrega_clausula, 900);
  if (clLocal) out.local_entrega_clausula = clLocal;

  const clRec = toCleanString(raw.prazo_recebimento_clausula, 900);
  const dRec = toPositiveNumber(raw.prazo_recebimento_dias, MAX_DIAS_DE_PRAZO);
  if (dRec !== null && Number.isInteger(dRec) && !clausulaFalaDePrazo(clRec)) {
    rejected.push('prazo_recebimento_sem_evidencia');
  } else if (dRec !== null && Number.isInteger(dRec)) {
    out.prazo_recebimento_dias = dRec;
    out.prazo_recebimento_unidade = unidadeDePrazo(raw.prazo_recebimento_unidade) ?? 'corridos';
    if (clRec) out.prazo_recebimento_clausula = clRec;
  } else if (raw.prazo_recebimento_dias) {
    rejected.push('prazo_recebimento_dias');
  }

  // Pagamento. Um ano de teto: prazo maior que isso é data lida como prazo.
  const clPag = toCleanString(raw.prazo_pagamento_clausula, 900);
  const dPag = toPositiveNumber(raw.prazo_pagamento_dias, 365);
  if (dPag !== null && Number.isInteger(dPag) && !clausulaFalaDePrazo(clPag)) {
    rejected.push('prazo_pagamento_sem_evidencia');
  } else if (dPag !== null && Number.isInteger(dPag)) {
    out.prazo_pagamento_dias = dPag;
    out.prazo_pagamento_unidade = unidadeDePrazo(raw.prazo_pagamento_unidade) ?? 'corridos';
    const marco = toCleanString(raw.prazo_pagamento_marco, 20)?.toLowerCase();
    // O marco NÃO tem padrão: supor "ateste" quando a cláusula conta da nota
    // desloca a previsão de entrada em semanas. Sem leitura segura, fica nulo.
    if (marco === 'ateste' || marco === 'nota_fiscal' || marco === 'protocolo' || marco === 'entrega') {
      out.prazo_pagamento_marco = marco;
    }
    if (clPag) out.prazo_pagamento_clausula = clPag;
  } else if (raw.prazo_pagamento_dias) {
    rejected.push('prazo_pagamento_dias');
  }

  // ── Validade do instrumento ───────────────────────────────────────────────
  //
  // A IA LISTA quem assinou de cada lado; a classificação sai daqui.
  //
  // Antes eu pedia a classificação pronta, e em 30/08/2026 ela devolveu
  // `so_orgao` para um contrato cuja única assinatura era do "Contratado" —
  // errado, e com aparência de resposta. O painel de eficácia passou a dizer
  // o oposto do que o documento mostra.
  //
  // Classificar exige decidir de que lado está cada nome. Listar exige só
  // copiar o que está escrito ao lado dele. A segunda tarefa a IA faz bem, e
  // a primeira o código faz sem errar.
  const porOrgao = toCleanString(raw.assinatura_orgao, 200);
  const porContratada = toCleanString(raw.assinatura_contratada, 200);
  if (porOrgao) out.assinatura_orgao = porOrgao;
  if (porContratada) out.assinatura_contratada = porContratada;

  if (porOrgao && porContratada) out.assinatura_situacao = 'ambas';
  else if (porContratada) out.assinatura_situacao = 'so_contratada';
  else if (porOrgao) out.assinatura_situacao = 'so_orgao';
  // Nenhum dos dois lados lido: fica NULO, não 'nenhuma'. "Não consegui ler"
  // e "não há assinatura" são coisas diferentes, e só a segunda deveria
  // travar a execução por si.

  const assinObs = toCleanString(raw.assinatura_observacao, 400);
  if (assinObs) out.assinatura_observacao = assinObs;

  // ── Cláusula de reajuste (art. 92, V e §3º) ──────────────────────────────
  // Sigla curta e maiúscula; data-base só se for data de verdade. É o insumo
  // do alerta de aniversário anual — dado errado dispara alerta no dia
  // errado, então o que não passa fica de fora e a tela pede à mão.
  const indiceRj = toCleanString(raw.indice_reajuste, 30)?.toUpperCase();
  if (indiceRj && /^[A-ZÀ-Ü0-9ºª./\s-]{2,30}$/.test(indiceRj)) {
    out.indice_reajuste = indiceRj;
  } else if (raw.indice_reajuste) {
    rejected.push('indice_reajuste');
  }
  const dataBaseRj = toIsoDate(raw.data_base_reajuste);
  if (dataBaseRj) out.data_base_reajuste = dataBaseRj;
  else if (raw.data_base_reajuste) rejected.push('data_base_reajuste');
  const clRj = toCleanString(raw.reajuste_clausula, 900);
  if (clRj) out.reajuste_clausula = clRj;

  return { normalized: out, rejected };
}

/**
 * O que cada arquivo tem autoridade para dizer sobre o contrato.
 *
 * O INSTRUMENTO (o contrato original; a própria ata, numa ata) responde por
 * tudo: identificação, valor, datas, cláusulas e assinaturas. Um aditivo — e a
 * ata de referência anexada a um contrato — responde só pelas CLÁUSULAS de
 * entrega, ateste, pagamento e reajuste, e só em branco: as assinaturas, o
 * valor e as datas dele são do aditivo, não do contrato. Empenho, ordem de
 * fornecimento, publicação, nota fiscal e "outro" não respondem por NADA.
 *
 * O caso que fixou a regra (17/09, contrato 17/2025): uma nota de empenho
 * relida pôs no contrato "481 dias" de prazo (quantidade de item) e "assinado
 * só pelo órgão" (empenho não tem assinatura da contratada) — e o painel
 * mandou não iniciar a execução de um contrato assinado pelos dois.
 */
export type AutoridadeDoArquivo = 'instrumento' | 'clausulas' | 'nenhuma';

export function autoridadeDoArquivo(
  tipoArquivo: string | null | undefined,
  parentTipo: 'ata_srp' | 'contrato',
): AutoridadeDoArquivo {
  const t = (tipoArquivo ?? '').toLowerCase();
  // Chamador que não diz o tipo (importação do PDF na criação): é o próprio
  // instrumento que está sendo cadastrado — comportamento de sempre.
  if (!t) return 'instrumento';
  if (parentTipo === 'contrato' && t === 'contrato_original') return 'instrumento';
  if (parentTipo === 'ata_srp' && t === 'ata_srp') return 'instrumento';
  if (t === 'ata_srp' || /^(aditivo|ata_aditivo|prorrogacao|apostilamento)/.test(t)) return 'clausulas';
  return 'nenhuma';
}

/**
 * Decide quais campos validados devem ser enviados ao UPDATE, respeitando
 * o princípio: nunca sobrescrever edições manuais já presentes no parent —
 * e o limite de autoridade do arquivo de onde a leitura veio.
 */
export function buildParentUpdates(
  normalized: NormalizedExtraction,
  parent: any,
  parentTipo: 'ata_srp' | 'contrato',
  tipoArquivo?: string | null,
): Record<string, any> {
  const u: Record<string, any> = {};
  if (!parent) return u;

  const autoridade = autoridadeDoArquivo(tipoArquivo, parentTipo);
  if (autoridade === 'nenhuma') return u;
  const ehInstrumento = autoridade === 'instrumento';

  if (ehInstrumento) {
    // Identificadores
    if (parentTipo === 'ata_srp') {
      if (normalized.numero_ata && !parent.numero_ata) u.numero_ata = normalized.numero_ata;
      if (normalized.validade_ata_meses && !parent.validade_ata_meses) {
        u.validade_ata_meses = normalized.validade_ata_meses;
      } else if (normalized.vigencia_meses && !parent.validade_ata_meses) {
        u.validade_ata_meses = normalized.vigencia_meses;
      }
    }
    if (normalized.numero_contrato && (!parent.numero_contrato || /^(SEM|TBD|--)/i.test(parent.numero_contrato))) {
      u.numero_contrato = normalized.numero_contrato;
    }

    if (normalized.objeto && !parent.objeto) u.objeto = normalized.objeto;
    // Coluna real é `orgao_contratante`
    if (normalized.orgao_contratante && !parent.orgao_contratante) {
      u.orgao_contratante = normalized.orgao_contratante;
    }
    if (normalized.modalidade && !parent.modalidade) u.modalidade = normalized.modalidade;

    // Financeiro: jamais sobrescrever valor manual já gravado
    if (normalized.valor_global && !(Number(parent.valor_global_original) > 0)) {
      u.valor_global_original = normalized.valor_global;
      if (!(Number(parent.valor_global) > 0)) u.valor_global = normalized.valor_global;
    }

    // Datas
    if (normalized.data_assinatura && !parent.data_assinatura) u.data_assinatura = normalized.data_assinatura;
    if (normalized.data_inicio && !parent.data_inicio) u.data_inicio = normalized.data_inicio;
    if (normalized.data_fim && !parent.data_fim) u.data_fim = normalized.data_fim;

    if (parentTipo === 'contrato' && normalized.vigencia_meses && !parent.vigencia_meses) {
      u.vigencia_meses = normalized.vigencia_meses;
    }
  }

  // ── Prazo e local de entrega ──────────────────────────────────────────────
  // Valem para contrato E para ata: a ata também diz em quanto tempo entregar
  // depois da ordem de fornecimento — é dela que os pedidos saem.
  //
  // Dias e unidade vão SEMPRE juntos. Gravar só o dia deixaria a coluna de
  // unidade nula e o CHECK do banco recusaria a linha inteira; gravar só a
  // unidade não significa nada.
  if (normalized.prazo_entrega_dias && !parent.prazo_entrega_dias) {
    u.prazo_entrega_dias = normalized.prazo_entrega_dias;
    u.prazo_entrega_unidade = normalized.prazo_entrega_unidade ?? 'corridos';
    if (normalized.prazo_entrega_clausula) u.prazo_entrega_clausula = normalized.prazo_entrega_clausula;
  }
  if (normalized.local_entrega && !parent.local_entrega) {
    u.local_entrega = normalized.local_entrega;
    if (normalized.local_entrega_clausula) u.local_entrega_clausula = normalized.local_entrega_clausula;
  }
  if (normalized.prazo_pagamento_dias && !parent.prazo_pagamento_dias) {
    u.prazo_pagamento_dias = normalized.prazo_pagamento_dias;
    u.prazo_pagamento_unidade = normalized.prazo_pagamento_unidade ?? 'corridos';
    if (normalized.prazo_pagamento_marco) u.prazo_pagamento_marco = normalized.prazo_pagamento_marco;
    if (normalized.prazo_pagamento_clausula) u.prazo_pagamento_clausula = normalized.prazo_pagamento_clausula;
  }

  // A assinatura é sobrescrita mesmo quando já havia valor: o documento
  // ANEXADO é a fonte, e trocar o PDF por outro (a versão finalmente assinada
  // pelas duas partes) tem de refletir aqui. Manter o valor antigo faria o
  // sistema continuar dizendo "assinado por uma parte só" depois de o problema
  // ter sido resolvido. Mas só o INSTRUMENTO fala por ela: a assinatura de um
  // aditivo é do aditivo, e a de um empenho é do ordenador — nenhuma diz quem
  // assinou o contrato.
  if (ehInstrumento && normalized.assinatura_situacao) {
    u.assinatura_situacao = normalized.assinatura_situacao;
    // A observação guarda os DOIS lados como foram lidos. É o que permite
    // conferir a classificação sem reabrir o PDF — e foi lendo esse campo ao
    // lado do outro que o erro de 30/08 apareceu.
    const partes = [
      normalized.assinatura_orgao ? `Órgão: ${normalized.assinatura_orgao}` : null,
      normalized.assinatura_contratada ? `Contratada: ${normalized.assinatura_contratada}` : null,
      normalized.assinatura_observacao ?? null,
    ].filter(Boolean);
    if (partes.length > 0) u.assinatura_observacao = partes.join(' · ').slice(0, 400);
  }

  if (normalized.prazo_recebimento_dias && !parent.prazo_recebimento_dias) {
    u.prazo_recebimento_dias = normalized.prazo_recebimento_dias;
    u.prazo_recebimento_unidade = normalized.prazo_recebimento_unidade ?? 'corridos';
    if (normalized.prazo_recebimento_clausula) u.prazo_recebimento_clausula = normalized.prazo_recebimento_clausula;
  }

  // ── Cláusula de reajuste ──────────────────────────────────────────────────
  // Índice e data-base andam separados de propósito: a cláusula pode nomear o
  // índice e não dar a data (marco "da proposta" sem data escrita). Cada um
  // entra quando lido — e nunca por cima do que foi preenchido à mão.
  if (normalized.indice_reajuste && !parent.indice_reajuste) {
    u.indice_reajuste = normalized.indice_reajuste;
  }
  if (normalized.data_base_reajuste && !parent.data_base_reajuste) {
    u.data_base_reajuste = normalized.data_base_reajuste;
  }
  if (normalized.reajuste_clausula && !parent.reajuste_clausula) {
    u.reajuste_clausula = normalized.reajuste_clausula;
  }

  return u;
}
