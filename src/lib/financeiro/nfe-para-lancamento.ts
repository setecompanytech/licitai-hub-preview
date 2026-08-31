/**
 * O XML preenche o lançamento — e não o contrário.
 *
 * A aba Documento pede exatamente cinco coisas: tipo, data de emissão, número,
 * série e chave de acesso. O XML da NF-e traz as cinco, com fé pública e
 * protocolo da SEFAZ. Mesmo assim eram digitadas — e o resultado aparece nos
 * cadastros: chave de acesso preenchida com 44 zeros, que é pior do que vazia,
 * porque vazia se vê e zerada passa por preenchida.
 *
 * Guardar o XML sem lê-lo é arquivar a resposta e continuar perguntando.
 *
 * ── A regra que separa preencher de sobrescrever ────────────────────────────
 *
 * Campo em branco: o XML manda, sem perguntar. É fato conferível, e ninguém
 * digita melhor que o documento.
 *
 * Campo preenchido e IGUAL: nada acontece.
 *
 * Campo preenchido e DIFERENTE: nada acontece, e a divergência é dita. O caso
 * que obriga a isso é o valor de um lançamento CONCILIADO — ele veio do
 * extrato, é o dinheiro que entrou de fato, e pode legitimamente diferir do
 * total da nota por retenção, desconto ou pagamento parcial. Sobrescrevê-lo
 * com o total da NF-e quebraria a conciliação em silêncio, e a diferença só
 * apareceria no fechamento seguinte, sem nada que apontasse a origem.
 */

export type NFeLida = {
  chave_acesso?: string | null;
  numero_nf?: number | null;
  serie?: number | null;
  data_emissao?: string | null;
  v_nf?: number | null;
  tipo_nf?: 'entrada' | 'saida' | null;
  nome_dest?: string | null;
  itens?: Array<{ x_prod?: string; q_com?: number; v_un_com?: number; v_prod?: number }>;
};

export type CamposDoDocumento = {
  numero_documento: string | null;
  serie_documento: string | null;
  chave_acesso_nfe: string | null;
  data_emissao: string | null;
  valor: number | null;
};

/** Chave de acesso é 44 dígitos; tudo zero é campo preenchido com nada. */
export function chaveValida(v: unknown): string | null {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length !== 44) return null;
  if (/^0+$/.test(d)) return null;
  return d;
}

/** Só a parte útil: `2026-04-30T10:00:00-03:00` vira `2026-04-30`. */
function soData(v: unknown): string | null {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** O que o XML tem a dizer sobre os campos da aba Documento. */
export function camposDoDocumento(nfe: NFeLida): CamposDoDocumento {
  return {
    numero_documento: nfe.numero_nf ? String(nfe.numero_nf) : null,
    serie_documento: nfe.serie != null ? String(nfe.serie) : null,
    chave_acesso_nfe: chaveValida(nfe.chave_acesso),
    data_emissao: soData(nfe.data_emissao),
    valor: nfe.v_nf && nfe.v_nf > 0 ? Number(nfe.v_nf) : null,
  };
}

export type Divergencia = { campo: string; noSistema: string; naNota: string };

/**
 * O que preencher e o que apenas apontar.
 *
 * Devolve dois conjuntos separados de propósito: `preencher` pode ser aplicado
 * sem perguntar, `divergencias` nunca. Misturá-los num só "atualizar" faria a
 * segunda categoria desaparecer dentro da primeira.
 */
export function conferirContraOLancamento(
  nfe: NFeLida,
  atual: {
    numero_documento?: string | null;
    serie_documento?: string | null;
    chave_acesso_nfe?: string | null;
    data_emissao?: string | null;
    valor?: number | null;
  },
): { preencher: Partial<CamposDoDocumento>; divergencias: Divergencia[] } {
  const doXml = camposDoDocumento(nfe);
  const preencher: Partial<CamposDoDocumento> = {};
  const divergencias: Divergencia[] = [];

  const texto = (chave: 'numero_documento' | 'serie_documento' | 'chave_acesso_nfe' | 'data_emissao', rotulo: string) => {
    const novo = doXml[chave];
    if (!novo) return;
    // Chave de 44 zeros conta como vazia: foi digitada para preencher o campo,
    // não para dizer algo.
    const guardado = chave === 'chave_acesso_nfe'
      ? chaveValida(atual[chave])
      : (String(atual[chave] ?? '').trim() || null);
    if (!guardado) { preencher[chave] = novo; return; }
    // Número comparado por dígitos: "000123" e "123" são a mesma nota.
    const iguais = chave === 'numero_documento'
      ? guardado.replace(/\D/g, '').replace(/^0+/, '') === novo.replace(/\D/g, '').replace(/^0+/, '')
      : guardado === novo;
    if (!iguais) divergencias.push({ campo: rotulo, noSistema: guardado, naNota: novo });
  };

  texto('numero_documento', 'Número do documento');
  texto('serie_documento', 'Série');
  texto('chave_acesso_nfe', 'Chave de acesso');
  texto('data_emissao', 'Data de emissão');

  // O valor tem regra própria. Zero e nulo são "não informado"; qualquer outro
  // valor já gravado é dado do extrato, e extrato não se corrige por nota.
  const valorAtual = Number(atual.valor ?? 0);
  if (doXml.valor != null) {
    if (!valorAtual) preencher.valor = doXml.valor;
    else if (Math.abs(valorAtual - doXml.valor) > 0.005) {
      divergencias.push({
        campo: 'Valor',
        noSistema: valorAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        naNota: doXml.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      });
    }
  }

  return { preencher, divergencias };
}

/**
 * A quantidade total da nota, para o pedido do contrato.
 *
 * É o dado que o XML tem e a tela do vínculo pedia à mão — R$ 30.960,00 a
 * R$ 0,43 são 72.000 unidades, e essa conta não deveria ser de quem cadastra.
 *
 * Soma as linhas porque um pedido do contrato costuma corresponder à nota
 * inteira. Nota com produtos diferentes devolve a soma e a lista: quem vincula
 * decide se aquilo é um pedido ou vários.
 */
export function quantidadeDaNota(nfe: NFeLida): {
  total: number;
  linhas: Array<{ descricao: string; quantidade: number; unitario: number }>;
} {
  const linhas = (nfe.itens ?? []).map((i) => ({
    descricao: String(i.x_prod ?? ''),
    quantidade: Number(i.q_com) || 0,
    unitario: Number(i.v_un_com) || 0,
  }));
  return {
    total: Number(linhas.reduce((s, l) => s + l.quantidade, 0).toFixed(4)),
    linhas,
  };
}
