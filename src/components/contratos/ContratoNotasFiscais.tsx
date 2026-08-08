import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, FileText, FileCheck, CheckCircle2, XCircle, Clock, Send,
  Building2, AlertTriangle, DollarSign, ExternalLink, RefreshCw,
  ArrowUpCircle, ArrowDownCircle, Eye
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type NotaFiscal = {
  id: string; tipo: string; numero_nf: string | null; serie: string | null;
  chave_acesso: string | null; protocolo_autorizacao: string | null;
  data_emissao: string | null; valor_total: number; valor_produtos: number;
  valor_servicos: number; status: string; destinatario_cnpj: string | null;
  destinatario_razao_social: string | null; natureza_operacao: string | null;
  cfop: string | null; observacoes: string | null; motivo_rejeicao: string | null;
  contrato_pedido_id: string | null; empresa_id: string | null;
  informacoes_complementares: string | null;
};

const statusCfg: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Clock },
  enviada: { label: 'Enviada', color: 'bg-warning/10 text-warning', icon: Send },
  autorizada: { label: 'Autorizada', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  inutilizada: { label: 'Inutilizada', color: 'bg-muted text-muted-foreground', icon: XCircle },
  registrada: { label: 'Registrada', color: 'bg-info/10 text-info', icon: FileCheck },
};

/**
 * Visualização sincronizada das NFs vinculadas a este contrato.
 * A emissão e gestão de NFs é competência do setor Financeiro.
 * O setor comercial pode consultar todas as NFs emitidas para o contrato.
 */
export default function ContratoNotasFiscais({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    loadNotas();
    // Subscribe to realtime changes for this contract's NFs
    const channel = supabase
      .channel(`nf-contrato-${contratoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notas_fiscais',
        filter: `contrato_id=eq.${contratoId}`,
      }, () => loadNotas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, contratoId]);

  const loadNotas = async () => {
    setLoading(true);
    const { data } = await supabase.from('notas_fiscais')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: false });
    setNotas((data as any[]) || []);
    setLoading(false);
  };

  const filteredNotas = statusFilter === 'all' ? notas : notas.filter(n => n.status === statusFilter);

  // KPIs
  const nfsSaida = notas.filter(n => !['Compra de mercadoria', 'Entrada por devolução', 'Retorno de conserto', 'Outra entrada', 'Importação direta'].includes(n.natureza_operacao || ''));
  const nfsEntrada = notas.filter(n => ['Compra de mercadoria', 'Entrada por devolução', 'Retorno de conserto', 'Outra entrada', 'Importação direta'].includes(n.natureza_operacao || ''));
  const totalAutorizado = nfsSaida.filter(n => n.status === 'autorizada').reduce((s, n) => s + n.valor_total, 0);
  const totalPendente = nfsSaida.filter(n => ['rascunho', 'enviada'].includes(n.status)).reduce((s, n) => s + n.valor_total, 0);
  const totalEntrada = nfsEntrada.reduce((s, n) => s + n.valor_total, 0);

  return (
    <div className="space-y-4">
      {/* Sync info banner */}
      <Card className="p-3 border-border bg-muted/40">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            Visualização sincronizada em tempo real. A emissão de NFs é gerenciada pelo setor <strong className="text-foreground">Financeiro</strong>.
          </p>
          <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={() => navigate('/financeiro')}>
            <ExternalLink className="w-3 h-3 mr-1" /> Ir ao Financeiro
          </Button>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><FileText className="w-3 h-3" /> Total NFs</div>
          <p className="text-lg font-bold">{notas.length}</p>
          <p className="text-xs text-muted-foreground">{nfsSaida.length} saída · {nfsEntrada.length} entrada</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><ArrowUpCircle className="w-3 h-3" /> Faturado (Saída)</div>
          <p className="text-lg font-bold text-success">{fmt(totalAutorizado)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><Clock className="w-3 h-3" /> Pendentes</div>
          <p className="text-lg font-bold text-warning">{fmt(totalPendente)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><ArrowDownCircle className="w-3 h-3" /> NFs Entrada</div>
          <p className="text-lg font-bold text-foreground">{fmt(totalEntrada)}</p>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="text-xs h-8" onClick={loadNotas}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      {/* NF Table */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filteredNotas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          Nenhuma nota fiscal vinculada a este contrato
          <p className="text-xs mt-2">Para emitir uma NF vinculada a este contrato, acesse <strong>Financeiro → NF Saída</strong> e selecione este contrato no campo "Vincular ao Contrato".</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredNotas.map(nf => {
            const cfg = statusCfg[nf.status] || statusCfg.rascunho;
            const Icon = cfg.icon;
            return (
              <Card key={nf.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">
                        {nf.tipo === 'nfse' ? 'NFS-e' : 'NF-e'} {nf.numero_nf || '(sem número)'}
                      </span>
                      <Badge className={`${cfg.color} text-xs`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                      {nf.serie && <Badge variant="outline" className="text-xs">Série {nf.serie}</Badge>}
                    </div>
                    {nf.destinatario_razao_social && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {nf.destinatario_razao_social}
                        {nf.destinatario_cnpj && <span className="text-xs">({nf.destinatario_cnpj})</span>}
                      </p>
                    )}
                    {nf.chave_acesso && (
                      <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                        Chave: {nf.chave_acesso}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {nf.data_emissao && <span>{new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</span>}
                      <span className="font-medium text-foreground">{fmt(nf.valor_total)}</span>
                      {nf.natureza_operacao && <span>{nf.natureza_operacao}</span>}
                      {nf.cfop && <Badge variant="outline" className="text-xs">CFOP {nf.cfop}</Badge>}
                    </div>
                    {nf.motivo_rejeicao && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {nf.motivo_rejeicao}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      <Eye className="w-3 h-3 mr-0.5" /> Somente leitura
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
