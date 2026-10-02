/**
 * Os certificados registrados, uma linha por empresa — os "slots" (02/10/2026).
 *
 * Pedido do Ian: *"ter slots no Praefectus pra ficar registrado"*, para a
 * Izabelle disputar com contas diferentes sem depender de alguém lembrar o que
 * foi enviado e quando.
 *
 * ── Por que isto é uma lib pura ─────────────────────────────────────────────
 *
 * A pergunta que a tela responde — "o robô consegue entrar como esta empresa?"
 * — tem quatro respostas possíveis, e confundi-las é caro: quem acha que está
 * registrado não envia o arquivo, e descobre na hora da disputa. Por isso a
 * régua mora aqui, com teste, e não espalhada em `if` de componente.
 *
 * ── A régua, do pior para o melhor ──────────────────────────────────────────
 *
 * | situação | o que é verdade |
 * | --- | --- |
 * | `sem-certificado` | ninguém enviou nada por esta empresa |
 * | `enviado-sem-senha` | o arquivo está no cofre, a senha não — enviado antes de 09/09/2026, quando o sistema passou a guardá-la. Não há como recuperar: só reenviar |
 * | `enviado-nao-instalado` | arquivo e senha estão lá, mas o robô não o instalou (o agente estava fora do ar, tipicamente) |
 * | `em-uso` | o agente confirmou a instalação |
 *
 * **`em-uso` não é promessa de que funcionará agora**: o certificado pode ter
 * vencido depois da instalação, e o vencimento não está no cofre — só dentro do
 * arquivo, que o sistema não abre. A tela diz desde quando está instalado e
 * deixa a inferência a quem opera, em vez de afirmar "válido".
 */

export type SituacaoDoCertificado =
  | 'sem-certificado'
  | 'enviado-sem-senha'
  | 'enviado-nao-instalado'
  | 'em-uso';

/** O que o servidor devolve por empresa. Nada de caminho de arquivo nem senha. */
export interface CertificadoDaEmpresa {
  empresa_id: string;
  razao_social: string | null;
  cnpj: string | null;
  /** Quando o arquivo chegou ao cofre. */
  enviado_em: string | null;
  /** Quando o agente confirmou a instalação. */
  instalado_em: string | null;
  /** Se a senha foi guardada — sem ela o robô não consegue instalar. */
  tem_senha: boolean;
  /** Há link de envio aberto e ainda não usado. */
  link_aberto: boolean;
}

export interface SlotDeCertificado extends CertificadoDaEmpresa {
  situacao: SituacaoDoCertificado;
  /** Uma frase que explica a situação a quem opera, sem jargão. */
  frase: string;
  /** Precisa de alguém? É o que ordena a lista. */
  pedeAcao: boolean;
}

/**
 * A ordem da leitura: primeiro quem impede o robô de entrar.
 *
 * Mesma lógica dos cartões das disputas — o que exige ação vem antes. Aqui não
 * há cronômetro, mas há a manhã do pregão: descobrir que falta certificado
 * quando a sessão abre é tarde.
 */
const PESO: Record<SituacaoDoCertificado, number> = {
  'sem-certificado': 3,
  'enviado-sem-senha': 2,
  'enviado-nao-instalado': 1,
  'em-uso': 0,
};

export function situacaoDoCertificado(c: CertificadoDaEmpresa): SituacaoDoCertificado {
  if (!c.enviado_em) return 'sem-certificado';
  if (!c.tem_senha) return 'enviado-sem-senha';
  if (!c.instalado_em) return 'enviado-nao-instalado';
  return 'em-uso';
}

/** Data em pt-BR, ou null quando não há — nunca "Invalid Date" na tela. */
function dia(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}

function fraseDaSituacao(c: CertificadoDaEmpresa, s: SituacaoDoCertificado): string {
  if (s === 'em-uso') {
    const quando = dia(c.instalado_em);
    return quando ? `No robô desde ${quando}` : 'No robô';
  }
  if (s === 'enviado-nao-instalado') {
    const quando = dia(c.enviado_em);
    return quando
      ? `Enviado em ${quando}, ainda não instalado no robô`
      : 'Enviado, ainda não instalado no robô';
  }
  if (s === 'enviado-sem-senha') {
    return 'O arquivo está guardado, mas a senha não — é preciso enviar de novo';
  }
  return c.link_aberto
    ? 'Nenhum certificado enviado — há um link de envio aberto'
    : 'Nenhum certificado enviado por esta empresa';
}

/**
 * Projeta e ORDENA os slots.
 *
 * Empate de situação é desfeito pelo nome da empresa, para a lista não dançar
 * entre carregamentos — ordem instável numa lista que a pessoa confere todo dia
 * é pior que ordem imperfeita.
 */
export function slotsDeCertificado(lista: CertificadoDaEmpresa[]): SlotDeCertificado[] {
  return lista
    .map((c) => {
      const situacao = situacaoDoCertificado(c);
      return {
        ...c,
        situacao,
        frase: fraseDaSituacao(c, situacao),
        pedeAcao: situacao !== 'em-uso',
      };
    })
    .sort((a, b) => {
      const peso = PESO[b.situacao] - PESO[a.situacao];
      if (peso !== 0) return peso;
      return (a.razao_social || '').localeCompare(b.razao_social || '', 'pt-BR');
    });
}

/**
 * Quantas empresas o robô consegue representar hoje.
 *
 * Serve ao resumo da lista. Diz o que é verdade — "2 de 4 empresas prontas" —,
 * nunca "tudo certo": uma empresa sem certificado é a disputa que não acontece.
 */
export function resumoDosSlots(slots: SlotDeCertificado[]): {
  prontas: number;
  total: number;
  pendentes: number;
  frase: string;
} {
  const prontas = slots.filter((s) => s.situacao === 'em-uso').length;
  const total = slots.length;
  const pendentes = total - prontas;
  let frase: string;
  if (total === 0) frase = 'Nenhuma empresa nesta conta';
  else if (pendentes === 0) {
    frase = total === 1 ? 'A empresa está pronta para disputar' : `As ${total} empresas estão prontas para disputar`;
  } else if (prontas === 0) {
    frase = total === 1 ? 'A empresa ainda não pode disputar' : `Nenhuma das ${total} empresas pode disputar ainda`;
  } else {
    frase = `${prontas} de ${total} empresas prontas para disputar`;
  }
  return { prontas, total, pendentes, frase };
}
