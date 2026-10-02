import { describe, expect, it } from 'vitest';
import {
  agentesMudos,
  MINUTOS_SEM_HEARTBEAT_PADRAO,
  type AgenteParaVigiar,
} from '../../../../supabase/functions/_shared/vigia-do-agente';

/**
 * A vigia roda por cron, dentro de um try/catch que não pode derrubar o disparo
 * das disputas — ou seja, um defeito ali falharia EM SILÊNCIO, que é a pior
 * forma de falhar num vigia. Por isso a regra é testada aqui.
 */
const AGORA = new Date('2026-10-02T09:00:00.000Z');
const minutosAtras = (m: number) => new Date(AGORA.getTime() - m * 60_000).toISOString();

const agente = (over: Partial<AgenteParaVigiar> = {}): AgenteParaVigiar => ({
  id: 'a1',
  user_id: 'u1',
  nome: 'Agente Praefectus',
  status: 'ativo',
  ultimo_heartbeat: minutosAtras(1),
  ...over,
});

describe('agentesMudos', () => {
  it('agente que respondeu agora não vira aviso', () => {
    expect(agentesMudos([agente()], AGORA)).toEqual([]);
  });

  it('silêncio longo vira aviso, com os minutos', () => {
    const [aviso] = agentesMudos([agente({ ultimo_heartbeat: minutosAtras(20) })], AGORA);
    expect(aviso.minutos).toBe(20);
    expect(aviso.titulo).toContain('Robô sem sinal');
  });

  it('a mensagem diz a CONSEQUÊNCIA, não o sintoma', () => {
    const [aviso] = agentesMudos([agente({ ultimo_heartbeat: minutosAtras(20) })], AGORA);
    expect(aviso.mensagem).toContain('nenhuma disputa entra e nenhum lance é dado');
    expect(aviso.mensagem).not.toContain('heartbeat');
  });

  it('no limite exato já avisa', () => {
    const r = agentesMudos([agente({ ultimo_heartbeat: minutosAtras(MINUTOS_SEM_HEARTBEAT_PADRAO) })], AGORA);
    expect(r).toHaveLength(1);
  });

  it('um minuto antes do limite, ainda não', () => {
    const r = agentesMudos([agente({ ultimo_heartbeat: minutosAtras(MINUTOS_SEM_HEARTBEAT_PADRAO - 1) })], AGORA);
    expect(r).toEqual([]);
  });

  it('agente desligado de propósito não é notícia', () => {
    const r = agentesMudos([agente({ status: 'inativo', ultimo_heartbeat: minutosAtras(600) })], AGORA);
    expect(r).toEqual([]);
  });

  it('agente que NUNCA respondeu não vira "parou de responder"', () => {
    const r = agentesMudos([agente({ ultimo_heartbeat: null })], AGORA);
    expect(r).toEqual([]);
  });

  it('data inválida não quebra nem vira aviso', () => {
    const r = agentesMudos([agente({ ultimo_heartbeat: 'nao-e-data' })], AGORA);
    expect(r).toEqual([]);
  });

  it('a chave carrega o heartbeat — o MESMO silêncio não avisa duas vezes', () => {
    const quando = minutosAtras(20);
    const [a1] = agentesMudos([agente({ ultimo_heartbeat: quando })], AGORA);
    const [a2] = agentesMudos([agente({ ultimo_heartbeat: quando })], new Date(AGORA.getTime() + 60_000));
    expect(a1.chave).toBe(a2.chave);
  });

  it('agente que voltou e caiu de novo gera aviso NOVO', () => {
    const [a1] = agentesMudos([agente({ ultimo_heartbeat: minutosAtras(20) })], AGORA);
    const [a2] = agentesMudos([agente({ ultimo_heartbeat: minutosAtras(15) })], AGORA);
    expect(a1.chave).not.toBe(a2.chave);
  });

  it('vários agentes, só os mudos', () => {
    const r = agentesMudos([
      agente({ id: 'vivo', ultimo_heartbeat: minutosAtras(1) }),
      agente({ id: 'mudo', ultimo_heartbeat: minutosAtras(30) }),
      agente({ id: 'desligado', status: 'inativo', ultimo_heartbeat: minutosAtras(30) }),
    ], AGORA);
    expect(r.map((x) => x.agenteId)).toEqual(['mudo']);
  });

  it('agente sem nome não quebra a mensagem', () => {
    const [aviso] = agentesMudos([agente({ nome: null, ultimo_heartbeat: minutosAtras(20) })], AGORA);
    expect(aviso.titulo).toContain('sem nome');
  });

  it('lista vazia não quebra', () => {
    expect(agentesMudos([], AGORA)).toEqual([]);
  });
});
