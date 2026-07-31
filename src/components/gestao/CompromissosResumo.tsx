import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListChecks, Brain, Bell, Mail, MessageSquare, Building2, ArrowRight, Loader2, Clock, FolderOpen, Archive, ArchiveRestore } from 'lucide-react';
import GlobalProcessoBar from '@/components/layout/GlobalProcessoBar';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { toast } from 'sonner';

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
  const navigate = useNavigate();
  const { iniciarProcesso, arquivarProcesso } = useLicitacaoIntegration();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [arquivando, setArquivando] = useState<string | null>(null);
  const [verArquivados, setVerArquivados] = useState(false);

  const abrirPasta = useCallback(async (p: Item) => {
    if (p.licitacao_id) { navigate(`/processo/${p.licitacao_id}`); return; }
    setOpening(p.id);
    try {
      const lid = await iniciarProcesso({
        numero: p.numero,
        orgao: p.orgao,
        objeto: p.objeto,
        modalidade: p.modalidade || undefined,
        valor_estimado: p.valor_estimado,
        uf: p.uf,
        municipio: p.municipio,
        data_encerramento: p.data_encerramento,
      });
      if (!lid) { toast.error('Não foi possível abrir a Pasta.'); return; }
      await supabase.from('processos_interesse').update({ licitacao_id: lid }).eq('id', p.id);
      navigate(`/processo/${lid}`);
    } finally {
      setOpening(null);
    }
  }, [iniciarProcesso, navigate]);

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

  /** Arquivar aqui também move o card no Kanban, quando há licitação vinculada. */
  const alternarArquivo = useCallback(async (p: Item) => {
    const restaurar = p.status === 'arquivado';
    setArquivando(p.id);
    try {
      if (p.licitacao_id) {
        const ok = await arquivarProcesso(p.licitacao_id, !restaurar);
        if (!ok) return;
      } else {
        const { error } = await supabase
          .from('processos_interesse')
          .update({ status: restaurar ? 'interessado' : 'arquivado' })
          .eq('id', p.id);
        if (error) { toast.error('Erro ao arquivar compromisso.'); return; }
      }
      toast.success(restaurar ? 'Compromisso restaurado.' : 'Compromisso arquivado.');
      carregar();
    } finally {
      setArquivando(null);
    }
  }, [arquivarProcesso, carregar]);

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

  const arquivados = items.filter((p) => p.status === 'arquivado');
  const visiveis = verArquivados ? arquivados : items.filter((p) => p.status !== 'arquivado');

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

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {verArquivados
            ? `${arquivados.length} compromisso(s) arquivado(s)`
            : `${visiveis.length} compromissos ativos — exibindo prazos críticos primeiro`}
        </p>
        <div className="flex items-center gap-1">
          {arquivados.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setVerArquivados(v => !v)}>
              <Archive className="w-3.5 h-3.5 mr-1" />
              {verArquivados ? 'Ver ativos' : `Arquivados (${arquivados.length})`}
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/meus-compromissos" className="text-xs">
              Abrir página completa <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {visiveis.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {verArquivados ? 'Nenhum compromisso arquivado.' : 'Nenhum compromisso ativo — todos estão arquivados.'}
          </p>
        </Card>
      )}

      {visiveis.map((p) => {
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
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => abrirPasta(p)} disabled={opening === p.id}>
                  {opening === p.id
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <FolderOpen className="w-3.5 h-3.5 mr-1" />}
                  Abrir Pasta
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={() => alternarArquivo(p)}
                  disabled={arquivando === p.id}
                  title={p.licitacao_id ? 'Sincroniza com o Kanban' : undefined}
                >
                  {arquivando === p.id
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : p.status === 'arquivado'
                    ? <ArchiveRestore className="w-3.5 h-3.5 mr-1" />
                    : <Archive className="w-3.5 h-3.5 mr-1" />}
                  {p.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
