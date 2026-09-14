import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  funcoesDoSistema,
  buscarFuncoes,
  funcaoDaRota,
  normalizar,
  categoriasDoSistema,
} from './registro';
import { navGroups, menuDaConta } from './menu';

/**
 * O sistema tinha QUATRO listas de navegação em paralelo, e as quatro
 * divergiam. `/monitoramento-editais` tinha três nomes; "Definir Metas" do
 * painel levava a uma rota e o item de mesmo nome no menu levava a outra; a
 * busca indexava "Dashboard" apontando para a landing pública e desconhecia 18
 * rotas que o menu oferecia.
 *
 * Ninguém enxerga isso lendo um arquivo: cada lista, sozinha, parece correta.
 * Estes casos comparam as listas entre si — que é onde a divergência mora.
 */
describe('registro único de navegação', () => {
  it('cobre toda função do menu e do menu da conta', () => {
    const doMenu = navGroups.flatMap((g) => g.items.map((i) => i.path));
    const daConta = menuDaConta.filter((i) => !i.hash).map((i) => i.path);
    const registradas = new Set(funcoesDoSistema.map((f) => f.rota));
    for (const rota of [...doMenu, ...daConta]) {
      expect(registradas.has(rota), `${rota} ficou fora do registro`).toBe(true);
    }
  });

  it('não inventa função que o menu não tem', () => {
    const conhecidas = new Set([
      ...navGroups.flatMap((g) => g.items.map((i) => i.path)),
      ...menuDaConta.filter((i) => !i.hash).map((i) => i.path),
    ]);
    const inventadas = funcoesDoSistema.filter((f) => !conhecidas.has(f.rota)).map((f) => f.rota);
    expect(inventadas).toEqual([]);
  });

  it('cada função aparece uma vez só', () => {
    const vistas = new Map<string, number>();
    for (const f of funcoesDoSistema) vistas.set(f.id, (vistas.get(f.id) ?? 0) + 1);
    const repetidas = [...vistas.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    expect(repetidas).toEqual([]);
  });

  it('as seções do menu da conta viram uma categoria só', () => {
    // Quatro seções ("Conta", "Empresa", "Preferências", "Plataforma") viram
    // "Configuração" no diretório. São subdivisões de um mesmo assunto, e
    // quatro colunas de dois itens cada ocupariam o diretório inteiro.
    expect(categoriasDoSistema).toContain('Configuração');
  });
});

describe('busca por função', () => {
  it('ignora acento e caixa', () => {
    const comAcento = buscarFuncoes(funcoesDoSistema, 'LICITAÇÕES');
    const sem = buscarFuncoes(funcoesDoSistema, 'licitacoes');
    expect(comAcento.length).toBeGreaterThan(0);
    expect(comAcento.map((f) => f.rota).sort()).toEqual(sem.map((f) => f.rota).sort());
  });

  it('acha pelo nome que a pessoa usa, não só pelo nome da tela', () => {
    // Ninguém procura "Editais & Licitações": procura "pncp" ou "oportunidade".
    const porSinonimo = buscarFuncoes(funcoesDoSistema, 'pncp');
    expect(porSinonimo.some((f) => f.rota === '/monitoramento-editais')).toBe(true);

    // "quadro" é como metade das empresas chama o Kanban.
    expect(buscarFuncoes(funcoesDoSistema, 'quadro').some((f) => f.rota === '/kanban')).toBe(true);

    // E quem procura "nota fiscal" quer Compras, não o Financeiro só.
    expect(buscarFuncoes(funcoesDoSistema, 'nota fiscal').some((f) => f.rota === '/gestao-compras')).toBe(true);
  });

  it('termo sem correspondência devolve vazio, não a lista inteira', () => {
    expect(buscarFuncoes(funcoesDoSistema, 'zzzznaoexiste')).toEqual([]);
  });

  it('termo vazio devolve tudo', () => {
    expect(buscarFuncoes(funcoesDoSistema, '   ').length).toBe(funcoesDoSistema.length);
  });

  it('não casa contra a descrição', () => {
    // A descrição tem frases inteiras; casar contra ela faria "processo"
    // devolver metade do sistema, que é o mesmo que não buscar.
    const comDescricao = funcoesDoSistema.filter((f) => f.descricao.length > 0);
    expect(comDescricao.length).toBeGreaterThan(0);
    const palavraSoDaDescricao = 'desfecho'; // aparece na descrição do Kanban
    const achou = buscarFuncoes(funcoesDoSistema, palavraSoDaDescricao);
    expect(achou).toEqual([]);
  });
});

describe('onde a pessoa está', () => {
  it('reconhece a rota atual, inclusive em tela de detalhe', () => {
    expect(funcaoDaRota('/kanban')?.rota).toBe('/kanban');
    expect(funcaoDaRota('/equipe/permissoes')?.rota).toBe('/equipe');
  });

  it('rota desconhecida não casa com nada', () => {
    expect(funcaoDaRota('/rota-que-nao-existe')).toBeUndefined();
  });
});

describe('as listas paralelas foram desativadas', () => {
  it('o painel não mantém a própria lista de atalhos', () => {
    // `QuickAccessGrid.groups` era a terceira lista: tinha "Encontrar Editais"
    // para uma rota que o menu chamava de outro jeito, um grupo "Automação"
    // que não existia no menu, e "Definir Metas" apontando para outra rota.
    const fonte = readFileSync('src/components/dashboard/QuickAccessGrid.tsx', 'utf8');
    expect(fonte).toContain('registro');
    expect(fonte).not.toMatch(/path:\s*'\/metas-comercial\?tab=parametros'/);
  });
});

describe('normalizar', () => {
  it('tira acento, cedilha e caixa', () => {
    expect(normalizar('Precificação')).toBe('precificacao');
    expect(normalizar('  ÍNDICES E REPACTUAÇÃO  ')).toBe('indices e repactuacao');
  });
});
