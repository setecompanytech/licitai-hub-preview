import { describe, it, expect, beforeEach } from 'vitest';
import {
  assinarReleituras, releiturasEmCurso, releituraDe,
  comecarReleitura, progredirReleitura, terminarReleitura, limparReleituras,
} from '@/lib/contratos/releitura';

beforeEach(() => limparReleituras());

describe('releitura em curso', () => {
  it('a leitura sobrevive a quem a disparou', () => {
    comecarReleitura('arq-1', 'contrato.pdf');
    // Nenhum componente montado; o módulo continua sabendo.
    expect(releituraDe('arq-1')?.nome).toBe('contrato.pdf');
    expect(releiturasEmCurso()).toHaveLength(1);
  });

  it('o progresso chega a quem estiver ouvindo', () => {
    const vistos: string[] = [];
    const parar = assinarReleituras(() => {
      vistos.push(releituraDe('arq-1')?.mensagem ?? 'fim');
    });
    comecarReleitura('arq-1', 'contrato.pdf');
    progredirReleitura('arq-1', 'Lendo por OCR: página 5–8 de 40…');
    terminarReleitura('arq-1');
    parar();
    expect(vistos).toEqual([
      'Baixando o documento…',
      'Lendo por OCR: página 5–8 de 40…',
      'fim',
    ]);
  });

  it('quem assina depois do início já vê o que está rodando', () => {
    comecarReleitura('arq-1', 'contrato.pdf');
    progredirReleitura('arq-1', 'Estruturando os dados lidos…');
    // Simula o retorno à aba: o componente remonta e consulta o módulo.
    expect(releituraDe('arq-1')?.mensagem).toBe('Estruturando os dados lidos…');
  });

  it('o mesmo arquivo não é lido duas vezes ao mesmo tempo', () => {
    expect(comecarReleitura('arq-1', 'contrato.pdf')).toBe(true);
    expect(comecarReleitura('arq-1', 'contrato.pdf')).toBe(false);
    expect(releiturasEmCurso()).toHaveLength(1);
  });

  it('arquivos diferentes correm juntos', () => {
    comecarReleitura('arq-1', 'contrato.pdf');
    comecarReleitura('arq-2', 'aditivo.pdf');
    expect(releiturasEmCurso().map(r => r.arquivoId)).toEqual(['arq-1', 'arq-2']);
    terminarReleitura('arq-1');
    expect(releiturasEmCurso().map(r => r.arquivoId)).toEqual(['arq-2']);
  });

  it('o instantâneo mantém identidade enquanto nada muda', () => {
    comecarReleitura('arq-1', 'contrato.pdf');
    // useSyncExternalStore compara por identidade: array novo a cada chamada
    // entra em laço infinito de render.
    expect(releiturasEmCurso()).toBe(releiturasEmCurso());
  });

  it('progresso e término de arquivo que não está rodando não fazem nada', () => {
    let avisos = 0;
    const parar = assinarReleituras(() => { avisos++; });
    progredirReleitura('fantasma', 'oi');
    terminarReleitura('fantasma');
    parar();
    expect(avisos).toBe(0);
  });
});
