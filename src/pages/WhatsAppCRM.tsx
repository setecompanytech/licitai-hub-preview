import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Users, Megaphone, FileText, BarChart3, Route } from 'lucide-react';
import WhatsAppInbox from '@/components/whatsapp-crm/WhatsAppInbox';
import WhatsAppPipeline from '@/components/whatsapp-crm/WhatsAppPipeline';
import WhatsAppBroadcast from '@/components/whatsapp-crm/WhatsAppBroadcast';
import WhatsAppTemplates from '@/components/whatsapp-crm/WhatsAppTemplates';
import WhatsAppDashboard from '@/components/whatsapp-crm/WhatsAppDashboard';
import WhatsAppRoutingConfig from '@/components/whatsapp-crm/WhatsAppRoutingConfig';

export default function WhatsAppCRM() {
  const [activeTab, setActiveTab] = useState('inbox');

  return (
    <AppLayout>
      {/* O <Tabs> embrulha o cabeçalho porque a TabsList mora nele: gatilho e
          conteúdo precisam do mesmo contexto. Título, descrição, ícone e
          trilha vêm do registro `lib/navegacao/paginas.ts`. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <CabecalhoPagina>
          <TabsList>
            <TabsTrigger value="inbox">
              <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" />Caixa de entrada
            </TabsTrigger>
            <TabsTrigger value="pipeline">
              <Users className="w-4 h-4 mr-2" aria-hidden="true" />Funil
            </TabsTrigger>
            <TabsTrigger value="routing">
              <Route className="w-4 h-4 mr-2" aria-hidden="true" />Roteamento
            </TabsTrigger>
            <TabsTrigger value="broadcast">
              <Megaphone className="w-4 h-4 mr-2" aria-hidden="true" />Disparos
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="w-4 h-4 mr-2" aria-hidden="true" />Modelos
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-2" aria-hidden="true" />Painel
            </TabsTrigger>
          </TabsList>
        </CabecalhoPagina>

        <TabsContent value="inbox"><WhatsAppInbox /></TabsContent>
        <TabsContent value="pipeline"><WhatsAppPipeline /></TabsContent>
        <TabsContent value="routing"><WhatsAppRoutingConfig /></TabsContent>
        <TabsContent value="broadcast"><WhatsAppBroadcast /></TabsContent>
        <TabsContent value="templates"><WhatsAppTemplates /></TabsContent>
        <TabsContent value="dashboard"><WhatsAppDashboard /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
