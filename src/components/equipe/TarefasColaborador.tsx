import { useState, useEffect } from 'react';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle2, Clock, AlertTriangle, X, Link2, ChevronDown, ChevronRight, ListPlus } from 'lucide-react';

type SubTarefa = {
  id: string;
  tarefa_id: string;
  criado_por: string;
  titulo: string;
  status: string;
  created_at: string;
  concluida_em: string | null;
};

type Tarefa = {
  id: string;
  empresa_id: string;
  atribuido_a: string;
  criado_por: string;
  licitacao_id: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  status: string;
  prazo: string | null;
  concluida_em: string | null;
  created_at: string;
};

type Membro = {
  id: string;
  user_id: string;
  nome: string | null;
  email: string | null;
  papel: string;
};

type Licitacao = {
  id: string;
  numero: string;
  objeto: string;
};

type Variante = BadgeProps['variant'];

const PRIORIDADE_CONFIG: Record<string, { label: string; variante: Variante; icon: any }> = {
  baixa: { label: 'Baixa', variante: 'muted', icon: Clock },
  media: { label: 'Média', variante: 'info', icon: Clock },
  alta: { label: 'Alta', variante: 'warning', icon: AlertTriangle },
  urgente: { label: 'Urgente', variante: 'danger', icon: AlertTriangle },
};

const STATUS_CONFIG: Record<string, { label: string; variante: Variante }> = {
  pendente: { label: 'Pendente', variante: 'muted' },
  em_andamento: { label: 'Em andamento', variante: 'info' },
  concluida: { label: 'Concluída', variante: 'success' },
  cancelada: { label: 'Cancelada', variante: 'danger' },
};

export default function TarefasColaborador({ empresaId, isAdmin }: { empresaId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [subTarefas, setSubTarefas] = useState<SubTarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [expandedTarefas, setExpandedTarefas] = useState<Set<string>>(new Set());
  const [newSubTarefa, setNewSubTarefa] = useState<Record<string, string>>({});

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [atribuidoA, setAtribuidoA] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [prazo, setPrazo] = useState('');
  const [licitacaoId, setLicitacaoId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [empresaId]);

  const loadData = async () => {
    setLoading(true);
    const [tarefasRes, membrosRes, licitacoesRes] = await Promise.all([
      supabase.from('tarefas_colaborador' as any).select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase.from('empresa_membros').select('id, user_id, nome, email, papel, nome_individual, login_individual').eq('empresa_id', empresaId),
      supabase.from('licitacoes').select('id, numero, objeto').limit(50).order('created_at', { ascending: false }),
    ]);
    const tarefasList = (tarefasRes.data as any[]) || [];
    setTarefas(tarefasList);
    setMembros((membrosRes.data as any[]) || []);
    setLicitacoes((licitacoesRes.data as any[]) || []);

    // Load sub-tarefas for all tarefas
    if (tarefasList.length > 0) {
      const ids = tarefasList.map((t: any) => t.id);
      const { data: subs } = await supabase.from('sub_tarefas' as any).select('*').in('tarefa_id', ids).order('created_at', { ascending: true });
      setSubTarefas((subs as any[]) || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!titulo.trim() || !atribuidoA || !user) return;
    setSaving(true);
    const { error } = await supabase.from('tarefas_colaborador' as any).insert({
      empresa_id: empresaId,
      atribuido_a: atribuidoA,
      criado_por: user.id,
      titulo,
      descricao: descricao || null,
      prioridade,
      prazo: prazo || null,
      licitacao_id: licitacaoId || null,
    } as any);
    if (error) {
      toast.error('Erro ao criar tarefa: ' + error.message);
    } else {
      toast.success('Tarefa criada com sucesso');
      setShowDialog(false);
      resetForm();
      loadData();
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (tarefaId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === 'concluida') updates.concluida_em = new Date().toISOString();
    const { error } = await supabase.from('tarefas_colaborador' as any).update(updates).eq('id', tarefaId);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success('Status atualizado');
      loadData();
    }
  };

  const handleDelete = async (tarefaId: string) => {
    if (!confirm('Remover esta tarefa?')) return;
    const { error } = await supabase.from('tarefas_colaborador' as any).delete().eq('id', tarefaId);
    if (error) toast.error('Erro ao remover');
    else { toast.success('Tarefa removida'); loadData(); }
  };

  // Sub-tarefa handlers
  const handleAddSubTarefa = async (tarefaId: string) => {
    const titulo = newSubTarefa[tarefaId]?.trim();
    if (!titulo || !user) return;
    const { error } = await supabase.from('sub_tarefas' as any).insert({
      tarefa_id: tarefaId,
      criado_por: user.id,
      titulo,
    } as any);
    if (error) {
      toast.error('Erro ao criar sub-tarefa');
    } else {
      toast.success('Sub-tarefa adicionada');
      setNewSubTarefa(prev => ({ ...prev, [tarefaId]: '' }));
      loadData();
    }
  };

  const handleToggleSubTarefa = async (subId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
    const updates: any = { status: newStatus };
    if (newStatus === 'concluida') updates.concluida_em = new Date().toISOString();
    else updates.concluida_em = null;
    await supabase.from('sub_tarefas' as any).update(updates).eq('id', subId);
    loadData();
  };

  const handleDeleteSubTarefa = async (subId: string) => {
    await supabase.from('sub_tarefas' as any).delete().eq('id', subId);
    loadData();
  };

  const toggleExpand = (tarefaId: string) => {
    setExpandedTarefas(prev => {
      const next = new Set(prev);
      if (next.has(tarefaId)) next.delete(tarefaId);
      else next.add(tarefaId);
      return next;
    });
  };

  const resetForm = () => {
    setTitulo(''); setDescricao(''); setAtribuidoA(''); setPrioridade('media'); setPrazo(''); setLicitacaoId('');
  };

  const getMembroNome = (userId: string) => {
    const m = membros.find(m => m.user_id === userId);
    return nomeExibido(m as never);
  };

  const filtered = filtroStatus === 'todas' ? tarefas : tarefas.filter(t => t.status === filtroStatus);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {['todas', 'pendente', 'em_andamento', 'concluida'].map(s => (
            <Button key={s} variant={filtroStatus === s ? 'default' : 'outline'} size="sm"
              onClick={() => setFiltroStatus(s)} aria-pressed={filtroStatus === s}>
              {s === 'todas' ? 'Todas' : STATUS_CONFIG[s]?.label}
              {s !== 'todas' && <Badge variant="muted" className="ml-1.5">
                {tarefas.filter(t => t.status === s).length}
              </Badge>}
            </Button>
          ))}
        </div>
        {isAdmin && (
          <Button onClick={() => setShowDialog(true)}>
            <Plus aria-hidden="true" /> Nova tarefa
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">{cfg.label}</p>
            <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{tarefas.filter(t => t.status === key).length}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="py-6 text-center text-base text-muted-foreground">Carregando tarefas...</p>
      ) : filtered.length === 0 ? (
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <EstadoVazio
            icone={<CheckCircle2 />}
            titulo="Nenhuma tarefa encontrada"
            descricao={filtroStatus === 'todas'
              ? 'Crie a primeira tarefa para distribuir o trabalho da equipe.'
              : 'Nenhuma tarefa neste status. Escolha outro filtro para ver as demais.'}
            acao={isAdmin && filtroStatus === 'todas' ? (
              <Button onClick={() => setShowDialog(true)}>
                <Plus aria-hidden="true" /> Nova tarefa
              </Button>
            ) : undefined}
          />
        </section>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const prio = PRIORIDADE_CONFIG[t.prioridade] || PRIORIDADE_CONFIG.media;
            const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.pendente;
            const vencida = t.prazo && new Date(t.prazo) < new Date() && !['concluida', 'cancelada'].includes(t.status);
            const subs = subTarefas.filter(s => s.tarefa_id === t.id);
            const isExpanded = expandedTarefas.has(t.id);
            const subsCompleted = subs.filter(s => s.status === 'concluida').length;
            const canManage = user?.id === t.atribuido_a || user?.id === t.criado_por || isAdmin;

            return (
              <div key={t.id} className={cn('rounded-lg border bg-card shadow-sm', vencida ? 'border-destructive-line' : 'border-border')}>
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {subs.length > 0 && (
                          <button
                            onClick={() => toggleExpand(t.id)}
                            className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Recolher sub-tarefas' : 'Expandir sub-tarefas'}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        )}
                        <span className="text-base font-semibold text-foreground">{t.titulo}</span>
                        <Badge variant={prio.variante}>{prio.label}</Badge>
                        <Badge variant={st.variante}>{st.label}</Badge>
                        {t.licitacao_id && <Badge variant="muted" className="gap-1"><Link2 className="h-3 w-3" aria-hidden="true" />Licitação</Badge>}
                        {vencida && <Badge variant="danger">Vencida</Badge>}
                        {subs.length > 0 && (
                          <Badge variant="muted" className="gap-1">
                            <ListPlus className="h-3 w-3" aria-hidden="true" />{subsCompleted}/{subs.length}
                          </Badge>
                        )}
                      </div>
                      {t.descricao && <p className="line-clamp-2 text-sm text-muted-foreground">{t.descricao}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>→ {getMembroNome(t.atribuido_a)}</span>
                        {t.prazo && <span>Prazo: {new Date(t.prazo).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      {t.status !== 'concluida' && (
                        <Select value={t.status} onValueChange={v => handleUpdateStatus(t.id, v)}>
                          <SelectTrigger className="h-9 w-[150px] text-sm" aria-label={`Status da tarefa ${t.titulo}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)} title="Remover tarefa" aria-label="Remover tarefa">
                          <X aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-tarefas section */}
                {(isExpanded || subs.length === 0) && canManage && (
                  <div className="border-t border-border bg-muted px-4 py-3">
                    {subs.map(sub => (
                      <div key={sub.id} className="group flex items-center gap-2 py-1.5">
                        <button
                          onClick={() => handleToggleSubTarefa(sub.id, sub.status)}
                          aria-pressed={sub.status === 'concluida'}
                          aria-label={sub.status === 'concluida' ? `Reabrir ${sub.titulo}` : `Concluir ${sub.titulo}`}
                          className={cn(
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            sub.status === 'concluida'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary',
                          )}
                        >
                          {sub.status === 'concluida' && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                        </button>
                        <span className={cn('flex-1 text-sm', sub.status === 'concluida' ? 'text-muted-foreground line-through' : 'text-foreground')}>
                          {sub.titulo}
                        </span>
                        <span className="text-xs text-muted-foreground">{getMembroNome(sub.criado_por)}</span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteSubTarefa(sub.id)}
                          title="Remover sub-tarefa"
                          aria-label={`Remover sub-tarefa ${sub.titulo}`}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                    {/* Add new sub-tarefa inline */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        value={newSubTarefa[t.id] || ''}
                        onChange={e => setNewSubTarefa(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Nova sub-tarefa..."
                        className="h-9 min-w-[200px] flex-1 text-sm"
                        aria-label={`Nova sub-tarefa em ${t.titulo}`}
                        onKeyDown={e => e.key === 'Enter' && handleAddSubTarefa(t.id)}
                      />
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleAddSubTarefa(t.id)}
                        disabled={!newSubTarefa[t.id]?.trim()}
                      >
                        <Plus aria-hidden="true" /> Adicionar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show expand hint when collapsed with subs */}
                {!isExpanded && subs.length > 0 && (
                  <button
                    onClick={() => toggleExpand(t.id)}
                    aria-expanded={false}
                    className="w-full border-t border-border px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {subs.length} sub-tarefa(s) • {subsCompleted} concluída(s)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="tarefa-titulo">Título *</Label>
              <Input id="tarefa-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Preparar documentação do edital" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tarefa-descricao">Descrição</Label>
              <Textarea id="tarefa-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tarefa-atribuido">Atribuir a *</Label>
                <Select value={atribuidoA} onValueChange={setAtribuidoA}>
                  <SelectTrigger id="tarefa-atribuido" className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {membros.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{nomeExibido(m as never)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tarefa-prioridade">Prioridade</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger id="tarefa-prioridade" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tarefa-prazo">Prazo</Label>
                <Input id="tarefa-prazo" type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="tarefa-licitacao">Vincular licitação</Label>
                <Select value={licitacaoId} onValueChange={setLicitacaoId}>
                  <SelectTrigger id="tarefa-licitacao" className="mt-1"><SelectValue placeholder="(Opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {licitacoes.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.numero} - {l.objeto?.slice(0, 40)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !titulo.trim() || !atribuidoA}>
              {saving ? 'Criando...' : 'Criar tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
