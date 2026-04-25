import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

export interface ResultadoImportacao {
  nome: string;
  status: "processada" | "duplicada" | "erro";
  erro?: string;
  tipo?: "nfe" | "nfse";
  direcao?: "entrada" | "saida";
  valor?: number;
  competencia?: string;
  chave?: string;
}

export interface RespostaImportacao {
  ok: boolean;
  total: number;
  criadas: number;
  duplicadas: number;
  erros: number;
  resultados: ResultadoImportacao[];
}

const MAX_ARQUIVOS_LOTE = 50;
const MAX_TAMANHO = 5 * 1024 * 1024; // 5 MB por XML

async function lerArquivo(f: File): Promise<{ nome: string; xml: string } | null> {
  if (f.size > MAX_TAMANHO) return null;
  const xml = await f.text();
  return { nome: f.name, xml };
}

export function useImportacaoNotas() {
  const { empresaAtiva } = useEmpresa();
  const [importando, setImportando] = useState(false);

  const importar = useCallback(async (files: File[]): Promise<RespostaImportacao | null> => {
    if (!empresaAtiva?.id) {
      toast.error("Selecione uma empresa ativa.");
      return null;
    }
    if (files.length === 0) return null;
    if (files.length > MAX_ARQUIVOS_LOTE) {
      toast.error(`Envie no máximo ${MAX_ARQUIVOS_LOTE} arquivos por vez.`);
      return null;
    }

    setImportando(true);
    try {
      const arquivos = (await Promise.all(files.map(lerArquivo))).filter(Boolean) as { nome: string; xml: string }[];
      if (arquivos.length === 0) {
        toast.error("Nenhum XML válido (limite 5 MB cada).");
        return null;
      }

      const { data, error } = await supabase.functions.invoke<RespostaImportacao>("importar-notas-fiscais", {
        body: { empresa_id: empresaAtiva.id, arquivos },
      });

      if (error) {
        toast.error("Erro: " + error.message);
        return null;
      }
      if (!data?.ok) {
        toast.error("Falha ao importar notas.");
        return null;
      }

      const { criadas, duplicadas, erros } = data;
      toast.success(
        `${criadas} nota(s) importada(s)` +
          (duplicadas ? ` · ${duplicadas} duplicada(s)` : "") +
          (erros ? ` · ${erros} erro(s)` : ""),
      );
      return data;
    } finally {
      setImportando(false);
    }
  }, [empresaAtiva?.id]);

  const listarRecentes = useCallback(async (limit = 50) => {
    if (!empresaAtiva?.id) return [];
    const { data } = await (supabase as any)
      .from("financeiro_notas_importadas")
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  }, [empresaAtiva?.id]);

  return { importar, importando, listarRecentes };
}
