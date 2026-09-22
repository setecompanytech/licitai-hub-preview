import { describe, it, expect } from 'vitest';
import {
  pareceTransferencia, diasEntre, acharContrapartida, decidirAcao, classificarTitulo,
  categoriasDeTransferencia, montarParDeTransferencia,
  type MovimentoExtrato, type Contrapartida, type TransferenciaExistente,
} from '@/lib/financeiro/transferencia-propria';
import { ehMovimentacao, ehTransferenciaEntreContasProprias } from '@/lib/financeiro/movimentacao';

/**
 * Os casos vêm da base real da ETHOS, auditada em 25/08/2026:
 *
 *  • R$ 300.000 saindo do Banpará e entrando no Itaú no mesmo dia — a
 *    transferência que ninguém casava, virando despesa numa conta e receita
 *    na outra.
 *  • "INT RESGATE MAPFRERFDI" de R$ 507.096,72, resgate do CDB lançado como
 *    conta a receber e inflando o "Total a receber em aberto".
 *  • Os oito PIX de abril lançados com a conta de origem no chute, tirando
 *    R$ 2,05 milhões de uma conta que tinha R$ 39,75 de saldo de abertura.
 */

const ITAU = 'conta-itau';
const BANPARA = 'conta-banpara';
const APLICACAO = 'conta-aplicacao';
const TERCEIRO = 'conta-de-outra-empresa';
const PROPRIAS = [ITAU, BANPARA, APLICACAO];

const saida = (over: Partial<MovimentoExtrato> = {}): MovimentoExtrato => ({
  id: 'mov-saida', conta_id: BANPARA, valor: -300000,
  data_movimento: '2026-06-05', descricao: 'MOVIMENTACAO', ...over,
});

const entrada = (over: Partial<Contrapartida> = {}): Contrapartida => ({
  id: 'mov-entrada', conta_id: ITAU, valor: 300000,
  data: '2026-06-05', descricao: 'MOVIMENTACAO', origem: 'movimento', ...over,
});

describe('reconhecer transferência pela descrição', () => {
  it('reconhece o vocabulário dos bancos', () => {
    for (const d of [
      'TRANSFERENCIA ENTRE CONTAS',
      'TRANSF PROPRIA',
      'INT RESGATE  MAPFRERFDI',
      'APLICACAO MAPFRERFDI INT',
      'RESGATE CDB DI',
      'TED PROPRIA',
      'PIX MESMA TITULARIDADE',
    ]) {
      expect(pareceTransferencia(d), d).toBe(true);
    }
  });

  it('NÃO confunde recebimento de cliente com transferência', () => {
    for (const d of [
      'PIX RECEBIDO ETHOS E07/04 ETHOS ESTRATEGIA E M 33.734.346/0001-72',
      'TED RECEBIDA SECRETARIA DE ESTADO DE EDUCACAO',
      'LIQUIDACAO BOLETO 34191790010104351004791020150008',
      'PAGAMENTO FORNECEDOR',
      'TARIFA MANUTENCAO CONTA',
      '',
    ]) {
      expect(pareceTransferencia(d), d).toBe(false);
    }
  });
});

describe('achar a outra metade', () => {
  it('casa saída e entrada de mesmo valor, no mesmo dia, entre contas próprias', () => {
    const pares = acharContrapartida(saida(), [entrada()], { contasProprias: PROPRIAS });
    expect(pares).toHaveLength(1);
    expect(pares[0].score).toBeGreaterThanOrEqual(85);
    expect(pares[0].diasDeDiferenca).toBe(0);
    expect(pares[0].motivos).toContain('mesma data');
  });

  it('recusa valores diferentes — transferência não tem desconto', () => {
    const pares = acharContrapartida(saida(), [entrada({ valor: 299999 })], { contasProprias: PROPRIAS });
    expect(pares).toHaveLength(0);
  });

  it('tolera um centavo, e nada além disso', () => {
    expect(acharContrapartida(saida(), [entrada({ valor: 300000.004 })], { contasProprias: PROPRIAS })).toHaveLength(1);
    expect(acharContrapartida(saida(), [entrada({ valor: 300000.02 })], { contasProprias: PROPRIAS })).toHaveLength(0);
  });

  it('recusa duas saídas — não são as duas pontas de nada', () => {
    const pares = acharContrapartida(saida(), [entrada({ valor: -300000 })], { contasProprias: PROPRIAS });
    expect(pares).toHaveLength(0);
  });

  it('recusa a MESMA conta', () => {
    const pares = acharContrapartida(saida(), [entrada({ conta_id: BANPARA })], { contasProprias: PROPRIAS });
    expect(pares).toHaveLength(0);
  });

  it('recusa conta de terceiro — foi este furo que inventou transferência onde havia venda', () => {
    const pares = acharContrapartida(saida(), [entrada({ conta_id: TERCEIRO })], { contasProprias: PROPRIAS });
    expect(pares).toHaveLength(0);
  });

  it('aceita defasagem de TED dentro da janela, e recusa fora dela', () => {
    expect(acharContrapartida(saida(), [entrada({ data: '2026-06-08' })], { contasProprias: PROPRIAS })).toHaveLength(1);
    expect(acharContrapartida(saida(), [entrada({ data: '2026-06-12' })], { contasProprias: PROPRIAS })).toHaveLength(0);
  });

  it('ordena por probabilidade: mesma data ganha de três dias depois', () => {
    const pares = acharContrapartida(saida(), [
      entrada({ id: 'tarde', data: '2026-06-08' }),
      entrada({ id: 'mesmo-dia', data: '2026-06-05' }),
    ], { contasProprias: PROPRIAS });
    expect(pares[0].contrapartida.id).toBe('mesmo-dia');
  });

  it('a ponta já lançada pesa mais que outra linha de extrato', () => {
    const [comLanc] = acharContrapartida(saida(), [entrada({ origem: 'lancamento' })], { contasProprias: PROPRIAS });
    const [comMov] = acharContrapartida(saida(), [entrada({ origem: 'movimento' })], { contasProprias: PROPRIAS });
    expect(comLanc.score).toBeGreaterThan(comMov.score);
  });

  it('o resgate do CDB casa com a saída da aplicação', () => {
    const resgate = saida({
      id: 'resgate', conta_id: APLICACAO, valor: -507096.72,
      data_movimento: '2026-05-12', descricao: 'INT RESGATE  MAPFRERFDI',
    });
    const pares = acharContrapartida(resgate, [
      entrada({ id: 'entrada-itau', valor: 507096.72, data: '2026-05-12', descricao: 'INT RESGATE  MAPFRERFDI' }),
    ], { contasProprias: PROPRIAS });
    // 70 (valor+sentido+contas) + 15 (mesma data) + 10 (descrição) = 95.
    // Os 5 que faltam para 100 só entram quando a outra ponta já é lançamento.
    expect(pares[0].score).toBe(95);
    expect(pares[0].motivos).toContain('descrição indica transferência');
  });
});

describe('decidir o que fazer', () => {
  it('havendo contrapartida forte, casa', () => {
    const pares = acharContrapartida(saida(), [entrada()], { contasProprias: PROPRIAS });
    expect(decidirAcao(saida(), pares)).toBe('casar');
  });

  it('sem contrapartida mas com descrição de transferência, oferece criar o par', () => {
    const mov = saida({ descricao: 'RESGATE CDB DI' });
    expect(decidirAcao(mov, [])).toBe('criar_par');
  });

  it('sem contrapartida e sem indício, não se mete', () => {
    const mov = saida({ descricao: 'PAGAMENTO FORNECEDOR ALFA LTDA' });
    expect(decidirAcao(mov, [])).toBe('nenhum');
  });

  it('contrapartida fraca não vira casamento automático', () => {
    // Três dias de diferença e sem palavra-chave: 70 + 5 = 75, abaixo de 85.
    const pares = acharContrapartida(saida(), [entrada({ data: '2026-06-08' })], { contasProprias: PROPRIAS });
    expect(pares[0].score).toBeLessThan(85);
    expect(decidirAcao(saida(), pares)).toBe('nenhum');
  });
});

describe('diasEntre', () => {
  it('conta dias, não horas', () => {
    expect(diasEntre('2026-06-05', '2026-06-05')).toBe(0);
    expect(diasEntre('2026-06-05', '2026-06-08')).toBe(3);
    expect(diasEntre('2026-06-08', '2026-06-05')).toBe(3);
  });

  it('atravessa mês e ano', () => {
    expect(diasEntre('2026-12-31', '2027-01-02')).toBe(2);
  });

  it('data inválida não casa com nada', () => {
    expect(diasEntre('', '2026-06-05')).toBe(Number.POSITIVE_INFINITY);
  });
});


describe('título já gravado que na verdade é transferência', () => {
  const resgate = {
    id: 'titulo-resgate', conta_id: ITAU, valor: 507096.72,
    data: '2026-05-12', descricao: 'INT RESGATE  MAPFRERFDI', natureza: 'receita',
  };
  const transferenciaCorrespondente: TransferenciaExistente = {
    id: 'transf-existente', conta_id: APLICACAO, conta_destino_id: ITAU,
    valor: 507096.72, data: '2026-05-12',
  };

  it('havendo a transferência, o título é DUPLICATA — remover, não converter', () => {
    const r = classificarTitulo(resgate, [transferenciaCorrespondente]);
    expect(r.classificacao).toBe('duplicata_de_transferencia');
    expect(r.par?.id).toBe('transf-existente');
  });

  it('não havendo, o título É a transferência mal lançada — converter', () => {
    const r = classificarTitulo(resgate, []);
    expect(r.classificacao).toBe('transferencia_mal_lancada');
    expect(r.par).toBeUndefined();
  });

  it('confundir os dois casos dobraria o erro: converter uma duplicata cria uma TERCEIRA contagem', () => {
    // O teste existe para fixar a regra, não a implementação: enquanto houver
    // par, a resposta nunca pode ser "converter".
    const r = classificarTitulo(resgate, [transferenciaCorrespondente]);
    expect(r.classificacao).not.toBe('transferencia_mal_lancada');
  });

  it('a transferência tem de tocar a conta do título', () => {
    const emOutraConta: TransferenciaExistente = {
      ...transferenciaCorrespondente, conta_id: BANPARA, conta_destino_id: APLICACAO,
    };
    expect(classificarTitulo(resgate, [emOutraConta]).classificacao).toBe('transferencia_mal_lancada');
  });

  it('valor diferente não é o par', () => {
    const outroValor = { ...transferenciaCorrespondente, valor: 500000 };
    expect(classificarTitulo(resgate, [outroValor]).classificacao).toBe('transferencia_mal_lancada');
  });

  it('recebimento de cliente de verdade não é tocado', () => {
    const venda = {
      id: 'titulo-venda', conta_id: ITAU, valor: 158000,
      data: '2026-06-23', descricao: 'NF-e 692 CARNE MOIDA TIPO BOVINA SEDUC', natureza: 'receita',
    };
    expect(classificarTitulo(venda, [transferenciaCorrespondente]).classificacao).toBe('nenhum');
    expect(classificarTitulo(venda, []).classificacao).toBe('nenhum');
  });
});

describe('o par nasce marcado como transferência (21/09, defeito 7)', () => {
  const ENVIADA = { id: 'cat-env', nome: 'Transferências Enviadas Entre Contas Próprias', natureza: 'movimentacao', grupo_dre: 'movimentacao' };
  const RECEBIDA = { id: 'cat-rec', nome: 'Transferências Recebidas Entre Contas Próprias', natureza: 'movimentacao', grupo_dre: 'movimentacao' };
  const VENDA = { id: 'cat-venda', nome: 'Vendas de Mercadorias', natureza: 'receita', grupo_dre: 'receita_bruta' };
  const TRANSF_DE_TERCEIRO = { id: 'cat-ted', nome: 'Transferências recebidas de clientes', natureza: 'receita', grupo_dre: 'receita_bruta' };

  it('acha "enviada" e "recebida" entre as categorias de movimentação, ignorando receita com "transferência" no nome', () => {
    const { enviada, recebida } = categoriasDeTransferencia([VENDA, TRANSF_DE_TERCEIRO, RECEBIDA, ENVIADA]);
    expect(enviada?.id).toBe('cat-env');
    expect(recebida?.id).toBe('cat-rec');
  });

  it('só a genérica cadastrada: serve aos dois lados; nenhuma: fica nula', () => {
    const generica = { id: 'cat-gen', nome: 'Transferência entre contas', natureza: 'movimentacao' };
    expect(categoriasDeTransferencia([generica, VENDA])).toEqual({ enviada: generica, recebida: generica });
    expect(categoriasDeTransferencia([VENDA])).toEqual({ enviada: null, recebida: null });
  });

  it('categoria inativa não é escolhida', () => {
    expect(categoriasDeTransferencia([{ ...ENVIADA, ativa: false }]).enviada).toBeNull();
  });

  it('cada perna leva tipo transferencia, a outra conta como destino e a categoria do seu lado', () => {
    const par = montarParDeTransferencia({
      contaOrigem: BANPARA, contaDestino: ITAU, loteId: 'lote-1',
      categorias: [ENVIADA, RECEBIDA, VENDA], categoriaEscolhida: RECEBIDA.id,
    });
    expect(par.saida).toEqual({
      tipo: 'transferencia', natureza: 'despesa', conta_id: BANPARA, conta_destino_id: ITAU,
      categoria_id: 'cat-env', origem_lote_id: 'lote-1',
    });
    expect(par.entrada).toEqual({
      tipo: 'transferencia', natureza: 'receita', conta_id: ITAU, conta_destino_id: BANPARA,
      categoria_id: 'cat-rec', origem_lote_id: 'lote-1',
    });
    // A categoria escolhida na tela ("Recebidas" nos dois lados, o defeito)
    // não vence a do lado.
    expect(par.saida.categoria_id).not.toBe(par.entrada.categoria_id);
  });

  it('sem "enviada"/"recebida" cadastradas, fica a escolhida na tela; sem nada, nula', () => {
    const comEscolhida = montarParDeTransferencia({ contaOrigem: BANPARA, contaDestino: ITAU, loteId: 'l', categorias: [VENDA], categoriaEscolhida: 'x' });
    expect(comEscolhida.saida.categoria_id).toBe('x');
    const semNada = montarParDeTransferencia({ contaOrigem: BANPARA, contaDestino: ITAU, loteId: 'l' });
    expect(semNada.entrada.categoria_id).toBeNull();
  });

  it('as duas pernas são reconhecidas pela régua do caixa E pela régua do DRE', () => {
    const par = montarParDeTransferencia({ contaOrigem: BANPARA, contaDestino: ITAU, loteId: 'l', categorias: [ENVIADA, RECEBIDA] });
    for (const perna of [par.saida, par.entrada]) {
      expect(ehTransferenciaEntreContasProprias(perna)).toBe(true);
      expect(ehMovimentacao({ ...perna, categoria: perna.categoria_id === 'cat-env' ? ENVIADA : RECEBIDA })).toBe(true);
    }
  });

  it('recusa origem igual ao destino e conta faltando', () => {
    expect(() => montarParDeTransferencia({ contaOrigem: ITAU, contaDestino: ITAU, loteId: 'l' })).toThrow(/mesma conta/);
    expect(() => montarParDeTransferencia({ contaOrigem: null, contaDestino: ITAU, loteId: 'l' })).toThrow(/origem e da conta de destino/);
  });
});
