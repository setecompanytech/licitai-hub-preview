/**
 * Cadastro da proposta comercial no portal — as regras, em código de produção.
 *
 * ─── POR QUE ESTE ARQUIVO NASCEU ───────────────────────────────────────────
 *
 * Estas funções já existiam — dentro de `src/components/robo-lances/test/envio-proposta-validacao.test.ts`,
 * declaradas no topo do próprio arquivo de teste. Eram 176 linhas testando
 * cópias locais de si mesmas: nenhum `import`, nenhuma linha de produção
 * coberta. O contrato estava escrito e acordado (marca, modelo e fabricante já
 * estavam lá) e nunca tinha saído do teste.
 *
 * Mover para cá é o que transforma o teste em teste.
 *
 * ─── O QUE ESTE MÓDULO NÃO FAZ ─────────────────────────────────────────────
 *
 * Não envia nada. Ele decide se vale a pena tentar, e monta o corpo. Quem
 * conversa com o portal é o módulo do portal, no agente da VPS.
 */

/** Um item como o portal precisa recebê-lo. */
export type ItemDaProposta = {
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  marca: string;
  modelo: string;
  fabricante: string;
};

/** O que a tela tem em mãos antes de mandar. */
export type EntradaDeItem = {
  descricao?: string | null;
  quantidade?: number | string | null;
  unidade?: string | null;
  valorUnitario?: number | string | null;
  marca?: string | null;
  modelo?: string | null;
  fabricante?: string | null;
};

/**
 * Traduz os itens da tela para o formato do envio.
 *
 * A numeração é sequencial e gerada AQUI, não copiada da entrada: o portal
 * casa item por posição na proposta, e um número herdado de outra origem
 * (edital, precificação) pode ter buracos.
 */
export function formatarItens(entradas: EntradaDeItem[]): ItemDaProposta[] {
  return entradas.map((item, idx) => ({
    numero: idx + 1,
    descricao: item.descricao || '',
    quantidade: Number(item.quantidade) || 1,
    unidade: item.unidade || 'UN',
    valor_unitario: Number(item.valorUnitario) || 0,
    // Marca, modelo e fabricante viajam como texto vazio quando não sabidos,
    // e não como null: o formulário do portal tem campo para os três, e
    // `null` viraria a string "null" dentro de um input.
    marca: item.marca || '',
    modelo: item.modelo || '',
    fabricante: item.fabricante || '',
  }));
}

export type ChecagemDaProposta = {
  numeroPregao: string;
  empresaId: string | null;
  itens: Array<{ descricao?: string | null; valor_unitario?: number | null }>;
  temCredencial: boolean;
  agenteOnline: boolean;
};

/**
 * Vale a pena tentar enviar?
 *
 * Junta TODOS os motivos em vez de parar no primeiro. Quem está a minutos do
 * fim do prazo não pode descobrir os problemas um por vez, com uma ida ao
 * portal entre cada descoberta.
 *
 * Item com valor zero é barrado de propósito: proposta com preço zerado é
 * desclassificação, e o zero costuma ser campo esquecido, não decisão.
 */
export function validarProposta(params: ChecagemDaProposta): {
  valido: boolean;
  erros: string[];
} {
  const erros: string[] = [];

  if (!params.numeroPregao.trim()) erros.push('Número do pregão obrigatório');
  if (!params.empresaId) erros.push('Empresa não selecionada');
  if (params.itens.length === 0) erros.push('Sem itens na proposta');

  const invalidos = params.itens.filter(
    (i) => !i.descricao || (i.valor_unitario ?? 0) <= 0
  );
  if (invalidos.length > 0) erros.push(`${invalidos.length} item(ns) inválido(s)`);

  if (!params.temCredencial) erros.push('Credencial do portal não cadastrada');
  if (!params.agenteOnline) erros.push('Agente Cloud offline');

  return { valido: erros.length === 0, erros };
}
