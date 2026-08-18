import { describe, it, expect, beforeEach } from 'vitest';
import {
  registrarRota, voltar, avancar, destinoDoVoltar, destinoDoAvancar,
  podeVoltar, podeAvancar, _reiniciarHistorico, _estadoAtual,
} from '../historico';

beforeEach(() => _reiniciarHistorico());

/** Encadeia uma navegação real: move o cursor e registra a chegada. */
const clicarVoltar = () => { const d = voltar(); if (d) registrarRota(d); return d; };
const clicarAvancar = () => { const d = avancar(); if (d) registrarRota(d); return d; };

describe('modelo do explorador de arquivos', () => {
  it('primeira tela da sessão não tem para onde ir', () => {
    registrarRota('/processo/28');
    expect(podeVoltar()).toBe(false);
    expect(podeAvancar()).toBe(false);
  });

  it('voltar não destrói o passo — ele vira avançar', () => {
    ['/kanban', '/processo/28'].forEach(registrarRota);
    expect(clicarVoltar()).toBe('/kanban');
    expect(destinoDoAvancar()).toBe('/processo/28');
    expect(clicarAvancar()).toBe('/processo/28');
    expect(destinoDoVoltar()).toBe('/kanban');
  });

  it('não gira em círculos: no início da lista, voltar fica indisponível', () => {
    // O pêndulo relatado: pasta → Kanban → pasta → Kanban, sem fim.
    registrarRota('/processo/28');
    registrarRota('/kanban');          // seta da pasta, navegação normal
    expect(clicarVoltar()).toBe('/processo/28');
    expect(podeVoltar()).toBe(false);  // aqui o giro morre
    expect(destinoDoAvancar()).toBe('/kanban');
  });

  it('percurso longo anda passo a passo nos dois sentidos', () => {
    ['/kanban', '/compromissos', '/processo/28', '/precificacao'].forEach(registrarRota);
    expect(clicarVoltar()).toBe('/processo/28');
    expect(clicarVoltar()).toBe('/compromissos');
    expect(clicarVoltar()).toBe('/kanban');
    expect(podeVoltar()).toBe(false);
    expect(clicarAvancar()).toBe('/compromissos');
    expect(clicarAvancar()).toBe('/processo/28');
  });

  it('novo rumo depois de voltar descarta o ramo à frente', () => {
    // Duas tarefas distintas: a segunda não herda o caminho da primeira.
    ['/kanban', '/processo/28', '/precificacao'].forEach(registrarRota);
    clicarVoltar();                    // volta ao /processo/28
    clicarVoltar();                    // volta ao /kanban
    registrarRota('/processo/91');     // abre OUTRA pasta
    expect(_estadoAtual().entradas).toEqual(['/kanban', '/processo/91']);
    expect(podeAvancar()).toBe(false); // o ramo antigo não sobrevive
    expect(destinoDoVoltar()).toBe('/kanban');
  });

  it('o ?lid= reescrito pelo sistema não vira um passo', () => {
    registrarRota('/kanban?lid=abc');
    registrarRota('/documentos');
    registrarRota('/documentos?lid=abc');   // reescrita do ProcessoAtivoContext
    expect(_estadoAtual().entradas).toEqual(['/kanban', '/documentos']);
    expect(clicarVoltar()).toBe('/kanban');
  });

  it('parâmetro que define a página continua contando', () => {
    registrarRota('/financeiro/lancamentos?lid=abc');
    registrarRota('/financeiro/lancamentos?lid=abc&lote=7');
    expect(_estadoAtual().entradas).toEqual([
      '/financeiro/lancamentos', '/financeiro/lancamentos?lote=7',
    ]);
  });

  it('voltar à mesma tela pelo menu é um passo novo, como no Explorer', () => {
    ['/kanban', '/processo/28', '/kanban'].forEach(registrarRota);
    expect(_estadoAtual().entradas).toEqual(['/kanban', '/processo/28', '/kanban']);
    expect(clicarVoltar()).toBe('/processo/28');
  });
});
