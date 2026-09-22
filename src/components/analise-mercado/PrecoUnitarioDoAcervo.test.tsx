import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrecoUnitarioDoAcervo from './PrecoUnitarioDoAcervo';
import { itemUnitario } from '@/lib/mercado/preco-observado';
import type { EstadoDosItens } from '@/hooks/useItensDoAcervo';

const edital = { pncp_id: 'a', cnpj_orgao: '04780953000170', ano_compra: '2025', sequencial_compra: '58', orgao: 'MUNICIPIO DE RONDON DO PARA', numero_compra: '44', url_pncp: 'https://pncp.gov.br/x' };

const itens = [
  itemUnitario({ pncp_id: 'a', numero_item: 1, descricao: 'CARNE BOVINA MOÍDA CONGELADA', unidade: 'Quilo', quantidade: 15000, valor_unitario_estimado: 30.78, valor_unitario_homologado: 19.96, tem_resultado: true, fornecedor: 'L B DISTRIBUIDORA EIRELI', data_resultado: '2025-10-02', situacao: 'Homologado' }, edital),
  itemUnitario({ pncp_id: 'b', numero_item: 3, descricao: 'CARNE BOVINA, TIPO PATINHO, MOIDA', unidade: 'KG', quantidade: 4100, valor_unitario_estimado: 41.31, valor_unitario_homologado: null, tem_resultado: false, situacao: 'Em andamento' }),
];

const estado = (extra: Partial<EstadoDosItens>): EstadoDosItens => ({ carregando: false, itens: [], erro: '', buscados: 0, cacheados: 0, totalItens: 0, ...extra });

describe('PrecoUnitarioDoAcervo — o unitário ao lado do global, nunca misturado', () => {
  it('mostra a mediana homologada como âncora, a estimada à parte, e a tabela item a item', () => {
    render(<PrecoUnitarioDoAcervo termo="carne moída patinho" estado={estado({ itens, cacheados: 1, buscados: 1, totalItens: 40 })} />);
    expect(screen.getByText('Mediana homologada').parentElement?.textContent).toContain('19,96 / kg');
    expect(screen.getByText('Mediana estimada').parentElement?.textContent).toContain('36,05');
    expect(screen.getByText('Unitário · homologado')).toBeInTheDocument();
    expect(screen.getByText('L B DISTRIBUIDORA EIRELI · 02/10/2025')).toBeInTheDocument();
    expect(screen.getByText('sem resultado')).toBeInTheDocument();
    expect(screen.getByText(/1 edital\(is\) já em cache, 1 lido\(s\) agora/)).toBeInTheDocument();
  });

  it('diz quando está lendo, quando falhou e quando nenhum item fala do objeto', () => {
    const { rerender } = render(<PrecoUnitarioDoAcervo termo="x" estado={estado({ carregando: true })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Lendo os itens no PNCP');
    rerender(<PrecoUnitarioDoAcervo termo="x" estado={estado({ erro: 'Cache dos itens indisponível' })} />);
    expect(screen.getByText(/Sem os itens do PNCP: Cache dos itens indisponível/)).toBeInTheDocument();
    rerender(<PrecoUnitarioDoAcervo termo="parafuso" estado={estado({ totalItens: 12 })} />);
    expect(screen.getByText('Nenhum item desses editais fala do objeto pesquisado')).toBeInTheDocument();
    expect(screen.getByText(/Foram lidos 12 item\(ns\)/)).toBeInTheDocument();
  });
});
