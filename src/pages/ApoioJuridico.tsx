import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, BookOpen } from 'lucide-react';
import ReequilibrioIA from '@/components/apoio-juridico/ReequilibrioIA';
import BaseJuridicaUpload from '@/components/apoio-juridico/BaseJuridicaUpload';
import GeradorIAComBase from '@/components/apoio-juridico/GeradorIAComBase';
import ModelosTemplatesTab from '@/components/apoio-juridico/ModelosTemplatesTab';

export default function ApoioJuridico() {
  const [activeTab, setActiveTab] = useState('modelos');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-accent" />
            Apoio Jurídico Especializado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modelos, templates e geração assistida por IA – Lei 14.133/2021
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="modelos">Modelos e Templates + Gerador IA</TabsTrigger>
            <TabsTrigger value="reequilibrio">Reequilíbrio IA</TabsTrigger>
            <TabsTrigger value="legislacao">Legislação</TabsTrigger>
            <TabsTrigger value="base-juridica">Base Jurídica IA</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos" className="space-y-4">
            <ModelosTemplatesTab />
          </TabsContent>

          <TabsContent value="reequilibrio">
            <ReequilibrioIA />
          </TabsContent>




          <TabsContent value="base-juridica">
            <BaseJuridicaUpload />
          </TabsContent>

          <TabsContent value="legislacao">
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm">
              <h3 className="text-sm font-semibold mb-4">Referências Legais</h3>
              <div className="space-y-3">
                {[
                  { lei: 'Lei 14.133/2021', desc: 'Nova Lei de Licitações e Contratos Administrativos' },
                  { lei: 'LC 123/2006', desc: 'Estatuto da ME e EPP – tratamento diferenciado' },
                  { lei: 'Decreto 11.462/2023', desc: 'Regulamenta a Lei 14.133/2021 no âmbito federal' },
                  { lei: 'IN SEGES 73/2022', desc: 'Procedimentos para contratação de TIC' },
                  { lei: 'Lei 12.846/2013', desc: 'Lei Anticorrupção' },
                ].map((l) => (
                  <div key={l.lei} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{l.lei}</p>
                      <p className="text-xs text-muted-foreground">{l.desc}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <BookOpen className="w-3 h-3 mr-1" /> Consultar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
