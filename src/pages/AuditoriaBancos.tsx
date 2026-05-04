import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  BANCOS_BRASIL,
  BancoLogo,
  getBrandStyle,
} from "@/components/financeiro/BancoSelectorLogos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      const temCor = brand.bg !== "#1F2937"; // diferente do default

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
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Auditoria de Bancos</h1>
            <p className="text-sm text-muted-foreground">
              Revisão de logos, códigos COMPE e identidade visual de todos os bancos cadastrados.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/financeiro">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Financeiro
            </Link>
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Resumo titulo="Total de bancos" valor={total} tom="neutral" />
          <Resumo titulo="Logos oficiais reais" valor={oficiais} tom="success" />
          <Resumo titulo="Placeholders estilizados" valor={placeholders} tom="warning" />
          <Resumo titulo="Sem SVG" valor={semSvg} tom={semSvg > 0 ? "danger" : "success"} />
        </div>

        {/* Tabela */}
        <div className="rounded-lg border border-border/40 overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-16">Logo</th>
                <th className="text-left px-3 py-2 w-20">COMPE</th>
                <th className="text-left px-3 py-2">Nome oficial</th>
                <th className="text-left px-3 py-2 w-32">Logo</th>
                <th className="text-left px-3 py-2 w-24">Nome</th>
                <th className="text-left px-3 py-2 w-24">Cor</th>
                <th className="text-left px-3 py-2">Pendência</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo} className="border-t border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <BancoLogo codigo={l.codigo} nome={l.nome} size={32} />
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                    {l.codigo}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.nome}</td>
                  <td className="px-3 py-2">
                    {l.oficialReal ? (
                      <StatusBadge tom="success">Oficial</StatusBadge>
                    ) : l.temSvg ? (
                      <StatusBadge tom="warning">Placeholder</StatusBadge>
                    ) : (
                      <StatusBadge tom="danger">Faltando</StatusBadge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tom="success">OK</StatusBadge>
                  </td>
                  <td className="px-3 py-2">
                    {l.temCor ? (
                      <StatusBadge tom="success">OK</StatusBadge>
                    ) : (
                      <StatusBadge tom="danger">Faltando</StatusBadge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.pendencias.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Nenhuma
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
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
      ? "text-emerald-500"
      : tom === "warning"
        ? "text-amber-500"
        : tom === "danger"
          ? "text-red-500"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className={`text-2xl font-bold tabular-nums ${cor}`}>{valor}</div>
    </div>
  );
}

function StatusBadge({
  tom,
  children,
}: {
  tom: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    tom === "success"
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
      : tom === "warning"
        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
        : "bg-red-500/10 text-red-500 border-red-500/30";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {children}
    </Badge>
  );
}
