import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Landmark, ImageOff } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import {
  BANCOS_BRASIL,
  BancoLogo,
  getBrandStyle,
} from "@/components/financeiro/BancoSelectorLogos";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <AppLayout>
      {/* Não é item de menu: título, descrição e trilha vêm à mão, na mesma
          trilha das subtelas do Financeiro — Painel › Financeiro › tela.
          O caminho de volta é a trilha, como no hub; o Voltar do layout logo
          acima já responde pelo percurso. */}
      <div className="max-w-6xl mx-auto">
        <CabecalhoPagina
          titulo="Auditoria de bancos"
          descricao="Logos, códigos COMPE e cor institucional de cada banco cadastrado"
          icone={<Landmark />}
          trilha={[
            { rotulo: "Painel", para: "/dashboard" },
            { rotulo: "Financeiro", para: "/financeiro" },
            { rotulo: "Auditoria de bancos" },
          ]}
        />

        <div className="space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Resumo titulo="Total de bancos" valor={total} tom="neutral" icone={Landmark} />
            <Resumo titulo="Logos oficiais reais" valor={oficiais} tom="success" icone={CheckCircle2} />
            <Resumo titulo="Placeholders estilizados" valor={placeholders} tom="warning" icone={AlertTriangle} />
            <Resumo titulo="Sem SVG" valor={semSvg} tom={semSvg > 0 ? "danger" : "success"} icone={ImageOff} />
          </div>

          {/* Tabela */}
          {/* Tabela nos primitivos de `ui/table`: cabeçalho `bg-secondary`,
              rótulos 12/600 sem caixa alta, linhas de 48px e a rolagem
              horizontal presa ao cartão (Design System v3). */}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Marca</TableHead>
                  <TableHead className="w-20">COMPE</TableHead>
                  <TableHead>Nome oficial</TableHead>
                  <TableHead className="w-32">Arquivo do logo</TableHead>
                  <TableHead className="w-24">Nome</TableHead>
                  <TableHead className="w-24">Cor</TableHead>
                  <TableHead>Pendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.codigo}>
                    <TableCell>
                      <BancoLogo codigo={l.codigo} nome={l.nome} size={32} />
                    </TableCell>
                    <TableCell nowrap className="font-mono tabular-nums">
                      {l.codigo}
                    </TableCell>
                    <TableCell nowrap>{l.nome}</TableCell>
                    <TableCell>
                      {l.oficialReal ? (
                        <Badge variant="success">Oficial</Badge>
                      ) : l.temSvg ? (
                        <Badge variant="warning">Placeholder</Badge>
                      ) : (
                        <Badge variant="danger">Faltando</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">OK</Badge>
                    </TableCell>
                    <TableCell>
                      {l.temCor ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="danger">Faltando</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.pendencias.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-success-ink">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Nenhuma
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                          {l.pendencias.join(" · ")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <p className="text-xs text-muted-foreground">
            Para substituir um placeholder por logo oficial, basta soltar o arquivo{" "}
            <code className="font-mono">src/assets/banks/&lt;codigo&gt;.svg</code> com o SVG real do
            banco. O sistema detecta automaticamente.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

/**
 * Cartão KPI do Design System v3 (112px): rótulo em cima, ícone num ladrilho
 * tingido no canto, valor 28/36 em tinta `*-ink` — nunca a cor cheia sobre branco.
 */
function Resumo({
  titulo,
  valor,
  tom,
  icone: Icone,
}: {
  titulo: string;
  valor: number;
  tom: "neutral" | "success" | "warning" | "danger";
  icone: React.ElementType;
}) {
  const cor =
    tom === "success"
      ? "text-success-ink"
      : tom === "warning"
        ? "text-warning-ink"
        : tom === "danger"
          ? "text-destructive-ink"
          : "text-foreground";
  const ladrilho =
    tom === "success"
      ? "bg-success-tint text-success-ink"
      : tom === "warning"
        ? "bg-warning-tint text-warning-ink"
        : tom === "danger"
          ? "bg-destructive-tint text-destructive-ink"
          : "bg-muted text-muted-foreground";
  return (
    <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{titulo}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ladrilho}`}>
          <Icone className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className={`whitespace-nowrap text-[1.75rem] font-semibold leading-9 tabular-nums ${cor}`}>{valor}</p>
    </Card>
  );
}
