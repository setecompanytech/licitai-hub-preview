/**
 * Modelos do Apoio Contábil (28/09/2026) — o que cada um é, em que norma se
 * apoia (conferida contra o texto oficial) e o roteiro que a IA segue e que
 * "Baixar"/"Copiar" entregam. Puro: a tela só chama.
 *
 * Correções feitas em 28/09 contra o Planalto: Composição de Custos citava o
 * art. 58 (garantia de proposta) — é o art. 23; Encargos citava a IN 65/2021
 * (pesquisa de preços) — é a IN 5/2017, Anexo VII-D; o piso de 75% do art.
 * 59, § 4º, vale só para obras e engenharia.
 */
export type ModeloContabil = {
  id: string;
  titulo: string;
  categoria: 'Precificação' | 'Pareceres' | 'Habilitação' | 'Tributário';
  descricao: string;
  /** Rótulo curto que vai no selo e a URL do texto oficial. */
  fundamentacao: string;
  fundamentacaoUrl: string;
  /** Tipo de análise do Gerador IA que este modelo aciona. */
  tipoGerador: string;
  /** Seções que a peça deve ter, na ordem. */
  roteiro: string[];
};

const PLANALTO_14133 = 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';
const IN5 = 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada';
const IN65 = 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-65-de-7-de-julho-de-2021';
const TCU_2622 = 'https://pesquisa.apps.tcu.gov.br/pesquisa/acordao-completo?termo=NUMACORDAO%3A2622%20ANOACORDAO%3A2013%20COLEGIADO%3A%22Plen%C3%A1rio%22';
const LC123 = 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm';
const CFC = 'https://www.cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/';

export const MODELOS_CONTABEIS: ModeloContabil[] = [
  {
    id: '1', titulo: 'Composição de Custos Unitários', categoria: 'Precificação',
    descricao: 'Planilha analítica de custos e formação de preço unitário para a proposta',
    fundamentacao: 'Art. 23, Lei 14.133/2021 · IN SEGES/ME 65/2021', fundamentacaoUrl: `${PLANALTO_14133}#art23`,
    tipoGerador: 'Composição de Custos / BDI',
    roteiro: ['Objeto, item e unidade de medida', 'Insumos e custo direto (material, mão de obra, equipamentos) com fonte de cada preço', 'Encargos sociais e trabalhistas (IN 5/2017, Anexo VII-D, quando houver mão de obra)', 'Custos indiretos, tributos e lucro (BDI ou taxa de administração)', 'Preço unitário e comparação com o estimado do edital (art. 23)', 'Memória de cálculo e premissas a confirmar'],
  },
  {
    id: '2', titulo: 'Cálculo de BDI', categoria: 'Precificação',
    descricao: 'Bonificação e Despesas Indiretas nas faixas do Acórdão TCU 2.622/2013-Plenário',
    fundamentacao: 'Acórdão TCU 2.622/2013-Plenário', fundamentacaoUrl: TCU_2622,
    tipoGerador: 'Composição de Custos / BDI',
    roteiro: ['Tipo de obra ou serviço e faixa de referência do acórdão', 'Administração central, seguro e garantia, risco, despesas financeiras, lucro', 'Tributos sobre o faturamento (PIS, COFINS, ISS ou CPRB) — IRPJ e CSLL ficam fora', 'Fórmula do BDI e resultado, comparado ao primeiro quartil, mediana e terceiro quartil', 'Justificativa de cada parcela e premissas a confirmar'],
  },
  {
    id: '3', titulo: 'Análise de Inexequibilidade', categoria: 'Precificação',
    descricao: 'Exequibilidade da proposta: art. 59, III e IV, com diligência do § 2º; piso de 75% só em obras e engenharia (§ 4º)',
    fundamentacao: 'Art. 59, Lei 14.133/2021', fundamentacaoUrl: `${PLANALTO_14133}#art59`,
    tipoGerador: 'Cálculo de Inexequibilidade (Art. 59)',
    roteiro: ['Objeto e natureza (obra/engenharia ou bens/serviços) — define se o § 4º se aplica', 'Preço proposto × orçamento estimado da Administração', 'Composição que demonstra a exequibilidade (custos, encargos, tributos, margem)', 'Contratos anteriores executados a preço semelhante, quando houver', 'Conclusão e documentos para a diligência do § 2º'],
  },
  {
    id: '4', titulo: 'Parecer de Viabilidade Econômica', categoria: 'Pareceres',
    descricao: 'Viabilidade econômico-financeira de participar e executar a contratação',
    fundamentacao: 'Art. 18, Lei 14.133/2021', fundamentacaoUrl: `${PLANALTO_14133}#art18`,
    tipoGerador: 'Parecer Contábil',
    roteiro: ['Objeto, prazo, valor estimado e forma de pagamento', 'Custos de execução e capital de giro necessário até o primeiro pagamento', 'Margem esperada e ponto de equilíbrio', 'Riscos (atraso de pagamento, reajuste, glosas) e mitigação', 'Conclusão: participar, com que preço mínimo'],
  },
  {
    id: '5', titulo: 'Demonstrativo de Encargos Sociais', categoria: 'Precificação',
    descricao: 'Encargos sociais e trabalhistas da planilha de custos de serviços com mão de obra',
    fundamentacao: 'IN SEGES/MP 5/2017, Anexo VII-D', fundamentacaoUrl: IN5,
    tipoGerador: 'Composição de Custos / BDI',
    roteiro: ['Categoria profissional, CCT aplicável e salário-base', 'Módulo 1 — remuneração; Módulo 2 — encargos e benefícios (13º, férias, adicional, submódulo 2.2 GPS/FGTS/outras contribuições, benefícios da CCT)', 'Módulo 3 — provisão para rescisão; Módulo 4 — reposição do profissional ausente', 'Módulo 5 — custos indiretos, tributos e lucro', 'Total por empregado e por posto; premissas a confirmar (regime tributário, RAT/FAP)'],
  },
  {
    id: '6', titulo: 'Parecer sobre Reequilíbrio Financeiro', categoria: 'Pareceres',
    descricao: 'Fundamentação contábil do pedido de reequilíbrio por fato imprevisível ou de consequências incalculáveis',
    fundamentacao: 'Art. 124, II, "d", Lei 14.133/2021', fundamentacaoUrl: `${PLANALTO_14133}#art124`,
    tipoGerador: 'Parecer Contábil',
    roteiro: ['Contrato, item e preço contratado (lido do sistema)', 'Fato gerador, data e prova (índice, cotação, norma) — e por que não é reajuste (art. 92, § 3º) nem repactuação (art. 135)', 'Custo na proposta × custo atual, item a item, com fonte de cada número', 'Impacto no saldo do contrato e novo preço pedido', 'Conclusão e documentos que instruem o pedido'],
  },
  {
    id: '7', titulo: 'Análise de Qualificação Econômico-Financeira', categoria: 'Habilitação',
    descricao: 'Índices de liquidez, solvência e endividamento do balanço, contra o que o edital pode exigir',
    fundamentacao: 'Art. 69, Lei 14.133/2021', fundamentacaoUrl: `${PLANALTO_14133}#art69`,
    tipoGerador: 'Análise de Balanço Patrimonial',
    roteiro: ['Balanço e DRE do último exercício (art. 69, I) — ou do único, se constituída há menos de 2 anos (§ 6º)', 'Liquidez Geral, Liquidez Corrente e Solvência Geral, com a fórmula e os saldos usados', 'Endividamento e capital circulante líquido', 'Patrimônio líquido ou capital mínimo até 10% do valor estimado (§ 4º); relação de compromissos (§ 3º)', 'Vedações: faturamento mínimo e índice de lucratividade (§ 2º)', 'Conclusão: atende ao edital? o que falta?'],
  },
  {
    id: '8', titulo: 'Memorial de Cálculo Tributário', categoria: 'Tributário',
    descricao: 'Tributos incidentes na contratação, por regime (Simples Nacional, presumido, real)',
    fundamentacao: 'LC 123/2006, art. 18', fundamentacaoUrl: `${LC123}#art18`,
    tipoGerador: 'Análise Tributária',
    roteiro: ['Regime tributário, anexo do Simples e Fator R (LC 123, art. 18)', 'Alíquota efetiva pela receita bruta dos últimos 12 meses', 'Retenções na fonte pelo órgão (IR, CSLL, PIS, COFINS, INSS, ISS) e como afetam o caixa', 'Carga tributária sobre o preço proposto, com memória de cálculo', 'Premissas a confirmar'],
  },
  {
    id: '9', titulo: 'Certidão de Regularidade Fiscal', categoria: 'Habilitação',
    descricao: 'Checklist das certidões fiscais, sociais e trabalhistas da habilitação',
    fundamentacao: 'Art. 68, Lei 14.133/2021', fundamentacaoUrl: `${PLANALTO_14133}#art68`,
    tipoGerador: 'Verificação de Conformidade NBC',
    roteiro: ['CNPJ e inscrição estadual/municipal (art. 68, I e II)', 'Regularidade federal (RFB/PGFN), estadual e municipal (III)', 'Seguridade Social e FGTS (IV)', 'Trabalhista — CNDT (V) e menor aprendiz (VI)', 'Validade de cada certidão e o que vence antes da sessão'],
  },
  {
    id: '10', titulo: 'Análise de Fluxo de Caixa Projetado', categoria: 'Pareceres',
    descricao: 'Fluxo de caixa da execução contratual: desembolsos, faturamento, prazo de pagamento e retenções',
    fundamentacao: 'NBC TG 03 (R3) — DFC', fundamentacaoUrl: CFC,
    tipoGerador: 'Análise de Fluxo de Caixa',
    roteiro: ['Cronograma de execução e de faturamento', 'Desembolsos por mês (insumos, folha, tributos)', 'Recebimentos considerando o prazo de pagamento do contrato e as retenções', 'Saldo acumulado e necessidade de capital de giro', 'Sensibilidade a atraso de pagamento'],
  },
];

export const CATEGORIAS_CONTABEIS = [...new Set(MODELOS_CONTABEIS.map((m) => m.categoria))];

export type ReferenciaLegal = { rotulo: string; descricao: string; url: string };
export const REFERENCIAS_CONTABEIS: ReferenciaLegal[] = [
  { rotulo: 'Lei 14.133/2021', descricao: 'Licitações e contratos — preço estimado (art. 23), inexequibilidade (art. 59), habilitação fiscal (art. 68) e econômico-financeira (art. 69), reequilíbrio (art. 124)', url: PLANALTO_14133 },
  { rotulo: 'IN SEGES/MP 5/2017', descricao: 'Contratação de serviços com mão de obra — planilha de custos e encargos (Anexo VII-D)', url: IN5 },
  { rotulo: 'IN SEGES/ME 65/2021', descricao: 'Pesquisa de preços para o valor estimado', url: IN65 },
  { rotulo: 'Acórdão TCU 2.622/2013-Plenário', descricao: 'Faixas de BDI e parcelas que o compõem', url: TCU_2622 },
  { rotulo: 'LC 123/2006', descricao: 'Simples Nacional — anexos, Fator R e alíquota efetiva (art. 18)', url: LC123 },
  { rotulo: 'Lei 6.404/1976', descricao: 'Demonstrações financeiras (art. 176 e seguintes)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l6404consol.htm' },
  { rotulo: 'NBC TG 26 (R5)', descricao: 'Apresentação das demonstrações contábeis', url: CFC },
  { rotulo: 'NBC TG 03 (R3)', descricao: 'Demonstração dos fluxos de caixa', url: CFC },
  { rotulo: 'NBC TG 1000 (R1) e ITG 1000', descricao: 'Contabilidade de pequenas e médias empresas e de microempresas', url: CFC },
  { rotulo: 'CPC 00 (R2)', descricao: 'Estrutura conceitual para relatório financeiro', url: 'http://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos' },
  { rotulo: 'Lei 4.320/1964 e LC 101/2000', descricao: 'Contabilidade pública e responsabilidade fiscal — para ler o balanço do ente contratante', url: 'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm' },
];

/** O roteiro em texto, como "Copiar" entrega e como a IA recebe. */
export function roteiroEmTexto(m: ModeloContabil): string {
  return [`${m.titulo} — ${m.descricao}`, `Fundamento: ${m.fundamentacao}`, '', ...m.roteiro.map((s, i) => `${i + 1}. ${s}`)].join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** O roteiro como documento Word (HTML que o Word abre), para "Baixar". */
export function htmlDoRoteiro(m: ModeloContabil): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(m.titulo)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.5}h1{font-size:16pt}h2{font-size:13pt;margin-top:18pt}p.meta{color:#555}</style></head><body>
<h1>${esc(m.titulo)}</h1>
<p class="meta">${esc(m.descricao)}<br/>Fundamento: ${esc(m.fundamentacao)} — <a href="${m.fundamentacaoUrl}">texto oficial</a></p>
${m.roteiro.map((s, i) => `<h2>${i + 1}. ${esc(s)}</h2><p>&nbsp;</p><p>&nbsp;</p>`).join('\n')}
<p class="meta">Modelo do Praefectus — Apoio Contábil. Minuta para o contador responsável; preencher com os dados do caso e conferir cada número na fonte.</p>
</body></html>`;
}

export const nomeDoArquivoDoModelo = (m: ModeloContabil) => `${m.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.doc`;
