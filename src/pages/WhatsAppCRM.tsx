import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Users, Megaphone, FileText, BarChart3 } from 'lucide-react';
import WhatsAppInbox from '@/components/whatsapp-crm/WhatsAppInbox';
import WhatsAppPipeline from '@/components/whatsapp-crm/WhatsAppPipeline';
import WhatsAppBroadcast from '@/components/whatsapp-crm/WhatsAppBroadcast';
import WhatsAppTemplates from '@/components/whatsapp-crm/WhatsAppTemplates';
import WhatsAppDashboard from '@/components/whatsapp-crm/WhatsAppDashboard';

export default function WhatsAppCRM() {
  const [activeTab, setActiveTab] = useState('inbox');

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp CRM</h1>
            <p className="text-sm text-muted-foreground">Gerencie conversas, leads e campanhas em um único painel</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="inbox" className="gap-1.5 text-xs">
              <MessageSquare className="w-3.5 h-3.5" />Caixa de Entrada
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" />Pipeline
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
          <TabsContent value="broadcast"><WhatsAppBroadcast /></TabsContent>
          <TabsContent value="templates"><WhatsAppTemplates /></TabsContent>
          <TabsContent value="dashboard"><WhatsAppDashboard /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
