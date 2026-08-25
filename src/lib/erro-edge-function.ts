/**
 * O motivo real de uma edge function ter falhado.
 *
 * Quando a função devolve status 500 com `{ error: "..." }` no corpo — que é o
 * padrão deste repositório —, o cliente do Supabase entrega um
 * `FunctionsHttpError` cuja `.message` é sempre a mesma frase genérica:
 *
 *     Edge Function returned a non-2xx status code
 *
 * A mensagem que interessa ("STRIPE_SECRET_KEY is not set", "No such price",
 * "Usuário não autenticado") fica no CORPO da resposta, dentro de
 * `error.context`, e só aparece se alguém for buscá-la.
 *
 * Ninguém ia. O padrão em todo o app é `catch (err) { console.error(err);
 * toast.error('Erro ao X. Tente novamente.') }` — e "tente novamente" é
 * conselho inútil quando a causa é uma variável de ambiente ausente: tentar
 * de novo vai falhar de novo, para sempre, e nada na tela diz por quê.
 *
 * Este helper vai buscar. É assíncrono porque ler o corpo é assíncrono.
 */

export async function motivoDaEdgeFunction(erro: unknown): Promise<string | null> {
  if (!erro) return null;

  const ctx = (erro as { context?: unknown }).context;

  // FunctionsHttpError: o corpo é uma Response ainda não lida.
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const corpo = await (ctx as Response).clone().json();
      const msg = corpo?.error ?? corpo?.message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    } catch {
      // Corpo não era JSON — tenta como texto puro antes de desistir.
      try {
        const texto = await (ctx as Response).clone().text();
        if (texto.trim()) return texto.slice(0, 300);
      } catch { /* segue */ }
    }
  }

  // Algumas versões já entregam o corpo desserializado.
  if (ctx && typeof ctx === 'object') {
    const msg = (ctx as { error?: string; message?: string }).error
      ?? (ctx as { error?: string; message?: string }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  const generica = (erro as { message?: string }).message;
  if (typeof generica === 'string' && generica.trim()
      && !/non-2xx status code/i.test(generica)) {
    return generica;
  }
  return null;
}

/**
 * Traduz os motivos que se repetem, e devolve o original quando não conhece.
 *
 * A regra é a mesma de `erro-do-banco.ts`: inventar uma frase genérica é pior
 * do que mostrar a técnica — a técnica pode ser pesquisada, e leva a alguém
 * que entende. O que não pode é sumir.
 */
export function explicarMotivo(motivo: string | null): string | null {
  if (!motivo) return null;

  if (/STRIPE_SECRET_KEY is not set/i.test(motivo)) {
    return 'O pagamento não está configurado no servidor (chave do Stripe ausente). '
         + 'Isso é configuração do sistema, não da sua conta — tentar de novo não resolve.';
  }
  if (/No such price|resource_missing/i.test(motivo)) {
    return 'O plano selecionado não existe mais no Stripe. Os preços foram recriados '
         + 'e o cadastro do sistema aponta para os antigos.';
  }
  if (/Usuário não autenticado|Authorization header/i.test(motivo)) {
    return 'Sua sessão expirou. Saia e entre de novo antes de assinar.';
  }
  if (/E-mail do usuário não encontrado/i.test(motivo)) {
    return 'Sua conta está sem e-mail cadastrado, e o Stripe exige um para emitir a cobrança.';
  }
  if (/testmode|test mode|live mode/i.test(motivo)) {
    return 'Há mistura entre modo de teste e modo de produção no Stripe: a chave e o preço '
         + 'estão em ambientes diferentes.';
  }
  return motivo;
}

/** O que mostrar ao usuário: o motivo explicado, ou nada se não houver motivo. */
export async function descreverFalha(erro: unknown): Promise<string | null> {
  return explicarMotivo(await motivoDaEdgeFunction(erro));
}
