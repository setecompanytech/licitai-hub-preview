import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppHeader from './AppHeader';

/**
 * A topbar do Design System v3 (19/09/2026). A navegação saiu daqui e foi para
 * a `AppSidebar`; estes casos travam o que a barra ainda responde e não pode
 * se perder:
 *
 *  - diz onde a pessoa está (o nome do módulo);
 *  - existe UMA busca, e ela é a mesma do Ctrl+K;
 *  - avisos, empresa e conta continuam nela, com os mesmos rótulos;
 *  - o celular tem o acionador da gaveta de navegação e a marca.
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
const aoAbrirMenuMovel = vi.fn();

const montar = (rota = '/dashboard', naoLidas = 0) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <AppHeader
        naoLidas={naoLidas}
        aoAbrirNotificacoes={aoAbrirNotificacoes}
        aoAbrirMeuPerfil={aoAbrirMeuPerfil}
        aoAbrirFerramentas={aoAbrirFerramentas}
        aoAbrirMenuMovel={aoAbrirMenuMovel}
      />
    </MemoryRouter>,
  );

describe('AppHeader — a topbar', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    permissoes.loading = false;
    vi.clearAllMocks();
  });

  it('mostra os itens da barra: marca, busca, ferramentas, avisos, empresa e conta', () => {
    montar();
    expect(screen.getByLabelText('Praefectus — página inicial')).toBeTruthy();
    expect(screen.getByLabelText('Buscar no sistema')).toBeTruthy();
    expect(screen.getByLabelText('Todas as ferramentas')).toBeTruthy();
    expect(screen.getByLabelText('Notificações')).toBeTruthy();
    expect(screen.getByText('ETHOS')).toBeTruthy();
    expect(screen.getByLabelText('Minha conta')).toBeTruthy();
  });

  it('a marca leva à rota real do painel, e não à landing pública', () => {
    montar('/kanban');
    expect(screen.getByLabelText('Praefectus — página inicial').getAttribute('href')).toBe('/dashboard');
  });

  it('diz onde a pessoa está: o nome pleno do módulo do registro', () => {
    const { unmount } = montar('/dashboard');
    expect(screen.getByText('Painel da empresa')).toBeTruthy();
    unmount();

    montar('/gestao-contratos');
    expect(screen.getByText('Gestão de contratos')).toBeTruthy();
  });

  it('"Todas as ferramentas" pede a abertura do diretório', () => {
    montar('/kanban');
    fireEvent.click(screen.getByLabelText('Todas as ferramentas'));
    expect(aoAbrirFerramentas).toHaveBeenCalledTimes(1);
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

  it('esconde do menu da conta o item exclusivo de administrador', () => {
    permissoes.isAdmin = false;
    montar();
    fireEvent.click(screen.getByLabelText('Minha conta'));
    expect(screen.queryByText('Definir metas')).toBeNull();
    expect(screen.getByText('Equipe')).toBeTruthy();
  });

  it('mostra o acionador da gaveta de navegação do celular', () => {
    montar();
    const acionador = screen.getByLabelText('Abrir menu');
    expect(acionador).toBeTruthy();
    fireEvent.click(acionador);
    expect(aoAbrirMenuMovel).toHaveBeenCalledTimes(1);
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
