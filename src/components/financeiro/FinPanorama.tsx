import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Activity, BarChart3, LayoutDashboard, CalendarDays } from "lucide-react";
import FinResumoVisor from "./FinResumoVisor";
import FinDashboard from "./FinDashboard";
import FinDashboardExecutivo from "./FinDashboardExecutivo";
import FinCFODashboard from "./FinCFODashboard";
import FinCalendarioFinanceiro from "./FinCalendarioFinanceiro";

/**
 * Painel Financeiro — unifica o antigo "Resumo" e "Dashboard".
 * Aba Visão Geral = visor executivo de operação (saldo, projeção 10 dias, atrasos).
 * Abas CFO / Executivo / Operacional = dashboards analíticos com KPIs e gráficos.
 */
export default function FinPanorama() {
  return (
    <div className="space-y-8">
      <Tabs defaultValue="visao" className="space-y-4">
        {/* TabsList já embrulha e cresce sozinha — repetir `flex-wrap h-auto`
            aqui só duplicava o que o componente de ui garante. */}
        <TabsList>
          <TabsTrigger value="visao">
            <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="cfo">
            <Activity className="w-4 h-4 mr-2" aria-hidden="true" />
            CFO
          </TabsTrigger>
          <TabsTrigger value="executivo">
            <BarChart3 className="w-4 h-4 mr-2" aria-hidden="true" />
            Executivo
          </TabsTrigger>
          <TabsTrigger value="operacional">
            <LayoutDashboard className="w-4 h-4 mr-2" aria-hidden="true" />
            Operacional
          </TabsTrigger>
        </TabsList>
        <TabsContent value="visao">
          <FinResumoVisor />
        </TabsContent>
        <TabsContent value="cfo">
          <FinCFODashboard />
        </TabsContent>
        <TabsContent value="executivo">
          <FinDashboardExecutivo />
        </TabsContent>
        <TabsContent value="operacional">
          <FinDashboard />
        </TabsContent>
      </Tabs>

      <section className="space-y-4 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">Calendário Financeiro</h2>
            <p className="text-sm text-muted-foreground">
              Espelho dinâmico de pagamentos e recebimentos do mês.
            </p>
          </div>
        </div>
        <FinCalendarioFinanceiro />
      </section>
    </div>
  );
}
