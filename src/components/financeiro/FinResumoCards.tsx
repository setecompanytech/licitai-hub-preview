import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatBRL } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { useResumoFinanceiro } from "@/hooks/useFinanceiro";
import ValorDeCartao from "./ValorDeCartao";

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
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  const iconBox = {
    default: "bg-muted text-foreground",
    success: "bg-success-tint text-success-ink",
    warning: "bg-warning-tint text-warning-ink",
    danger: "bg-destructive-tint text-destructive-ink",
  }[tone];
  return (
    <Card>
      <CardContent className="p-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <ValorDeCartao valor={value} className={toneClass} />
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${iconBox}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
      </CardContent>
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
