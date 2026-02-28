import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CepInfo = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  erro?: boolean;
};

type FreteOpcao = {
  modalidade: string;
  transportadora: string;
  prazo_dias: number;
  valor: number;
  descricao: string;
};

type CotacaoResult = {
  origem: { cep: string; cidade: string; uf: string };
  destino: { cep: string; cidade: string; uf: string };
  distancia_estimada_km: number;
  opcoes: FreteOpcao[];
};

/* ─── Região por UF ─── */
const UF_REGIAO: Record<string, string> = {
  AC: 'norte', AM: 'norte', AP: 'norte', PA: 'norte', RO: 'norte', RR: 'norte', TO: 'norte',
  AL: 'nordeste', BA: 'nordeste', CE: 'nordeste', MA: 'nordeste', PB: 'nordeste',
  PE: 'nordeste', PI: 'nordeste', RN: 'nordeste', SE: 'nordeste',
  DF: 'centro_oeste', GO: 'centro_oeste', MT: 'centro_oeste', MS: 'centro_oeste',
  ES: 'sudeste', MG: 'sudeste', RJ: 'sudeste', SP: 'sudeste',
  PR: 'sul', RS: 'sul', SC: 'sul',
};

/* ─── Coordenadas aproximadas das capitais para cálculo de distância ─── */
const CAPITAL_COORDS: Record<string, [number, number]> = {
  AC: [-9.97, -67.81], AL: [-9.67, -35.74], AM: [-3.12, -60.02], AP: [0.03, -51.05],
  BA: [-12.97, -38.51], CE: [-3.72, -38.54], DF: [-15.78, -47.93], ES: [-20.32, -40.34],
  GO: [-16.68, -49.25], MA: [-2.53, -44.28], MG: [-19.92, -43.94], MS: [-20.44, -54.65],
  MT: [-15.60, -56.10], PA: [-1.46, -48.50], PB: [-7.12, -34.86], PE: [-8.05, -34.87],
  PI: [-5.09, -42.80], PR: [-25.43, -49.27], RJ: [-22.91, -43.17], RN: [-5.79, -35.21],
  RO: [-8.76, -63.90], RR: [2.82, -60.67], RS: [-30.03, -51.23], SC: [-27.59, -48.55],
  SE: [-10.91, -37.07], SP: [-23.55, -46.63], TO: [-10.18, -48.33],
};

/** Calculate haversine distance between two UFs (capital-to-capital) in km */
function calcDistanciaKm(ufOrigem: string, ufDestino: string): number {
  const c1 = CAPITAL_COORDS[ufOrigem];
  const c2 = CAPITAL_COORDS[ufDestino];
  if (!c1 || !c2) return 1000;
  if (ufOrigem === ufDestino) return 150; // same state

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(c2[0] - c1[0]);
  const dLon = toRad(c2[1] - c1[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(c1[0])) * Math.cos(toRad(c2[0])) * Math.sin(dLon / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(dist);
}

/** Calculate freight options based on distance and weight */
function calcFreteOpcoes(distKm: number, peso: number, valorProduto: number, mesmaRegiao: boolean, mesmoEstado: boolean): FreteOpcao[] {
  const opcoes: FreteOpcao[] = [];

  // Base price per kg per km (decreasing with distance)
  const basePorKgKm = distKm < 500 ? 0.0012 : distKm < 1500 ? 0.0008 : 0.0006;

  // PAC (Correios)
  const pacBase = Math.max(18.90, peso * distKm * basePorKgKm + 12);
  const pacPrazo = mesmoEstado ? Math.ceil(Math.random() * 2 + 3) : mesmaRegiao ? Math.ceil(Math.random() * 3 + 5) : Math.ceil(Math.random() * 5 + 8);
  opcoes.push({
    modalidade: 'PAC',
    transportadora: 'Correios',
    prazo_dias: pacPrazo,
    valor: Math.round(pacBase * 100) / 100,
    descricao: 'Econômico - Correios',
  });

  // SEDEX (Correios)
  const sedexBase = pacBase * 1.8 + 8;
  const sedexPrazo = mesmoEstado ? Math.ceil(Math.random() + 1) : mesmaRegiao ? Math.ceil(Math.random() * 2 + 2) : Math.ceil(Math.random() * 3 + 4);
  opcoes.push({
    modalidade: 'SEDEX',
    transportadora: 'Correios',
    prazo_dias: sedexPrazo,
    valor: Math.round(sedexBase * 100) / 100,
    descricao: 'Expresso - Correios',
  });

  // Transportadora (for heavier items or larger distances)
  if (peso > 5 || valorProduto > 200) {
    const transpBase = Math.max(35, peso * distKm * basePorKgKm * 0.7 + 20);
    const transpPrazo = mesmoEstado ? Math.ceil(Math.random() * 2 + 2) : mesmaRegiao ? Math.ceil(Math.random() * 3 + 4) : Math.ceil(Math.random() * 4 + 6);
    opcoes.push({
      modalidade: 'Transportadora',
      transportadora: mesmaRegiao ? 'Jadlog' : 'TNT/FedEx',
      prazo_dias: transpPrazo,
      valor: Math.round(transpBase * 100) / 100,
      descricao: `Rodoviário - ${mesmaRegiao ? 'Jadlog' : 'TNT/FedEx'}`,
    });
  }

  // Mini Envio (for small items)
  if (peso <= 2 && valorProduto < 200) {
    const miniBase = Math.max(9.90, pacBase * 0.6);
    const miniPrazo = pacPrazo + Math.ceil(Math.random() * 3 + 2);
    opcoes.push({
      modalidade: 'Mini Envios',
      transportadora: 'Correios',
      prazo_dias: miniPrazo,
      valor: Math.round(miniBase * 100) / 100,
      descricao: 'Super Econômico - Mini Envios',
    });
  }

  // Frete grátis threshold
  if (valorProduto > 300) {
    opcoes.push({
      modalidade: 'Frete Grátis',
      transportadora: 'Loja',
      prazo_dias: pacPrazo + 2,
      valor: 0,
      descricao: `Frete grátis (compras acima de R$ 300)`,
    });
  }

  return opcoes.sort((a, b) => a.valor - b.valor);
}

async function fetchCep(cep: string): Promise<CepInfo | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cep_origem, cep_destino, peso, valor_produto } = await req.json();

    if (!cep_origem || !cep_destino) {
      return new Response(
        JSON.stringify({ success: false, error: "CEP de origem e destino são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch CEP info in parallel
    const [origemInfo, destinoInfo] = await Promise.all([
      fetchCep(cep_origem),
      fetchCep(cep_destino),
    ]);

    if (!origemInfo) {
      return new Response(
        JSON.stringify({ success: false, error: "CEP de origem inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!destinoInfo) {
      return new Response(
        JSON.stringify({ success: false, error: "CEP de destino inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const distKm = calcDistanciaKm(origemInfo.uf, destinoInfo.uf);
    const regiaoOrigem = UF_REGIAO[origemInfo.uf] || '';
    const regiaoDestino = UF_REGIAO[destinoInfo.uf] || '';
    const mesmaRegiao = regiaoOrigem === regiaoDestino;
    const mesmoEstado = origemInfo.uf === destinoInfo.uf;

    const pesoEfetivo = peso || 1;
    const valorProdutoEfetivo = valor_produto || 100;

    const opcoes = calcFreteOpcoes(distKm, pesoEfetivo, valorProdutoEfetivo, mesmaRegiao, mesmoEstado);

    const result: CotacaoResult = {
      origem: { cep: origemInfo.cep, cidade: origemInfo.localidade, uf: origemInfo.uf },
      destino: { cep: destinoInfo.cep, cidade: destinoInfo.localidade, uf: destinoInfo.uf },
      distancia_estimada_km: distKm,
      opcoes,
    };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Erro cotação frete:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
