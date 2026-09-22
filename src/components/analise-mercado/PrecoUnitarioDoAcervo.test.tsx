import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrecoUnitarioDoAcervo from './PrecoUnitarioDoAcervo';
import { FILTRO_PADRAO, itemUnitario } from '@/lib/mercado/preco-observado';
import type { EstadoDosItens } from '@/hooks/useItensDoAcervo';

const edital = { pncp_id: 'a', cnpj_orgao: '04780953000170', ano_compra: '2025', sequencial_compra: '58', orgao: 'MUNICIPIO DE RONDON DO PARA', numero_compra: '44', url_pncp: 'https://pncp.gov.br/x' };
const especificacao = 'CARNE BOVINA MOÍDA CONGELADA - Carne bovina moída, embalagem de 1k - músculo moído, acém ou agulha, congelado, isento de ossos, cartilagem ou nervos. Com no máximo 10% de gordura. A carne não deve conter partes amolecidas, pegajosas, manchas esverdeadas.';

const itens = [
  itemUnitario({ pncp_id: 'a', numero_item: 1, descricao: especificacao, unidade: 'Quilo', quantidade: 15000, valor_unitario_estimado: 30.78, valor_unitario_homologado: 19.96, tem_resultado: true, fornecedor: 'L B DISTRIBUIDORA EIRELI', data_resultado: '2025-10-02', situacao: 'Homologado' }, edital),
  itemUnitario({ pncp_id: 'b', numero_item: 2, descricao: 'CARNE BOVINA MOIDA 1ª', unidade: 'KG', quantidade: 3038, valor_unitario_estimado: 0, valor_unitario_homologado: null, tem_resultado: false, situacao: 'Em andamento' }, { ...edital, pncp_id: 'b', ano_compra: '2024', orgao: 'MUNICIPIO DE MEDICILANDIA' }),
  itemUnitario({ pncp_id: 'c', numero_item: 3, descricao: 'CARNE BOVINA, TIPO PATINHO, MOIDA', unidade: 'KG', quantidade: 4100, valor_unitario_estimado: 41.31, valor_unitario_homologado: 41, tem_resultado: true, fornecedor: 'FLA SOARES', data_resultado: '2026-04-01', situacao: 'Homologado' }, { ...edital, pncp_id: 'c', ano_compra: '2026', orgao: 'MUNICIPIO DE CUMARU DO NORTE' }),
];

const estado = (extra: Partial<EstadoDosItens>): EstadoDosItens => ({ carregando: false, itens: [], erro: '', buscados: 0, cacheados: 0, totalItens: 0, ...extra });

describe('PrecoUnitarioDoAcervo — o unitário ao lado do global, só o homologado por padrão', () => {
  it('por padrão só o homologado: o item em andamento com orçamento sigiloso fica fora, e a descrição vem recolhida', () => {
    render(<PrecoUnitarioDoAcervo termo="carne moída patinho" estado={estado({ itens, cacheados: 1, buscados: 1, totalItens: 40 })} filtro={FILTRO_PADRAO} aoMudarFiltro={vi.fn()} />);
    expect(screen.getByText('Mediana homologada').parentElement?.textContent).toContain('30,48 / kg');
    expect(screen.getByText('Faixa do estimado').parentElement?.textContent).toMatch(/30,78 a R\$.41,31/);
    expect(screen.getByText('Município de Rondon do Pará')).toBeInTheDocument();
    expect(screen.getByText('L B DISTRIBUIDORA EIRELI · 02/10/2025')).toBeInTheDocument();
    expect(screen.queryByText(/CARNE BOVINA MOIDA 1ª/)).toBeNull();
    expect(screen.queryByText('sem resultado')).toBeNull();
    expect(screen.getByRole('button', { name: 'ver mais' })).toBeInTheDocument();
    expect(screen.getByText(/1 item\(ns\) fora do recorte atual/)).toBeInTheDocument();
  });

  it('com "todos", o item em andamento aparece com "sigiloso" no lugar do zero; o ano recorta', () => {
    const { rerender } = render(<PrecoUnitarioDoAcervo termo="x" estado={estado({ itens })} filtro={{ situacao: 'todos', ano: 'todos' }} aoMudarFiltro={vi.fn()} />);
    expect(screen.getByText(/CARNE BOVINA MOIDA 1ª/)).toBeInTheDocument();
    expect(screen.getByText('sigiloso')).toBeInTheDocument();
    expect(screen.getByText('sem resultado')).toBeInTheDocument();
    rerender(<PrecoUnitarioDoAcervo termo="x" estado={estado({ itens })} filtro={{ situacao: 'homologados', ano: '2026' }} aoMudarFiltro={vi.fn()} />);
    expect(screen.getByText('Município de Cumaru do Norte')).toBeInTheDocument();
    expect(screen.queryByText('Município de Rondon do Pará')).toBeNull();
    rerender(<PrecoUnitarioDoAcervo termo="x" estado={estado({ itens })} filtro={{ situacao: 'homologados', ano: '2024' }} aoMudarFiltro={vi.fn()} />);
    expect(screen.getByText('Nenhum item homologado neste recorte')).toBeInTheDocument();
  });

  it('diz quando está lendo, quando falhou e quando nenhum item fala do objeto', () => {
    const { rerender } = render(<PrecoUnitarioDoAcervo termo="x" estado={estado({ carregando: true })} filtro={FILTRO_PADRAO} aoMudarFiltro={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Lendo os itens no PNCP');
    rerender(<PrecoUnitarioDoAcervo termo="x" estado={estado({ erro: 'Cache dos itens indisponível' })} filtro={FILTRO_PADRAO} aoMudarFiltro={vi.fn()} />);
    expect(screen.getByText(/Sem os itens do PNCP: Cache dos itens indisponível/)).toBeInTheDocument();
    rerender(<PrecoUnitarioDoAcervo termo="parafuso" estado={estado({ totalItens: 12 })} filtro={FILTRO_PADRAO} aoMudarFiltro={vi.fn()} />);
    expect(screen.getByText('Nenhum item desses editais fala do objeto pesquisado')).toBeInTheDocument();
  });
});
