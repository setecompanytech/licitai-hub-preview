import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell, Clock, CheckCircle2, AlertTriangle, FileText,
  Settings, Inbox,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BoletimList from '@/components/boletins/BoletimList';
import BoletimConfig from '@/components/boletins/BoletimConfig';

export default function Boletins() {
  const { user } = useAuth();
  const [enviosRecentes, setEnviosRecentes] = useState<{ id: string; tipo: string; created_at: string; email: string | null; status: string | null }[]>([]);

  useEffect(() => {
    if (user) loadEnvios();
  }, [user]);

  const loadEnvios = async () => {
    const { data } = await supabase
      .from('boletim_envios')
      .select('id, tipo, created_at, email, status')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setEnviosRecentes(data);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina />

        {/* Contagem dos envios recentes, por horário do boletim */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              // O Boletim IA é o boletim das 06h — 'ia_diario' conta como manhã.
              // Antes o filtro só conhecia 'manha' e o cartão vivia em zero.
              rotulo: 'Enviados de manhã',
              Icone: FileText,
              valor: enviosRecentes.filter(e => e.tipo === 'manha' || e.tipo === 'ia_diario').length,
            },
            {
              rotulo: 'Enviados ao meio-dia',
              Icone: AlertTriangle,
              valor: enviosRecentes.filter(e => e.tipo === 'meiodia').length,
            },
            {
              rotulo: 'Enviados à tarde',
              Icone: CheckCircle2,
              valor: enviosRecentes.filter(e => e.tipo === 'tarde').length,
            },
          ].map(({ rotulo, Icone, valor }) => (
            <div key={rotulo} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icone className="h-4 w-4" aria-hidden="true" />
                {rotulo}
              </p>
              <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{valor}</p>
            </div>
          ))}
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
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Últimos envios</h2>
              {enviosRecentes.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Inbox />}
                  titulo="Nenhum envio registrado"
                  descricao="Assim que um boletim for enviado, ele aparece aqui com data, destinatário e situação."
                />
              ) : (
                <div className="space-y-2">
                  {enviosRecentes.map((envio) => (
                    <div key={envio.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{envio.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {envio.tipo} • {new Date(envio.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant={envio.status === 'enviado' ? 'success' : 'danger'}>
                        {envio.status || 'sem status'}
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
