import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, BarChart3 } from 'lucide-react';
import InteligenciaPrecos from './InteligenciaPrecos';
import ComparativoDashboard from './ComparativoDashboard';

export default function InteligenciaUnificada() {
  const [activeTab, setActiveTab] = useState('inteligencia');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Inteligência de Preços</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Análise comparativa entre fontes e recomendações de precificação por IA.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 h-auto">
          <TabsTrigger value="inteligencia" className="gap-1.5 text-xs">
            <Brain className="w-3.5 h-3.5" /> Recomendações IA
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Comparativo de Fontes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inteligencia">
          <InteligenciaPrecos />
        </TabsContent>

        <TabsContent value="comparativo">
          <ComparativoDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
