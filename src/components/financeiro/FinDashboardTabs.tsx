import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, BarChart3, Activity } from "lucide-react";
import FinDashboard from "./FinDashboard";
import FinDashboardExecutivo from "./FinDashboardExecutivo";
import FinCFODashboard from "./FinCFODashboard";

export default function FinDashboardTabs() {
  return (
    <Tabs defaultValue="cfo" className="space-y-4">
      <TabsList>
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
