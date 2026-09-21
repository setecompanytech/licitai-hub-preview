import { useState, useEffect, useMemo } from 'react';
import { nomeExibido, iniciaisDe, type MembroExibivel } from '@/lib/equipe/nomeExibido';
import { Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { useMembroPermissoes, MODULOS_SISTEMA, type Setor } from '@/hooks/useMembroPermissoes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Shield, ShieldAlert, Users, Save, RotateCcw,
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
      .select('id,user_id,empresa_id,papel,equipe,permissoes,nome,email,nome_individual,login_individual')
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
        {/* Espera na forma da tela — título, descrição e o primeiro cartão —
            em vez de um texto centralizado no vazio. */}
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Verificando permissões…</span>
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return <Navigate to="/equipe" replace />;
  }

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-6">
        <CabecalhoPagina
          className="mb-0"
          icone={<Shield />}
          titulo="Papéis e permissões"
          descricao={`Papel, setor e módulos de cada membro de ${empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'sua empresa'}`}
          trilha={[
            { rotulo: 'Painel', para: '/dashboard' },
            { rotulo: 'Configuração' },
            { rotulo: 'Equipe', para: '/equipe' },
            { rotulo: 'Papéis e permissões' },
          ]}
          acoes={
            <>
              <Button
                variant="outline"
                onClick={handleResetAll}
                disabled={saving || dirtyIds.length === 0}
              >
                <RotateCcw aria-hidden="true" />
                Descartar
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={saving || dirtyIds.length === 0}
              >
                <Save aria-hidden="true" />
                Salvar {dirtyIds.length > 0 && `(${dirtyIds.length})`}
              </Button>
            </>
          }
        />

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
          <Alert variant="warning">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Existe apenas <strong>1 administrador</strong> na empresa. Recomenda-se manter pelo menos 2 para redundância.
            </AlertDescription>
          </Alert>
        )}

        {/* Filtro na barra padrão das telas de lista: o select com o rótulo em
            cima; a contagem fica ancorada à direita. */}
        <BarraFiltros
          acao={
            <Badge variant="muted" className="gap-1">
              <Users className="h-3 w-3" aria-hidden="true" /> {filteredMembros.length} membro(s)
            </Badge>
          }
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="filtro-setor" className="text-xs text-muted-foreground">Filtrar por setor:</Label>
            <Select value={filterSetor} onValueChange={setFilterSetor}>
              <SelectTrigger id="filtro-setor" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {EQUIPES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </BarraFiltros>

        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista">Editor por Membro</TabsTrigger>
            <TabsTrigger value="matriz">Matriz Consolidada</TabsTrigger>
          </TabsList>

          {/* TAB: Editor detalhado por membro */}
          <TabsContent value="lista" className="space-y-3">
            {loading ? (
              /* Esqueleto na forma dos cartões de membro, não texto no centro. */
              <div role="status" aria-busy="true" className="space-y-3">
                <span className="sr-only">Carregando…</span>
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMembros.length === 0 ? (
              <section className="rounded-lg border border-border bg-card shadow-sm">
                <EstadoVazio
                  icone={<Users />}
                  titulo="Nenhum membro neste filtro"
                  descricao="Troque o setor selecionado para ver outros membros da equipe."
                  acao={
                    <Button variant="outline" onClick={() => setFilterSetor('todos')}>
                      Ver todos os setores
                    </Button>
                  }
                />
              </section>
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
                    className={cn(
                      'rounded-lg border bg-card p-5 shadow-sm transition-colors duration-150',
                      isDirty ? 'border-warning-line bg-warning-tint' : 'border-border',
                    )}
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Avatar de 32px em ladrilho: iniciais sobre a tinta navy clara. */}
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy-tint text-xs font-semibold text-navy"
                        >
                          {iniciaisDe(m as MembroExibivel)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-base font-medium text-foreground">{nomeExibido(m as MembroExibivel)}</span>
                            {isMe && <Badge variant="info">Você</Badge>}
                            {isDirty && <Badge variant="warning">Alterado</Badge>}
                          </div>
                          {m.email && <p className="truncate text-sm text-muted-foreground">{m.email}</p>}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={() => applySetorDefaults(m.id)}
                      >
                        <CheckCircle2 aria-hidden="true" />
                        Aplicar padrão do setor
                      </Button>
                    </div>

                    {/* Papel + Setor — rótulo acima de campos de 40px. */}
                    <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`papel-${m.id}`}>
                          Papel
                        </Label>
                        <Select value={d.papel} onValueChange={(v) => updateDraft(m.id, { papel: v })}>
                          <SelectTrigger id={`papel-${m.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAPEIS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`setor-${m.id}`}>
                          Setor / Equipe
                        </Label>
                        <Select
                          value={d.equipe}
                          onValueChange={(v) => updateDraft(m.id, { equipe: v as Setor })}
                        >
                          <SelectTrigger id={`setor-${m.id}`}>
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

                    {/* Permissões granulares — grupo com título 16/600. */}
                    <div>
                      <h3 className="text-lg font-semibold leading-6 text-foreground">
                        Permissões de módulos ({d.permissoes.length}/{MODULOS_SISTEMA.length})
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {MODULOS_SISTEMA.map((mod) => {
                          const checked = d.permissoes.includes(mod.value);
                          const recomendado = mod.setores.includes(d.equipe);
                          return (
                            <label
                              key={mod.value}
                              className={cn(
                                'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors duration-150',
                                checked
                                  ? 'border-primary bg-primary-tint'
                                  : recomendado
                                  ? 'border-dashed border-primary hover:bg-muted'
                                  : 'border-input hover:bg-muted',
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePermissao(m.id, mod.value)}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-foreground">{mod.label}</div>
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {mod.setores.join(', ')}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {moduloMismatch.length > 0 && (
                        <p className="mt-2 flex items-center gap-1 text-sm text-warning-ink">
                          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {moduloMismatch.length} módulo(s) fora do escopo do setor "{d.equipe}".
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* TAB: Matriz consolidada — `ui/table`: cabeçalho em superfície
              rebaixada, rótulos 12/600, caixas centradas; a coluna do membro
              fica fixa à esquerda enquanto os módulos rolam dentro da moldura. */}
          <TabsContent value="matriz">
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-secondary">Membro</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Papel</TableHead>
                    {MODULOS_SISTEMA.map((mod) => (
                      <TableHead key={mod.value} className="text-center">
                        {mod.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembros.map((m) => {
                    const d = drafts[m.id];
                    if (!d) return null;
                    return (
                      <TableRow key={m.id}>
                        <TableCell nowrap className="sticky left-0 z-10 bg-card font-medium">
                          {nomeExibido(m as MembroExibivel)}
                        </TableCell>
                        <TableCell nowrap>
                          <Badge variant="muted">{EQUIPES.find((e) => e.value === d.equipe)?.label ?? d.equipe}</Badge>
                        </TableCell>
                        <TableCell nowrap>
                          <Badge variant="muted">{PAPEIS.find((p) => p.value === d.papel)?.label ?? d.papel}</Badge>
                        </TableCell>
                        {MODULOS_SISTEMA.map((mod) => {
                          const checked = d.permissoes.includes(mod.value);
                          return (
                            <TableCell key={mod.value} className="text-center">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePermissao(m.id, mod.value)}
                                aria-label={`${mod.label} para ${nomeExibido(m as MembroExibivel)}`}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Marque/desmarque diretamente na matriz. As alterações ficam pendentes até clicar em "Salvar".
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
