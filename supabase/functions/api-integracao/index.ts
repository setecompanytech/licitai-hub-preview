import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Auth via API key header or Bearer token
  const apiKey = req.headers.get('x-api-key')
  const authHeader = req.headers.get('authorization')

  let userId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data, error } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (error || !data?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    userId = data.claims.sub as string
  } else {
    return new Response(JSON.stringify({ error: 'Autenticação necessária. Envie Bearer token ou x-api-key.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const url = new URL(req.url)
  const path = url.pathname.replace('/api-integracao', '').replace(/^\/+/, '')
  const segments = path.split('/').filter(Boolean)
  const resource = segments[0] || ''
  const resourceId = segments[1] || null

  try {
    // GET /api-integracao/licitacoes
    // GET /api-integracao/licitacoes/:id
    if (resource === 'licitacoes') {
      if (req.method === 'GET') {
        if (resourceId) {
          const { data, error } = await supabase
            .from('licitacoes')
            .select('*')
            .eq('id', resourceId)
            .eq('user_id', userId)
            .single()
          if (error) return jsonError(error.message, 404)
          return jsonOk(data)
        }

        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
        const status = url.searchParams.get('status')
        const offset = (page - 1) * limit

        let query = supabase
          .from('licitacoes')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (status) query = query.eq('status', status)

        const { data, error, count } = await query
        if (error) return jsonError(error.message)
        return jsonOk({ data, total: count, page, limit })
      }

      if (req.method === 'POST') {
        const body = await req.json()
        const { data, error } = await supabase
          .from('licitacoes')
          .insert({ ...body, user_id: userId })
          .select()
          .single()
        if (error) return jsonError(error.message, 400)
        return jsonOk(data, 201)
      }

      if (req.method === 'PUT' && resourceId) {
        const body = await req.json()
        delete body.user_id
        delete body.id
        const { data, error } = await supabase
          .from('licitacoes')
          .update(body)
          .eq('id', resourceId)
          .eq('user_id', userId)
          .select()
          .single()
        if (error) return jsonError(error.message, 400)
        return jsonOk(data)
      }

      if (req.method === 'DELETE' && resourceId) {
        const { error } = await supabase
          .from('licitacoes')
          .delete()
          .eq('id', resourceId)
          .eq('user_id', userId)
        if (error) return jsonError(error.message, 400)
        return jsonOk({ deleted: true })
      }
    }

    // GET /api-integracao/empresas
    if (resource === 'empresas') {
      if (req.method === 'GET') {
        if (resourceId) {
          const { data, error } = await supabase
            .from('empresas')
            .select('*')
            .eq('id', resourceId)
            .eq('created_by', userId)
            .single()
          if (error) return jsonError(error.message, 404)
          return jsonOk(data)
        }
        const { data, error } = await supabase
          .from('empresas')
          .select('*')
          .eq('created_by', userId)
          .order('razao_social')
        if (error) return jsonError(error.message)
        return jsonOk(data)
      }
    }

    // GET /api-integracao/documentos
    if (resource === 'documentos') {
      if (req.method === 'GET') {
        const licitacao_id = url.searchParams.get('licitacao_id')
        let query = supabase
          .from('documentos')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        if (licitacao_id) query = query.eq('licitacao_id', licitacao_id)
        const { data, error } = await query
        if (error) return jsonError(error.message)
        return jsonOk(data)
      }
    }

    // GET /api-integracao/kanban
    if (resource === 'kanban') {
      if (req.method === 'GET') {
        const { data, error } = await supabase
          .from('kanban_tasks')
          .select('*')
          .eq('user_id', userId)
          .order('ordem')
        if (error) return jsonError(error.message)
        return jsonOk(data)
      }

      if (req.method === 'PUT' && resourceId) {
        const body = await req.json()
        delete body.user_id
        const { data, error } = await supabase
          .from('kanban_tasks')
          .update(body)
          .eq('id', resourceId)
          .eq('user_id', userId)
          .select()
          .single()
        if (error) return jsonError(error.message, 400)
        return jsonOk(data)
      }
    }

    // GET /api-integracao/catalogo
    if (resource === 'catalogo') {
      if (req.method === 'GET') {
        const { data, error } = await supabase
          .from('catalogo_itens_precificados')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        if (error) return jsonError(error.message)
        return jsonOk(data)
      }
    }

    // GET /api-integracao/health
    if (resource === 'health') {
      return jsonOk({
        status: 'ok',
        version: '1.0.0',
        endpoints: [
          'GET /licitacoes',
          'GET /licitacoes/:id',
          'POST /licitacoes',
          'PUT /licitacoes/:id',
          'DELETE /licitacoes/:id',
          'GET /empresas',
          'GET /empresas/:id',
          'GET /documentos',
          'GET /kanban',
          'PUT /kanban/:id',
          'GET /catalogo',
        ],
      })
    }

    return jsonError(`Recurso não encontrado: ${resource || '/'}`, 404)
  } catch (err) {
    console.error('API Error:', err)
    return jsonError(err instanceof Error ? err.message : 'Erro interno', 500)
  }

  function jsonOk(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  function jsonError(message: string, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
