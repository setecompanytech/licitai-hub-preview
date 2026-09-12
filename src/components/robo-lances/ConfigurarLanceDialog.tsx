import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Bot, Trash2, Package, Layers, FileSearch, Loader2, Search, CheckCircle2, Building2, ArrowRight, Pencil, Calculator, Upload, FileText, Sparkles , Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { useEditalExtraction, type LicitacaoItem } from '@/hooks/useEditalExtraction';
import { useLinkedEditalSource } from '@/hooks/useLinkedEditalSource';
import LimparItensExtraidosButton from '@/components/licitacoes/LimparItensExtraidosButton';
import { PORTAIS_ROBO, idDoPortal } from '@/lib/robo/portais';
import { cn } from '@/lib/utils';

// A lista mora em `src/lib/robo/portais.ts`, autoridade unica compartilhada com
// o despacho da sessao. Ela existia aqui e, diferente, no CredenciaisPortalForm.
//
// ATENCAO: o `value` do SelectItem abaixo continua sendo o NOME, nao o id, para
// nao quebrar a exibicao das disputas ja gravadas. Quem consome traduz com
// `idDoPortal()`. Corrigir na origem exige normalizar tambem o carregamento do
// formulario — fica registrado como pendencia.
// Os 23 da autoridade única — a mesma lista do cadastro de credenciais, que até
// 09/09/2026 tinha 23 enquanto esta tinha 10. Registrar a disputa é legítimo em
// qualquer portal; quem checa se o robô consegue operá-la é o botão "Enviar ao
// robô", contra o `portais_suportados` que o agente publica no momento do envio.
const portaisDisponiveis = PORTAIS_ROBO;

export type DisputeItem = {
  id: string;
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorReferencia: number;
  /**
   * Piso PRÓPRIO deste item.
   *
   * `null` significa "não definido", e é informação. Antes isto era `0` fixo
   * em todo item importado: um piso que ninguém escolheu, com cara de
   * preenchido, igual para itens de margens completamente diferentes. Zero é
   * uma afirmação falsa sobre dinheiro — do tipo que não se confere justamente
   * porque parece que alguém já preencheu.
   */
  valorMinimo: number | null;
  lote: string;
  disputando: boolean;
  situacao: 'aguardando' | 'disputando' | 'encerrado';
  melhorLance: number | null;
  seuUltimoLance: number | null;
  /** Somente leitura: identifica o produto ofertado (fonte: licitacao_itens). */
  marca?: string;
  modelo?: string;
  /**
   * Custo interno, quando a Precificação o conhece. É a fonte do piso
   * sugerido — e NÃO é preço: nunca deve ser oferecido como valor de lance.
   */
  custoUnitario?: number | null;
  /** Teto publicado pelo órgão no edital, quando extraído. */
  valorEstimadoOrgao?: number | null;
  /**
   * De onde `valorReferencia` veio: 'precificacao' | 'proposta' | 'ia' |
   * 'manual'. Existe para o operador enxergar qual número está ancorando a
   * disputa — a mesma coluna já era gravada corretamente pelos outros módulos.
   */
  origem?: string;
};

export type LanceConfig = {
  id: string;
  edital: string;
  portal: string;
  valorReferencia: number;
  valorInicial: number;
  valorMinimo: number;
  decrementoMin: number;
  decrementoPercentual: number;
  intervaloSegundos: number;
  maxLances: number;
  modoAutomatico: boolean;
  status: 'aguardando' | 'ativo' | 'vencendo' | 'perdendo' | 'encerrado';
  horario: string;
  meuLance: number;
  valorAtual: number;
  itens: DisputeItem[];
  tipoDisputa: 'item' | 'lote';
  licitacaoId?: string;
  /**
   * Código da unidade compradora (UASG), 6 dígitos — só faz sentido no
   * Compras.gov. Existe porque o número da compra NÃO é único lá: em
   * 10/09/2026 a busca "Em disputa" devolveu cinco "N° 1/2022", de cinco
   * órgãos. Com a UASG o robô preenche "Unidade compradora" e acha a certa.
   */
  uasg?: string;
};

type LicitacaoRow = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  portal: string | null;
  data_encerramento: string | null;
  data_abertura: string | null;
};

/**
 * De onde veio o número que ancora a disputa.
 *
 * Existe porque as três origens significam coisas diferentes e, olhando só o
 * valor, são indistinguíveis: o teto do órgão, o nosso preço de venda e um
 * custo interno aparecem todos como "R$ alguma coisa". Quem opera precisa ver
 * a diferença ANTES de mandar o robô, não depois.
 */
const ROTULO_ORIGEM: Record<string, { texto: string; titulo: string }> = {
  precificacao: {
    texto: 'Precificação',
    titulo: 'Preço de venda calculado na Precificação',
  },
  proposta: {
    texto: 'Proposta',
    titulo: 'Preço de venda vindo da Proposta Comercial',
  },
  ia: {
    texto: 'Edital',
    titulo: 'Valor estimado pelo órgão, extraído do edital — é teto, não é o nosso preço',
  },
  manual: {
    texto: 'Manual',
    titulo: 'Digitado à mão nesta tela',
  },
};

const paraBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * A linha de UM item na tabela de itens da disputa.
 *
 * É componente, e não JSX repetido, porque a mesma linha é desenhada em dois
 * lugares — a visão agrupada por lote e a visão plana. Duas cópias divergem:
 * neste mesmo módulo a lista de portais chegou a ter 10 num arquivo e 23 no
 * outro, e ninguém percebeu até um portal sumir da tela.
 */
function LinhaDeItem({
  item,
  larguraDescricao,
  aoMudarPiso,
  aoRemover,
}: {
  item: DisputeItem;
  larguraDescricao: string;
  aoMudarPiso: (id: string, texto: string) => void;
  aoRemover: (id: string) => void;
}) {
  // `null` e `0` são estados diferentes e a tela precisa mostrar essa
  // diferença: um piso zerado autoriza o robô a descer até zero; um piso
  // ausente é uma decisão que ninguém tomou ainda.
  const semPiso = item.valorMinimo === null || item.valorMinimo === undefined;
  const rotulo = item.origem ? ROTULO_ORIGEM[item.origem] : undefined;

  return (
    <TableRow>
      <TableCell className="text-xs text-center font-medium">{item.numero}</TableCell>
      <TableCell className={`text-xs ${larguraDescricao}`}>
        <span className="block truncate">{item.descricao}</span>
        {(item.marca || item.modelo) && (
          <span className="block truncate text-muted-foreground">
            {[item.marca, item.modelo].filter(Boolean).join(' · ')}
          </span>
        )}
        {rotulo && (
          <span
            title={rotulo.titulo}
            className="inline-block mt-0.5 px-1 py-px rounded bg-muted text-[10px] leading-tight text-muted-foreground"
          >
            {rotulo.texto}
          </span>
        )}
      </TableCell>
      <TableCell className="text-xs text-center">{item.quantidade}</TableCell>
      <TableCell className="text-xs text-center">{item.unidade}</TableCell>
      <TableCell className="text-xs text-right font-mono">
        {item.valorReferencia > 0 ? paraBRL(item.valorReferencia) : '—'}
      </TableCell>
      <TableCell className="text-xs text-right font-mono font-semibold">
        {item.valorReferencia > 0 ? paraBRL(item.valorReferencia * item.quantidade) : '—'}
      </TableCell>
      <TableCell className="text-right">
        <Input
          value={semPiso ? '' : String(item.valorMinimo)}
          onChange={(e) => aoMudarPiso(item.id, e.target.value)}
          placeholder="definir"
          inputMode="decimal"
          title={
            item.custoUnitario !== null && item.custoUnitario !== undefined
              ? `Sugerido a partir do custo da Precificação: ${paraBRL(item.custoUnitario)}`
              : 'Sem custo conhecido para sugerir — defina o piso deste item'
          }
          className={`h-7 w-[88px] text-xs text-right font-mono px-1.5 ml-auto ${
            semPiso ? 'border-warning/60 placeholder:text-warning' : ''
          }`}
        />
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={() => aoRemover(item.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Helper: convert LicitacaoItem[] to DisputeItem[]
function licitacaoItensToDispute(items: LicitacaoItem[]): DisputeItem[] {
  return items.map((item, idx) => ({
    id: crypto.randomUUID(),
    numero: item.numero || idx + 1,
    descricao: item.descricao,
    // Marca e modelo são do CADASTRO da proposta, não da disputa (nela só o
    // preço muda). Viajam apenas como leitura, para o operador saber por qual
    // produto está baixando o preço — sem virar segunda fonte do dado.
    marca: item.marca || undefined,
    modelo: item.modelo || undefined,
    quantidade: item.quantidade || 1,
    unidade: item.unidade || 'UN',
    valorReferencia: item.valor_unitario || 0,
    // O custo sugere o piso, e nada mais. Sem custo conhecido o piso fica
    // NULO e visível na tabela, pedindo a decisão — em vez de zero silencioso.
    custoUnitario: item.custo_unitario ?? null,
    valorMinimo: item.custo_unitario ?? null,
    origem: item.origem || undefined,
    lote: item.lote || 'Único',
    disputando: true,
    situacao: 'aguardando' as const,
    melhorLance: null,
    seuUltimoLance: null,
  }));
}

type Props = {
  onSave: (lance: LanceConfig) => void;
  editingLance?: LanceConfig | null;
  trigger?: React.ReactNode;
  /** Processo aberto no prontuário — a disputa nasce dele, sem reseleção. */
  processoAtivoId?: string | null;
};

export default function ConfigurarLanceDialog({ onSave, editingLance, trigger, processoAtivoId }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { fetchItens, extrairItensDoTexto, extrairItensIA } = useEditalExtraction();
  const { resolveLinkedEditalText } = useLinkedEditalSource();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(editingLance ? 1 : 0);

  // Step 0 – Import
  const [licitacoes, setLicitacoes] = useState<LicitacaoRow[]>([]);
  const [loadingLicitacoes, setLoadingLicitacoes] = useState(false);
  const [searchLic, setSearchLic] = useState('');
  const [selectedLicId, setSelectedLicId] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [trocarProcesso, setTrocarProcesso] = useState(false);

  // Step 0 – AI Extraction
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showEditalUpload, setShowEditalUpload] = useState(false);
  const [autoExtractTriggered, setAutoExtractTriggered] = useState(false);
  const editalFileRef = useRef<HTMLInputElement>(null);

  // Step 1 fields
  const [edital, setEdital] = useState(editingLance?.edital || '');
  const [portal, setPortal] = useState(editingLance?.portal || '');
  const [uasg, setUasg] = useState(editingLance?.uasg || '');
  // O Compras.gov busca por "número+ano" e por UASG; os outros portais, não.
  const ehComprasGov = idDoPortal(portal) === 'compras-gov';
  const [decrementoMin, setDecrementoMin] = useState(editingLance?.decrementoMin?.toString() || '');
  const [decrementoPercentual, setDecrementoPercentual] = useState(editingLance?.decrementoPercentual?.toString() || '1.5');
  const [intervaloSegundos, setIntervaloSegundos] = useState(editingLance?.intervaloSegundos?.toString() || '30');
  const [maxLances, setMaxLances] = useState(editingLance?.maxLances?.toString() || '20');
  const [modoAutomatico, setModoAutomatico] = useState(editingLance?.modoAutomatico ?? true);
  const [horario, setHorario] = useState(editingLance?.horario || '');

  // Step 2 fields
  const [tipoDisputa, setTipoDisputa] = useState<'item' | 'lote'>(editingLance?.tipoDisputa || 'item');
  const [itens, setItens] = useState<DisputeItem[]>(editingLance?.itens || []);
  const [licitacaoIdRef, setLicitacaoIdRef] = useState<string | undefined>(editingLance?.licitacaoId);

  // Step 2 – User edits R$ values directly; % is auto-calculated
  const [valorInicialInput, setValorInicialInput] = useState(editingLance ? String(editingLance.valorInicial) : '');
  const [valorMinimoInput, setValorMinimoInput] = useState(editingLance ? String(editingLance.valorMinimo) : '');

  // New item form
  const [novoDesc, setNovoDesc] = useState('');
  const [novoQtd, setNovoQtd] = useState('1');
  const [novoUnidade, setNovoUnidade] = useState('UN');
  const [novoValorRef, setNovoValorRef] = useState('');
  const [novoLote, setNovoLote] = useState('');

  // ── Auto-calculated values from items ──
  const somaReferencia = useMemo(() => {
    return itens.reduce((sum, item) => sum + (item.valorReferencia * item.quantidade), 0);
  }, [itens]);

  const valorInicial = parseFloat(valorInicialInput) || 0;
  const valorMinimo = parseFloat(valorMinimoInput) || 0;

  const pctDescontoInicial = useMemo(() => {
    if (somaReferencia <= 0) return 0;
    return Math.round(((somaReferencia - valorInicial) / somaReferencia) * 10000) / 100;
  }, [somaReferencia, valorInicial]);

  const pctDescontoMinimo = useMemo(() => {
    if (somaReferencia <= 0) return 0;
    return Math.round(((somaReferencia - valorMinimo) / somaReferencia) * 10000) / 100;
  }, [somaReferencia, valorMinimo]);

  const inexequibilidadeInicial = pctDescontoInicial > 50;
  const inexequibilidadeMinimo = pctDescontoMinimo > 50;

  const applyImportedItems = (importedItems: DisputeItem[]) => {
    setItens(importedItems);
    const uniqueLotes = [...new Set(importedItems.map(i => i.lote))].filter(l => l && l !== 'Único');
    if (uniqueLotes.length > 1 || (uniqueLotes.length === 1 && importedItems.filter(i => i.lote === uniqueLotes[0]).length > 1)) {
      setTipoDisputa('lote');
    } else {
      setTipoDisputa('item');
    }
    if (importedItems.length > 0) {
      const total = importedItems.reduce((s, i) => s + (i.valorReferencia * i.quantidade), 0);
      setValorInicialInput(String(Math.round(total * 0.95 * 100) / 100));
      setValorMinimoInput(String(Math.round(total * 0.80 * 100) / 100));
    }
  };

  const extractFromText = useCallback(async (text: string): Promise<DisputeItem[]> => {
    try {
      const parsed = await extrairItensDoTexto(text, { skipValidation: true });
      if (parsed.length === 0) return [];

      const extractedItems: DisputeItem[] = parsed.map((p, idx) => ({
        id: crypto.randomUUID(),
        numero: parseInt(String(p.item ?? idx + 1), 10) || (idx + 1),
        descricao: p.descricao || '',
        quantidade: p.quantidade || 1,
        unidade: p.unidade || 'UN',
        valorReferencia: p.valor_unitario || 0,
        // Extraído do EDITAL: este número é o teto do órgão, não o nosso preço
        // e muito menos o nosso custo. Nomeá-lo evita que a disputa parta de
        // uma âncora achando que é outra.
        valorEstimadoOrgao: p.valor_unitario ?? null,
        valorMinimo: null,
        origem: 'ia',
        lote: p.lote || 'Único',
        disputando: true,
        situacao: 'aguardando' as const,
        melhorLance: null,
        seuUltimoLance: null,
      }));

      applyImportedItems(extractedItems);
      toast.success(`${parsed.length} itens extraídos via IA!`);
      return extractedItems;
    } catch (error) {
      console.error('Erro ao processar itens do edital:', error);
      toast.error('Erro ao processar itens do edital.');
      return [];
    }
  }, [extrairItensDoTexto]);

  // Busca itens de fontes alternativas (Precificação e Proposta) quando
  // a tabela centralizada `licitacao_itens` está vazia. Os itens encontrados
  // são persistidos em `licitacao_itens` para reuso em todos os módulos.
  const fetchItensDeFontesAlternativas = useCallback(async (licId: string): Promise<DisputeItem[]> => {
    if (!user) return [];
    try {
      // 1) Catálogo de Precificação
      //
      // `custo_unitario` entra no select porque a Precificação JÁ separa custo
      // de preço de venda — as duas colunas existem lá, lado a lado. Ler só o
      // preço e descartar o custo era o começo do achatamento: depois desta
      // consulta não havia mais como distinguir os dois, e o mesmo campo podia
      // estar carregando qualquer um dos dois significados.
      const { data: precificados } = await supabase
        .from('catalogo_itens_precificados')
        .select('descricao, quantidade, unidade, preco_unitario, custo_unitario, marca, fabricante, modelo')
        .eq('licitacao_id', licId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      // 2) Composições de Custo da Proposta Comercial
      const { data: composicoes } = await supabase
        .from('composicoes_custo')
        .select('descricao_item, dados_json')
        .eq('licitacao_id', licId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      // `custo` viaja separado de `valor` — são coisas diferentes, e juntá-las
      // num campo só foi o defeito. `null` em qualquer um significa "não
      // sabido", que é diferente de zero.
      const fontes: Array<{
        descricao: string;
        quantidade: number;
        unidade: string;
        valor: number | null;
        custo: number | null;
        lote: string;
        marca: string | null;
        fabricante: string | null;
        modelo: string | null;
        origem: 'precificacao' | 'proposta';
      }> = [];

      (precificados || []).forEach((p: any) => {
        if (p.descricao) fontes.push({
          descricao: p.descricao,
          quantidade: Number(p.quantidade) || 1,
          unidade: p.unidade || 'UN',
          valor: Number.isFinite(Number(p.preco_unitario)) ? Number(p.preco_unitario) : null,
          custo: Number.isFinite(Number(p.custo_unitario)) ? Number(p.custo_unitario) : null,
          lote: 'Único',
          // Já vinham do select e eram descartados: o item chegava sem marca
          // na disputa mesmo com a Precificação sabendo qual era.
          marca: p.marca || null,
          fabricante: p.fabricante || null,
          modelo: p.modelo || null,
          origem: 'precificacao',
        });
      });

      (composicoes || []).forEach((c: any) => {
        const dados = c.dados_json || {};
        // O FALLBACK PERIGOSO, REMOVIDO.
        //
        // Era `dados.preco_venda || dados.valor_unitario`. Numa composição de
        // CUSTO, `valor_unitario` é plausivelmente uma linha de custo — então
        // o robô podia entrar na disputa ancorado abaixo do nosso próprio
        // preço, e nada na tela denunciaria isso: o campo aparecia preenchido,
        // com um número que parecia certo.
        //
        // Sem `preco_venda` explícito o preço fica NULO e a tela pede. Vazio
        // pedindo é melhor que errado convincente.
        const precoVenda = Number(dados.preco_venda);
        if (c.descricao_item) fontes.push({
          descricao: c.descricao_item,
          quantidade: Number(dados.quantidade) || 1,
          unidade: dados.unidade || 'UN',
          valor: Number.isFinite(precoVenda) && precoVenda > 0 ? precoVenda : null,
          custo: Number.isFinite(Number(dados.custo_unitario)) ? Number(dados.custo_unitario) : null,
          lote: dados.lote || 'Único',
          marca: dados.marca || null,
          fabricante: dados.fabricante || null,
          modelo: dados.modelo || null,
          origem: 'proposta',
        });
      });

      if (fontes.length === 0) return [];

      // Deduplica por descrição (case-insensitive)
      const seen = new Set<string>();
      const unique = fontes.filter(f => {
        const k = f.descricao.toLowerCase().trim();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // Persiste na fonte central para reuso futuro
      try {
        await supabase.from('licitacao_itens').insert(
          unique.map((f, idx) => ({
            licitacao_id: licId,
            user_id: user.id,
            numero: idx + 1,
            descricao: f.descricao,
            quantidade: f.quantidade,
            unidade: f.unidade,
            valor_unitario: f.valor ?? 0,
            valor_total: (f.valor ?? 0) * f.quantidade,
            custo_unitario: f.custo,
            marca: f.marca,
            fabricante: f.fabricante,
            modelo: f.modelo,
            lote: f.lote,
            // A ORIGEM VERDADEIRA, não 'importado'.
            //
            // `f.origem` já dizia 'precificacao' ou 'proposta' — a informação
            // estava na mão e era jogada fora exatamente aqui, na gravação.
            // Os outros escritores desta tabela (extração por IA, cadastro
            // manual) sempre gravaram a origem real; só este caminho achatava,
            // e o resultado era não dar mais para saber de onde veio o número
            // que ancorava a disputa.
            origem: f.origem,
          }))
        );
      } catch (e) {
        console.warn('Não foi possível persistir em licitacao_itens:', e);
      }

      return unique.map((f, idx) => ({
        id: crypto.randomUUID(),
        numero: idx + 1,
        descricao: f.descricao,
        quantidade: f.quantidade,
        unidade: f.unidade,
        valorReferencia: f.valor ?? 0,
        custoUnitario: f.custo,
        // O custo sugere o piso; sem custo o piso fica nulo e a tela pede.
        valorMinimo: f.custo,
        origem: f.origem,
        marca: f.marca || undefined,
        modelo: f.modelo || undefined,
        lote: f.lote,
        disputando: true,
        situacao: 'aguardando' as const,
        melhorLance: null,
        seuUltimoLance: null,
      }));
    } catch (e) {
      console.error('Erro ao buscar itens de fontes alternativas:', e);
      return [];
    }
  }, [user]);

  const fetchLicitacoes = useCallback(async () => {
    if (!user) return;
    setLoadingLicitacoes(true);
    try {
      let q = supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, portal, data_encerramento, data_abertura');
      if (empresaAtiva) q = q.eq('empresa_id', empresaAtiva.id);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      setLicitacoes((data as LicitacaoRow[]) || []);
    } catch {
      toast.error('Erro ao carregar processos.');
    } finally {
      setLoadingLicitacoes(false);
    }
  }, [user, empresaAtiva]);

  useEffect(() => {
    if (open && step === 0) {
      fetchLicitacoes();
    }
  }, [open, step, fetchLicitacoes]);

  const handleAutoExtractItems = useCallback(async () => {
    if (isExtracting) return;
    setIsExtracting(true);

    try {
      if (licitacaoIdRef) {
        const centralItens = await fetchItens(licitacaoIdRef);
        if (centralItens.length > 0) {
          const importedItems = licitacaoItensToDispute(centralItens);
          applyImportedItems(importedItems);
          toast.success(`${importedItems.length} itens carregados da fonte central!`);
          setIsExtracting(false);
          return;
        }

        // 🔄 Fallback: buscar de Precificação e Proposta Comercial
        const alternativos = await fetchItensDeFontesAlternativas(licitacaoIdRef);
        if (alternativos.length > 0) {
          applyImportedItems(alternativos);
          toast.success(`✅ ${alternativos.length} itens importados da Precificação/Proposta!`);
          setIsExtracting(false);
          return;
        }
      }

      // 🔁 Camada autoritativa: edital vinculado pelo Monitoramento (PNCP cache + documentos + download direto)
      let textoParaAnalise = '';
      let fonteTexto = '';
      if (licitacaoIdRef) {
        try {
          const linked = await resolveLinkedEditalText(licitacaoIdRef);
          if (linked.text && linked.text.length >= 200) {
            textoParaAnalise = linked.text;
            fonteTexto = linked.source;
            toast.info(`📄 Edital localizado via ${linked.source.replace(/_/g, ' ')} (Monitoramento).`);
          }
        } catch (e) {
          console.warn('Falha ao resolver edital vinculado:', e);
        }
      }

      if (!textoParaAnalise && editalFile) {
        const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
        textoParaAnalise = await extractTextFromFile(editalFile, 150, true);
        fonteTexto = 'upload_manual';
      }

      // ⚠️ Anti-alucinação: NÃO usar objeto/observações curtos como base.
      // Texto curto (<500 chars) faz a IA inventar produtos que não existem no edital.
      if (!textoParaAnalise || textoParaAnalise.length < 500) {
        toast.warning('⚠️ Não há texto suficiente do edital para extração segura. Envie o PDF/DOC do edital ou Termo de Referência no Passo 3 — o objeto resumido não basta e gera itens inventados.');
        setIsExtracting(false);
        return;
      }

      if (licitacaoIdRef) {
        const saved = await extrairItensIA(licitacaoIdRef, textoParaAnalise, { forceReExtract: true, skipValidation: false });
        const disputeItems = licitacaoItensToDispute(saved);
        applyImportedItems(disputeItems);
        if (disputeItems.length > 0) {
          toast.success(`${disputeItems.length} itens extraídos automaticamente via IA!`);
        } else {
          toast.info('Nenhum item identificado com segurança. Cadastre manualmente ou envie o edital completo.');
        }
      } else {
        await extractFromText(textoParaAnalise);
      }
    } catch (err) {
      console.error('Auto-extract error:', err);
      toast.error('Erro na extração automática. Cadastre os itens manualmente.');
    } finally {
      setIsExtracting(false);
    }
  }, [isExtracting, licitacaoIdRef, fetchItens, fetchItensDeFontesAlternativas, editalFile, extrairItensIA, extractFromText, resolveLinkedEditalText]);

  useEffect(() => {
    if (step === 2 && itens.length === 0 && !autoExtractTriggered && (licitacaoIdRef || editalFile)) {
      setAutoExtractTriggered(true);
      handleAutoExtractItems();
    }
  }, [step, itens.length, autoExtractTriggered, licitacaoIdRef, editalFile, handleAutoExtractItems]);

  // Vindo de uma pasta, a disputa já nasce amarrada a ela: assim que a lista
  // carrega, o processo aberto é importado sozinho. Antes o operador
  // reselecionava o edital a cada disputa — com risco de escolher o errado.
  useEffect(() => {
    if (!open || editingLance || licitacaoIdRef || !processoAtivoId || !licitacoes.length) return;
    const doProcesso = licitacoes.find((l) => l.id === processoAtivoId);
    if (doProcesso) handleImportLicitacao(doProcesso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, processoAtivoId, licitacoes, editingLance, licitacaoIdRef]);

  const handleImportLicitacao = async (lic: LicitacaoRow) => {
    setSelectedLicId(lic.id);
    setLoadingItems(true);

    setEdital(lic.numero);
    setPortal(lic.portal || '');
    setLicitacaoIdRef(lic.id);

    // Horário da sessão de disputa = data_abertura (início do pregão).
    // Fallback para data_encerramento (prazo de envio de propostas) só quando abertura não existir.
    const fonteHorario = lic.data_abertura || lic.data_encerramento;
    if (fonteHorario) {
      try {
        const d = new Date(fonteHorario);
        if (!isNaN(d.getTime())) {
          // Timestamps do banco chegam em UTC; getUTCHours preserva o horário
          // original sem conversão para o fuso local do navegador
          setHorario(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`);
        }
      } catch {
        // ignore
      }
    }

    try {
      // 1) Tenta carregar itens já centralizados (compartilhados com Proposta/Precificação)
      const centralItens = await fetchItens(lic.id);
      let importedItems = licitacaoItensToDispute(centralItens);

      // 2) Fallback: importa de Precificação (catálogo) e Proposta Comercial (composições)
      if (importedItems.length === 0) {
        const alternativos = await fetchItensDeFontesAlternativas(lic.id);
        if (alternativos.length > 0) {
          importedItems = alternativos;
          toast.info(`📦 ${alternativos.length} itens importados da Precificação/Proposta Comercial.`);
        }
      }

      // 3) Penúltimo recurso: edital vinculado pelo Monitoramento (PNCP cache + documentos + download)
      if (importedItems.length === 0) {
        try {
          const linked = await resolveLinkedEditalText(lic.id);
          if (linked.text && linked.text.length >= 200) {
            toast.info(`📄 Edital localizado via ${linked.source.replace(/_/g, ' ')}. Extraindo itens via IA...`);
            const saved = await extrairItensIA(lic.id, linked.text, { skipValidation: true, forceReExtract: true });
            importedItems = licitacaoItensToDispute(saved);
          }
        } catch (e) {
          console.warn('Falha ao buscar edital vinculado:', e);
        }
      }

      // ⚠️ Removido: extração a partir de objeto/observações.
      // Texto curto provoca alucinação grave (ex: IA inventa "impressora" em edital de limpeza).
      // O usuário deve enviar o PDF do edital no Passo 3 quando não houver itens centralizados.
      if (importedItems.length === 0) {
        toast.warning('⚠️ Nenhum item localizado nas fontes confiáveis. Envie o PDF do edital no Passo 3 para extração segura.');
      }

      applyImportedItems(importedItems);

      const itemCount = importedItems.length;
      if (itemCount > 0) {
        toast.success(
          `✅ Processo importado com ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}! Os mesmos itens estarão disponíveis na Proposta e na Precificação.`
        );
      } else {
        toast.info('✅ Dados do processo importados. Envie o edital (PDF/DOC) no Passo 3 para extrair os itens automaticamente via IA.');
      }
    } catch {
      toast.error('Erro ao importar itens do processo.');
    } finally {
      setLoadingItems(false);
      setStep(1);
    }
  };

  const handleEditalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      return;
    }
    setEditalFile(f);
  };

  const handleExtractFromEdital = async () => {
    if (!editalFile) return;
    setIsExtracting(true);

    try {
      const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
      const text = await extractTextFromFile(editalFile, 150, true);

      if (licitacaoIdRef) {
        const saved = await extrairItensIA(licitacaoIdRef, text, { forceReExtract: true, skipValidation: true });
        const disputeItems = licitacaoItensToDispute(saved);
        applyImportedItems(disputeItems);
        if (disputeItems.length > 0) setStep(1);
      } else {
        const extractedItems = await extractFromText(text);
        if (extractedItems.length > 0) setStep(1);
      }
    } catch {
      toast.error('Erro ao ler o arquivo.');
    } finally {
      setIsExtracting(false);
    }
  };

  const resetForm = () => {
    setEdital(''); setPortal('');
    setDecrementoMin(''); setDecrementoPercentual('1.5');
    setIntervaloSegundos('30'); setMaxLances('20'); setModoAutomatico(true); setHorario('');
    setItens([]); setTipoDisputa('item'); setStep(editingLance ? 1 : 0);
    setSelectedLicId(null); setSearchLic(''); setStatusFilter('todos'); setLicitacaoIdRef(undefined);
    setTrocarProcesso(false);
    setValorInicialInput(''); setValorMinimoInput('');
    setEditalFile(null); setShowEditalUpload(false); setAutoExtractTriggered(false);
    resetItemForm();
  };

  const resetItemForm = () => {
    setNovoDesc(''); setNovoQtd('1'); setNovoUnidade('UN');
    setNovoValorRef(''); setNovoLote('');
  };

  const handleAddItem = () => {
    if (!novoDesc.trim()) return;
    const nextNum = itens.length > 0 ? Math.max(...itens.map(i => i.numero)) + 1 : 1;
    const newItem: DisputeItem = {
      id: crypto.randomUUID(),
      numero: nextNum,
      descricao: novoDesc.trim(),
      quantidade: parseInt(novoQtd) || 1,
      unidade: novoUnidade || 'UN',
      valorReferencia: parseFloat(novoValorRef) || 0,
      valorMinimo: null,
      origem: 'manual',
      lote: novoLote.trim() || `Lote ${Math.ceil(nextNum / 5)}`,
      disputando: true,
      situacao: 'aguardando',
      melhorLance: null,
      seuUltimoLance: null,
    };
    setItens(prev => [...prev, newItem]);
    resetItemForm();
  };

  const handleRemoveItem = (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id).map((item, idx) => ({ ...item, numero: idx + 1 })));
  };

  /**
   * Piso de UM item.
   *
   * Campo vazio grava `null`, e não `0`: são coisas diferentes. Zero é um piso
   * escolhido — autoriza o robô a descer até ele. Nulo é "ninguém decidiu
   * ainda", e é o estado em que o robô não deve dar lance.
   */
  const handlePisoItem = (id: string, texto: string) => {
    const limpo = texto.replace(/[^\d,.]/g, '').replace(',', '.');
    const n = parseFloat(limpo);
    setItens(prev => prev.map(i =>
      i.id === id
        ? { ...i, valorMinimo: limpo === '' || !Number.isFinite(n) ? null : n }
        : i
    ));
  };

  const handleSave = () => {
    const lance: LanceConfig = {
      id: editingLance?.id || crypto.randomUUID(),
      edital, portal,
      valorReferencia: somaReferencia,
      valorInicial,
      valorMinimo,
      decrementoMin: parseFloat(decrementoMin) || 0,
      decrementoPercentual: parseFloat(decrementoPercentual) || 1.5,
      intervaloSegundos: parseInt(intervaloSegundos) || 30,
      maxLances: parseInt(maxLances) || 20,
      modoAutomatico, status: 'aguardando', horario,
      meuLance: editingLance?.meuLance || 0,
      valorAtual: somaReferencia,
      itens, tipoDisputa,
      licitacaoId: licitacaoIdRef,
      uasg: ehComprasGov && uasg ? uasg : undefined,
    };
    onSave(lance);
    resetForm();
    setOpen(false);
  };

  const step1Valid = edital && portal;

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lotes = [...new Set(itens.map(i => i.lote))].filter(Boolean);

  const handleRemoveLote = (lote: string) => {
    setItens(prev => prev.filter(i => i.lote !== lote).map((item, idx) => ({ ...item, numero: idx + 1 })));
    toast.info(`Lote "${lote}" removido com todos os seus itens.`);
  };

  // Filter licitações
  const statusOptions = ['todos', ...new Set(licitacoes.map(l => l.status))];
  const filteredLicitacoes = licitacoes.filter(l => {
    const matchSearch = !searchLic ||
      l.numero.toLowerCase().includes(searchLic.toLowerCase()) ||
      l.orgao.toLowerCase().includes(searchLic.toLowerCase()) ||
      l.objeto.toLowerCase().includes(searchLic.toLowerCase());
    const matchStatus = statusFilter === 'todos' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      'Monitorando': 'bg-info/10 text-info border-info/30',
      'Analisando': 'bg-warning/10 text-warning border-warning/30',
      'Proposta': 'bg-muted text-foreground border-border',
      'Em Disputa': 'bg-accent/10 text-accent border-accent/30',
      'Vencida': 'bg-success/10 text-success border-success/30',
      'Homologada': 'bg-success/10 text-success border-success/30',
    };
    return map[s] || 'bg-muted text-muted-foreground border-border';
  };

  const stepLabels = editingLance
    ? ['1. Dados da Disputa', '2. Itens / Lotes']
    : ['1. Origem', '2. Dados da Disputa', '3. Itens / Lotes'];

  const currentStepIndex = editingLance ? step - 1 : step;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1" /> Nova Sessão de Lance
          </Button>
        )}
      </DialogTrigger>
      {/* ── ESTRUTURA DO MODAL ────────────────────────────────────────────
          Cabeçalho e trilha de passos FIXOS, corpo com rolagem própria,
          rodapé FIXO. Antes o DialogContent inteiro rolava, e os botões de
          avançar sumiam para baixo junto com o formulário.

          `flex flex-col` no lugar do `grid` padrão do shadcn é de propósito,
          e resolve um defeito real: item de grid cresce até o min-content do
          conteúdo, e o nome do órgão na lista de processos usa `truncate`
          (nowrap) — um órgão de nome longo forçava a coluna do modal a
          ~1150px e aparecia uma barra de rolagem horizontal no rodapé. Com
          flex-col e `min-w-0` no corpo, o texto é que se corta, não o modal. */}
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 space-y-3">
          <div className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                <Bot className="w-5 h-5" />
              </span>
              {editingLance ? 'Editar Sessão de Lance' : 'Configurar Nova Sessão de Lance'}
            </DialogTitle>
            <DialogDescription>
              {step === 0 && 'Escolha como deseja cadastrar a disputa.'}
              {step === 1 && `Passo ${editingLance ? '1/2' : '2/3'} — Configure os parâmetros gerais da disputa.`}
              {step === 2 && `Passo ${editingLance ? '2/2' : '3/3'} — Cadastre os itens/lotes. Os valores da disputa são calculados automaticamente.`}
            </DialogDescription>
          </div>

          {/* Trilha de passos. Azul vivo no passo atual é o papel certo dele
              (estado ativo), não ação — a ação fica no rodapé, em navy. */}
          <ol className="flex items-center gap-2 flex-wrap" aria-label="Passos">
            {stepLabels.map((label, idx) => (
              <li key={label} className="flex items-center gap-2">
                {idx > 0 && <div className="w-6 h-px bg-border" aria-hidden="true" />}
                <div
                  aria-current={currentStepIndex === idx ? 'step' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    currentStepIndex === idx ? 'bg-accent text-accent-foreground' :
                    currentStepIndex > idx ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStepIndex > idx && <CheckCircle2 className="w-3 h-3" />}
                  {label}
                </div>
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-6 py-5">

        {/* ── STEP 0: Choose source ── */}
        {step === 0 && !editingLance && (
          <div className="space-y-5">
            {/* Os três caminhos com o MESMO desenho — o recomendado se destaca
                por um selo e pelo tingido, não por ser o único sem tracejado.
                Três estilos de borda para três botões iguais liam como três
                coisas diferentes. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-accent/50 hover:bg-muted/30 transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <Pencil className="w-5 h-5 text-muted-foreground group-hover:text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Cadastro Manual</p>
                  <p className="text-xs text-muted-foreground mt-1">Preencha todos os dados manualmente.</p>
                </div>
              </button>
              <button
                type="button"
                aria-pressed={!showEditalUpload}
                onClick={() => setShowEditalUpload(false)}
                className="relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-accent/40 bg-accent/5 hover:bg-accent/10 transition-all text-center group"
              >
                <span className="absolute top-2.5 right-2.5 text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent/10 rounded px-1.5 py-0.5">
                  Recomendado
                </span>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileSearch className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Importar do Kanban</p>
                  <p className="text-xs text-muted-foreground mt-1">Importe dados + itens precificados.</p>
                </div>
              </button>
              <button
                type="button"
                aria-pressed={showEditalUpload}
                onClick={() => setShowEditalUpload(true)}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-accent/50 hover:bg-muted/30 transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <Sparkles className="w-5 h-5 text-muted-foreground group-hover:text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Extrair do Edital (IA)</p>
                  <p className="text-xs text-muted-foreground mt-1">Envie o edital e a IA extrai itens e valores.</p>
                </div>
              </button>
            </div>

            {/* AI Edital Upload area */}
            {showEditalUpload && (
              <div className="space-y-3 border border-border/50 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Extração Inteligente do Edital</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envie o Edital ou Termo de Referência. A IA extrairá automaticamente: Nº do item, Descrição, Quantidade, Unidade, Valor Unitário e Valor Total de referência.
                </p>

                {!editalFile ? (
                  <button
                    type="button"
                    onClick={() => editalFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Clique para enviar o arquivo</span>
                    <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT — Máx. 15MB</span>
                  </button>
                ) : (
                  <div className="bg-card rounded-lg p-3 border border-border/50 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{editalFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(editalFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleExtractFromEdital}
                        disabled={isExtracting}
                        size="sm"
                        className="text-xs"
                      >
                        {isExtracting ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Extraindo...</>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5 mr-1" /> Extrair Itens e Valores</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditalFile(null); if (editalFileRef.current) editalFileRef.current.value = ''; }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <input ref={editalFileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleEditalFileChange} />

                {isExtracting && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analisando o documento e extraindo itens, quantidades e valores de referência...
                  </div>
                )}
              </div>
            )}

            {/* Vindo de uma pasta, a disputa é DELA. Trocar de processo aqui
                dispararia lances no pregão errado — então a lista de outros
                processos exige um passo explícito. */}
            {!showEditalUpload && processoAtivoId && licitacaoIdRef === processoAtivoId && !trocarProcesso && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                <Target className="w-4 h-4 text-accent shrink-0" />
                <span className="text-xs text-muted-foreground">Disputa do processo aberto:</span>
                <span className="text-xs font-semibold">{edital || '—'}</span>
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs ml-auto"
                  onClick={() => setTrocarProcesso(true)}
                >
                  Escolher outro processo
                </Button>
              </div>
            )}

            {/* Licitações list */}
            {!showEditalUpload && !(processoAtivoId && licitacaoIdRef === processoAtivoId && !trocarProcesso) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-muted-foreground" />
                    Seus Processos Licitatórios
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {filteredLicitacoes.length} {filteredLicitacoes.length === 1 ? 'processo' : 'processos'}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número, órgão ou objeto..."
                      value={searchLic}
                      onChange={(e) => setSearchLic(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s === 'todos' ? 'Todos os status' : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingLicitacoes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground ml-2">Carregando processos...</span>
                  </div>
                ) : filteredLicitacoes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
                    <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {licitacoes.length === 0
                        ? 'Nenhum processo na gestão. Inicie um processo pelo Monitoramento ou Kanban.'
                        : 'Nenhum processo encontrado com os filtros selecionados.'}
                    </p>
                  </div>
                ) : (
                  <div
                    className="min-h-[14rem] max-h-[42vh] w-full min-w-0 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-muted/30"
                  >
                    <div className="space-y-2 p-2.5">
                      {filteredLicitacoes.map((lic) => {
                        // A mesma autoridade de nomeação das outras telas:
                        // "6", "00046" e "126" crus não identificam nada. O
                        // dado gravado segue o do portal — só a LEITURA é
                        // padronizada, com a forma original no hover.
                        const identidade = identidadeDoEdital({ numeroCompra: lic.numero, modalidade: lic.modalidade });
                        return (
                        <button
                          key={lic.id}
                          type="button"
                          onClick={() => handleImportLicitacao(lic)}
                          disabled={loadingItems && selectedLicId === lic.id}
                          className={`w-full min-w-0 text-left rounded-lg border bg-card p-3.5 transition-all hover:border-accent/50 hover:bg-accent/5 group ${
                            selectedLicId === lic.id && loadingItems
                              ? 'border-accent bg-accent/5'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-sm font-bold text-foreground cursor-help"
                                  title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
                                >
                                  {identidade.rotulo}
                                </span>
                                {identidade.srpNoTexto && (
                                  <Badge variant="outline" className="text-xs">SRP</Badge>
                                )}
                                <Badge variant="outline" className={`text-xs ${statusColor(lic.status)}`}>
                                  {lic.status}
                                </Badge>
                              </div>
                              {/* `truncate` (nowrap) foi o que estourava o modal
                                  em grid; aqui o pai tem min-w-0 e o modal é
                                  flex, então corta o texto, não o layout. */}
                              <p className="text-xs text-muted-foreground mt-1 truncate">{lic.orgao}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{lic.objeto}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {lic.portal && <span className="truncate">{lic.portal}</span>}
                                {lic.valor_estimado && (
                                  <span className="font-mono font-medium text-foreground shrink-0">
                                    {formatCurrency(lic.valor_estimado)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 self-center">
                              {loadingItems && selectedLicId === lic.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              ) : (
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                              )}
                            </div>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: Dispute data ── */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            {(licitacaoIdRef || itens.length > 0) && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-success/10 border border-success/30 text-xs text-success">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {licitacaoIdRef
                      ? <>Dados importados do processo <strong>{edital}</strong>{itens.length > 0 ? <> · <strong>{itens.length}</strong> {itens.length === 1 ? 'item carregado' : 'itens carregados'}</> : ''}</>
                      : <><strong>{itens.length} itens</strong> extraídos do edital por IA</>
                    }
                  </p>
                  {licitacaoIdRef && (
                    <p className="text-xs text-success/80 font-normal">
                      🔗 Fonte única: estes mesmos itens estão sincronizados com a <strong>Proposta Comercial</strong> e a <strong>Precificação</strong>.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Identificação da Licitação</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nº do Edital / Pregão *</label>
                  <Input
                    value={edital}
                    onChange={(e) => setEdital(e.target.value)}
                    placeholder={ehComprasGov ? '90012/2025' : 'PE-001/2026'}
                    className="mt-1"
                  />
                  {ehComprasGov && (
                    /* O robô só consegue buscar no Compras.gov com número e ano;
                       "TESTE-COMPRASGOV" é recusado antes de abrir o portal. Dizer
                       aqui poupa um envio para descobrir. */
                    <p className={cn('text-[11px] mt-1', /\d{1,6}\s*\/\s*\d{4}/.test(edital) ? 'text-muted-foreground' : 'text-warning')}>
                      No Compras.gov, use o <b>número da compra</b> no formato número/ano — ex.: 90012/2025.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Portal *</label>
                  <Select value={portal} onValueChange={setPortal}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o portal" /></SelectTrigger>
                    <SelectContent>
                      {portaisDisponiveis.map((p) => (
                        <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {ehComprasGov && (
                <div>
                  <label className="text-xs text-muted-foreground">UASG (código da unidade compradora)</label>
                  <Input
                    value={uasg}
                    onChange={(e) => setUasg(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder="170162"
                    className="mt-1 w-40"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    O número da compra se repete entre órgãos; a UASG é o que torna a busca exata. Está no edital e na lista do portal (ex.: <b>170162</b> - MINISTERIO DA FAZENDA).
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Horário da Sessão</label>
                <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="mt-1 w-40" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Regras de Decremento Automático</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Decremento Mínimo (R$)</label>
                  <MoneyInput value={Number(decrementoMin) || 0} onValueChange={(v) => setDecrementoMin(String(v))} placeholder="R$ 50.000,00" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Decremento Percentual (%)</label>
                  <Input type="number" step="0.1" value={decrementoPercentual} onChange={(e) => setDecrementoPercentual(e.target.value)} placeholder="1.5" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Intervalo entre lances (seg)</label>
                  <Input type="number" value={intervaloSegundos} onChange={(e) => setIntervaloSegundos(e.target.value)} placeholder="30" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Máx. lances por sessão</label>
                  <Input type="number" value={maxLances} onChange={(e) => setMaxLances(e.target.value)} placeholder="20" className="mt-1" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border/50">
              <div>
                <p className="text-sm font-medium">Modo Automático</p>
                <p className="text-xs text-muted-foreground">O robô enviará lances automaticamente respeitando os parâmetros configurados</p>
              </div>
              <Switch checked={modoAutomatico} onCheckedChange={setModoAutomatico} />
            </div>
          </div>
        )}

        {/* ── STEP 2: Items/Lots ── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" /> Tipo de Disputa
                  {(licitacaoIdRef || editalFile) && (
                    <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/30 ml-1">
                      Detectado automaticamente
                    </Badge>
                  )}
                </h4>
                {licitacaoIdRef && (
                  <LimparItensExtraidosButton
                    licitacaoId={licitacaoIdRef}
                    fontes={['licitacao_itens']}
                    onCleared={() => { setItens([]); setAutoExtractTriggered(false); toast.info('Histórico limpo. Reextraia ou adicione manualmente.'); }}
                    label="Limpar itens errados"
                  />
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setTipoDisputa('item')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'item' ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-muted-foreground border-border hover:border-accent/50'
                  }`}
                >
                  <Package className="w-4 h-4" /> Por Item
                </button>
                <button
                  onClick={() => setTipoDisputa('lote')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'lote' ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-muted-foreground border-border hover:border-accent/50'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Por Lote
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {tipoDisputa === 'item'
                  ? 'Cada item será disputado individualmente. Os lances são enviados item a item.'
                  : 'Os itens são agrupados em lotes. O lance é enviado para o lote como um todo. Remova lotes ou itens que não deseja disputar.'}
              </p>
            </div>

            {/* Add item form */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-muted-foreground" /> Adicionar {tipoDisputa === 'lote' ? 'Item ao Lote' : 'Item'}
              </h4>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-xs text-muted-foreground">Descrição *</label>
                  <Input value={novoDesc} onChange={(e) => setNovoDesc(e.target.value)} placeholder="Ex: Toner HP 26A" className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">Qtd</label>
                  <Input type="number" min="1" value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)} className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">Unid.</label>
                  <Input value={novoUnidade} onChange={(e) => setNovoUnidade(e.target.value)} placeholder="UN" className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Valor Unit. (R$)</label>
                  <MoneyInput value={Number(novoValorRef) || 0} onValueChange={(v) => setNovoValorRef(String(v))} placeholder="R$ 0,00" className="mt-0.5 h-8 text-xs" />
                </div>
                {tipoDisputa === 'lote' && (
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Lote</label>
                    <Input value={novoLote} onChange={(e) => setNovoLote(e.target.value)} placeholder="Lote 1" className="mt-0.5 h-8 text-xs" />
                  </div>
                )}
                <div className={tipoDisputa === 'lote' ? 'col-span-1' : 'col-span-3'}>
                  <label className="text-xs text-muted-foreground invisible">+</label>
                  <Button onClick={handleAddItem} size="sm" disabled={!novoDesc.trim()} className="mt-0.5 h-8 w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Items list */}
            {itens.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {itens.length} {itens.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
                    {tipoDisputa === 'lote' && lotes.length > 0 && (
                      <span className="font-normal text-muted-foreground ml-2">em {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}</span>
                    )}
                  </h4>
                  {licitacaoIdRef && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      Importados do Kanban
                    </Badge>
                  )}
                </div>

                {tipoDisputa === 'lote' && lotes.length > 0 ? (
                  /* Grouped by lote view */
                  <div className="space-y-3">
                    {lotes.map((lote) => {
                      const loteItens = itens.filter(i => i.lote === lote);
                      const loteTotal = loteItens.reduce((s, i) => s + (i.valorReferencia * i.quantidade), 0);
                      return (
                        <div key={lote} className="border border-border rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 border-b border-border">
                            <div className="flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs font-bold text-foreground">{lote}</span>
                              <Badge variant="outline" className="text-xs">{loteItens.length} {loteItens.length === 1 ? 'item' : 'itens'}</Badge>
                              <span className="text-xs font-mono text-muted-foreground">{formatCurrency(loteTotal)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveLote(lote)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Remover Lote
                            </Button>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-xs w-10 text-center">Nº</TableHead>
                                <TableHead className="text-xs">Descrição</TableHead>
                                <TableHead className="text-xs text-center">Qtd</TableHead>
                                <TableHead className="text-xs text-center">Unid.</TableHead>
                                <TableHead className="text-xs text-right">Vlr Unit.</TableHead>
                                <TableHead className="text-xs text-right">Vlr Total</TableHead>
                                <TableHead className="text-xs text-right" title="Piso deste item — o robô não desce abaixo dele">Piso</TableHead>
                                <TableHead className="text-xs w-10" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loteItens.map((item) => (
                                <LinhaDeItem
                                  key={item.id}
                                  item={item}
                                  larguraDescricao="max-w-[180px]"
                                  aoMudarPiso={handlePisoItem}
                                  aoRemover={handleRemoveItem}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Flat item view */
                  <div className="border border-border rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs w-10 text-center">Nº</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs text-center">Qtd</TableHead>
                          <TableHead className="text-xs text-center">Unid.</TableHead>
                          <TableHead className="text-xs text-right">Vlr Unit.</TableHead>
                          <TableHead className="text-xs text-right">Vlr Total</TableHead>
                          <TableHead className="text-xs text-right" title="Piso deste item — o robô não desce abaixo dele">Piso</TableHead>
                          <TableHead className="text-xs w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((item) => (
                          <LinhaDeItem
                            key={item.id}
                            item={item}
                            larguraDescricao="max-w-[160px]"
                            aoMudarPiso={handlePisoItem}
                            aoRemover={handleRemoveItem}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {itens.length === 0 && !isExtracting && (
              <div className="text-center py-6 border border-dashed border-border rounded-lg bg-muted/20 space-y-3">
                <Package className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">Nenhum item cadastrado ainda.</p>
                <p className="text-xs text-muted-foreground">
                  Extraia automaticamente via IA ou preencha o formulário acima.
                </p>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => editalFileRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" /> Enviar Edital (PDF/DOC)
                    </Button>
                    {editalFile && (
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={handleAutoExtractItems}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" /> Extrair Itens via IA
                      </Button>
                    )}
                  </div>
                  {editalFile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{editalFile.name}</span>
                      <button onClick={() => { setEditalFile(null); if (editalFileRef.current) editalFileRef.current.value = ''; }} className="text-destructive hover:underline">remover</button>
                    </div>
                  )}
                </div>
                <input ref={editalFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.xls" className="hidden" onChange={handleEditalFileChange} />
              </div>
            )}

            {itens.length === 0 && isExtracting && (
              <div className="text-center py-8 border border-border/50 rounded-lg bg-muted/30 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">Extraindo itens automaticamente...</p>
                <p className="text-xs text-muted-foreground">
                  A IA está analisando o edital para identificar descrição, quantidade, unidade e valores de referência.
                </p>
              </div>
            )}

            {/* ── Values panel ── */}
            {itens.length > 0 && (
              <div className="space-y-3 border border-border rounded-xl bg-muted/30 p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-muted-foreground" />
                  Valores da Disputa
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border ml-auto">
                    Desconto calculado automaticamente
                  </Badge>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Edite os valores em R$ abaixo. O percentual de desconto é calculado automaticamente com base no Valor de Referência.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {/* Valor de Referência – read-only sum */}
                  <div className="bg-card rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor de Referência</p>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">{formatCurrency(somaReferencia)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Σ (Qtd × Vlr Unit.)</p>
                  </div>

                  {/* Valor Inicial – editable R$ */}
                  <div className={`bg-card rounded-lg border p-3 text-center ${inexequibilidadeInicial ? 'border-destructive' : 'border-border'}`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor Inicial (1º lance)</p>
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <MoneyInput
                        value={Number(valorInicialInput) || 0}
                        onValueChange={(v) => setValorInicialInput(String(v))}
                        placeholder="R$ 0,00"
                        className="h-8 w-40 text-sm text-center px-1 font-mono font-bold"
                      />
                    </div>
                    <p className={`text-xs font-semibold mt-1.5 ${inexequibilidadeInicial ? 'text-destructive' : 'text-foreground'}`}>
                      {pctDescontoInicial >= 0 ? `↓ ${pctDescontoInicial.toFixed(2)}% de desconto` : `↑ ${Math.abs(pctDescontoInicial).toFixed(2)}% acima`}
                    </p>
                    {inexequibilidadeInicial && (
                      <p className="text-xs text-destructive font-bold mt-0.5 animate-pulse">⚠️ INEXEQUÍVEL</p>
                    )}
                  </div>

                  {/* Valor Mínimo – editable R$ */}
                  <div className={`bg-card rounded-lg border p-3 text-center ${inexequibilidadeMinimo ? 'border-destructive' : 'border-destructive/30'}`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor Mínimo (piso)</p>
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <MoneyInput
                        value={Number(valorMinimoInput) || 0}
                        onValueChange={(v) => setValorMinimoInput(String(v))}
                        placeholder="R$ 0,00"
                        className="h-8 w-40 text-sm text-center px-1 font-mono font-bold"
                      />
                    </div>
                    <p className={`text-xs font-semibold mt-1.5 ${inexequibilidadeMinimo ? 'text-destructive' : 'text-destructive/80'}`}>
                      {pctDescontoMinimo >= 0 ? `↓ ${pctDescontoMinimo.toFixed(2)}% de desconto` : `↑ ${Math.abs(pctDescontoMinimo).toFixed(2)}% acima`}
                    </p>
                    {inexequibilidadeMinimo && (
                      <p className="text-xs text-destructive font-bold mt-0.5 animate-pulse">⚠️ INEXEQUÍVEL</p>
                    )}
                  </div>
                </div>

                {/* Inexequibilidade alert banner */}
                {(inexequibilidadeInicial || inexequibilidadeMinimo) && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/40 text-xs text-destructive">
                    <span className="text-base leading-none mt-0.5">🚨</span>
                    <div>
                      <p className="font-bold">Risco de Inexequibilidade (Art. 59, §4º da Lei 14.133/2021)</p>
                      <p className="mt-0.5 text-destructive/80">
                        Propostas com desconto superior a 50% do valor de referência podem ser consideradas inexequíveis pelo pregoeiro, exigindo comprovação de viabilidade econômica.
                      </p>
                    </div>
                  </div>
                )}

                {valorMinimo > valorInicial && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    ⚠️ O valor mínimo (piso) está acima do valor inicial. Revise os valores.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        </div>

        {/* Rodapé fixo. A ação principal é `default` (navy), como o protótipo
            manda para botão de ação; o azul vivo ficou para a trilha de passos,
            onde significa "aqui", não "clique". */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 shrink-0 flex-row items-center justify-between sm:justify-between gap-3">
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as 0 | 1)}>
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            {step === 0 && (
              <Button onClick={() => setStep(1)} variant="outline">
                <Pencil className="w-4 h-4 mr-1.5" /> Pular para cadastro manual
              </Button>
            )}
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                Próximo: Itens / Lotes
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={handleSave}
                disabled={itens.length === 0 || somaReferencia <= 0 || valorMinimo > valorInicial}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {editingLance ? 'Salvar Alterações' : 'Cadastrar Sessão'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
