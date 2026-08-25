/**
 * O regime tributário da empresa — uma palavra só, um lugar só.
 *
 * Havia dois cadastros. `empresas.regime_tributario` guardava
 * `simples_nacional | lucro_presumido | lucro_real` e alimentava Precificação,
 * Contratos, Proposta e Compras. `financeiro_config_tributaria.regime` guardava
 * `simples | presumido | real` e alimentava só a Apuração. Nada sincronizava os
 * dois — e nem poderia, porque nem as palavras coincidiam.
 *
 * O efeito era pior do que redundância. Quando a linha do Financeiro não
 * existia, o padrão da tabela era `simples`: a Apuração abria em Simples
 * Nacional para uma empresa cadastrada como Lucro Presumido, calculava por
 * uma tabela que termina em R$ 4.800.000 de RBT12, e não dizia nada ao passar
 * disso. Quem trocava o regime em Configurações via a tela do Financeiro
 * ignorar a troca e concluía, com razão, que "o sistema não reconhece".
 *
 * Agora o cadastro manda. A tabela do Financeiro segue guardando as ALÍQUOTAS
 * (que são configuração de verdade, variam por empresa e por município), mas
 * não decide mais QUAL regime é o da empresa.
 *
 * Ver CLAUDE.md, princípio 1: vocabulário único, uma autoridade por conceito.
 */

/** Como a Apuração nomeia. */
export type RegimeApuracao = 'simples' | 'presumido' | 'real';

/** Como o cadastro da empresa nomeia — a forma canônica. */
export type RegimeCadastro = 'simples_nacional' | 'lucro_presumido' | 'lucro_real';

const DO_CADASTRO_PARA_APURACAO: Record<RegimeCadastro, RegimeApuracao> = {
  simples_nacional: 'simples',
  lucro_presumido: 'presumido',
  lucro_real: 'real',
};

const DO_APURACAO_PARA_CADASTRO: Record<RegimeApuracao, RegimeCadastro> = {
  simples: 'simples_nacional',
  presumido: 'lucro_presumido',
  real: 'lucro_real',
};

export const ROTULO_REGIME: Record<RegimeCadastro, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
};

/** Teto de RBT12 do Simples Nacional (LC 123/2006, art. 3º, II). */
export const TETO_SIMPLES_NACIONAL = 4_800_000;

/**
 * Traduz o regime do cadastro para o vocabulário da Apuração.
 *
 * Devolve `null` quando o cadastro está vazio ou traz valor desconhecido — e
 * `null` aqui é resposta, não erro: significa "ninguém escolheu ainda", e quem
 * chama deve pedir a escolha em vez de inventar um padrão. Foi exatamente um
 * padrão inventado (`simples`) que produziu o defeito que este arquivo desfaz.
 */
export function regimeDaEmpresa(cadastro: string | null | undefined): RegimeApuracao | null {
  if (!cadastro) return null;
  return DO_CADASTRO_PARA_APURACAO[cadastro as RegimeCadastro] ?? null;
}

/** O caminho de volta, para telas que gravam no cadastro. */
export function regimeParaCadastro(apuracao: RegimeApuracao): RegimeCadastro {
  return DO_APURACAO_PARA_CADASTRO[apuracao];
}

export function rotuloDoRegime(cadastro: string | null | undefined): string {
  const r = regimeDaEmpresa(cadastro);
  return r ? ROTULO_REGIME[regimeParaCadastro(r)] : 'não definido';
}

/**
 * A empresa cabe no Simples com este faturamento?
 *
 * Acima de R$ 4,8 milhões de RBT12 não existe faixa: a tabela do Anexo I
 * termina na sexta e a empresa está fora do regime. Apurar assim mesmo produz
 * um imposto que não é devido dessa forma — e a tela precisa dizer isso em vez
 * de estender a última faixa em silêncio.
 */
export function excedeTetoDoSimples(rbt12: number): boolean {
  return rbt12 > TETO_SIMPLES_NACIONAL;
}
