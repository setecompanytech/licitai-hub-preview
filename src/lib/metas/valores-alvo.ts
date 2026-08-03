/**
 * Resolução dos valores-alvo vigentes.
 *
 * A tabela `comercial_valores_alvo` guarda histórico: a mesma modalidade pode
 * ter várias linhas, com vigências diferentes e, opcionalmente, presas a um
 * colaborador. Quem consome o motor precisa de um mapa simples
 * `modalidade → centavos`, já resolvido para uma data e uma pessoa.
 *
 * Precedência, na ordem:
 *   1. linha do colaborador vence a linha da empresa (`user_id IS NULL`);
 *   2. entre linhas do mesmo escopo, a de `vigencia_inicio` mais recente vence.
 */

import type { DataCivil } from './dias-uteis';
import { paraCentavos } from './dinheiro';

/** Linha de `comercial_valores_alvo`, com o valor em REAIS como vem do banco. */
export type ValorAlvoLinha = {
  modalidade_codigo: string;
  valor_alvo: number | string;
  vigencia_inicio: DataCivil;
  vigencia_fim: DataCivil | null;
  user_id: string | null;
};

/** A linha está valendo na data de referência? */
function vigenteEm(linha: ValorAlvoLinha, referencia: DataCivil): boolean {
  if (linha.vigencia_inicio > referencia) return false;
  if (linha.vigencia_fim && linha.vigencia_fim < referencia) return false;
  return true;
}

/**
 * Mapa `modalidade_codigo → valor em centavos` vigente na data, do ponto de
 * vista do colaborador informado. Passar `null` em `userId` resolve apenas
 * pelos padrões da empresa.
 */
export function resolverValoresAlvo(
  linhas: ValorAlvoLinha[],
  referencia: DataCivil,
  userId: string | null = null,
): Record<string, number> {
  const escolhida = new Map<string, ValorAlvoLinha>();

  for (const linha of linhas) {
    if (!vigenteEm(linha, referencia)) continue;
    // Linha de outro colaborador não diz nada sobre esta pessoa.
    if (linha.user_id !== null && linha.user_id !== userId) continue;

    const atual = escolhida.get(linha.modalidade_codigo);
    if (!atual) {
      escolhida.set(linha.modalidade_codigo, linha);
      continue;
    }

    const ganhaPorEscopo = linha.user_id !== null && atual.user_id === null;
    const perdePorEscopo = linha.user_id === null && atual.user_id !== null;
    if (ganhaPorEscopo) {
      escolhida.set(linha.modalidade_codigo, linha);
    } else if (!perdePorEscopo && linha.vigencia_inicio > atual.vigencia_inicio) {
      escolhida.set(linha.modalidade_codigo, linha);
    }
  }

  const mapa: Record<string, number> = {};
  for (const [modalidade, linha] of escolhida) {
    mapa[modalidade] = paraCentavos(Number(linha.valor_alvo));
  }
  return mapa;
}
