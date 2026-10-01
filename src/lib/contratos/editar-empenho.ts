/**
 * Editar e apagar um empenho (28/09/2026) — o que a tela grava e o que avisa.
 * Puro: a tela só chama.
 *
 * O empenho nasce do PDF ou da digitação e não tinha edição nenhuma: errar a
 * espécie (ordinário por global) obrigava a apagar por SQL. Apagar o PDF em
 * "Arquivos e Aditivos" também não apagava o empenho (a chave é SET NULL), e
 * o registro ficava vivo, sem documento, autorizando pedidos.
 */
export type TipoDeEmpenhoEditavel = 'ordinario' | 'global' | 'estimativo';

export type EmpenhoOriginal = {
  id: string; numero: string; tipo: string; tipo_origem: string; tipo_trecho: string | null;
  valor: number | null; quantidade: number | null; unidade: string | null; data_emissao: string | null;
  exercicio: number | null; observacao: string | null; arquivo_id: string | null;
  /** O termo de referência (janela do contrato). Nulo = pela data de emissão. */
  origem_aditivo_id?: string | null;
};

export type FormularioDoEmpenho = {
  numero: string; tipo: TipoDeEmpenhoEditavel | ''; data_emissao: string; valor: string; quantidade: string; unidade: string; observacao: string;
  origem_aditivo_id: string;
};

export type LinhaDoEmpenho = {
  key: string; id?: string; contrato_item_id: string; descricao: string; cota: '' | 'principal' | 'reservada'; quantidade: string; unidade: string; valor_unitario: string;
};

const num = (v: string | number | null | undefined): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/** O formulário como a tela o abre, a partir do registro. */
export function formularioDoEmpenho(e: EmpenhoOriginal): FormularioDoEmpenho {
  return {
    numero: e.numero, tipo: (['ordinario', 'global', 'estimativo'].includes(e.tipo) ? e.tipo : '') as FormularioDoEmpenho['tipo'],
    data_emissao: e.data_emissao ?? '', valor: e.valor != null ? String(e.valor) : '', quantidade: e.quantidade != null ? String(e.quantidade) : '',
    unidade: e.unidade ?? 'un', observacao: e.observacao ?? '',
    origem_aditivo_id: e.origem_aditivo_id ?? '',
  };
}

/** Totais das linhas: quando há linhas, elas mandam no valor e na quantidade do empenho. */
export function totaisDasLinhas(linhas: LinhaDoEmpenho[]): { valor: number; quantidade: number; linhasValidas: LinhaDoEmpenho[] } {
  const linhasValidas = linhas.filter((l) => l.descricao.trim() && num(l.quantidade) > 0);
  return {
    valor: Math.round(linhasValidas.reduce((s, l) => s + num(l.quantidade) * num(l.valor_unitario), 0) * 100) / 100,
    // A coluna é numeric(15,4): arredondar aqui evita 133.32999999999998.
    quantidade: Math.round(linhasValidas.reduce((s, l) => s + num(l.quantidade), 0) * 10000) / 10000,
    linhasValidas,
  };
}

export function problemaDoEmpenho(f: FormularioDoEmpenho, linhas: LinhaDoEmpenho[]): string | null {
  if (!f.numero.trim()) return 'Informe o número da nota de empenho.';
  if (!f.tipo) return 'Escolha a espécie do empenho (ordinário, global ou estimativo).';
  if (f.data_emissao && !/^\d{4}-\d{2}-\d{2}$/.test(f.data_emissao)) return 'Data de emissão inválida.';
  const { linhasValidas } = totaisDasLinhas(linhas);
  if (linhasValidas.length === 0 && num(f.valor) <= 0) return 'Informe o valor do empenho ou ao menos uma linha com quantidade.';
  const semPreco = linhasValidas.find((l) => num(l.valor_unitario) <= 0);
  if (semPreco) return `A linha "${semPreco.descricao.slice(0, 40)}" está sem valor unitário.`;
  return null;
}

export type AtualizacaoDoEmpenho = {
  empenho: Record<string, unknown>;
  itens: Array<Record<string, unknown>>;
  descricaoDoArquivo: string;
  mudouEspecie: boolean;
};

/**
 * O que gravar. A espécie escolhida à mão deixa de ser "lida do documento":
 * tipo_origem vira manual e o trecho literal é apagado, porque ele provava
 * outra coisa.
 */
export function montarAtualizacaoDoEmpenho(original: EmpenhoOriginal, f: FormularioDoEmpenho, linhas: LinhaDoEmpenho[], empresaId: string): AtualizacaoDoEmpenho {
  const { valor, quantidade, linhasValidas } = totaisDasLinhas(linhas);
  const mudouEspecie = f.tipo !== original.tipo;
  const dataEmissao = f.data_emissao || null;
  const exercicio = dataEmissao ? parseInt(dataEmissao.slice(0, 4), 10) : original.exercicio;
  const rotulo: Record<string, string> = { ordinario: 'ordinário', global: 'global', estimativo: 'estimativo' };
  return {
    empenho: {
      numero: f.numero.trim(),
      tipo: f.tipo,
      tipo_origem: mudouEspecie ? 'manual' : original.tipo_origem,
      tipo_trecho: mudouEspecie ? null : original.tipo_trecho,
      valor: linhasValidas.length > 0 ? valor : (num(f.valor) || null),
      quantidade: linhasValidas.length > 0 ? quantidade : (num(f.quantidade) || null),
      unidade: f.unidade.trim() || 'un',
      data_emissao: dataEmissao,
      exercicio,
      observacao: f.observacao.trim() || null,
      // O carimbo do termo (30/09): o empenho cai na janela do termo escolhido;
      // sem escolha, na da data de emissão.
      origem_aditivo_id: f.origem_aditivo_id || null,
      updated_at: new Date().toISOString(),
    },
    itens: linhasValidas.map((l) => ({
      empresa_id: empresaId,
      empenho_id: original.id,
      contrato_item_id: l.contrato_item_id || null,
      cota: l.cota || null,
      descricao: l.descricao.trim(),
      quantidade: num(l.quantidade),
      unidade: l.unidade.trim() || null,
      valor_unitario: num(l.valor_unitario),
      valor_total: Math.round(num(l.quantidade) * num(l.valor_unitario) * 100) / 100,
    })),
    descricaoDoArquivo: `Nota de empenho ${f.numero.trim()} — ${rotulo[f.tipo] ?? f.tipo}`,
    mudouEspecie,
  };
}

/** O que acontece ao apagar — para a pessoa decidir de olhos abertos. */
export function consequenciasDeApagar(v: { pedidos: number; movimentos: number; temPdf: boolean }): string[] {
  const c: string[] = [];
  if (v.pedidos > 0) c.push(`${v.pedidos} pedido(s) que consomem este empenho ficam sem empenho — continuam existindo, mas passam a consumir o contrato direto.`);
  if (v.movimentos > 0) c.push(`${v.movimentos} reforço(s)/anulação(ões) registrados nele são apagados junto.`);
  c.push('As linhas (cotas) do empenho são apagadas.');
  if (v.temPdf) c.push('O PDF pode ser apagado do dossiê ou ficar como documento avulso — você escolhe abaixo.');
  return c;
}
