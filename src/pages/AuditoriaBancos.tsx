import BotaoVoltar from '@/components/layout/BotaoVoltar';
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, Landmark } from "lucide-react";
import {
  BANCOS_BRASIL,
  BancoLogo,
  getBrandStyle,
} from "@/components/financeiro/BancoSelectorLogos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CabecalhoPagina from "@/components/shared/CabecalhoPagina";

/**
 * Auditoria visual da base de bancos:
 * — Logo oficial (SVG real) vs. monograma de fallback
 * — Nome conforme tabela COMPE/Bacen
 * — Cor institucional configurada
 * — Pendências detectadas
 *
 * Disponível em /auditoria-bancos
 */

// Logos oficiais reais (SVG/PNG/JPG/WebP) já disponíveis no diretório
const LOGO_MODULES = import.meta.glob("@/assets/banks/*.{svg,png,jpg,jpeg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const CODIGOS_COM_SVG = new Set(
  Object.keys(LOGO_MODULES).map((p) =>
    p.split("/").pop()!.replace(/\.(svg|png|jpe?g|webp)$/i, ""),
  ),
);

// Quais arquivos são logos oficiais reais (não placeholder gerado).
// Incluímos aqui os códigos que já receberam o logotipo oficial em raster (PNG) ou SVG real.
const LOGOS_OFICIAIS_REAIS = new Set(["001", "033", "037", "104", "341"]);

// A cor institucional "não mapeada" é a do fallback de `getBrandStyle` — o
// mesmo objeto que ele devolve para código desconhecido. Comparar com ele, e
// não com um hex copiado, mantém a régua única.
const COR_PADRAO = getBrandStyle(null).bg;

interface Auditoria {
  codigo: string;
  nome: string;
  temSvg: boolean;
  oficialReal: boolean;
  temCor: boolean;
  pendencias: string[];
}

export default function AuditoriaBancos() {
  const linhas = useMemo<Auditoria[]>(() => {
    return BANCOS_BRASIL.map((b) => {
      const temSvg = CODIGOS_COM_SVG.has(b.codigo);
      const oficialReal = LOGOS_OFICIAIS_REAIS.has(b.codigo);
      const brand = getBrandStyle(b.codigo);
      const temCor = brand.bg !== COR_PADRAO; // diferente do default

      const pendencias: string[] = [];
      if (!temSvg) pendencias.push("Sem SVG no diretório");
      if (temSvg && !oficialReal) pendencias.push("SVG é placeholder estilizado (não logo oficial)");
      if (!temCor) pendencias.push("Cor institucional não mapeada");

      return { codigo: b.codigo, nome: b.nome, temSvg, oficialReal, temCor, pendencias };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, []);

  const total = linhas.length;
  const oficiais = linhas.filter((l) => l.oficialReal).length;
  const placeholders = linhas.filter((l) => l.temSvg && !l.oficialReal).length;
  const semSvg = linhas.filter((l) => !l.temSvg).length;
  const semCor = linhas.filter((l) => !l.temCor).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <BotaoVoltar />
        <CabecalhoPagina
          titulo="Auditoria de Bancos"
          descricao="Revisão de logos, códigos COMPE e identidade visual de todos os bancos cadastrados."
          icone={<Landmark />}
          trilha={[{ rotulo: "Financeiro", para: "/financeiro" }, { rotulo: "Auditoria de Bancos" }]}
          acoes={
            <Button asChild variant="outline">
              <Link to="/financeiro">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar ao Financeiro
              </Link>
            </Button>
          }
        />

        <div className="space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Resumo titulo="Total de bancos" valor={total} tom="neutral" />
            <Resumo titulo="Logos oficiais reais" valor={oficiais} tom="success" />
            <Resumo titulo="Placeholders estilizados" valor={placeholders} tom="warning" />
            <Resumo titulo="Sem SVG" valor={semSvg} tom={semSvg > 0 ? "danger" : "success"} />
          </div>

          {/* Tabela */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-sm font-semibold text-foreground">
                <tr>
                  <th className="text-left px-4 py-3 w-16">Logo</th>
                  <th className="text-left px-4 py-3 w-20">COMPE</th>
                  <th className="text-left px-4 py-3">Nome oficial</th>
                  <th className="text-left px-4 py-3 w-32">Logo</th>
                  <th className="text-left px-4 py-3 w-24">Nome</th>
                  <th className="text-left px-4 py-3 w-24">Cor</th>
                  <th className="text-left px-4 py-3">Pendência</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.codigo} className="border-t border-border hover:bg-muted/50">
                    <td className="px-4 py-2">
                      <BancoLogo codigo={l.codigo} nome={l.nome} size={32} />
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums whitespace-nowrap">
                      {l.codigo}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{l.nome}</td>
                    <td className="px-4 py-2">
                      {l.oficialReal ? (
                        <Badge variant="success">Oficial</Badge>
                      ) : l.temSvg ? (
                        <Badge variant="warning">Placeholder</Badge>
                      ) : (
                        <Badge variant="danger">Faltando</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="success">OK</Badge>
                    </td>
                    <td className="px-4 py-2">
                      {l.temCor ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="danger">Faltando</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {l.pendencias.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Nenhuma
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-warning shrink-0" aria-hidden="true" />
                          {l.pendencias.join(" · ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Para substituir um placeholder por logo oficial, basta soltar o arquivo{" "}
            <code className="font-mono">src/assets/banks/&lt;codigo&gt;.svg</code> com o SVG real do
            banco. O sistema detecta automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  tom,
}: {
  titulo: string;
  valor: number;
  tom: "neutral" | "success" | "warning" | "danger";
}) {
  const cor =
    tom === "success"
      ? "text-success"
      : tom === "warning"
        ? "text-warning"
        : tom === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      <p className={`mt-1 text-[2rem] leading-10 font-bold tabular-nums ${cor}`}>{valor}</p>
    </div>
  );
}
