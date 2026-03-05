import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2, AlertTriangle, FileText, CalendarDays, Clock, Loader2, Inbox
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Boletim = {
  id: string;
  titulo: string;
  tipo: 'novas' | 'alteracoes' | 'resultados';
  data: string;
  hora: string;
  totalItens: number;
  lido: boolean;
  itens: { titulo: string; orgao: string; valor: string }[];
};

const tipoConfig = {
  novas: { label: 'Novas Licitações', color: 'bg-success/15 text-success border-success/30', icon: FileText },
  alteracoes: { label: 'Alterações', color: 'bg-warning/15 text-warning border-warning/30', icon: AlertTriangle },
  resultados: { label: 'Resultados', color: 'bg-info/15 text-info border-info/30', icon: CheckCircle2 },
};

export default function BoletimList() {
  const { user } = useAuth();
  const [boletins, setBoletins] = useState<Boletim[]>([]);
  const [loading, setLoading] = useState(true);
  const [boletimAberto, setBoletimAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadBoletins();
  }, [user]);

  const loadBoletins = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('boletim_envios')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Map DB records to display format
    const mapped: Boletim[] = (data || []).map((b: any) => ({
      id: b.id,
      titulo: b.tipo === 'manha' ? 'Boletim da Manhã' : b.tipo === 'meiodia' ? 'Boletim do Meio-dia' : 'Boletim da Tarde',
      tipo: b.tipo === 'manha' ? 'novas' : b.tipo === 'meiodia' ? 'alteracoes' : 'resultados',
      data: b.created_at?.split('T')[0] || '',
      hora: new Date(b.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      totalItens: 0,
      lido: b.status === 'lido',
      itens: [],
    }));

    setBoletins(mapped);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (boletins.length === 0) {
    return (
      <div className="text-center py-12">
        <Inbox className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum boletim enviado ainda.</p>
        <p className="text-xs text-muted-foreground mt-1">Configure suas preferências de boletim para começar a receber.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {boletins.map(boletim => {
        const cfg = tipoConfig[boletim.tipo] || tipoConfig.novas;
        const Icon = cfg.icon;
        const isOpen = boletimAberto === boletim.id;
        return (
          <Card key={boletim.id} className={`p-4 transition-shadow hover:shadow-md ${!boletim.lido ? 'border-accent/30 bg-accent/5' : ''}`}>
            <button className="w-full text-left" onClick={() => setBoletimAberto(isOpen ? null : boletim.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{boletim.titulo}</span>
                      {!boletim.lido && <span className="w-2 h-2 rounded-full bg-accent" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <CalendarDays className="w-3 h-3" />
                      <span>{new Date(boletim.data).toLocaleDateString('pt-BR')}</span>
                      <Clock className="w-3 h-3" />
                      <span>{boletim.hora}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={cfg.color + ' text-[10px]'}>{cfg.label}</Badge>
              </div>
            </button>

            {isOpen && boletim.itens.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                {boletim.itens.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-xs">{item.titulo}</p>
                      <p className="text-[10px] text-muted-foreground">{item.orgao}</p>
                    </div>
                    <span className="text-xs font-medium">{item.valor}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
