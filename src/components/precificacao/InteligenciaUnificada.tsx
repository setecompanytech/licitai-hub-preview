import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, BarChart3 } from 'lucide-react';
import InteligenciaPrecos from './InteligenciaPrecos';
import ComparativoDashboard from './ComparativoDashboard';

export default function InteligenciaUnificada() {
  const [activeTab, setActiveTab] = useState('inteligencia');

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-6 text-foreground">Inteligência de Preços</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Análise comparativa entre fontes e recomendações de precificação por IA.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Fila sublinhada da ui, rolável no celular. */}
        <TabsList className="flex-nowrap overflow-x-auto [scrollbar-width:thin]">
          <TabsTrigger value="inteligencia" className="shrink-0">
            <Brain className="h-4 w-4" aria-hidden="true" /> Recomendações IA
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="shrink-0">
            <BarChart3 className="h-4 w-4" aria-hidden="true" /> Comparativo de Fontes
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
