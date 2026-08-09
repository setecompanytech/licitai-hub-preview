/**
 * E-mail da conta de um acesso individual criado por convite de setor.
 *
 * O setor tem UM e-mail compartilhado, mas o Supabase Auth exige e-mail unico
 * por conta. A saida e o sub-enderecamento (`+tag`): `comercial+joao@x.com.br`
 * e um endereco distinto para o Auth e, nos provedores que o suportam, e
 * entregue na mesma caixa de `comercial@x.com.br`.
 *
 * Isso importa por um motivo concreto: mantem a redefinicao de senha
 * funcionando. Com um endereco inexistente, o "Esqueceu a senha?" enviaria
 * para o vazio e o colaborador ficaria sem acesso ate alguem intervir.
 *
 * Confirmado em 09/08/2026 no HostGator (cPanel/Dovecot) de gruposantarosa:
 * `comercial+01@` chegou na caixa de entrada, nao numa subpasta.
 *
 * Sem imports de proposito — assim o vitest importa este arquivo direto e
 * testa a regra de verdade.
 *
 * O index.ts NAO importa daqui: ele traz uma copia literal do bloco entre os
 * marcadores abaixo. O motivo e operacional — publicar a function pelo editor
 * do Dashboard obriga a recriar cada arquivo a mao, e esquecer o segundo
 * derruba o deploy inteiro ("Module not found", 09/08/2026). Com um arquivo
 * so, publicar e colar e clicar.
 *
 * A copia nao pode divergir: src/test/auth-email-conta.test.ts compara os dois
 * blocos caractere a caractere. Editou aqui, copie o bloco inteiro para la.
 */

// <<<email-conta:inicio>>>
/** Reservado pela RFC 2606: nunca resolve, entao nunca entrega a terceiros. */
export const DOMINIO_SINTETICO = 'praefectus.invalid'

/**
 * Deriva o e-mail da conta a partir do login e do e-mail do setor.
 *
 * Cai no dominio sintetico quando o e-mail do setor nao serve de base — sem
 * isso, um cadastro com e-mail malformado geraria um endereco invalido e o
 * Auth recusaria a criacao, travando o convite inteiro.
 */
export function emailDaConta(login: string, emailSetor: string | null | undefined): string {
  const slug = (login ?? '').trim().toLowerCase()
  if (!slug) throw new Error('login vazio')

  const setor = (emailSetor ?? '').trim().toLowerCase()
  const arroba = setor.lastIndexOf('@')
  if (arroba <= 0) return `${slug}@${DOMINIO_SINTETICO}`

  // Tag anterior e descartada: comercial+antigo@x vira comercial+novo@x, e nao
  // comercial+antigo+novo@x, que muitos servidores recusam.
  const local = setor.slice(0, arroba).split('+')[0]
  const dominio = setor.slice(arroba + 1)

  // Dominio precisa de ponto: "01" ou "localhost" seriam recusados pelo Auth
  if (!local || !dominio.includes('.') || dominio.startsWith('.') || dominio.endsWith('.')) {
    return `${slug}@${DOMINIO_SINTETICO}`
  }

  return `${local}+${slug}@${dominio}`
}

/** O endereco e sintetico? Serve para a interface avisar que nao ha caixa postal. */
export function ehEmailSintetico(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase().endsWith(`@${DOMINIO_SINTETICO}`)
}
// <<<email-conta:fim>>>
