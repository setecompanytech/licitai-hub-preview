import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  baixa: { label: 'Baixa', color: 'bg-muted text-muted-foreground', icon: Clock },
  media: { label: 'Média', color: 'bg-blue-500/15 text-blue-600', icon: Clock },
  alta: { label: 'Alta', color: 'bg-amber-500/15 text-amber-600', icon: AlertTriangle },
  urgente: { label: 'Urgente', color: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-muted text-muted-foreground' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-500/15 text-blue-600' },
  concluida: { label: 'Concluída', color: 'bg-emerald-500/15 text-emerald-600' },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/15 text-destructive' },
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
      supabase.from('empresa_membros').select('id, user_id, nome, email, papel').eq('empresa_id', empresaId),
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
    return m?.nome || m?.email || 'Desconhecido';
  };

  const filtered = filtroStatus === 'todas' ? tarefas : tarefas.filter(t => t.status === filtroStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['todas', 'pendente', 'em_andamento', 'concluida'].map(s => (
            <Button key={s} variant={filtroStatus === s ? 'default' : 'outline'} size="sm"
              onClick={() => setFiltroStatus(s)} className="text-xs">
              {s === 'todas' ? 'Todas' : STATUS_CONFIG[s]?.label}
              {s !== 'todas' && <Badge variant="secondary" className="ml-1.5 text-xs">
                {tarefas.filter(t => t.status === s).length}
              </Badge>}
            </Button>
          ))}
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="bg-card rounded-lg border border-border/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">{cfg.label}</p>
            <p className="text-xl font-bold text-foreground">{tarefas.filter(t => t.status === key).length}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-6">Carregando tarefas...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
        </div>
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
              <div key={t.id} className={`bg-card rounded-lg border ${vencida ? 'border-destructive/50' : 'border-border/50'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {subs.length > 0 && (
                          <button onClick={() => toggleExpand(t.id)} className="text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        )}
                        <span className="font-semibold text-sm">{t.titulo}</span>
                        <Badge className={`text-xs ${prio.color}`}>{prio.label}</Badge>
                        <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                        {t.licitacao_id && <Badge variant="outline" className="text-xs"><Link2 className="w-3 h-3 mr-1" />Licitação</Badge>}
                        {vencida && <Badge className="text-xs bg-destructive/15 text-destructive">Vencida</Badge>}
                        {subs.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <ListPlus className="w-3 h-3 mr-1" />{subsCompleted}/{subs.length}
                          </Badge>
                        )}
                      </div>
                      {t.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{t.descricao}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>→ {getMembroNome(t.atribuido_a)}</span>
                        {t.prazo && <span>Prazo: {new Date(t.prazo).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {t.status !== 'concluida' && (
                        <Select value={t.status} onValueChange={v => handleUpdateStatus(t.id, v)}>
                          <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(t.id)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-tarefas section */}
                {(isExpanded || subs.length === 0) && canManage && (
                  <div className="border-t border-border/30 px-4 py-3 bg-muted/20">
                    {subs.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2 py-1.5 group">
                        <button
                          onClick={() => handleToggleSubTarefa(sub.id, sub.status)}
                          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                            sub.status === 'concluida'
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-muted-foreground/40 hover:border-accent'
                          }`}
                        >
                          {sub.status === 'concluida' && <CheckCircle2 className="w-3 h-3" />}
                        </button>
                        <span className={`text-xs flex-1 ${sub.status === 'concluida' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {sub.titulo}
                        </span>
                        <span className="text-xs text-muted-foreground">{getMembroNome(sub.criado_por)}</span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive/60"
                          onClick={() => handleDeleteSubTarefa(sub.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {/* Add new sub-tarefa inline */}
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={newSubTarefa[t.id] || ''}
                        onChange={e => setNewSubTarefa(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Nova sub-tarefa..."
                        className="h-7 text-xs flex-1"
                        onKeyDown={e => e.key === 'Enter' && handleAddSubTarefa(t.id)}
                      />
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-xs text-accent"
                        onClick={() => handleAddSubTarefa(t.id)}
                        disabled={!newSubTarefa[t.id]?.trim()}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show expand hint when collapsed with subs */}
                {!isExpanded && subs.length > 0 && (
                  <button
                    onClick={() => toggleExpand(t.id)}
                    className="w-full border-t border-border/30 px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors text-left"
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
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Preparar documentação do edital" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Atribuir a *</Label>
                <Select value={atribuidoA} onValueChange={setAtribuidoA}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {membros.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.email || 'Colaborador'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
              </div>
              <div>
                <Label>Vincular Licitação</Label>
                <Select value={licitacaoId} onValueChange={setLicitacaoId}>
                  <SelectTrigger><SelectValue placeholder="(Opcional)" /></SelectTrigger>
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
            <Button onClick={handleCreate} disabled={saving || !titulo.trim() || !atribuidoA} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {saving ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
