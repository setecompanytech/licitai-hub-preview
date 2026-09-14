import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { VAGAS_PREVISTAS } from '@/lib/documentos/previstos';

/**
 * O que este arquivo protege no Controle de Documentos, depois da
 * reestruturação de 14/09. Cada caso corresponde a um defeito real:
 *
 *  1. As CINCO abas existem e a aba mora em `?aba=` — com `useState`, voltar de
 *     um documento recomeçava sempre no checklist, e link de aba não existia.
 *  2. Os indicadores saem dos DADOS. "Itens previstos" é
 *     `VAGAS_PREVISTAS.length`, não o número 18 copiado do desenho: a lista
 *     muda quando a exigência muda, e o número tem de mudar junto.
 *  3. "Regulares" DECLARA o subconjunto que vence em até 30 dias — ele está
 *     dentro do total e não pode ser somado de novo.
 *  4. Documento com arquivo, que vence por natureza e está SEM data NÃO conta
 *     como regular. Antes contava, e inflava a conformidade em silêncio.
 *  5. Vaga prevista SEM arquivo aparece na tabela. A lista é das vagas, não dos
 *     arquivos — é o vazio que precisa ser visto.
 *  6. Abrir o painel não custa a busca nem os filtros.
 *  7. A aba Histórico (trilha de auditoria) não existe para quem não é Admin.
 */

// ── Dados de teste ─────────────────────────────────────────────────────────
// Datas relativas a HOJE, e não fixas: a classificação depende do dia corrente,
// e um teste com data cravada apodrece em silêncio no próximo mês.
const diaISO = (deslocamento: number) => {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const NOMES = {
  cnd: 'Certidão Negativa de Débitos Federais (CND)',
  crf: 'Certidão de Regularidade do FGTS (CRF)',
  cndt: 'CNDT – Certidão Trabalhista',
  estaduais: 'Certidão Negativa de Débitos Estaduais',
  contrato: 'Ato Constitutivo / Contrato Social',
  meEpp: 'Declaração ME/EPP (se aplicável)',
};

const dados = vi.hoisted(() => ({ linhas: [] as Record<string, unknown>[] }));

function linha(nome: string, validade: string | null) {
  return {
    id: `id-${nome.slice(0, 8)}`,
    nome,
    validade,
    arquivo_path: `empresa/e1/${nome.slice(0, 6)}.pdf`,
    empresa_id: 'e1',
    user_id: 'u1',
    tamanho_bytes: 120_000,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-02T10:00:00Z',
    descricao: null,
  };
}

vi.mock('@/integrations/supabase/client', () => {
  const consulta = () => {
    const elo: Record<string, unknown> = {};
    // A cadeia real da tela: `.select(...).or(...).abortSignal(signal)`, e só
    // então o `await`. O dublê precisa aceitar exatamente esses elos.
    ['select', 'or', 'eq', 'order', 'limit', 'abortSignal', 'insert', 'update', 'delete']
      .forEach((m) => { elo[m] = () => elo; });
    elo.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: dados.linhas, error: null }).then(ok);
    return elo;
  };
  const canal: Record<string, unknown> = {};
  canal.on = () => canal;
  canal.subscribe = () => canal;
  return {
    supabase: {
      from: () => consulta(),
      channel: () => canal,
      removeChannel: () => undefined,
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null }),
          download: async () => ({ data: null, error: null }),
          createSignedUrl: async () => ({ data: null, error: null }),
          move: async () => ({ error: null }),
        }),
      },
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});

// ⚠️ Referências ESTÁVEIS entre renders: um objeto novo a cada chamada faz o
// `useEffect([user, empresaAtiva])` recarregar sem parar, e o teste trava em
// vez de falhar.
const sessao = vi.hoisted(() => ({
  user: { id: 'u1' },
  empresa: {
    empresaAtiva: { id: 'e1', razao_social: 'Empresa de Teste', nome_fantasia: 'Teste' },
    empresas: [],
    todasSelecionadas: false,
    setEmpresaAtiva: () => undefined,
  },
  autorizacao: { isCompanyAdmin: true },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: sessao.user }) }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => sessao.empresa }));
vi.mock('@/hooks/useAuthorization', () => ({
  useAuthorization: () => sessao.autorizacao,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// A moldura e os conteúdos das outras abas não são o objeto deste teste — e
// carregá-los traria consulta, worker de PDF e upload para dentro do jsdom.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/shared/ProcessoContextoBanner', () => ({ default: () => null }));
vi.mock('@/components/documentos/AtestadosCapacidadeTecnica', () => ({
  default: () => <div>conteúdo de atestados</div>,
}));
vi.mock('@/components/documentos/MergeDocumentos', () => ({
  default: () => <div>conteúdo de unir arquivos</div>,
}));
vi.mock('@/components/documentos/AlertasVencimentoEmail', () => ({
  default: () => <div>conteúdo de alertas</div>,
}));
vi.mock('@/components/documentos/HistoricoDocumentos', () => ({
  default: () => <div>conteúdo do histórico</div>,
}));

import Documentos from './Documentos';

/** Janela larga: o painel de detalhes cabe ao lado da tabela (>= 1280px). */
function janelaLarga() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function montar(rota = '/documentos') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Documentos />
    </MemoryRouter>,
  );
}

/**
 * O cartão de um indicador. Ele é um `button` (clicar filtra a tabela), e é por
 * isso que o rótulo é procurado dentro de um — os mesmos textos aparecem também
 * na legenda da barra de conformidade e nos selos das linhas.
 */
function indicador(rotulo: string) {
  const cartao = screen.getAllByText(rotulo)
    .map((e) => e.closest('button'))
    .find((b): b is HTMLButtonElement => b !== null);
  if (!cartao) throw new Error(`Indicador "${rotulo}" não é um cartão clicável`);
  return cartao;
}

/** A linha da tabela que contém um texto. */
function linhaDaTabela(texto: string) {
  const alvo = screen.getAllByText(texto)[0].closest('tr');
  if (!alvo) throw new Error(`Sem linha de tabela para "${texto}"`);
  return alvo as HTMLElement;
}

const aTabela = () => screen.getByRole('table', { name: /Checklist de documentos/i });

/**
 * As linhas de registro. NÃO dá para usar `getAllByRole('row')`: quando a
 * tabela é selecionável, `TabelaGestao` marca cada `<tr>` com `role="button"`,
 * e o papel explícito apaga o de linha.
 */
const linhasDeRegistro = () => aTabela().querySelectorAll('tbody tr');

/** O painel lateral do documento aberto. `<aside>` = papel `complementary`. */
const oPainel = (nome: string) =>
  screen.getByRole('complementary', { name: nome });

describe('Controle de Documentos — abas, indicadores e tabela', () => {
  beforeEach(() => {
    janelaLarga();
    sessao.autorizacao.isCompanyAdmin = true;
    dados.linhas = [
      linha(NOMES.cnd, diaISO(300)),        // regular, folgado
      linha(NOMES.crf, diaISO(10)),         // regular, mas vence dentro de 30 dias
      linha(NOMES.cndt, diaISO(-5)),        // vencido
      linha(NOMES.estaduais, null),         // vence por natureza e está sem data
      linha(NOMES.contrato, null),          // não vence por natureza
    ];
  });

  it('oferece as cinco abas e guarda a aba aberta na URL', async () => {
    montar();
    await screen.findByText(NOMES.cnd);

    for (const nome of ['Documentos', 'Atestados', 'Unir arquivos', 'Alertas', 'Histórico']) {
      expect(screen.getByRole('tab', { name: nome })).toBeInTheDocument();
    }
    expect(screen.getByRole('tab', { name: 'Documentos' })).toHaveAttribute('aria-selected', 'true');
  });

  it('abre direto na aba do link (`?aba=`) — deep-link e Voltar do navegador', async () => {
    montar('/documentos?aba=merge');
    expect(await screen.findByText('conteúdo de unir arquivos')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Unir arquivos' })).toHaveAttribute('aria-selected', 'true');
    // A aba de documentos não fica montada por baixo.
    expect(screen.queryByRole('table', { name: /Checklist de documentos/i })).toBeNull();
  });

  it('abre a aba de alertas e a de atestados pelo mesmo parâmetro', async () => {
    const { unmount } = montar('/documentos?aba=alertas');
    expect(await screen.findByText('conteúdo de alertas')).toBeInTheDocument();
    unmount();

    montar('/documentos?aba=atestados');
    expect(await screen.findByText('conteúdo de atestados')).toBeInTheDocument();
  });

  it('tira os números dos DADOS, não de literal — "previstos" é o tamanho do checklist', async () => {
    montar();
    await screen.findByText(NOMES.cnd);

    const previstos = String(VAGAS_PREVISTAS.length);
    expect(within(indicador('Itens previstos')).getByText(previstos)).toBeInTheDocument();

    // Cinco vagas têm arquivo nos dados acima; o resto é ausência, e a conta
    // sai da lista — não de um número escrito à mão.
    const ausentesEsperados = String(VAGAS_PREVISTAS.length - 5);
    expect(within(indicador('Ausentes')).getByText(ausentesEsperados)).toBeInTheDocument();

    // Os quatro baldes fecham com o total: 3 regulares + 1 vencido + 1 sem
    // validade + os ausentes.
    expect(within(indicador('Regulares')).getByText('3')).toBeInTheDocument();
    expect(within(indicador('Vencidos')).getByText('1')).toBeInTheDocument();
  });

  it('"Regulares" declara o subconjunto que vence, sem somá-lo de novo', async () => {
    montar();
    await screen.findByText(NOMES.cnd);

    const cartao = indicador('Regulares');
    // Três regulares: o folgado, o que vence em 10 dias e o que não vence por
    // natureza. O que vence em breve está DENTRO destes três.
    expect(within(cartao).getByText('3')).toBeInTheDocument();
    expect(
      within(cartao).getByText(/1 vence nos próximos 30 dias \(já contados aqui\)/i),
    ).toBeInTheDocument();

    // E a regra aparece por extenso abaixo da faixa.
    expect(
      screen.getByText(/subconjunto de .Regulares. e não soma de novo no total/i),
    ).toBeInTheDocument();
  });

  it('documento sem validade informada NÃO conta como regular', async () => {
    montar();
    await screen.findByText(NOMES.estaduais);

    // Tem balde próprio, com 1 — e não está entre os 3 regulares.
    expect(within(indicador('Validade não informada')).getByText('1')).toBeInTheDocument();
    expect(within(indicador('Regulares')).queryByText('4')).toBeNull();

    // Na linha, a ausência é DITA: nem célula vazia, nem selo verde.
    const linhaSemData = linhaDaTabela(NOMES.estaduais);
    expect(within(linhaSemData).getByText('Não informada')).toBeInTheDocument();
    expect(within(linhaSemData).getByText('Validade não informada')).toBeInTheDocument();

    // O documento que não vence por natureza é outra coisa, e diz outra coisa.
    const linhaContrato = linhaDaTabela(NOMES.contrato);
    expect(within(linhaContrato).getByText('Não se aplica')).toBeInTheDocument();
    expect(within(linhaContrato).getByText('Sem vencimento')).toBeInTheDocument();
  });

  it('a vaga prevista SEM arquivo aparece na tabela, como ausente', async () => {
    montar();
    await screen.findByText(NOMES.cnd);

    // A tabela lista o checklist inteiro, não só o que foi enviado.
    expect(linhasDeRegistro().length).toBe(VAGAS_PREVISTAS.length);

    const vazia = linhaDaTabela(NOMES.meEpp);
    expect(within(vazia).getByText('Ausente')).toBeInTheDocument();
    expect(within(vazia).getByText('Sem arquivo')).toBeInTheDocument();
    expect(within(vazia).getByRole('button', { name: /Anexar arquivo de/i })).toBeInTheDocument();
  });

  it('não põe caixa de seleção: não há ação em lote nesta tela', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    // Marcar linha sem poder agir sobre o conjunto é controle que promete o que
    // não cumpre — a prévia mostrava um, e ele ficou de fora de propósito.
    expect(within(aTabela()).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('abrir o painel de detalhes não perde a busca nem o recorte da lista', async () => {
    montar();
    await screen.findByText(NOMES.cnd);

    const busca = screen.getByPlaceholderText('Buscar documento pelo nome');
    fireEvent.change(busca, { target: { value: 'CND' } });

    // Duas vagas casam com "CND": a federal e a trabalhista.
    await waitFor(() => expect(linhasDeRegistro().length).toBe(2));

    fireEvent.click(screen.getAllByText(NOMES.cnd)[0]);

    // O painel abriu…
    expect(await screen.findByRole('heading', { name: NOMES.cnd })).toBeInTheDocument();
    // …e nada do contexto se perdeu.
    expect((busca as HTMLInputElement).value).toBe('CND');
    expect(linhasDeRegistro().length).toBe(2);
    expect(screen.queryByText(NOMES.meEpp)).toBeNull();
  });

  it('o painel mostra os campos do documento, incluindo a última atualização', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOMES.cnd)[0]);
    await screen.findByRole('heading', { name: NOMES.cnd });

    const painel = oPainel(NOMES.cnd);
    expect(within(painel).getByText('Última atualização')).toBeInTheDocument();
    expect(within(painel).getByText('Regularidade Fiscal')).toBeInTheDocument();
    // Emissão não existe na tabela `documentos`: a tela DIZ isso em vez de
    // mostrar a data do upload no lugar dela.
    expect(
      within(painel).getByText(/Não registrada — o cofre guarda a validade/i),
    ).toBeInTheDocument();
  });

  it('esconde a aba Histórico de quem não é Admin da empresa', async () => {
    sessao.autorizacao.isCompanyAdmin = false;
    montar();
    await screen.findByText(NOMES.cnd);

    expect(screen.queryByRole('tab', { name: 'Histórico' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('não apresenta a conformidade como garantia de habilitação', async () => {
    montar();
    await screen.findByText(NOMES.cnd);

    expect(screen.getByText(/Não é garantia de habilitação/i)).toBeInTheDocument();
    // A composição do percentual fica declarada, com o denominador à vista.
    expect(
      screen.getByText(new RegExp(`3 de ${VAGAS_PREVISTAS.length} itens previstos`, 'i')),
    ).toBeInTheDocument();
  });
});

describe('Controle de Documentos — modo "Todas as empresas"', () => {
  beforeEach(() => {
    janelaLarga();
    sessao.autorizacao.isCompanyAdmin = true;
    dados.linhas = [];
  });

  it('avisa em vez de esconder o cofre em silêncio', async () => {
    const anterior = { ...sessao.empresa };
    Object.assign(sessao.empresa, {
      empresaAtiva: null,
      todasSelecionadas: true,
      empresas: [
        { empresa_id: 'e1', empresa: { nome_fantasia: 'Alfa', razao_social: 'Alfa LTDA' } },
        { empresa_id: 'e2', empresa: { nome_fantasia: null, razao_social: 'Beta LTDA' } },
      ],
    });

    try {
      montar();
      // O antigo comportamento era cair no ramo `user_id` puro e mostrar 18
      // vagas ausentes — o cofre da empresa sumia sem uma palavra.
      expect(
        await screen.findByText(/O checklist de habilitação é de uma empresa por vez/i),
      ).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: /Checklist de documentos/i })).toBeNull();

      // Os indicadores não inventam zero: dizem que não apuraram, e por quê.
      expect(
        screen.getAllByText(/Escolha uma empresa — o cofre é de uma empresa por vez/i).length,
      ).toBeGreaterThan(0);

      // E a tela oferece a saída: escolher a empresa ali mesmo.
      expect(screen.getByRole('button', { name: 'Alfa' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Beta LTDA' })).toBeInTheDocument();
    } finally {
      Object.assign(sessao.empresa, anterior);
    }
  });
});
