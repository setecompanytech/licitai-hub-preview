import { describe, it, expect } from 'vitest';
import fixture from './fixtures/compra-homologada-emilio-ribas.json';
import { compraDoComprasGov } from '../../../../supabase/functions/_shared/compra-comprasgov';
import {
  processoViraHomologada,
  resultadoDaDisputa,
  textoDoResultado,
} from '../../../../supabase/functions/_shared/robo-resultado';

/**
 * O resultado da compra volta ao processo pelos dados abertos do Compras.gov.
 * Fixtures reais: Emílio Ribas (item 2 homologado para a Cristália, itens 1 e 3
 * desertos) e CRO/RR (o mesmo item em duas linhas, antes e depois do resultado).
 */

const CRISTALIA = '44.734.671/0022-86';
const OUTRA = '22.920.524/0001-33';
const reais = (n: unknown) => Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const compra = () => compraDoComprasGov(
  fixture.compra as unknown as Record<string, unknown>,
  fixture.itens as unknown as Record<string, unknown>[],
);

describe('itens com resultado nos dados abertos', () => {
  it('lê o vencedor, o valor e a data do item homologado', () => {
    const item2 = compra().itens.find((i) => i.numero === 2)!;
    expect(item2.situacao).toBe('Homologado');
    expect(item2.resultado).toMatchObject({ cnpj: '44734671002286', valorUnitario: 21, quantidade: 200 });
    expect(compra().itens.find((i) => i.numero === 1)!.resultado).toBeNull();
  });

  it('o mesmo item em duas linhas vira um só, com o resultado', () => {
    const c = compraDoComprasGov(
      fixture.compra as unknown as Record<string, unknown>,
      fixture.itens_com_duplicata as unknown as Record<string, unknown>[],
    );
    expect(c.itens).toHaveLength(1);
    expect(c.itens[0]).toMatchObject({ numero: 1, situacao: 'Homologado' });
    expect(c.itens[0].resultado).toMatchObject({ cnpj: '08307817000119', valorUnitario: 29600 });
  });
});

describe('o desfecho da disputa', () => {
  it('a empresa venceu o item que disputou: vencida, e o processo vira Homologada', () => {
    const r = resultadoDaDisputa([2], compra().itens, CRISTALIA)!;
    expect(r.estado).toBe('vencida');
    expect(r.ganhos).toEqual([{ numero: 2, valor: 21 }]);
    expect(processoViraHomologada('Em Disputa', r)).toBe(true);
    expect(processoViraHomologada('Proposta Enviada', r)).toBe(true);
    expect(processoViraHomologada('Monitorando', r)).toBe(false);
    expect(processoViraHomologada('Perdida', r)).toBe(false);
    expect(textoDoResultado('90167/2026', r, reais, true)).toEqual({
      titulo: '🏆 Compra homologada com vitória — 90167/2026',
      mensagem: 'O Compras.gov publicou o resultado. A empresa venceu o item 2 (R$ 21,00). Processo movido para Homologada.',
      tipo: 'sucesso',
    });
  });

  it('venceu um e os outros ficaram desertos: vencida, com os desertos no texto', () => {
    const r = resultadoDaDisputa([1, 2, 3], compra().itens, CRISTALIA)!;
    expect(r.estado).toBe('vencida');
    expect(textoDoResultado('90167/2026', r, reais, false).mensagem).toBe(
      'O Compras.gov publicou o resultado. A empresa venceu o item 2 (R$ 21,00). Item 1: deserto; Item 3: deserto.',
    );
  });

  it('homologada para outro fornecedor: perdida, sem mover — Perdida exige motivo', () => {
    const r = resultadoDaDisputa([2], compra().itens, OUTRA)!;
    expect(r.estado).toBe('perdida');
    expect(processoViraHomologada('Em Disputa', r)).toBe(false);
    const t = textoDoResultado('90167/2026', r, reais, false);
    expect(t.titulo).toBe('🏁 Compra homologada para outros fornecedores — 90167/2026');
    expect(t.mensagem).toBe(
      'O Compras.gov publicou o resultado. Item 2: CRISTALIA PRODUTOS QUIMICOS FARMACEUTICOS LTDA (R$ 21,00). Registre o motivo da perda no processo para concluí-lo.',
    );
  });

  it('só desertos: sem vencedor', () => {
    expect(resultadoDaDisputa([1, 3], compra().itens, OUTRA)!.estado).toBe('sem-vencedor');
  });

  it('item ainda sem resultado: pendente, nada acontece', () => {
    const itens = compra().itens.map((i) => (i.numero === 2 ? { ...i, resultado: null, situacao: 'Em andamento' } : i));
    const r = resultadoDaDisputa([1, 2], itens, CRISTALIA)!;
    expect(r.estado).toBe('pendente');
    expect(r.pendentes).toEqual([2]);
    expect(processoViraHomologada('Em Disputa', r)).toBe(false);
  });

  it('sem CNPJ da empresa ou sem os itens da disputa na compra: não afirma nada', () => {
    expect(resultadoDaDisputa([2], compra().itens, null)).toBeNull();
    expect(resultadoDaDisputa([99], compra().itens, CRISTALIA)).toBeNull();
  });
});
