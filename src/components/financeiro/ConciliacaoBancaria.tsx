import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Upload, RefreshCw, Loader2, CheckCircle2, XCircle, Link2, Search,
  FileText, DollarSign, ArrowUpCircle, ArrowDownCircle, AlertTriangle
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Transacao = {
  id: string; data_transacao: string; descricao: string; valor: number;
  tipo: string; categoria: string | null; documento: string | null;
  historico: string | null; conciliado: boolean; conciliado_com_tipo: string | null;
  conciliado_com_id: string | null; origem: string; conta_bancaria_id: string;
};

type ContaBancaria = { id: string; banco_nome: string; agencia: string | null; conta: string | null };

// Simple OFX parser
function parseOFX(text: string): Array<{ data: string; descricao: string; valor: number; tipo: string; documento: string }> {
  const transactions: any[] = [];
  const stmtTrns = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
  
  for (const trn of stmtTrns) {
    const getVal = (tag: string) => {
      const m = trn.match(new RegExp(`<${tag}>([^<\\n]+)`));
      return m ? m[1].trim() : '';
    };
    const valor = parseFloat(getVal('TRNAMT')) || 0;
    const dtPosted = getVal('DTPOSTED');
    const data = dtPosted.length >= 8 ? `${dtPosted.slice(0, 4)}-${dtPosted.slice(4, 6)}-${dtPosted.slice(6, 8)}` : '';
    
    transactions.push({
      data,
      descricao: getVal('MEMO') || getVal('NAME') || 'Sem descrição',
      valor: Math.abs(valor),
      tipo: valor >= 0 ? 'credito' : 'debito',
      documento: getVal('CHECKNUM') || getVal('FITID') || '',
    });
  }
  return transactions;
}

// Simple CSV parser (banco inter, nubank, etc.)
function parseCSV(text: string): Array<{ data: string; descricao: string; valor: number; tipo: string; documento: string }> {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const transactions: any[] = [];
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,]/).map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;
    
    // Try to find date, description, value columns
    let data = '', descricao = '', valor = 0;
    for (const col of cols) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(col)) {
        const [d, m, y] = col.split('/');
        data = `${y}-${m}-${d}`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(col)) {
        data = col;
      } else if (/^-?[\d.,]+$/.test(col.replace(/\s/g, ''))) {
        const num = parseFloat(col.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(num)) valor = num;
      } else if (col.length > 3 && !descricao) {
        descricao = col;
      }
    }
    
    if (data && descricao) {
      transactions.push({
        data, descricao,
        valor: Math.abs(valor),
        tipo: valor >= 0 ? 'credito' : 'debito',
        documento: '',
      });
    }
  }
  return transactions;
}

export default function ConciliacaoBancaria() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'conciliadas'>('pendentes');
  const [conciliandoId, setConciliandoId] = useState<string | null>(null);
  const [matchDialog, setMatchDialog] = useState(false);
  const [matchTransacao, setMatchTransacao] = useState<Transacao | null>(null);
  const [nfs, setNfs] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user && empresaAtiva) loadContas(); }, [user, empresaAtiva]);

  const loadContas = async () => {
    const { data } = await supabase.from('contas_bancarias')
      .select('id, banco_nome, agencia, conta')
      .eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).eq('ativo', true);
    setContas((data as any[]) || []);
    if (data && data.length > 0 && !contaSelecionada) {
      setContaSelecionada(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { if (contaSelecionada) loadTransacoes(); }, [contaSelecionada]);

  const loadTransacoes = async () => {
    setLoading(true);
    const { data } = await supabase.from('transacoes_bancarias')
      .select('*').eq('conta_bancaria_id', contaSelecionada)
      .order('data_transacao', { ascending: false });
    setTransacoes((data as any[]) || []);
    setLoading(false);
  };

  // Import OFX/CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      let parsed: any[] = [];
      
      if (file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.ofc')) {
        parsed = parseOFX(text);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        parsed = parseCSV(text);
      } else {
        toast.error('Formato não suportado. Use OFX ou CSV.');
        setUploading(false);
        return;
      }

      if (parsed.length === 0) {
        toast.error('Nenhuma transação encontrada no arquivo');
        setUploading(false);
        return;
      }

      // Create hash to avoid duplicates
      const inserts = parsed.map(t => ({
        user_id: user!.id,
        conta_bancaria_id: contaSelecionada,
        data_transacao: t.data,
        descricao: t.descricao,
        valor: t.tipo === 'debito' ? -t.valor : t.valor,
        tipo: t.tipo,
        documento: t.documento || null,
        historico: t.descricao,
        origem: file.name.endsWith('.ofx') ? 'ofx' : 'csv',
        hash_transacao: `${t.data}_${t.descricao}_${t.valor}_${t.documento}`.replace(/\s/g, ''),
      }));

      // Filter out existing hashes
      const hashes = inserts.map(i => i.hash_transacao);
      const { data: existing } = await supabase.from('transacoes_bancarias')
        .select('hash_transacao').eq('conta_bancaria_id', contaSelecionada)
        .in('hash_transacao', hashes);
      
      const existingHashes = new Set((existing || []).map((e: any) => e.hash_transacao));
      const newInserts = inserts.filter(i => !existingHashes.has(i.hash_transacao));

      if (newInserts.length === 0) {
        toast.info('Todas as transações já foram importadas anteriormente.');
        setUploading(false);
        return;
      }

      const { error } = await supabase.from('transacoes_bancarias').insert(newInserts as any);
      if (error) throw error;

      toast.success(`${newInserts.length} transações importadas! (${inserts.length - newInserts.length} duplicadas ignoradas)`);
      loadTransacoes();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open conciliation match dialog
  const openMatch = async (transacao: Transacao) => {
    setMatchTransacao(transacao);
    setConciliandoId(transacao.id);

    // Load NFs and pedidos for matching
    const [nfRes, pedidoRes] = await Promise.all([
      supabase.from('notas_fiscais')
        .select('id, numero_nf, valor_total, destinatario_razao_social, data_emissao, status')
        .eq('user_id', user!.id).eq('status', 'autorizada')
        .order('data_emissao', { ascending: false }).limit(50),
      supabase.from('contrato_pedidos')
        .select('id, numero_pedido, valor_total, descricao, data_pedido, status')
        .eq('user_id', user!.id)
        .order('data_pedido', { ascending: false }).limit(50),
    ]);
    setNfs((nfRes.data as any[]) || []);
    setPedidos((pedidoRes.data as any[]) || []);
    setMatchDialog(true);
  };

  const handleConciliar = async (tipo: string, id: string) => {
    if (!matchTransacao) return;
    const { error } = await supabase.from('transacoes_bancarias').update({
      conciliado: true,
      conciliado_em: new Date().toISOString(),
      conciliado_com_tipo: tipo,
      conciliado_com_id: id,
      conciliado_por: user!.id,
    } as any).eq('id', matchTransacao.id);

    if (error) { toast.error('Erro ao conciliar'); return; }
    toast.success('Transação conciliada!');
    setMatchDialog(false);
    setMatchTransacao(null);
    loadTransacoes();
  };

  const handleConciliarManual = async () => {
    if (!matchTransacao) return;
    const { error } = await supabase.from('transacoes_bancarias').update({
      conciliado: true,
      conciliado_em: new Date().toISOString(),
      conciliado_com_tipo: 'manual',
      conciliado_por: user!.id,
    } as any).eq('id', matchTransacao.id);

    if (error) { toast.error('Erro ao conciliar'); return; }
    toast.success('Conciliação manual registrada!');
    setMatchDialog(false);
    loadTransacoes();
  };

  const handleDesconciliar = async (id: string) => {
    await supabase.from('transacoes_bancarias').update({
      conciliado: false, conciliado_em: null, conciliado_com_tipo: null,
      conciliado_com_id: null, conciliado_por: null,
    } as any).eq('id', id);
    toast.success('Desconciliado');
    loadTransacoes();
  };

  const filtered = transacoes.filter(t => {
    if (filtro === 'pendentes') return !t.conciliado;
    if (filtro === 'conciliadas') return t.conciliado;
    return true;
  });

  const totalCreditos = transacoes.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0);
  const totalDebitos = transacoes.filter(t => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0);
  const pendentes = transacoes.filter(t => !t.conciliado).length;
  const conciliadas = transacoes.filter(t => t.conciliado).length;

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> Créditos</div><p className="text-lg font-bold text-success">{fmt(totalCreditos)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" /> Débitos</div><p className="text-lg font-bold text-destructive">{fmt(totalDebitos)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pendentes</div><p className="text-lg font-bold text-warning">{pendentes}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Conciliadas</div><p className="text-lg font-bold text-success">{conciliadas}</p></Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
          <SelectContent>
            {contas.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.banco_nome} {c.agencia && `| Ag: ${c.agencia}`} {c.conta && `| Cc: ${c.conta}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtro} onValueChange={v => setFiltro(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="conciliadas">Conciliadas</SelectItem>
          </SelectContent>
        </Select>

        <input ref={fileInputRef} type="file" accept=".ofx,.ofc,.csv" onChange={handleFileUpload} className="hidden" />
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || !contaSelecionada}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
          Importar Extrato
        </Button>
      </div>

      {contas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Cadastre uma conta bancária primeiro na aba "Contas Bancárias".
        </Card>
      ) : loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <RefreshCw className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          {filtro === 'pendentes' ? 'Todas as transações estão conciliadas!' : 'Nenhuma transação encontrada. Importe um extrato OFX ou CSV.'}
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-10">Status</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Origem</TableHead>
                <TableHead className="text-xs w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => (
                <TableRow key={t.id} className={t.conciliado ? 'opacity-60' : ''}>
                  <TableCell>
                    {t.conciliado ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-warning" />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-center">{new Date(t.data_transacao + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-xs max-w-[250px] truncate">
                    {t.descricao}
                    {t.conciliado_com_tipo && (
                      <Badge variant="outline" className="text-[9px] ml-1">
                        <Link2 className="w-2.5 h-2.5 mr-0.5" />
                        {t.conciliado_com_tipo === 'nota_fiscal' ? 'NF' : t.conciliado_com_tipo === 'pedido' ? 'Pedido' : 'Manual'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={`text-xs text-right font-medium ${t.valor >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {t.valor >= 0 ? '+' : ''}{fmt(t.valor)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px]">{t.origem === 'ofx' ? 'OFX' : t.origem === 'csv' ? 'CSV' : 'Manual'}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.conciliado ? (
                      <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => handleDesconciliar(t.id)}>
                        Desconciliar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => openMatch(t)}>
                        <Link2 className="w-3 h-3 mr-1" /> Conciliar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Match Dialog */}
      <Dialog open={matchDialog} onOpenChange={setMatchDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" /> Conciliar Transação
            </DialogTitle>
          </DialogHeader>
          {matchTransacao && (
            <div className="space-y-4 mt-2">
              <Card className="p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">Transação selecionada:</p>
                <p className="text-sm font-medium">{matchTransacao.descricao}</p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span>{new Date(matchTransacao.data_transacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  <span className={`font-bold ${matchTransacao.valor >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {fmt(matchTransacao.valor)}
                  </span>
                </div>
              </Card>

              <Tabs defaultValue="nfs">
                <TabsList className="w-full">
                  <TabsTrigger value="nfs" className="flex-1 text-xs"><FileText className="w-3 h-3 mr-1" /> Notas Fiscais</TabsTrigger>
                  <TabsTrigger value="pedidos" className="flex-1 text-xs"><DollarSign className="w-3 h-3 mr-1" /> Pedidos</TabsTrigger>
                </TabsList>

                <TabsContent value="nfs" className="mt-3">
                  {nfs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma NF autorizada encontrada</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {nfs.map(nf => (
                        <Card key={nf.id} className="p-2 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleConciliar('nota_fiscal', nf.id)}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium">NF-e {nf.numero_nf || '(sem número)'}</p>
                              <p className="text-[10px] text-muted-foreground">{nf.destinatario_razao_social}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold">{fmt(nf.valor_total)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString('pt-BR') : ''}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pedidos" className="mt-3">
                  {pedidos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum pedido encontrado</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {pedidos.map(p => (
                        <Card key={p.id} className="p-2 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleConciliar('pedido', p.id)}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium">{p.numero_pedido}</p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.descricao}</p>
                            </div>
                            <p className="text-xs font-bold">{fmt(p.valor_total)}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-between pt-2 border-t">
                <Button variant="outline" size="sm" onClick={handleConciliarManual}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Conciliar Manualmente
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMatchDialog(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
