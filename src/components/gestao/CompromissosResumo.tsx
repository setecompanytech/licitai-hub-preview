import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const arquivados = items.filter((p) => p.status === 'arquivado');
  const visiveis = verArquivados ? arquivados : items.filter((p) => p.status !== 'arquivado');

  if (items.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ListChecks className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum compromisso ativo</p>
        <p className="text-xs text-muted-foreground mt-1">
          Inicie um processo no <strong>Monitoramento de Editais</strong> para gerar prazos e alertas automáticos.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/monitoramento-editais">Ir para Monitoramento</Link>
        </Button>
      </Card>
    );
  }

  return (
    <>
    <div className="space-y-3">
      {/* Processo Ativo — seletor e atalho para a Pasta do Processo */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {/* A barra de "processo ativo" saiu junto com a memória entre telas:
            ela servia para eleger um processo que acompanharia a pessoa pelos
            módulos, e é justamente isso que deixou de existir. Abrir a pasta é
            o caminho. */}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {verArquivados
            ? `${arquivados.length} compromisso(s) arquivado(s)`
            : `${visiveis.length} compromissos ativos — exibindo prazos críticos primeiro`}
        </p>
        <div className="flex items-center gap-1">
          {/* Vista: lista detalhada ou pastas (grade estilo Finder). Na grade,
              a pessoa escolhe a densidade — 2, 4, 6 ou 8 pastas por linha. */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => mudarVista({ ...vista, modo: 'lista' })}
              title="Ver como lista"
              aria-pressed={vista.modo === 'lista'}
              className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${vista.modo === 'lista' ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <List className="w-3.5 h-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => mudarVista({ ...vista, modo: 'pastas' })}
              title="Ver como pastas"
              aria-pressed={vista.modo === 'pastas'}
              className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors border-l border-border ${vista.modo === 'pastas' ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Pastas
            </button>
          </div>
          {vista.modo === 'pastas' && (
            <div className="flex items-center rounded-lg border border-border overflow-hidden" role="group" aria-label="Pastas por linha">
              {COLUNAS_OPCOES.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => mudarVista({ ...vista, colunas: c })}
                  title={`${c} pastas por linha`}
                  aria-pressed={vista.colunas === c}
                  className={`px-2 py-1.5 text-xs tabular-nums transition-colors ${i > 0 ? 'border-l border-border' : ''} ${vista.colunas === c ? 'bg-accent/15 text-accent font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {arquivados.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setVerArquivados(v => !v)}>
              <Archive className="w-3.5 h-3.5 mr-1" />
              {verArquivados ? 'Ver ativos' : `Arquivados (${arquivados.length})`}
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/meus-compromissos" className="text-xs">
              Abrir página completa <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {visiveis.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {verArquivados ? 'Nenhum compromisso arquivado.' : 'Nenhum compromisso ativo — todos estão arquivados.'}
          </p>
        </Card>
      )}

      {vista.modo === 'pastas' && visiveis.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${vista.colunas}, minmax(0, 1fr))` }}>
          {visiveis.map((p) => {
            const dias = diasAte(p.data_encerramento);
            const urgencia = dias === null ? 'normal' : dias <= 1 ? 'danger' : dias <= 3 ? 'warning' : 'normal';
            const corPasta = { danger: 'text-destructive', warning: 'text-warning', normal: 'text-accent' }[urgencia];
            const chipPrazo = {
              danger: 'bg-destructive/15 text-destructive',
              warning: 'bg-warning/15 text-warning',
              normal: 'bg-success/10 text-success',
            }[urgencia];
            const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade });
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => abrirPasta(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirPasta(p); } }}
                title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : identidade.rotulo}
                className="group flex h-full cursor-pointer flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-accent/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="flex items-center justify-between gap-1">
                  {opening === p.id
                    ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                    : <Folder className={`h-7 w-7 ${corPasta}`} strokeWidth={1.5} />}
                  {dias !== null && dias >= 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${chipPrazo}`}>
                      {dias === 0 ? 'hoje' : `${dias}d`}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold leading-snug line-clamp-2">{identidade.rotulo}</p>
                <p className="text-xs leading-snug text-muted-foreground line-clamp-2">{p.objeto}</p>
                <div className="mt-auto flex items-end justify-between gap-1 pt-1 min-w-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{p.orgao}</p>
                    <p className="text-xs font-medium text-foreground">{fmtCurrency(p.valor_estimado)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (p.status === 'arquivado') { alternarArquivo(p); return; }
                      setAArquivar(p);
                    }}
                    disabled={arquivando === p.id}
                    title={p.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                    aria-label={p.status === 'arquivado' ? 'Restaurar compromisso' : 'Arquivar compromisso'}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    {arquivando === p.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : p.status === 'arquivado'
                      ? <ArchiveRestore className="h-3.5 w-3.5" />
                      : <Archive className="h-3.5 w-3.5" />}
                  </button>
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
        const colorMap = {
          danger: 'bg-destructive/15 text-destructive border-destructive/30',
          warning: 'bg-warning/15 text-warning border-warning/30',
          normal: 'bg-success/10 text-success border-success/30',
        };
        const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade });
        return (
          <Card key={p.id} className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className="text-xs">
                    <ListChecks className="w-3 h-3 mr-1" />{p.status}
                  </Badge>
                  <span
                    className="text-xs font-semibold cursor-help"
                    title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
                  >
                    {identidade.rotulo}
                  </span>
                  {identidade.srpNoTexto && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">SRP</span>
                  )}
                  {dias !== null && dias >= 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorMap[urgencia]}`}>
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {dias === 0 ? 'Encerra hoje' : `${dias}d restantes`}
                    </span>
                  )}
                  {p.ia_score != null && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                      <Brain className="w-3 h-3 inline mr-0.5" /> Score {p.ia_score}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-1">{p.objeto}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />{p.orgao}
                  </span>
                  {p.uf && <span>{p.municipio ? `${p.municipio}/${p.uf}` : p.uf}</span>}
                  <span className="font-medium text-foreground">{fmtCurrency(p.valor_estimado)}</span>
                  <span className="flex items-center gap-1">
                    {p.alerta_sistema && <Bell className="w-3 h-3 text-accent" />}
                    {p.alerta_email && <Mail className="w-3 h-3 text-info" />}
                    {p.alerta_whatsapp && <MessageSquare className="w-3 h-3 text-success" />}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => abrirPasta(p)} disabled={opening === p.id}>
                  {opening === p.id
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <FolderOpen className="w-3.5 h-3.5 mr-1" />}
                  Abrir Pasta
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    // Restaurar não precisa de pergunta; arquivar precisa.
                    if (p.status === 'arquivado') { alternarArquivo(p); return; }
                    setAArquivar(p);
                  }}
                  disabled={arquivando === p.id}
                  title={p.licitacao_id ? 'Sincroniza com o Kanban' : undefined}
                >
                  {arquivando === p.id
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : p.status === 'arquivado'
                    ? <ArchiveRestore className="w-3.5 h-3.5 mr-1" />
                    : <Archive className="w-3.5 h-3.5 mr-1" />}
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
