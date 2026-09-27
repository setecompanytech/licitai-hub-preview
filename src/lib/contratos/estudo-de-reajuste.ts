/**
 * Estudo técnico de reajustamento — o número, a lei e a contabilidade num só
 * lugar, sem IA (27/09/2026).
 *
 * O Simulador de Índices pedia a uma IA a "fundamentação jurídica" e o
 * "parecer": o texto citava o art. 65 (que na Lei 14.133 é habilitação) e um
 * acórdão inexistente. Peça protocolada no órgão não pode nascer assim. Aqui
 * tudo é determinístico: o fator sai da série oficial do SGS (ou do
 * percentual que o requerente informou, dito como tal), as citações são as
 * conferidas contra o texto de 2021 (auditoria de 31/08) e o mesmo HTML vira
 * impressão/PDF e arquivo Word.
 */

export type MesDaSerie = { competencia: string; variacao: number; fator: number };

/** O que a edge `indices-economicos` (action `calculo_reajuste`) devolve. */
export type SerieOficial = {
  indice: string;
  fonte: string;
  data_base: string;
  data_alvo: string;
  meses: MesDaSerie[];
  meses_esperados: number;
  completo: boolean;
  serie_ate: string | null;
  fator: number;
  percentual: number;
};

export type TipoDeServico = 'continuado' | 'engenharia' | 'fornecimento' | 'comum';

export const NOME_DO_TIPO: Record<TipoDeServico, string> = {
  continuado: 'Serviço contínuo com dedicação exclusiva ou predominância de mão de obra',
  engenharia: 'Obra ou serviço de engenharia',
  fornecimento: 'Fornecimento contínuo',
  comum: 'Serviço comum',
};

/** Índices com série mensal no SGS do Banco Central — o cálculo é exato. */
export const INDICES_COM_SERIE: Record<string, { nome: string; fonte: string }> = {
  'IPCA': { nome: 'Índice Nacional de Preços ao Consumidor Amplo', fonte: 'IBGE · BCB/SGS 433' },
  'INPC': { nome: 'Índice Nacional de Preços ao Consumidor', fonte: 'IBGE · BCB/SGS 188' },
  'IGP-M': { nome: 'Índice Geral de Preços — Mercado', fonte: 'FGV · BCB/SGS 189' },
  'IGP-DI': { nome: 'Índice Geral de Preços — Disponibilidade Interna', fonte: 'FGV · BCB/SGS 190' },
  'INCC-DI': { nome: 'Índice Nacional de Custo da Construção — DI', fonte: 'FGV · BCB/SGS 192' },
};

/** Índices sem série no SGS: o percentual vem da tabela/CCT, informado à mão. */
export const INDICES_SEM_SERIE: Record<string, string> = {
  'SINAPI': 'SINAPI (Caixa/IBGE) — custos da construção civil',
  'CUB': 'CUB/m² (Sinduscon) — custo unitário básico',
  'SICRO': 'SICRO (DNIT) — obras rodoviárias',
  'CCT': 'Convenção ou acordo coletivo de trabalho',
};

export function temSerieOficial(indice: string): boolean {
  return Object.prototype.hasOwnProperty.call(INDICES_COM_SERIE, indice.trim().toUpperCase());
}

export type EntradaDoEstudo = {
  /** Valor sobre o qual o reajuste incide (valor contratual ou saldo a executar). */
  valorBase: number;
  indice: string;
  /** O percentual que o requerente aplica — normalmente o da série; pode ter sido editado. */
  percentualAplicado: number;
  /** Data-base da cláusula (orçamento/proposta) ou marco do último reajuste. */
  dataBase: string | null;
  /** Data do aniversário / da incidência pretendida. */
  dataAlvo: string | null;
  tipoServico: TipoDeServico;
  serie?: SerieOficial | null;
  /** Hoje em YYYY-MM-DD, decidido por quem chama. */
  hoje: string;
  /** Linhas de identificação do documento (contrato, órgão, objeto…). */
  identificacao?: Array<[string, string]>;
  /** A base é o saldo a executar (true) ou o valor contratual cheio (false). */
  baseEhSaldo?: boolean;
};

export type Referencia = { norma: string; texto: string };

export type Estudo = {
  regime: 'reajuste' | 'repactuacao';
  fator: number;
  valorReajustado: number;
  diferenca: number;
  mesesDeInterregno: number | null;
  percentualOficial: number | null;
  percentualDiverge: boolean;
  alertas: string[];
  fundamentacao: string[];
  parecer: string[];
  contabil: string[];
  referencias: Referencia[];
};

const arredonda = (v: number) => Math.round(v * 100) / 100;

export function mesesEntre(deIso: string, ateIso: string): number {
  const [a1, m1, d1] = deIso.slice(0, 10).split('-').map(Number);
  const [a2, m2, d2] = ateIso.slice(0, 10).split('-').map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return meses;
}

const dataValida = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10));

export const dataBr = (iso: string | null | undefined): string =>
  dataValida(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';

export const num = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const moeda = (v: number) => `R$ ${num(v)}`;

const pct = (v: number) => `${num(v)}%`;

/** As normas, conferidas contra o texto de 2021 da Lei 14.133 (auditoria de 31/08). */
export function referenciasDoRegime(regime: 'reajuste' | 'repactuacao'): Referencia[] {
  const comuns: Referencia[] = [
    { norma: 'Lei 14.133/2021, art. 6º, LVIII e LIX', texto: 'definições de reajustamento em sentido estrito (índice previsto no contrato) e de repactuação (análise da variação dos custos, para serviços contínuos com dedicação exclusiva ou predominância de mão de obra)' },
    { norma: 'Lei 14.133/2021, art. 25, § 7º, e art. 92, § 3º', texto: 'o contrato traz cláusula com o índice de reajustamento, com data-base vinculada à data do orçamento estimado, admitidos índices específicos ou setoriais por insumo' },
    { norma: 'Lei 14.133/2021, art. 92, § 4º', texto: 'nos serviços contínuos, observado o interregno mínimo de 1 ano: I — reajustamento em sentido estrito, sem dedicação exclusiva de mão de obra; II — repactuação, com dedicação exclusiva ou predominância de mão de obra' },
    { norma: 'Lei 14.133/2021, art. 136, I', texto: 'a variação do valor contratual para fazer face ao reajuste ou à repactuação previstos no contrato registra-se por simples apostila, dispensado termo aditivo' },
    { norma: 'Lei 10.192/2001, art. 2º, § 1º, e art. 3º, § 1º', texto: 'é nula a estipulação de reajuste com periodicidade inferior a um ano; nos contratos administrativos a periodicidade conta da data-limite da proposta ou do orçamento a que ela se referir' },
    { norma: 'Lei 14.133/2021, art. 124, II, "d"', texto: 'o reequilíbrio por fato imprevisível ou de consequências incalculáveis (álea extraordinária) é instituto DISTINTO do reajuste e exige termo aditivo — não se confunde com a recomposição inflacionária ordinária' },
  ];
  if (regime === 'repactuacao') {
    comuns.splice(4, 0, {
      norma: 'Lei 14.133/2021, art. 135, caput e incisos I e II',
      texto: 'a repactuação exige demonstração analítica da variação dos custos, com data vinculada à proposta para os custos de mercado (I) e ao acordo, convenção ou dissídio coletivo para os custos de mão de obra (II)',
    });
    comuns.push({ norma: 'Acórdão TCU 1.563/2004 — Plenário', texto: 'o interregno de um ano da repactuação conta da data da proposta ou da data-base da convenção coletiva que a orçou; a repactuação depende de demonstração analítica, não de índice' });
    comuns.push({ norma: 'IN SEGES/MP 5/2017, art. 57 (União; aplicação por analogia aos demais entes)', texto: 'a repactuação não pedida durante a vigência preclui com a assinatura da prorrogação ou com o encerramento do contrato' });
  } else {
    comuns.push({ norma: 'Parecer AGU 3/2023 e jurisprudência do TCU', texto: 'o reajuste não pedido antes da assinatura de aditivo de prorrogação sem ressalva sujeita-se à preclusão lógica — requerer formalmente antes de prorrogar' });
  }
  return comuns;
}

export function montarEstudo(e: EntradaDoEstudo): Estudo {
  const regime: Estudo['regime'] = e.tipoServico === 'continuado' ? 'repactuacao' : 'reajuste';
  const indice = e.indice.trim().toUpperCase();
  const fator = 1 + e.percentualAplicado / 100;
  const valorReajustado = arredonda(e.valorBase * fator);
  const diferenca = arredonda(valorReajustado - e.valorBase);
  const interregno = dataValida(e.dataBase) && dataValida(e.dataAlvo) ? mesesEntre(e.dataBase, e.dataAlvo) : null;
  const percentualOficial = e.serie ? arredonda(e.serie.percentual) : null;
  const percentualDiverge = percentualOficial !== null && Math.abs(percentualOficial - e.percentualAplicado) >= 0.005;
  const nomeIndice = INDICES_COM_SERIE[indice]?.nome ?? INDICES_SEM_SERIE[indice] ?? indice;
  const fonte = e.serie?.fonte ?? INDICES_COM_SERIE[indice]?.fonte ?? null;

  const alertas: string[] = [];
  if (!(e.valorBase > 0)) alertas.push('Informe o valor sobre o qual o reajuste incide.');
  if (!dataValida(e.dataBase) || !dataValida(e.dataAlvo)) {
    alertas.push('Sem as duas datas não há como aferir o interregno anual (Lei 10.192/2001, art. 2º, § 1º): informe a data-base e a data do aniversário.');
  } else if (interregno !== null && interregno < 12) {
    alertas.push(`Interregno de ${interregno} mês(es) entre ${dataBr(e.dataBase)} e ${dataBr(e.dataAlvo)}: inferior ao mínimo anual, a estipulação é nula (Lei 10.192/2001, art. 2º, § 1º; Lei 14.133/2021, art. 92, § 4º).`);
  }
  if (dataValida(e.dataAlvo) && e.dataAlvo > e.hoje) {
    alertas.push(`A data de incidência (${dataBr(e.dataAlvo)}) ainda não chegou: o resultado é ESTIMATIVA e a série oficial pode não estar completa.`);
  }
  if (e.serie && !e.serie.completo) {
    alertas.push(`Série oficial divulgada até ${e.serie.serie_ate ?? '—'}: fator PARCIAL (${e.serie.meses.length} de ${e.serie.meses_esperados} meses). Refazer após a divulgação.`);
  }
  if (percentualDiverge && percentualOficial !== null) {
    alertas.push(`O percentual aplicado (${pct(e.percentualAplicado)}) diverge do apurado na série oficial (${pct(percentualOficial)}). O requerimento deve usar o oficial ou justificar a diferença por escrito.`);
  }
  if (!e.serie && !temSerieOficial(indice)) {
    alertas.push(`${nomeIndice}: índice sem série no SGS do Banco Central. O percentual foi informado pelo requerente — anexar a tabela ou a convenção de origem com a data de publicação.`);
  }
  if (regime === 'repactuacao' && indice !== 'CCT') {
    alertas.push('Serviço contínuo com mão de obra: o regime é a REPACTUAÇÃO por demonstração analítica (art. 92, § 4º, II; art. 135). O índice geral só recompõe os insumos; a mão de obra segue a convenção coletiva.');
  }
  if (e.baseEhSaldo === false) {
    alertas.push('A base usada é o valor contratual cheio. O reajuste incide sobre o saldo a executar a partir do aniversário — parcelas já pagas não se reajustam.');
  }

  const fundamentacao: string[] = [];
  if (regime === 'reajuste') {
    fundamentacao.push(
      `O reajustamento em sentido estrito recompõe a perda inflacionária ordinária do contrato pela aplicação do índice previsto em cláusula (Lei 14.133/2021, art. 6º, LVIII; art. 25, § 7º; art. 92, § 3º). ` +
      `Para ${NOME_DO_TIPO[e.tipoServico].toLowerCase()}, o critério é o do art. 92, § 4º, I: índice específico ou setorial, sem demonstração analítica de custos.`,
      `A periodicidade é anual, contada da data-base da proposta ou do orçamento a que ela se refere (Lei 10.192/2001, art. 3º, § 1º); estipulação de prazo menor é nula de pleno direito (art. 2º, § 1º). ` +
      (interregno !== null ? `No caso, decorreram ${interregno} meses entre ${dataBr(e.dataBase)} e ${dataBr(e.dataAlvo)}${interregno >= 12 ? ', cumprido o interregno.' : ', interregno NÃO cumprido.'}` : 'As datas não foram informadas.'),
      `A aplicação dá-se por simples apostila (Lei 14.133/2021, art. 136, I), sem termo aditivo, porque a variação está prevista no próprio contrato. Não se trata de reequilíbrio por álea extraordinária (art. 124, II, "d"), que exige fato imprevisível e termo aditivo. ` +
      `Recomenda-se o requerimento formal antes da assinatura de qualquer prorrogação: a prorrogação aceita sem ressalva pode ser lida como renúncia (preclusão lógica).`,
    );
  } else {
    fundamentacao.push(
      `Serviço contínuo com dedicação exclusiva ou predominância de mão de obra submete-se à REPACTUAÇÃO (Lei 14.133/2021, art. 6º, LIX; art. 92, § 4º, II; art. 135): a manutenção do equilíbrio faz-se por demonstração analítica da variação dos custos, com data vinculada à proposta para os custos de mercado e à convenção, acordo ou dissídio coletivo para a mão de obra (art. 135, I e II).`,
      `O interregno mínimo é de um ano (art. 92, § 4º; Lei 10.192/2001, art. 2º, § 1º), contado da data da proposta para os insumos e da data-base da convenção coletiva para a mão de obra (Acórdão TCU 1.563/2004 — Plenário). ` +
      (interregno !== null ? `No caso, decorreram ${interregno} meses entre ${dataBr(e.dataBase)} e ${dataBr(e.dataAlvo)}${interregno >= 12 ? ', cumprido o interregno.' : ', interregno NÃO cumprido.'}` : 'As datas não foram informadas.'),
      `O índice ${indice} usado nesta simulação serve de PARÂMETRO para a parcela de insumos; a parcela de mão de obra exige a planilha de custos repactuada conforme a norma coletiva. A repactuação registra-se por apostila (art. 136, I) e, não requerida na vigência, preclui com a prorrogação ou o encerramento (IN SEGES/MP 5/2017, art. 57, por analogia).`,
    );
  }

  const parecer: string[] = [
    `Fórmula: fator = ∏(1 + i_m/100) para cada competência entre o mês seguinte à data-base e o mês da data de incidência — equivalente à razão dos números-índices I_alvo / I_base. ` +
    (e.serie
      ? `Série ${fonte}: ${e.serie.meses.length} competência(s), fator ${e.serie.fator.toFixed(6).replace('.', ',')}, variação de ${pct(arredonda(e.serie.percentual))}.`
      : `Sem série oficial carregada: aplicado o percentual informado de ${pct(e.percentualAplicado)}.`),
    `Aplicação: ${moeda(e.valorBase)} × ${fator.toFixed(6).replace('.', ',')} = ${moeda(valorReajustado)}; reajuste de ${moeda(diferenca)} (${pct(e.percentualAplicado)}), arredondado a duas casas na parcela final, nunca mês a mês.`,
    e.baseEhSaldo === false
      ? 'A base é o valor contratual: para o requerimento, substituir pelo saldo a executar na data do aniversário, pois parcela já executada e paga não se reajusta.'
      : 'A base considerada é o saldo a executar na data do aniversário, de responsabilidade do requerente.',
  ];
  parecer.push(
    alertas.length === 0
      ? 'Conclusão: pedido juridicamente sustentado e aritmeticamente conferível pela série oficial citada; instruir com a cláusula de reajuste, a data-base e esta memória de cálculo.'
      : `Conclusão: há ${alertas.length} ponto(s) a sanear antes do protocolo (ver alertas). Com eles resolvidos, o pedido é sustentado pela cláusula e pela série oficial.`,
  );

  const contabil: string[] = [
    'Contratada: o reajuste é receita de contrato com cliente (NBC TG 47 / CPC 47) e integra a receita quando o direito se torna executável — o registro da apostila pelo órgão. Antes disso é contraprestação variável ainda não confirmada: não se reconhece receita nem conta a receber; divulga-se em nota explicativa, se relevante (NBC TG 25 / CPC 25, ativo contingente).',
    'Retroativo: as parcelas entre a data do aniversário e o registro da apostila são faturadas em nota própria, citando a apostila e o período, no regime de competência do mês do faturamento; compõem a receita bruta e a base de PIS/COFINS, ISS ou ICMS e IRPJ/CSLL conforme o regime tributário da empresa.',
    'Contratante: a diferença consome dotação do mesmo crédito orçamentário do contrato e exige reforço de empenho antes da liquidação (Lei 4.320/1964, arts. 58 a 63); sem empenho não há pagamento válido.',
    'Controle interno: guardar a série oficial na data da consulta (o SGS pode revisar meses), esta memória de cálculo e a apostila — são as peças que sustentam a receita perante auditoria e fiscalização.',
  ];

  return {
    regime, fator, valorReajustado, diferenca, mesesDeInterregno: interregno,
    percentualOficial, percentualDiverge, alertas, fundamentacao, parecer, contabil,
    referencias: referenciasDoRegime(regime),
  };
}

const escapa = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * O documento: um HTML só para a impressão (PDF pelo navegador) e para o
 * Word, que abre HTML com o namespace do Office como .doc.
 */
export function htmlDoEstudo(e: EntradaDoEstudo, estudo: Estudo, opts: { titulo?: string; imprimirAoAbrir?: boolean; paraWord?: boolean } = {}): string {
  const titulo = opts.titulo ?? `Estudo Técnico — ${estudo.regime === 'repactuacao' ? 'Repactuação' : 'Reajustamento'} de Preços`;
  const indice = e.indice.trim().toUpperCase();
  const identificacao: Array<[string, string]> = [
    ...(e.identificacao ?? []),
    ['Regime', estudo.regime === 'repactuacao' ? 'Repactuação (art. 92, § 4º, II; art. 135)' : 'Reajustamento em sentido estrito (art. 92, § 4º, I; art. 136, I)'],
    ['Tipo de serviço', NOME_DO_TIPO[e.tipoServico]],
    ['Índice', `${indice}${e.serie ? ` (${e.serie.fonte})` : INDICES_COM_SERIE[indice] ? ` (${INDICES_COM_SERIE[indice].fonte})` : ''}`],
    ['Data-base', dataBr(e.dataBase)],
    ['Data de incidência', dataBr(e.dataAlvo)],
    ['Interregno', estudo.mesesDeInterregno === null ? '—' : `${estudo.mesesDeInterregno} mês(es)`],
  ];
  const linhasId = identificacao.map(([k, v]) => `<tr><th>${escapa(k)}</th><td>${escapa(v)}</td></tr>`).join('');
  const linhasSerie = e.serie
    ? e.serie.meses.map((m) => `<tr><td>${escapa(m.competencia)}</td><td class="n">${num(m.variacao)}%</td><td class="n">${m.fator.toFixed(6).replace('.', ',')}</td></tr>`).join('')
    : '';
  const paragrafos = (ps: string[]) => ps.map((p) => `<p>${escapa(p)}</p>`).join('');
  const lista = (ps: string[]) => `<ul>${ps.map((p) => `<li>${escapa(p)}</li>`).join('')}</ul>`;
  const refs = estudo.referencias.map((r) => `<li><b>${escapa(r.norma)}</b> — ${escapa(r.texto)}</li>`).join('');
  const abertura = opts.paraWord
    ? '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="pt-BR">'
    : '<!doctype html><html lang="pt-BR">';
  return `${abertura}<head><meta charset="utf-8">
<title>${escapa(titulo)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#111;max-width:760px;margin:2rem auto;padding:0 1.5rem;font-size:13px;line-height:1.55}
  h1{font-size:16px;text-align:center;text-transform:uppercase;letter-spacing:.04em}
  h2{font-size:13px;text-transform:uppercase;margin-top:1.6em;border-bottom:1px solid #999;padding-bottom:2px}
  table{width:100%;border-collapse:collapse;margin:.6em 0}
  th,td{border:1px solid #bbb;padding:3px 8px;text-align:left;vertical-align:top}
  th{background:#f0f0f0;width:34%} .n{text-align:right;font-variant-numeric:tabular-nums}
  .destaque{border:1px solid #999;background:#f7f7f7;padding:8px 12px;margin:.8em 0}
  .alerta{border:1px solid #c9a227;background:#fff8e1;padding:8px 12px;margin:.8em 0}
  .rodape{margin-top:3em;text-align:center}
  @media print{body{margin:0 auto}}
</style></head><body>
<h1>${escapa(titulo)}</h1>
<h2>1. Identificação</h2>
<table>${linhasId}</table>
<h2>2. Fundamentação jurídica</h2>
${paragrafos(estudo.fundamentacao)}
<h2>3. Memória de cálculo${e.serie ? ` — série oficial ${escapa(e.serie.fonte)}` : ''}</h2>
${e.serie ? `<table><tr><th>Competência</th><th class="n">Variação mensal</th><th class="n">Fator (1 + i)</th></tr>${linhasSerie}</table>` : '<p>Percentual informado pelo requerente; sem série oficial carregada.</p>'}
<div class="destaque">
  <p><b>Fator aplicado:</b> ${estudo.fator.toFixed(6).replace('.', ',')} → variação de <b>${pct(e.percentualAplicado)}</b>${estudo.percentualOficial !== null && estudo.percentualDiverge ? ` (série oficial: ${pct(estudo.percentualOficial)})` : ''}</p>
  <p><b>Base de cálculo:</b> ${moeda(e.valorBase)} · <b>Reajuste:</b> ${moeda(estudo.diferenca)} · <b>Valor reajustado:</b> ${moeda(estudo.valorReajustado)}</p>
</div>
<h2>4. Parecer técnico</h2>
${paragrafos(estudo.parecer)}
${estudo.alertas.length > 0 ? `<div class="alerta"><b>Pontos de atenção</b>${lista(estudo.alertas)}</div>` : ''}
<h2>5. Aspectos contábeis e orçamentários</h2>
${paragrafos(estudo.contabil)}
<h2>6. Referências normativas</h2>
<ul>${refs}</ul>
<h2>7. Fontes</h2>
<p>${e.serie
    ? `Série temporal oficial obtida do Sistema Gerenciador de Séries Temporais (SGS) do Banco Central do Brasil — apuração pelo ${escapa(e.serie.fonte.split('·')[0].trim())}. `
    : ''}Consulta e emissão em ${dataBr(e.hoje)}.</p>
<div class="rodape">
  <p>_________________________________________</p>
  <p>Responsável pelo estudo</p>
</div>
${opts.imprimirAoAbrir ? '<script>window.print()</script>' : ''}
</body></html>`;
}

/** Nome do arquivo: sem acento, sem espaço, com o índice e a data. */
export function nomeDoArquivoDoEstudo(e: EntradaDoEstudo, extensao: 'doc' | 'html'): string {
  const indice = e.indice.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return `Estudo-Reajuste-${indice}-${e.hoje.slice(0, 10)}.${extensao}`;
}
