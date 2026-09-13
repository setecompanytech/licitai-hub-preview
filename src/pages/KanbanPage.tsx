import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { normalizarStatus as normalizeStatus, STATUS_DECIDIDOS } from '@/lib/licitacao/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { identidadeDoProcesso, objetoLegivel } from '@/lib/licitacao/identidade-do-processo';
import { MapPin, Calendar, GripVertical, Pencil, LayoutDashboard, ListChecks, History, ChevronRight, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import EditLicitacaoDialog from '@/components/kanban/EditLicitacaoDialog';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompromissosResumo from '@/components/gestao/CompromissosResumo';
import HistoricoExtracoes from '@/components/gestao/HistoricoExtracoes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type LicitacaoKanban = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  modalidade: string | null;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
  arquivado_em: string | null;
};

/**
 * Em qual coluna o card aparece. `arquivado_em` vence o status: um processo
 * homologado e arquivado mostra-se em Arquivada e continua homologado por baixo
 * — que é exatamente o que a gravação antiga destruía.
 */
const colunaDe = (lic: { status: string; arquivado_em: string | null }): string =>
  lic.arquivado_em ? 'Arquivada' : normalizeStatus(lic.status);

type Column = {
  id: string;
  title: string;
  description: string;
  /**
   * Cor do estado em classes de token (identidade 12/09): a barra superior da
   * coluna, o ponto ao lado do título e a lavagem leve do fundo. Antes a cor
   * entrava por `style` inline — cor escrita à mão dentro do .tsx.
   */
  cor: { topo: string; ponto: string; lavagem: string };
};

const columns: Column[] = [
  { id: 'Monitorando', title: 'Monitorando', description: 'Editais sendo acompanhados', cor: { topo: 'border-t-info', ponto: 'bg-info', lavagem: 'bg-info/5' } },
  { id: 'Em Análise', title: 'Analisando', description: 'Análise de viabilidade', cor: { topo: 'border-t-warning', ponto: 'bg-warning', lavagem: 'bg-warning/5' } },
  { id: 'Proposta Enviada', title: 'Proposta', description: 'Proposta elaborada e enviada', cor: { topo: 'border-t-primary', ponto: 'bg-primary', lavagem: 'bg-primary/5' } },
  // `--accent` e `--primary` são o mesmo verde nos dois temas: a coluna fica
  // idêntica à de antes, agora pelo token de ação em vez do de hover.
  { id: 'Em Disputa', title: 'Em Disputa', description: 'Disputa/pregão em andamento', cor: { topo: 'border-t-primary', ponto: 'bg-primary', lavagem: 'bg-primary/5' } },
  { id: 'Vencida', title: 'Vencida', description: 'Licitação arrematada', cor: { topo: 'border-t-success', ponto: 'bg-success', lavagem: 'bg-success/5' } },
  // Azul deixou de ser cor de estado no sistema: Homologada usa o token neutro.
  { id: 'Homologada', title: 'Homologada', description: 'Resultado homologado', cor: { topo: 'border-t-info', ponto: 'bg-info', lavagem: 'bg-info/5' } },
  { id: 'Perdida', title: 'Perdida', description: 'Não arrematada', cor: { topo: 'border-t-destructive', ponto: 'bg-destructive', lavagem: 'bg-destructive/5' } },
  { id: 'Arquivada', title: 'Arquivada', description: 'Processos encerrados', cor: { topo: 'border-t-muted-foreground', ponto: 'bg-muted-foreground', lavagem: 'bg-muted/60' } },
];

// A normalização mora em @/lib/licitacao/status — este arquivo tinha a sua
// própria cópia, uma das três listas divergentes que faziam o arquivamento
// automático nunca encontrar nada.

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

type DragState = { id: string; offsetX: number; offsetY: number } | null;
/** Ponteiro apertado num card, ainda sem saber se é clique ou arrasto. */
type ArrastoPendente = { id: string; x0: number; y0: number; offsetX: number; offsetY: number } | null;
/**
 * Quantos pixels o ponteiro precisa andar para o gesto virar arrasto. Até
 * 10/09/2026 o arrasto armava no próprio `pointerdown`: qualquer clique no
 * corpo do card já criava o card-fantasma e o sumia no `pointerup` — o
 * "abre rápido e volta ao normal" que o Ian viu.
 */
const LIMIAR_ARRASTO_PX = 6;

export default function KanbanPage() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { atualizarStatus, registrarPerda, arquivarProcesso } = useLicitacaoIntegration();
  // `?focus=<id>` vem do painel: destaca e rola até o card em vez de largar o
  // usuário num quadro de oito colunas para procurar o processo na mão.
  const [searchParams, setSearchParams] = useSearchParams();
  const focoId = searchParams.get('focus');
  // A aba ativa vive na URL (`?aba=compromissos`): quem abre uma pasta a
  // partir da aba Compromissos e clica em Voltar retorna à MESMA aba — antes
  // o histórico gravava `/kanban` seco e o retorno caía na aba padrão.
  const abaAtiva = ['kanban', 'compromissos', 'historico'].includes(searchParams.get('aba') || '')
    ? (searchParams.get('aba') as string)
    : 'kanban';
  const mudarAba = (v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === 'kanban') next.delete('aba'); else next.set('aba', v);
      return next;
    }, { replace: true });
  };
  const focoRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<LicitacaoKanban[]>([]);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<LicitacaoKanban | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);

  // Drag state — refs para leitura síncrona nos event handlers
  const dragStateRef = useRef<DragState>(null);
  const pendenteRef = useRef<ArrastoPendente>(null);
  // Houve arrasto desde o último `pointerdown`? O `click` que o navegador
  // dispara ao soltar um card arrastado não pode abrir/recolher o card.
  const arrastouRef = useRef(false);
  const overColRef = useRef<string | null>(null);
  const itemsRef = useRef<LicitacaoKanban[]>([]);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Estado React apenas para re-render visual
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [overColId, setOverColId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Ponteiro apertado, esperando o limiar — liga os ouvintes de documento.
  const [armando, setArmando] = useState(false);
  // Colunas sem nenhum processo ficam recolhidas por padrão: são oito ao todo,
  // e em notebook comum elas não cabem abertas.
  const [mostrarVazias, setMostrarVazias] = useState(false);
  /* Filtro do board, como a `kb-barra` do protótipo. Vale a pena porque a
     coluna rola horizontalmente: com trinta processos, achar um exige varrer
     o board com o olho. Filtra o que já está em memória — sem consulta nova. */
  const [filtro, setFiltro] = useState('');

  useEffect(() => { itemsRef.current = items; }, [items]);

  // Quantas colunas estão sem processo — define se o atalho de expandir aparece.
  const vazias = columns.filter(
    (c) => !items.some((i) => colunaDe(i) === c.id),
  ).length;

  const handleEdit = (lic: LicitacaoKanban) => { setEditItem(lic); setEditOpen(true); };
  /**
   * Cards abertos. O padrão é RECOLHIDO em duas linhas — identidade + valor,
   * órgão + data: toda a informação de triagem em ~55px. Clique em qualquer
   * ponto do card abre o quadro completo (objeto inteiro, local, ações);
   * outro clique recolhe. Até 10/09/2026 só a linha da identidade alternava e
   * o resto do card era só arrasto — quem clicava no órgão via o card-fantasma
   * piscar e nada abrir.
   * Ideia do dono do produto, com um aperfeiçoamento: valor e data são
   * critérios de VARREDURA ("qual vale a pena? qual vence antes?") — em vez
   * de escondê-los no recolhido, as duas linhas usam as pontas direitas.
   */
  const [cardsAbertos, setCardsAbertos] = useState<Set<string>>(new Set());
  const alternarCard = (id: string) => setCardsAbertos(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const handleSaved = (updated: LicitacaoKanban) => setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  const handleDeleted = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  // Move card (usado pelo drag e pelo dropdown)
  const moverCard = useCallback(async (id: string, toColId: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item || colunaDe(item) === toColId) return;

    // Arquivar deixou de ser um status e virou o eixo de visibilidade
    // (`arquivado_em`). Arrastar para a coluna Arquivada arquiva; arrastar para
    // fora restaura o processo com o status real que ele tinha, em vez de
    // reescrevê-lo como Monitorando.
    if (toColId === 'Arquivada') {
      const ok = await arquivarProcesso(id, true);
      if (ok) setItems(prev => prev.map(i => i.id === id ? { ...i, arquivado_em: new Date().toISOString() } : i));
      return;
    }
    if (item.arquivado_em) {
      const ok = await arquivarProcesso(id, false);
      if (!ok) return;
      setItems(prev => prev.map(i => i.id === id ? { ...i, arquivado_em: null } : i));
      // Restaurar já devolve o status original; só segue adiante se o usuário
      // pediu uma coluna diferente dela.
      if (item.status === toColId) return;
    }

    // "Perdida" exige motivo: o banco recusa a mudança de status sem registro
    // em comercial_perdas, então o card só se move depois do diálogo.
    if (toColId === 'Perdida') {
      setPerdaAlvo({
        licitacaoId: id,
        numero: item.numero,
        orgao: item.orgao,
        modalidade: item.modalidade ?? null,
        valorEstimado: item.valor_estimado,
      });
      return;
    }

    setItems(prev => prev.map(i => i.id === id ? { ...i, status: toColId } : i));
    await atualizarStatus(id, toColId, `Status alterado de "${item.status}" para "${toColId}" via Kanban.`);
  }, [atualizarStatus, arquivarProcesso]);

  const confirmarPerda = useCallback(async ({ motivoId, observacao }: { motivoId: string; observacao: string }) => {
    if (!perdaAlvo || !empresaAtiva) return;
    setSalvandoPerda(true);
    const ok = await registrarPerda({
      licitacaoId: perdaAlvo.licitacaoId,
      empresaId: empresaAtiva.id,
      motivoId,
      observacao,
      modalidade: perdaAlvo.modalidade,
      valorEstimado: perdaAlvo.valorEstimado,
    });
    setSalvandoPerda(false);
    if (!ok) return;
    setItems(prev => prev.map(i => i.id === perdaAlvo.licitacaoId ? { ...i, status: 'Perdida' } : i));
    setPerdaAlvo(null);
  }, [perdaAlvo, empresaAtiva, registrarPerda]);

  // Pointer Events — funciona em Chrome, Firefox, Safari, mobile.
  // O `pointerdown` só ANOTA onde o gesto começou; quem decide se é arrasto é
  // o `pointermove`, ao passar do limiar. Sem `preventDefault` aqui: o `click`
  // precisa continuar chegando ao card, é ele que abre/recolhe.
  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    // Ignora cliques secundários e elementos interativos filhos
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="menuitem"]')) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    arrastouRef.current = false;
    pendenteRef.current = {
      id, x0: e.clientX, y0: e.clientY,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
    };
    setArmando(true);
  }, []);

  useEffect(() => {
    if (!armando && !isDragging) return;

    const onMove = (e: PointerEvent) => {
      const p = pendenteRef.current;
      if (p && !dragStateRef.current) {
        if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < LIMIAR_ARRASTO_PX) return;
        // Passou do limiar: agora é arrasto, e o card-fantasma pode aparecer.
        dragStateRef.current = { id: p.id, offsetX: p.offsetX, offsetY: p.offsetY };
        arrastouRef.current = true;
        setDraggedId(p.id);
        setIsDragging(true);
      }
      if (!dragStateRef.current) return;
      e.preventDefault();
      setGhostPos({ x: e.clientX, y: e.clientY });

      // Detecta coluna sob o cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      let found: string | null = null;
      for (const [colId, ref] of Object.entries(columnRefs.current)) {
        if (ref && el && (ref === el || ref.contains(el as Node))) {
          found = colId;
          break;
        }
      }
      if (found !== overColRef.current) {
        overColRef.current = found;
        setOverColId(found);
      }
    };

    const onUp = async () => {
      pendenteRef.current = null;
      setArmando(false);
      // Soltou sem passar do limiar: foi clique, e o `onClick` do card cuida.
      if (!dragStateRef.current) return;
      const { id } = dragStateRef.current;
      const targetCol = overColRef.current;

      dragStateRef.current = null;
      overColRef.current = null;
      setDraggedId(null);
      setOverColId(null);
      setIsDragging(false);

      if (targetCol) await moverCard(id, targetCol);
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [armando, isDragging, moverCard]);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      // Semente da última visita: o quadro pinta na hora com o que já se viu,
      // e a consulta fresca corrige em silêncio logo atrás. O spinner só
      // existe na primeira carga a frio — era ele o "delay" de toda visita.
      const chaveSemente = ['kanban-semente', empresaAtiva?.id ?? user.id];
      const semente = qc.getQueryData<LicitacaoKanban[]>(chaveSemente);
      if (semente && semente.length > 0) { setItems(semente); setLoading(false); }
      // Quadro da equipe: escopo por empresa, não por usuário. O RLS já limita
      // às empresas das quais a pessoa é membro.
      let q = supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, status, modalidade, valor_estimado, uf, municipio, data_encerramento, arquivado_em');
      if (empresaAtiva) q = q.eq('empresa_id', empresaAtiva.id);
      const { data } = await q.order('created_at', { ascending: false });
      const mapeados = (data || []).map(item => ({ ...item, status: normalizeStatus(item.status) }));
      setItems(mapeados);
      qc.setQueryData(chaveSemente, mapeados);
      setLoading(false);
    };
    loadData();

    return undefined;
  }, [user, empresaAtiva, qc]);

  // Rola até o card destacado assim que ele existe no DOM.
  useEffect(() => {
    if (!focoId || loading) return;
    focoRef.current?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [focoId, loading, items.length]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      // Canal por empresa: mover um card precisa aparecer para o colega em
      // tempo real, que é o ponto de um quadro de equipe.
      .channel(`kanban-licitacoes-${empresaAtiva?.id ?? user.id}`)
      .on('postgres_changes', empresaAtiva
        ? { event: '*', schema: 'public', table: 'licitacoes', filter: `empresa_id=eq.${empresaAtiva.id}` }
        : { event: '*', schema: 'public', table: 'licitacoes' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setItems(prev => [{ ...(payload.new as LicitacaoKanban), status: normalizeStatus((payload.new as LicitacaoKanban).status) }, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as LicitacaoKanban;
          setItems(prev => prev.map(i => i.id === updated.id ? { ...updated, status: normalizeStatus(updated.status) } : i));
        } else if (payload.eventType === 'DELETE') {
          setItems(prev => prev.filter(i => i.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, empresaAtiva]);

  const totalValor = items.reduce((sum, i) => sum + (i.valor_estimado || 0), 0);

  /* Filtro do board. Busca em número, órgão e objeto — os três campos por onde
     alguém procura um processo. Normaliza acento e caixa para "orgao" achar
     "órgão", que é o erro de digitação mais comum aqui. */
  const itensFiltrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!termo) return items;
    return items.filter((i) =>
      [i.numero, i.orgao, i.objeto]
        .filter(Boolean)
        .some((c) => String(c).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(termo)),
    );
  }, [items, filtro]);

  // Ghost card (segue o cursor durante o drag)
  const draggedItem = draggedId ? items.find(i => i.id === draggedId) : null;
  const ds = dragStateRef.current;

  return (
    <AppLayout>
      {/* O Tabs envolve o cabeçalho porque a fila de abas mora DENTRO dele
          (entre título e conteúdo) e o Radix exige a lista sob a mesma raiz
          que os painéis. A aba ativa continua na URL, como antes. */}
      <Tabs value={abaAtiva} onValueChange={mudarAba}>
        {/* Título, descrição, ícone e trilha vêm de `lib/navegacao/paginas.ts`
            pela rota atual — a tela não repete o que já está padronizado. Os
            contadores, que antes moravam dentro da descrição, viraram a linha
            de apoio abaixo dela. */}
        <CabecalhoPagina>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{items.length}</span> processos
              {' · '}
              <span className="font-medium text-foreground tabular-nums">{formatCurrency(totalValor)}</span> estimados
            </p>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="compromissos" className="gap-2">
                <ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" /> Compromissos
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-2">
                <History className="h-4 w-4 shrink-0" aria-hidden="true" /> Histórico de extrações
              </TabsTrigger>
            </TabsList>
          </div>
        </CabecalhoPagina>

        <TabsContent value="kanban">
          {loading ? (
            <div className="flex gap-2 overflow-x-auto pb-4" role="status" aria-live="polite">
              <span className="sr-only">Carregando processos…</span>
              {columns.slice(0, 4).map((c) => (
                <div key={c.id} className="flex-1 min-w-48 space-y-2 rounded-lg border border-border bg-card p-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <EstadoVazio
                icone={<LayoutDashboard />}
                titulo="Nenhum processo no Kanban"
                descricao={
                  <>
                    Vá até o <strong>Monitoramento de Editais</strong> → aba <strong>Licitações</strong> e clique em <strong>"Iniciar"</strong> para converter um edital em processo gerenciado.
                  </>
                }
                acao={
                  <Button asChild variant="outline">
                    <Link to="/monitoramento-editais">Ir para o Monitoramento</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <>
            {/* REBRAND — a `kb-barra` do protótipo: controle de colunas vazias à
                esquerda, filtro à direita.
                Os botões "Compartilhar", "Gerar .xlsx" e "Imprimir" do desenho
                NÃO vieram: no protótipo eles não fazem nada, e botão que não
                faz nada num board de processo é pior que botão ausente. */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                {vazias > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setMostrarVazias(v => !v)}>
                    {mostrarVazias
                      ? 'Recolher colunas vazias'
                      : `Mostrar ${vazias} coluna(s) vazia(s)`}
                  </Button>
                )}
                {filtro && (
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {itensFiltrados.length} de {items.length} processos
                  </span>
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Filtrar no board..."
                  aria-label="Filtrar processos no board"
                  className="pl-9"
                />
              </div>
            </div>
            <div className={cn('flex gap-2 overflow-x-auto pb-4', isDragging && 'select-none')}>
              {columns.map((col) => {
                const colItems = itensFiltrados.filter((i) => colunaDe(i) === col.id);
                const isOver = overColId === col.id;
                // Enquanto se arrasta, tudo abre: esconder o destino seria pior
                // que ocupar espaço.
                const recolhida = !mostrarVazias && !isDragging && colItems.length === 0;
                return (
                  <div
                    key={col.id}
                    ref={(el) => { columnRefs.current[col.id] = el; }}
                    onClick={() => recolhida && setMostrarVazias(true)}
                    title={recolhida ? `${col.title} — vazia. Clique para expandir.` : undefined}
                    // A cor de cada estado saía num pontinho de 10px — o
                    // financeiro veste a coluna inteira, e a paridade foi
                    // pedida. Barra superior na cor + lavagem leve: identidade
                    // sem gritar sobre os cards.
                    className={cn(
                      'rounded-lg border border-border border-t-4 transition-all',
                      col.cor.topo,
                      col.cor.lavagem,
                      // Coluna vazia vira uma faixa estreita em vez de ocupar a
                      // largura de uma cheia. São oito colunas: em notebook de
                      // 1.366px elas nunca caberiam abertas, e a última saía
                      // cortada. Recolher as vazias devolve o espaço a quem tem
                      // trabalho — e elas continuam recebendo cartão arrastado.
                      recolhida
                        ? 'w-12 flex-shrink-0 p-2 cursor-pointer hover:bg-muted'
                        : 'flex-1 min-w-48 p-3',
                      isOver && isDragging && 'ring-2 ring-ring bg-primary-tint'
                    )}
                  >
                    {recolhida ? (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', col.cor.ponto)} aria-hidden="true" />
                        <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground [writing-mode:vertical-rl]">
                          {col.title}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">0</span>
                      </div>
                    ) : (
                    <>
                    <div className="mb-3 flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', col.cor.ponto)} aria-hidden="true" />
                      <h3 className="text-sm font-semibold leading-tight">{col.title}</h3>
                      <Badge variant="muted" className="ml-auto tabular-nums">{colItems.length}</Badge>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{col.description}</p>

                    <div className="min-h-32 space-y-2">
                      {colItems.length === 0 && (
                        <div className={cn(
                          'rounded-lg border-2 border-dashed border-border py-8 text-center transition-colors',
                          isOver && isDragging && 'border-primary/40 bg-primary-tint'
                        )}>
                          <p className="text-xs text-muted-foreground">
                            {isOver && isDragging ? 'Solte aqui' : 'Vazio'}
                          </p>
                        </div>
                      )}
                      {colItems.map((lic) => {
                        const aberto = cardsAbertos.has(lic.id);
                        const dataCurta = lic.data_encerramento
                          ? new Date(lic.data_encerramento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                          : null;
                        return (
                        <div
                          key={lic.id}
                          ref={lic.id === focoId ? focoRef : undefined}
                          role="button"
                          tabIndex={0}
                          aria-expanded={aberto}
                          className={cn(
                            'rounded-lg border border-border bg-card p-3 shadow-sm transition-[box-shadow,opacity] hover:shadow-md select-none touch-none',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            draggedId === lic.id ? 'opacity-30 cursor-grabbing' : 'cursor-pointer',
                            aberto && 'border-primary/40',
                            lic.id === focoId && 'ring-2 ring-ring border-primary/50'
                          )}
                          onPointerDown={(e) => handlePointerDown(e, lic.id)}
                          /* Três gestos no mesmo card, sem conflito:
                             - clique (em qualquer ponto) abre/recolhe;
                             - duplo clique abre o processo — `detail > 1`
                               deixa o segundo clique passar em branco, senão
                               ele desfaria o primeiro e o card piscaria;
                             - arrasto move, e o `click` que o navegador
                               dispara ao soltar é ignorado por `arrastouRef`.
                             Botões e itens de menu (que o React faz borbulhar
                             mesmo de dentro de portal) não alternam o card. */
                          onClick={(e) => {
                            if (arrastouRef.current) { arrastouRef.current = false; return; }
                            if (e.detail > 1) return;
                            if ((e.target as HTMLElement).closest('button, a, input, [role="menuitem"], [role="menu"]')) return;
                            alternarCard(lic.id);
                          }}
                          onDoubleClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, a, input, [role="menuitem"], [role="menu"]')) return;
                            handleEdit(lic);
                          }}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === 'Enter') { e.preventDefault(); handleEdit(lic); }
                            if (e.key === ' ') { e.preventDefault(); alternarCard(lic.id); }
                          }}
                          title={aberto ? 'Clique para recolher · duplo clique abre o processo' : 'Clique para ver mais · duplo clique abre o processo'}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/40" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              {/* Linha 1 — identidade à esquerda, VALOR à direita.
                                  O valor fica nos dois estados: é critério de
                                  varredura, não detalhe. */}
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold tabular-nums"
                                  title={lic.modalidade ?? undefined}>
                                  {identidadeDoProcesso(lic)}
                                </span>
                                {lic.valor_estimado ? (
                                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(lic.valor_estimado)}</span>
                                ) : null}
                              </div>

                              {/* Linha 2 — órgão à esquerda, DATA à direita. */}
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="truncate text-xs text-muted-foreground" title={lic.orgao ?? undefined}>
                                  {lic.orgao || '—'}
                                </p>
                                {!aberto && dataCurta && (
                                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{dataCurta}</span>
                                )}
                              </div>

                              {aberto && (
                                <>
                                  {/* Aberto, o objeto vem INTEIRO — o card
                                      já está expandido; clamp aqui seria
                                      esconder de quem acabou de pedir. */}
                                  <p className="mt-2 text-sm font-medium [overflow-wrap:anywhere]">
                                    {objetoLegivel(lic.objeto)}
                                  </p>
                                  {lic.arquivado_em && STATUS_DECIDIDOS.includes(normalizeStatus(lic.status) as never) && (
                                    <span className="mt-1 inline-block text-xs text-muted-foreground">
                                      desfecho: <span className="font-medium text-foreground">{normalizeStatus(lic.status)}</span>
                                    </span>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    {lic.municipio && lic.uf && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" aria-hidden="true" />
                                        {lic.municipio}/{lic.uf}
                                      </span>
                                    )}
                                    {lic.data_encerramento && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" aria-hidden="true" />
                                        {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                  </div>

                                  {/* Ações do card aberto. Eram dois ícones a 40%
                                      de opacidade no canto — ninguém achava.
                                      O menu "Mover" é a alternativa acessível ao
                                      arrasto: fica sempre. */}
                                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => { e.stopPropagation(); handleEdit(lic); }}
                                    >
                                      <Pencil aria-hidden="true" />
                                      Abrir processo
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="text-muted-foreground"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => e.stopPropagation()}
                                          title="Mover para outra etapa"
                                        >
                                          Mover
                                          <ChevronRight aria-hidden="true" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="w-44">
                                        {columns.filter(c => c.id !== colunaDe(lic)).map(c => (
                                          <DropdownMenuItem key={c.id} onClick={() => moverCard(lic.id, c.id)}>
                                            <span className={cn('mr-2 h-2 w-2 shrink-0 rounded-full', c.cor.ponto)} aria-hidden="true" />
                                            {c.title}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    </>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="compromissos"><CompromissosResumo /></TabsContent>
        <TabsContent value="historico"><HistoricoExtracoes /></TabsContent>
      </Tabs>

      {/* Ghost card que segue o cursor durante o drag */}
      {isDragging && draggedItem && ds && (
        <div
          className="pointer-events-none fixed z-[9999] w-60 rotate-1 opacity-95"
          style={{ left: ghostPos.x - ds.offsetX, top: ghostPos.y - ds.offsetY }}
        >
          <div className="rounded-lg border-2 border-primary/60 bg-card p-3 shadow-md">
            <p className="truncate text-sm font-semibold tabular-nums">{identidadeDoProcesso(draggedItem)}</p>
            <p className="mt-0.5 text-sm font-medium line-clamp-1 [overflow-wrap:anywhere]">{objetoLegivel(draggedItem.objeto)}</p>
            {draggedItem.municipio && draggedItem.uf && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden="true" />{draggedItem.municipio}/{draggedItem.uf}
              </p>
            )}
            {draggedItem.valor_estimado && (
              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatCurrency(draggedItem.valor_estimado)}</p>
            )}
          </div>
        </div>
      )}

      <EditLicitacaoDialog
        licitacao={editItem}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />

      <RegistrarPerdaDialog
        alvo={perdaAlvo}
        salvando={salvandoPerda}
        onCancelar={() => setPerdaAlvo(null)}
        onConfirmar={confirmarPerda}
      />
    </AppLayout>
  );
}
