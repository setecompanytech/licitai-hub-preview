import { describe, it, expect } from 'vitest';

const PORTAIS_SUPORTADOS = [
  { id: 'comprasgov', nome: 'Compras.gov.br', tipo: 'federal' },
  { id: 'bll', nome: 'BLL Compras', tipo: 'privado' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', tipo: 'federal' },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras', tipo: 'privado' },
  { id: 'licitanet', nome: 'Licitanet', tipo: 'privado' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', tipo: 'privado' },
  { id: 'bec-sp', nome: 'BEC/SP', tipo: 'estadual' },
  { id: 'bbmnet', nome: 'BBMNet', tipo: 'privado' },
];

function formatarItens(pendingItems: any[]) {
  return pendingItems.map((item, idx) => ({
    numero: idx + 1,
    descricao: item.descricao || '',
    quantidade: parseFloat(item.quantidade) || 1,
    unidade: item.unidade || 'UN',
    valor_unitario: parseFloat(item.valorUnitario) || 0,
    marca: item.marca || '',
    modelo: item.modelo || '',
    fabricante: item.fabricante || '',
  }));
}

function validarProposta(params: {
  numeroPregao: string;
  empresaId: string | null;
  itens: any[];
  temCredencial: boolean;
  agenteOnline: boolean;
}) {
  const erros: string[] = [];
  if (!params.numeroPregao.trim()) erros.push('Número do pregão obrigatório');
  if (!params.empresaId) erros.push('Empresa não selecionada');
  if (params.itens.length === 0) erros.push('Sem itens na proposta');
  const invalidos = params.itens.filter(i => !i.descricao || i.valor_unitario <= 0);
  if (invalidos.length > 0) erros.push(`${invalidos.length} item(ns) inválido(s)`);
  if (!params.temCredencial) erros.push('Credencial do portal não cadastrada');
  if (!params.agenteOnline) erros.push('Agente Cloud offline');
  return { valido: erros.length === 0, erros };
}

describe('Validação de Proposta para Envio', () => {
  it('aceita proposta válida completa', () => {
    const itens = formatarItens([
      { descricao: 'Monitor', quantidade: '10', unidade: 'UN', valorUnitario: '1500', marca: 'Dell' },
    ]);
    const result = validarProposta({
      numeroPregao: 'PE-001/2026',
      empresaId: 'uuid-empresa',
      itens,
      temCredencial: true,
      agenteOnline: true,
    });
    expect(result.valido).toBe(true);
    expect(result.erros).toHaveLength(0);
  });

  it('rejeita proposta sem número de pregão', () => {
    const result = validarProposta({
      numeroPregao: '',
      empresaId: 'uuid',
      itens: [{ descricao: 'X', valor_unitario: 10 }],
      temCredencial: true,
      agenteOnline: true,
    });
    expect(result.valido).toBe(false);
    expect(result.erros).toContain('Número do pregão obrigatório');
  });

  it('rejeita proposta sem empresa', () => {
    const result = validarProposta({
      numeroPregao: 'PE-001',
      empresaId: null,
      itens: [{ descricao: 'X', valor_unitario: 10 }],
      temCredencial: true,
      agenteOnline: true,
    });
    expect(result.valido).toBe(false);
    expect(result.erros).toContain('Empresa não selecionada');
  });

  it('rejeita proposta sem itens', () => {
    const result = validarProposta({
      numeroPregao: 'PE-001',
      empresaId: 'uuid',
      itens: [],
      temCredencial: true,
      agenteOnline: true,
    });
    expect(result.valido).toBe(false);
    expect(result.erros).toContain('Sem itens na proposta');
  });

  it('rejeita item com valor zero', () => {
    const itens = formatarItens([
      { descricao: 'Item sem valor', quantidade: '1', valorUnitario: '0' },
    ]);
    const result = validarProposta({
      numeroPregao: 'PE-001',
      empresaId: 'uuid',
      itens,
      temCredencial: true,
      agenteOnline: true,
    });
    expect(result.valido).toBe(false);
    expect(result.erros[0]).toContain('inválido');
  });

  it('rejeita quando agente está offline', () => {
    const result = validarProposta({
      numeroPregao: 'PE-001',
      empresaId: 'uuid',
      itens: [{ descricao: 'X', valor_unitario: 10 }],
      temCredencial: true,
      agenteOnline: false,
    });
    expect(result.valido).toBe(false);
    expect(result.erros).toContain('Agente Cloud offline');
  });

  it('rejeita quando falta credencial do portal', () => {
    const result = validarProposta({
      numeroPregao: 'PE-001',
      empresaId: 'uuid',
      itens: [{ descricao: 'X', valor_unitario: 10 }],
      temCredencial: false,
      agenteOnline: true,
    });
    expect(result.valido).toBe(false);
    expect(result.erros).toContain('Credencial do portal não cadastrada');
  });
});

describe('Formatação de Itens', () => {
  it('formata itens corretamente com numeração sequencial', () => {
    const itens = formatarItens([
      { descricao: 'Item A', quantidade: '5', unidade: 'CX', valorUnitario: '100.50', marca: 'Marca1' },
      { descricao: 'Item B', quantidade: '10', unidade: 'UN', valorUnitario: '200', marca: '' },
    ]);
    expect(itens).toHaveLength(2);
    expect(itens[0].numero).toBe(1);
    expect(itens[1].numero).toBe(2);
    expect(itens[0].quantidade).toBe(5);
    expect(itens[0].valor_unitario).toBe(100.50);
    expect(itens[1].marca).toBe('');
  });

  it('trata valores ausentes com defaults', () => {
    const itens = formatarItens([{ descricao: 'Sem dados' }]);
    expect(itens[0].quantidade).toBe(1);
    expect(itens[0].unidade).toBe('UN');
    expect(itens[0].valor_unitario).toBe(0);
  });
});

describe('Portais Suportados', () => {
  it('tem 8 portais cadastrados', () => {
    expect(PORTAIS_SUPORTADOS).toHaveLength(8);
  });

  it('todos os portais têm id e nome', () => {
    PORTAIS_SUPORTADOS.forEach(p => {
      expect(p.id).toBeTruthy();
      expect(p.nome).toBeTruthy();
    });
  });

  it('inclui Compras.gov.br como portal federal', () => {
    const comprasgov = PORTAIS_SUPORTADOS.find(p => p.id === 'comprasgov');
    expect(comprasgov).toBeDefined();
    expect(comprasgov?.tipo).toBe('federal');
  });
});
