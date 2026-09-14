import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuDeFerramentas from './MenuDeFerramentas';

/**
 * O painel "Todas as ferramentas" tem duas naturezas de defeito, e nenhuma
 * delas aparece numa captura de tela:
 *
 *  1. VAZAMENTO — mostrar uma função que a pessoa não pode abrir. O diretório
 *     lista o sistema inteiro, então é o lugar mais fácil de o filtro de
 *     permissão falhar; e a busca é uma segunda porta para a mesma lista, que
 *     precisa do mesmo filtro. O RLS impediria o estrago, mas quem clicasse
 *     bateria num "Acesso Restrito" sem entender por quê.
 *
 *  2. ARMADILHA DE FOCO — sobreposição modal que não devolve o foco ao
 *     acionador deixa o teclado na página de baixo, escondida. Ninguém testa
 *     isso à mão, e quebra em silêncio a cada refactor do fechamento.
 *
 * O resto trava o que o comando pediu com todas as letras: acento na busca,
 * estrela que não navega, recentes sem repetição.
 */

const permissoes = { canAccessRoute: (_: string) => true, isAdmin: true };

vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => permissoes,
}));

// O hook de preferências é o real — é ele que garante "sem duplicar" e o
// limite de cinco. Só os contextos de onde ele tira a chave são simulados.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'e1' } }),
}));

const montar = (rota = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      {/* Um botão antes do gatilho: se o foco escapar da sobreposição ou não
          voltar ao acionador, ele é onde o foco costuma cair. */}
      <button type="button">fora</button>
      <MenuDeFerramentas />
    </MemoryRouter>,
  );

const gatilho = () => screen.getByRole('button', { name: 'Todas as ferramentas' });
const painel = () => screen.queryByRole('dialog', { name: 'Todas as ferramentas' });

const abrir = () => {
  fireEvent.click(gatilho());
  return screen.getByRole('dialog', { name: 'Todas as ferramentas' });
};

const digitar = (texto: string) =>
  fireEvent.change(screen.getByLabelText('Buscar ferramenta'), { target: { value: texto } });

describe('MenuDeFerramentas — abrir e fechar', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    window.localStorage.clear();
    document.body.style.overflow = '';
  });

  it('abre pelo botão e fecha pela tecla Escape', () => {
    montar();
    expect(painel()).toBeNull();
    abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(painel()).toBeNull();
  });

  it('fecha ao clicar no fundo escurecido', () => {
    montar();
    abrir();
    fireEvent.click(screen.getByTestId('menu-ferramentas-fundo'));
    expect(painel()).toBeNull();
  });

  it('devolve o foco ao acionador ao fechar', () => {
    montar();
    gatilho().focus();
    fireEvent.click(gatilho());
    // Aberto, o foco vai para a busca — é o que o atalho promete.
    expect(document.activeElement).toBe(screen.getByLabelText('Buscar ferramenta'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(gatilho());
  });

  it('bloqueia a rolagem da página enquanto está aberto', () => {
    montar();
    abrir();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('abre pelo Ctrl+Shift+K, e não pelo Ctrl+K da busca global', () => {
    montar();
    // Ctrl+K é de `GlobalSearch`, que continua montado em toda tela interna.
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(painel()).toBeNull();
    // Com Shift o navegador entrega 'K' maiúsculo — é o que separa os dois.
    fireEvent.keyDown(document, { key: 'K', ctrlKey: true, shiftKey: true });
    expect(painel()).toBeTruthy();
  });
});

describe('MenuDeFerramentas — sob controle do cabeçalho', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    window.localStorage.clear();
  });

  /**
   * É assim que o `AppLayout` o monta: quem tem o botão "Ferramentas" é o
   * `AppHeader`, e o painel recebe `aberto`/`aoFechar`. Neste modo o componente
   * não pode desenhar um segundo acionador — e o atalho de teclado tem que
   * continuar abrindo, porque daqui ele não consegue escrever no estado do pai.
   */
  it('não desenha acionador próprio e avisa o pai ao fechar', () => {
    const aoFechar = vi.fn();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MenuDeFerramentas aberto aoFechar={aoFechar} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Todas as ferramentas' })).toBeNull();
    expect(painel()).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('o atalho abre mesmo com o pai dizendo que está fechado', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MenuDeFerramentas aberto={false} aoFechar={() => {}} />
      </MemoryRouter>,
    );
    expect(painel()).toBeNull();
    fireEvent.keyDown(document, { key: 'K', ctrlKey: true, shiftKey: true });
    expect(painel()).toBeTruthy();
  });
});

describe('MenuDeFerramentas — busca', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    window.localStorage.clear();
  });

  it('ignora acento e caixa', () => {
    montar();
    abrir();
    digitar('PRECIFICACAO');
    const semAcento = screen.getAllByRole('link', { name: /Precificação/ }).length;
    digitar('precificação');
    expect(screen.getAllByRole('link', { name: /Precificação/ })).toHaveLength(semAcento);
    expect(semAcento).toBeGreaterThan(0);
  });

  it('acha pelo sinônimo, não só pelo nome da tela', () => {
    montar();
    abrir();
    digitar('pncp');
    expect(screen.getByRole('link', { name: /Editais & Licitações/ })).toBeTruthy();
  });

  it('oferece limpar quando não encontra nada', () => {
    montar();
    abrir();
    digitar('zzzznaoexiste');
    expect(screen.getByText('Nenhuma ferramenta encontrada.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(screen.queryByText('Nenhuma ferramenta encontrada.')).toBeNull();
    // Voltou ao diretório — a categoria reaparece.
    expect(screen.getByRole('button', { name: /Inteligência/ })).toBeTruthy();
  });
});

describe('MenuDeFerramentas — permissão', () => {
  beforeEach(() => {
    window.localStorage.clear();
    permissoes.isAdmin = true;
  });

  it('função não autorizada não aparece no diretório NEM pela busca', () => {
    // O painel do operador do SaaS é a rota que mais volta a vazar: o grupo
    // inteiro tem que sumir, e a busca é a segunda porta para a mesma lista.
    permissoes.canAccessRoute = (path) => !path.startsWith('/admin');
    montar();
    abrir();
    expect(screen.queryByRole('link', { name: /Métricas SaaS/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Admin/ })).toBeNull();

    digitar('metricas');
    expect(screen.queryByRole('link', { name: /Métricas SaaS/ })).toBeNull();
    expect(screen.getByText('Nenhuma ferramenta encontrada.')).toBeTruthy();
  });

  it('item adminOnly some para quem não administra a empresa', () => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = false;
    montar();
    abrir();
    // "Definir metas" é `adminOnly` no menu da conta: rota aberta, item fechado.
    digitar('definir metas');
    expect(screen.queryByRole('link', { name: /Definir metas/ })).toBeNull();
  });
});

describe('MenuDeFerramentas — favoritos e recentes', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    window.localStorage.clear();
  });

  it('a estrela favorita sem navegar e sem fechar o painel', () => {
    montar();
    abrir();
    digitar('kanban');
    const estrela = screen.getByRole('button', { name: 'Adicionar Kanban aos favoritos' });

    // A estrela mora FORA do link — âncora dentro de âncora é HTML inválido, e
    // é o erro que faria o clique navegar.
    expect(estrela.closest('a')).toBeNull();

    fireEvent.click(estrela);
    expect(painel()).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remover Kanban dos favoritos' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('favoritar alimenta a seção de Favoritos, com estado vazio antes disso', () => {
    montar();
    abrir();
    const favoritos = screen.getByRole('region', { name: 'Favoritos' });
    expect(
      within(favoritos).getByText(/Nenhum favorito/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Kanban aos favoritos' }));
    expect(
      within(screen.getByRole('region', { name: 'Favoritos' })).getByRole('link', {
        name: /Kanban/,
      }),
    ).toBeTruthy();
  });

  it('recentes não duplicam a mesma ferramenta', () => {
    montar();
    abrir();
    const recentes = screen.getByRole('region', { name: 'Recentes' });
    expect(within(recentes).getByText(/Nada aberto ainda/)).toBeTruthy();

    // Abrir a mesma ferramenta duas vezes registra UM recente, não dois — senão
    // a lista de cinco viraria cinco linhas iguais.
    for (let i = 0; i < 2; i++) {
      abrir();
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Todas as ferramentas' })).getAllByRole('link', {
          name: /Kanban/,
        })[0],
      );
    }

    abrir();
    expect(
      within(screen.getByRole('region', { name: 'Recentes' })).getAllByRole('link', {
        name: /Kanban/,
      }),
    ).toHaveLength(1);
  });
});
