import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppHeader from './AppHeader';

/**
 * A navegação mudou de lugar três vezes em 13/09 (topo → coluna → topo). Estes
 * casos travam o que não pode se perder em NENHUMA das formas — são os mesmos
 * que o `AppSidebar.test.tsx` protegia, migrados para cá quando a coluna saiu:
 *
 *  - os itens do cabeçalho existem e levam aonde prometem;
 *  - rota que o membro não pode abrir não aparece no menu;
 *  - existe UMA busca, e ela é a mesma do Ctrl+K;
 *  - o celular tem acionador de menu, e ele abre o mesmo diretório.
 *
 * Existem porque a verificação visual depende de uma conta COM permissões — na
 * captura automatizada `canAccessRoute` nega tudo e o cabeçalho aparece
 * (corretamente) sem o "Painel", o que não prova nada.
 */
const permissoes = {
  canAccessRoute: (_: string) => true,
  isAdmin: true,
  loading: false,
};

vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => permissoes,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'rafael@praefectus.com.br', user_metadata: { nome_completo: 'Rafael Lima' } },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({
    empresas: [
      { empresa_id: 'e1', papel: 'admin', empresa: { id: 'e1', razao_social: 'ETHOS LTDA', nome_fantasia: 'ETHOS', cnpj: '00.000.000/0001-00' } },
    ],
    empresaAtiva: { id: 'e1', razao_social: 'ETHOS LTDA', nome_fantasia: 'ETHOS' },
    todasSelecionadas: false,
    setEmpresaAtiva: vi.fn(),
  }),
}));
// O seletor de empresa pergunta se é a conta de engenharia (19/09); aqui não é.
vi.mock('@/hooks/useContaDeEngenharia', () => ({
  useContaDeEngenharia: () => ({ ehContaDeEngenharia: false, carregando: false }),
}));

vi.mock('@/hooks/useAvatarPerfil', () => ({ useAvatarUrl: () => null }));

// Exportação de dados fala com o Supabase e não é o assunto aqui; o que
// importa é que o item continua dentro do menu da conta.
vi.mock('@/components/export/ExportarDados', () => ({
  default: () => <button type="button">Exportar meus dados</button>,
}));

const aoAbrirFerramentas = vi.fn();
const aoAbrirNotificacoes = vi.fn();
const aoAbrirMeuPerfil = vi.fn();

const montar = (rota = '/dashboard', naoLidas = 0) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <AppHeader
        naoLidas={naoLidas}
        aoAbrirNotificacoes={aoAbrirNotificacoes}
        aoAbrirMeuPerfil={aoAbrirMeuPerfil}
        aoAbrirFerramentas={aoAbrirFerramentas}
      />
    </MemoryRouter>,
  );

describe('AppHeader — o cabeçalho horizontal', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    permissoes.loading = false;
    vi.clearAllMocks();
  });

  it('mostra os itens do cabeçalho: marca, navegação, busca, avisos, empresa e perfil', () => {
    montar();
    expect(screen.getByLabelText('Praefectus — página inicial')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Painel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ferramentas' })).toBeTruthy();
    expect(screen.getByLabelText('Buscar no sistema')).toBeTruthy();
    expect(screen.getByLabelText('Notificações')).toBeTruthy();
    expect(screen.getByText('ETHOS')).toBeTruthy();
    expect(screen.getByLabelText('Minha conta')).toBeTruthy();
  });

  it('"Painel" leva à rota real do painel, e não à landing pública', () => {
    montar('/kanban');
    expect(screen.getByRole('link', { name: 'Painel' }).getAttribute('href')).toBe('/dashboard');
    // A marca leva ao mesmo lugar — é a raiz, não um segundo item de menu.
    expect(
      screen.getByLabelText('Praefectus — página inicial').getAttribute('href'),
    ).toBe('/dashboard');
  });

  it('"Ferramentas" pede a abertura do menu global', () => {
    montar('/kanban');
    fireEvent.click(screen.getByRole('button', { name: 'Ferramentas' }));
    expect(aoAbrirFerramentas).toHaveBeenCalledTimes(1);
  });

  it('acende o item da vez com o sublinhado, sem acender os dois', () => {
    const { unmount } = montar('/dashboard');
    expect(screen.getByRole('link', { name: 'Painel' }).getAttribute('aria-current')).toBe('page');
    unmount();

    // Dentro de uma função do diretório, quem acende é "Ferramentas".
    montar('/gestao-contratos');
    expect(screen.getByRole('link', { name: 'Painel' }).getAttribute('aria-current')).toBeNull();
  });

  it('tem UMA busca, e ela dispara o mesmo diálogo do Ctrl+K', () => {
    const ouvinte = vi.fn();
    window.addEventListener('praefectus:abrir-busca', ouvinte);
    montar();
    const buscas = screen.getAllByLabelText('Buscar no sistema');
    expect(buscas).toHaveLength(1);
    fireEvent.click(buscas[0]);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener('praefectus:abrir-busca', ouvinte);
  });

  it('o Painel aparece para toda sessão, mesmo sem membro cadastrado', () => {
    /* Este caso mudou de sentido em 13/09, e o motivo é a captura.
     *
     * O cabeçalho escondia o "Painel" quando `canAccessRoute('/dashboard')`
     * negava — o que acontece sempre que não há linha em `empresa_membros`:
     * convite recém-aceito, nenhuma empresa ativa, falha transitória na carga
     * do membro. Na captura o resultado apareceu inteiro: um cabeçalho com um
     * item só, "Ferramentas", e nenhum caminho de volta visível, justamente
     * para quem está mais perdido.
     *
     * Para tela de módulo, esconder o que não se pode abrir é o correto. Para
     * a RAIZ, não — e a rota já a trata como aberta aos oito setores
     * (`route-permissions.ts`). Quem barra a entrada segue sendo o guard; o
     * cabeçalho não é camada de segurança e nunca foi.
     */
    permissoes.canAccessRoute = () => false;
    montar('/kanban');
    expect(screen.getByRole('link', { name: 'Painel' })).toBeTruthy();
    // O caminho para o diretório continua — ele filtra o que mostra por conta.
    expect(screen.getByRole('button', { name: 'Ferramentas' })).toBeTruthy();
  });

  it('esconde do menu da conta o item exclusivo de administrador', () => {
    permissoes.isAdmin = false;
    montar();
    fireEvent.click(screen.getByLabelText('Minha conta'));
    expect(screen.queryByText('Definir metas')).toBeNull();
    expect(screen.getByText('Equipe')).toBeTruthy();
  });

  it('mostra o acionador de menu do celular, ligado ao mesmo diretório', () => {
    montar();
    const acionador = screen.getByLabelText('Abrir menu');
    expect(acionador).toBeTruthy();
    fireEvent.click(acionador);
    expect(aoAbrirFerramentas).toHaveBeenCalledTimes(1);
  });

  it('preserva o menu do perfil inteiro — seções, exportação e saída', () => {
    montar();
    fireEvent.click(screen.getByLabelText('Minha conta'));
    for (const secao of ['Conta', 'Empresa', 'Preferências', 'Plataforma']) {
      expect(screen.getByText(secao)).toBeTruthy();
    }
    expect(screen.getByText('Exportar meus dados')).toBeTruthy();
    expect(screen.getByText('Sair da conta')).toBeTruthy();

    fireEvent.click(screen.getByText('Meu Perfil'));
    expect(aoAbrirMeuPerfil).toHaveBeenCalledTimes(1);
  });

  it('anuncia a contagem de avisos não lidos no rótulo, não só no desenho', () => {
    montar('/dashboard', 3);
    expect(screen.getByLabelText('Notificações — 3 não lidas')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Notificações — 3 não lidas'));
    expect(aoAbrirNotificacoes).toHaveBeenCalledTimes(1);
  });
});
