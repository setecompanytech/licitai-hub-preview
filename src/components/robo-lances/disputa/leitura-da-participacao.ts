/**
 * Como a participação do robô vira texto — dividido entre a aba do robô na
 * pasta do processo e a página da disputa (`/robo-lances/disputa/:id`).
 *
 * Moravam dentro de `workspace/robo/AbaRoboDoProcesso.tsx`. Com a página da
 * disputa dizendo as mesmas coisas sobre a mesma participação, duas cópias
 * seriam duas frases para a mesma versão aprovada — e a primeira a mudar
 * deixaria a outra mentindo.
 */
import type { TomSituacao } from '@/components/gestao/SeloSituacao';
import type { AbaDoPainel, Participacao } from '@/lib/robo/situacao-da-participacao';
import type { Leitura, VersaoVinculada } from '@/components/workspace/robo/consultas';
import { dataHoraDeBrasilia } from '@/components/workspace/robo/formatos';

export const TOM_DA_ABA: Record<AbaDoPainel, TomSituacao> = {
  cadastradas: 'neutro',
  configuradas: 'sucesso',
  em_disputa: 'ativo',
  encerradas: 'neutro',
};

export interface VersaoDescrita {
  texto: string;
  atencao: boolean;
  podeTentar: boolean;
}

/** A versão da precificação em uma frase — sem transformar ausência em aprovação. */
export function descreverVersao(versaoId: string | null | undefined, leitura: Leitura<VersaoVinculada>): VersaoDescrita {
  if (!versaoId) return { texto: 'Nenhuma versão aprovada', atencao: true, podeTentar: false };
  switch (leitura.estado) {
    case 'migracao_pendente':
      return {
        texto: 'Migração pendente — as versões da precificação ainda não existem no banco',
        atencao: true,
        podeTentar: false,
      };
    case 'erro':
      return { texto: `Não foi possível ler a versão vinculada: ${leitura.erro}`, atencao: true, podeTentar: true };
    case 'pronta':
      break;
    default:
      return { texto: 'Lendo a versão vinculada…', atencao: false, podeTentar: false };
  }
  const v = leitura.dados;
  // A policy só mostra versão a quem opera: vazio sem erro é falta de acesso.
  if (!v) return { texto: 'Versão vinculada não visível para esta conta', atencao: true, podeTentar: false };
  const quando = dataHoraDeBrasilia(v.aprovada_em);
  const aprovadaEm = quando ? ` em ${quando} (Brasília)` : '';
  if (v.situacao === 'aprovada') return { texto: `Versão ${v.numero} aprovada${aprovadaEm}`, atencao: false, podeTentar: false };
  if (v.situacao === 'substituida') {
    return {
      texto: `Versão ${v.numero} aprovada${aprovadaEm} — já substituída por uma aprovação mais recente`,
      atencao: true,
      podeTentar: false,
    };
  }
  return { texto: `Versão ${v.numero} — ${v.situacao ?? 'situação não informada'}, sem aprovação`, atencao: true, podeTentar: false };
}

/** A pendência da projeção, exceto as que já têm lugar próprio na tela. */
export function pendenciaVisivel(p: Participacao, envioIndisponivel: boolean): string | null {
  const texto = p.pendenciaPrincipal;
  if (!texto) return null;
  if (envioIndisponivel && texto.startsWith('Envio de lances indisponível')) return null;
  if (texto.startsWith('Fase marcada manualmente')) return null;
  if (texto.startsWith('Parada solicitada')) return null;
  return texto;
}
