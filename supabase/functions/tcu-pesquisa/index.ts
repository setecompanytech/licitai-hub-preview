// Pesquisa ao vivo na Pesquisa Integrada do TCU (27/09/2026).
//
// A tela "Base jurídica → Fontes oficiais → TCU" pesquisa os acórdãos como o
// portal do TCU pesquisa: termo com operadores, número, ano, colegiado,
// relator, processo, órgão, data da sessão, facetas, ordem e páginas. O
// navegador não pode chamar o portal direto (CORS e firewall), então esta
// edge é a ponte — e a única que grava: "guardar" traz o acórdão inteiro e o
// põe na base normativa para a redação citar.
//
// Ações (POST JSON):
//   { acao: 'pesquisar', termo, filtros: {numero, ano, colegiado[], relator,
//     processo, anoProcesso, entidade, tipo[], dataDe, dataAte}, ordem,
//     pagina, porPagina }  → { total, inicio, documentos, facetas, na_base }
//   { acao: 'ler', key }      → { titulo, sumario, acordao, voto… } (só leitura, nada gravado)
//   { acao: 'guardar', key }  → { id, identificador, situacao }
// Qualquer usuário logado. Sem IA, sem crédito pago: só a porta pública do TCU.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { documentoTcu, filtroDoTcu, guardarAcordao, pesquisarTcu, type EscritorDaBase, type FiltrosTcu, type OrdemTcu } from '../_shared/tcu-pesquisa.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const auth = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return json({ error: 'Sessão inválida ou expirada. Por favor, faça login novamente.' }, 401);

    const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
    const acao = String(corpo.acao ?? 'pesquisar');

    if (acao === 'pesquisar') {
      const filtros = (corpo.filtros ?? {}) as FiltrosTcu;
      const filtro = filtroDoTcu(filtros);
      const termo = String(corpo.termo ?? '').slice(0, 500);
      if (!termo.trim() && !filtro) return json({ error: 'Informe um termo ou ao menos um filtro.' }, 400);
      const ordem = (['relevancia', 'recentes', 'antigos'].includes(String(corpo.ordem)) ? String(corpo.ordem) : 'relevancia') as OrdemTcu;
      const porPagina = Math.min(Math.max(Number(corpo.porPagina ?? 20) || 20, 5), 50);
      const pagina = Math.max(Number(corpo.pagina ?? 1) || 1, 1);
      const r = await pesquisarTcu({ termo, filtro, ordem, quantidade: porPagina, inicio: (pagina - 1) * porPagina });

      // Quais destes já estão na base (o RLS deixa quem está logado ler).
      const leitor = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const identificadores = r.documentos.map((d) => `${/decis/i.test(d.tipo) ? 'Decisão' : 'Acórdão'} ${d.numero}/${d.ano}-${d.colegiado}`);
      const naBase = identificadores.length
        ? await leitor.from('base_normativa').select('identificador, detalhe').eq('fonte', 'tcu').in('identificador', identificadores)
        : { data: [] as Array<{ identificador: string; detalhe: Record<string, unknown> | null }>, error: null };
      const completos = new Set<string>(); const soSumario = new Set<string>();
      for (const l of (naBase.data ?? []) as Array<{ identificador: string; detalhe: Record<string, unknown> | null }>) {
        (l.detalhe?.texto_completo ? completos : soSumario).add(l.identificador);
      }
      return json({ ...r, filtro, na_base: [...completos], so_sumario: [...soSumario] });
    }

    if (acao === 'ler') {
      const doc = await documentoTcu(String(corpo.key ?? '').trim());
      if (!doc) return json({ error: 'O portal não devolveu este acórdão.' }, 404);
      return json({ ok: true, titulo: doc.titulo, assunto: doc.assunto, entidade: doc.entidade, tipo_processo: doc.tipo_processo, sumario: doc.sumario, acordao: doc.acordao, voto: doc.voto.slice(0, 12000), voto_cortado: doc.voto.length > 12000, relatorio_chars: doc.relatorio.length });
    }

    if (acao === 'guardar') {
      const key = String(corpo.key ?? '').trim();
      const doc = await documentoTcu(key);
      if (!doc) return json({ error: 'O portal não devolveu este acórdão.' }, 404);
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, 500);
      const escritor = createClient(supabaseUrl, serviceKey) as unknown as EscritorDaBase;
      const r = await guardarAcordao(escritor, doc, { guardado_por: user.id, origem: 'pesquisa-integrada' });
      return json({ ok: true, ...r, titulo: doc.titulo, sumario: doc.sumario.slice(0, 600) });
    }

    return json({ error: `ação desconhecida: ${acao}` }, 400);
  } catch (e) {
    console.error('tcu-pesquisa:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
