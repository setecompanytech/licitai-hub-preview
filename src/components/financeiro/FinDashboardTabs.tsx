import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import FinDashboard from "./FinDashboard";
import FinDashboardExecutivo from "./FinDashboardExecutivo";

export default function FinDashboardTabs() {
  return (
    <Tabs defaultValue="executivo" className="space-y-4">
      <TabsList>
        <TabsTrigger value="executivo">
          <BarChart3 className="w-4 h-4 mr-1.5" />
          Executivo
        </TabsTrigger>
        <TabsTrigger value="operacional">
          <LayoutDashboard className="w-4 h-4 mr-1.5" />
          Operacional
        </TabsTrigger>
      </TabsList>
      <TabsContent value="executivo">
        <FinDashboardExecutivo />
      </TabsContent>
      <TabsContent value="operacional">
        <FinDashboard />
      </TabsContent>
    </Tabs>
  );
}
