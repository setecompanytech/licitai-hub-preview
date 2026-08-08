import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Bell, Clock, CheckCircle2, AlertTriangle, FileText,
  Settings, CalendarDays, Send, Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BoletimList from '@/components/boletins/BoletimList';
import BoletimConfig from '@/components/boletins/BoletimConfig';

export default function Boletins() {
  const { user } = useAuth();
  const [enviosRecentes, setEnviosRecentes] = useState<any[]>([]);

  useEffect(() => {
    if (user) loadEnvios();
  }, [user]);

  const loadEnvios = async () => {
    const { data } = await supabase
      .from('boletim_envios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setEnviosRecentes(data);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground flex-shrink-0" />
            Boletins Diários
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Avisos de novas licitações, alterações e resultados por e-mail
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-success" />
            <p className="text-lg font-bold">{enviosRecentes.filter(e => e.tipo === 'manha').length}</p>
            <p className="text-xs text-muted-foreground">Enviados Manhã</p>
          </div>
          <div className="stat-card text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-warning" />
            <p className="text-lg font-bold">{enviosRecentes.filter(e => e.tipo === 'meiodia').length}</p>
            <p className="text-xs text-muted-foreground">Enviados Meio-dia</p>
          </div>
          <div className="stat-card text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-info" />
            <p className="text-lg font-bold">{enviosRecentes.filter(e => e.tipo === 'tarde').length}</p>
            <p className="text-xs text-muted-foreground">Enviados Tarde</p>
          </div>
        </div>

        <Tabs defaultValue="boletins" className="space-y-4">
          <TabsList>
            <TabsTrigger value="boletins"><Bell className="w-4 h-4 mr-1" /> Boletins</TabsTrigger>
            <TabsTrigger value="configuracao"><Settings className="w-4 h-4 mr-1" /> Configuração</TabsTrigger>
            <TabsTrigger value="historico"><Clock className="w-4 h-4 mr-1" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="boletins">
            <BoletimList />
          </TabsContent>

          <TabsContent value="configuracao">
            <BoletimConfig />
          </TabsContent>

          <TabsContent value="historico" className="space-y-3">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Últimos Envios</h3>
              {enviosRecentes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum envio registrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {enviosRecentes.map((envio) => (
                    <div key={envio.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{envio.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {envio.tipo} • {new Date(envio.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant={envio.status === 'enviado' ? 'default' : 'destructive'} className="text-xs">
                        {envio.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
