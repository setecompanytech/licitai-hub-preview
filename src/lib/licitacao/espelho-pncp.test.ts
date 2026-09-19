import { describe, expect, it } from 'vitest';
import { pendenciaDoEspelho } from './espelho-pncp';

describe('pendenciaDoEspelho — o ato do órgão vira pendência, não desfecho', () => {
  it('os três valores reais do espelho pedem ação', () => {
    expect(pendenciaDoEspelho('Revogada')).toEqual({ selo: 'Revogada no PNCP', natureza: 'Desfecho a registrar' });
    expect(pendenciaDoEspelho('Anulada')).toEqual({ selo: 'Anulada no PNCP', natureza: 'Desfecho a registrar' });
    expect(pendenciaDoEspelho('Suspensa')).toEqual({ selo: 'Suspensa no PNCP', natureza: 'Suspensão a conferir' });
  });

  it('a situação normal e o desconhecido não pedem nada', () => {
    expect(pendenciaDoEspelho('Divulgada no PNCP')).toBeNull();
    expect(pendenciaDoEspelho('Publicado')).toBeNull();
    expect(pendenciaDoEspelho('')).toBeNull();
    expect(pendenciaDoEspelho(null)).toBeNull();
    expect(pendenciaDoEspelho(undefined)).toBeNull();
  });

  it('aceita o particípio masculino e espaços', () => {
    expect(pendenciaDoEspelho(' revogado ')?.selo).toBe('Revogada no PNCP');
    expect(pendenciaDoEspelho('SUSPENSO')?.natureza).toBe('Suspensão a conferir');
  });
});
