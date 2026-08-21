/**
 * Carimbo da versão publicada.
 *
 * Verificar o que está no ar vinha sendo feito por assinatura de texto: procurar
 * no bundle uma frase que só existe no código novo. Funciona para mudança que
 * cria texto — um botão, um rótulo —, e falha justamente nas mais delicadas: a
 * correção do Voltar e a do `?lid=` não acrescentaram frase nenhuma, e ficaram
 * sem como conferir.
 *
 * Este valor é bump manual, junto do commit. `scripts/verificar-publicacao.sh`
 * compara o que está aqui com o que o domínio serve: se coincidirem, o último
 * commit chegou ao ar; se não, falta publicar.
 *
 * Formato: AAAA-MM-DD.N — data e a quantas publicações do dia.
 */
export const VERSAO_APP = '2026-08-21.6';
