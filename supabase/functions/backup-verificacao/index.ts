import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables to verify (core business tables)
const TABELAS_VERIFICACAO = [
  "empresas",
  "licitacoes",
  "contratos",
  "documentos",
  "propostas",
  "profiles",
  "configuracoes",
  "catalogo_itens_precificados",
  "apoio_juridico",
  "apoio_contabil",
  "backup_config",
  "backup_historico",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate CRON_SECRET for scheduled execution
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: "CRON_SECRET não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader?.replace("Bearer ", "");
    if (token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[BACKUP-VERIFY] Iniciando verificação periódica...");

    const tabelasVerificadas: string[] = [];
    let registrosTotal = 0;
    const erros: string[] = [];
    const detalhes: Record<string, any> = {};

    // 1. Verify each core table is accessible and has data
    for (const tabela of TABELAS_VERIFICACAO) {
      try {
        const { count, error } = await supabase
          .from(tabela)
          .select("*", { count: "exact", head: true });

        if (error) {
          erros.push(`Tabela ${tabela}: ${error.message}`);
          detalhes[tabela] = { status: "erro", error: error.message };
        } else {
          const rowCount = count || 0;
          registrosTotal += rowCount;
          tabelasVerificadas.push(tabela);
          detalhes[tabela] = { status: "ok", registros: rowCount };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        erros.push(`Tabela ${tabela}: ${msg}`);
        detalhes[tabela] = { status: "erro", error: msg };
      }
    }

    // 2. Verify storage buckets
    const buckets = ["documentos", "certificados", "timbrados", "juridico", "documentos-habilitacao"];
    for (const bucket of buckets) {
      try {
        const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1 });
        if (error) {
          erros.push(`Bucket ${bucket}: ${error.message}`);
          detalhes[`bucket_${bucket}`] = { status: "erro", error: error.message };
        } else {
          detalhes[`bucket_${bucket}`] = { status: "ok", acessivel: true };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        erros.push(`Bucket ${bucket}: ${msg}`);
        detalhes[`bucket_${bucket}`] = { status: "erro", error: msg };
      }
    }

    // 3. Check last backup execution
    const { data: ultimoBackup } = await supabase
      .from("backup_historico")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimoBackup) {
      const diffHours = (Date.now() - new Date(ultimoBackup.created_at).getTime()) / 3600000;
      detalhes.ultimo_backup = {
        id: ultimoBackup.id,
        status: ultimoBackup.status,
        created_at: ultimoBackup.created_at,
        horas_atras: Math.round(diffHours),
        alerta: diffHours > 48 ? "Último backup há mais de 48h" : null,
      };
      if (diffHours > 48) {
        erros.push("Último backup executado há mais de 48 horas");
      }
    } else {
      detalhes.ultimo_backup = { status: "nenhum", alerta: "Nenhum backup encontrado no histórico" };
      erros.push("Nenhum backup encontrado no histórico");
    }

    // 4. Log verification result
    const status = erros.length === 0 ? "sucesso" : "com_alertas";
    
    const { error: insertError } = await supabase.from("backup_verificacao").insert({
      status,
      tabelas_verificadas: tabelasVerificadas,
      registros_verificados: registrosTotal,
      erros,
      detalhes,
    });

    if (insertError) {
      console.error("[BACKUP-VERIFY] Erro ao salvar resultado:", insertError);
    }

    console.log(`[BACKUP-VERIFY] Concluído: ${tabelasVerificadas.length}/${TABELAS_VERIFICACAO.length} tabelas OK, ${registrosTotal} registros, ${erros.length} erros`);

    return new Response(JSON.stringify({
      status,
      tabelas_verificadas: tabelasVerificadas.length,
      tabelas_total: TABELAS_VERIFICACAO.length,
      registros_verificados: registrosTotal,
      erros,
      detalhes,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[BACKUP-VERIFY] Erro fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
