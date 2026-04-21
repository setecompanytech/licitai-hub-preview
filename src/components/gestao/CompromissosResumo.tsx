import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListChecks, Brain, Bell, Mail, MessageSquare, Building2, ArrowRight, Loader2, Clock, FolderOpen } from 'lucide-react';
import GlobalProcessoBar from '@/components/layout/GlobalProcessoBar';

type Item = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
  status: string;
  ia_score: number | null;
  alerta_sistema: boolean | null;
  alerta_email: boolean | null;
  alerta_whatsapp: boolean | null;
  licitacao_id: string | null;
};

const fmtCurrency = (v: number | null) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/**
 * Lista compacta de compromissos (processos_interesse) embarcada na aba
 * Compromissos da Gestão. Mostra prazos, score IA e atalho para a página completa.
 */
export default function CompromissosResumo() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('processos_interesse')
      .select('id, numero, orgao, objeto, modalidade, valor_estimado, uf, municipio, data_encerramento, status, ia_score, alerta_sistema, alerta_email, alerta_whatsapp, licitacao_id')
      .eq('user_id', user.id)
      .order('data_encerramento', { ascending: true })
      .limit(50);
    setItems((data || []) as Item[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('compromissos-resumo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processos_interesse', filter: `user_id=eq.${user.id}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, carregar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ListChecks className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum compromisso ativo</p>
        <p className="text-xs text-muted-foreground mt-1">
          Inicie um processo no <strong>Monitoramento de Editais</strong> para gerar prazos e alertas automáticos.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/monitoramento-editais">Ir para Monitoramento</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Processo Ativo — seletor e atalho para a Pasta do Processo */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <GlobalProcessoBar />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {items.length} compromissos ativos — exibindo prazos críticos primeiro
        </p>
        <Button asChild variant="ghost" size="sm">
          <Link to="/meus-compromissos" className="text-xs">
            Abrir página completa <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      {items.map((p) => {
        const dias = diasAte(p.data_encerramento);
        const urgencia = dias === null ? 'normal'
          : dias <= 1 ? 'danger'
          : dias <= 3 ? 'warning'
          : 'normal';
        const colorMap = {
          danger: 'bg-destructive/15 text-destructive border-destructive/30',
          warning: 'bg-warning/15 text-warning border-warning/30',
          normal: 'bg-success/10 text-success border-success/30',
        };
        return (
          <Card key={p.id} className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className="text-[10px]">
                    <ListChecks className="w-3 h-3 mr-1" />{p.status}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">{p.numero}</span>
                  {p.modalidade && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.modalidade}</span>
                  )}
                  {dias !== null && dias >= 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colorMap[urgencia]}`}>
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {dias === 0 ? 'Encerra hoje' : `${dias}d restantes`}
                    </span>
                  )}
                  {p.ia_score != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                      <Brain className="w-3 h-3 inline mr-0.5" /> Score {p.ia_score}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-1">{p.objeto}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />{p.orgao}
                  </span>
                  {p.uf && <span>{p.municipio ? `${p.municipio}/${p.uf}` : p.uf}</span>}
                  <span className="font-medium text-foreground/80">{fmtCurrency(p.valor_estimado)}</span>
                  <span className="flex items-center gap-1">
                    {p.alerta_sistema && <Bell className="w-3 h-3 text-accent" />}
                    {p.alerta_email && <Mail className="w-3 h-3 text-info" />}
                    {p.alerta_whatsapp && <MessageSquare className="w-3 h-3 text-success" />}
                  </span>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" disabled={!p.licitacao_id}>
                <Link to={p.licitacao_id ? `/processo/${p.licitacao_id}` : '#'}>
                  <FolderOpen className="w-3.5 h-3.5 mr-1" /> Abrir Pasta
                </Link>
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
