import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NUVEM_FISCAL_BASE = 'https://api.nuvemfiscal.com.br';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('Não autorizado');

    const body = await req.json();
    const { action } = body;

    // Get user's Nuvem Fiscal API key from config
    const getApiKey = async (empresaId?: string) => {
      if (!empresaId) return null;
      const { data } = await supabase
        .from('nuvem_fiscal_config')
        .select('api_key_encrypted, ambiente, ativo')
        .eq('user_id', user.id)
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .maybeSingle();
      return data;
    };

    if (action === 'emitir') {
      const { nota_fiscal_id } = body;
      
      // Get NF data
      const { data: nf, error: nfErr } = await supabase
        .from('notas_fiscais')
        .select('*')
        .eq('id', nota_fiscal_id)
        .eq('user_id', user.id)
        .single();
      
      if (nfErr || !nf) throw new Error('Nota fiscal não encontrada');

      const config = await getApiKey(nf.empresa_id);
      if (!config?.api_key_encrypted) {
        throw new Error('API Nuvem Fiscal não configurada. Acesse Configurações > Fiscal para configurar.');
      }

      // Get NF items
      const { data: itens } = await supabase
        .from('nota_fiscal_itens')
        .select('*')
        .eq('nota_fiscal_id', nota_fiscal_id)
        .order('numero_item');

      // Build Nuvem Fiscal payload
      const apiKey = config.api_key_encrypted;
      const ambiente = config.ambiente === 'producao' ? 1 : 2; // 1=prod, 2=homolog

      const nfePayload = {
        ambiente,
        infNFe: {
          versao: '4.00',
          ide: {
            natOp: nf.natureza_operacao || 'Venda de mercadoria',
            mod: parseInt(nf.modelo || '55'),
            serie: parseInt(nf.serie || '1'),
            tpNF: 1, // Saída
            tpEmis: 1, // Normal
          },
          dest: {
            CNPJ: nf.destinatario_cnpj?.replace(/\D/g, ''),
            xNome: nf.destinatario_razao_social,
            enderDest: {
              UF: nf.destinatario_uf,
              xMun: nf.destinatario_municipio,
            },
            IE: nf.destinatario_ie,
          },
          det: (itens || []).map((item: any, idx: number) => ({
            nItem: idx + 1,
            prod: {
              cProd: item.codigo_produto || String(idx + 1),
              xProd: item.descricao,
              NCM: item.ncm || '00000000',
              CFOP: item.cfop || nf.cfop || '5102',
              uCom: item.unidade || 'UN',
              qCom: item.quantidade,
              vUnCom: item.valor_unitario,
              vProd: item.valor_total,
            },
          })),
          infAdic: nf.informacoes_complementares ? {
            infCpl: nf.informacoes_complementares,
          } : undefined,
        },
      };

      // Call Nuvem Fiscal API
      const nfEndpoint = nf.tipo === 'nfse' ? '/nfse' : '/nfe';
      const response = await fetch(`${NUVEM_FISCAL_BASE}${nfEndpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nfePayload),
      });

      const result = await response.json();

      if (!response.ok) {
        // Update NF as rejected
        await supabase.from('notas_fiscais').update({
          status: 'rejeitada',
          motivo_rejeicao: result.message || JSON.stringify(result),
          nuvem_fiscal_status: 'erro',
        }).eq('id', nota_fiscal_id);

        throw new Error(result.message || 'Erro na API Nuvem Fiscal');
      }

      // Update NF with response data
      await supabase.from('notas_fiscais').update({
        status: result.status === 'autorizada' ? 'autorizada' : 'enviada',
        nuvem_fiscal_id: result.id,
        nuvem_fiscal_status: result.status,
        numero_nf: result.numero || nf.numero_nf,
        chave_acesso: result.chave || null,
        protocolo_autorizacao: result.protocolo || null,
        xml_retorno: result.xml || null,
      }).eq('id', nota_fiscal_id);

      return new Response(JSON.stringify({ success: true, nuvem_fiscal_id: result.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'consultar_chave') {
      const { chave_acesso, contrato_id } = body;
      
      // Try to get API key from any active empresa config
      const { data: configs } = await supabase
        .from('nuvem_fiscal_config')
        .select('api_key_encrypted, ambiente')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .limit(1);

      const apiKey = configs?.[0]?.api_key_encrypted;
      
      if (!apiKey) {
        // Fallback: just store the key reference without actual data
        const { error } = await supabase.from('notas_fiscais').insert({
          user_id: user.id,
          contrato_id,
          tipo: 'nfe',
          chave_acesso,
          status: 'autorizada',
          observacoes: 'Importada por chave de acesso (dados pendentes de consulta)',
        });
        if (error) throw new Error('Erro ao registrar NF');
        return new Response(JSON.stringify({ success: true, message: 'NF registrada. Configure a API para obter dados completos.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Query Nuvem Fiscal
      const response = await fetch(`${NUVEM_FISCAL_BASE}/nfe/${chave_acesso}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        throw new Error('NF não encontrada ou erro na consulta');
      }

      const nfData = response.ok ? await response.json() : null;

      // Insert NF with extracted data
      const insertData: any = {
        user_id: user.id,
        contrato_id,
        tipo: 'nfe',
        chave_acesso,
        status: 'autorizada',
      };

      if (nfData) {
        const inf = nfData.infNFe || {};
        const ide = inf.ide || {};
        const dest = inf.dest || {};
        const total = inf.total?.ICMSTot || {};

        insertData.numero_nf = ide.nNF?.toString();
        insertData.serie = ide.serie?.toString();
        insertData.natureza_operacao = ide.natOp;
        insertData.valor_total = parseFloat(total.vNF) || 0;
        insertData.valor_produtos = parseFloat(total.vProd) || 0;
        insertData.valor_icms = parseFloat(total.vICMS) || 0;
        insertData.valor_pis = parseFloat(total.vPIS) || 0;
        insertData.valor_cofins = parseFloat(total.vCOFINS) || 0;
        insertData.valor_frete = parseFloat(total.vFrete) || 0;
        insertData.valor_desconto = parseFloat(total.vDesc) || 0;
        insertData.destinatario_cnpj = dest.CNPJ || dest.CPF;
        insertData.destinatario_razao_social = dest.xNome;
        insertData.destinatario_uf = dest.enderDest?.UF;
        insertData.destinatario_municipio = dest.enderDest?.xMun;
        insertData.destinatario_ie = dest.IE;
        insertData.nuvem_fiscal_id = nfData.id;
        insertData.protocolo_autorizacao = nfData.protocolo;
        insertData.data_emissao = ide.dhEmi;
      }

      const { data: insertedNf, error: insertErr } = await supabase
        .from('notas_fiscais').insert(insertData).select('id').single();

      if (insertErr) throw new Error('Erro ao salvar NF');

      // Insert items if available
      if (nfData?.infNFe?.det) {
        const dets = Array.isArray(nfData.infNFe.det) ? nfData.infNFe.det : [nfData.infNFe.det];
        const nfItens = dets.map((det: any) => ({
          nota_fiscal_id: insertedNf.id,
          numero_item: det.nItem || 1,
          descricao: det.prod?.xProd || 'Item',
          ncm: det.prod?.NCM,
          cfop: det.prod?.CFOP,
          unidade: det.prod?.uCom || 'UN',
          quantidade: parseFloat(det.prod?.qCom) || 0,
          valor_unitario: parseFloat(det.prod?.vUnCom) || 0,
          valor_total: parseFloat(det.prod?.vProd) || 0,
          icms_valor: parseFloat(det.imposto?.ICMS?.ICMS00?.vICMS || det.imposto?.ICMS?.ICMSSN102?.vICMS || '0'),
          pis_valor: parseFloat(det.imposto?.PIS?.PISAliq?.vPIS || '0'),
          cofins_valor: parseFloat(det.imposto?.COFINS?.COFINSAliq?.vCOFINS || '0'),
        }));
        await supabase.from('nota_fiscal_itens').insert(nfItens);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'importar_xml') {
      const { xml_content, contrato_id } = body;

      // Parse XML to extract NF data
      // Simple XML parsing for NF-e structure
      const getTag = (xml: string, tag: string): string => {
        const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
        return match ? match[1] : '';
      };

      const getBlock = (xml: string, tag: string): string => {
        const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return match ? match[1] : '';
      };

      const infNFe = getBlock(xml_content, 'infNFe');
      const ide = getBlock(infNFe, 'ide');
      const dest = getBlock(infNFe, 'dest');
      const total = getBlock(getBlock(infNFe, 'total'), 'ICMSTot');
      const protNFe = getBlock(xml_content, 'protNFe');

      // Extract chave from infNFe Id attribute
      const chaveMatch = infNFe.match(/Id="NFe(\d{44})"/);
      const chave = chaveMatch ? chaveMatch[1] : '';

      const insertData: any = {
        user_id: user.id,
        contrato_id,
        tipo: 'nfe',
        chave_acesso: chave || null,
        numero_nf: getTag(ide, 'nNF') || null,
        serie: getTag(ide, 'serie') || '1',
        natureza_operacao: getTag(ide, 'natOp') || null,
        data_emissao: getTag(ide, 'dhEmi') || null,
        valor_total: parseFloat(getTag(total, 'vNF')) || 0,
        valor_produtos: parseFloat(getTag(total, 'vProd')) || 0,
        valor_icms: parseFloat(getTag(total, 'vICMS')) || 0,
        valor_pis: parseFloat(getTag(total, 'vPIS')) || 0,
        valor_cofins: parseFloat(getTag(total, 'vCOFINS')) || 0,
        valor_frete: parseFloat(getTag(total, 'vFrete')) || 0,
        valor_desconto: parseFloat(getTag(total, 'vDesc')) || 0,
        destinatario_cnpj: getTag(dest, 'CNPJ') || getTag(dest, 'CPF') || null,
        destinatario_razao_social: getTag(dest, 'xNome') || null,
        destinatario_uf: getTag(getBlock(dest, 'enderDest'), 'UF') || null,
        destinatario_municipio: getTag(getBlock(dest, 'enderDest'), 'xMun') || null,
        destinatario_ie: getTag(dest, 'IE') || null,
        protocolo_autorizacao: getTag(protNFe, 'nProt') || null,
        status: getTag(protNFe, 'cStat') === '100' ? 'autorizada' : 'rascunho',
        xml_envio: xml_content,
      };

      const { data: insertedNf, error: insertErr } = await supabase
        .from('notas_fiscais').insert(insertData).select('id').single();

      if (insertErr) throw new Error('Erro ao salvar NF: ' + insertErr.message);

      // Extract items from <det> blocks
      const detBlocks = infNFe.match(/<det[^>]*>[\s\S]*?<\/det>/g) || [];
      if (detBlocks.length > 0) {
        const nfItens = detBlocks.map((det: string, idx: number) => {
          const prod = getBlock(det, 'prod');
          return {
            nota_fiscal_id: insertedNf.id,
            numero_item: idx + 1,
            codigo_produto: getTag(prod, 'cProd') || null,
            descricao: getTag(prod, 'xProd') || 'Item',
            ncm: getTag(prod, 'NCM') || null,
            cfop: getTag(prod, 'CFOP') || null,
            unidade: getTag(prod, 'uCom') || 'UN',
            quantidade: parseFloat(getTag(prod, 'qCom')) || 0,
            valor_unitario: parseFloat(getTag(prod, 'vUnCom')) || 0,
            valor_total: parseFloat(getTag(prod, 'vProd')) || 0,
          };
        });
        await supabase.from('nota_fiscal_itens').insert(nfItens);
      }

      return new Response(JSON.stringify({ success: true, itens_count: detBlocks.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Ação não reconhecida');
  } catch (error: any) {
    console.error('emissao-nf error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
