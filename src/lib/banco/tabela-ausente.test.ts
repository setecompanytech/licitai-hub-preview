import { describe, expect, it } from 'vitest';
import { tabelaAusente } from './tabela-ausente';

describe('tabelaAusente — migration ainda não colada não é erro da empresa', () => {
  it('reconhece os códigos do Postgres e do PostgREST', () => {
    expect(tabelaAusente({ code: '42P01', message: 'relation "public.documentos_solicitacoes" does not exist' })).toBe(true);
    expect(tabelaAusente({ code: 'PGRST205', message: "Could not find the table 'public.documentos_solicitacoes' in the schema cache" })).toBe(true);
    expect(tabelaAusente({ code: 'PGRST202', message: 'Could not find the function public.x in the schema cache' })).toBe(true);
  });

  it('reconhece pela mensagem quando o código não vem', () => {
    expect(tabelaAusente({ message: "Could not find the table 'public.certidoes_orgaos_da_empresa' in the schema cache" })).toBe(true);
    expect(tabelaAusente({ message: 'relation "certidoes_orgaos_da_empresa" does not exist' })).toBe(true);
  });

  it('qualquer outro erro continua sendo erro de verdade', () => {
    expect(tabelaAusente({ code: '42501', message: 'new row violates row-level security policy' })).toBe(false);
    expect(tabelaAusente({ message: 'No suitable key or wrong key type' })).toBe(false);
    expect(tabelaAusente(null)).toBe(false);
    expect(tabelaAusente(undefined)).toBe(false);
  });
});
