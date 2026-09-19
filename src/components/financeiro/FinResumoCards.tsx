import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatBRL } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { useResumoFinanceiro } from "@/hooks/useFinanceiro";
import ValorDeCartao from "./ValorDeCartao";

/**
 * Cartão KPI do Design System v3 (112px): rótulo em cima, ícone num ladrilho
 * tingido no canto, valor 28/36 embaixo — o mesmo desenho do `StatCard`.
 * Texto colorido sempre na tinta `*-ink`, nunca na cor cheia sobre branco.
 */
const Item = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: "default" | "success" | "warning" | "danger";
}) => {
  const toneClass = {
    default: "text-foreground",
    success: "text-success-ink",
    warning: "text-warning-ink",
    danger: "text-destructive-ink",
  }[tone];
  const iconBox = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success-tint text-success-ink",
    warning: "bg-warning-tint text-warning-ink",
    danger: "bg-destructive-tint text-destructive-ink",
  }[tone];
  return (
    <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconBox}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <ValorDeCartao valor={value} className={toneClass} />
    </Card>
  );
};

export default function FinResumoCards() {
  const { data, isLoading } = useResumoFinanceiro();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Carregando resumo">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Item label="Saldo em contas" value={formatBRL(data.saldoTotal)} icon={Wallet} tone="default" />
      <Item label="A pagar (aberto)" value={formatBRL(data.aPagar)} icon={ArrowDownCircle} tone="danger" />
      <Item label="A receber (aberto)" value={formatBRL(data.aReceber)} icon={ArrowUpCircle} tone="success" />
      <Item
        label="Resultado do mês"
        value={formatBRL(data.realizadoMes)}
        icon={data.realizadoMes >= 0 ? TrendingUp : TrendingDown}
        tone={data.realizadoMes >= 0 ? "success" : "danger"}
      />
    </div>
  );
}
