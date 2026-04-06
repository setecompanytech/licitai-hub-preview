import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, UserPlus, Trash2, Shield, Scale, Calculator, Settings, Search, FileText, Download, ClipboardList, DollarSign, Truck, ShoppingCart, Briefcase } from 'lucide-react';
import RelatorioAtividades from '@/components/equipe/RelatorioAtividades';
import TarefasColaborador from '@/components/equipe/TarefasColaborador';
import ComissoesColaborador from '@/components/equipe/ComissoesColaborador';
import { MODULOS_SISTEMA } from '@/hooks/useMembroPermissoes';

const EQUIPES = [
  { value: 'geral', label: 'Geral', icon: Settings, color: 'bg-muted text-muted-foreground' },
  { value: 'financeiro', label: 'Financeiro', icon: DollarSign, color: 'bg-green-500/15 text-green-600' },
  { value: 'comercial', label: 'Comercial', icon: Briefcase, color: 'bg-blue-500/15 text-blue-600' },
  { value: 'logistica', label: 'Logística', icon: Truck, color: 'bg-orange-500/15 text-orange-600' },
  { value: 'juridico', label: 'Jurídico', icon: Scale, color: 'bg-indigo-500/15 text-indigo-600' },
  { value: 'contabil', label: 'Contábil', icon: Calculator, color: 'bg-emerald-500/15 text-emerald-600' },
  { value: 'licitacoes', label: 'Licitações', icon: Search, color: 'bg-amber-500/15 text-amber-600' },
  { value: 'documentos', label: 'Documentos', icon: FileText, color: 'bg-purple-500/15 text-purple-600' },
];

const PAPEIS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operador', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
];

type Membro = {
  id: string;
  user_id: string;
  empresa_id: string;
  papel: string;
  equipe: string;
  nome: string | null;
  email: string | null;
  created_at: string;
};

export default function EquipeColaboradores() {
  const { user } = useAuth();
  const { empresaAtiva, empresas } = useEmpresa();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNome, setInviteNome] = useState('');
  const [invitePapel, setInvitePapel] = useState('operador');
  const [inviteEquipes, setInviteEquipes] = useState<string[]>(['geral']);
  const [saving, setSaving] = useState(false);
  const [permDialog, setPermDialog] = useState<Membro | null>(null);
  const [permissoesSel, setPermissoesSel] = useState<string[]>([]);

  const currentMembro = empresas.find(e => e.empresa_id === empresaAtiva?.id);
  const isAdmin = currentMembro?.papel === 'admin';

  useEffect(() => {
    if (!empresaAtiva) { setMembros([]); setLoading(false); return; }
    loadMembros();
  }, [empresaAtiva]);

  const loadMembros = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data } = await supabase
      .from('empresa_membros')
      .select('*')
      .eq('empresa_id', empresaAtiva.id);
    setMembros((data as any[]) || []);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!empresaAtiva || !user || !inviteEmail.trim() || inviteEquipes.length === 0) return;
    setSaving(true);

    const userId = crypto.randomUUID();
    let hasError = false;

    for (const equipe of inviteEquipes) {
      const { error } = await supabase.from('empresa_membros').insert({
        empresa_id: empresaAtiva.id,
        user_id: userId,
        papel: invitePapel as any,
        equipe,
        nome: inviteNome || inviteEmail,
        email: inviteEmail,
      } as any);
      if (error) {
        toast.error(`Erro ao adicionar na equipe ${equipe}: ${error.message}`);
        hasError = true;
      }
    }

    if (!hasError) {
      const labels = inviteEquipes.map(e => EQUIPES.find(eq => eq.value === e)?.label).join(', ');
      toast.success(`Colaborador ${inviteNome || inviteEmail} adicionado às equipes: ${labels}`);
      setShowInvite(false);
      setInviteEmail('');
      setInviteNome('');
      setInvitePapel('operador');
      setInviteEquipes(['geral']);
      loadMembros();
    }
    setSaving(false);
  };

  const handleRemove = async (membroId: string, nome: string) => {
    if (!confirm(`Remover "${nome}" da equipe?`)) return;
    const { error } = await supabase.from('empresa_membros').delete().eq('id', membroId);
    if (error) {
      toast.error('Erro ao remover colaborador');
    } else {
      toast.success('Colaborador removido');
      loadMembros();
    }
  };

  const handleUpdateEquipe = async (membroId: string, equipe: string) => {
    const { error } = await supabase.from('empresa_membros').update({ equipe } as any).eq('id', membroId);
    if (error) {
      toast.error('Erro ao atualizar equipe');
    } else {
      toast.success('Equipe atualizada');
      loadMembros();
    }
  };

  const handleUpdatePapel = async (membroId: string, papel: string) => {
    const { error } = await supabase.from('empresa_membros').update({ papel } as any).eq('id', membroId);
    if (error) {
      toast.error('Erro ao atualizar papel');
    } else {
      toast.success('Papel atualizado');
      loadMembros();
    }
  };

  const openPermDialog = (m: Membro) => {
    setPermDialog(m);
    setPermissoesSel(Array.isArray((m as any).permissoes) ? (m as any).permissoes : []);
  };

  const handleSavePermissoes = async () => {
    if (!permDialog) return;
    const { error } = await supabase.from('empresa_membros').update({ permissoes: permissoesSel } as any).eq('id', permDialog.id);
    if (error) {
      toast.error('Erro ao atualizar permissões');
    } else {
      toast.success('Permissões atualizadas');
      setPermDialog(null);
      loadMembros();
    }
  };

  const getEquipeInfo = (equipe: string) => EQUIPES.find(e => e.value === equipe) || EQUIPES[0];

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Equipe & Colaboradores</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
              Gerencie os membros da equipe de {empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'sua empresa'}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowInvite(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground self-start sm:self-auto flex-shrink-0">
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Colaborador
            </Button>
          )}
        </div>

        {!empresaAtiva ? (
          <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Selecione uma empresa no cabeçalho para gerenciar a equipe.</p>
          </div>
        ) : (
          <Tabs defaultValue="membros">
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="membros">
                <Users className="w-4 h-4 mr-1.5" />
                Membros ({membros.length})
              </TabsTrigger>
              <TabsTrigger value="tarefas">
                <ClipboardList className="w-4 h-4 mr-1.5" />
                Tarefas
              </TabsTrigger>
              <TabsTrigger value="comissoes">
                <DollarSign className="w-4 h-4 mr-1.5" />
                Comissões
              </TabsTrigger>
              <TabsTrigger value="relatorio">
                <FileText className="w-4 h-4 mr-1.5" />
                Relatório
              </TabsTrigger>
            </TabsList>

            <TabsContent value="membros">
              {/* Equipe summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                {EQUIPES.map(eq => {
                  const count = membros.filter(m => (m as any).equipe === eq.value || (!((m as any).equipe) && eq.value === 'geral')).length;
                  return (
                    <div key={eq.value} className="bg-card rounded-lg border border-border/50 p-3 text-center">
                      <eq.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-semibold">{eq.label}</p>
                      <p className="text-lg font-bold text-accent">{count}</p>
                    </div>
                  );
                })}
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : membros.length === 0 ? (
                <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold mb-1">Nenhum colaborador</p>
                  <p className="text-sm text-muted-foreground">Adicione membros à equipe para começar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {membros.map((m) => {
                    const eq = getEquipeInfo((m as any).equipe || 'geral');
                    const isCurrentUser = m.user_id === user?.id;
                    return (
                      <div key={m.id} className="bg-card rounded-lg border border-border/50 p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
                            {((m as any).nome || (m as any).email || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate">{(m as any).nome || (m as any).email || 'Colaborador'}</span>
                              {isCurrentUser && <Badge variant="outline" className="text-[10px]">Você</Badge>}
                              <Badge className={`text-[10px] ${eq.color}`}>{eq.label}</Badge>
                              <Badge variant="secondary" className="text-[10px]">{m.papel}</Badge>
                            </div>
                            {(m as any).email && <p className="text-xs text-muted-foreground truncate">{(m as any).email}</p>}
                          </div>
                        </div>
                        {isAdmin && !isCurrentUser && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Select value={(m as any).equipe || 'geral'} onValueChange={(v) => handleUpdateEquipe(m.id, v)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EQUIPES.map(eq => (
                                  <SelectItem key={eq.value} value={eq.value}>{eq.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={m.papel} onValueChange={(v) => handleUpdatePapel(m.id, v)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAPEIS.map(p => (
                                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openPermDialog(m)} title="Gerenciar Permissões">
                              <Shield className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive h-8 w-8" onClick={() => handleRemove(m.id, (m as any).nome || 'Colaborador')}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="tarefas">
              <TarefasColaborador empresaId={empresaAtiva.id} isAdmin={isAdmin} />
            </TabsContent>

            <TabsContent value="comissoes">
              <ComissoesColaborador empresaId={empresaAtiva.id} isAdmin={isAdmin} />
            </TabsContent>

            <TabsContent value="relatorio">
              <RelatorioAtividades empresaId={empresaAtiva.id} />
            </TabsContent>
          </Tabs>
        )}

        {/* Invite Dialog */}
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-accent" />
                Adicionar Colaborador
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome completo</Label>
                <Input value={inviteNome} onChange={e => setInviteNome(e.target.value)} placeholder="Nome do colaborador" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@empresa.com" type="email" />
              </div>
              <div>
                <Label>Equipes / Departamentos</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {EQUIPES.map(eq => {
                    const checked = inviteEquipes.includes(eq.value);
                    return (
                      <label
                        key={eq.value}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                          checked ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setInviteEquipes(prev =>
                              checked ? prev.filter(v => v !== eq.value) : [...prev, eq.value]
                            );
                          }}
                          className="accent-[hsl(var(--accent))]"
                        />
                        <eq.icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{eq.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Selecione uma ou mais equipes. Define a área de responsabilidade: alimentar IA Jurídica, Contábil, etc.
                </p>
              </div>
              <div>
                <Label>Papel / Permissão</Label>
                <Select value={invitePapel} onValueChange={setInvitePapel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
              <Button onClick={handleInvite} disabled={saving || !inviteEmail.trim() || inviteEquipes.length === 0} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {saving ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={!!permDialog} onOpenChange={(v) => !v && setPermDialog(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                Permissões de {(permDialog as any)?.nome || 'Colaborador'}
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mb-2">
              Setor: <Badge className={`text-[10px] ${getEquipeInfo((permDialog as any)?.equipe || 'geral').color}`}>
                {getEquipeInfo((permDialog as any)?.equipe || 'geral').label}
              </Badge>
              — Os módulos padrão do setor são habilitados automaticamente. Selecione módulos adicionais abaixo:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MODULOS_SISTEMA.map(mod => {
                const isDefault = mod.setores.includes((permDialog as any)?.equipe || 'geral');
                const checked = permissoesSel.includes(mod.value) || isDefault;
                return (
                  <label
                    key={mod.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm ${
                      checked ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'
                    } ${isDefault ? 'opacity-80' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isDefault}
                      onChange={() => {
                        if (isDefault) return;
                        setPermissoesSel(prev =>
                          prev.includes(mod.value)
                            ? prev.filter(v => v !== mod.value)
                            : [...prev, mod.value]
                        );
                      }}
                      className="accent-[hsl(var(--accent))]"
                    />
                    <span className="text-xs">{mod.label}</span>
                    {isDefault && <Badge variant="outline" className="text-[8px] ml-auto">Padrão</Badge>}
                  </label>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermDialog(null)}>Cancelar</Button>
              <Button onClick={handleSavePermissoes} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Salvar Permissões
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
