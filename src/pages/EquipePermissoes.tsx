import { useState, useEffect, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { useMembroPermissoes, MODULOS_SISTEMA, type Setor } from '@/hooks/useMembroPermissoes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Shield, ShieldAlert, Users, Save, RotateCcw, ChevronLeft,
  AlertTriangle, CheckCircle2, Settings, DollarSign, Briefcase,
  Truck, Scale, Calculator, Search, FileText,
} from 'lucide-react';

const EQUIPES: { value: Setor; label: string; icon: any }[] = [
  { value: 'geral', label: 'Geral', icon: Settings },
  { value: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { value: 'comercial', label: 'Comercial', icon: Briefcase },
  { value: 'logistica', label: 'Logística', icon: Truck },
  { value: 'juridico', label: 'Jurídico', icon: Scale },
  { value: 'contabil', label: 'Contábil', icon: Calculator },
  { value: 'licitacoes', label: 'Licitações', icon: Search },
  { value: 'documentos', label: 'Documentos', icon: FileText },
];

const PAPEIS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operador', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
];

type Membro = {
  id: string;
  user_id: string;
  empresa_id: string;
  papel: string;
  equipe: string | null;
  permissoes: string[] | null;
  nome: string | null;
  email: string | null;
};

type Draft = {
  papel: string;
  equipe: Setor;
  permissoes: string[];
};

export default function EquipePermissoes() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isAdmin: isGlobalAdmin, isEmpresaAdmin, loading: permLoading } = useMembroPermissoes();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterSetor, setFilterSetor] = useState<string>('todos');

  const canManage = isGlobalAdmin || isEmpresaAdmin;

  useEffect(() => {
    if (!empresaAtiva) return;
    loadMembros();
  }, [empresaAtiva?.id]);

  const loadMembros = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('empresa_membros')
      .select('id,user_id,empresa_id,papel,equipe,permissoes,nome,email')
      .eq('empresa_id', empresaAtiva.id)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar membros');
      setLoading(false);
      return;
    }
    const list = (data as any[]) || [];
    setMembros(list);
    const d: Record<string, Draft> = {};
    list.forEach((m) => {
      d[m.id] = {
        papel: m.papel || 'operador',
        equipe: (m.equipe || 'geral') as Setor,
        permissoes: Array.isArray(m.permissoes) ? m.permissoes : [],
      };
    });
    setDrafts(d);
    setLoading(false);
  };

  const adminCount = useMemo(
    () => Object.values(drafts).filter((d) => d.papel === 'admin').length,
    [drafts],
  );

  const dirtyIds = useMemo(() => {
    return membros
      .filter((m) => {
        const d = drafts[m.id];
        if (!d) return false;
        const orig = {
          papel: m.papel || 'operador',
          equipe: (m.equipe || 'geral') as Setor,
          permissoes: Array.isArray(m.permissoes) ? [...m.permissoes].sort() : [],
        };
        const draftSorted = [...d.permissoes].sort();
        return (
          d.papel !== orig.papel ||
          d.equipe !== orig.equipe ||
          JSON.stringify(draftSorted) !== JSON.stringify(orig.permissoes)
        );
      })
      .map((m) => m.id);
  }, [membros, drafts]);

  const filteredMembros = useMemo(() => {
    if (filterSetor === 'todos') return membros;
    return membros.filter((m) => (drafts[m.id]?.equipe || 'geral') === filterSetor);
  }, [membros, drafts, filterSetor]);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const togglePermissao = (id: string, modulo: string) => {
    setDrafts((prev) => {
      const cur = prev[id];
      const has = cur.permissoes.includes(modulo);
      return {
        ...prev,
        [id]: {
          ...cur,
          permissoes: has ? cur.permissoes.filter((p) => p !== modulo) : [...cur.permissoes, modulo],
        },
      };
    });
  };

  const validateChanges = (): { ok: boolean; reason?: string } => {
    // Regra 1: pelo menos 1 admin por empresa
    if (adminCount === 0) return { ok: false, reason: 'A empresa precisa ter pelo menos 1 administrador.' };
    // Regra 2: não pode rebaixar a si próprio se for o último admin
    if (user) {
      const meu = membros.find((m) => m.user_id === user.id);
      if (meu) {
        const dMe = drafts[meu.id];
        if (meu.papel === 'admin' && dMe?.papel !== 'admin' && adminCount === 0) {
          return { ok: false, reason: 'Você não pode rebaixar a si mesmo sendo o último admin.' };
        }
      }
    }
    return { ok: true };
  };

  const handleSaveAll = async () => {
    const v = validateChanges();
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    if (dirtyIds.length === 0) {
      toast.info('Nenhuma alteração para salvar.');
      return;
    }
    setSaving(true);
    let okCount = 0;
    let failCount = 0;
    for (const id of dirtyIds) {
      const d = drafts[id];
      const { error } = await supabase
        .from('empresa_membros')
        .update({ papel: d.papel, equipe: d.equipe, permissoes: d.permissoes } as any)
        .eq('id', id);
      if (error) failCount++;
      else okCount++;
    }
    setSaving(false);
    if (failCount === 0) toast.success(`${okCount} membro(s) atualizado(s).`);
    else toast.error(`${okCount} salvo(s), ${failCount} falha(s).`);
    loadMembros();
  };

  const handleResetAll = () => {
    const d: Record<string, Draft> = {};
    membros.forEach((m) => {
      d[m.id] = {
        papel: m.papel || 'operador',
        equipe: (m.equipe || 'geral') as Setor,
        permissoes: Array.isArray(m.permissoes) ? m.permissoes : [],
      };
    });
    setDrafts(d);
    toast.info('Alterações descartadas.');
  };

  // Aplicar permissões padrão do setor a um membro
  const applySetorDefaults = (id: string) => {
    const setor = drafts[id]?.equipe || 'geral';
    const padrao = MODULOS_SISTEMA.filter((m) => m.setores.includes(setor)).map((m) => m.value);
    updateDraft(id, { permissoes: padrao });
    toast.success(`Permissões padrão do setor "${setor}" aplicadas.`);
  };

  if (permLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Verificando permissões…</div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return <Navigate to="/equipe" replace />;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link to="/equipe" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ChevronLeft className="w-3 h-3" /> Voltar para Equipe
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              Administração de Papéis & Permissões
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
              Empresa: {empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              disabled={saving || dirtyIds.length === 0}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={saving || dirtyIds.length === 0}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Save className="w-4 h-4 mr-1.5" />
              Salvar {dirtyIds.length > 0 && `(${dirtyIds.length})`}
            </Button>
          </div>
        </div>

        {/* Validation banner */}
        {adminCount === 0 && (
          <Alert variant="destructive">
            <ShieldAlert className="w-4 h-4" />
            <AlertDescription>
              <strong>Atenção:</strong> a empresa ficaria sem administradores. Defina ao menos 1 admin antes de salvar.
            </AlertDescription>
          </Alert>
        )}
        {adminCount === 1 && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Existe apenas <strong>1 administrador</strong> na empresa. Recomenda-se manter pelo menos 2 para redundância.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Filtrar por setor:</span>
          <Select value={filterSetor} onValueChange={setFilterSetor}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {EQUIPES.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[11px] ml-auto">
            <Users className="w-3 h-3 mr-1" /> {filteredMembros.length} membro(s)
          </Badge>
        </div>

        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista">Editor por Membro</TabsTrigger>
            <TabsTrigger value="matriz">Matriz Consolidada</TabsTrigger>
          </TabsList>

          {/* TAB: Editor detalhado por membro */}
          <TabsContent value="lista" className="space-y-3 mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando…</div>
            ) : filteredMembros.length === 0 ? (
              <div className="bg-card rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
                Nenhum membro neste filtro.
              </div>
            ) : (
              filteredMembros.map((m) => {
                const d = drafts[m.id];
                if (!d) return null;
                const isMe = m.user_id === user?.id;
                const isDirty = dirtyIds.includes(m.id);
                const moduloMismatch = d.permissoes.filter((p) => {
                  const mod = MODULOS_SISTEMA.find((x) => x.value === p);
                  return mod && !mod.setores.includes(d.equipe);
                });
                return (
                  <div
                    key={m.id}
                    className={`bg-card rounded-lg border p-4 transition-colors ${
                      isDirty ? 'border-accent/60 bg-accent/5' : 'border-border/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs flex-shrink-0">
                          {(m.nome || m.email || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{m.nome || m.email || 'Colaborador'}</span>
                            {isMe && <Badge variant="outline" className="text-[10px]">Você</Badge>}
                            {isDirty && <Badge className="text-[10px] bg-accent text-accent-foreground">Alterado</Badge>}
                          </div>
                          {m.email && <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs flex-shrink-0"
                        onClick={() => applySetorDefaults(m.id)}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Aplicar padrão do setor
                      </Button>
                    </div>

                    {/* Papel + Setor */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                          Papel
                        </label>
                        <Select value={d.papel} onValueChange={(v) => updateDraft(m.id, { papel: v })}>
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAPEIS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                          Setor / Equipe
                        </label>
                        <Select
                          value={d.equipe}
                          onValueChange={(v) => updateDraft(m.id, { equipe: v as Setor })}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EQUIPES.map((e) => (
                              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Permissões granulares */}
                    <div>
                      <label className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                        Permissões de Módulos ({d.permissoes.length}/{MODULOS_SISTEMA.length})
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {MODULOS_SISTEMA.map((mod) => {
                          const checked = d.permissoes.includes(mod.value);
                          const recomendado = mod.setores.includes(d.equipe);
                          return (
                            <label
                              key={mod.value}
                              className={`flex items-start gap-2 rounded border px-2.5 py-2 cursor-pointer transition-colors ${
                                checked
                                  ? 'border-accent bg-accent/10'
                                  : recomendado
                                  ? 'border-dashed border-accent/40 hover:bg-muted/30'
                                  : 'border-border hover:bg-muted/30'
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePermissao(m.id, mod.value)}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium leading-tight">{mod.label}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  {mod.setores.join(', ')}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {moduloMismatch.length > 0 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {moduloMismatch.length} módulo(s) fora do escopo do setor "{d.equipe}".
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* TAB: Matriz consolidada */}
          <TabsContent value="matriz" className="mt-4">
            <div className="bg-card rounded-lg border border-border/50 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border/50">
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-muted/40 whitespace-nowrap">Membro</th>
                    <th className="text-left p-2 whitespace-nowrap">Setor</th>
                    <th className="text-left p-2 whitespace-nowrap">Papel</th>
                    {MODULOS_SISTEMA.map((mod) => (
                      <th key={mod.value} className="text-center p-2 whitespace-nowrap">
                        {mod.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembros.map((m) => {
                    const d = drafts[m.id];
                    if (!d) return null;
                    return (
                      <tr key={m.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="p-2 sticky left-0 bg-card whitespace-nowrap font-medium">
                          {m.nome || m.email || '—'}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px]">{d.equipe}</Badge>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <Badge variant="secondary" className="text-[10px]">{d.papel}</Badge>
                        </td>
                        {MODULOS_SISTEMA.map((mod) => {
                          const checked = d.permissoes.includes(mod.value);
                          return (
                            <td key={mod.value} className="text-center p-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePermissao(m.id, mod.value)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Marque/desmarque diretamente na matriz. As alterações ficam pendentes até clicar em "Salvar".
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
