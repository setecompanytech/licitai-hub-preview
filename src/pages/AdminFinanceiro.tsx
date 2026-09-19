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
import { DollarSign, Building2, Check, X, Clock, Search, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Skeleton } from '@/components/ui/skeleton';

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

/* Selo suave por situação — o trio de cada estado, via variante do Badge. */
const statusAssinatura: Record<string, { label: string; variante: 'success' | 'warning' | 'danger' | 'muted' }> = {
  ativa: { label: 'Ativa', variante: 'success' },
  pendente: { label: 'Pendente', variante: 'warning' },
  cancelada: { label: 'Cancelada', variante: 'danger' },
  expirada: { label: 'Expirada', variante: 'muted' },
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

  if (roleLoading) {
    return (
      <AppLayout>
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Carregando...</span>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-28 w-full" />
        </div>
      </AppLayout>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const filteredAssinaturas = assinaturas.filter(a =>
    !search || a.empresa?.razao_social.toLowerCase().includes(search.toLowerCase()) || a.empresa?.cnpj.includes(search)
  );

  const ticketsAbertos = tickets.filter(t => t.status === 'aberto').length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl">
        <CabecalhoPagina rota="/admin/financeiro" descricao="Gerencie assinaturas, pagamentos e tickets de suporte" />

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 [&>*]:min-w-0">
          {[
            { label: 'Assinaturas Ativas', value: assinaturas.filter(a => a.status === 'ativa').length, icon: Check, tom: 'bg-success-tint text-success-ink' },
            { label: 'Pendentes', value: assinaturas.filter(a => a.status === 'pendente').length, icon: Clock, tom: 'bg-warning-tint text-warning-ink' },
            { label: 'Receita Mensal', value: `R$ ${assinaturas.filter(a => a.status === 'ativa').reduce((sum, a) => sum + (a.plano?.preco_mensal || 0), 0).toLocaleString('pt-BR')}`, icon: DollarSign, tom: 'bg-muted text-muted-foreground' },
            { label: 'Tickets Abertos', value: ticketsAbertos, icon: MessageCircle, tom: ticketsAbertos > 0 ? 'bg-destructive-tint text-destructive-ink' : 'bg-muted text-muted-foreground' },
          ].map(k => (
            <div key={k.label} className="flex min-h-[96px] flex-col justify-between gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium text-muted-foreground">{k.label}</span>
                <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${k.tom}`}>
                  <k.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="truncate text-2xl font-semibold leading-8 tabular-nums text-foreground">{k.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="assinaturas" className="space-y-6">
          <TabsList>
            <TabsTrigger value="assinaturas"><DollarSign className="h-4 w-4" aria-hidden="true" /> Assinaturas</TabsTrigger>
            <TabsTrigger value="tickets">
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Tickets
              {ticketsAbertos > 0 && <Badge variant="danger" className="ml-1 px-1.5">{ticketsAbertos}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assinaturas">
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input placeholder="Buscar por razão social ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            {filteredAssinaturas.length === 0 && (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <EstadoVazio tamanho="compacto" icone={<Building2 />} titulo="Nenhuma assinatura encontrada." />
              </div>
            )}

            <div className="space-y-3">
              {filteredAssinaturas.map(a => {
                const sc = statusAssinatura[a.status] || statusAssinatura.pendente;
                return (
                  <div key={a.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-semibold text-foreground">{a.empresa?.razao_social || 'Empresa'}</h3>
                          <Badge variant={sc.variante}>{sc.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">CNPJ: {a.empresa?.cnpj} • Plano: {a.plano?.nome} • R$ {a.plano?.preco_mensal}/mês</p>
                        {a.data_inicio && <p className="mt-1 text-xs text-muted-foreground">Início: {new Date(a.data_inicio).toLocaleDateString('pt-BR')}</p>}
                      </div>
                      <div className="flex gap-2">
                        {a.status === 'pendente' && (
                          <>
                            <Button size="sm" onClick={() => updateAssinaturaStatus(a.id, 'ativa')}>
                              <Check aria-hidden="true" /> Liberar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => updateAssinaturaStatus(a.id, 'cancelada')}>
                              <X aria-hidden="true" /> Recusar
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
                <div className="rounded-lg border border-border bg-card shadow-sm">
                  <EstadoVazio tamanho="compacto" icone={<MessageCircle />} titulo="Nenhum ticket recebido." />
                </div>
              )}
              {tickets.map(t => (
                <div key={t.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-foreground">{t.assunto}</h3>
                      <p className="text-xs capitalize text-muted-foreground">{t.categoria} • {t.prioridade} • {new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Badge variant={t.status === 'aberto' ? 'warning' : t.status === 'resolvido' ? 'success' : 'muted'}>
                      {t.status}
                    </Badge>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{t.descricao}</p>

                  {t.resposta && (
                    <div className="mb-3 rounded-md border border-border bg-muted p-3">
                      <p className="mb-1 text-xs font-semibold text-foreground">Sua Resposta</p>
                      <p className="text-sm">{t.resposta}</p>
                    </div>
                  )}

                  {t.status === 'aberto' && (
                    <>
                      {ticketSelecionado === t.id ? (
                        <div className="space-y-2">
                          <Textarea placeholder="Escreva sua resposta..." value={resposta} onChange={e => setResposta(e.target.value)} rows={3} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => responderTicket(t.id)}>Enviar Resposta</Button>
                            <Button size="sm" variant="outline" onClick={() => { setTicketSelecionado(null); setResposta(''); }}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setTicketSelecionado(t.id)}>
                          <MessageCircle aria-hidden="true" /> Responder
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
