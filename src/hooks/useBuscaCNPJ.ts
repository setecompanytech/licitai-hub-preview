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
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function useBuscaCNPJ() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscarPorDocumento(doc: string): Promise<DadosCNPJ | null> {
    const numero = onlyDigits(doc);
    setError(null);

    if (numero.length === 11) {
      // CPF — não há fonte pública/legal aberta. Retorna apenas o documento formatado.
      return { cnpj: numero, razao_social: "" };
    }

    if (numero.length !== 14) {
      setError("Informe um CNPJ (14 dígitos) ou CPF (11 dígitos)");
      return null;
    }

    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${numero}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal");
        throw new Error(`Erro ${res.status} ao consultar BrasilAPI`);
      }
      const data = await res.json();
      return {
        cnpj: numero,
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
      };
    } catch (e: any) {
      setError(e.message || "Falha na consulta");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { buscarPorDocumento, loading, error };
}
