/**
 * Motor de Cálculo Determinístico — Planilha de Custos e Formação de Preços
 * Conforme IN SEGES/ME nº 5/2017 (Anexo VII-D), Lei 14.133/2021,
 * Acórdãos TCU 1.753/2008 e 786/2006
 */

// ── Round to 2 decimal places (financial rounding) ──
const r2 = (v: number): number => Math.round(v * 100) / 100;

// ── Types ──
export interface CargoInput {
  id: string;
  nome: string;
  jornadaTipo: '44h' | '12x36_diurno' | '12x36_noturno';
  salarioBase: number;
  quantidadePostos: number;
}

export interface ParametrosContrato {
  nrProcesso: string;
  nrContratacao: string;
  orgao: string;
  descricaoServico: string;
  unidadeMedida: string;
  dataProposta: string;
  municipioUf: string;
  convencaoColetiva: string;
  nrRegistroCCT: string;
  vigenciaCCT: string;
  vigenciaMeses: number;
}

export interface ParametrosModulo1 {
  gratificacaoPerc: number; // % sobre salário
  adicPericulosidadePerc: number; // 30% (NR-16) ou 0
  adicInsalubridadePerc: number; // 10/20/40% (NR-15)
  baseInsalubridade: 'salario_base' | 'salario_minimo';
  salarioMinimo: number;
  adicNoturnoPerc: number; // mín 20% (Art.73 CLT)
  proporcaoNoturna: number; // ex: 7/12 para 12x36 noturno
  horaNReduzidaProporcao: number; // ex: 1/12
  adicGenericoPerc: number; // "Adicional XXX"
  adicGenericoBase: number; // base fixa ou 0 p/ usar salário
}

export interface ParametrosModulo2_1 {
  decimoTerceiroPerc: number; // 8.33
  feriasPerc: number; // 8.33
  adicionalFeriasPerc: number; // 2.78 (1/3 de férias)
}

export interface ParametrosModulo2_2 {
  inssPatronal: number; // 20
  salarioEducacao: number; // 2.5
  satRatFap: number; // 1-3
  sescSesi: number; // 1.5
  senacSenai: number; // 1.0
  sebrae: number; // 0.6
  incra: number; // 0.2
  fgts: number; // 8
}

export interface BeneficioItem {
  id: string;
  descricao: string;
  valorBruto: number;
  descontoEmpregado: number; // absolute R$
  referencia: string;
}

export interface ParametrosModulo3 {
  avisoPrevioIndenizadoPerc: number; // 0.42
  avisoPrevioTrabalhadoPerc: number; // 1.94
  multaFGTSPerc: number; // 40
}

export interface ParametrosModulo4 {
  feriasPerc: number; // 8.33
  ausenciasLegaisPerc: number; // ex 2.96
  licencaPaternidadePerc: number; // 0.02
  acidenteTrabalhoPerc: number; // 0.03
  afastamentoMaternidadePerc: number; // 0
  outrosPerc: number;
  intrajornadaValor: number; // valor do substituto
}

export interface InsumoItem {
  id: string;
  descricao: string;
  valorMensal: number;
  detalhes: string;
}

export interface ParametrosModulo6 {
  custosIndiretosPerc: number; // 5
  lucroPerc: number; // 10
  pisPerc: number;
  cofinsPerc: number;
  issPerc: number;
}

export interface MDOInputs {
  cargo: CargoInput;
  contrato: ParametrosContrato;
  mod1: ParametrosModulo1;
  mod2_1: ParametrosModulo2_1;
  mod2_2: ParametrosModulo2_2;
  beneficios: BeneficioItem[];
  mod3: ParametrosModulo3;
  mod4: ParametrosModulo4;
  insumos: InsumoItem[];
  mod6: ParametrosModulo6;
  regimeLabel: string;
}

// ── Line item for display ──
export interface LineItem {
  id: string;
  descricao: string;
  percentual?: number;
  valor: number;
  referencia?: string;
  formula?: string; // audit trail
}

export interface SubModuloResult {
  titulo: string;
  itens: LineItem[];
  subtotal: number;
  nota?: string;
}

export interface ModuloResult {
  titulo: string;
  submodulos?: Record<string, SubModuloResult>;
  itens?: LineItem[];
  subtotal: number;
  nota?: string;
}

export interface QuadroResumo {
  modulo1: number;
  modulo2: number;
  modulo3: number;
  modulo4: number;
  modulo5: number;
  subtotalMod1a5: number;
  modulo6: number;
  valorMensalEmpregado: number;
  qtdProfissionais: number;
  valorMensalTotal: number;
  valorAnualTotal: number;
  valorContratoTotal: number;
  vigenciaMeses: number;
}

export interface Parecer {
  viabilidade: 'VIÁVEL' | 'ATENÇÃO' | 'INVIÁVEL';
  margemLiquida: number;
  alertaInexequibilidade: boolean;
  observacoes: string;
  fundamentacaoLegal: string[];
}

export interface MDOResult {
  modulo1: ModuloResult;
  modulo2: ModuloResult;
  modulo3: ModuloResult;
  modulo4: ModuloResult;
  modulo5: ModuloResult;
  modulo6: ModuloResult;
  quadroResumo: QuadroResumo;
  parecer: Parecer;
}

// ═══════════════════════════════════════════════
// CALCULATION ENGINE
// ═══════════════════════════════════════════════
export function calcularMDO(inputs: MDOInputs): MDOResult {
  const { cargo, mod1, mod2_1, mod2_2, beneficios, mod3, mod4, insumos, mod6, contrato } = inputs;
  const sal = cargo.salarioBase;

  // ── MÓDULO 1 — REMUNERAÇÃO ──
  const gratificacao = r2(sal * (mod1.gratificacaoPerc / 100));
  
  const basePericulosidade = sal;
  const adicPericulosidade = r2(basePericulosidade * (mod1.adicPericulosidadePerc / 100));
  
  const baseInsalubridade = mod1.baseInsalubridade === 'salario_minimo' ? mod1.salarioMinimo : sal;
  const adicInsalubridade = r2(baseInsalubridade * (mod1.adicInsalubridadePerc / 100));
  
  const adicNoturno = r2(sal * mod1.proporcaoNoturna * (mod1.adicNoturnoPerc / 100));
  
  const horaNReduzida = r2(sal * mod1.horaNReduzidaProporcao * (1 + mod1.adicNoturnoPerc / 100));
  
  const baseGenerico = mod1.adicGenericoBase > 0 ? mod1.adicGenericoBase : sal;
  const adicGenerico = r2(baseGenerico * (mod1.adicGenericoPerc / 100));

  const itensM1: LineItem[] = [
    { id: '1A', descricao: 'Salário-base', valor: sal, referencia: 'Piso CCT', formula: `Salário base = R$ ${sal.toFixed(2)}` },
    { id: '1B', descricao: 'Gratificação de Função', percentual: mod1.gratificacaoPerc, valor: gratificacao, referencia: 'CCT', formula: `${sal.toFixed(2)} × ${mod1.gratificacaoPerc}%` },
    { id: '1C', descricao: 'Adicional de Periculosidade', percentual: mod1.adicPericulosidadePerc, valor: adicPericulosidade, referencia: 'Art. 193, CLT / NR-16', formula: `${basePericulosidade.toFixed(2)} × ${mod1.adicPericulosidadePerc}%` },
    { id: '1D', descricao: 'Adicional de Insalubridade', percentual: mod1.adicInsalubridadePerc, valor: adicInsalubridade, referencia: 'Art. 192, CLT / NR-15', formula: `${baseInsalubridade.toFixed(2)} × ${mod1.adicInsalubridadePerc}%` },
    { id: '1E', descricao: 'Adicional Noturno', percentual: mod1.adicNoturnoPerc, valor: adicNoturno, referencia: 'Art. 73, CLT', formula: `${sal.toFixed(2)} × ${mod1.proporcaoNoturna.toFixed(4)} × ${mod1.adicNoturnoPerc}%` },
    { id: '1F', descricao: 'Hora Noturna Reduzida', valor: horaNReduzida, referencia: 'Art. 73, §1º, CLT', formula: `${sal.toFixed(2)} × ${mod1.horaNReduzidaProporcao.toFixed(4)} × (1 + ${mod1.adicNoturnoPerc}%)` },
    { id: '1G', descricao: 'Adicional Genérico (XXX)', percentual: mod1.adicGenericoPerc, valor: adicGenerico, formula: `${baseGenerico.toFixed(2)} × ${mod1.adicGenericoPerc}%` },
  ];
  const totalM1 = r2(itensM1.reduce((s, i) => s + i.valor, 0));

  // ── MÓDULO 2 ──
  // Submódulo 2.1 — 13º, Férias, Adicional de Férias
  const val13 = r2(totalM1 * (mod2_1.decimoTerceiroPerc / 100));
  const valFerias = r2(totalM1 * (mod2_1.feriasPerc / 100));
  const valAdicFerias = r2(totalM1 * (mod2_1.adicionalFeriasPerc / 100));
  const itens2_1: LineItem[] = [
    { id: '2.1A', descricao: '13º Salário', percentual: mod2_1.decimoTerceiroPerc, valor: val13, referencia: 'Art. 7º, VIII, CF', formula: `${totalM1.toFixed(2)} × ${mod2_1.decimoTerceiroPerc}%` },
    { id: '2.1B', descricao: 'Férias', percentual: mod2_1.feriasPerc, valor: valFerias, referencia: 'Art. 7º, XVII, CF', formula: `${totalM1.toFixed(2)} × ${mod2_1.feriasPerc}%` },
    { id: '2.1C', descricao: 'Adicional de Férias (1/3)', percentual: mod2_1.adicionalFeriasPerc, valor: valAdicFerias, referencia: 'Art. 7º, XVII, CF', formula: `${totalM1.toFixed(2)} × ${mod2_1.adicionalFeriasPerc}%` },
  ];
  const subtotal2_1 = r2(val13 + valFerias + valAdicFerias);

  // Submódulo 2.2 — Encargos Previdenciários e FGTS
  // Base: Módulo 1 + Submódulo 2.1 (Acórdão TCU 1.753/2008)
  const base2_2 = r2(totalM1 + subtotal2_1);
  const encargos2_2 = [
    { id: '2.2A', descricao: 'INSS Patronal', percentual: mod2_2.inssPatronal, referencia: 'Art. 22, Lei 8.212/91' },
    { id: '2.2B', descricao: 'Salário-Educação', percentual: mod2_2.salarioEducacao, referencia: 'Art. 3º, Lei 9.424/96' },
    { id: '2.2C', descricao: 'SAT/RAT × FAP', percentual: mod2_2.satRatFap, referencia: 'Art. 22, Lei 8.212/91' },
    { id: '2.2D', descricao: 'SESC ou SESI', percentual: mod2_2.sescSesi, referencia: 'Art. 3º, DL 9.853/46' },
    { id: '2.2E', descricao: 'SENAC ou SENAI', percentual: mod2_2.senacSenai, referencia: 'Art. 4º, DL 8.621/46' },
    { id: '2.2F', descricao: 'SEBRAE', percentual: mod2_2.sebrae, referencia: 'Art. 8º, Lei 8.029/90' },
    { id: '2.2G', descricao: 'INCRA', percentual: mod2_2.incra, referencia: 'Art. 1º, DL 1.146/70' },
    { id: '2.2H', descricao: 'FGTS', percentual: mod2_2.fgts, referencia: 'Art. 15, Lei 8.036/90' },
  ];
  const itens2_2: LineItem[] = encargos2_2.map(e => ({
    ...e, valor: r2(base2_2 * (e.percentual / 100)),
    formula: `${base2_2.toFixed(2)} × ${e.percentual}%`
  }));
  const subtotal2_2 = r2(itens2_2.reduce((s, i) => s + i.valor, 0));
  const perc2_2Total = encargos2_2.reduce((s, e) => s + e.percentual, 0);

  // Submódulo 2.3 — Benefícios
  const itens2_3: LineItem[] = beneficios.map(b => ({
    id: b.id, descricao: b.descricao,
    valor: r2(b.valorBruto - b.descontoEmpregado),
    referencia: b.referencia,
    formula: b.descontoEmpregado > 0
      ? `${b.valorBruto.toFixed(2)} - ${b.descontoEmpregado.toFixed(2)} (desc. empregado)`
      : `R$ ${b.valorBruto.toFixed(2)}`
  }));
  const subtotal2_3 = r2(itens2_3.reduce((s, i) => s + i.valor, 0));
  const totalM2 = r2(subtotal2_1 + subtotal2_2 + subtotal2_3);

  // ── MÓDULO 3 — PROVISÃO PARA RESCISÃO ──
  const baseRescisao = totalM1;
  const avisoIndVal = r2(baseRescisao * (mod3.avisoPrevioIndenizadoPerc / 100));
  const fgtsAvisoInd = r2(avisoIndVal * (mod2_2.fgts / 100));
  const multaFGTSAvisoInd = r2(avisoIndVal * (mod2_2.fgts / 100) * (mod3.multaFGTSPerc / 100));
  const avisoTrabVal = r2(baseRescisao * (mod3.avisoPrevioTrabalhadoPerc / 100));
  const incidencia2_2AvisoTrab = r2(avisoTrabVal * (perc2_2Total / 100));
  const multaFGTSAvisoTrab = r2(avisoTrabVal * (mod2_2.fgts / 100) * (mod3.multaFGTSPerc / 100));

  const itensM3: LineItem[] = [
    { id: '3A', descricao: 'Aviso Prévio Indenizado', percentual: mod3.avisoPrevioIndenizadoPerc, valor: avisoIndVal, referencia: 'Art. 7º, XXI, CF', formula: `${baseRescisao.toFixed(2)} × ${mod3.avisoPrevioIndenizadoPerc}%` },
    { id: '3B', descricao: 'Incidência FGTS sobre Aviso Prévio Indenizado', valor: fgtsAvisoInd, formula: `${avisoIndVal.toFixed(2)} × ${mod2_2.fgts}%` },
    { id: '3C', descricao: 'Multa FGTS + Contrib. Social s/ Aviso Prévio Indenizado', percentual: mod3.multaFGTSPerc, valor: multaFGTSAvisoInd, referencia: 'Art. 18, Lei 8.036/90', formula: `${avisoIndVal.toFixed(2)} × ${mod2_2.fgts}% × ${mod3.multaFGTSPerc}%` },
    { id: '3D', descricao: 'Aviso Prévio Trabalhado', percentual: mod3.avisoPrevioTrabalhadoPerc, valor: avisoTrabVal, referencia: 'Art. 487, CLT', formula: `${baseRescisao.toFixed(2)} × ${mod3.avisoPrevioTrabalhadoPerc}%` },
    { id: '3E', descricao: 'Incidência Submódulo 2.2 s/ Aviso Prévio Trabalhado', valor: incidencia2_2AvisoTrab, formula: `${avisoTrabVal.toFixed(2)} × ${perc2_2Total.toFixed(2)}%` },
    { id: '3F', descricao: 'Multa FGTS + Contrib. Social s/ Aviso Prévio Trabalhado', valor: multaFGTSAvisoTrab, formula: `${avisoTrabVal.toFixed(2)} × ${mod2_2.fgts}% × ${mod3.multaFGTSPerc}%` },
  ];
  const totalM3 = r2(itensM3.reduce((s, i) => s + i.valor, 0));

  // ── MÓDULO 4 — CUSTO DE REPOSIÇÃO ──
  // Base: Módulo 1 + Submódulo 2.1 (custo diário)
  const custoReposBase = r2(totalM1 + subtotal2_1);
  
  const itens4_1: LineItem[] = [
    { id: '4.1A', descricao: 'Férias', percentual: mod4.feriasPerc, valor: r2(custoReposBase * (mod4.feriasPerc / 100)), formula: `${custoReposBase.toFixed(2)} × ${mod4.feriasPerc}%` },
    { id: '4.1B', descricao: 'Ausências Legais (Art. 473, CLT)', percentual: mod4.ausenciasLegaisPerc, valor: r2(custoReposBase * (mod4.ausenciasLegaisPerc / 100)), formula: `${custoReposBase.toFixed(2)} × ${mod4.ausenciasLegaisPerc}%` },
    { id: '4.1C', descricao: 'Licença-Paternidade', percentual: mod4.licencaPaternidadePerc, valor: r2(custoReposBase * (mod4.licencaPaternidadePerc / 100)), formula: `${custoReposBase.toFixed(2)} × ${mod4.licencaPaternidadePerc}%` },
    { id: '4.1D', descricao: 'Ausência por Acidente de Trabalho', percentual: mod4.acidenteTrabalhoPerc, valor: r2(custoReposBase * (mod4.acidenteTrabalhoPerc / 100)), formula: `${custoReposBase.toFixed(2)} × ${mod4.acidenteTrabalhoPerc}%` },
    { id: '4.1E', descricao: 'Afastamento Maternidade', percentual: mod4.afastamentoMaternidadePerc, valor: r2(custoReposBase * (mod4.afastamentoMaternidadePerc / 100)), formula: `${custoReposBase.toFixed(2)} × ${mod4.afastamentoMaternidadePerc}%` },
    { id: '4.1F', descricao: 'Outros (especificar)', percentual: mod4.outrosPerc, valor: r2(custoReposBase * (mod4.outrosPerc / 100)), formula: `${custoReposBase.toFixed(2)} × ${mod4.outrosPerc}%` },
  ];
  const subtotal4_1 = r2(itens4_1.reduce((s, i) => s + i.valor, 0));

  const itens4_2: LineItem[] = [
    { id: '4.2A', descricao: 'Substituto na cobertura de intervalo para repouso e alimentação', valor: mod4.intrajornadaValor, formula: `Valor fixo R$ ${mod4.intrajornadaValor.toFixed(2)}` },
  ];
  const subtotal4_2 = r2(itens4_2.reduce((s, i) => s + i.valor, 0));
  
  // Incidência do Submódulo 2.2 sobre custo de reposição
  const incidencia2_2Repos = r2((subtotal4_1 + subtotal4_2) * (perc2_2Total / 100));
  const totalM4 = r2(subtotal4_1 + subtotal4_2 + incidencia2_2Repos);

  // ── MÓDULO 5 — INSUMOS ──
  const itensM5: LineItem[] = insumos.map(ins => ({
    id: ins.id, descricao: ins.descricao, valor: ins.valorMensal,
    formula: `R$ ${ins.valorMensal.toFixed(2)}/mês${ins.detalhes ? ` (${ins.detalhes})` : ''}`
  }));
  const totalM5 = r2(itensM5.reduce((s, i) => s + i.valor, 0));

  // ── MÓDULO 6 — CUSTOS INDIRETOS, TRIBUTOS E LUCRO ──
  const subtotalMod1a5 = r2(totalM1 + totalM2 + totalM3 + totalM4 + totalM5);
  
  // 6.1 — Custos Indiretos e Lucro (sobre subtotal 1-5)
  const custoIndireto = r2(subtotalMod1a5 * (mod6.custosIndiretosPerc / 100));
  const lucro = r2(subtotalMod1a5 * (mod6.lucroPerc / 100));
  const subtotal6_1 = r2(custoIndireto + lucro);

  // 6.2 — Tributos "por dentro"
  const baseTributos = r2(subtotalMod1a5 + subtotal6_1);
  const somaTribPerc = mod6.pisPerc + mod6.cofinsPerc + mod6.issPerc;
  // Cálculo "por dentro": tributos = base / (1 - soma%) - base
  const fatorPorDentro = somaTribPerc > 0 ? (1 / (1 - somaTribPerc / 100)) : 1;
  const totalTributos = r2(baseTributos * fatorPorDentro - baseTributos);
  
  // Distribuir proporcionalmente
  const pisProporcao = somaTribPerc > 0 ? mod6.pisPerc / somaTribPerc : 0;
  const cofinsProporcao = somaTribPerc > 0 ? mod6.cofinsPerc / somaTribPerc : 0;
  const issProporcao = somaTribPerc > 0 ? mod6.issPerc / somaTribPerc : 0;
  
  const pisVal = r2(totalTributos * pisProporcao);
  const cofinsVal = r2(totalTributos * cofinsProporcao);
  const issVal = r2(totalTributos * issProporcao);
  const subtotal6_2 = r2(pisVal + cofinsVal + issVal);
  const totalM6 = r2(subtotal6_1 + subtotal6_2);

  // ── QUADRO RESUMO ──
  const valorMensalEmpregado = r2(subtotalMod1a5 + totalM6);
  const qtd = cargo.quantidadePostos;
  const valorMensalTotal = r2(valorMensalEmpregado * qtd);
  const vigencia = contrato.vigenciaMeses || 12;
  const valorAnualTotal = r2(valorMensalTotal * 12);
  const valorContratoTotal = r2(valorMensalTotal * vigencia);

  const quadroResumo: QuadroResumo = {
    modulo1: totalM1, modulo2: totalM2, modulo3: totalM3,
    modulo4: totalM4, modulo5: totalM5,
    subtotalMod1a5: subtotalMod1a5, modulo6: totalM6,
    valorMensalEmpregado, qtdProfissionais: qtd,
    valorMensalTotal, valorAnualTotal, valorContratoTotal, vigenciaMeses: vigencia,
  };

  // ── PARECER ──
  const margemLiq = subtotalMod1a5 > 0 ? (lucro / valorMensalEmpregado) * 100 : 0;
  const alerta = margemLiq < 5;
  const parecer: Parecer = {
    viabilidade: alerta ? 'ATENÇÃO' : 'VIÁVEL',
    margemLiquida: r2(margemLiq),
    alertaInexequibilidade: alerta,
    observacoes: alerta
      ? `Margem líquida de ${margemLiq.toFixed(2)}% está abaixo de 5%. Risco de inexequibilidade conforme Art. 59, §4º, Lei 14.133/21.`
      : `Margem líquida de ${margemLiq.toFixed(2)}%. Precificação dentro dos parâmetros de viabilidade.`,
    fundamentacaoLegal: ['Lei 14.133/21, Art. 59, §4º', 'IN SEGES/ME nº 5/2017', 'Acórdão TCU 1.753/2008'],
  };

  return {
    modulo1: {
      titulo: 'Módulo 1 – Composição da Remuneração',
      itens: itensM1,
      subtotal: totalM1,
    },
    modulo2: {
      titulo: 'Módulo 2 – Encargos e Benefícios Anuais, Mensais e Diários',
      submodulos: {
        '2.1': { titulo: 'Submódulo 2.1 – 13º Salário, Férias e Adicional de Férias', itens: itens2_1, subtotal: subtotal2_1, nota: `Base: Módulo 1 = R$ ${totalM1.toFixed(2)}` },
        '2.2': { titulo: 'Submódulo 2.2 – Encargos Previdenciários (GPS), FGTS e Outras Contrib.', itens: itens2_2, subtotal: subtotal2_2, nota: `Base: Módulo 1 + Sub 2.1 = R$ ${base2_2.toFixed(2)} (Acórdão TCU 1.753/2008)` },
        '2.3': { titulo: 'Submódulo 2.3 – Benefícios Mensais e Diários', itens: itens2_3, subtotal: subtotal2_3 },
      },
      subtotal: totalM2,
    },
    modulo3: {
      titulo: 'Módulo 3 – Provisão para Rescisão',
      itens: itensM3,
      subtotal: totalM3,
      nota: `Base: Módulo 1 = R$ ${baseRescisao.toFixed(2)}`,
    },
    modulo4: {
      titulo: 'Módulo 4 – Custo de Reposição do Profissional Ausente',
      submodulos: {
        '4.1': { titulo: 'Submódulo 4.1 – Ausências Legais', itens: itens4_1, subtotal: subtotal4_1 },
        '4.2': { titulo: 'Submódulo 4.2 – Intrajornada', itens: itens4_2, subtotal: subtotal4_2 },
      },
      itens: [
        { id: '4.X', descricao: 'Incidência Submódulo 2.2 sobre custo de reposição', percentual: r2(perc2_2Total), valor: incidencia2_2Repos, formula: `(${subtotal4_1.toFixed(2)} + ${subtotal4_2.toFixed(2)}) × ${perc2_2Total.toFixed(2)}%` },
      ],
      subtotal: totalM4,
      nota: `Base reposição: R$ ${custoReposBase.toFixed(2)} (Mod1 + Sub2.1)`,
    },
    modulo5: {
      titulo: 'Módulo 5 – Insumos Diversos',
      itens: itensM5,
      subtotal: totalM5,
    },
    modulo6: {
      titulo: 'Módulo 6 – Custos Indiretos, Tributos e Lucro',
      submodulos: {
        '6.1': {
          titulo: 'Submódulo 6.1 – Custos Indiretos e Lucro',
          itens: [
            { id: '6.1A', descricao: 'Custos Indiretos', percentual: mod6.custosIndiretosPerc, valor: custoIndireto, formula: `${subtotalMod1a5.toFixed(2)} × ${mod6.custosIndiretosPerc}%` },
            { id: '6.1B', descricao: 'Lucro', percentual: mod6.lucroPerc, valor: lucro, formula: `${subtotalMod1a5.toFixed(2)} × ${mod6.lucroPerc}%` },
          ],
          subtotal: subtotal6_1,
        },
        '6.2': {
          titulo: 'Submódulo 6.2 – Tributos',
          itens: [
            { id: '6.2A', descricao: 'PIS', percentual: mod6.pisPerc, valor: pisVal, formula: `Cálculo "por dentro": base R$ ${baseTributos.toFixed(2)}` },
            { id: '6.2B', descricao: 'COFINS', percentual: mod6.cofinsPerc, valor: cofinsVal, formula: `Cálculo "por dentro": base R$ ${baseTributos.toFixed(2)}` },
            { id: '6.2C', descricao: 'ISS', percentual: mod6.issPerc, valor: issVal, referencia: 'LC 116/2003', formula: `Cálculo "por dentro": base R$ ${baseTributos.toFixed(2)}` },
          ],
          subtotal: subtotal6_2,
          nota: `Regime: ${inputs.regimeLabel}. Tributos calculados "por dentro" (base ÷ (1 - ${somaTribPerc.toFixed(2)}%))`,
        },
      },
      subtotal: totalM6,
    },
    quadroResumo,
    parecer,
  };
}

// ── Default parameter presets ──
export function getDefaultMod2_1(): ParametrosModulo2_1 {
  return { decimoTerceiroPerc: 8.33, feriasPerc: 8.33, adicionalFeriasPerc: 2.78 };
}

export function getDefaultMod2_2(): ParametrosModulo2_2 {
  return {
    inssPatronal: 20, salarioEducacao: 2.5, satRatFap: 3,
    sescSesi: 1.5, senacSenai: 1, sebrae: 0.6, incra: 0.2, fgts: 8,
  };
}

export function getDefaultMod3(): ParametrosModulo3 {
  return { avisoPrevioIndenizadoPerc: 0.42, avisoPrevioTrabalhadoPerc: 1.94, multaFGTSPerc: 40 };
}

export function getDefaultMod4(): ParametrosModulo4 {
  return {
    feriasPerc: 8.33, ausenciasLegaisPerc: 2.96,
    licencaPaternidadePerc: 0.02, acidenteTrabalhoPerc: 0.03,
    afastamentoMaternidadePerc: 0, outrosPerc: 0, intrajornadaValor: 0,
  };
}

export function getDefaultBeneficios(salarioBase: number, vtBruto: number, vaBruto: number): BeneficioItem[] {
  const descVT = Math.min(salarioBase * 0.06, vtBruto);
  return [
    { id: '2.3A', descricao: 'Vale-Transporte', valorBruto: vtBruto, descontoEmpregado: descVT, referencia: 'Lei 7.418/85' },
    { id: '2.3B', descricao: 'Vale-Alimentação/Refeição', valorBruto: vaBruto, descontoEmpregado: 0, referencia: 'PAT – Lei 6.321/76' },
    { id: '2.3C', descricao: 'Assistência Médica e Familiar', valorBruto: 0, descontoEmpregado: 0, referencia: 'CCT' },
    { id: '2.3D', descricao: 'Seguro de Vida, Invalidez e Funeral', valorBruto: 0, descontoEmpregado: 0, referencia: 'CCT' },
    { id: '2.3E', descricao: 'Auxílio-Creche', valorBruto: 0, descontoEmpregado: 0, referencia: 'Art. 389, CLT' },
  ];
}
