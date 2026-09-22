import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import EspelhoDoComprovante from './EspelhoDoComprovante';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const dados = {
  cnpj: '24.687.187/0001-01',
  razaoSocial: 'SANTA ROSA COMERCIO, DISTRIBUIDORA E REPRESENTACOES LTDA',
  nomeFantasia: 'GRUPO SANTA ROSA',
  situacao: 'ATIVA',
  dataAbertura: '2016-04-28',
  cnaePrincipalCodigo: '4712100',
  cnaePrincipalDescricao: 'Comércio varejista de mercadorias em geral',
  cnaesSecundariosDetalhados: [{ codigo: '4722901', descricao: 'Comércio varejista de carnes - açougues' }],
  naturezaJuridicaCodigo: '2062',
  naturezaJuridicaDescricao: 'Sociedade Empresária Limitada',
  logradouro: 'TENENTE BEZERRA', numero: '93', complemento: 'A', bairro: 'MANGUEIRAO', cep: '66640085',
  municipio: 'BELEM', uf: 'PA', telefone: '(91) 9225-7448', porte: 'MICRO EMPRESA',
  matrizFilial: 'MATRIZ', dataSituacaoCadastral: '2016-04-28', motivoSituacaoCadastral: 'SEM MOTIVO',
  capitalSocial: 'R$ 500.000,00',
  qsa: [{ nome: 'FULANO DE TAL', qualificacao: 'Sócio-Administrador', qualificacaoCodigo: '49', dataEntrada: '2016-04-28', faixaEtaria: '41 a 50 anos' }],
  fonte: 'brasilapi',
  consultadoEm: '2026-09-22T12:27:09.000Z',
};

const abrirOriginal = window.open;
afterEach(() => { window.open = abrirOriginal; });

describe('EspelhoDoComprovante', () => {
  it('desenha o formulário da Receita com os campos que o cartão não mostrava, e o QSA como a consulta oficial', () => {
    render(<EspelhoDoComprovante dados={dados} />);
    expect(screen.getByText('Número de inscrição')).toBeInTheDocument();
    expect(screen.getByText('24.687.187/0001-01')).toBeInTheDocument();
    expect(screen.getByText('MATRIZ')).toBeInTheDocument();
    expect(screen.getByText('47.12-1-00 - Comércio varejista de mercadorias em geral')).toBeInTheDocument();
    expect(screen.getByText('47.22-9-01 - Comércio varejista de carnes - açougues')).toBeInTheDocument();
    expect(screen.getByText('206-2 - Sociedade Empresária Limitada')).toBeInTheDocument();
    expect(screen.getByText('66.640-085')).toBeInTheDocument();
    expect(screen.getByText('Data da situação cadastral')).toBeInTheDocument();
    expect(screen.getByText('SEM MOTIVO')).toBeInTheDocument();
    expect(screen.getByText('ME')).toBeInTheDocument();
    expect(screen.getByText('FULANO DE TAL')).toBeInTheDocument();
    expect(screen.getByText('49-Sócio-Administrador')).toBeInTheDocument();
    expect(screen.getByText(/Capital social:/).parentElement?.textContent).toContain('R$ 500.000,00 (Quinhentos mil reais)');
    expect(screen.queryByText('Faixa etária')).toBeNull();
    expect(screen.queryByText('41 a 50 anos')).toBeNull();
    expect(screen.queryByText('Entrada')).toBeNull();
    expect(screen.getByRole('link', { name: /Consulta de QSA na Receita/ })).toHaveAttribute('href', 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_qsa.asp');
    expect(screen.getByText(/não substitui o comprovante oficial/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Emitir o oficial na Receita/ })).toHaveAttribute('href', 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/');
  });

  it('imprimir abre o mesmo documento numa janela nova', () => {
    const escrever = vi.fn();
    window.open = vi.fn(() => ({ document: { write: escrever, close: vi.fn() } })) as unknown as typeof window.open;
    render(<EspelhoDoComprovante dados={dados} />);
    fireEvent.click(screen.getByRole('button', { name: /Imprimir ou salvar em PDF/ }));
    expect(escrever).toHaveBeenCalledTimes(1);
    const html = String(escrever.mock.calls[0][0]);
    expect(html).toContain('Espelho do Comprovante de Inscrição e de Situação Cadastral');
    expect(html).toContain('SANTA ROSA COMERCIO');
  });

  it('sem os campos novos (edge antiga), o espelho ainda desenha e marca o que não veio com asteriscos, como o comprovante', () => {
    render(<EspelhoDoComprovante dados={{ cnpj: '00.000.000/0001-91', razaoSocial: 'EMPRESA X', cnaePrincipal: '4712100 - Minimercados' }} />);
    expect(screen.getByText('47.12-1-00 - Minimercados')).toBeInTheDocument();
    expect(screen.getAllByText('********').length).toBeGreaterThan(5);
    expect(screen.queryByText('Quadro de sócios e administradores')).toBeNull();
  });
});
