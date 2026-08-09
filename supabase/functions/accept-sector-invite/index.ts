// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

// ─── copia de ./email-conta.ts ───────────────────────────────────────────────
//
// Por que copiada e nao importada: publicar esta function pelo editor do
// Dashboard exige criar CADA arquivo a mao antes do deploy. Esquecer o
// segundo arquivo derruba o bundle inteiro com "Module not found" — aconteceu
// em 09/08/2026. Com um arquivo so, publicar e colar e clicar.
//
// O original continua existindo porque o vitest nao consegue importar este
// index.ts (`npm:` e `Deno.serve`). A divergencia entre os dois e barrada por
// src/test/auth-email-conta.test.ts, que compara os blocos caractere a
// caractere. Se voce editar um lado, copie o outro inteiro — os marcadores
// abaixo delimitam exatamente o trecho.
//
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

/**
 * Aceite do convite por setor.
 *
 * O e-mail do setor e ponto de DISTRIBUICAO do link: varios colaboradores do
 * mesmo setor usam o mesmo convite, cada um criando o proprio acesso. Como o
 * setor tem um unico e-mail compartilhado e o Supabase Auth exige e-mail unico
 * por conta, a identidade passa a ser o LOGIN, e o e-mail da conta e sintetico.
 *
 * Por que a conta e criada AQUI e nao no navegador:
 *   - `admin.createUser({ email_confirm: true })` pula a confirmacao por
 *     e-mail, que nunca chegaria num endereco @praefectus.invalid;
 *   - a checagem de login disponivel e a criacao ficam na mesma transacao
 *     logica, sem janela para dois colaboradores fecharem o mesmo login;
 *   - se qualquer passo seguinte falhar, da para desfazer a conta criada.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const equipeLabels: Record<string, string> = {
  geral: 'Geral',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  logistica: 'Logística',
  juridico: 'Jurídico',
  contabil: 'Contábil',
  licitacoes: 'Licitações',
  documentos: 'Documentos',
}

const REGRA_LOGIN = /^[A-Za-z0-9._-]{3,30}$/

function capitalizar(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  let usuarioCriado: string | null = null
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // Sem verificacao de JWT: a chamada acontece antes de existir sessao.
    // A seguranca vem do token do convite (64 hex) e da sua expiracao.
    const { token, login, senha, nome } = await req.json()

    if (!token || !login || !senha || !nome) {
      return json({ error: 'token, login, senha e nome são obrigatórios' }, 400)
    }
    if (!REGRA_LOGIN.test(String(login).trim())) {
      return json({
        error: 'Login inválido. Use de 3 a 30 caracteres, apenas letras, números, ponto, hífen ou sublinhado.',
      }, 422)
    }
    if (String(senha).length < 8) {
      return json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, 422)
    }

    const loginLimpo = String(login).trim()

    // ── 1. Convite valido? ────────────────────────────────────────────────
    const { data: convite, error: conviteError } = await adminClient
      .from('empresa_convites')
      .select('id, empresa_id, equipe, papel, email_setor, expires_at, usos, max_usos')
      .eq('token', token)
      .maybeSingle()

    if (conviteError || !convite) return json({ error: 'Convite não encontrado' }, 404)

    if (new Date(convite.expires_at) < new Date()) {
      return json({ error: 'Convite expirado' }, 410)
    }

    // accepted_at NAO bloqueia mais: o link e do setor inteiro. Quem limita
    // e max_usos, quando o admin define um teto.
    if (convite.max_usos !== null && convite.usos >= convite.max_usos) {
      return json({
        error: `Este convite já criou o número máximo de acessos (${convite.max_usos}).`,
      }, 409)
    }

    // ── 2. Login livre? ───────────────────────────────────────────────────
    const { data: livre, error: erroDisponibilidade } = await adminClient
      .rpc('username_disponivel', { p_username: loginLimpo })

    if (erroDisponibilidade) {
      return json({ error: `Erro ao verificar o login: ${erroDisponibilidade.message}` }, 500)
    }
    if (!livre) {
      return json({ error: `O login "${loginLimpo}" já está em uso. Escolha outro.` }, 409)
    }

    // ── 3. Cria a conta ───────────────────────────────────────────────────
    // Sub-endereçamento no e-mail do setor: mantem a redefinicao de senha
    // funcionando, porque a mensagem chega na caixa compartilhada.
    const email = emailDaConta(loginLimpo, convite.email_setor)
    const { data: criado, error: erroCriacao } = await adminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // endereco .invalid nunca receberia a confirmacao
      user_metadata: { nome_completo: nome, login: loginLimpo, email_setor: convite.email_setor },
    })

    if (erroCriacao || !criado?.user) {
      const msg = erroCriacao?.message ?? 'Erro ao criar a conta'
      // Colisao de e-mail sintetico = login ja usado por conta orfa
      const conflito = msg.toLowerCase().includes('already')
      return json({
        error: conflito ? `O login "${loginLimpo}" já está em uso. Escolha outro.` : msg,
      }, conflito ? 409 : 500)
    }

    const user_id = criado.user.id
    usuarioCriado = user_id

    // ── 4. Login no perfil — e o que a tela de acesso consulta ────────────
    // O perfil nasce por trigger no signup; garantimos a linha com upsert
    // para nao depender da ordem de execucao.
    const { error: erroPerfil } = await adminClient
      .from('profiles')
      .upsert(
        { user_id, username: loginLimpo, nome_completo: nome },
        { onConflict: 'user_id' },
      )

    if (erroPerfil) {
      await adminClient.auth.admin.deleteUser(user_id)
      usuarioCriado = null
      const duplicado = erroPerfil.code === '23505'
      return json({
        error: duplicado
          ? `O login "${loginLimpo}" já está em uso. Escolha outro.`
          : `Erro ao gravar o login: ${erroPerfil.message}`,
      }, duplicado ? 409 : 500)
    }

    // ── 5. Vinculo com a empresa ──────────────────────────────────────────
    const nomeSetor = `Setor ${equipeLabels[convite.equipe] ?? capitalizar(convite.equipe)}`
    const { error: memberError } = await adminClient
      .from('empresa_membros')
      .insert({
        user_id,
        empresa_id: convite.empresa_id,
        equipe: convite.equipe,
        papel: convite.papel,
        nome: nomeSetor,
        email: convite.email_setor,
        // O login vive em profiles.username; aqui fica o espelho para as telas
        // de equipe. Antes este campo recebia o e-mail, que nunca foi login.
        login_individual: loginLimpo,
        nome_individual: nome,
        identificacao_completa: true,
      })

    if (memberError) {
      await adminClient.auth.admin.deleteUser(user_id)
      usuarioCriado = null
      if (memberError.code === '22P02') {
        return json({
          error: `Papel inválido no convite: "${convite.papel}". Valores aceitos: admin, operador, viewer.`,
        }, 422)
      }
      return json({ error: `Erro ao vincular membro: ${memberError.message}` }, 500)
    }

    // ── 6. Registro do aceite e contador ──────────────────────────────────
    // Uma linha por colaborador: accepted_by_email guardava um valor so e era
    // sobrescrito, o que nao serve para link usado por varias pessoas.
    await adminClient.from('empresa_convite_aceites').insert({
      convite_id: convite.id,
      empresa_id: convite.empresa_id,
      user_id,
      username: loginLimpo,
      nome,
    })

    const { error: erroConvite } = await adminClient
      .from('empresa_convites')
      .update({
        usos: (convite.usos ?? 0) + 1,
        accepted_at: new Date().toISOString(),
        accepted_by_email: convite.email_setor,
      })
      .eq('id', convite.id)

    if (erroConvite) {
      // Acesso ja criado com sucesso; falhar aqui so afeta a contagem.
      console.error('[accept-sector-invite] falha ao atualizar o convite:', erroConvite.message)
    }

    return json({
      success: true,
      empresa_id: convite.empresa_id,
      equipe: convite.equipe,
      login: loginLimpo,
      email, // o cliente precisa dele para abrir a sessao
    })
  } catch (err) {
    // Nao deixa conta orfa se algo estourar depois da criacao
    if (usuarioCriado) {
      try { await adminClient.auth.admin.deleteUser(usuarioCriado) } catch { /* ignora */ }
    }
    return json({ error: err?.message ?? 'Erro interno' }, 500)
  }
})
