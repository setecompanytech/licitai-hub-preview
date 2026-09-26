import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ItensDoTermo from './ItensDoTermo';
import { linhaDaLeitura, type ItemDoContrato, type LinhaDoTermo, type LinhaLida } from '@/lib/contratos/itens-do-termo';

/**
 * A tabela do termo: a leitura preenche, a pessoa corrige, o impacto e o
 * resumo acompanham. O que veio do anexo fica marcado; o que foi corrigido
 * fica marcado como editado, com o botão de restaurar o lido.
 */
const itens: ItemDoContrato[] = [
  { id: 'i1', codigo_item: '1', descricao: 'AÇÚCAR TIPO REFINADO', unidade: 'UNIDADE', valor_unitario: 5.04, quantidade_contratada: 4822, saldo_quantitativo: 4822, numero_lote: '1' },
  { id: 'i5', codigo_item: '5', descricao: 'CAFÉ EM PÓ 250G', unidade: 'UNIDADE', valor_unitario: 8.10, quantidade_contratada: 4822, saldo_quantitativo: 4822, numero_lote: '1' },
];

const cafeLido: LinhaLida = { numero_item: '5', numero_lote: null, descricao: 'CAFÉ EM PÓ 250G', unidade: 'UNIDADE', quantidade: null, valor_atual: 8.10, valor_novo: 22.05 };

/** Estado controlado, como o formulário do aditivo faz. */
function Harness({ inicial, semItemInicial = [] }: { inicial: Record<string, LinhaDoTermo>; semItemInicial?: LinhaLida[] }) {
  const [linhas, setLinhas] = useState(inicial);
  const [semItem, setSemItem] = useState<LinhaLida[]>(semItemInicial);
  return (
    <ItensDoTermo itens={itens} modo="preco" linhas={linhas} onChange={setLinhas} semItem={semItem} onSemItemChange={setSemItem} />
  );
}

describe('ItensDoTermo', () => {
  it('mostra o lido do anexo com o impacto sobre o saldo, e o resumo soma', () => {
    render(<Harness inicial={{ i5: linhaDaLeitura(itens[1], cafeLido, 'preco') }} />);
    expect(screen.getByText('lido do anexo')).toBeInTheDocument();
    // 13,95 × 4.822 = 67.266,90
    expect(screen.getByTestId('linha-i5')).toHaveTextContent('67.266,90');
    expect(screen.getByTestId('linha-i5')).toHaveTextContent('+172,22%');
    expect(screen.getByTestId('resumo-do-termo')).toHaveTextContent('Itens alterados: 1');
    expect(screen.getByTestId('resumo-do-termo')).toHaveTextContent('67.266,90');
    // O açúcar não mudou: sem impacto.
    expect(screen.getByTestId('linha-i1')).toHaveTextContent('—');
  });

  it('a pessoa corrige o preço lido: vira "editado" e dá para restaurar o lido', () => {
    render(<Harness inicial={{ i5: linhaDaLeitura(itens[1], cafeLido, 'preco') }} />);
    const campo = screen.getByLabelText('Preço novo de CAFÉ EM PÓ 250G') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '2250' } });
    expect(screen.getByText('editado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar o valor lido do anexo' }));
    expect(screen.getByText('lido do anexo')).toBeInTheDocument();
    expect(screen.getByTestId('linha-i5')).toHaveTextContent('67.266,90');
  });

  it('linha que a leitura não casou pode ser ignorada', () => {
    const solta: LinhaLida = { numero_item: '9', numero_lote: null, descricao: 'FARINHA DE MANDIOCA', unidade: 'UNIDADE', quantidade: null, valor_atual: 9, valor_novo: 13.68 };
    render(<Harness inicial={{}} semItemInicial={[solta]} />);
    expect(screen.getByText(/Uma linha do anexo não casou/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ignorar' }));
    expect(screen.queryByText(/não casou/)).toBeNull();
  });

  it('sem itens no contrato, diz onde cadastrá-los', () => {
    const onChange = vi.fn();
    render(<ItensDoTermo itens={[]} modo="preco" linhas={{}} onChange={onChange} semItem={[]} onSemItemChange={() => {}} />);
    expect(screen.getByText(/Cadastre-os em Itens\/Lotes/)).toBeInTheDocument();
  });
});
