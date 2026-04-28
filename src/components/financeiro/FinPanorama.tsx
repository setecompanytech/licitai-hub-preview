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
    <Tabs defaultValue="visao" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="visao">
          <Eye className="w-4 h-4 mr-1.5" />
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="cfo">
          <Activity className="w-4 h-4 mr-1.5" />
          CFO
        </TabsTrigger>
        <TabsTrigger value="executivo">
          <BarChart3 className="w-4 h-4 mr-1.5" />
          Executivo
        </TabsTrigger>
        <TabsTrigger value="operacional">
          <LayoutDashboard className="w-4 h-4 mr-1.5" />
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
  );
}
