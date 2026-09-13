import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { normalizarStatus as normalizeStatus, type StatusProcesso } from '@/lib/licitacao/status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { identidadeDoProcesso, objetoLegivel } from '@/lib/licitacao/identidade-do-processo';
import { MapPin, LayoutDashboard, Search, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useLarguraMinima } from '@/hooks/useLarguraMinima';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import EditLicitacaoDialog from '@/components/kanban/EditLicitacaoDialog';
import CartaoProcesso from '@/components/kanban/CartaoProcesso';
import {
  COLUNAS,
  colunaDe,
  formatarValor,
  type ProcessoDoQuadro,
} from '@/components/kanban/colunas';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import AbasGestao from '@/components/gestao/AbasGestao';
import CompromissosResumo from '@/components/gestao/CompromissosResumo';
import HistoricoExtracoes from '@/components/gestao/HistoricoExtracoes';

/**
 * Colunas, `colunaDe` e as pendências do cartão moram em
 * `@/components/kanban/colunas` — esta tela redeclarava os oito status num array
 * local, a quarta cópia do vocabulário que o princípio 1 do CLAUDE.md proíbe.
 */

/**
 * Largura a partir da qual o QUADRO inteiro aparece. Abaixo dela a pessoa
 * escolhe uma etapa por vez: oito colunas numa tela de 360px seriam oito tiras
 * de 40px, e o padrão visual é explícito — "Kanban por etapa selecionada", e
 * "nenhuma rolagem horizontal na página inteira".
 *
 * A decisão é em JS, não em `hidden md:flex`, porque as duas árvores não podem
 * coexistir: o cartão em foco (`?focus=`) leva um `ref` único e as colunas se
 * registram em `columnRefs` para o arrasto encontrar o destino — duas cópias
 * vivas fariam a segunda sobrescrever a primeira.
 */
const LARGURA_QUADRO_COMPLETO = 768;

/** Piso de largura de coluna fixado pelo comando: abaixo disto o cartão ilegível. */
const LARGURA_MINIMA_COLUNA = 'min-w-[260px]';

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
  const [items, setItems] = useState<ProcessoDoQuadro[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Mensagem real do banco quando a carga falha. Até 13/09/2026 a consulta
   * desestruturava só `{ data }` e jogava o `error` fora: uma falha de RLS, de
   * rede ou de coluna virava `data === null`, `items === []` e um quadro vazio
   * indistinguível de uma empresa sem processos. É a falha silenciosa que o
   * princípio 3 do CLAUDE.md proíbe — agora deixa rastro e oferece retry.
   */
  const [erro, setErro] = useState<string | null>(null);
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<ProcessoDoQuadro | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);
  /** Nome de quem responde por cada processo, por `operador_id`. */
  const [responsaveis, setResponsaveis] = useState<Record<string, string>>({});

  // Drag state — refs para leitura síncrona nos event handlers
  const dragStateRef = useRef<DragState>(null);
  const pendenteRef = useRef<ArrastoPendente>(null);
  // Houve arrasto desde o último `pointerdown`? O `click` que o navegador
  // dispara ao soltar um card arrastado não pode abrir/recolher o card.
  const arrastouRef = useRef(false);
  const overColRef = useRef<string | null>(null);
  const itemsRef = useRef<ProcessoDoQuadro[]>([]);
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
  /* Filtro do board. Vale a pena porque o quadro rola horizontalmente: com
     trinta processos, achar um exige varrer o board com o olho. Filtra o que já
     está em memória — sem consulta nova. */
  const [filtro, setFiltro] = useState('');

  // Tela estreita: uma etapa por vez, escolhida num seletor.
  const quadroCompleto = useLarguraMinima(LARGURA_QUADRO_COMPLETO);
  const [etapaFoco, setEtapaFoco] = useState<StatusProcesso>('Monitorando');

  useEffect(() => { itemsRef.current = items; }, [items]);

  const handleEdit = (lic: ProcessoDoQuadro) => { setEditItem(lic); setEditOpen(true); };
  /**
   * Cards abertos. O padrão é RECOLHIDO — processo + valor, órgão + prazo,
   * responsável + pendências: toda a informação de triagem em três linhas
   * curtas. Clique em qualquer ponto do card abre o quadro completo (objeto
   * inteiro, local, ações); outro clique recolhe.
   */
  const [cardsAbertos, setCardsAbertos] = useState<Set<string>>(new Set());
  const alternarCard = (id: string) => {
    // O `click` que o navegador dispara ao soltar um card arrastado chega aqui
    // como um clique comum — esta é a guarda que impede o arrasto de também
    // abrir/recolher o cartão que acabou de mudar de coluna.
    if (arrastouRef.current) { arrastouRef.current = false; return; }
    setCardsAbertos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  /** Merge, não substituição: o diálogo devolve só os campos que edita. */
  const handleSaved = (updated: { id: string } & Partial<ProcessoDoQuadro>) =>
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
  const handleDeleted = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  // Move card (usado pelo drag, pelo dropdown do card e pelo seletor do celular)
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

  const carregar = useCallback(async () => {
    if (!user) return;
    setErro(null);
    // Semente da última visita: o quadro pinta na hora com o que já se viu,
    // e a consulta fresca corrige em silêncio logo atrás. O spinner só
    // existe na primeira carga a frio — era ele o "delay" de toda visita.
    const chaveSemente = ['kanban-semente', empresaAtiva?.id ?? user.id];
    const semente = qc.getQueryData<ProcessoDoQuadro[]>(chaveSemente);
    if (semente && semente.length > 0) { setItems(semente); setLoading(false); }
    // Quadro da equipe: escopo por empresa, não por usuário. O RLS já limita
    // às empresas das quais a pessoa é membro.
    let q = supabase
      .from('licitacoes')
      // `operador_id` entrou aqui porque o cartão passou a mostrar RESPONSÁVEL:
      // a coluna já existia (Onda 3), só nunca tinha sido lida por esta tela.
      .select('id, numero, orgao, objeto, status, modalidade, valor_estimado, uf, municipio, data_encerramento, arquivado_em, operador_id');
    if (empresaAtiva) q = q.eq('empresa_id', empresaAtiva.id);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) {
      console.error('[kanban] carga do quadro', error);
      setErro(error.message || 'A consulta ao banco não retornou os processos.');
      setLoading(false);
      return;
    }
    const mapeados = (data || []).map(item => ({ ...item, status: normalizeStatus(item.status) })) as ProcessoDoQuadro[];
    setItems(mapeados);
    qc.setQueryData(chaveSemente, mapeados);
    setLoading(false);
  }, [user, empresaAtiva, qc]);

  useEffect(() => { void carregar(); }, [carregar]);

  /**
   * Nome de quem responde pelos processos em tela.
   *
   * Vai numa consulta separada porque `licitacoes` não tem FK declarada para
   * `profiles` — o join embutido do PostgREST não existe aqui. A chave é
   * `user_id` (o `id` da tabela é PK própria), como no resto do app.
   *
   * Falhar aqui não inventa pendência: "Sem responsável" olha `operador_id`,
   * que vem da consulta principal. Sem o nome, o cartão só deixa de exibi-lo.
   */
  const chaveOperadores = useMemo(
    () => [...new Set(items.map((i) => i.operador_id).filter(Boolean) as string[])].sort().join(','),
    [items],
  );
  useEffect(() => {
    const ids = chaveOperadores ? chaveOperadores.split(',') : [];
    if (ids.length === 0) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome_completo, username')
        .in('user_id', ids);
      if (cancelado) return;
      if (error) { console.warn('[kanban] nomes dos responsáveis', error); return; }
      setResponsaveis(Object.fromEntries(
        (data || []).map((p) => [p.user_id, p.nome_completo || p.username || 'Colaborador']),
      ));
    })();
    return () => { cancelado = true; };
  }, [chaveOperadores]);

  // Rola até o card destacado assim que ele existe no DOM.
  useEffect(() => {
    if (!focoId || loading) return;
    focoRef.current?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [focoId, loading, items.length]);

  // Em tela estreita só uma etapa está montada: sem isto, o `?focus=` de um
  // processo em Disputa não acharia o cartão porque a etapa em foco é outra.
  useEffect(() => {
    if (!focoId) return;
    const alvo = items.find((i) => i.id === focoId);
    if (alvo) setEtapaFoco(colunaDe(alvo));
  }, [focoId, items]);

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
          setItems(prev => [{ ...(payload.new as ProcessoDoQuadro), status: normalizeStatus((payload.new as ProcessoDoQuadro).status) }, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as ProcessoDoQuadro;
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

  /** Processos por etapa — serve às colunas e à contagem do seletor do celular. */
  const porEtapa = useMemo(() => {
    const mapa = new Map<StatusProcesso, ProcessoDoQuadro[]>(COLUNAS.map((c) => [c.id, []]));
    for (const item of itensFiltrados) mapa.get(colunaDe(item))?.push(item);
    return mapa;
  }, [itensFiltrados]);

  // Quantas colunas estão sem processo — define se o atalho de expandir aparece.
  const vazias = COLUNAS.filter((c) => (porEtapa.get(c.id)?.length ?? 0) === 0).length;

  // Ghost card (segue o cursor durante o drag)
  const draggedItem = draggedId ? items.find(i => i.id === draggedId) : null;
  const ds = dragStateRef.current;

  /** O cartão, montado igual nas duas larguras — quadro e etapa única. */
  const renderCartao = (lic: ProcessoDoQuadro) => (
    <CartaoProcesso
      key={lic.id}
      ref={lic.id === focoId ? focoRef : undefined}
      lic={lic}
      aberto={cardsAbertos.has(lic.id)}
      arrastando={draggedId === lic.id}
      focado={lic.id === focoId}
      responsavel={lic.operador_id ? responsaveis[lic.operador_id] ?? null : null}
      podeArrastar={quadroCompleto}
      onPointerDown={(e) => { if (quadroCompleto) handlePointerDown(e, lic.id); }}
      onAlternar={() => alternarCard(lic.id)}
      onEditar={() => handleEdit(lic)}
      onMover={(destino) => moverCard(lic.id, destino)}
    />
  );

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
        <CabecalhoPagina denso>
          <div className="flex flex-col gap-3">
            <p className="g-corpo text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{items.length}</span> processos
              {' · '}
              <span className="font-medium text-foreground tabular-nums">{formatarValor(totalValor)}</span> estimados
            </p>
            {/* `AbasGestao` e não `TabsList`: as abas do módulo são sublinhadas,
                com a ativa em verde. A pílula do shadcn é outra linguagem, e
                duas linguagens de aba no mesmo módulo fazem a pessoa achar que
                está em outro lugar do sistema. Os ícones saem junto — nenhuma
                outra tela de Gestão os tem na fila de abas. */}
            <AbasGestao
              abas={[
                { valor: 'kanban', rotulo: 'Kanban' },
                { valor: 'compromissos', rotulo: 'Compromissos' },
                { valor: 'historico', rotulo: 'Histórico de extrações' },
              ]}
              valor={abaAtiva}
              aoMudar={mudarAba}
            />
          </div>
        </CabecalhoPagina>

        <TabsContent value="kanban" className="space-y-4">
          {/* Princípio 3: a carga que falha deixa rastro e oferece retry. Fica
              acima do quadro porque, havendo semente da última visita, o que se
              vê abaixo é antigo — e a pessoa precisa saber disso. */}
          {erro && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Não foi possível carregar o quadro</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{erro}</p>
                {items.length > 0 && (
                  <p>O quadro abaixo é o da última visita e pode estar desatualizado.</p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setLoading(items.length === 0); void carregar(); }}
                >
                  <RefreshCw aria-hidden="true" />
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-4" role="status" aria-live="polite">
              <span className="sr-only">Carregando processos…</span>
              {COLUNAS.slice(0, 4).map((c) => (
                <div key={c.id} className={cn('g-cartao flex-1 space-y-2 p-3', LARGURA_MINIMA_COLUNA)}>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            // Com erro na tela, "nenhum processo" seria uma afirmação falsa
            // sobre a empresa: o que se sabe é que a consulta não respondeu.
            erro ? null : (
              <div className="g-cartao">
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
            )
          ) : (
            <>
            {/* Barra do quadro: controle de colunas vazias à esquerda, filtro à
                direita. Os botões "Compartilhar", "Gerar .xlsx" e "Imprimir" do
                desenho NÃO vieram: no protótipo eles não fazem nada, e botão que
                não faz nada num board de processo é pior que botão ausente. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                {/* Recolher vazias só existe onde há oito colunas ao mesmo
                    tempo; no celular o seletor já mostra uma etapa por vez. */}
                {quadroCompleto && vazias > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setMostrarVazias(v => !v)}>
                    {mostrarVazias
                      ? 'Recolher colunas vazias'
                      : `Mostrar ${vazias} coluna(s) vazia(s)`}
                  </Button>
                )}
                {filtro && (
                  <span className="g-corpo text-muted-foreground tabular-nums">
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
                  className="g-controle pl-9"
                />
              </div>
            </div>

            {quadroCompleto ? (
              /* O QUADRO. `overflow-x-auto` aqui e `min-w-[260px]` em cada
                 coluna: a rolagem horizontal é LOCAL, e as oito colunas param
                 de se espremer para caber na janela. Em notebook de 1.366px
                 cabem cinco por vez e as outras três estão a um arrasto de
                 distância — melhor que oito tiras de 150px onde nem o número do
                 processo cabe. */
              <div
                className={cn('flex gap-3 overflow-x-auto pb-4', isDragging && 'select-none')}
                role="list"
                aria-label="Etapas do processo"
              >
                {COLUNAS.map((col) => {
                  const colItems = porEtapa.get(col.id) ?? [];
                  const isOver = overColId === col.id;
                  // Enquanto se arrasta, tudo abre: esconder o destino seria pior
                  // que ocupar espaço.
                  const recolhida = !mostrarVazias && !isDragging && colItems.length === 0;
                  return (
                    <div
                      key={col.id}
                      role="listitem"
                      ref={(el) => { columnRefs.current[col.id] = el; }}
                      onClick={() => recolhida && setMostrarVazias(true)}
                      title={recolhida ? `${col.title} — vazia. Clique para expandir.` : undefined}
                      // A cor de cada estado saía num pontinho de 10px — o
                      // financeiro veste a coluna inteira, e a paridade foi
                      // pedida. Barra superior na cor + lavagem leve: identidade
                      // sem gritar sobre os cards.
                      className={cn(
                        'rounded-[var(--g-raio)] border border-border border-t-4 transition-[background-color,box-shadow]',
                        col.cor.topo,
                        col.cor.lavagem,
                        // Coluna vazia vira uma faixa estreita em vez de ocupar a
                        // largura de uma cheia. Recolher as vazias devolve o
                        // espaço a quem tem trabalho — e elas continuam recebendo
                        // cartão arrastado.
                        recolhida
                          ? 'w-12 flex-shrink-0 p-2 cursor-pointer hover:bg-muted'
                          : cn('flex-1 p-3', LARGURA_MINIMA_COLUNA),
                        isOver && isDragging && 'ring-2 ring-ring bg-primary-tint'
                      )}
                    >
                      {recolhida ? (
                        <div className="flex flex-col items-center gap-2 py-1">
                          <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', col.cor.ponto)} aria-hidden="true" />
                          <span className="whitespace-nowrap g-meta font-semibold text-muted-foreground [writing-mode:vertical-rl]">
                            {col.title}
                          </span>
                          <span className="g-meta text-muted-foreground tabular-nums">0</span>
                        </div>
                      ) : (
                      <>
                      <div className="mb-3 flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', col.cor.ponto)} aria-hidden="true" />
                        <h3 className="text-sm font-semibold leading-tight">{col.title}</h3>
                        <Badge variant="muted" className="ml-auto tabular-nums">{colItems.length}</Badge>
                      </div>
                      <p className="mb-3 g-meta text-muted-foreground line-clamp-2">{col.description}</p>

                      <div className="min-h-32 space-y-2">
                        {colItems.length === 0 && (
                          <div className={cn(
                            'rounded-[var(--g-raio)] border-2 border-dashed border-border py-8 text-center transition-colors',
                            isOver && isDragging && 'border-primary/40 bg-primary-tint'
                          )}>
                            <p className="g-meta text-muted-foreground">
                              {isOver && isDragging ? 'Solte aqui' : 'Vazio'}
                            </p>
                          </div>
                        )}
                        {colItems.map(renderCartao)}
                      </div>
                      </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* CELULAR — uma etapa por vez. O quadro inteiro numa tela de
                 360px vira miniatura ilegível, e o padrão visual proíbe rolagem
                 horizontal na página. O seletor traz a contagem de cada etapa
                 para a escolha não ser às cegas. */
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="kanban-etapa" className="g-meta font-medium text-muted-foreground">
                    Etapa
                  </label>
                  <Select
                    value={etapaFoco}
                    onValueChange={(v) => setEtapaFoco(v as StatusProcesso)}
                  >
                    <SelectTrigger id="kanban-etapa" aria-label="Etapa" className="g-controle">
                      <SelectValue>
                        {COLUNAS.find((c) => c.id === etapaFoco)?.title} ({porEtapa.get(etapaFoco)?.length ?? 0})
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COLUNAS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', c.cor.ponto)} aria-hidden="true" />
                            {c.title}
                            <span className="text-muted-foreground tabular-nums">
                              ({porEtapa.get(c.id)?.length ?? 0})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <p className="g-meta text-muted-foreground">
                  {COLUNAS.find((c) => c.id === etapaFoco)?.description}
                </p>

                <div className="space-y-2">
                  {(porEtapa.get(etapaFoco)?.length ?? 0) === 0 ? (
                    <div className="g-cartao">
                      <EstadoVazio
                        tamanho="compacto"
                        titulo="Nenhum processo nesta etapa"
                        descricao="Escolha outra etapa no seletor acima."
                      />
                    </div>
                  ) : (
                    porEtapa.get(etapaFoco)?.map(renderCartao)
                  )}
                </div>

                {/* Sem arrasto aqui: a alternativa é o menu "Mover" do cartão
                    aberto, e o Select de Status dentro de "Abrir processo". */}
                <p className="g-meta text-muted-foreground">
                  Para mudar um processo de etapa, toque no cartão e use <strong>Mover</strong>.
                </p>
              </div>
            )}
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
          <div className="rounded-[var(--g-raio)] border-2 border-primary/60 bg-card p-3 shadow-md">
            <p className="truncate text-sm font-semibold tabular-nums">{identidadeDoProcesso(draggedItem)}</p>
            <p className="mt-0.5 text-sm font-medium line-clamp-1 [overflow-wrap:anywhere]">{objetoLegivel(draggedItem.objeto)}</p>
            {draggedItem.municipio && draggedItem.uf && (
              <p className="mt-2 flex items-center gap-1 g-meta text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden="true" />{draggedItem.municipio}/{draggedItem.uf}
              </p>
            )}
            {draggedItem.valor_estimado && (
              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatarValor(draggedItem.valor_estimado)}</p>
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
