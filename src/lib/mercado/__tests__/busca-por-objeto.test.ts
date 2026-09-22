import { describe, it, expect } from 'vitest';
import {
  descricaoDaTentativa, ehModoDeBusca, palavrasDaBusca, proximosPassos, rotuloDoProvedor, MODO_PADRAO, MODOS_DE_BUSCA,
} from '../busca-por-objeto';

describe('busca por objeto — as réguas', () => {
  it('as palavras que contam: três letras ou mais, sem repetição, na ordem', () => {
    expect(palavrasDaBusca('CARNE MOIDA PATINHO')).toEqual(['carne', 'moida', 'patinho']);
    expect(palavrasDaBusca('Carne moída, carne bovina de 1ª')).toEqual(['carne', 'moída', 'bovina']);
    expect(palavrasDaBusca('  ')).toEqual([]);
  });

  it('o vazio diz o que foi tentado, no vocabulário de quem lê', () => {
    expect(descricaoDaTentativa({ modo: 'qualquer', uf: 'PA', anos: 3 })).toBe('qualquer palavra, em PA, nos últimos 3 anos');
    expect(descricaoDaTentativa({ modo: 'todas', uf: null, anoExato: 2025 })).toBe('todas as palavras, em todas as UFs, no ano de 2025');
    expect(descricaoDaTentativa({ modo: 'significado', uf: 'PA', municipio: 'Belém', anos: 1 }))
      .toBe('só o significado, em PA, município "Belém", no último ano');
  });

  it('nunca um beco sem saída: cada modo tem um passo mais largo, e a UF pode abrir', () => {
    expect(proximosPassos('todas', 'PA').map((p) => p.rotulo)).toEqual(['Tentar com qualquer palavra', 'Buscar em todas as UFs']);
    expect(proximosPassos('qualquer', null).map((p) => p.rotulo)).toEqual(['Tentar só por significado']);
    expect(proximosPassos('significado', 'PA')[0]).toEqual({ modo: 'qualquer', rotulo: 'Tentar por palavras' });
  });

  it('o padrão é "qualquer palavra" e só os três modos existem', () => {
    expect(MODO_PADRAO).toBe('qualquer');
    expect(MODOS_DE_BUSCA.map((m) => m.valor)).toEqual(['todas', 'qualquer', 'significado']);
    expect(ehModoDeBusca('0.45')).toBe(false);
    expect(ehModoDeBusca('todas')).toBe(true);
  });

  it('o provedor vira frase; o desconhecido passa como veio', () => {
    expect(rotuloDoProvedor('palavras+significado')).toBe('palavras, ordenadas por semelhança de significado');
    expect(rotuloDoProvedor('palavras (por data)')).toBe('palavras, por data');
    expect(rotuloDoProvedor('x')).toBe('x');
  });
});
