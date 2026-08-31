/**
 * O que se anexa depende do que o lançamento é.
 *
 * A aba Documento dizia "Anexar a NF-e" em toda linha — inclusive numa guia do
 * INSS, num boleto de energia, num comprovante de PIX. E aceitava só `.xml` e
 * `.pdf`, enquanto o clipe da lista, ao lado, já aceitava foto. Duas portas
 * para o mesmo arquivo, com regras diferentes.
 *
 * O armazenamento sempre foi genérico: `financeiro_documentos_fiscais` guarda
 * qualquer arquivo, com o tipo ao lado. O que estava preso era a redação — e
 * redação errada ensina a pessoa que aquela porta não é para ela.
 *
 * ── Foto é o caso comum, não a exceção ──────────────────────────────────────
 *
 * Recibo se fotografa. Comprovante de PIX é print de celular. Restringir a PDF
 * obriga a converter antes de anexar, e o que não se anexa por atrito
 * simplesmente não é guardado.
 */

export type PerfilDoAnexo = {
  /** O título do bloco, na língua do documento que está ali. */
  titulo: string;
  ajuda: string;
  /** O `accept` do seletor de arquivo. */
  aceita: string;
  /** Este tipo tem XML fiscal a ser lido? */
  leXml: boolean;
  /** Este tipo tem chave de acesso de 44 dígitos no papel? */
  leChave: boolean;
};

const IMAGENS = '.jpg,.jpeg,.png,.webp,.heic';

/** Documento eletrônico com chave de acesso nacional de 44 dígitos. */
const COM_CHAVE = new Set(['nfe', 'nfce', 'cte']);

/** Cobrança: o que se paga contra um boleto ou guia. */
const COBRANCA = new Set(['boleto', 'darf', 'das', 'duplicata', 'fatura']);

/** Comprovação de que o dinheiro andou — não é documento fiscal. */
const COMPROVANTE = new Set(['pix', 'ted', 'doc']);

export function perfilDoAnexo(tipoDocumento: string | null | undefined): PerfilDoAnexo {
  const t = String(tipoDocumento ?? '').trim().toLowerCase();

  if (COM_CHAVE.has(t)) {
    return {
      titulo: 'Anexar a nota',
      ajuda: 'O XML preenche os campos abaixo. Sem ele, o PDF é lido pela chave de acesso — '
        + 'que traz número, série e competência. Pode escolher os dois.',
      aceita: `.xml,.pdf,${IMAGENS}`,
      leXml: true,
      leChave: true,
    };
  }

  if (t === 'nfse') {
    return {
      titulo: 'Anexar a NFS-e',
      // A NFS-e é municipal: não há chave nacional de 44 dígitos, e cada
      // prefeitura tem seu layout. Prometer a leitura pela chave seria
      // prometer o que não se cumpre.
      ajuda: 'A NFS-e é municipal e não tem chave nacional — os campos abaixo são preenchidos à mão. '
        + 'Havendo XML da prefeitura, anexe os dois.',
      aceita: `.xml,.pdf,${IMAGENS}`,
      leXml: true,
      leChave: false,
    };
  }

  if (COBRANCA.has(t)) {
    return {
      titulo: 'Anexar o boleto ou a guia',
      ajuda: 'O papel que originou a cobrança. Guardá-lo é o que permite conferir valor e '
        + 'vencimento depois, e provar o que se pagou.',
      aceita: `.pdf,${IMAGENS}`,
      leXml: false,
      leChave: false,
    };
  }

  if (COMPROVANTE.has(t)) {
    return {
      titulo: 'Anexar o comprovante',
      ajuda: 'O comprovante da transferência. Print de celular serve — é como ele costuma chegar.',
      aceita: `.pdf,${IMAGENS}`,
      leXml: false,
      leChave: false,
    };
  }

  if (t === 'recibo') {
    return {
      titulo: 'Anexar o recibo',
      ajuda: 'Foto ou PDF. Recibo se fotografa, e exigir conversão para PDF antes de anexar faz o '
        + 'documento não ser guardado.',
      aceita: `.pdf,${IMAGENS}`,
      leXml: false,
      leChave: false,
    };
  }

  return {
    titulo: 'Anexar o documento',
    ajuda: 'Nota, boleto, recibo, comprovante — o papel que originou este lançamento. '
      + 'Escolhendo o tipo acima, o sistema passa a saber o que fazer com ele.',
    aceita: `.pdf,.xml,${IMAGENS}`,
    leXml: true,
    leChave: true,
  };
}

/**
 * O tipo exige documento guardado?
 *
 * NF-e, NFC-e e NFS-e sim: o arquivo É o documento fiscal, com guarda de cinco
 * anos. Tarifa bancária não exige nada — cobrar anexo de tudo transforma o
 * aviso em ruído, e em duas semanas ninguém lê o painel.
 */
export function exigeDocumento(tipoDocumento: string | null | undefined): boolean {
  return ['nfe', 'nfse', 'nfce', 'cte'].includes(String(tipoDocumento ?? '').trim().toLowerCase());
}
