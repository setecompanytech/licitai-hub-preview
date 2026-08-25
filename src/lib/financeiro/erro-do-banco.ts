/**
 * O que o banco recusou, dito em português.
 *
 * As invariantes que o Financeiro ganhou em 25/08 fazem o banco recusar estado
 * impossível — transferência sem destino, conta de destino fora de
 * transferência, vencimento a quinze anos da competência. Isso é o que se
 * queria: erro barrado na entrada em vez de descoberto meses depois numa
 * auditoria.
 *
 * Só que a recusa chega ao usuário assim:
 *
 *     new row for relation "financeiro_lancamentos" violates check
 *     constraint "chk_fl_chave_nfe_44"
 *
 * Quem estava lançando uma nota de carne moída não tem como saber que isso
 * quer dizer "a chave da NF-e precisa ter 44 dígitos". Uma proteção que fala
 * assim ensina a contornar em vez de corrigir — e aí ela vira obstáculo, não
 * defesa.
 *
 * Este arquivo é a tradução. Nome de restrição de um lado, frase que diz o que
 * fazer do outro. Quando aparecer restrição nova, ela entra aqui junto — a
 * migration e a frase são a mesma decisão em dois lugares.
 */

const POR_RESTRICAO: Record<string, string> = {
  // ── Documento fiscal ──────────────────────────────────────────────────────
  chk_fl_chave_nfe_44:
    'A chave de acesso da NF-e precisa ter 44 dígitos. O que foi lido do documento não tem esse tamanho — provavelmente a leitura pegou o número da nota no lugar da chave. Deixe o campo vazio ou cole a chave completa.',

  // ── Invariantes de 25/08 ──────────────────────────────────────────────────
  chk_transferencia_tem_destino:
    'Transferência precisa de conta de destino. Sem ela o dinheiro sai de uma conta e não entra em nenhuma.',
  chk_destino_so_em_transferencia:
    'Só transferência tem conta de destino. Neste tipo de lançamento o campo precisa ficar vazio — preenchido, ele faria o mesmo valor contar em duas contas.',
  chk_transferencia_contas_distintas:
    'A conta de origem e a de destino são a mesma. Uma transferência assim não move dinheiro.',
  chk_realizado_tem_data:
    'Lançamento marcado como realizado ou conciliado precisa da data em que o dinheiro se moveu. É ela que decide competência, apuração e indicadores.',
  chk_vencimento_plausivel:
    'O vencimento está a mais de quinze anos da competência. Confira o ano — é onde o dedo costuma escorregar.',
  chk_competencia_plausivel:
    'A data de competência está fora do intervalo aceito (2000 a 2100). Confira o ano.',

  // ── Alíquotas ─────────────────────────────────────────────────────────────
  chk_aliquota_irpj_faixa:      'A alíquota de IRPJ precisa estar entre 0 e 100.',
  chk_adicional_irpj_faixa:     'O adicional de IRPJ precisa estar entre 0 e 100.',
  chk_aliquota_csll_faixa:      'A alíquota de CSLL precisa estar entre 0 e 100.',
  chk_aliquota_pis_faixa:       'A alíquota de PIS precisa estar entre 0 e 100.',
  chk_aliquota_cofins_faixa:    'A alíquota de COFINS precisa estar entre 0 e 100.',
  chk_aliquota_pis_nc_faixa:    'A alíquota de PIS não-cumulativo precisa estar entre 0 e 100.',
  chk_aliquota_cofins_nc_faixa: 'A alíquota de COFINS não-cumulativo precisa estar entre 0 e 100.',
  chk_aliquota_iss_faixa:       'A alíquota de ISS precisa estar entre 0 e 100.',
  chk_aliquota_icms_faixa:      'A alíquota de ICMS precisa estar entre 0 e 100.',
};

/** Nome da restrição citada na mensagem do Postgres, se houver. */
export function restricaoViolada(mensagem: string): string | null {
  const m = mensagem.match(/violates check constraint "([^"]+)"/i)
    ?? mensagem.match(/viola a restrição de verificação "([^"]+)"/i);
  return m ? m[1] : null;
}

/**
 * A mensagem que o usuário deve ler.
 *
 * Devolve `null` quando não há tradução — e aí quem chama mostra o texto
 * original. Inventar uma explicação genérica ("dados inválidos") seria pior do
 * que a mensagem crua: pelo menos a crua pode ser pesquisada e leva a alguém
 * que entende.
 */
export function explicarErroDoBanco(erro: unknown): string | null {
  const mensagem =
    typeof erro === 'string' ? erro
    : (erro as { message?: string } | null)?.message ?? '';
  if (!mensagem) return null;

  const restricao = restricaoViolada(mensagem);
  if (restricao && POR_RESTRICAO[restricao]) return POR_RESTRICAO[restricao];

  // Casos genéricos do Postgres que aparecem com frequência no Financeiro.
  if (/numeric field overflow/i.test(mensagem)) {
    return 'O valor informado não cabe no campo — confira se não há dígito a mais.';
  }
  if (/duplicate key value violates unique constraint/i.test(mensagem)) {
    return 'Já existe um registro com esses dados. Este pode ser um lançamento em duplicidade.';
  }
  if (/violates foreign key constraint/i.test(mensagem)) {
    return 'Um dos registros vinculados não existe mais — provavelmente foi excluído por outra pessoa.';
  }
  if (/violates not-null constraint/i.test(mensagem)) {
    const col = mensagem.match(/column "([^"]+)"/i)?.[1];
    return col
      ? `O campo "${col}" é obrigatório e chegou vazio.`
      : 'Um campo obrigatório chegou vazio.';
  }
  return null;
}

/** A explicação quando houver; o texto original quando não houver. */
export function mensagemDeErro(erro: unknown, padrao = 'Erro desconhecido'): string {
  const explicada = explicarErroDoBanco(erro);
  if (explicada) return explicada;
  if (typeof erro === 'string') return erro || padrao;
  return (erro as { message?: string } | null)?.message || padrao;
}
