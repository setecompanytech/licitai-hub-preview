import { describe, it, expect } from 'vitest';
import { casarDanfesComAsPartes, danfeDaNota, fraseDaSoma, somaDasPartes } from './partes-do-rateio';

/** A TED de 27/05 do 068/2025: seis notas, seis pedidos (valores reais do lote). */
const partes = [
  { contrato_pedido_id: 'p728', numero_pedido: '728', nota_fiscal: '728', valor: 1343620.57 },
  { contrato_pedido_id: 'p725', numero_pedido: '725', nota_fiscal: '000.000.725', valor: 97090.99 },
  { contrato_pedido_id: 'p726', numero_pedido: '726', nota_fiscal: '726', valor: 684.99 },
  { contrato_pedido_id: 'p727', numero_pedido: '727', nota_fiscal: '727', valor: 373015.11 },
  { contrato_pedido_id: 'p729', numero_pedido: '729', nota_fiscal: '729', valor: 2537 },
  { contrato_pedido_id: 'p730', numero_pedido: '730', nota_fiscal: '730', valor: 2790.7 },
];
const docs = [
  { numero: '725', storage_path: 'a/725.pdf', arquivo_nome: 'NFe N° 000.000.725 - SEDUC - CARNE MOIDA.pdf' },
  { numero: null, storage_path: 'a/726.pdf', arquivo_nome: 'NFe N° 000.000.726 - SEDUC - CARNE MOIDA.pdf' },
  { numero: null, storage_path: null, arquivo_nome: 'comprovante.pdf' },
  { numero: '1727', storage_path: 'a/1727.pdf', arquivo_nome: 'outra.pdf' },
];

describe('partes do rateio', () => {
  it('a DANFE casa pelo número gravado; sem número, pelo nome do arquivo; nunca por pedaço de outro número', () => {
    expect(danfeDaNota('000.000.725', docs)?.storage_path).toBe('a/725.pdf');
    expect(danfeDaNota('726', docs)?.storage_path).toBe('a/726.pdf');
    expect(danfeDaNota('727', docs)).toBeNull();
    expect(danfeDaNota(null, docs)).toBeNull();
  });
  it('as partes saem em ordem de pedido, com a DANFE de cada uma', () => {
    const r = casarDanfesComAsPartes(partes, docs);
    expect(r.map((p) => p.numero_pedido)).toEqual(['725', '726', '727', '728', '729', '730']);
    expect(r[0].danfe?.arquivo_nome).toContain('725');
    expect(r[1].danfe?.storage_path).toBe('a/726.pdf');
    expect(r[2].danfe).toBeNull();
  });
  it('a soma fecha ao centavo com o recebimento, e a frase diz quando não fecha', () => {
    expect(somaDasPartes(partes)).toBe(1819739.36);
    expect(fraseDaSoma(partes, 1819739.36)).toContain('igual ao recebimento');
    expect(fraseDaSoma(partes.slice(1), 1819739.36)).toContain('sem pedido');
  });
});
