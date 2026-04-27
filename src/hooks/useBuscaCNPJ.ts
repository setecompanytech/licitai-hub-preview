/**
 * useBuscaCNPJ — Consulta de CNPJ com fallback BrasilAPI → ReceitaWS.
 *
 * Estratégia (modelo Omie "Pesquisa Atômica" da seção 2 do INTERFACE FINANCEIRO 2):
 *   1) Tenta primeiro a BrasilAPI (mais rápida, dados normalizados, sem rate limit agressivo).
 *   2) Se falhar (404, 429, timeout, erro de rede), faz fallback para ReceitaWS.
 *   3) Retorna o primeiro resultado bem-sucedido. Se ambas falharem, devolve o último erro.
 *
 * Para CPF (11 dígitos) não há fonte pública aberta — retorna apenas o documento.
 * Validação de Inscrição Estadual via SEFAZ deve ser feita por edge function separada
 * (nfe-consult-sefaz / consultar-cnpj-sefaz) por requerer certificado A1.
 */
import { useState } from "react";

export type DadosCNPJ = {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
  email?: string;
  telefone?: string;
  inscricao_estadual?: string;
  cnae_principal?: string;
  situacao?: string;
  fonte?: "brasilapi" | "receitaws";
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

async function consultarBrasilAPI(cnpj: string): Promise<DadosCNPJ> {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal (BrasilAPI)");
    throw new Error(`BrasilAPI ${res.status}`);
  }
  const data = await res.json();
  return {
    cnpj,
    razao_social: data.razao_social || "",
    nome_fantasia: data.nome_fantasia || undefined,
    logradouro: data.logradouro || undefined,
    numero: data.numero || undefined,
    complemento: data.complemento || undefined,
    bairro: data.bairro || undefined,
    cep: data.cep || undefined,
    municipio: data.municipio || undefined,
    uf: data.uf || undefined,
    email: data.email || undefined,
    telefone: data.ddd_telefone_1 || undefined,
    cnae_principal: data.cnae_fiscal_descricao || undefined,
    situacao: data.descricao_situacao_cadastral || undefined,
    fonte: "brasilapi",
  };
}

async function consultarReceitaWS(cnpj: string): Promise<DadosCNPJ> {
  // ReceitaWS não envia CORS via HTTPS gratuito direto do browser de forma estável.
  // Usa AllOrigins como proxy CORS público (best-effort fallback gratuito).
  const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ReceitaWS ${res.status}`);
  const data = await res.json();
  if (data.status === "ERROR") throw new Error(data.message || "ReceitaWS retornou erro");
  return {
    cnpj,
    razao_social: data.nome || "",
    nome_fantasia: data.fantasia || undefined,
    logradouro: data.logradouro || undefined,
    numero: data.numero || undefined,
    complemento: data.complemento || undefined,
    bairro: data.bairro || undefined,
    cep: data.cep ? data.cep.replace(/\D/g, "") : undefined,
    municipio: data.municipio || undefined,
    uf: data.uf || undefined,
    email: data.email || undefined,
    telefone: data.telefone || undefined,
    cnae_principal: data.atividade_principal?.[0]?.text || undefined,
    situacao: data.situacao || undefined,
    fonte: "receitaws",
  };
}

export function useBuscaCNPJ() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscarPorDocumento(doc: string): Promise<DadosCNPJ | null> {
    const numero = onlyDigits(doc);
    setError(null);

    if (numero.length === 11) {
      // CPF — não há fonte pública/legal aberta. Retorna apenas o documento.
      return { cnpj: numero, razao_social: "" };
    }

    if (numero.length !== 14) {
      setError("Informe um CNPJ (14 dígitos) ou CPF (11 dígitos)");
      return null;
    }

    setLoading(true);
    let ultimoErro: string | null = null;

    // 1ª tentativa: BrasilAPI (mais confiável)
    try {
      const r = await consultarBrasilAPI(numero);
      setLoading(false);
      return r;
    } catch (e: any) {
      ultimoErro = e?.message ?? "Falha BrasilAPI";
      console.warn("[useBuscaCNPJ] BrasilAPI falhou, tentando ReceitaWS:", ultimoErro);
    }

    // 2ª tentativa: ReceitaWS (fallback)
    try {
      const r = await consultarReceitaWS(numero);
      setLoading(false);
      return r;
    } catch (e: any) {
      ultimoErro = `${ultimoErro} · ReceitaWS: ${e?.message ?? "erro"}`;
    }

    setLoading(false);
    setError(ultimoErro || "Falha ao consultar fontes públicas");
    return null;
  }

  return { buscarPorDocumento, loading, error };
}
