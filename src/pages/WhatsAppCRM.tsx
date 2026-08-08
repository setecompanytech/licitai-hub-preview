import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
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
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">WhatsApp CRM</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Gerencie conversas, leads e campanhas em um único painel</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full max-w-3xl gap-1">
            <TabsTrigger value="inbox" className="gap-1.5 text-xs">
              <MessageSquare className="w-3.5 h-3.5" />Caixa de Entrada
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" />Pipeline
            </TabsTrigger>
            <TabsTrigger value="routing" className="gap-1.5 text-xs">
              <Route className="w-3.5 h-3.5" />Roteamento IA
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="gap-1.5 text-xs">
              <Megaphone className="w-3.5 h-3.5" />Envio em Massa
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />Templates
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" />Métricas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox"><WhatsAppInbox /></TabsContent>
          <TabsContent value="pipeline"><WhatsAppPipeline /></TabsContent>
          <TabsContent value="routing"><WhatsAppRoutingConfig /></TabsContent>
          <TabsContent value="broadcast"><WhatsAppBroadcast /></TabsContent>
          <TabsContent value="templates"><WhatsAppTemplates /></TabsContent>
          <TabsContent value="dashboard"><WhatsAppDashboard /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
