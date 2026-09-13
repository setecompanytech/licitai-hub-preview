import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { cn } from '@/lib/utils';
import { ListChecks, Brain, Bell, Mail, MessageSquare, Building2, ArrowRight, Loader2, Clock, FolderOpen, Archive, ArchiveRestore, Folder, List, LayoutGrid } from 'lucide-react';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import ArquivarProcessoDialog, { type DesfechoArquivamento } from '@/components/gestao/ArquivarProcessoDialog';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';

type Item = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
  status: string;
  ia_score: number | null;
  alerta_sistema: boolean | null;
  alerta_email: boolean | null;
  alerta_whatsapp: boolean | null;
  licitacao_id: string | null;
};

const fmtCurrency = (v: number | null) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Urgência do prazo → família semântica do Badge (identidade 12/09). */
const VARIANTE_URGENCIA = { danger: 'danger', warning: 'warning', normal: 'success' } as const;

/**
 * Modo de exibição dos compromissos: lista (detalhe) ou PASTAS — grade de
 * cartões-pasta ao estilo Finder, com densidade que a pessoa escolhe
 * (2, 4, 6 ou 8 por linha). Preferência do navegador, não do banco.
 */
type Vista = { modo: 'lista' | 'pastas'; colunas: number };
const COLUNAS_OPCOES = [2, 4, 6, 8] as const;
const VISTA_CHAVE = 'praefectus:compromissos-vista';

function lerVista(): Vista {
  try {
    const v = JSON.parse(localStorage.getItem(VISTA_CHAVE) || '{}') as Partial<Vista>;
    return {
      modo: v.modo === 'pastas' ? 'pastas' : 'lista',
      colunas: COLUNAS_OPCOES.includes(v.colunas as never) ? Number(v.colunas) : 4,
    };
  } catch {
    return { modo: 'lista', colunas: 4 };
  }
}

/**
 * Lista compacta de compromissos (processos_interesse) embarcada na aba
 * Compromissos da Gestão. Mostra prazos, score IA e atalho para a página completa.
 */
export default function CompromissosResumo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { iniciarProcesso, arquivarProcesso, registrarPerda } = useLicitacaoIntegration();
  const { empresaAtiva } = useEmpresa();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [arquivando, setArquivando] = useState<string | null>(null);
  const [verArquivados, setVerArquivados] = useState(false);
  const [vista, setVista] = useState<Vista>(() => lerVista());
  const mudarVista = useCallback((nova: Vista) => {
    setVista(nova);
    try { localStorage.setItem(VISTA_CHAVE, JSON.stringify(nova)); } catch { /* sem storage */ }
  }, []);
  // Arquivar deixou de ser um gesto mudo: sem desfecho registrado, pergunta.
  const [aArquivar, setAArquivar] = useState<Item | null>(null);
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);

  const abrirPasta = useCallback(async (p: Item) => {
    if (p.licitacao_id) { navigate(`/processo/${p.licitacao_id}`); return; }
    setOpening(p.id);
    try {
      const lid = await iniciarProcesso({
        numero: p.numero,
        orgao: p.orgao,
        objeto: p.objeto,
        modalidade: p.modalidade || undefined,
        valor_estimado: p.valor_estimado,
        uf: p.uf,
        municipio: p.municipio,
        data_encerramento: p.data_encerramento,
      });
      if (!lid) { toast.error('Não foi possível abrir a Pasta.'); return; }
      await supabase.from('processos_interesse').update({ licitacao_id: lid }).eq('id', p.id);
      navigate(`/processo/${lid}`);
    } finally {
      setOpening(null);
    }
  }, [iniciarProcesso, navigate]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('processos_interesse')
      .select('id, numero, orgao, objeto, modalidade, valor_estimado, uf, municipio, data_encerramento, status, ia_score, alerta_sistema, alerta_email, alerta_whatsapp, licitacao_id')
      .eq('user_id', user.id)
      .order('data_encerramento', { ascending: true })
      .limit(50);
    setItems((data || []) as Item[]);
    setLoading(false);
  }, [user]);

  /** Arquivar aqui também move o card no Kanban, quando há licitação vinculada. */
  /** Arquiva de fato — chamado depois de o desfecho estar resolvido. */
  const alternarArquivo = useCallback(async (p: Item) => {
    const restaurar = p.status === 'arquivado';
    setArquivando(p.id);
    try {
      if (p.licitacao_id) {
        const ok = await arquivarProcesso(p.licitacao_id, !restaurar);
        if (!ok) return;
      } else {
        const { error } = await supabase
          .from('processos_interesse')
          .update({ status: restaurar ? 'interessado' : 'arquivado' })
          .eq('id', p.id);
        if (error) { toast.error('Erro ao arquivar compromisso.'); return; }
      }
      toast.success(restaurar ? 'Compromisso restaurado.' : 'Compromisso arquivado.');
      carregar();
    } finally {
      setArquivando(null);
    }
  }, [arquivarProcesso, carregar]);

  /**
   * Aplica o desfecho escolhido e arquiva.
   *
   * "Vencemos" grava o status antes de arquivar — a ordem importa: o Kanban
   * mostra `arquivado_em` por cima do status, então o desfecho precisa existir
   * para aparecer no cartão arquivado.
   */
  const resolverDesfecho = useCallback(async (desfecho: DesfechoArquivamento) => {
    const p = aArquivar;
    if (!p) return;
    setAArquivar(null);

    if (desfecho === 'perdida') {
      // O fluxo de perda é o mesmo do Kanban: motivo obrigatório, e o gatilho
      // do banco recusa a mudança sem registro em comercial_perdas.
      setPerdaAlvo({
        licitacaoId: p.licitacao_id!,
        numero: p.numero,
        orgao: p.orgao,
        modalidade: p.modalidade,
        valorEstimado: p.valor_estimado,
      });
      return;
    }

    if (desfecho === 'vencida' && p.licitacao_id) {
      const { error } = await supabase
        .from('licitacoes').update({ status: 'Vencida' }).eq('id', p.licitacao_id);
      if (error) { toast.error(error.message || 'Erro ao registrar o desfecho.'); return; }
    }
    await alternarArquivo(p);
  }, [aArquivar, alternarArquivo]);

  const confirmarPerda = useCallback(async ({ motivoId, observacao }: { motivoId: string; observacao: string }) => {
    if (!perdaAlvo || !empresaAtiva) return;
    setSalvandoPerda(true);
    const ok = await registrarPerda({
      licitacaoId: perdaAlvo.licitacaoId, empresaId: empresaAtiva.id, motivoId, observacao,
      modalidade: perdaAlvo.modalidade, valorEstimado: perdaAlvo.valorEstimado,
    });
    setSalvandoPerda(false);
    if (!ok) return;
    const alvo = items.find((i) => i.licitacao_id === perdaAlvo.licitacaoId);
    setPerdaAlvo(null);
    if (alvo) await alternarArquivo(alvo);
  }, [perdaAlvo, empresaAtiva, registrarPerda, items, alternarArquivo]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('compromissos-resumo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processos_interesse', filter: `user_id=eq.${user.id}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, carregar]);

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Carregando compromissos…</span>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  const arquivados = items.filter((p) => p.status === 'arquivado');
  const visiveis = verArquivados ? arquivados : items.filter((p) => p.status !== 'arquivado');

  if (items.length === 0) {
    return (
      <Card>
        <EstadoVazio
          icone={<ListChecks />}
          titulo="Nenhum compromisso ativo"
          descricao={
            <>
              Inicie um processo no <strong>Monitoramento de Editais</strong> para gerar prazos e alertas automáticos.
            </>
          }
          acao={
            <Button asChild variant="outline">
              <Link to="/monitoramento-editais">Ir para Monitoramento</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {/* A barra de "processo ativo" saiu junto com a memória entre telas:
          ela servia para eleger um processo que acompanharia a pessoa pelos
          módulos, e é justamente isso que deixou de existir. Abrir a pasta é
          o caminho. */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="g-corpo text-muted-foreground">
          {verArquivados
            ? `${arquivados.length} compromisso(s) arquivado(s)`
            : `${visiveis.length} compromissos ativos — exibindo prazos críticos primeiro`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Vista: lista detalhada ou pastas (grade estilo Finder). Na grade,
              a pessoa escolhe a densidade — 2, 4, 6 ou 8 pastas por linha. */}
          <div className="inline-flex items-center overflow-hidden rounded-md border border-input bg-background" role="group" aria-label="Modo de exibição">
            <Button
              type="button"
              variant="ghost"
              onClick={() => mudarVista({ ...vista, modo: 'lista' })}
              title="Ver como lista"
              aria-pressed={vista.modo === 'lista'}
              className={cn('rounded-none', vista.modo === 'lista' ? 'bg-primary-tint text-primary hover:bg-primary-tint hover:text-primary' : 'text-muted-foreground')}
            >
              <List aria-hidden="true" /> Lista
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => mudarVista({ ...vista, modo: 'pastas' })}
              title="Ver como pastas"
              aria-pressed={vista.modo === 'pastas'}
              className={cn('rounded-none border-l border-input', vista.modo === 'pastas' ? 'bg-primary-tint text-primary hover:bg-primary-tint hover:text-primary' : 'text-muted-foreground')}
            >
              <LayoutGrid aria-hidden="true" /> Pastas
            </Button>
          </div>
          {vista.modo === 'pastas' && (
            <div className="inline-flex items-center overflow-hidden rounded-md border border-input bg-background" role="group" aria-label="Pastas por linha">
              {COLUNAS_OPCOES.map((c, i) => (
                <Button
                  key={c}
                  type="button"
                  variant="ghost"
                  onClick={() => mudarVista({ ...vista, colunas: c })}
                  title={`${c} pastas por linha`}
                  aria-pressed={vista.colunas === c}
                  className={cn(
                    'rounded-none px-3 tabular-nums',
                    i > 0 && 'border-l border-input',
                    vista.colunas === c ? 'bg-primary-tint text-primary hover:bg-primary-tint hover:text-primary' : 'text-muted-foreground',
                  )}
                >
                  {c}
                </Button>
              ))}
            </div>
          )}
          {arquivados.length > 0 && (
            <Button variant="ghost" onClick={() => setVerArquivados(v => !v)}>
              <Archive aria-hidden="true" />
              {verArquivados ? 'Ver ativos' : `Arquivados (${arquivados.length})`}
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link to="/meus-compromissos">
              Abrir página completa <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {visiveis.length === 0 && (
        <Card>
          <EstadoVazio
            tamanho="compacto"
            icone={verArquivados ? <Archive /> : <ListChecks />}
            titulo={verArquivados ? 'Nenhum compromisso arquivado' : 'Nenhum compromisso ativo'}
            descricao={verArquivados ? 'Arquive um compromisso para vê-lo aqui.' : 'Todos os compromissos estão arquivados.'}
          />
        </Card>
      )}

      {vista.modo === 'pastas' && visiveis.length > 0 && (
        /* A densidade escolhida (2/4/6/8) vale de `md` para cima; no celular a
           grade fica em duas colunas — oito pastas numa tela de 360px viram
           tiras ilegíveis. A contagem entra por variável CSS, não por classe
           dinâmica, para o Tailwind não precisar conhecer os quatro valores. */
        <div
          className="grid grid-cols-2 gap-4 md:[grid-template-columns:repeat(var(--pastas),minmax(0,1fr))]"
          style={{ '--pastas': vista.colunas } as CSSProperties}
        >
          {visiveis.map((p) => {
            const dias = diasAte(p.data_encerramento);
            const urgencia = dias === null ? 'normal' : dias <= 1 ? 'danger' : dias <= 3 ? 'warning' : 'normal';
            const corPasta = { danger: 'text-destructive', warning: 'text-warning', normal: 'text-primary' }[urgencia];
            const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade });
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => abrirPasta(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirPasta(p); } }}
                title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : identidade.rotulo}
                className="group flex h-full cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-center justify-between gap-1">
                  {opening === p.id
                    ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
                    : <Folder className={cn('h-8 w-8', corPasta)} strokeWidth={1.5} aria-hidden="true" />}
                  {dias !== null && dias >= 0 && (
                    <Badge variant={VARIANTE_URGENCIA[urgencia]} className="tabular-nums">
                      {dias === 0 ? 'hoje' : `${dias}d`}
                    </Badge>
                  )}
                </div>
                <p className="g-corpo font-semibold line-clamp-2">{identidade.rotulo}</p>
                <p className="g-meta text-muted-foreground line-clamp-2">{p.objeto}</p>
                <div className="mt-auto flex min-w-0 items-end justify-between gap-1 pt-1">
                  <div className="min-w-0">
                    <p className="truncate g-meta text-muted-foreground">{p.orgao}</p>
                    <p className="g-corpo font-medium text-foreground tabular-nums">{fmtCurrency(p.valor_estimado)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (p.status === 'arquivado') { alternarArquivo(p); return; }
                      setAArquivar(p);
                    }}
                    disabled={arquivando === p.id}
                    title={p.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                    aria-label={p.status === 'arquivado' ? 'Restaurar compromisso' : 'Arquivar compromisso'}
                    className={cn(
                      'h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
                      arquivando === p.id && 'opacity-100',
                    )}
                  >
                    {arquivando === p.id
                      ? <Loader2 className="animate-spin" aria-hidden="true" />
                      : p.status === 'arquivado'
                      ? <ArchiveRestore aria-hidden="true" />
                      : <Archive aria-hidden="true" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista.modo === 'lista' && visiveis.map((p) => {
        const dias = diasAte(p.data_encerramento);
        const urgencia = dias === null ? 'normal'
          : dias <= 1 ? 'danger'
          : dias <= 3 ? 'warning'
          : 'normal';
        const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade });
        return (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="muted" className="gap-1">
                    <ListChecks className="h-3 w-3" aria-hidden="true" />{p.status}
                  </Badge>
                  <span
                    className="cursor-help g-corpo font-semibold"
                    title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
                  >
                    {identidade.rotulo}
                  </span>
                  {identidade.srpNoTexto && (
                    <Badge variant="muted">SRP</Badge>
                  )}
                  {dias !== null && dias >= 0 && (
                    <Badge variant={VARIANTE_URGENCIA[urgencia]} className="gap-1 tabular-nums">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {dias === 0 ? 'Encerra hoje' : `${dias}d restantes`}
                    </Badge>
                  )}
                  {p.ia_score != null && (
                    <Badge variant="info" className="gap-1 tabular-nums">
                      <Brain className="h-3 w-3" aria-hidden="true" /> Score {p.ia_score}
                    </Badge>
                  )}
                </div>
                <p className="g-corpo font-medium line-clamp-1">{p.objeto}</p>
                <div className="g-meta mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" aria-hidden="true" />{p.orgao}
                  </span>
                  {p.uf && <span>{p.municipio ? `${p.municipio}/${p.uf}` : p.uf}</span>}
                  <span className="font-medium text-foreground tabular-nums">{fmtCurrency(p.valor_estimado)}</span>
                  <span className="flex items-center gap-1">
                    {p.alerta_sistema && <Bell className="h-4 w-4 text-primary" aria-label="Alerta no sistema" />}
                    {p.alerta_email && <Mail className="h-4 w-4 text-info" aria-label="Alerta por e-mail" />}
                    {p.alerta_whatsapp && <MessageSquare className="h-4 w-4 text-success" aria-label="Alerta por WhatsApp" />}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => abrirPasta(p)} disabled={opening === p.id}>
                  {opening === p.id
                    ? <Loader2 className="animate-spin" aria-hidden="true" />
                    : <FolderOpen aria-hidden="true" />}
                  Abrir Pasta
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    // Restaurar não precisa de pergunta; arquivar precisa.
                    if (p.status === 'arquivado') { alternarArquivo(p); return; }
                    setAArquivar(p);
                  }}
                  disabled={arquivando === p.id}
                  title={p.licitacao_id ? 'Sincroniza com o Kanban' : undefined}
                >
                  {arquivando === p.id
                    ? <Loader2 className="animate-spin" aria-hidden="true" />
                    : p.status === 'arquivado'
                    ? <ArchiveRestore aria-hidden="true" />
                    : <Archive aria-hidden="true" />}
                  {p.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>

      <ArquivarProcessoDialog
        aberto={!!aArquivar}
        numero={aArquivar?.numero ?? null}
        objeto={aArquivar?.objeto ?? null}
        onFechar={() => setAArquivar(null)}
        onEscolher={resolverDesfecho}
      />

      <RegistrarPerdaDialog
        alvo={perdaAlvo}
        onCancelar={() => setPerdaAlvo(null)}
        onConfirmar={confirmarPerda}
        salvando={salvandoPerda}
      />
    </>
  );
}
