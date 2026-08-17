import { describe, it, expect } from 'vitest';
import { usaProcessoAtivo } from '../rotasDoProcesso';

describe('quais telas carregam o ?lid=', () => {
  it('as que leem o processo ativo', () => {
    ['/processo/28', '/precificacao', '/proposta-tecnica', '/documentos',
     '/apoio-juridico', '/apoio-juridico/redigir/12', '/robo-lances', '/aurelia',
    ].forEach((r) => expect(usaProcessoAtivo(r), r).toBe(true));
  });

  it('as que não leem ficam com a URL limpa', () => {
    ['/financeiro', '/financeiro/demonstracoes', '/equipe', '/configuracoes',
     '/kanban', '/gestao-contratos', '/painel',
    ].forEach((r) => expect(usaProcessoAtivo(r), r).toBe(false));
  });

  it('não confunde rota que apenas começa com o mesmo texto', () => {
    // '/documentos-modelo' não é '/documentos'.
    expect(usaProcessoAtivo('/documentos-modelo')).toBe(false);
    expect(usaProcessoAtivo('/documentos/123')).toBe(true);
  });
});
