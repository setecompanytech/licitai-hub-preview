import { describe, expect, it } from 'vitest';
import { navGroups, menuDaConta } from './menu';
import { paginasPadrao, padraoDaRota, trilhaDaRota } from './paginas';

/**
 * O par menu.ts + paginas.ts só serve enquanto os dois falarem da mesma
 * lista. Divergência aqui é tela sem título padronizado (ou padrão órfão
 * apontando para rota que ninguém abre) — o defeito que o CLAUDE.md conta
 * ter mantido o arquivamento quebrado por meses, na versão de navegação.
 */
describe('padronização das telas do menu', () => {
  // Desde 13/09 a navegação tem duas portas: a barra (navGroups) e o menu da
  // conta, atrás do avatar (menuDaConta). Tela de qualquer uma das duas
  // precisa de padronização.
  const rotasDaBarra = navGroups.flatMap((g) => g.items.map((i) => i.path));
  const rotasDaConta = menuDaConta.filter((i) => !i.hash).map((i) => i.path);
  const rotasDoMenu = [...new Set([...rotasDaBarra, ...rotasDaConta])];

  it('cobre toda rota do menu', () => {
    const semPadrao = rotasDoMenu.filter((r) => !padraoDaRota(r));
    expect(semPadrao).toEqual([]);
  });

  it('não tem padrão órfão', () => {
    const orfas = paginasPadrao.map((p) => p.rota).filter((r) => !rotasDoMenu.includes(r));
    expect(orfas).toEqual([]);
  });

  it('usa o grupo real do menu em cada tela', () => {
    const grupoDaRota = new Map<string, string>();
    for (const g of navGroups) for (const i of g.items) grupoDaRota.set(i.path, g.title);
    // O que vive atrás do avatar responde por "Conta" na trilha.
    for (const r of rotasDaConta) if (!grupoDaRota.has(r)) grupoDaRota.set(r, 'Conta');
    const divergentes = paginasPadrao
      .filter((p) => grupoDaRota.get(p.rota) !== p.grupo)
      .map((p) => `${p.rota}: ${p.grupo} ≠ ${grupoDaRota.get(p.rota)}`);
    expect(divergentes).toEqual([]);
  });

  it('escreve descrição curta, sem ponto final e sem número solto', () => {
    const foraDoPadrao = paginasPadrao
      .filter((p) => p.descricao.endsWith('.') || p.descricao.length > 92 || /\d/.test(p.descricao))
      .map((p) => p.rota);
    expect(foraDoPadrao).toEqual([]);
  });

  it('declara as abas quando o padrão é de abas', () => {
    const semAbas = paginasPadrao.filter((p) => p.padrao === 'abas' && !p.abas?.length).map((p) => p.rota);
    expect(semAbas).toEqual([]);
  });

  it('monta a trilha do painel até a tela', () => {
    expect(trilhaDaRota('/gestao-contratos').map((t) => t.rotulo)).toEqual([
      'Painel', 'Gestão de Processos', 'Gestão de contratos',
    ]);
    // Aceita rota com parâmetro — a pasta do contrato é a mesma tela.
    expect(padraoDaRota('/gestao-contratos?contrato=123')?.titulo).toBe('Gestão de contratos');
  });
});
