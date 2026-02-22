import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Building2, Check, X, Clock, Search, Eye, MessageCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

type Assinatura = {
  id: string;
  empresa_id: string;
  plano_id: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  valor_pago: number | null;
  forma_pagamento: string;
  observacoes: string | null;
  created_at: string;
  empresa?: { razao_social: string; cnpj: string };
  plano?: { nome: string; preco_mensal: number };
};

type TicketAdmin = {
  id: string;
  user_id: string;
  assunto: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  status: string;
  resposta: string | null;
  created_at: string;
};

const statusAssinatura: Record<string, { label: string; color: string }> = {
  ativa: { label: 'Ativa', color: 'bg-success/10 text-success' },
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
  expirada: { label: 'Expirada', color: 'bg-muted text-muted-foreground' },
};

export default function AdminFinanceiro() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [tickets, setTickets] = useState<TicketAdmin[]>([]);
  const [search, setSearch] = useState('');
  const [resposta, setResposta] = useState('');
  const [ticketSelecionado, setTicketSelecionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) { fetchAll(); }
  }, [isAdmin]);

  async function fetchAll() {
    setLoading(true);
    const [aRes, tRes] = await Promise.all([
      supabase.from('assinaturas').select('*, empresas(razao_social, cnpj), planos(nome, preco_mensal)').order('created_at', { ascending: false }),
      supabase.from('tickets_suporte').select('*').order('created_at', { ascending: false }),
    ]);
    if (aRes.data) {
      setAssinaturas(aRes.data.map((a: any) => ({ ...a, empresa: a.empresas, plano: a.planos })));
    }
    if (tRes.data) setTickets(tRes.data);
    setLoading(false);
  }

  async function updateAssinaturaStatus(id: string, status: string) {
    const updates: any = { status };
    if (status === 'ativa') {
      updates.data_inicio = new Date().toISOString();
      updates.liberado_por = user?.id;
    }
    const { error } = await supabase.from('assinaturas').update(updates).eq('id', id);
    if (error) toast.error('Erro ao atualizar'); else { toast.success(`Assinatura ${status === 'ativa' ? 'liberada' : 'atualizada'}!`); fetchAll(); }
  }

  async function responderTicket(id: string) {
    if (!resposta.trim()) return;
    const { error } = await supabase.from('tickets_suporte').update({
      resposta, respondido_por: user?.id, respondido_em: new Date().toISOString(), status: 'resolvido',
    }).eq('id', id);
    if (error) toast.error('Erro ao responder'); else { toast.success('Ticket respondido!'); setResposta(''); setTicketSelecionado(null); fetchAll(); }
  }

  if (roleLoading) return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div></AppLayout>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filteredAssinaturas = assinaturas.filter(a =>
    !search || a.empresa?.razao_social.toLowerCase().includes(search.toLowerCase()) || a.empresa?.cnpj.includes(search)
  );

  const ticketsAbertos = tickets.filter(t => t.status === 'aberto').length;

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Gerenciador Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie assinaturas, pagamentos e tickets de suporte</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Assinaturas Ativas', value: assinaturas.filter(a => a.status === 'ativa').length, icon: Check, color: 'text-success' },
            { label: 'Pendentes', value: assinaturas.filter(a => a.status === 'pendente').length, icon: Clock, color: 'text-warning' },
            { label: 'Receita Mensal', value: `R$ ${assinaturas.filter(a => a.status === 'ativa').reduce((sum, a) => sum + (a.plano?.preco_mensal || 0), 0).toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-accent' },
            { label: 'Tickets Abertos', value: ticketsAbertos, icon: MessageCircle, color: ticketsAbertos > 0 ? 'text-destructive' : 'text-muted-foreground' },
          ].map(k => (
            <div key={k.label} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <p className="text-2xl font-bold">{k.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="assinaturas" className="space-y-6">
          <TabsList>
            <TabsTrigger value="assinaturas"><DollarSign className="w-4 h-4 mr-1.5" /> Assinaturas</TabsTrigger>
            <TabsTrigger value="tickets">
              <MessageCircle className="w-4 h-4 mr-1.5" /> Tickets
              {ticketsAbertos > 0 && <Badge className="ml-2 bg-destructive text-destructive-foreground text-[10px] px-1.5">{ticketsAbertos}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assinaturas">
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por razão social ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
              </div>
            </div>

            {filteredAssinaturas.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma assinatura encontrada.</p>
              </div>
            )}

            <div className="space-y-3">
              {filteredAssinaturas.map(a => {
                const sc = statusAssinatura[a.status] || statusAssinatura.pendente;
                return (
                  <div key={a.id} className="bg-card rounded-xl border border-border/50 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{a.empresa?.razao_social || 'Empresa'}</h3>
                          <Badge className={sc.color}>{sc.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">CNPJ: {a.empresa?.cnpj} • Plano: {a.plano?.nome} • R$ {a.plano?.preco_mensal}/mês</p>
                        {a.data_inicio && <p className="text-xs text-muted-foreground mt-1">Início: {new Date(a.data_inicio).toLocaleDateString('pt-BR')}</p>}
                      </div>
                      <div className="flex gap-2">
                        {a.status === 'pendente' && (
                          <>
                            <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => updateAssinaturaStatus(a.id, 'ativa')}>
                              <Check className="w-4 h-4 mr-1" /> Liberar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => updateAssinaturaStatus(a.id, 'cancelada')}>
                              <X className="w-4 h-4 mr-1" /> Recusar
                            </Button>
                          </>
                        )}
                        {a.status === 'ativa' && (
                          <Button size="sm" variant="outline" onClick={() => updateAssinaturaStatus(a.id, 'cancelada')}>
                            Cancelar
                          </Button>
                        )}
                        {a.status === 'cancelada' && (
                          <Button size="sm" variant="outline" onClick={() => updateAssinaturaStatus(a.id, 'ativa')}>
                            Reativar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <div className="space-y-3">
              {tickets.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum ticket recebido.</p>
                </div>
              )}
              {tickets.map(t => (
                <div key={t.id} className="bg-card rounded-xl border border-border/50 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{t.assunto}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{t.categoria} • {t.prioridade} • {new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Badge className={t.status === 'aberto' ? 'bg-warning/10 text-warning' : t.status === 'resolvido' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {t.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{t.descricao}</p>

                  {t.resposta && (
                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/10 mb-3">
                      <p className="text-xs font-semibold text-accent mb-1">Sua Resposta</p>
                      <p className="text-sm">{t.resposta}</p>
                    </div>
                  )}

                  {t.status === 'aberto' && (
                    <>
                      {ticketSelecionado === t.id ? (
                        <div className="space-y-2">
                          <Textarea placeholder="Escreva sua resposta..." value={resposta} onChange={e => setResposta(e.target.value)} rows={3} />
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => responderTicket(t.id)}>Enviar Resposta</Button>
                            <Button size="sm" variant="outline" onClick={() => { setTicketSelecionado(null); setResposta(''); }}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setTicketSelecionado(t.id)}>
                          <MessageCircle className="w-4 h-4 mr-1" /> Responder
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
