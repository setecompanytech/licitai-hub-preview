import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatBRL } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { useResumoFinanceiro } from "@/hooks/useFinanceiro";

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
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-semibold tabular-nums mt-1 ${toneClass}`}>{value}</p>
        </div>
        <Icon className={`w-5 h-5 ${toneClass}`} />
      </CardContent>
    </Card>
  );
};

export default function FinResumoCards() {
  const { data, isLoading } = useResumoFinanceiro();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
