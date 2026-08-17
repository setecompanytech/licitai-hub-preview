import { describe, it, expect, beforeEach } from 'vitest';
import {
  registrarRota, destinoDoVoltar, prepararVolta, _reiniciarHistorico, _pilhaAtual,
} from '../historico';

beforeEach(() => _reiniciarHistorico());

describe('histórico do aplicativo', () => {
  it('sem origem, não há para onde voltar', () => {
    registrarRota('/precificacao');
    expect(destinoDoVoltar()).toBeNull();
  });

  it('volta para a tela anterior de verdade, não para uma rota fixa', () => {
    registrarRota('/kanban');
    registrarRota('/processo/123');
    expect(destinoDoVoltar()).toBe('/kanban');
  });

  it('não gira em círculos: voltar despila em vez de empilhar', () => {
    registrarRota('/kanban');
    registrarRota('/precificacao');
    const destino = prepararVolta();
    expect(destino).toBe('/kanban');
    registrarRota(destino!);            // o roteador navega e a rota é registrada
    expect(_pilhaAtual()).toEqual(['/kanban']);
    expect(destinoDoVoltar()).toBeNull();
  });

  it('mesma rota repetida não empilha', () => {
    registrarRota('/processo/1?lid=a');
    registrarRota('/processo/1?lid=a');
    expect(_pilhaAtual()).toHaveLength(1);
  });

  it('chegar ao Painel zera o rastro — dali não se volta', () => {
    registrarRota('/kanban');
    registrarRota('/precificacao');
    registrarRota('/painel');
    expect(_pilhaAtual()).toEqual(['/painel']);
    expect(destinoDoVoltar()).toBeNull();
  });

  it('percurso longo volta um passo por vez', () => {
    ['/kanban', '/processo/1', '/precificacao', '/proposta-tecnica'].forEach(registrarRota);
    expect(prepararVolta()).toBe('/precificacao');
    registrarRota('/precificacao');
    expect(prepararVolta()).toBe('/processo/1');
    registrarRota('/processo/1');
    expect(prepararVolta()).toBe('/kanban');
  });
});

describe('botões que navegam para trás por conta própria', () => {
  it('voltar a uma tela do percurso trunca em vez de empilhar', () => {
    // Kanban → Compromissos → Processo, e então a seta da pasta salta para o
    // Kanban por conta própria. Sem a regra 4, o Voltar do Kanban traria o
    // processo de volta — o pêndulo relatado.
    ['/kanban', '/compromissos', '/processo/28'].forEach(registrarRota);
    registrarRota('/kanban');
    expect(_pilhaAtual()).toEqual(['/kanban']);
    expect(destinoDoVoltar()).toBeNull();
  });

  it('trunca no ponto certo quando o salto é para o meio do percurso', () => {
    ['/kanban', '/compromissos', '/processo/28', '/precificacao'].forEach(registrarRota);
    registrarRota('/compromissos');
    expect(_pilhaAtual()).toEqual(['/kanban', '/compromissos']);
    expect(destinoDoVoltar()).toBe('/kanban');
  });

  it('tela nova depois do truque segue empilhando normalmente', () => {
    ['/kanban', '/processo/28'].forEach(registrarRota);
    registrarRota('/kanban');
    registrarRota('/documentos');
    expect(_pilhaAtual()).toEqual(['/kanban', '/documentos']);
    expect(prepararVolta()).toBe('/kanban');
  });
});
