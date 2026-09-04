// ═══════════════════════════════════════════════════════════════════════════
// Normaliza os arquivos do Controle de Documentos (03/09/2026)
//
// A migration de 18/08 compartilhou LINHAS (empresa_id) sem mover ARQUIVOS:
// o registro aparecia para todos, mas o PDF continuava na pasta pessoal de
// quem anexou — e o storage nega o download ao colega. Sintoma: kit de
// faturamento listando 5 certidões e baixando 1.
//
// Aqui, com service role, todo documento com empresa_id cujo arquivo ainda
// mora em pasta pessoal é MOVIDO para empresa/<empresa_id>/… e a linha passa
// a apontar o caminho novo. Idempotente: rodar de novo não encontra nada.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pendentes, error } = await db
      .from("documentos")
      .select("id, nome, empresa_id, arquivo_path")
      .not("empresa_id", "is", null)
      .not("arquivo_path", "is", null)
      .not("arquivo_path", "like", "empresa/%");
    if (error) return json({ ok: false, erro: error.message }, 500);

    const movidos: string[] = [];
    const falhas: Array<{ nome: string; erro: string }> = [];

    for (const d of pendentes ?? []) {
      const base = String(d.arquivo_path).split("/").pop() || "documento.pdf";
      let destino = `empresa/${d.empresa_id}/${base}`;
      let { error: mvErr } = await db.storage
        .from("documentos-habilitacao")
        .move(String(d.arquivo_path), destino);
      if (mvErr && /exists/i.test(mvErr.message)) {
        destino = `empresa/${d.empresa_id}/${Date.now()}-${base}`;
        ({ error: mvErr } = await db.storage
          .from("documentos-habilitacao")
          .move(String(d.arquivo_path), destino));
      }
      if (mvErr) { falhas.push({ nome: d.nome, erro: mvErr.message }); continue; }
      const { error: upErr } = await db
        .from("documentos")
        .update({ arquivo_path: destino })
        .eq("id", d.id);
      if (upErr) { falhas.push({ nome: d.nome, erro: `linha: ${upErr.message}` }); continue; }
      movidos.push(d.nome);
    }

    return json({ ok: true, pendentes: (pendentes ?? []).length, movidos, falhas });
  } catch (e) {
    return json({ ok: false, erro: (e as Error)?.message || "erro interno" }, 500);
  }
});
