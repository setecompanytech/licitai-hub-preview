// ═══════════════════════════════════════════════════════════════════════════
// enviar-proposta-portal — agora só ENCAMINHA para `robo-lances-webhook/enviar-proposta`
// (16/09/2026).
//
// A versão anterior lia colunas que não existem em `credenciais_portais`
// (`usuario_cifrado`, `senha_cifrada`, `portal`, `empresa_id` — a tabela é por
// `user_id` + `portal_id`, com `login` e `senha_hash`), então respondia
// "credenciais não cadastradas" para todo mundo; não mandava login, senha nem
// UASG ao robô; e pegava o agente com `.single()`, que falha quando a conta tem
// duas configurações. O envio passou para o webhook do robô, que já tem as
// peças certas (membro da empresa, robô ligado, agente, credencial, chave). A
// tela de Proposta chama o webhook direto; esta função fica para quem ainda
// chamar o endereço antigo, sem uma segunda implementação para divergir.
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const destino = `${Deno.env.get('SUPABASE_URL')}/functions/v1/robo-lances-webhook/enviar-proposta`;
    const resp = await fetch(destino, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') ?? '',
        apikey: req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
      body: await req.text(),
      signal: AbortSignal.timeout(90000),
    });
    return new Response(await resp.text(), {
      status: resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Não foi possível encaminhar a proposta ao robô: ${error instanceof Error ? error.message : String(error)}`,
    }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
