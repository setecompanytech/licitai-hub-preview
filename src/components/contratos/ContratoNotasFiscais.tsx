import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  Loader2, FileText, CheckCircle2, XCircle, Clock, Send,
  Building2, AlertTriangle, DollarSign
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type NotaFiscal = {
  id: string; tipo: string; numero_nf: string | null;
  chave_acesso: string | null; data_emissao: string | null;
  valor_total: number; status: string;
  destinatario_razao_social: string | null; destinatario_cnpj: string | null;
  natureza_operacao: string | null;
};

const statusCfg: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Clock },
  enviada: { label: 'Enviada', color: 'bg-accent/10 text-accent', icon: Send },
  autorizada: { label: 'Autorizada', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  registrada: { label: 'Registrada', color: 'bg-accent/10 text-accent', icon: CheckCircle2 },
};

/**
 * Componente read-only que lista as NFs vinculadas a um contrato.
 * A emissão e gestão de NFs é feita pelo setor Financeiro (menu Financeiro > NF Saída / NF Entrada).
 */
export default function ContratoNotasFiscais({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    loadNotas();
  }, [user, contratoId]);

  const loadNotas = async () => {
    setLoading(true);
    const { data } = await supabase.from('notas_fiscais')
      .select('id, tipo, numero_nf, chave_acesso, data_emissao, valor_total, status, destinatario_razao_social, destinatario_cnpj, natureza_operacao')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: false });
    setNotas((data as any[]) || []);
    setLoading(false);
  };

  const filteredNotas = statusFilter === 'all' ? notas : notas.filter(n => n.status === statusFilter);
  const totalAutorizado = notas.filter(n => n.status === 'autorizada').reduce((s, n) => s + n.valor_total, 0);

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <Card className="p-3 border-accent/20 bg-accent/5">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-accent" />
          A emissão e controle de notas fiscais é gerenciada pelo setor <strong className="text-foreground">Financeiro</strong>.
          Acesse o menu <strong className="text-foreground">Financeiro → NF Saída</strong> para emitir novas NFs vinculadas a este contrato.
        </p>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Total NFs</div><p className="text-lg font-bold">{notas.length}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Autorizadas</div><p className="text-lg font-bold text-success">{fmt(totalAutorizado)}</p></Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pendentes</div>
          <p className="text-lg font-bold text-warning">{notas.filter(n => ['rascunho', 'enviada'].includes(n.status)).length}</p>
        </Card>
      </div>

      {/* Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="rascunho">Rascunho</SelectItem>
          <SelectItem value="autorizada">Autorizada</SelectItem>
          <SelectItem value="rejeitada">Rejeitada</SelectItem>
        </SelectContent>
      </Select>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filteredNotas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          Nenhuma nota fiscal vinculada a este contrato
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Número</TableHead>
                <TableHead className="text-xs">Destinatário</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotas.map(nf => {
                const cfg = statusCfg[nf.status] || statusCfg.rascunho;
                const Icon = cfg.icon;
                return (
                  <TableRow key={nf.id}>
                    <TableCell><Badge className={`${cfg.color} text-[10px]`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge></TableCell>
                    <TableCell className="text-xs">{nf.tipo === 'nfse' ? 'NFS-e' : 'NF-e'}</TableCell>
                    <TableCell className="text-xs font-mono">{nf.numero_nf || '—'}</TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium truncate max-w-[150px]">{nf.destinatario_razao_social || '—'}</p>
                      {nf.destinatario_cnpj && <p className="text-[10px] text-muted-foreground">{nf.destinatario_cnpj}</p>}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(nf.valor_total)}</TableCell>
                    <TableCell className="text-xs text-center">{nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString('pt-BR') : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
