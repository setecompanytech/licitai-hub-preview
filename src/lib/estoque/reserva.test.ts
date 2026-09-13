import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { STATUS_QUE_RESERVAM, disponivelDe } from './reserva';

/**
 * Duas telas derivam "reservado" e "disponível" do mesmo banco: a aba Pedidos
 * do contrato e a aba Estoque de Compras. O estoque tem UMA coluna de saldo; o
 * resto é cálculo. Se um dia `'separado'` passar a segurar quantidade e só uma
 * das duas souber, o mesmo produto terá dois disponíveis diferentes no mesmo
 * sistema — e nenhum dos dois parecerá errado lendo o código de perto.
 *
 * O caso de varredura existe porque a divergência não mora em nenhum dos dois
 * arquivos: mora na diferença entre eles.
 */
describe('definição de estoque reservado', () => {
  it('nenhuma tela declara a própria lista de status que reserva', () => {
    const arquivos = [
      'src/components/contratos/ContratoPedidos.tsx',
      'src/pages/GestaoCompras.tsx',
    ];
    for (const caminho of arquivos) {
      const fonte = readFileSync(caminho, 'utf8');
      expect(fonte).toContain('STATUS_QUE_RESERVAM');
      // A lista literal não pode reaparecer ao lado de um filtro de status.
      expect(fonte).not.toMatch(/\.in\(\s*'status'\s*,\s*\[\s*'pendente'/);
    }
  });

  it('só pendente e parcial seguram quantidade', () => {
    expect([...STATUS_QUE_RESERVAM]).toEqual(['pendente', 'parcial']);
    // Atendido já baixou; cancelado não vai baixar.
    expect(STATUS_QUE_RESERVAM).not.toContain('atendido');
    expect(STATUS_QUE_RESERVAM).not.toContain('cancelado');
  });

  it('reserva não apurada não vira zero', () => {
    expect(disponivelDe(100, 20)).toBe(80);
    expect(disponivelDe(100, 0)).toBe(100);
    // `null` diz "não conferimos", que é diferente de "nada segura".
    expect(disponivelDe(100, null)).toBeNull();
  });
});
