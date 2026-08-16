import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /robo-lances-webhook/{action}
    const action = pathParts[pathParts.length - 1] || "";

    const body = req.method !== "GET" ? await req.json() : {};

    // ─── ACTIONS FROM THE FRONTEND (authenticated user) ───

    if (action === "configurar-agente") {
      // Save/update external agent config
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user }, error: authErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) {
        return jsonResponse({ error: "Token inválido" }, 401);
      }

      const { url_base, nome, api_key, max_sessoes_paralelas } = body;
      if (!url_base) {
        return jsonResponse({ error: "url_base é obrigatório" }, 400);
      }

      const { data, error } = await supabase
        .from("agente_externo_config")
        .upsert(
          {
            user_id: user.id,
            nome: nome || "Agente Principal",
            url_base,
            api_key_hash: api_key || null,
            status: "verificando",
            max_sessoes_paralelas: max_sessoes_paralelas || 3,
          },
          { onConflict: "user_id,nome" }
        )
        .select()
        .single();

      if (error) throw error;

      // Try to ping the agent
      try {
        const pingResp = await fetch(`${url_base}/health`, {
          method: "GET",
          headers: { "X-Agent-Key": api_key || "" },
          signal: AbortSignal.timeout(5000),
        });
        const agentStatus = pingResp.ok ? "ativo" : "erro";
        const pingData = pingResp.ok ? await pingResp.json().catch(() => ({})) : {};

        await supabase
          .from("agente_externo_config")
          .update({
            status: agentStatus,
            ultimo_heartbeat: new Date().toISOString(),
            versao_agente: pingData.version || null,
            capacidades: pingData.capabilities || [],
            sessoes_ativas: pingData.capacidade?.sessoes_ativas || pingData.sessoes_ativas || 0,
            ram_mb: pingData.capacidade?.ram_total_mb || null,
          })
          .eq("id", data.id);

        data.status = agentStatus;
      } catch {
        await supabase
          .from("agente_externo_config")
          .update({ status: "offline" })
          .eq("id", data.id);
        data.status = "offline";
      }

      return jsonResponse({ success: true, agente: data });
    }

    if (action === "enviar-sessao") {
      // Send a bid session to the external agent
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user }, error: authErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) {
        return jsonResponse({ error: "Token inválido" }, 401);
      }

      // Get agent config
      const { data: agente } = await supabase
        .from("agente_externo_config")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .single();

      if (!agente) {
        return jsonResponse(
          { error: "Nenhum agente ativo configurado. Configure um agente externo primeiro." },
          400
        );
      }

      // Create session record
      const sessaoData = {
        user_id: user.id,
        lance_config_id: body.lance_config_id,
        portal_id: body.portal_id,
        portal_nome: body.portal_nome,
        edital: body.edital,
        valor_referencia: body.valor_referencia,
        valor_inicial: body.valor_inicial,
        valor_minimo: body.valor_minimo,
        decremento_min: body.decremento_min,
        decremento_percentual: body.decremento_percentual,
        intervalo_segundos: body.intervalo_segundos || 30,
        max_lances: body.max_lances || 20,
        modo: "real",
        status: "enviando",
        agente_id: agente.id,
      };

      const { data: sessao, error: sessErr } = await supabase
        .from("sessoes_lance_real")
        .insert(sessaoData)
        .select()
        .single();

      if (sessErr) throw sessErr;

      // Log the outgoing webhook
      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "enviar-sessao",
        payload: { sessao_id: sessao.id, ...sessaoData },
      });

      // Forward to external agent
      try {
        const agentResp = await fetch(`${agente.url_base}/sessao/iniciar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Agent-Key": agente.api_key_hash || "",
            "X-Callback-URL": `${supabaseUrl}/functions/v1/robo-lances-webhook/callback`,
          },
          body: JSON.stringify({
            sessao_id: sessao.id,
            ...sessaoData,
            credenciais_portal: body.credenciais_portal_id,
          }),
          signal: AbortSignal.timeout(10000),
        });

        const agentData = await agentResp.json().catch(() => ({}));

        if (agentResp.ok) {
          await supabase
            .from("sessoes_lance_real")
            .update({ status: "ativo" })
            .eq("id", sessao.id);
          sessao.status = "ativo";
        } else {
          await supabase
            .from("sessoes_lance_real")
            .update({ status: "erro", erro: agentData.error || "Erro no agente" })
            .eq("id", sessao.id);
          sessao.status = "erro";
          sessao.erro = agentData.error;
        }

        return jsonResponse({ success: true, sessao });
      } catch (e: any) {
        await supabase
          .from("sessoes_lance_real")
          .update({ status: "erro", erro: e.message })
          .eq("id", sessao.id);

        return jsonResponse({ success: false, error: `Agente inacessível: ${e.message}` }, 502);
      }
    }

    // ─── CALLBACKS FROM THE EXTERNAL AGENT ───

    if (action === "callback") {
      // The agent sends updates here
      const agentKey = req.headers.get("x-agent-key");
      const { sessao_id, tipo, payload } = body;

      if (!sessao_id || !tipo) {
        return jsonResponse({ error: "sessao_id e tipo são obrigatórios" }, 400);
      }

      // Verify session exists
      const { data: sessao } = await supabase
        .from("sessoes_lance_real")
        .select("*, agente_externo_config!inner(api_key_hash, user_id)")
        .eq("id", sessao_id)
        .single();

      if (!sessao) {
        return jsonResponse({ error: "Sessão não encontrada" }, 404);
      }

      // Validate agent key
      const expectedKey = (sessao as any).agente_externo_config?.api_key_hash;
      if (!expectedKey || agentKey !== expectedKey) {
        return jsonResponse({ error: "Chave do agente inválida" }, 403);
      }

      const userId = (sessao as any).agente_externo_config?.user_id || sessao.user_id;

      // Log incoming webhook
      await supabase.from("webhook_log").insert({
        user_id: userId,
        direcao: "entrada",
        tipo,
        payload: body,
      });

      // Process callback types
      switch (tipo) {
        case "lance-enviado": {
          // Agent successfully sent a bid
          const { rodada, valor, tipo_lance } = payload;
          await supabase.from("lances_historico").insert({
            user_id: userId,
            sessao_id,
            rodada,
            valor,
            tipo: tipo_lance || "meu",
            origem: "real",
            metadata: payload.metadata || {},
          });
          await supabase
            .from("sessoes_lance_real")
            .update({
              valor_atual: valor,
              rodada_atual: rodada,
              status: "ativo",
            })
            .eq("id", sessao_id);
          break;
        }

        case "lance-concorrente": {
          // Competitor bid detected
          const { rodada, valor } = payload;
          await supabase.from("lances_historico").insert({
            user_id: userId,
            sessao_id,
            rodada,
            valor,
            tipo: "concorrente",
            origem: "real",
            metadata: payload.metadata || {},
          });
          await supabase
            .from("sessoes_lance_real")
            .update({ valor_atual: valor, rodada_atual: rodada })
            .eq("id", sessao_id);
          break;
        }

        case "sessao-encerrada": {
          await supabase
            .from("sessoes_lance_real")
            .update({
              status: "encerrado",
              resultado: payload.resultado || "finalizado",
              valor_atual: payload.valor_final,
            })
            .eq("id", sessao_id);
          break;
        }

        case "erro": {
          await supabase
            .from("sessoes_lance_real")
            .update({
              status: "erro",
              erro: payload.mensagem || "Erro desconhecido",
            })
            .eq("id", sessao_id);
          break;
        }

        case "heartbeat": {
          if (sessao.agente_id) {
            await supabase
              .from("agente_externo_config")
              .update({ ultimo_heartbeat: new Date().toISOString() })
              .eq("id", sessao.agente_id);
          }
          break;
        }

        default:
          return jsonResponse({ error: `Tipo de callback desconhecido: ${tipo}` }, 400);
      }

      return jsonResponse({ success: true, received: tipo });
    }

    // ─── KILL SWITCH ───

    if (action === "kill-switch") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { motivo } = body;

      // 1. Encerrar todas as sessões ativas do usuário no DB
      const { data: sessoesAtivas } = await supabase
        .from("sessoes_lance_real")
        .select("id, agente_id")
        .eq("user_id", user.id)
        .in("status", ["ativo", "enviando"]);

      if (sessoesAtivas && sessoesAtivas.length > 0) {
        await supabase
          .from("sessoes_lance_real")
          .update({
            status: "encerrado",
            erro: `Parada emergencial: ${motivo || "Acionada pelo operador"}`,
          })
          .eq("user_id", user.id)
          .in("status", ["ativo", "enviando"]);
      }

      // 2. Notify all active agents
      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ativo");

      const agentResults: { agente: string; ok: boolean }[] = [];
      for (const agente of agentes || []) {
        try {
          const resp = await fetch(`${agente.url_base}/kill-switch`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": agente.api_key_hash || "",
            },
            body: JSON.stringify({ motivo }),
            signal: AbortSignal.timeout(5000),
          });
          agentResults.push({
            agente: agente.nome,
            ok: resp.ok,
            http: resp.status,
            detalhe: resp.ok ? null : (resp.status === 404
              ? "o agente não implementa a rota /kill-switch"
              : `HTTP ${resp.status}`),
          });
        } catch (e) {
          agentResults.push({
            agente: agente.nome,
            ok: false,
            http: 0,
            detalhe: e instanceof Error ? e.message : "sem resposta do agente",
          });
        }
      }

      // 3. Audit log
      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "kill-switch",
        payload: { motivo, sessoes_encerradas: sessoesAtivas?.length || 0, agentResults },
      });

      // Falha silenciosa é proibida — ainda mais num freio de emergência. As
      // sessões SEMPRE são encerradas no sistema (paramos de mandar comandos),
      // mas se nenhum agente confirmou, quem está no portal precisa saber.
      const confirmaram = agentResults.filter((r) => r.ok).length;
      return jsonResponse({
        success: true,
        sessoes_encerradas: sessoesAtivas?.length || 0,
        agentes_total: agentResults.length,
        agentes_confirmaram: confirmaram,
        agente_parou: agentResults.length > 0 && confirmaram === agentResults.length,
        agentes_notificados: agentResults,
      });
    }

    // ─── STATUS ───

    // Healthcheck AO VIVO. Antes, o único ping acontecia ao configurar o
    // agente: versão, RAM e "ativo" ficavam congelados no banco desde então —
    // a tela dizia "Agente Online" lendo uma linha de meses atrás. Aqui
    // perguntamos ao agente e atualizamos o registro. Também substitui o
    // heartbeat que o agente nunca empurrou: puxamos o sinal de vida.
    if (action === "healthcheck") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, capacidades")
        .eq("user_id", user.id);

      if (!agentes?.length) {
        return jsonResponse({ configurado: false, online: false, agentes: [] });
      }

      const resultados = [];
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        let online = false;
        let saude: Record<string, unknown> | null = null;
        let erro: string | null = null;
        const capacidadesAtuais = (agente as { capacidades?: Record<string, unknown> }).capacidades;
        const t0 = Date.now();
        try {
          const resp = await fetch(`${base}/health`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            saude = await resp.json().catch(() => ({}));
            online = true;
          } else {
            erro = `HTTP ${resp.status}`;
          }
        } catch (e) {
          erro = e instanceof Error ? e.message : "sem resposta";
        }

        // O registro passa a refletir a realidade — inclusive quando é ruim.
        await supabase
          .from("agente_externo_config")
          .update({
            status: online ? "ativo" : "erro",
            ultimo_heartbeat: online ? new Date().toISOString() : undefined,
            versao_agente: (saude?.version as string) ?? undefined,
            ram_mb: ((saude?.capacidade as Record<string, number>)?.ram_total_mb) ?? undefined,
            sessoes_ativas: (saude?.sessoes_ativas as number) ?? undefined,
            // Mescla: o snapshot de saúde não pode apagar o resultado do
            // teste do freio de emergência guardado no mesmo campo.
            capacidades: saude
              ? ({ ...(capacidadesAtuais || {}), saude } as never)
              : undefined,
          })
          .eq("id", agente.id);

        resultados.push({
          id: agente.id,
          nome: agente.nome,
          url_base: agente.url_base,
          online,
          erro,
          latencia_ms: Date.now() - t0,
          versao: saude?.version ?? null,
          capacidade: saude?.capacidade ?? null,
          sessoes_ativas: saude?.sessoes_ativas ?? null,
          certificado: saude?.certificado ?? null,
          portais_suportados: saude?.portais_suportados ?? null,
          // Freio de emergência: só o teste explícito prova que existe
          kill_switch: (capacidadesAtuais as { kill_switch?: unknown })?.kill_switch ?? null,
        });
      }

      return jsonResponse({
        configurado: true,
        online: resultados.some((r) => r.online),
        agentes: resultados,
      });
    }

    // Teste do freio de emergência. Sondar a rota por HEAD/OPTIONS não
    // distingue "ausente" de "protegida" neste agente, e um POST às cegas
    // durante uma disputa abortaria lances reais. Então o teste é DELIBERADO
    // e só roda sem sessões ativas — como se testa um alarme de incêndio.
    if (action === "testar-kill-switch") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { data: ativas } = await supabase
        .from("sessoes_lance_real")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["ativo", "enviando"]);
      if (ativas?.length) {
        return jsonResponse({
          error: `Há ${ativas.length} sessão(ões) de lance em andamento. O teste do freio abortaria disputas reais — execute com o robô parado.`,
        }, 409);
      }

      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash, capacidades")
        .eq("user_id", user.id);
      if (!agentes?.length) return jsonResponse({ error: "Nenhum agente configurado." }, 400);

      const resultados = [];
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        let ok = false, http = 0, detalhe: string | null = null;
        try {
          const resp = await fetch(`${base}/kill-switch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Agent-Key": agente.api_key_hash || "" },
            body: JSON.stringify({ motivo: "Teste de verificação do freio de emergência (sem sessões ativas)", teste: true }),
            signal: AbortSignal.timeout(8000),
          });
          ok = resp.ok;
          http = resp.status;
          if (!ok) {
            detalhe = resp.status === 404
              ? "o agente não implementa a rota POST /kill-switch"
              : `HTTP ${resp.status}`;
          }
        } catch (e) {
          detalhe = e instanceof Error ? e.message : "sem resposta do agente";
        }

        const registro = { ok, http, detalhe, testado_em: new Date().toISOString() };
        const capacidades = (agente as { capacidades?: Record<string, unknown> }).capacidades || {};
        await supabase
          .from("agente_externo_config")
          .update({ capacidades: { ...capacidades, kill_switch: registro } as never })
          .eq("id", agente.id);

        resultados.push({ agente: agente.nome, ...registro });
      }

      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "teste-kill-switch",
        payload: { resultados },
      });

      return jsonResponse({
        verificado: resultados.every((r) => r.ok),
        resultados,
      });
    }

    if (action === "status") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const [agenteResp, sessoesResp] = await Promise.all([
        supabase
          .from("agente_externo_config")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("sessoes_lance_real")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      return jsonResponse({
        agentes: agenteResp.data || [],
        sessoes: sessoesResp.data || [],
      });
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 404);
  } catch (e: any) {
    console.error("robo-lances-webhook error:", e);
    return jsonResponse({ error: e.message || "Erro interno" }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
