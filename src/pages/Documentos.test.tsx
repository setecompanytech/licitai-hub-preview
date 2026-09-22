import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

const dados = vi.hoisted(() => ({
  linhas: [] as Record<string, unknown>[],
  /** Quando preenchido, a consulta falha — como o banco falhando de verdade. */
  erro: null as { message: string } | null,
  /** As solicitações ao órgão (`documentos_solicitacoes`) da empresa. */
  solicitacoes: [] as Record<string, unknown>[],
  /** Erro na leitura das solicitações — tabela ausente ou falha de verdade. */
  erroSolicitacoes: null as { code?: string; message: string } | null,
  /** Os órgãos municipais cadastrados pela empresa (`certidoes_orgaos_da_empresa`). */
  orgaos: [] as Record<string, unknown>[],
  erroOrgaos: null as { code?: string; message: string } | null,
  /** Toda escrita que a tela tentou, por tabela — para conferir o que foi gravado. */
  gravadas: [] as Array<{ tabela: string; op: string; valores: unknown }>,
}));

/** Os `mailto:` que a tela entregou ao programa de e-mail. */
const emails = vi.hoisted(() => ({ abertos: [] as string[] }));
vi.mock('@/lib/navegacao/abrir-email', () => ({
  abrirEmail: (mailto: string) => { emails.abertos.push(mailto); },
}));

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
  const consulta = (tabela: string) => {
    const elo: Record<string, unknown> = {};
    let escrita = false;
    // A cadeia real da tela: `.select(...).or(...).abortSignal(signal)`, e só
    // então o `await`. O dublê precisa aceitar exatamente esses elos.
    ['select', 'or', 'eq', 'is', 'order', 'limit', 'abortSignal']
      .forEach((m) => { elo[m] = () => elo; });
    ['insert', 'update', 'delete'].forEach((op) => {
      elo[op] = (valores?: unknown) => {
        escrita = true;
        dados.gravadas.push({ tabela, op, valores });
        return elo;
      };
    });
    // Cada tabela responde com os SEUS dados: as solicitações não podem vir
    // do dublê dos documentos, nem o contrário.
    const resposta = () => {
      if (tabela === 'documentos_solicitacoes') {
        if (dados.erroSolicitacoes) return { data: null, error: dados.erroSolicitacoes };
        return { data: escrita ? [{ id: 'gravada' }] : dados.solicitacoes, error: null };
      }
      if (tabela === 'certidoes_orgaos_da_empresa') {
        if (dados.erroOrgaos) return { data: null, error: dados.erroOrgaos };
        return { data: escrita ? [{ id: 'gravada' }] : dados.orgaos, error: null };
      }
      if (tabela === 'documentos') return { data: dados.erro ? null : dados.linhas, error: dados.erro };
      return { data: [], error: null };
    };
    elo.then = (ok: (v: unknown) => unknown) => Promise.resolve(resposta()).then(ok);
    return elo;
  };
  const canal: Record<string, unknown> = {};
  canal.on = () => canal;
  canal.subscribe = () => canal;
  return {
    supabase: {
      from: (tabela: string) => consulta(tabela),
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
    // O domicílio fiscal (UF e município) vem do cadastro da empresa: é ele
    // que decide o órgão estadual e o municipal de cada vaga.
    empresaAtiva: {
      id: 'e1', razao_social: 'Empresa de Teste', nome_fantasia: 'Teste', cnpj: '24687187000101',
      uf: 'PA' as string | null, municipio: 'Belém' as string | null,
    },
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
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

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

/** Um pedido ao órgão, aberto, para a vaga. */
function pedido(nome: string, prazo: string | null, extra: Record<string, unknown> = {}) {
  return {
    id: `sol-${nome.slice(0, 6)}`,
    empresa_id: 'e1',
    documento_nome: nome,
    orgao: 'Prefeitura Municipal de Belém · Secretaria de Finanças',
    email_destino: 'sefin@belem.pa.gov.br',
    solicitada_em: new Date().toISOString(),
    protocolo: null,
    prazo_resposta: prazo,
    observacao: null,
    user_id: 'u1',
    created_at: new Date().toISOString(),
    encerrada_em: null,
    ...extra,
  };
}

beforeEach(() => {
  // Tudo opt-in por teste: plantar um erro ou um pedido num caso não pode
  // contaminar os seguintes, senão a suíte passa a medir a ordem em que foi
  // escrita.
  dados.solicitacoes = [];
  dados.erroSolicitacoes = null;
  dados.orgaos = [];
  dados.erroOrgaos = null;
  dados.gravadas = [];
  emails.abertos = [];
});

describe('Controle de Documentos — abas, indicadores e tabela', () => {
  beforeEach(() => {
    dados.erro = null;
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

describe('Controle de Documentos — o órgão emissor de cada vaga', () => {
  const NOME_MUNICIPAL = 'Certidão Negativa de Débitos Municipais';

  beforeEach(() => {
    dados.erro = null;
    janelaLarga();
    sessao.autorizacao.isCompanyAdmin = true;
    sessao.empresa.empresaAtiva.uf = 'PA';
    sessao.empresa.empresaAtiva.municipio = 'Belém';
    dados.linhas = [linha(NOMES.cnd, diaISO(300))];
  });

  it('a CND federal leva à Receita/PGFN — o cofre aponta o órgão, não emite', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOMES.cnd)[0]);
    const painel = oPainel(NOMES.cnd);

    expect(within(painel).getByText('Órgão emissor')).toBeInTheDocument();
    expect(within(painel).getByText(/Receita Federal do Brasil/)).toBeInTheDocument();
    const link = within(painel).getByRole('link', { name: /Emitir no órgão/ });
    expect(link).toHaveAttribute('href', 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(painel).getByText('180 dias')).toBeInTheDocument();
  });

  it('a municipal de Belém sai por e-mail de solicitação, em nome da empresa — nunca pela prefeitura de outra cidade', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    const painel = oPainel(NOME_MUNICIPAL);

    expect(within(painel).getByText(/Prefeitura Municipal de Belém/)).toBeInTheDocument();
    expect(within(painel).getByText(/Solicitação ao órgão, com resposta em prazo/)).toBeInTheDocument();
    // O pedido é um botão (abre o diálogo que registra e endereça o e-mail —
    // o conteúdo do e-mail é conferido no bloco de solicitação, abaixo).
    expect(within(painel).getByRole('button', { name: /Solicitar por e-mail/ })).toBeInTheDocument();
    expect(within(painel).queryByText(/São Paulo/)).toBeNull();
    // O site do órgão (Agiliza, com login) fica como alternativa, não como o caminho principal.
    expect(within(painel).getByRole('link', { name: /Emitir no órgão/ })).toHaveAttribute('href', expect.stringContaining('belem.pa.gov.br'));
  });

  it('sem UF no cadastro, a estadual pede o domicílio em vez de escolher um', async () => {
    sessao.empresa.empresaAtiva.uf = null;
    sessao.empresa.empresaAtiva.municipio = null;
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOMES.estaduais)[0]);
    const painel = oPainel(NOMES.estaduais);

    expect(within(painel).getByText(/Informe a UF do domicílio fiscal/)).toBeInTheDocument();
    expect(within(painel).getByRole('link', { name: /Abrir o cadastro da empresa/ })).toHaveAttribute('href', '/configuracoes');
    expect(within(painel).queryByRole('link', { name: /Emitir no órgão/ })).toBeNull();
    // A federal continua apontando a Receita: a União não depende do domicílio.
    fireEvent.click(screen.getAllByText(NOMES.cnd)[0]);
    expect(within(oPainel(NOMES.cnd)).getByRole('link', { name: /Emitir no órgão/ })).toBeInTheDocument();
  });
});

describe('Controle de Documentos — solicitação ao órgão com protocolo e prazo', () => {
  const NOME_MUNICIPAL = 'Certidão Negativa de Débitos Municipais';

  beforeEach(() => {
    dados.erro = null;
    janelaLarga();
    sessao.autorizacao.isCompanyAdmin = true;
    sessao.empresa.empresaAtiva.uf = 'PA';
    sessao.empresa.empresaAtiva.municipio = 'Belém';
    dados.linhas = [linha(NOMES.cnd, diaISO(300))];
  });

  it('a vaga com pedido aberto mostra "Solicitada em …, prazo …" na tabela, e o painel traz o pedido com o protocolo a informar', async () => {
    dados.solicitacoes = [pedido(NOME_MUNICIPAL, diaISO(15))];
    montar();
    await screen.findByText(NOMES.cnd);

    const linhaMunicipal = linhaDaTabela(NOME_MUNICIPAL);
    // Continua "Ausente" — não há PDF —, mas alguém já pediu, e até quando esperar.
    expect(within(linhaMunicipal).getByText('Ausente')).toBeInTheDocument();
    expect(within(linhaMunicipal).getByText(/Solicitada em \d{2}\/\d{2}, prazo \d{2}\/\d{2}/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    const painel = oPainel(NOME_MUNICIPAL);
    expect(within(painel).getByText('Solicitação ao órgão')).toBeInTheDocument();
    expect(within(painel).getByText('sefin@belem.pa.gov.br')).toBeInTheDocument();

    // O protocolo é digitado DEPOIS, quando o órgão responde — e grava na linha do pedido.
    const salvar = within(painel).getByRole('button', { name: 'Salvar protocolo' });
    expect(salvar).toBeDisabled();
    fireEvent.change(within(painel).getByLabelText(/Protocolo/), { target: { value: '2026/77' } });
    fireEvent.click(salvar);
    await waitFor(() => expect(dados.gravadas.some((g) => g.tabela === 'documentos_solicitacoes' && g.op === 'update')).toBe(true));
    const gravada = dados.gravadas.find((g) => g.tabela === 'documentos_solicitacoes' && g.op === 'update');
    expect(gravada?.valores).toEqual({ protocolo: '2026/77' });
  });

  it('"Solicitar por e-mail" grava o pedido (órgão, e-mail, prazo) e só então abre o e-mail endereçado', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    const painel = oPainel(NOME_MUNICIPAL);

    fireEvent.click(within(painel).getByRole('button', { name: /Solicitar por e-mail/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Solicitar ao órgão')).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('E-mail do órgão'), { target: { value: 'sefin@belem.pa.gov.br' } });
    fireEvent.change(within(dialogo).getByLabelText('Prazo de resposta'), { target: { value: diaISO(15) } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Abrir e-mail e registrar' }));

    await waitFor(() => expect(emails.abertos).toHaveLength(1));
    const insercao = dados.gravadas.find((g) => g.tabela === 'documentos_solicitacoes' && g.op === 'insert');
    expect(insercao?.valores).toEqual(expect.objectContaining({
      empresa_id: 'e1',
      user_id: 'u1',
      documento_nome: NOME_MUNICIPAL,
      orgao: expect.stringContaining('Belém'),
      email_destino: 'sefin@belem.pa.gov.br',
      prazo_resposta: diaISO(15),
    }));
    // O e-mail sai endereçado ao órgão, em nome da empresa.
    expect(emails.abertos[0]).toMatch(/^mailto:sefin%40belem\.pa\.gov\.br\?subject=/);
    expect(decodeURIComponent(emails.abertos[0])).toContain('Empresa de Teste');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('o diálogo recusa prazo no passado antes de gravar, e diz por quê', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    fireEvent.click(within(oPainel(NOME_MUNICIPAL)).getByRole('button', { name: /Solicitar por e-mail/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Prazo de resposta'), { target: { value: diaISO(-2) } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Abrir e-mail e registrar' }));

    expect(await within(dialogo).findByText(/não pode ser anterior a hoje/)).toBeInTheDocument();
    expect(dados.gravadas).toHaveLength(0);
    expect(emails.abertos).toHaveLength(0);
  });

  it('sem a tabela (migration ainda não colada), o cofre segue de pé, avisa, e o e-mail continua funcionando', async () => {
    dados.erroSolicitacoes = { code: 'PGRST205', message: "Could not find the table 'public.documentos_solicitacoes' in the schema cache" };
    montar();
    await screen.findByText(NOMES.cnd);

    // Nada de alarme vermelho: é atualização nossa, não falha da empresa.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(linhasDeRegistro().length).toBe(VAGAS_PREVISTAS.length);

    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    const painel = oPainel(NOME_MUNICIPAL);
    expect(within(painel).getByText(/disponível após a atualização do banco/)).toBeInTheDocument();

    fireEvent.click(within(painel).getByRole('button', { name: /Solicitar por e-mail/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Abrir e-mail' }));
    await waitFor(() => expect(emails.abertos).toHaveLength(1));
    expect(dados.gravadas.filter((g) => g.op === 'insert')).toHaveLength(0);
  });

  it('erro de verdade na leitura dos pedidos é dito, com a mensagem real e o caminho de volta', async () => {
    dados.erroSolicitacoes = { message: 'permission denied for table documentos_solicitacoes' };
    montar();
    await screen.findByText(NOMES.cnd);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/permission denied for table documentos_solicitacoes/);
    expect(within(alerta).getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
    // O cofre em si continua legível.
    expect(linhasDeRegistro().length).toBe(VAGAS_PREVISTAS.length);
  });
});

describe('Controle de Documentos — órgão municipal cadastrado pela empresa', () => {
  const NOME_MUNICIPAL = 'Certidão Negativa de Débitos Municipais';
  const orgaoDeCumaru = () => ({
    id: 'o1', empresa_id: 'e1', esfera: 'municipal', uf: 'PA', municipio: 'Cumaru do Norte',
    nome_orgao: 'Prefeitura Municipal de Cumaru do Norte · Setor de Tributos',
    site: 'https://cumarudonorte.pa.gov.br/certidoes', email: 'tributos@cumarudonorte.pa.gov.br',
    instrucoes: 'Emissão on-line pelo CNPJ.', validade_dias: 90,
    user_id: 'u1', created_at: '2026-09-23T12:00:00Z', updated_at: '2026-09-23T12:00:00Z',
  });

  beforeEach(() => {
    dados.erro = null;
    janelaLarga();
    sessao.autorizacao.isCompanyAdmin = true;
    sessao.empresa.empresaAtiva.uf = 'PA';
    // Município FORA do mapa (o mapa cobre as capitais): o caso dos ~5.500.
    sessao.empresa.empresaAtiva.municipio = 'Cumaru do Norte';
    dados.linhas = [linha(NOMES.cnd, diaISO(300))];
  });

  afterEach(() => {
    sessao.empresa.empresaAtiva.municipio = 'Belém';
  });

  it('sem cadastro: a vaga diz "a cadastrar" com o nome do município e oferece o formulário, que grava o órgão da empresa', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    const painel = oPainel(NOME_MUNICIPAL);

    expect(within(painel).getByText(/Prefeitura Municipal de Cumaru do Norte/)).toBeInTheDocument();
    expect(within(painel).queryByText(/Belém|São Paulo/)).toBeNull();

    fireEvent.click(within(painel).getByRole('button', { name: /Cadastrar órgão/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/Cumaru do Norte\/PA/)).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Nome do órgão'), { target: { value: 'Prefeitura de Cumaru do Norte · Tributos' } });
    fireEvent.change(within(dialogo).getByLabelText('E-mail para solicitação'), { target: { value: 'tributos@cumarudonorte.pa.gov.br' } });
    fireEvent.change(within(dialogo).getByLabelText('Validade usual (dias)'), { target: { value: '90' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar órgão' }));

    await waitFor(() => expect(dados.gravadas.some((g) => g.tabela === 'certidoes_orgaos_da_empresa')).toBe(true));
    const gravada = dados.gravadas.find((g) => g.tabela === 'certidoes_orgaos_da_empresa');
    expect(gravada?.op).toBe('insert');
    expect(gravada?.valores).toEqual(expect.objectContaining({
      empresa_id: 'e1', user_id: 'u1', esfera: 'municipal', uf: 'PA', municipio: 'Cumaru do Norte',
      nome_orgao: 'Prefeitura de Cumaru do Norte · Tributos', site: null,
      email: 'tributos@cumarudonorte.pa.gov.br', validade_dias: 90,
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('o formulário exige nome e um canal (site ou e-mail) antes de gravar', async () => {
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    fireEvent.click(within(oPainel(NOME_MUNICIPAL)).getByRole('button', { name: /Cadastrar órgão/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar órgão' }));

    expect(await within(dialogo).findByText(/nome do órgão/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/ao menos um canal/)).toBeInTheDocument();
    expect(dados.gravadas).toHaveLength(0);
  });

  it('com o cadastro: as vagas municipais apontam o órgão da empresa, com o site, a validade e "Editar órgão"', async () => {
    dados.orgaos = [orgaoDeCumaru()];
    montar();
    await screen.findByText(NOMES.cnd);
    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    const painel = oPainel(NOME_MUNICIPAL);

    expect(await within(painel).findByText('Prefeitura Municipal de Cumaru do Norte · Setor de Tributos')).toBeInTheDocument();
    expect(within(painel).getByRole('link', { name: /Emitir no órgão/ })).toHaveAttribute('href', 'https://cumarudonorte.pa.gov.br/certidoes');
    expect(within(painel).getByText('90 dias')).toBeInTheDocument();
    expect(within(painel).getByText(/Órgão informado pela própria empresa/)).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: /Cadastrar órgão/ })).toBeNull();
    expect(within(painel).getByRole('button', { name: /Editar órgão/ })).toBeInTheDocument();

    // A inscrição municipal sai da mesma prefeitura — e continua sem vencimento.
    fireEvent.click(screen.getAllByText('Inscrição Municipal (cadastro de contribuintes)')[0]);
    const painelInscricao = oPainel('Inscrição Municipal (cadastro de contribuintes)');
    expect(within(painelInscricao).getByText('Prefeitura Municipal de Cumaru do Norte · Setor de Tributos')).toBeInTheDocument();
    expect(within(painelInscricao).getByText('não vence')).toBeInTheDocument();
  });

  it('sem a tabela (migration ainda não colada), o cofre segue de pé e o formulário diz o que falta', async () => {
    dados.erroOrgaos = { code: 'PGRST205', message: "Could not find the table 'public.certidoes_orgaos_da_empresa' in the schema cache" };
    montar();
    await screen.findByText(NOMES.cnd);
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getAllByText(NOME_MUNICIPAL)[0]);
    fireEvent.click(within(oPainel(NOME_MUNICIPAL)).getByRole('button', { name: /Cadastrar órgão/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/disponível após a atualização do banco/)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Salvar órgão' })).toBeDisabled();
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

describe('falha de carga não vira afirmação sobre o cofre', () => {
  it('com erro, os indicadores dizem que não apuraram — não "18 ausentes"', async () => {
    /* Defeito visto na CAPTURA, não no código: as 18 vagas são constantes e
       continuam na tela quando a consulta falha, mas quais delas têm arquivo
       veio do banco — e não veio. "Ausentes: 18" ali afirma sobre dado que não
       foi lido. Afirmar ausência é tão falso quanto inventar presença, e o
       comando proíbe substituir erro por dado. */
    dados.erro = { message: 'No suitable key or wrong key type' };
    montar();

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    // A mensagem real do banco aparece, com caminho de volta.
    expect(screen.getByText(/No suitable key/)).toBeTruthy();
    // E os números não afirmam nada.
    expect(screen.queryByText('18 vagas sem arquivo')).toBeNull();
    expect(screen.getAllByText(/não foi possível ler o cofre/i).length).toBeGreaterThan(0);
  });
});
