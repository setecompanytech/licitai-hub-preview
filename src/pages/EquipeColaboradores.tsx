import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { nomeExibido, iniciaisDe, type MembroExibivel } from '@/lib/equipe/nomeExibido';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SkeletonTabela from '@/components/shared/SkeletonTabela';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, UserPlus, Trash2, Shield, Scale, Calculator, Settings, Search, FileText, DollarSign, Truck, Briefcase, Mail, Loader2, MapPin , Pencil } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import RelatorioAtividades from '@/components/equipe/RelatorioAtividades';
import TarefasColaborador from '@/components/equipe/TarefasColaborador';
import ComissoesColaborador from '@/components/equipe/ComissoesColaborador';
import ConvitesPendentes from '@/components/equipe/ConvitesPendentes';
import { MODULOS_SISTEMA, useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { useQueryClient } from '@tanstack/react-query';

const EQUIPES = [
  { value: 'geral', label: 'Geral', icon: Settings },
  { value: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { value: 'comercial', label: 'Comercial', icon: Briefcase },
  { value: 'logistica', label: 'Logística', icon: Truck },
  { value: 'juridico', label: 'Jurídico', icon: Scale },
  { value: 'contabil', label: 'Contábil', icon: Calculator },
  { value: 'licitacoes', label: 'Licitações', icon: Search },
  { value: 'documentos', label: 'Documentos', icon: FileText },
];

const PAPEIS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operador', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
];

/** 'nenhuma' é sentinela do Select (Radix não aceita value=""); vira NULL no banco. */
const UF_SEM_PRACA = 'nenhuma';
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

type Membro = {
  id: string;
  user_id: string;
  empresa_id: string;
  papel: string;
  equipe: string;
  nome: string | null;
  email: string | null;
  created_at: string;
  /** Praça do colaborador para o cálculo de dias úteis das metas. */
  praca_uf: string | null;
  praca_municipio: string | null;
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
  const [inviteMode, setInviteMode] = useState<'direto' | 'setor'>('direto');
  const [sectorEmail, setSectorEmail] = useState('');
  const [sectorEquipe, setSectorEquipe] = useState('financeiro');
  const [sectorPapel, setSectorPapel] = useState('operador');
  const [permDialog, setPermDialog] = useState<Membro | null>(null);
  const [permissoesSel, setPermissoesSel] = useState<string[]>([]);
  // Praça do colaborador (Fase 1 das metas por praça)
  const [pracaDialog, setPracaDialog] = useState<Membro | null>(null);
  const [pracaUf, setPracaUf] = useState<string>(UF_SEM_PRACA);
  const [pracaMunicipio, setPracaMunicipio] = useState('');
  const [salvandoPraca, setSalvandoPraca] = useState(false);

  const queryClient = useQueryClient();
  const currentMembro = empresas.find(e => e.empresa_id === empresaAtiva?.id);
  const { isAdmin: hasAdminAccess } = useMembroPermissoes();
  const isAdmin = hasAdminAccess || currentMembro?.papel === 'admin';

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

    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          email: inviteEmail.trim(),
          nome: inviteNome || inviteEmail.trim(),
          papel: invitePapel,
          equipe: inviteEquipes,
          permissoes: inviteEquipes,
          empresa_id: empresaAtiva.id,
        },
      });

      if (error) {
        let msg = error.message;
        try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
        toast.error(`Erro ao convidar colaborador: ${msg}`);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(data?.message || 'Colaborador convidado com sucesso!');
        setShowInvite(false);
        setInviteEmail('');
        setInviteNome('');
        setInvitePapel('operador');
        setInviteEquipes(['geral']);
        loadMembros();
      }
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    }
    setSaving(false);
  };

  const handleSectorInvite = async () => {
    if (!empresaAtiva || !sectorEmail.trim() || !sectorEquipe) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-sector-invite', {
        body: {
          empresa_id: empresaAtiva.id,
          equipe: sectorEquipe,
          papel: sectorPapel,
          email_setor: sectorEmail.trim(),
        },
      });
      if (error) {
        let msg = error.message;
        try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
        toast.error(msg);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        // O convite de setor é coletivo: quando já existe um link vigente, o
        // servidor reenvia esse mesmo link em vez de criar outro — a tela
        // precisa dizer isso, senão o admin acha que gerou um convite novo.
        if ((data as { reaproveitado?: boolean })?.reaproveitado) {
          toast.success(
            `Link do setor reenviado para ${sectorEmail.trim()} — é o mesmo para todos os colaboradores do setor.`,
            { duration: 8000 },
          );
        } else {
          toast.success(`Convite enviado para ${sectorEmail.trim()}`);
        }
        setShowInvite(false);
        setSectorEmail('');
        setSectorEquipe('financeiro');
        setSectorPapel('operador');
      }
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    }
    setSaving(false);
  };

  // Renomear: o nome vem do que a própria pessoa digitou no cadastro, e vinha
  // errado com frequência (duas contas do mesmo setor chamadas "COMERCIAL01").
  // Sem isto, o administrador não tinha como corrigir.
  const [renomeando, setRenomeando] = useState<{ id: string; atual: string } | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  const abrirRenomear = (m: { id: string } & MembroExibivel) => {
    setRenomeando({ id: m.id, atual: nomeExibido(m) });
    setNovoNome(m.nome_individual?.trim() || m.nome?.trim() || '');
  };

  const salvarNome = async () => {
    if (!renomeando || !novoNome.trim()) return;
    setSalvandoNome(true);
    const { error } = await supabase
      .from('empresa_membros')
      .update({ nome_individual: novoNome.trim() })
      .eq('id', renomeando.id);
    setSalvandoNome(false);
    if (error) { toast.error(`Não foi possível renomear: ${error.message}`); return; }
    toast.success('Nome atualizado.');
    setRenomeando(null);
    loadMembros();
  };

  const [resendingFor, setResendingFor] = useState<string | null>(null);

  /* REBRAND — busca e recorte por equipe, que o protótipo tem (`eqBusca` e
     `eqChips`) e a tela não tinha. Com cinco pessoas a lista se lê de cima a
     baixo; com trinta, procurar alguém é rolar a tela inteira lendo nome por
     nome. Os oito cartões de equipe já estavam ali contando gente — agora
     também FILTRAM, que é o que quem olha um número de contagem quer fazer em
     seguida. */
  const [busca, setBusca] = useState('');
  const [equipeFiltro, setEquipeFiltro] = useState<string | null>(null);

  // Sem acento e sem caixa, dos dois lados: quem digita "jose" acha "José".
  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const equipeDe = (m: Membro) => ((m as unknown as { equipe?: string }).equipe) || 'geral';

  const membrosFiltrados = membros.filter((m) => {
    if (equipeFiltro && equipeDe(m) !== equipeFiltro) return false;
    if (!busca.trim()) return true;
    const alvo = normalizar(
      [nomeExibido(m as MembroExibivel), (m as unknown as { email?: string }).email ?? '', equipeDe(m)].join(' '),
    );
    return normalizar(busca).split(/\s+/).filter(Boolean).every((termo) => alvo.includes(termo));
  });
  const handleResendInvite = async (email: string) => {
    if (!empresaAtiva || !email) return;
    setResendingFor(email);
    try {
      const { data, error } = await supabase.functions.invoke('resend-invite', {
        body: { email, empresa_id: empresaAtiva.id },
      });
      if (error) {
        let msg = error.message;
        try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
        toast.error(`Erro ao reenviar convite: ${msg}`);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(data?.message || `Convite reenviado para ${email}.`);
      }
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    } finally {
      setResendingFor(null);
    }
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

  const notifyPermissionChange = (membro: Membro, alteracoes: { campo: string; de: string; para: string }[]) => {
    if (!membro.email) return;
    const empresaNome = empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'sua empresa';
    supabase.functions.invoke('notify-permission-change', {
      body: { to_email: membro.email, to_nome: membro.nome, empresa_nome: empresaNome, alteracoes },
    }).catch(() => {});
  };

  const EQUIPE_LABELS: Record<string, string> = {
    geral: 'Geral', financeiro: 'Financeiro', comercial: 'Comercial',
    logistica: 'Logística', juridico: 'Jurídico', contabil: 'Contábil',
    licitacoes: 'Licitações', documentos: 'Documentos',
  };
  const PAPEL_LABELS: Record<string, string> = {
    admin: 'Administrador', gerente: 'Gerente', operador: 'Operador', viewer: 'Visualizador',
  };

  const handleUpdateEquipe = async (membroId: string, equipe: string) => {
    const membro = membros.find(m => m.id === membroId);
    const { error } = await supabase.from('empresa_membros').update({ equipe } as any).eq('id', membroId);
    if (error) {
      toast.error('Erro ao atualizar equipe');
    } else {
      toast.success('Equipe atualizada');
      if (membro) notifyPermissionChange(membro, [{
        campo: 'setor',
        de: EQUIPE_LABELS[membro.equipe] || membro.equipe,
        para: EQUIPE_LABELS[equipe] || equipe,
      }]);
      loadMembros();
    }
  };

  const handleUpdatePapel = async (membroId: string, papel: string) => {
    const membro = membros.find(m => m.id === membroId);
    const { error } = await supabase.from('empresa_membros').update({ papel } as any).eq('id', membroId);
    if (error) {
      toast.error('Erro ao atualizar papel');
    } else {
      toast.success('Papel atualizado');
      if (membro) notifyPermissionChange(membro, [{
        campo: 'papel',
        de: PAPEL_LABELS[membro.papel] || membro.papel,
        para: PAPEL_LABELS[papel] || papel,
      }]);
      loadMembros();
    }
  };

  const openPracaDialog = (m: Membro) => {
    setPracaDialog(m);
    setPracaUf(m.praca_uf || UF_SEM_PRACA);
    setPracaMunicipio(m.praca_municipio || '');
  };

  const savePraca = async () => {
    if (!pracaDialog) return;
    setSalvandoPraca(true);
    const uf = pracaUf === UF_SEM_PRACA ? null : pracaUf;
    // Município sem UF não tem efeito nenhum no filtro — limpa junto para o
    // registro não guardar um resto enganoso.
    const municipio = uf ? pracaMunicipio.trim() || null : null;
    const { error } = await supabase
      .from('empresa_membros')
      .update({ praca_uf: uf, praca_municipio: municipio })
      .eq('id', pracaDialog.id);
    setSalvandoPraca(false);
    if (error) {
      toast.error('Erro ao salvar a praça');
      return;
    }
    toast.success(uf ? `Praça definida: ${municipio ? `${municipio}/` : ''}${uf}` : 'Praça removida — só feriados nacionais');
    setMembros(prev => prev.map(x => x.id === pracaDialog.id ? { ...x, praca_uf: uf, praca_municipio: municipio } : x));
    // O PainelMetas lê a praça via react-query com staleTime de 2 minutos;
    // sem invalidar, o admin confere lá e vê a praça antiga — exatamente o
    // fluxo que o texto deste diálogo instrui a fazer.
    queryClient.invalidateQueries({ queryKey: ['comercial-colaboradores'] });
    setPracaDialog(null);
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
      notifyPermissionChange(permDialog, [{
        campo: 'permissoes',
        de: '',
        para: permissoesSel.length > 0 ? permissoesSel.join(', ') : 'Nenhuma',
      }]);
      setPermDialog(null);
      loadMembros();
    }
  };

  const getEquipeInfo = (equipe: string) => EQUIPES.find(e => e.value === equipe) || EQUIPES[0];

  return (
    <AppLayout>
      <div className="w-full min-w-0">
        <CabecalhoPagina
          acoes={isAdmin ? (
            <>
              <Button asChild variant="outline">
                <Link to="/equipe/permissoes">
                  <Shield aria-hidden="true" />
                  Papéis e permissões
                </Link>
              </Button>
              <Button onClick={() => setShowInvite(true)}>
                <UserPlus aria-hidden="true" />
                Convidar pessoa
              </Button>
            </>
          ) : undefined}
        />

        {!empresaAtiva ? (
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <EstadoVazio
              icone={<Users />}
              titulo="Nenhuma empresa selecionada"
              descricao="Selecione uma empresa no cabeçalho para gerenciar a equipe."
            />
          </section>
        ) : (
          <Tabs defaultValue="membros">
            {/* Fila de abas sublinhada do padrão, sem ícones — nenhuma outra
                tela de menu os tem na fila de abas. */}
            <TabsList className="mb-4">
              <TabsTrigger value="membros">
                Membros ({membros.length})
              </TabsTrigger>
              <TabsTrigger value="tarefas">
                Tarefas
              </TabsTrigger>
              <TabsTrigger value="comissoes">
                Bonificações
              </TabsTrigger>
              <TabsTrigger value="relatorio">
                Relatório
              </TabsTrigger>
            </TabsList>

            <TabsContent value="membros">
              {/* Convites ativos — sem isto, perder o e-mail do convite deixava
                  o admin preso: a criação bloqueia enquanto houver um válido. */}
              <div className="mb-6">
                <ConvitesPendentes />
              </div>

              {/* Contagem por setor — ladrilhos compactos que também filtram a
                  lista: rótulo com o ícone do setor em cima, número embaixo,
                  alinhados à esquerda como um cartão de sistema. */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {EQUIPES.map(eq => {
                  const count = membros.filter(m => equipeDe(m) === eq.value).length;
                  const ativo = equipeFiltro === eq.value;
                  return (
                    <button
                      key={eq.value}
                      type="button"
                      onClick={() => setEquipeFiltro(ativo ? null : eq.value)}
                      aria-pressed={ativo}
                      // Equipe sem ninguém não vira filtro: clicar levaria a uma
                      // lista vazia, e a pessoa acharia que quebrou.
                      disabled={count === 0}
                      className={cn(
                        'flex min-w-0 flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50',
                        ativo
                          ? 'border-primary bg-primary-tint ring-1 ring-primary/30'
                          : 'border-border enabled:hover:border-primary/40 enabled:hover:shadow-md',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <eq.icon className={cn('h-3.5 w-3.5 shrink-0', ativo ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                        <span className="truncate">{eq.label}</span>
                      </span>
                      <span className="text-lg font-semibold leading-6 tabular-nums text-foreground">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Busca larga acima da lista, na barra padrão das telas de
                  lista; contagem e "Limpar" ficam na ponta direita. */}
              {membros.length > 0 && (
                <BarraFiltros
                  className="mb-3"
                  busca={busca}
                  aoBuscar={setBusca}
                  placeholderBusca="Buscar por nome, e-mail ou setor..."
                  rotuloBusca="Buscar colaborador"
                  acao={(busca || equipeFiltro) ? (
                    <>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {membrosFiltrados.length} de {membros.length}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => { setBusca(''); setEquipeFiltro(null); }}
                      >
                        Limpar
                      </Button>
                    </>
                  ) : undefined}
                />
              )}

              {loading ? (
                <SkeletonTabela linhas={5} colunas={isAdmin ? 5 : 4} rotulo="Carregando..." />
              ) : membros.length === 0 ? (
                <section className="rounded-lg border border-border bg-card shadow-sm">
                  <EstadoVazio
                    icone={<Users />}
                    titulo="Nenhum colaborador"
                    descricao="Adicione membros à equipe para começar."
                    acao={isAdmin ? (
                      <Button onClick={() => setShowInvite(true)}>
                        <UserPlus aria-hidden="true" />
                        Convidar pessoa
                      </Button>
                    ) : undefined}
                  />
                </section>
              ) : (
                /* Lista nos primitivos de `ui/table`: cabeçalho em superfície
                   rebaixada, linhas de 48px, avatar de 32px em ladrilho, nome
                   14/500 com o e-mail em 13 embaixo. Para o admin, setor e
                   papel são os próprios selects na célula; para os demais, o
                   selo. A rolagem horizontal fica presa à moldura. */
                <div className="rounded-lg border border-border bg-card shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Praça</TableHead>
                        {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membrosFiltrados.length === 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={isAdmin ? 5 : 4} className="p-0">
                            <EstadoVazio
                              tamanho="compacto"
                              icone={<Search />}
                              titulo="Nenhum colaborador encontrado"
                              descricao="Nenhum colaborador corresponde à busca ou ao setor selecionado."
                              acao={
                                <Button variant="outline" onClick={() => { setBusca(''); setEquipeFiltro(null); }}>
                                  Limpar filtros
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )}
                      {membrosFiltrados.map((m) => {
                        const eq = getEquipeInfo(equipeDe(m));
                        const isCurrentUser = m.user_id === user?.id;
                        return (
                          <TableRow key={m.id}>
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-3">
                                {/* Avatar é identidade, não ação: iniciais sobre a
                                    tinta navy clara, o mesmo par do menu da conta. */}
                                <span
                                  aria-hidden="true"
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy-tint text-xs font-semibold text-navy"
                                >
                                  {iniciaisDe(m as MembroExibivel)}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-base font-medium text-foreground">{nomeExibido(m as MembroExibivel)}</span>
                                    {isCurrentUser && <Badge variant="info">Você</Badge>}
                                  </div>
                                  {(m as any).email && <p className="truncate text-sm text-muted-foreground">{(m as any).email}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isAdmin ? (
                                <Select value={(m as any).equipe || 'geral'} onValueChange={(v) => handleUpdateEquipe(m.id, v)}>
                                  <SelectTrigger className="h-9 w-[150px]" aria-label={`Setor de ${nomeExibido(m as MembroExibivel)}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EQUIPES.map(eq => (
                                      <SelectItem key={eq.value} value={eq.value}>{eq.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="muted">{eq.label}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isAdmin ? (
                                <Select
                                  value={m.papel}
                                  onValueChange={(v) => {
                                    if (isCurrentUser && m.papel === 'admin' && v !== 'admin') {
                                      toast.error('Você não pode rebaixar seu próprio papel de Administrador. Peça a outro admin.');
                                      return;
                                    }
                                    handleUpdatePapel(m.id, v);
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-[150px]" aria-label={`Papel de ${nomeExibido(m as MembroExibivel)}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAPEIS.map(p => (
                                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="muted">{PAPEL_LABELS[m.papel] || m.papel}</Badge>
                              )}
                            </TableCell>
                            <TableCell nowrap>
                              {m.praca_uf ? (
                                <Badge variant="muted" className="gap-1">
                                  <MapPin className="h-3 w-3" aria-hidden="true" />
                                  {m.praca_municipio ? `${m.praca_municipio}/${m.praca_uf}` : m.praca_uf}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell nowrap className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon-sm" onClick={() => abrirRenomear(m)} title="Corrigir nome de exibição" aria-label="Corrigir nome de exibição">
                                    <Pencil aria-hidden="true" />
                                  </Button>
                                  <Button variant="ghost" size="icon-sm" onClick={() => openPracaDialog(m)} title="Definir praça (dias úteis das metas)" aria-label="Definir praça (dias úteis das metas)">
                                    <MapPin aria-hidden="true" />
                                  </Button>
                                  <Button variant="ghost" size="icon-sm" onClick={() => openPermDialog(m)} title="Gerenciar permissões" aria-label="Gerenciar permissões">
                                    <Shield aria-hidden="true" />
                                  </Button>
                                  {(m as any).email && !isCurrentUser && (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => handleResendInvite((m as any).email)}
                                      disabled={resendingFor === (m as any).email}
                                      title="Reenviar convite por e-mail"
                                      aria-label="Reenviar convite por e-mail"
                                    >
                                      {resendingFor === (m as any).email
                                        ? <Loader2 className="animate-spin" aria-hidden="true" />
                                        : <Mail aria-hidden="true" />}
                                    </Button>
                                  )}
                                  {!isCurrentUser && (
                                    <Button variant="ghost-destructive" size="icon-sm" onClick={() => handleRemove(m.id, nomeExibido(m as MembroExibivel))} title="Remover colaborador" aria-label="Remover colaborador">
                                      <Trash2 aria-hidden="true" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
        <Dialog open={showInvite} onOpenChange={(open) => {
          setShowInvite(open);
          if (!open) {
            setInviteMode('direto');
            setSectorEmail('');
            setSectorEquipe('financeiro');
            setSectorPapel('operador');
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
                Convidar pessoa
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Escolha do modo de convite */}
              <div className="space-y-2">
                <Label className="block">Como deseja convidar?</Label>
                <RadioGroup
                  value={inviteMode}
                  onValueChange={(v) => setInviteMode(v as 'direto' | 'setor')}
                  className="grid grid-cols-2 gap-2"
                >
                  {([
                    { value: 'direto', Icon: UserPlus, title: 'Convite direto', sub: 'Email pessoal' },
                    { value: 'setor',  Icon: Mail,     title: 'Convite por setor', sub: 'Email do setor' },
                  ] as const).map(({ value, Icon, title, sub }) => (
                    <label
                      key={value}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 transition-colors duration-150',
                        inviteMode === value ? 'border-primary bg-primary-tint' : 'border-input hover:bg-muted',
                      )}
                    >
                      <RadioGroupItem value={value} className="sr-only" />
                      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {inviteMode === 'direto' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="convite-nome">Nome completo</Label>
                    <Input id="convite-nome" value={inviteNome} onChange={e => setInviteNome(e.target.value)} placeholder="Nome do colaborador" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="convite-email">E-mail</Label>
                    <Input id="convite-email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@empresa.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Equipes / Departamentos</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {EQUIPES.map(eq => {
                        const checked = inviteEquipes.includes(eq.value);
                        return (
                          <label
                            key={eq.value}
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-150',
                              checked ? 'border-primary bg-primary-tint' : 'border-input hover:bg-muted',
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                setInviteEquipes(prev =>
                                  checked ? prev.filter(v => v !== eq.value) : [...prev, eq.value]
                                );
                              }}
                            />
                            <eq.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-sm text-foreground">{eq.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecione uma ou mais equipes. Define a área de responsabilidade: alimentar IA Jurídica, Contábil, etc.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="convite-papel">Papel / Permissão</Label>
                    <Select value={invitePapel} onValueChange={setInvitePapel}>
                      <SelectTrigger id="convite-papel"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAPEIS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="setor-email">Email do setor</Label>
                    <Input
                      id="setor-email"
                      value={sectorEmail}
                      onChange={e => setSectorEmail(e.target.value)}
                      placeholder="financeiro@empresa.com.br"
                      type="email"
                    />
                    <p className="text-xs text-muted-foreground">
                      O link de cadastro será enviado para este endereço. Qualquer colaborador que recebê-lo poderá criar um acesso para este setor.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setor-equipe">Setor / Equipe</Label>
                    <Select value={sectorEquipe} onValueChange={setSectorEquipe}>
                      <SelectTrigger id="setor-equipe"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EQUIPES.filter(eq => eq.value !== 'geral').map(eq => (
                          <SelectItem key={eq.value} value={eq.value}>{eq.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setor-papel">Papel / Permissão</Label>
                    <Select value={sectorPapel} onValueChange={setSectorPapel}>
                      <SelectTrigger id="setor-papel"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAPEIS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
              {inviteMode === 'direto' ? (
                <Button
                  onClick={handleInvite}
                  disabled={saving || !inviteEmail.trim() || inviteEquipes.length === 0}
                >
                  {saving ? 'Adicionando...' : 'Adicionar'}
                </Button>
              ) : (
                <Button
                  onClick={handleSectorInvite}
                  disabled={saving || !sectorEmail.trim()}
                >
                  {saving ? 'Enviando...' : 'Enviar convite'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        {/* Praça do colaborador — Fase 1 das metas por praça */}
        <Dialog open={!!pracaDialog} onOpenChange={(v) => !v && setPracaDialog(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                Praça de {nomeExibido(pracaDialog as MembroExibivel)}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Define quais feriados contam nos dias úteis das metas: nacionais +
              os da UF + os do município. Sem praça, só os nacionais.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="praca-uf">UF</Label>
                <Select value={pracaUf} onValueChange={setPracaUf}>
                  <SelectTrigger id="praca-uf"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UF_SEM_PRACA}>Sem praça</SelectItem>
                    {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="praca-municipio">Município (opcional)</Label>
                <Input
                  id="praca-municipio"
                  placeholder="Santa Rosa"
                  value={pracaMunicipio}
                  onChange={(e) => setPracaMunicipio(e.target.value)}
                  disabled={pracaUf === UF_SEM_PRACA}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A grafia não precisa ser exata: a comparação ignora caixa, acento e
              pontuação. O painel de metas mostra quantos feriados entraram no
              cálculo — confira lá depois de definir.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPracaDialog(null)} disabled={salvandoPraca}>Cancelar</Button>
              <Button onClick={savePraca} disabled={salvandoPraca}>
                {salvandoPraca && <Loader2 className="animate-spin" aria-hidden="true" />}
                Salvar praça
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!permDialog} onOpenChange={(v) => !v && setPermDialog(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                Permissões de {nomeExibido(permDialog as MembroExibivel)}
              </DialogTitle>
            </DialogHeader>
            <p className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              Setor:{' '}
              <Badge variant="muted">
                {getEquipeInfo((permDialog as any)?.equipe || 'geral').label}
              </Badge>
              <span>— Os módulos padrão do setor são habilitados automaticamente. Selecione módulos adicionais abaixo:</span>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MODULOS_SISTEMA.map(mod => {
                const isDefault = mod.setores.includes((permDialog as any)?.equipe || 'geral');
                const checked = permissoesSel.includes(mod.value) || isDefault;
                return (
                  <label
                    key={mod.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors duration-150',
                      checked ? 'border-primary bg-primary-tint' : 'border-input hover:bg-muted',
                      isDefault && 'opacity-80',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={isDefault}
                      onCheckedChange={() => {
                        if (isDefault) return;
                        setPermissoesSel(prev =>
                          prev.includes(mod.value)
                            ? prev.filter(v => v !== mod.value)
                            : [...prev, mod.value]
                        );
                      }}
                    />
                    <span className="text-sm text-foreground">{mod.label}</span>
                    {isDefault && <Badge variant="muted" className="ml-auto">Padrão</Badge>}
                  </label>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermDialog(null)}>Cancelar</Button>
              <Button onClick={handleSavePermissoes}>
                Salvar permissões
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* Corrigir nome de exibição */}
      <Dialog open={!!renomeando} onOpenChange={(o) => { if (!o) setRenomeando(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Corrigir nome de exibição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aparecendo hoje como <span className="font-semibold text-foreground">{renomeando?.atual}</span>.
              O login continua o mesmo — muda só como a pessoa é identificada nas telas.
            </p>
            <div className="space-y-2">
              <Label htmlFor="novo-nome">Nome</Label>
              <Input
                id="novo-nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Maria Souza"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomeando(null)}>Cancelar</Button>
            <Button onClick={salvarNome} disabled={salvandoNome || !novoNome.trim()}>
              {salvandoNome ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
