import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * A lista de Contratos e ATAs — o que a reestruturação de 13/09 precisa
 * sustentar, e que nenhum teste guardava antes:
 *
 *  1. a ata aparece com os contratos derivados ANINHADOS sob ela (a relação do
 *     art. 84, que a tela escondia);
 *  2. selecionar uma linha abre o painel lateral sem sair da lista;
 *  3. na ata, as duas bases (registrado × comprometido) saem em blocos
 *     separados, com o aviso de que não se somam;
 *  4. valor não apurado aparece como indisponível, nunca como R$ 0,00;
 *  5. as abas do registro mudam conforme ele é ata ou contrato, e os `value`
 *     continuam sendo os que o resto do app usa em `?aba=`.
 *
 * O Supabase é falso: o teste é sobre composição, não sobre consulta.
 */

const dados = vi.hoisted(() => {
  const base = {
    objeto: 'Aquisição de material de expediente para a rede de ensino',
    orgao_contratante: 'Secretaria de Educação',
    valor_consumido: 0,
    data_assinatura: '2024-01-10',
    data_inicio: '2024-01-11',
    data_fim: '2030-01-11',
    excluido_em: null,
    vigencia_meses: 12,
    status: 'vigente',
    modalidade: 'Pregão Eletrônico',
    uf: 'PA',
    municipio: 'Belém',
    fiscal_nome: null,
    fiscal_email: null,
    fiscal_telefone: null,
    observacoes: null,
    numero_ata: null,
    validade_ata_meses: null,
    permite_carona: null,
    licitacao_id: null,
    vendedor_user_id: 'user-1',
    user_id: 'user-1',
  };

  return {
    contratos: [
      {
        ...base,
        id: 'ata-1',
        numero_contrato: 'ATA 022/2024',
        numero_ata: 'ATA 022/2024',
        tipo_documento: 'ata_srp',
        ata_srp_id: null,
        validade_ata_meses: 12,
        permite_carona: true,
        valor_global: 1_000_000,
        valor_consumido: 250_000,
        saldo_remanescente: 750_000,
      },
      {
        ...base,
        id: 'ct-derivado',
        numero_contrato: 'CT 101/2024',
        tipo_documento: 'contrato',
        // O par do modelo: contrato + ata_srp_id = contrato derivado.
        ata_srp_id: 'ata-1',
        valor_global: 250_000,
        valor_consumido: 50_000,
        saldo_remanescente: 200_000,
      },
      {
        ...base,
        id: 'ct-sem-valor',
        numero_contrato: 'CT 900/2024',
        tipo_documento: 'contrato',
        ata_srp_id: null,
        // Nunca apurado — é isto que não pode virar R$ 0,00 na tela.
        valor_global: null,
        valor_consumido: null,
        saldo_remanescente: null,
      },
    ] as Record<string, unknown>[],
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const consulta = (tabela: string) => {
    const resultado = Promise.resolve({
      data: tabela === 'contratos' ? dados.contratos : [],
      error: null,
    });
    const encadeia: Record<string, unknown> = {
      select: () => encadeia,
      eq: () => encadeia,
      order: () => encadeia,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (ok: unknown, falha: unknown) =>
        resultado.then(ok as never, falha as never),
    };
    return encadeia;
  };
  return {
    supabase: {
      from: (tabela: string) => consulta(tabela),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => undefined,
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    },
  };
});

// As referências precisam ser ESTÁVEIS entre renders. Devolver um objeto novo
// a cada chamada faz o `useEffect([user, empresaAtiva])` da tela recarregar
// sem parar, e a tabela pisca entre esqueleto e conteúdo para sempre — os
// contextos reais memoizam, o dublê tem de memoizar também.
const sessao = vi.hoisted(() => ({
  user: { id: 'user-1' },
  empresa: { id: 'empresa-1' },
  papel: { papel: 'admin', isAdmin: true, podeOperar: true },
  colaboradores: { data: [{ user_id: 'user-1', nome: 'Ana Vendas', email: 'ana@x.com' }] },
}));
const auth = vi.hoisted(() => ({ valor: null as unknown }));

vi.mock('@/contexts/AuthContext', () => {
  auth.valor = { user: sessao.user };
  return { useAuth: () => auth.valor };
});
vi.mock('@/contexts/EmpresaContext', () => {
  const empresa = { empresaAtiva: sessao.empresa, empresas: [] };
  return { useEmpresa: () => empresa };
});
vi.mock('@/hooks/usePapelEmpresa', () => ({
  usePapelEmpresa: () => sessao.papel,
}));
vi.mock('@/hooks/useMetasComercial', () => ({
  useColaboradores: () => sessao.colaboradores,
}));
vi.mock('@/lib/processo/salvarNaPasta', () => ({ salvarNaPastaDoProcesso: async () => undefined }));

// A moldura e os conteúdos pesados das abas não são o objeto deste teste — e
// carregá-los traria consulta, gráfico e upload para dentro do jsdom.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/contratos/ContratoDashboard', () => ({
  default: () => <div>conteúdo do resumo</div>,
}));
vi.mock('@/components/contratos/ContratoItens', () => ({ default: () => <div>itens</div> }));
vi.mock('@/components/contratos/ContratoPedidos', () => ({ default: () => <div>pedidos</div> }));
vi.mock('@/components/contratos/ContratoArquivos', () => ({ default: () => <div>arquivos</div> }));
vi.mock('@/components/contratos/ImportarContratoPDF', () => ({
  default: () => <button type="button">Importar PDF</button>,
}));
vi.mock('@/components/contratos/LocalDoOrgao', () => ({ default: () => <div>local</div> }));

import GestaoContratos from './GestaoContratos';

/** Tela larga: o painel lateral cabe ao lado da tabela (>= 1280px). */
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
      dispatchEvent: () => {},
    }),
  });
}

function montar(rota = '/gestao-contratos') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <GestaoContratos />
    </MemoryRouter>,
  );
}

/** A linha da tabela que contém um texto — clicá-la é selecionar o registro. */
function linhaCom(texto: RegExp | string) {
  const celula = screen.getAllByText(texto)[0];
  const linha = celula.closest('tr');
  if (!linha) throw new Error(`Sem linha de tabela para ${texto}`);
  return linha;
}

describe('GestaoContratos — lista de Contratos e ATAs', () => {
  beforeEach(() => {
    janelaLarga();
  });

  it('mostra a ATA com os contratos derivados aninhados sob ela', async () => {
    montar();

    const linhaDaAta = await screen.findByText('ATA 022/2024').then((el) => el.closest('tr')!);
    // A linha-mãe declara quantos derivados tem…
    expect(within(linhaDaAta).getByText('1 contrato derivado')).toBeInTheDocument();
    // …e há um botão real para recolher a hierarquia.
    expect(
      within(linhaDaAta).getByRole('button', { name: /Recolher os contratos derivados/i }),
    ).toBeInTheDocument();

    // O derivado aparece como linha própria, marcada como filha da ata.
    const linhaDoDerivado = linhaCom(/CT 101\/2024/);
    expect(within(linhaDoDerivado).getByText('Derivado desta ATA')).toBeInTheDocument();
  });

  it('recolhe e reabre a ata sem tirar o registro da lista', async () => {
    montar();
    const linhaDaAta = await screen.findByText('ATA 022/2024').then((el) => el.closest('tr')!);
    const alternar = within(linhaDaAta).getByRole('button', { name: /Recolher os contratos derivados/i });

    fireEvent.click(alternar);
    expect(screen.queryByText(/CT 101\/2024/)).not.toBeInTheDocument();

    fireEvent.click(within(linhaDaAta).getByRole('button', { name: /Mostrar os contratos derivados/i }));
    expect(screen.getByText(/CT 101\/2024/)).toBeInTheDocument();
  });

  it('selecionar a ATA abre o painel lateral com as duas bases separadas e o aviso', async () => {
    montar();
    await screen.findByText('ATA 022/2024');

    // Sem seleção, o painel não existe.
    expect(screen.queryByText('Base da ATA')).not.toBeInTheDocument();

    fireEvent.click(linhaCom('SECRETARIA DE EDUCAÇÃO'));

    // Dois blocos nomeados, separados…
    expect(await screen.findByText('Base da ATA')).toBeInTheDocument();
    expect(screen.getByText('Valor dos contratos derivados')).toBeInTheDocument();
    // …e o aviso explícito de que as bases não se somam.
    expect(screen.getAllByText(/não devem ser somados/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bases de cálculo distintas').length).toBeGreaterThan(0);

    // O painel não engole a lista: a tabela continua na tela, ao lado dele.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('ATA 022/2024')).toBeInTheDocument();
    // E entrar na pasta continua sendo um gesto explícito.
    expect(screen.getByRole('button', { name: 'Abrir pasta completa' })).toBeInTheDocument();
  });

  it('não apurado nunca vira zero — nem na linha, nem no painel', async () => {
    montar();
    await screen.findByText('ATA 022/2024');

    // O contrato sem valor cadastrado diz que não foi apurado.
    expect(screen.getAllByText('Valor não informado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Saldo não apurado').length).toBeGreaterThan(0);
    // Nenhuma célula afirma "R$ 0,00" por falta de apuração.
    expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument();

    // O total de itens da ata também é apuração ausente, não zero.
    fireEvent.click(linhaCom('SECRETARIA DE EDUCAÇÃO'));
    await screen.findByText('Base da ATA');
    expect(screen.getByText('Apurado na aba Itens/lotes')).toBeInTheDocument();
  });

  it('cada indicador declara a base do número que mostra', async () => {
    montar();
    await screen.findByText('ATA 022/2024');

    // A soma de valores exclui as ATAs — a regra dura da tela, escrita.
    expect(screen.getByText(/Base: Σ valor global dos contratos, sem ATAs/)).toBeInTheDocument();
    // "Vencendo" conta por data de fim, não pelo campo Situação.
    expect(
      screen.getByText(/Base: data de fim nos próximos 60 dias — não o campo Situação/),
    ).toBeInTheDocument();
  });
});

describe('GestaoContratos — pasta do registro', () => {
  beforeEach(() => {
    janelaLarga();
  });

  it('na ATA: Contratos derivados no lugar de Pedidos, e Apostilamentos nos arquivos', async () => {
    montar('/gestao-contratos?contrato=ata-1');

    expect(await screen.findByRole('tab', { name: 'Resumo' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Itens/Lotes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Contratos derivados/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Apostilamentos / Arquivos' })).toBeInTheDocument();
    // Ata não tem pedidos: quem pede é o contrato derivado.
    expect(screen.queryByRole('tab', { name: 'Pedidos' })).not.toBeInTheDocument();
    // O painel da aba padrão (`?aba=` ausente = 'dashboard') continua montando.
    expect(screen.getByText('conteúdo do resumo')).toBeInTheDocument();
    // Os dois fatos da ata encerrada saem em selos separados — aqui ela está
    // vigente, então sai um só.
    expect(screen.getByText('Vigente')).toBeInTheDocument();
  });

  it('no contrato: Pedidos e Arquivos e Aditivos, sem Contratos derivados', async () => {
    montar('/gestao-contratos?contrato=ct-sem-valor');

    expect(await screen.findByRole('tab', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Arquivos e Aditivos' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Contratos derivados/ })).not.toBeInTheDocument();
  });
});
