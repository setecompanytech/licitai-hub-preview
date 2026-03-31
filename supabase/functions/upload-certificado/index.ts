import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const token = formData.get('token') as string
    const senha = formData.get('senha') as string
    const file = formData.get('file') as File

    if (!token || !senha || !file) {
      return new Response(
        JSON.stringify({ error: 'Token, senha e arquivo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validate file type
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      return new Response(
        JSON.stringify({ error: 'Apenas arquivos .pfx ou .p12 são aceitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Arquivo muito grande (máximo 10MB)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Use service_role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Validate token
    const { data: tokenData, error: tokenErr } = await supabaseAdmin
      .from('cert_upload_tokens')
      .select('id, empresa_id, expires_at, used_at, user_id')
      .eq('token', token)
      .single()

    if (tokenErr || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (tokenData.used_at) {
      return new Response(
        JSON.stringify({ error: 'Token já utilizado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token expirado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Upload file to storage using service_role (no anon policy needed)
    const filePath = `${tokenData.empresa_id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('certificados')
      .upload(filePath, file, { upsert: true })

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar arquivo: ' + uploadErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 3. Mark token as used
    const { error: updateErr } = await supabaseAdmin
      .from('cert_upload_tokens')
      .update({
        used_at: new Date().toISOString(),
        cert_file_path: filePath,
      })
      .eq('id', tokenData.id)

    if (updateErr) {
      console.error('Token update error:', updateErr)
    }

    // 4. Log the upload event
    console.log(`[CERT-UPLOAD] Certificado recebido para empresa ${tokenData.empresa_id} | File: ${filePath}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Certificado enviado com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
