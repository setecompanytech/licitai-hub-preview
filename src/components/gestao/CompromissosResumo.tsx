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
import { ListChecks, Brain, Bell, Mail, MessageSquare, Building2, ArrowRight, Loader2, Clock, FolderOpen, Archive, ArchiveRestore, Folder, List, LayoutGrid, AlertTriangle, RefreshCw } from 'lucide-react';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';
import { montarPastas, type CompromissoPessoal, type Pasta, type ProcessoDaEmpresa } from '@/lib/processo/pastas';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import ArquivarProcessoDialog, { type DesfechoArquivamento } from '@/components/gestao/ArquivarProcessoDialog';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';
import NovaPastaManualDialog, { BotaoNovaPastaManual } from '@/components/gestao/NovaPastaManualDialog';

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
 * As pastas do processo, na aba Compromissos da Gestão.
 *
 * ── DE ONDE VEM A LISTA ──────────────────────────────────────────────────
 *
 * Do QUADRO DA EMPRESA (`licitacoes`), o mesmo universo do Kanban, com o
 * compromisso pessoal (`processos_interesse`) por cima. Antes a lista saía
 * só da tabela pessoal, e o resultado medido em 17/09 na O S foi 31
 * processos no quadro contra 2 pastas aqui: as demais eram de um colega, e
 * cinco processos não tinham pasta nenhuma.
 *
 * Isso importa porque é pela pasta que se chega ao edital, aos documentos e
 * aos anexos — pasta que não aparece é processo fora de alcance.
 *
 * O que continua pessoal: a decisão de acompanhar, o score da IA e os
 * canais de alerta. A junção mora em `lib/processo/pastas.ts`, com teste.
 */
function ListaDeCompromissos({
  aoNovaPasta,
  sinalDeRecarga,
}: {
  aoNovaPasta: () => void;
  sinalDeRecarga: number;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { iniciarProcesso, arquivarProcesso, registrarPerda } = useLicitacaoIntegration();
  const { empresaAtiva } = useEmpresa();
  const [items, setItems] = useState<Pasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [arquivando, setArquivando] = useState<string | null>(null);
  const [verArquivados, setVerArquivados] = useState(false);
  const [vista, setVista] = useState<Vista>(() => lerVista());
  const mudarVista = useCallback((nova: Vista) => {
    setVista(nova);
    try { localStorage.setItem(VISTA_CHAVE, JSON.stringify(nova)); } catch { /* sem storage */ }
  }, []);
  // Arquivar deixou de ser um gesto mudo: sem desfecho registrado, pergunta.
  const [aArquivar, setAArquivar] = useState<Pasta | null>(null);
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);

  const abrirPasta = useCallback(async (p: Pasta) => {
    if (p.licitacaoId) { navigate(`/processo/${p.licitacaoId}`); return; }
    setOpening(p.id);
    try {
      const lid = await iniciarProcesso({
        numero: p.numero || '',
        orgao: p.orgao || '',
        objeto: p.objeto || '',
        modalidade: p.modalidade || undefined,
        valor_estimado: p.valor_estimado,
        uf: p.uf,
        municipio: p.municipio,
        data_encerramento: p.data_encerramento,
      });
      if (!lid) { toast.error('Não foi possível abrir a Pasta.'); return; }
      if (p.compromissoId) {
        await supabase.from('processos_interesse').update({ licitacao_id: lid }).eq('id', p.compromissoId);
      }
      navigate(`/processo/${lid}`);
    } finally {
      setOpening(null);
    }
  }, [iniciarProcesso, navigate]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // O universo é o do quadro. O RLS já limita às empresas de que a pessoa é
    // membro; o filtro por empresa ativa espelha o Kanban.
    let consultaProcessos = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, ano_compra, valor_estimado, uf, municipio, data_encerramento, status, arquivado_em');
    if (empresaAtiva) consultaProcessos = consultaProcessos.eq('empresa_id', empresaAtiva.id);

    const [processos, compromissos] = await Promise.all([
      consultaProcessos.order('data_encerramento', { ascending: true }),
      supabase
        .from('processos_interesse')
        .select('id, licitacao_id, numero, orgao, objeto, modalidade, valor_estimado, uf, municipio, data_encerramento, status, ia_score, alerta_sistema, alerta_email, alerta_whatsapp, created_at')
        .eq('user_id', user.id),
    ]);

    /* Erro não pode virar lista vazia: a aba diria "nenhum processo" para uma
       empresa com 31 no quadro, e ninguém saberia que a consulta falhou
       (princípio 3 do CLAUDE.md). A lista anterior fica na tela. */
    const falha = processos.error || compromissos.error;
    setErro(falha ? (falha.message || 'Não foi possível carregar as pastas.') : null);
    if (processos.error) { setLoading(false); return; }

    setItems(montarPastas(
      (processos.data || []) as ProcessoDaEmpresa[],
      (compromissos.data || []) as CompromissoPessoal[],
    ));
    setLoading(false);
  }, [user, empresaAtiva]);

  /** Arquivar aqui também move o card no Kanban, quando há licitação vinculada. */
  const alternarArquivo = useCallback(async (p: Pasta) => {
    const restaurar = p.arquivada;
    setArquivando(p.id);
    try {
      if (p.licitacaoId) {
        const ok = await arquivarProcesso(p.licitacaoId, !restaurar);
        if (!ok) return;
      } else if (p.compromissoId) {
        const { error } = await supabase
          .from('processos_interesse')
          .update({ status: restaurar ? 'interessado' : 'arquivado' })
          .eq('id', p.compromissoId);
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
        licitacaoId: p.licitacaoId!,
        numero: p.numero || '',
        orgao: p.orgao || '',
        modalidade: p.modalidade,
        valorEstimado: p.valor_estimado,
      });
      return;
    }

    if (desfecho === 'vencida' && p.licitacaoId) {
      const { error } = await supabase
        .from('licitacoes').update({ status: 'Vencida' }).eq('id', p.licitacaoId);
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
    const alvo = items.find((i) => i.licitacaoId === perdaAlvo.licitacaoId);
    setPerdaAlvo(null);
    if (alvo) await alternarArquivo(alvo);
  }, [perdaAlvo, empresaAtiva, registrarPerda, items, alternarArquivo]);

  useEffect(() => { carregar(); }, [carregar, sinalDeRecarga]);

  useEffect(() => {
    if (!user) return;
    /* Duas fontes, um canal: o processo muda no Kanban (status, arquivamento,
       processo novo) e o compromisso muda aqui. Sem ouvir `licitacoes`, a pasta
       criada no monitoramento só apareceria ao recarregar a página. */
    const ch = supabase
      .channel('compromissos-resumo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processos_interesse', filter: `user_id=eq.${user.id}` }, () => carregar())
      .on(
        'postgres_changes',
        empresaAtiva
          ? { event: '*', schema: 'public', table: 'licitacoes', filter: `empresa_id=eq.${empresaAtiva.id}` }
          : { event: '*', schema: 'public', table: 'licitacoes' },
        () => carregar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, empresaAtiva, carregar]);

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

  const arquivados = items.filter((p) => p.arquivada);
  const visiveis = verArquivados ? arquivados : items.filter((p) => !p.arquivada);

  const avisoDeFalha = erro && (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive-line bg-destructive-tint p-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive-ink" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-5 text-destructive-ink">
        Lista incompleta — {erro} O que está abaixo pode não ser tudo.
      </p>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => carregar()}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  );

  if (items.length === 0) {
    return (
      <>
        {avisoDeFalha}
        <Card>
          <EstadoVazio
            icone={<ListChecks />}
            titulo="Nenhum processo na gestão"
            descricao={
              <>
                Inicie um processo no <strong>Monitoramento de Editais</strong> — a pasta nasce junto, com prazos e alertas.
                Processo que não passa pelo PNCP (como dispensas em sistemas estaduais) entra por uma pasta manual.
              </>
            }
            acao={
              <>
                <Button asChild variant="outline">
                  <Link to="/monitoramento-editais">Ir para Monitoramento</Link>
                </Button>
                <BotaoNovaPastaManual rotulo="Criar pasta manual" aoAbrir={aoNovaPasta} />
              </>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {avisoDeFalha}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="g-corpo text-muted-foreground">
          {verArquivados
            ? `${arquivados.length} pasta(s) arquivada(s)`
            : `${visiveis.length} pasta(s) ativa(s) — exibindo prazos críticos primeiro`}
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
          <BotaoNovaPastaManual aoAbrir={aoNovaPasta} />
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
            titulo={verArquivados ? 'Nenhuma pasta arquivada' : 'Nenhuma pasta ativa'}
            descricao={verArquivados ? 'Arquive uma pasta para vê-la aqui.' : 'Todas as pastas estão arquivadas.'}
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
            const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade, anoCompra: p.ano_compra });
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
                      if (p.arquivada) { alternarArquivo(p); return; }
                      setAArquivar(p);
                    }}
                    disabled={arquivando === p.id}
                    title={p.arquivada ? 'Restaurar' : 'Arquivar'}
                    aria-label={p.arquivada ? 'Restaurar compromisso' : 'Arquivar compromisso'}
                    className={cn(
                      'h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
                      arquivando === p.id && 'opacity-100',
                    )}
                  >
                    {arquivando === p.id
                      ? <Loader2 className="animate-spin" aria-hidden="true" />
                      : p.arquivada
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
        const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade, anoCompra: p.ano_compra });
        return (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="muted" className="gap-1">
                    <ListChecks className="h-3 w-3" aria-hidden="true" />{p.situacao}
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
                  {/* Pasta do colega: a pessoa alcança o processo, mas os
                      alertas de prazo são de quem acompanha — dizer isso evita
                      confiar num aviso que não vai chegar. */}
                  {p.semCompromissoProprio ? (
                    <span>Sem alertas seus</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      {p.alerta_sistema && <Bell className="h-4 w-4 text-primary" aria-label="Alerta no sistema" />}
                      {p.alerta_email && <Mail className="h-4 w-4 text-info" aria-label="Alerta por e-mail" />}
                      {p.alerta_whatsapp && <MessageSquare className="h-4 w-4 text-success" aria-label="Alerta por WhatsApp" />}
                    </span>
                  )}
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
                    if (p.arquivada) { alternarArquivo(p); return; }
                    setAArquivar(p);
                  }}
                  disabled={arquivando === p.id}
                  title={p.licitacaoId ? 'Sincroniza com o Kanban' : undefined}
                >
                  {arquivando === p.id
                    ? <Loader2 className="animate-spin" aria-hidden="true" />
                    : p.arquivada
                    ? <ArchiveRestore aria-hidden="true" />
                    : <Archive aria-hidden="true" />}
                  {p.arquivada ? 'Restaurar' : 'Arquivar'}
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

/**
 * A aba Compromissos da Gestão, com a entrada da pasta manual.
 *
 * O diálogo mora aqui, FORA da lista, de propósito: a lista troca de árvore
 * inteira entre carregando, vazia e preenchida — e o compromisso que o próprio
 * diálogo cria dispara essa troca (realtime e recarga) no meio do envio dos
 * anexos. Com o diálogo dentro dela, ele desmontaria levando o progresso e a
 * lista de falhas junto.
 */
export default function CompromissosResumo() {
  const [novaPasta, setNovaPasta] = useState(false);
  const [recarga, setRecarga] = useState(0);
  return (
    <>
      <ListaDeCompromissos aoNovaPasta={() => setNovaPasta(true)} sinalDeRecarga={recarga} />
      <NovaPastaManualDialog
        aberto={novaPasta}
        aoFechar={() => setNovaPasta(false)}
        aoCriar={() => setRecarga((n) => n + 1)}
      />
    </>
  );
}
