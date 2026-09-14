import { describe, expect, it } from 'vitest';
import { STATUS_ANDAMENTO, STATUS_GANHO, STATUS_PERDIDO } from './recortes-do-painel';
import { STATUS_PROCESSO } from './status';

/**
 * O indicador "Em andamento" do painel nunca contou processo em análise.
 *
 * A lista de grafias trazia `'Analisando'` — que é o TÍTULO da coluna no
 * Kanban, não o valor gravado. `licitacoes.status` recebe `'Em Análise'`, o
 * canônico de `STATUS_PROCESSO`, e ele estava fora. A lista tinha um valor que
 * nunca casava e faltava o que casa, então o número só subia quando o processo
 * SAÍA da análise.
 *
 * Ninguém enxerga isso lendo a lista: as duas palavras descrevem a mesma
 * etapa, e só a varredura do que é gravado distingue rótulo de valor.
 */
describe('recortes do painel — grafia gravada, não rótulo de tela', () => {
  it('conta o valor canônico de cada etapa em andamento', () => {
    // Estes três são gravados pelo seletor do Kanban e pelo fluxo de proposta.
    for (const canonico of ['Monitorando', 'Em Análise', 'Proposta Enviada', 'Em Disputa']) {
      expect(STATUS_ANDAMENTO, `${canonico} é status gravado e precisa contar`).toContain(canonico);
    }
  });

  it('não conta como andamento o que já é desfecho', () => {
    for (const decidido of ['Vencida', 'Homologada', 'Perdida', 'Arquivada']) {
      expect(STATUS_ANDAMENTO).not.toContain(decidido);
    }
  });

  it('toda grafia canônica está em algum recorte, ou é desfecho declarado', () => {
    const emAlgum = new Set([...STATUS_ANDAMENTO, ...STATUS_GANHO, ...STATUS_PERDIDO]);
    // "Arquivada" é o único canônico deliberadamente fora dos três recortes:
    // sair de circulação não é etapa nem resultado.
    const fora = STATUS_PROCESSO.filter((s) => !emAlgum.has(s) && s !== 'Arquivada');
    expect(fora).toEqual([]);
  });

  it('ganho e perda não se sobrepõem', () => {
    const intersecao = STATUS_GANHO.filter((g) => STATUS_PERDIDO.includes(g));
    expect(intersecao).toEqual([]);
  });
});
