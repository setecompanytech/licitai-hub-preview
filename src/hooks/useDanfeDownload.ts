import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

type ConsultaResult = {
  status: string;
  numero?: number;
  chave?: string;
  protocolo?: string;
  danfe_url?: string;
  xml_url?: string;
  mensagem?: string;
};

export function useDanfeDownload() {
  const [downloading, setDownloading] = useState(false);
  const [polling, setPolling] = useState(false);
  const cancelPolling = useRef(false);

  /** Faz download forçado do DANFE como anexo no browser. */
  const baixarDanfe = useCallback(async (nfeId: string, opts?: { silencioso?: boolean }) => {
    setDownloading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/baixar-danfe`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nfe_id: nfeId }),
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        let msg = `Falha ao baixar DANFE (HTTP ${res.status})`;
        if (ct.includes("application/json")) {
          const j = await res.json().catch(() => null);
          if (j?.error) msg = j.error;
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="?([^";]+)"?/i);
      const fileName = m?.[1] || `DANFE-${nfeId}.pdf`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

      if (!opts?.silencioso) toast.success("DANFE baixado com sucesso");
      return true;
    } catch (e: any) {
      toast.error(e.message || "Erro ao baixar DANFE");
      return false;
    } finally {
      setDownloading(false);
    }
  }, []);

  /**
   * Após emitir uma NF-e, faz polling consultando a SEFAZ via Focus até obter
   * status final (autorizada/rejeitada/denegada) ou timeout. Quando autorizada,
   * dispara automaticamente o download do DANFE.
   */
  const aguardarAutorizacaoEBaixar = useCallback(async (nfeId: string): Promise<ConsultaResult | null> => {
    cancelPolling.current = false;
    setPolling(true);
    const inicio = Date.now();

    try {
      while (Date.now() - inicio < POLL_TIMEOUT_MS) {
        if (cancelPolling.current) return null;

        const { data, error } = await supabase.functions.invoke("emitir-nfe?action=consultar", {
          body: { nfe_id: nfeId },
        });
        if (error) {
          console.warn("[polling] erro consulta:", error);
        } else if (data?.status === "autorizada") {
          toast.success(`NF-e autorizada — protocolo ${data.protocolo || "registrado"}`);
          // Auto-download do DANFE
          await baixarDanfe(nfeId, { silencioso: true });
          toast.success("DANFE baixado automaticamente");
          return data as ConsultaResult;
        } else if (data?.status === "rejeitada" || data?.status === "denegada") {
          toast.error(`NF-e ${data.status}: ${data.mensagem || "verifique o motivo"}`);
          return data as ConsultaResult;
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      toast.warning("Tempo esgotado aguardando autorização. Use o botão Atualizar para consultar novamente.");
      return null;
    } finally {
      setPolling(false);
    }
  }, [baixarDanfe]);

  const cancelar = useCallback(() => { cancelPolling.current = true; }, []);

  /**
   * Consulta única (sem polling) do status na SEFAZ. Retorna o resultado e,
   * quando autorizada, dispara o download do DANFE automaticamente.
   */
  const consultarStatus = useCallback(async (
    nfeId: string,
    opts?: { autoBaixar?: boolean; silencioso?: boolean }
  ): Promise<ConsultaResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("emitir-nfe?action=consultar", {
        body: { nfe_id: nfeId },
      });
      if (error) throw error;
      const result = data as ConsultaResult;
      if (!opts?.silencioso) {
        if (result?.status === "autorizada") {
          toast.success(`NF-e autorizada — protocolo ${result.protocolo || "registrado"}`);
        } else if (result?.status === "rejeitada" || result?.status === "denegada") {
          toast.error(`NF-e ${result.status}: ${result.mensagem || "verifique o motivo"}`);
        } else {
          toast.info(`Status atual: ${result?.status || "desconhecido"}`);
        }
      }
      if (result?.status === "autorizada" && opts?.autoBaixar !== false) {
        await baixarDanfe(nfeId, { silencioso: true });
      }
      return result;
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar status");
      return null;
    }
  }, [baixarDanfe]);

  return { baixarDanfe, aguardarAutorizacaoEBaixar, consultarStatus, cancelar, downloading, polling };
}
