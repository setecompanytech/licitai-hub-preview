/**
 * As normas que o Apoio Jurídico pode citar como CONFERIDAS (27/09/2026).
 *
 * Conferidas contra o texto de 2021 da Lei 14.133 (auditoria de 31/08) e os
 * textos oficiais das demais. `texto` é a síntese fiel do dispositivo; onde
 * `literal` é true, é a redação exata. O que não está aqui a peça cita como
 * "a confirmar", nunca como certo — foi assim que "art. 65" e um acórdão
 * inexistente pararam de sair do gerador.
 *
 * ESPELHO de `src/lib/juridico/normas-conferidas.ts` — os dois têm o mesmo
 * conteúdo (a edge não importa de `src/`). O teste do front
 * compara os dois.
 */
export type NormaConferida = {
  /** Chave de casamento, minúscula e sem acento: "14.133|92|3" */
  chave: string;
  diploma: string;
  dispositivo: string;
  texto: string;
  literal: boolean;
  url: string;
};

const PLANALTO_14133 = 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';
const PLANALTO_10192 = 'https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10192.htm';

export const NORMAS_CONFERIDAS: NormaConferida[] = [
  { chave: '14.133|6|lviii', diploma: 'Lei 14.133/2021', dispositivo: 'art. 6º, LVIII', literal: true, url: PLANALTO_14133,
    texto: 'reajustamento em sentido estrito: forma de manutenção do equilíbrio econômico-financeiro de contrato consistente na aplicação do índice de correção monetária previsto no contrato, que deve retratar a variação efetiva do custo de produção, admitida a adoção de índices específicos ou setoriais' },
  { chave: '14.133|6|lix', diploma: 'Lei 14.133/2021', dispositivo: 'art. 6º, LIX', literal: true, url: PLANALTO_14133,
    texto: 'repactuação: forma de manutenção do equilíbrio econômico-financeiro de contrato utilizada para serviços contínuos com regime de dedicação exclusiva de mão de obra ou predominância de mão de obra, por meio da análise da variação dos custos contratuais, devendo estar prevista no edital com data vinculada à apresentação das propostas, para os custos decorrentes do mercado, e com data vinculada ao acordo, à convenção coletiva ou ao dissídio coletivo ao qual o orçamento esteja vinculado, para os custos decorrentes da mão de obra' },
  { chave: '14.133|25|7', diploma: 'Lei 14.133/2021', dispositivo: 'art. 25, § 7º', literal: true, url: PLANALTO_14133,
    texto: 'Independentemente do prazo de duração, o contrato deverá conter cláusula que estabeleça o índice de reajustamento de preço, com data-base vinculada à data do orçamento estimado e com a possibilidade de ser estabelecido mais de um índice específico ou setorial, em conformidade com a realidade de mercado dos respectivos insumos.' },
  { chave: '14.133|84', diploma: 'Lei 14.133/2021', dispositivo: 'art. 84', literal: false, url: PLANALTO_14133,
    texto: 'o prazo de vigência da ata de registro de preços é de 1 ano, prorrogável por igual período desde que comprovado o preço vantajoso' },
  { chave: '14.133|92|3', diploma: 'Lei 14.133/2021', dispositivo: 'art. 92, § 3º', literal: true, url: PLANALTO_14133,
    texto: 'Independentemente do prazo de duração, o contrato deverá conter cláusula que estabeleça o índice de reajustamento de preço, com data-base vinculada à data do orçamento estimado e com a possibilidade de ser estabelecido mais de um índice específico ou setorial, em conformidade com a realidade de mercado dos respectivos insumos.' },
  { chave: '14.133|92|4', diploma: 'Lei 14.133/2021', dispositivo: 'art. 92, § 4º', literal: false, url: PLANALTO_14133,
    texto: 'nos contratos de serviços contínuos, observado o interregno mínimo de 1 ano, o critério de reajustamento será: I — reajustamento em sentido estrito, quando não houver regime de dedicação exclusiva de mão de obra ou predominância de mão de obra, mediante índices específicos ou setoriais; II — repactuação, quando houver regime de dedicação exclusiva ou predominância de mão de obra, mediante demonstração analítica da variação dos custos' },
  { chave: '14.133|94', diploma: 'Lei 14.133/2021', dispositivo: 'art. 94', literal: false, url: PLANALTO_14133,
    texto: 'a divulgação no PNCP é condição indispensável para a eficácia do contrato e de seus aditamentos, no prazo de 20 dias úteis (licitação) ou 10 dias úteis (contratação direta) da assinatura' },
  { chave: '14.133|105', diploma: 'Lei 14.133/2021', dispositivo: 'art. 105', literal: false, url: PLANALTO_14133,
    texto: 'a duração dos contratos será a prevista em edital e observará, no momento da contratação e a cada exercício, a disponibilidade de créditos orçamentários e a previsão no plano plurianual quando ultrapassar um exercício' },
  { chave: '14.133|107', diploma: 'Lei 14.133/2021', dispositivo: 'art. 107', literal: false, url: PLANALTO_14133,
    texto: 'os contratos de serviços e fornecimentos contínuos podem ser prorrogados sucessivamente, respeitada a vigência máxima decenal, desde que haja previsão em edital e a autoridade ateste que as condições e os preços permanecem vantajosos, permitida a negociação ou a extinção sem ônus' },
  { chave: '14.133|111', diploma: 'Lei 14.133/2021', dispositivo: 'art. 111', literal: false, url: PLANALTO_14133,
    texto: 'na contratação que previr a conclusão de escopo predefinido, o prazo de vigência é automaticamente prorrogado quando o objeto não for concluído no período firmado, aplicadas as sanções cabíveis se o atraso for da contratada' },
  { chave: '14.133|124|i|b', diploma: 'Lei 14.133/2021', dispositivo: 'art. 124, I, "b"', literal: false, url: PLANALTO_14133,
    texto: 'alteração unilateral pela Administração quando necessária a modificação do valor contratual em decorrência de acréscimo ou diminuição quantitativa de seu objeto, nos limites do art. 125' },
  { chave: '14.133|124|ii|d', diploma: 'Lei 14.133/2021', dispositivo: 'art. 124, II, "d"', literal: false, url: PLANALTO_14133,
    texto: 'alteração por acordo entre as partes para restabelecer o equilíbrio econômico-financeiro inicial em caso de força maior, caso fortuito ou fato do príncipe, ou em decorrência de fatos imprevisíveis ou previsíveis de consequências incalculáveis, que inviabilizem a execução como pactuada' },
  { chave: '14.133|125', diploma: 'Lei 14.133/2021', dispositivo: 'art. 125', literal: false, url: PLANALTO_14133,
    texto: 'o contratado é obrigado a aceitar acréscimos ou supressões de até 25% do valor inicial atualizado do contrato (50% para acréscimos em reforma de edifício ou de equipamento)' },
  { chave: '14.133|135', diploma: 'Lei 14.133/2021', dispositivo: 'art. 135', literal: false, url: PLANALTO_14133,
    texto: 'os preços dos contratos para serviços contínuos com dedicação exclusiva ou predominância de mão de obra serão repactuados mediante demonstração analítica da variação dos custos, com data vinculada: I — à da apresentação da proposta, para os custos de mercado; II — ao acordo, à convenção ou ao dissídio coletivo, para os custos de mão de obra' },
  { chave: '14.133|136|i', diploma: 'Lei 14.133/2021', dispositivo: 'art. 136, I', literal: false, url: PLANALTO_14133,
    texto: 'registram-se por simples apostila, dispensada a celebração de termo aditivo, a variação do valor contratual para fazer face ao reajuste ou à repactuação de preços previstos no próprio contrato' },
  { chave: '14.133|156', diploma: 'Lei 14.133/2021', dispositivo: 'art. 156', literal: false, url: PLANALTO_14133,
    texto: 'sanções administrativas: advertência, multa, impedimento de licitar e contratar e declaração de inidoneidade, graduadas pela natureza e gravidade da infração' },
  { chave: '14.133|164', diploma: 'Lei 14.133/2021', dispositivo: 'art. 164', literal: false, url: PLANALTO_14133,
    texto: 'qualquer pessoa é parte legítima para impugnar o edital ou pedir esclarecimento, no prazo de até 3 dias úteis antes da data de abertura do certame; a resposta sai em até 3 dias úteis' },
  { chave: '14.133|165', diploma: 'Lei 14.133/2021', dispositivo: 'art. 165', literal: false, url: PLANALTO_14133,
    texto: 'cabem recurso, no prazo de 3 dias úteis contado da intimação ou da lavratura da ata, contra o julgamento das propostas, o ato de habilitação ou inabilitação, a anulação ou revogação e a extinção do contrato; e pedido de reconsideração, no mesmo prazo, contra sanção; contrarrazões no mesmo prazo do recurso' },
  { chave: '14.133|166', diploma: 'Lei 14.133/2021', dispositivo: 'art. 166', literal: false, url: PLANALTO_14133,
    texto: 'da aplicação das sanções de impedimento ou de declaração de inidoneidade cabe pedido de reconsideração à autoridade que a aplicou, no prazo de 15 dias úteis' },
  { chave: '10.192|2|1', diploma: 'Lei 10.192/2001', dispositivo: 'art. 2º, § 1º', literal: true, url: PLANALTO_10192,
    texto: 'É nula de pleno direito qualquer estipulação de reajuste ou correção monetária de periodicidade inferior a um ano.' },
  { chave: '10.192|3|1', diploma: 'Lei 10.192/2001', dispositivo: 'art. 3º, § 1º', literal: true, url: PLANALTO_10192,
    texto: 'A periodicidade anual nos contratos de que trata o caput deste artigo será contada a partir da data limite para apresentação da proposta ou do orçamento a que essa se referir.' },
  { chave: '123|3', diploma: 'Lei Complementar 123/2006', dispositivo: 'art. 3º', literal: false, url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
    texto: 'enquadramento como microempresa (receita bruta anual até R$ 360 mil) e empresa de pequeno porte (acima de R$ 360 mil até R$ 4,8 milhões)' },
  { chave: '8.906|1|i', diploma: 'Lei 8.906/1994', dispositivo: 'art. 1º, I', literal: false, url: 'https://www.planalto.gov.br/ccivil_03/leis/l8906.htm',
    texto: 'a postulação a órgão do Poder Judiciário é atividade privativa de advocacia' },
  { chave: '12.016|23', diploma: 'Lei 12.016/2009', dispositivo: 'art. 23', literal: false, url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm',
    texto: 'o direito de requerer mandado de segurança extingue-se decorridos 120 dias contados da ciência, pelo interessado, do ato impugnado' },
  { chave: 'in5/2017|57', diploma: 'IN SEGES/MP 5/2017', dispositivo: 'art. 57', literal: false, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada',
    texto: 'as repactuações a que o contratado fizer jus e que não forem solicitadas durante a vigência do contrato serão objeto de preclusão com a assinatura da prorrogação contratual ou com o encerramento do contrato (norma federal; aplicação aos demais entes por analogia)' },
  { chave: 'tcu|1.563/2004', diploma: 'Acórdão TCU 1.563/2004 — Plenário', dispositivo: '', literal: false, url: 'https://pesquisa.apps.tcu.gov.br/',
    texto: 'o interregno de um ano para a repactuação conta da data da proposta ou da data-base da convenção coletiva que a orçou; repactuação depende de demonstração analítica, não de mera aplicação de índice' },
];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Casa uma citação em texto livre ("Lei 14.133/2021, art. 92, § 3º") com a
 * lista. Diploma pelo número; dispositivo por artigo + parágrafo/inciso/alínea
 * quando a lista os tem. Sem casamento → a norma fica "a confirmar".
 */
export function normaConferida(citacao: string): NormaConferida | null {
  const t = semAcento(citacao).replace(/º|°/g, '').replace(/\s+/g, ' ');
  // Acórdão antes do número pontuado: "1.563/2004" tem a cara de lei.
  if ((t.includes('acordao') || t.includes('tcu')) && t.includes('1.563')) return NORMAS_CONFERIDAS.find((n) => n.chave === 'tcu|1.563/2004') ?? null;
  // O diploma é o número pontuado (14.133, 10.192, 8.906); "136" num "art. 136"
  // nunca é diploma. LC 123 e IN 5 são os únicos sem ponto.
  const diploma = t.match(/\b(\d{1,2}\.\d{3})\b/)?.[1]
    ?? (/(lc|complementar)\s*n?\.?\s*123\b/.test(t) ? '123' : /in\s*(seges\S*\s*)?(n?\.?\s*)?5\b/.test(t) ? 'in5/2017' : null);
  if (!diploma) return null;
  const artigo = t.match(/art\.?\s*(\d+)/)?.[1] ?? null;
  const paragrafo = t.match(/§\s*(\d+)|par[aá]grafo\s*(\d+)/)?.slice(1).find(Boolean) ?? null;
  const inciso = t.match(/,\s*([ivxl]+)\b/)?.[1] ?? null;
  const alinea = t.match(/["“']([a-z])["”']/)?.[1] ?? null;
  const candidatos = NORMAS_CONFERIDAS.filter((n) => n.chave.startsWith(`${diploma}|`));
  if (diploma === 'tcu') return candidatos[0] ?? null;
  if (!artigo) return null;
  const partes = [diploma, artigo, ...(paragrafo ? [paragrafo] : []), ...(inciso ? [inciso] : []), ...(alinea ? [alinea] : [])];
  // Tenta do mais específico ao mais genérico: "14.133|124|ii|d" → "14.133|124|ii" → "14.133|124".
  for (let n = partes.length; n >= 2; n--) {
    const chave = partes.slice(0, n).join('|');
    const achada = candidatos.find((c) => c.chave === chave);
    if (achada) return achada;
  }
  return null;
}
