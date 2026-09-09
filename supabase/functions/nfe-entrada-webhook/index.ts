// Recepção de NF-e emitidas CONTRA os CNPJs das empresas (Fase 1, 08/09).
//
// O provedor de DFe (FocusNFe e afins) entrega cada nota por POST aqui; a
// função resolve a EMPRESA pelo CNPJ do destinatário e guarda em
// nfe_recebidas — reentrega não duplica (chave única por empresa). Aceita
// dois formatos: campos estruturados do provedor OU só o XML cru (os campos
// são extraídos dele). Auth por token compartilhado no header, porque
// provedor de webhook não fala JWT.
//
// Fase 3 (motor DistribuicaoDFe próprio) trocará o remetente sem tocar
// nesta porta: o contrato é o payload, não o provedor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-webhook-token, content-type',
};

const so = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim() : null);
const digitos = (s: unknown) => (typeof s === 'string' ? s.replace(/\D/g, '') : '');

/** Extrai o essencial do XML da NF-e sem parser pesado: as tags são estáveis
 *  no schema 4.00 e regex sobre elas é suficiente para o resumo. O XML
 *  INTEIRO fica guardado — o resumo é índice, não substituto. */
function lerXml(xml: string) {
  const tag = (nome: string, escopo = xml) =>
    escopo.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1] ?? null;
  const bloco = (nome: string) =>
    xml.match(new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`))?.[1] ?? '';
  const emit = bloco('emit');
  const dest = bloco('dest');
  const chave = xml.match(/Id="NFe(\d{44})"/)?.[1] ?? null;
  const dhEmi = tag('dhEmi') ?? tag('dEmi');
  return {
    chave,
    emitente_cnpj: digitos(tag('CNPJ', emit)) || null,
    emitente_nome: so(tag('xNome', emit)),
    destinatario_cnpj: digitos(tag('CNPJ', dest)) || null,
    numero: so(tag('nNF')),
    serie: so(tag('serie')),
    valor_total: Number(tag('vNF')) || null,
    data_emissao: dhEmi ? dhEmi.slice(0, 10) : null,
    natureza_operacao: so(tag('natOp')),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const TOKEN = Deno.env.get('NFE_WEBHOOK_TOKEN');
    if (!TOKEN || req.headers.get('x-webhook-token') !== TOKEN) {
      return new Response(JSON.stringify({ error: 'não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    // XML pode vir cru ou em base64 (provedores variam).
    let xml = so(body.xml) ?? '';
    if (xml && !xml.includes('<')) {
      try { xml = new TextDecoder().decode(Uint8Array.from(atob(xml), (c) => c.charCodeAt(0))); }
      catch { /* não era base64 — segue como veio */ }
    }
    const doXml = xml ? lerXml(xml) : null;

    const chave = digitos(body.chave ?? body.chave_nfe) || doXml?.chave || '';
    if (chave.length !== 44) {
      return new Response(JSON.stringify({ error: 'chave de acesso ausente ou inválida (44 dígitos)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const destCnpj = digitos(body.cnpj_destinatario ?? body.cnpj) || doXml?.destinatario_cnpj || '';
    if (destCnpj.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ do destinatário ausente — sem ele não há como saber de qual empresa a nota é' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: empresa } = await db.from('empresas')
      .select('id, razao_social').eq('cnpj', destCnpj).maybeSingle();
    if (!empresa) {
      // 200 de propósito: destinatário que não é cliente não é erro do
      // provedor — reentregar para sempre só encheria a fila dele.
      return new Response(JSON.stringify({ ok: true, ignorada: `CNPJ ${destCnpj} não é empresa do sistema` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const situacao = ['autorizada', 'cancelada', 'resumo'].includes(String(body.situacao))
      ? String(body.situacao) : (xml ? 'autorizada' : 'resumo');

    const linha = {
      empresa_id: empresa.id,
      chave,
      emitente_cnpj: digitos(body.emitente_cnpj) || doXml?.emitente_cnpj || null,
      emitente_nome: so(body.emitente_nome) ?? doXml?.emitente_nome ?? null,
      destinatario_cnpj: destCnpj,
      numero: so(body.numero) ?? doXml?.numero ?? chave.slice(25, 34).replace(/^0+/, ''),
      serie: so(body.serie) ?? doXml?.serie ?? null,
      valor_total: Number(body.valor_total) || doXml?.valor_total || null,
      data_emissao: so(body.data_emissao)?.slice(0, 10) ?? doXml?.data_emissao ?? null,
      natureza_operacao: so(body.natureza_operacao) ?? doXml?.natureza_operacao ?? null,
      situacao,
      origem: 'webhook',
      xml: xml || null,
      payload: body,
    };

    // Upsert pela chave: reentrega atualiza (o resumo de ontem vira o XML
    // completo de hoje; a autorizada de ontem vira cancelada, se for o caso).
    const { error } = await db.from('nfe_entradas')
      .upsert(linha, { onConflict: 'empresa_id,chave' });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, empresa: empresa.razao_social, chave, situacao }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'falha' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
