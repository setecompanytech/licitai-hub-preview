import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AtestadosCapacidadeTecnica from './AtestadosCapacidadeTecnica';

/**
 * A aba Atestados saiu da lista de cartões para tabela + painel (13/09). O que
 * este arquivo prende são as regras que a conversão podia perder em silêncio —
 * nenhuma delas aparece em captura de tela, e todas já custaram caro:
 *
 *  1. os NOVE segmentos continuam na tela. A prévia aprovada mostrava seis;
 *     apagar vestuário, medicamentos e manutenção tiraria do ar segmentos que
 *     o casamento de habilitação (`SEGMENTOS_OBJETO`) conhece e procura;
 *  2. contagem vem dos dados, nunca do desenho — "Todos (23)" da prévia é
 *     número de figura, não de banco;
 *  3. "Anexado" é afirmação sobre o ARQUIVO: linha sem `arquivo_path` não
 *     pode dizer isso (antes o selo era fixo em "Cadastrado", para todas);
 *  4. o objeto completo está no painel, não só o resumo de duas linhas;
 *  5. o escopo é da EMPRESA (14/09): o atestado é emitido por órgão ou empresa,
 *     assinado por representante, e integra a habilitação — a equipe precisa
 *     vê-lo. A leitura tem de trazer o acervo da empresa MAIS o legado pessoal
 *     ainda não migrado, e o aviso sobre esse legado só pode aparecer enquanto
 *     ele existir.
 */

type Linha = Record<string, unknown>;

const { dados, chamadas } = vi.hoisted(() => ({
  dados: {
    atestados: [] as Linha[],
    erro: null as { message: string } | null,
  },
  chamadas: {
    select: [] as string[],
    filtros: [] as Array<[string, unknown]>,
    like: [] as Array<[string, string]>,
    or: [] as string[],
  },
}));

/** Builder encadeável e "thenável" — mesmo padrão dos testes de Contratos. */
function consulta() {
  const builder: Record<string, unknown> = {};
  builder.select = (colunas: string) => { chamadas.select.push(colunas); return builder; };
  builder.eq = (coluna: string, valor: unknown) => { chamadas.filtros.push([coluna, valor]); return builder; };
  builder.like = (coluna: string, padrao: string) => { chamadas.like.push([coluna, padrao]); return builder; };
  builder.or = (expressao: string) => { chamadas.or.push(expressao); return builder; };
  builder.order = () => builder;
  builder.insert = () => Promise.resolve({ data: null, error: null });
  builder.update = () => builder;
  builder.delete = () => builder;
  builder.then = (aoResolver: (v: { data: Linha[] | null; error: unknown }) => unknown) =>
    Promise.resolve({
      data: dados.erro ? null : dados.atestados,
      error: dados.erro,
    }).then(aoResolver);
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => consulta(),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        remove: () => Promise.resolve({ error: null }),
        createSignedUrl: () => Promise.resolve({ data: null, error: null }),
      }),
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

// Sessão estável de propósito: devolver um objeto novo a cada render faria o
// efeito de carga se reagendar sozinho, e o teste mediria um laço.
const SESSAO = { user: { id: 'u-1', email: 'teste@exemplo.test' } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => SESSAO }));

// Empresa também estável, e pelo mesmo motivo. `papel` importa: a régua de
// exclusão espelha `documentos_delete_empresa`, que exige admin.
const EMPRESA = { id: 'e-1' };
const CONTEXTO_EMPRESA = {
  empresaAtiva: EMPRESA,
  empresas: [{ empresa_id: 'e-1', papel: 'operador', empresa: EMPRESA }],
};
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => CONTEXTO_EMPRESA }));

/** Nenhum órgão, objeto ou CNPJ aqui é real — são valores de teste. */
const OBJETO_LONGO =
  'Fornecimento parcelado de gêneros alimentícios não perecíveis destinados à composição de ' +
  'cestas básicas e à merenda escolar da rede municipal, incluindo arroz, feijão, açúcar, óleo ' +
  'de soja, leite em pó e macarrão, com entrega mensal em vinte e três unidades escolares.';

const atestado = (over: Linha = {}): Linha => ({
  id: 'a-1',
  nome: 'ACT – Gêneros Alimentícios',
  segmento: 'alimentos',
  validade: null,
  arquivo_path: 'u-1/act-alimentos-1.pdf',
  tamanho_bytes: 245_760,
  user_id: 'u-1',
  dados_extraidos: {
    objeto: OBJETO_LONGO,
    orgao_emissor: 'Prefeitura de Teste',
    ano_fornecimento: '2024',
    periodo: 'jan/2023 a dez/2024',
    valor: '1.250.000,00',
    cnpj_contratante: '00.000.000/0001-00',
  },
  ...over,
});

beforeEach(() => {
  dados.atestados = [];
  dados.erro = null;
  chamadas.select = [];
  chamadas.filtros = [];
  chamadas.like = [];
  // O painel lateral só existe a partir de 1280px (useLarguraMinima); abaixo
  // disso o detalhe vira gaveta e o teste mediria outra composição.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 1280px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

const montar = () => render(<AtestadosCapacidadeTecnica />);

describe('Aba Atestados — taxonomia, contagem e arquivo', () => {
  it('lê os atestados pelo prefixo `ACT –` (travessão), sem inventar tabela própria', async () => {
    dados.atestados = [atestado()];
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    // O travessão é U+2013: trocá-lo por hífen zera a leitura de tudo o que
    // já está gravado.
    expect(chamadas.like).toContainEqual(['nome', 'ACT –%']);
  });

  it('mostra os NOVE segmentos, não os seis da prévia', async () => {
    dados.atestados = [atestado()];
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    const rotulos = [
      'Gêneros Alimentícios', 'Informática e Tecnologia', 'Higiene e Limpeza',
      'Material de Escritório', 'Móveis e Equipamentos',
      // Os três que faltavam na prévia e que o casamento de habilitação conhece:
      'Vestuário e EPIs', 'Medicamentos e Saúde', 'Manutenção e Serviços',
      'Outros Segmentos',
    ];
    for (const rotulo of rotulos) {
      expect(
        screen.getAllByRole('button', { name: new RegExp(`^${rotulo} \\(\\d+\\)$`) }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('conta a partir dos dados — chips e cabeçalho', async () => {
    dados.atestados = [
      atestado(),
      atestado({ id: 'a-2' }),
      atestado({ id: 'a-3', segmento: 'limpeza', nome: 'ACT – Higiene e Limpeza' }),
    ];
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Todos (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gêneros Alimentícios (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Higiene e Limpeza (1)' })).toBeInTheDocument();
    // Segmento sem atestado aparece zerado, com o número dos dados.
    expect(screen.getByRole('button', { name: 'Medicamentos e Saúde (0)' })).toBeInTheDocument();
    // "3 atestados · 2 segmentos" — nada disso é constante de desenho.
    // Os números vivem em `<span tabular-nums>`, então a comparação é sobre o
    // texto inteiro do parágrafo, não sobre um nó de texto solto.
    expect(
      screen.getByText(
        (_, el) => el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ').trim() === '3 atestados · 2 segmentos',
      ),
    ).toBeInTheDocument();
  });

  it('atestado sem arquivo não diz "Anexado"', async () => {
    dados.atestados = [
      atestado(),
      atestado({ id: 'a-2', arquivo_path: null, tamanho_bytes: null }),
    ];
    montar();

    const tabela = await screen.findByRole('table');
    // Duas linhas, um só arquivo: um "Anexado" e um "Sem arquivo".
    expect(within(tabela).getAllByText('Anexado')).toHaveLength(1);
    expect(within(tabela).getAllByText('Sem arquivo')).toHaveLength(1);
  });

  it('o objeto completo fica no painel de detalhes', async () => {
    dados.atestados = [atestado()];
    const { container } = montar();

    const tabela = await screen.findByRole('table');
    // A linha traz o resumo com o botão de expandir (objeto longo, truncado).
    expect(within(tabela).getByText('Ver descrição completa')).toBeInTheDocument();

    fireEvent.click(container.querySelector('tbody tr')!);

    const painel = await screen.findByRole('complementary');
    // Inteiro, sem corte e sem depender de clique adicional.
    expect(within(painel).getByText(OBJETO_LONGO)).toBeInTheDocument();
    // E o período, que a IA extraía e a tela nunca mostrava.
    expect(within(painel).getByText('jan/2023 a dez/2024')).toBeInTheDocument();
    expect(within(painel).getByText('1.250.000,00')).toBeInTheDocument();
  });

  it('lê o acervo da empresa junto com o legado pessoal ainda não migrado', async () => {
    /* Trocar isto por `eq('empresa_id')` puro esconderia, no dia da virada,
       todo atestado que a migração ainda não converteu — o cofre pareceria
       vazio para quem tem dezenas gravados. */
    dados.atestados = [atestado()];
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(chamadas.or.join(' ')).toContain('empresa_id.eq.e-1');
    expect(chamadas.or.join(' ')).toContain('user_id.eq.u-1');
    expect(chamadas.or.join(' ')).toContain('empresa_id.is.null');
  });

  it('o aviso de legado pessoal some quando não há legado', async () => {
    dados.atestados = [atestado({ empresa_id: 'e-1' })];
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    // Aviso fixo dizendo "são pessoais" viraria mentira depois da migração.
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('e aparece, contando, enquanto houver atestado preso à conta', async () => {
    dados.atestados = [
      atestado({ id: 'a-1', empresa_id: null }),
      atestado({ id: 'a-2', empresa_id: null }),
      atestado({ id: 'a-3', empresa_id: 'e-1' }),
    ];
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const aviso = screen.getByRole('note');
    expect(aviso.textContent).toMatch(/2 atestados ainda estão ligados à sua conta/i);
  });

  it('diz que cadastrar não é analisar compatibilidade com edital', async () => {
    dados.atestados = [atestado()];
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(
      screen.getAllByText(/não representa análise de compatibilidade com um edital/i).length,
    ).toBeGreaterThan(0);
  });

  it('o envio abre com segmento, arquivo e a nota de compatibilidade', async () => {
    dados.atestados = [atestado()];
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /Adicionar atestado/ }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByLabelText('Segmento')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(/Arquivo \(PDF/)).toBeInTheDocument();
    expect(dialogo.textContent).toMatch(/não representa análise de compatibilidade com um edital/i);
    // Os campos do atestado (período incluído) entram junto com o arquivo e o
    // segmento escolhidos — ver o teste do diálogo de edição, que os cobre.
  });

  it('do painel dá para editar o cadastro e excluir com confirmação', async () => {
    dados.atestados = [atestado()];
    const { container } = montar();

    await screen.findByRole('table');
    fireEvent.click(container.querySelector('tbody tr')!);

    const painel = await screen.findByRole('complementary');
    fireEvent.click(within(painel).getByRole('button', { name: /Editar cadastro/ }));
    const edicao = await screen.findByRole('dialog');
    expect(within(edicao).getByLabelText('Período do fornecimento')).toHaveValue('jan/2023 a dez/2024');
    fireEvent.click(within(edicao).getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(within(painel).getByRole('button', { name: /Excluir/ }));
    const confirmacao = await screen.findByRole('alertdialog');
    expect(confirmacao.textContent).toMatch(/Excluir este atestado\?/);
    // Exclusão só acontece depois do "sim" — a confirmação é a regra.
    expect(within(confirmacao).getByRole('button', { name: /Excluir atestado/ })).toBeInTheDocument();
  });

  it('falha de carga aparece com a mensagem real e o caminho de volta', async () => {
    dados.erro = { message: 'permission denied for table documentos' };
    montar();

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('permission denied for table documentos');
    expect(within(alerta).getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });
});
