import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import {
  Bell, Clock, CheckCircle2, AlertTriangle, FileText,
  Settings, Inbox, Mail,
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

        {/* Contagem dos envios recentes, por horário do boletim — cartão KPI
            do Design System (rótulo em cima, número tabular, ícone no canto). */}
        <FaixaIndicadores
          itens={[
            {
              // O Boletim IA é o boletim das 06h — 'ia_diario' conta como manhã.
              // Antes o filtro só conhecia 'manha' e o cartão vivia em zero.
              rotulo: 'Enviados de manhã',
              icone: FileText,
              valor: enviosRecentes.filter(e => e.tipo === 'manha' || e.tipo === 'ia_diario').length,
            },
            {
              rotulo: 'Enviados ao meio-dia',
              icone: AlertTriangle,
              valor: enviosRecentes.filter(e => e.tipo === 'meiodia').length,
            },
            {
              rotulo: 'Enviados à tarde',
              icone: CheckCircle2,
              valor: enviosRecentes.filter(e => e.tipo === 'tarde').length,
            },
          ]}
        />

        <Tabs defaultValue="boletins" className="space-y-4">
          <TabsList>
            <TabsTrigger value="boletins"><Bell className="h-4 w-4" aria-hidden="true" /> Boletins</TabsTrigger>
            <TabsTrigger value="configuracao"><Settings className="h-4 w-4" aria-hidden="true" /> Configuração</TabsTrigger>
            <TabsTrigger value="historico"><Clock className="h-4 w-4" aria-hidden="true" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="boletins">
            <BoletimList />
          </TabsContent>

          <TabsContent value="configuracao">
            <BoletimConfig />
          </TabsContent>

          <TabsContent value="historico" className="space-y-3">
            <Card className="p-5">
              <h2 className="mb-4 text-lg font-semibold leading-6 text-foreground">Últimos envios</h2>
              {enviosRecentes.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Inbox />}
                  titulo="Nenhum envio registrado"
                  descricao="Assim que um boletim for enviado, ele aparece aqui com data, destinatário e situação."
                />
              ) : (
                /* Lista de envios: ícone, destinatário, horário e situação em selo. */
                <ul className="divide-y divide-border rounded-md border border-border">
                  {enviosRecentes.map((envio) => (
                    <li key={envio.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Mail className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{envio.email}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {envio.tipo} • {new Date(envio.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={envio.status === 'enviado' ? 'success' : 'danger'}>
                        {envio.status || 'sem status'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
