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
 *
 * ⚠️ SOBE NO MESMO COMMIT DA LEVA, não depois. Em 02/10/2026 o carimbo entrou
 * num commit e três levas de front entraram DEPOIS dele: o domínio servia o
 * mesmo número do repositório, o verificador dizia "tudo publicado", e o piso
 * em massa e a sala ao vivo não estavam no ar. Carimbo atrasado é pior que
 * carimbo nenhum — ele transforma "não sei" em "sim" errado.
 */
export const VERSAO_APP = '2026-10-02.5';
