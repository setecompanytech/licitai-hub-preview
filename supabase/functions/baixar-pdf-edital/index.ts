// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { edital_id, url_pdf } = await req.json();

    if (!url_pdf) {
      return new Response(
        JSON.stringify({ path: null, message: "url_pdf não fornecida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfResp = await fetch(url_pdf, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PraefectusBot/1.0)",
      },
    });

    if (!pdfResp.ok) throw new Error("HTTP " + pdfResp.status);

    const pdfBuffer = await pdfResp.arrayBuffer();
    const fileName = `editais/${edital_id}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("documentos-publicos")
      .upload(fileName, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Generate signed URL (7 days)
    const { data: signed } = await supabase.storage
      .from("documentos-publicos")
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);

    // Update edital with PDF path
    if (edital_id) {
      await supabase
        .from("editais_coletados")
        .update({ pdf_storage_path: fileName })
        .eq("id", edital_id);
    }

    console.log(`[PDF] Baixado e armazenado: ${fileName}`);

    return new Response(
      JSON.stringify({ path: fileName, signed_url: signed?.signedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[PDF] Erro ao baixar:", error);
    return new Response(
      JSON.stringify({ path: null, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
