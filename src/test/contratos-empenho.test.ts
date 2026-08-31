import { describe, it, expect } from 'vitest';
import {
  tipoDeEmpenho, normalizarNumeroEmpenho, situacaoDoEmpenho, empenhoCancelado,
} from '@/lib/contratos/empenho';

describe('normalizarNumeroEmpenho', () => {
  it('as três grafias do mesmo empenho viram uma', () => {
    // Sem isto, três grafias viram três empenhos na hora de somar e o
    // controle de saldo deixa de existir sem ninguém perceber.
    const esperado = '2026NE003716';
    expect(normalizarNumeroEmpenho('2026NE003716')).toBe(esperado);
    expect(normalizarNumeroEmpenho('2026.260101NE003716')).toBe(esperado);
    expect(normalizarNumeroEmpenho('2026 NE 003716')).toBe(esperado);
  });

  it('completa o sequencial com zeros', () => {
    expect(normalizarNumeroEmpenho('2026NE895')).toBe('2026NE000895');
  });

  it('devolve null para vazio', () => {
    expect(normalizarNumeroEmpenho('')).toBeNull();
    expect(normalizarNumeroEmpenho(null)).toBeNull();
  });
});

describe('tipoDeEmpenho', () => {
  it('lê os três, com ou sem prefixo e acento', () => {
    expect(tipoDeEmpenho('empenho_global')).toBe('global');
    expect(tipoDeEmpenho('Ordinário')).toBe('ordinario');
    expect(tipoDeEmpenho('estimativo')).toBe('estimativo');
  });

  it('o que não é um dos três vira null, não palpite', () => {
    expect(tipoDeEmpenho('parcial')).toBeNull();
    expect(tipoDeEmpenho(null)).toBeNull();
  });
});

describe('situacaoDoEmpenho', () => {
  it('sem valor empenhado, não supõe cobertura', () => {
    // Supor que o empenho cobre porque ninguém informou o contrário é o
    // silêncio que o art. 60 não admite.
    const s = situacaoDoEmpenho({ somaDosPedidos: 50000 });
    expect(s.estado).toBe('sem_empenho');
    expect(s.severidade).toBe('atencao');
  });

  it('dentro do empenho é ok', () => {
    const s = situacaoDoEmpenho({ valorEmpenhado: 40000, somaDosPedidos: 10000 });
    expect(s.estado).toBe('dentro');
    expect(s.saldo).toBe(30000);
  });

  it('menos de 10% restantes já avisa', () => {
    const s = situacaoDoEmpenho({ valorEmpenhado: 40000, somaDosPedidos: 37000 });
    expect(s.estado).toBe('no_limite');
    expect(s.severidade).toBe('atencao');
  });

  it('excedido em empenho global é crítico e cita a lei', () => {
    const s = situacaoDoEmpenho({ valorEmpenhado: 40000, somaDosPedidos: 45000, tipo: 'global' });
    expect(s.estado).toBe('excedido');
    expect(s.severidade).toBe('critico');
    expect(s.frase).toMatch(/art\. 60/);
  });

  it('excedido em ESTIMATIVO é atenção, e pede reforço', () => {
    // O mesmo excesso é irregularidade grave num global e rotina num
    // estimativo. A frase muda porque a providência muda.
    const s = situacaoDoEmpenho({ valorEmpenhado: 40000, somaDosPedidos: 45000, tipo: 'estimativo' });
    expect(s.estado).toBe('excedido');
    expect(s.severidade).toBe('atencao');
    expect(s.frase).toMatch(/reforço/);
  });
});

describe('origem da espécie', () => {
  it('a IA só afirma quando leu o rótulo', () => {
    // O prompt manda devolver null sem rótulo. Aqui o que se testa é o que o
    // código faz com essa ausência: não inventa.
    expect(tipoDeEmpenho(undefined)).toBeNull();
    expect(tipoDeEmpenho('nota de empenho')).toBeNull();
  });

  it('lê as três espécies escritas como o documento as escreve', () => {
    expect(tipoDeEmpenho('ORDINÁRIO')).toBe('ordinario');
    expect(tipoDeEmpenho('Global')).toBe('global');
    expect(tipoDeEmpenho('ESTIMATIVO')).toBe('estimativo');
  });
});

describe('empenhoCancelado', () => {
  it('anulação que cobre tudo é cancelamento', () => {
    expect(empenhoCancelado({ valorOriginal: 5000, reforcos: 0, anulacoes: 5000 })).toBe(true);
  });

  it('anulação parcial não é cancelamento — o empenho segue vivo', () => {
    // O 2025NE000064: anulou R$ 24.722 de R$ 159.979,55 e continuou operando.
    expect(empenhoCancelado({ valorOriginal: 22.55, reforcos: 159957, anulacoes: 24722 })).toBe(false);
  });

  it('reforço posterior à anulação reabre o empenho', () => {
    // Anulou tudo e depois reforçou: o vigente voltou a ser positivo, e o
    // empenho autoriza de novo.
    expect(empenhoCancelado({ valorOriginal: 5000, reforcos: 3000, anulacoes: 5000 })).toBe(false);
  });

  it('vigente zero SEM anulação não é cancelamento', () => {
    // Empenho consumido por inteiro cumpriu seu papel; cancelado foi desfeito.
    // Os dois mostram R$ 0,00 e significam coisas opostas.
    expect(empenhoCancelado({ valorOriginal: 5000, reforcos: 0, anulacoes: 0 })).toBe(false);
  });

  it('centavo de arredondamento não impede o reconhecimento', () => {
    expect(empenhoCancelado({ valorOriginal: 135257.55, reforcos: 0, anulacoes: 135257.55 })).toBe(true);
  });

  it('valores ausentes não viram cancelamento', () => {
    expect(empenhoCancelado({ valorOriginal: null, reforcos: null, anulacoes: null })).toBe(false);
  });
});
