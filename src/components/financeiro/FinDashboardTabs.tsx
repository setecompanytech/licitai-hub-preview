import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, BarChart3, Activity } from "lucide-react";
import FinDashboard from "./FinDashboard";
import FinDashboardExecutivo from "./FinDashboardExecutivo";
import FinCFODashboard from "./FinCFODashboard";

export default function FinDashboardTabs() {
  return (
    <Tabs defaultValue="cfo" className="space-y-4">
      {/* Abas sublinhadas do Design System v3 — o gatilho já traz o espaço
          entre ícone (16px) e rótulo. */}
      <TabsList>
        <TabsTrigger value="cfo">
          <Activity className="h-4 w-4" aria-hidden="true" />
          CFO
        </TabsTrigger>
        <TabsTrigger value="executivo">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Executivo
        </TabsTrigger>
        <TabsTrigger value="operacional">
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Operacional
        </TabsTrigger>
      </TabsList>
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
