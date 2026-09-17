import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ESTRATEGIAS_DO_ITEM, avisosDaGrade, modoTemLanceFinalFechado, type EstrategiaDoItem } from '@/lib/robo/estrategia-do-item';
import { agendamentoDaDisputa, sessaoDoProcesso, HORA_MINIMA_ESPERADA, type SessaoDoProcesso } from '@/lib/robo/agendamento';
import {
  aplicarMarcaModeloDoTermo,
  buscarCompraDoComprasGov,
  buscarMarcaModeloNoTermo,
  itensDaCompraParaDisputa,
  podeBuscarCompra,
  resumoDaCompra,
  sessaoDaCompra,
  textoDoResultadoDoTermo,
  type CompraDoComprasGov,
} from '@/lib/robo/compra-comprasgov';
import { lerValorDigitado, valorParaDigitar } from '@/lib/robo/valor-digitado';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import { pisoUnitarioDoItemUnico } from '@/lib/robo/piso-do-item';
import { buscarUasgDoProcesso } from '@/lib/robo/uasg-do-processo';
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
  /**
   * `licitacao_itens.id` — vínculo ESTÁVEL com o item do processo. Nulo quando
   * o item não veio do processo (colado, extraído do texto). O `id` acima é só
   * a chave da linha nesta tela.
   */
  licitacaoItemId?: string | null;
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
  /**
   * Vazio = melhor preço, que é o que o robô fazia antes de a escolha existir:
   * disputa cadastrada antes de 16/09 segue igual.
   */
  estrategia?: EstrategiaDoItem;
  /**
   * Só na estratégia "Desempatar no 1º lugar": a distância máxima, em reais,
   * entre o lance da empresa e o do 1º colocado para o robô cobri-lo.
   */
  margemDesempate?: number | null;
  /**
   * Só no modo aberto e fechado: o valor do único lance final fechado, se o
   * portal chamar a empresa. Vazio = o robô não dá esse lance — ele não escolhe
   * sozinho um número que não dá para corrigir.
   */
  lanceFinalFechado?: number | null;
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
  /**
   * Teto de lances ENVIADOS. `null` = sem teto: o robô disputa até o piso de
   * cada item ("30 ou infinitamente até chegar no meu limite", reunião de 14/09).
   */
  maxLances: number | null;
  modoAutomatico: boolean;
  status: 'aguardando' | 'ativo' | 'vencendo' | 'perdendo' | 'encerrado';
  horario: string;
  /**
   * Data da sessão pública (AAAA-MM-DD). Com ela e o horário, o robô entra
   * sozinho no dia; sem ela, a disputa continua sendo enviada por clique.
   */
  dataSessao?: string;
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
  numero_controle_pncp?: string | null;
  cnpj_orgao?: string | null;
  ano_compra?: string | null;
  sequencial_compra?: string | null;
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
  comprasgov: {
    texto: 'Compras.gov',
    titulo: 'Item publicado pelo órgão no Compras.gov — o valor é o estimado pelo órgão (teto), não o nosso preço; com orçamento sigiloso vem vazio',
  },
};

const paraBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Variantes semânticas do Badge de ui — status sempre com texto. */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

/**
 * Campo de valor em reais que guarda o TEXTO enquanto a pessoa digita.
 *
 * Controlado pelo número, cada tecla fazia a volta texto → número → texto e a
 * vírgula sumia: "4999,70" virava 499970 (visto em 16/09/2026). Aqui o texto é
 * do campo; o número vai ao estado a cada tecla; e o texto só é refeito a
 * partir do número quando o número muda por fora (outra importação, reset).
 */
function CampoDecimal({
  valor,
  aoMudar,
  zeroEhVazio = false,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  valor: number | null | undefined;
  aoMudar: (valor: number | null) => void;
  /** O estado guarda "sem valor" como 0 (valor unitário): "0" digitado a caminho de "0,50" não pode limpar o campo. */
  zeroEhVazio?: boolean;
}) {
  const [texto, setTexto] = useState(() => valorParaDigitar(valor));
  // Em foco, o texto cru que a pessoa digita; fora dele, o número em moeda
  // ("R$ 6.686.383,56"), como as outras colunas em reais. Formatar DURANTE a
  // digitação era o que engolia a vírgula (16/09) — por isso só no repouso.
  const [focado, setFocado] = useState(false);
  const ultimoEnviado = useRef<number | null | undefined>(valor);
  useEffect(() => {
    if (valor !== ultimoEnviado.current) {
      ultimoEnviado.current = valor;
      setTexto(valorParaDigitar(valor));
    }
  }, [valor]);
  const emRepouso = valor === null || valor === undefined ? '' : paraBRL(valor);
  return (
    <Input
      {...props}
      value={focado ? texto : emRepouso}
      onFocus={(e) => { setFocado(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocado(false); props.onBlur?.(e); }}
      onChange={(e) => {
        const digitado = e.target.value.replace(/[^\d,.]/g, '');
        const n = lerValorDigitado(digitado);
        setTexto(digitado);
        ultimoEnviado.current = zeroEhVazio && !(n && n > 0) ? null : n;
        aoMudar(n);
      }}
    />
  );
}

/**
 * A linha de UM item na tabela de itens da disputa.
 *
 * É componente, e não JSX repetido, porque a mesma linha é desenhada em dois
 * lugares — a visão agrupada por lote e a visão plana. Duas cópias divergem:
 * neste mesmo módulo a lista de portais chegou a ter 10 num arquivo e 23 no
 * outro, e ninguém percebeu até um portal sumir da tela.
 */
/**
 * A grade de itens da disputa tem dez colunas, três delas campos de 112 px.
 * Sem largura mínima, o navegador a espremia à largura do diálogo e as
 * células de texto viravam uma letra por linha ("Q/t/d", "1/./4/7/0"),
 * print de 17/09. Com o mínimo, em tela estreita a grade rola dentro do
 * quadro (`overflow-auto`); o respiro de 8 px por lado é o que faz ela
 * caber inteira no diálogo de 6xl.
 */
const GRADE_DE_ITENS = 'min-w-[1040px] [&_td]:px-2 [&_th]:px-2 [&_th]:whitespace-nowrap';

function LinhaDeItem({
  item,
  larguraDescricao,
  aoMudarValor,
  aoMudarMarcaModelo,
  aoMudarPiso,
  aoMudarEstrategia,
  aoMudarMargem,
  mostrarLanceFinal,
  mostrarPiso,
  aoMudarLanceFinal,
  aoRemover,
}: {
  item: DisputeItem;
  larguraDescricao: string;
  aoMudarValor: (id: string, valor: number | null) => void;
  aoMudarMarcaModelo: (id: string, campo: 'marca' | 'modelo', texto: string) => void;
  aoMudarPiso: (id: string, valor: number | null) => void;
  aoMudarEstrategia: (id: string, estrategia: EstrategiaDoItem) => void;
  aoMudarMargem: (id: string, valor: number | null) => void;
  mostrarLanceFinal: boolean;
  /**
   * Coluna "Piso" só com dois ou mais itens (decisão de 17/09): com um item, o
   * piso dele é o do cartão "Valor mínimo (piso)" — total ÷ quantidade — e a
   * coluna repetia o mesmo número ao lado.
   */
  mostrarPiso: boolean;
  aoMudarLanceFinal: (id: string, valor: number | null) => void;
  aoRemover: (id: string) => void;
}) {
  // `null` e `0` são estados diferentes e a tela precisa mostrar essa
  // diferença: um piso zerado autoriza o robô a descer até zero; um piso
  // ausente é uma decisão que ninguém tomou ainda.
  const semPiso = item.valorMinimo === null || item.valorMinimo === undefined;
  const rotulo = item.origem ? ROTULO_ORIGEM[item.origem] : undefined;
  // Item do processo: marca e modelo vêm da Proposta e são editados lá — uma
  // segunda fonte do mesmo dado aqui divergiria dela. Item sem processo
  // (manual, edital, Compras.gov) não tem outra casa: edita nesta grade.
  const marcaModeloDoProcesso = !!item.licitacaoItemId;

  return (
    <TableRow>
      <TableCell className="text-sm text-center font-medium tabular-nums">{item.numero}</TableCell>
      <TableCell className={`text-sm ${larguraDescricao}`}>
        {/* Uma linha; o clique em cima abre a descrição inteira (pedido de
            17/09). A dica ao passar o mouse não servia a quem usa teclado ou
            toque, e a descrição do Compras.gov costuma ter várias linhas. */}
        <TextoExpansivel texto={item.descricao} linhas={1} modo="texto" limiarPorLinha={22} className="text-sm" />
        {rotulo && (
          <span
            title={rotulo.titulo}
            className="inline-block mt-0.5 px-1.5 py-px rounded bg-muted text-xs text-muted-foreground"
          >
            {rotulo.texto}
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {marcaModeloDoProcesso ? (
          <span
            className="block max-w-[7rem] truncate text-muted-foreground"
            title="Marca e modelo vêm da Proposta do processo — altere por lá"
          >
            {[item.marca, item.modelo].filter(Boolean).join(' · ') || '—'}
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            <Input
              value={item.marca ?? ''}
              onChange={(e) => aoMudarMarcaModelo(item.id, 'marca', e.target.value)}
              placeholder="marca"
              aria-label={`Marca do item ${item.numero}`}
              className="h-8 w-24 text-xs px-2"
            />
            <Input
              value={item.modelo ?? ''}
              onChange={(e) => aoMudarMarcaModelo(item.id, 'modelo', e.target.value)}
              placeholder="modelo"
              aria-label={`Modelo do item ${item.numero}`}
              className="h-8 w-24 text-xs px-2"
            />
          </div>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-center tabular-nums">{item.quantidade}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-center">{item.unidade}</TableCell>
      <TableCell className="text-right">
        {/* Editável: com orçamento sigiloso o item chega sem valor, e a disputa
            não salva com referência zero. Quem digita assume o número. */}
        <CampoDecimal
          valor={item.valorReferencia > 0 ? item.valorReferencia : null}
          aoMudar={(v) => aoMudarValor(item.id, v)}
          zeroEhVazio
          placeholder="definir"
          inputMode="decimal"
          aria-label={`Valor unitário do item ${item.numero}`}
          title={
            item.valorEstimadoOrgao
              ? `Estimado pelo órgão: ${paraBRL(item.valorEstimadoOrgao)}`
              : 'Valor unitário de referência deste item'
          }
          className={`h-9 w-[7.75rem] text-sm text-right tabular-nums px-2 ml-auto ${
            item.valorReferencia > 0 ? '' : 'border-warning-line placeholder:text-warning-ink'
          }`}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-right tabular-nums font-semibold">
        {item.valorReferencia > 0 ? paraBRL(item.valorReferencia * item.quantidade) : '—'}
      </TableCell>
      {mostrarPiso && (
        <TableCell className="text-right">
          <CampoDecimal
            valor={item.valorMinimo}
            aoMudar={(v) => aoMudarPiso(item.id, v)}
            placeholder="definir"
            inputMode="decimal"
            aria-label={`Piso do item ${item.numero}`}
            title={
              item.custoUnitario !== null && item.custoUnitario !== undefined
                ? `Sugerido a partir do custo da Precificação: ${paraBRL(item.custoUnitario)}`
                : 'Sem custo conhecido para sugerir — defina o piso deste item'
            }
            className={`h-9 w-[7.75rem] text-sm text-right tabular-nums px-2 ml-auto ${
              semPiso ? 'border-warning-line placeholder:text-warning-ink' : ''
            }`}
          />
        </TableCell>
      )}
      <TableCell>
        <Select
          value={item.estrategia ?? 'melhor_preco'}
          onValueChange={(v) => aoMudarEstrategia(item.id, v as EstrategiaDoItem)}
        >
          <SelectTrigger className="h-9 w-32 text-sm" aria-label={`Estratégia do item ${item.numero}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTRATEGIAS_DO_ITEM.map((e) => (
              <SelectItem key={e.id} value={e.id} title={e.explicacao}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {item.estrategia === 'desempatar_1o' && (
          <CampoDecimal
            valor={item.margemDesempate}
            aoMudar={(v) => aoMudarMargem(item.id, v)}
            placeholder="margem R$"
            inputMode="decimal"
            aria-label={`Margem de desempate do item ${item.numero}`}
            title="Distância máxima, em reais, entre o lance da empresa e o do 1º colocado para o robô cobri-lo"
            className={`mt-1 h-9 w-32 text-sm text-right tabular-nums px-2 ${
              item.margemDesempate ? '' : 'border-warning-line placeholder:text-warning-ink'
            }`}
          />
        )}
        {/* Valor já digitado continua visível mesmo se a compra escolhida for de
            outro modo: esconder um número salvo seria perdê-lo de vista. */}
        {(mostrarLanceFinal || !!item.lanceFinalFechado) && (
          <CampoDecimal
            valor={item.lanceFinalFechado ?? null}
            aoMudar={(v) => aoMudarLanceFinal(item.id, v)}
            zeroEhVazio
            placeholder="lance final R$"
            inputMode="decimal"
            aria-label={`Lance final fechado do item ${item.numero}`}
            title="Modo aberto e fechado: o valor do único lance final fechado, se o portal chamar a empresa. Vazio = o robô não dá esse lance."
            className={`mt-1 h-9 w-32 text-sm text-right tabular-nums px-2 ${
              item.lanceFinalFechado && item.valorMinimo && item.lanceFinalFechado < item.valorMinimo
                ? 'border-warning-line'
                : ''
            }`}
          />
        )}
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-destructive hover:text-destructive"
          aria-label={`Remover item ${item.numero}`}
          onClick={() => aoRemover(item.id)}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Helper: convert LicitacaoItem[] to DisputeItem[]
function licitacaoItensToDispute(items: LicitacaoItem[]): DisputeItem[] {
  return items.map((item, idx) => ({
    id: crypto.randomUUID(),
    licitacaoItemId: (item as { id?: string }).id ?? null,
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
  /**
   * Abertura controlada por fora (opcional): a página da disputa abre o mesmo
   * diálogo pelo "Definir data da sessão", além do gatilho "Editar parâmetros".
   */
  aberto?: boolean;
  aoMudarAberto?: (aberto: boolean) => void;
  /**
   * Campo para onde o diálogo rola e foca ao abrir. `data`: aberto pelo
   * "Definir data da sessão" (17/09/2026) — o campo ficava abaixo da dobra, e
   * o foco caía no número do edital.
   */
  focarEm?: 'data';
};

export default function ConfigurarLanceDialog({ onSave, editingLance, trigger, processoAtivoId, aberto, aoMudarAberto, focarEm }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { fetchItens, extrairItensDoTexto, extrairItensIA } = useEditalExtraction();
  const { resolveLinkedEditalText } = useLinkedEditalSource();
  const [abertoInterno, setAbertoInterno] = useState(false);
  const open = aberto ?? abertoInterno;
  const setOpen = (valor: boolean) => {
    if (aberto === undefined) setAbertoInterno(valor);
    aoMudarAberto?.(valor);
  };
  const [step, setStep] = useState<0 | 1 | 2>(editingLance ? 1 : 0);

  useEffect(() => {
    if (!open || focarEm !== 'data' || step !== 1) return;
    const id = window.setTimeout(() => {
      const campo = document.getElementById('disputa-data');
      if (!campo) return;
      campo.scrollIntoView?.({ block: 'center' });
      campo.focus();
    }, 150);
    return () => window.clearTimeout(id);
  }, [open, focarEm, step]);

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
  // A UASG veio do espelho do PNCP, pelo processo importado — só para a tela dizer.
  const [uasgPuxada, setUasgPuxada] = useState(false);
  // O valor atual, para a busca assíncrona não sobrescrever o que a pessoa já digitou.
  const uasgAtual = useRef(uasg);
  uasgAtual.current = uasg;
  // O Compras.gov busca por "número+ano" e por UASG; os outros portais, não.
  const ehComprasGov = idDoPortal(portal) === 'compras-gov';
  const [decrementoMin, setDecrementoMin] = useState(editingLance?.decrementoMin?.toString() || '');
  const [decrementoPercentual, setDecrementoPercentual] = useState(editingLance?.decrementoPercentual ? String(editingLance.decrementoPercentual) : '');
  const [intervaloSegundos, setIntervaloSegundos] = useState(editingLance?.intervaloSegundos?.toString() || '30');
  const [maxLances, setMaxLances] = useState(editingLance ? (editingLance.maxLances ? String(editingLance.maxLances) : '') : '20');
  const [modoAutomatico, setModoAutomatico] = useState(editingLance?.modoAutomatico ?? true);
  const [horario, setHorario] = useState(editingLance?.horario || '');
  const [dataSessao, setDataSessao] = useState(editingLance?.dataSessao || '');
  // A sessão puxada do processo no último import — só para a tela dizer de onde veio.
  const [sessaoPuxada, setSessaoPuxada] = useState<SessaoDoProcesso | null>(null);
  // Compras.gov — a compra lida dos dados abertos por UASG + número/ano.
  const [buscandoCompra, setBuscandoCompra] = useState(false);
  const [erroDaCompra, setErroDaCompra] = useState<string | null>(null);
  const [comprasAchadas, setComprasAchadas] = useState<CompraDoComprasGov[]>([]);
  const [compraEscolhida, setCompraEscolhida] = useState<CompraDoComprasGov | null>(null);
  // De qual compra vieram os itens da grade — para oferecer a troca só quando não vieram dela.
  const [itensDaCompraDe, setItensDaCompraDe] = useState<string | null>(null);
  // O campo do lance final fechado só some quando a compra lida diz um modo sem ele.
  const mostrarLanceFinal = modoTemLanceFinalFechado(compraEscolhida?.modoDisputa);
  // Marca e modelo lidos do termo de referência (sob demanda, com IA).
  const [lendoTermo, setLendoTermo] = useState(false);
  const [resultadoDoTermo, setResultadoDoTermo] = useState<{ ok: boolean; texto: string } | null>(null);

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
        .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, portal, data_encerramento, data_abertura, numero_controle_pncp, cnpj_orgao, ano_compra, sequencial_compra');
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

    // Data E horário da sessão vêm do processo, lidos em Brasília (Fase 8,
    // 16/09/2026). Antes vinha só a hora, lida em UTC: sem a data o robô não
    // entrava sozinho, e a hora saía 3 horas atrasada nos processos gravados
    // com o fuso certo. A regra e os casos estão em `sessaoDoProcesso`.
    const sessao = sessaoDoProcesso(lic);
    setSessaoPuxada(sessao);
    if (sessao) {
      setDataSessao(sessao.dataSessao);
      if (sessao.horario) setHorario(sessao.horario);
    }

    // A UASG não é coluna do processo: vem do espelho do PNCP pelas
    // coordenadas dele (16/09/2026). Sem ela o robô não acha a compra no
    // Compras.gov. Não espera: os itens carregam em paralelo.
    // Outro processo, outra UASG: a do processo anterior não pode ficar.
    setUasg('');
    uasgAtual.current = '';
    setUasgPuxada(false);
    void buscarUasgDoProcesso(lic).then((achada) => {
      if (!achada || uasgAtual.current) return;
      setUasg(achada);
      setUasgPuxada(true);
    });

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

  // Editando, "limpar" é voltar ao que está gravado — não esvaziar. Até
  // 14/09/2026 fechar o diálogo de edição (salvando ou cancelando) zerava
  // edital, portal e itens, e reabrir "Editar parâmetros" mostrava um
  // formulário vazio: o estado inicial vem do `editingLance` só na montagem.
  // Com a disputa em página própria, editar virou o caminho principal.
  const resetForm = () => {
    setEdital(editingLance?.edital || ''); setPortal(editingLance?.portal || ''); setUasg(editingLance?.uasg || '');
    setDecrementoMin(editingLance?.decrementoMin?.toString() || ''); setDecrementoPercentual(editingLance?.decrementoPercentual ? String(editingLance.decrementoPercentual) : '');
    setIntervaloSegundos(editingLance?.intervaloSegundos?.toString() || '30'); setMaxLances(editingLance ? (editingLance.maxLances ? String(editingLance.maxLances) : '') : '20');
    setModoAutomatico(editingLance?.modoAutomatico ?? true); setHorario(editingLance?.horario || '');
    setDataSessao(editingLance?.dataSessao || '');
    setSessaoPuxada(null);
    setUasgPuxada(false);
    setBuscandoCompra(false); setErroDaCompra(null); setComprasAchadas([]); setCompraEscolhida(null); setItensDaCompraDe(null);
    setLendoTermo(false); setResultadoDoTermo(null);
    setItens(editingLance?.itens || []); setTipoDisputa(editingLance?.tipoDisputa || 'item'); setStep(editingLance ? 1 : 0);
    setSelectedLicId(null); setSearchLic(''); setStatusFilter('todos'); setLicitacaoIdRef(editingLance?.licitacaoId);
    setTrocarProcesso(false);
    setValorInicialInput(editingLance ? String(editingLance.valorInicial) : ''); setValorMinimoInput(editingLance ? String(editingLance.valorMinimo) : '');
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
  const handlePisoItem = (id: string, valor: number | null) => {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, valorMinimo: valor } : i)));
  };

  const handleEstrategiaItem = (id: string, estrategia: EstrategiaDoItem) => {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, estrategia } : i)));
  };

  /**
   * Valor unitário digitado na grade. Quem digita assume o número: a origem
   * passa a "Manual" — a estimativa do órgão, se havia, segue guardada à parte.
   */
  const handleValorItem = (id: string, valor: number | null) => {
    setItens(prev => prev.map(i =>
      i.id === id ? { ...i, valorReferencia: valor && valor > 0 ? valor : 0, origem: 'manual' } : i
    ));
  };

  const handleMarcaModeloItem = (id: string, campo: 'marca' | 'modelo', texto: string) => {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, [campo]: texto || undefined } : i)));
  };

  /**
   * Compras.gov: a compra por UASG + número/ano (Fase 6, checklist do grupo).
   * Preenche data e horário só se estiverem vazios, e os itens só se a grade
   * estiver vazia — o que a pessoa já digitou não é sobrescrito sem ela pedir.
   */
  const aplicarCompra = (compra: CompraDoComprasGov) => {
    setCompraEscolhida(compra);
    setComprasAchadas([]);
    if (!dataSessao && !horario) {
      const sessao = sessaoDaCompra(compra);
      if (sessao) {
        setDataSessao(sessao.dataSessao);
        setHorario(sessao.horario ?? '');
        setSessaoPuxada(sessao);
      }
    }
    if (itens.length === 0 && compra.itens.length > 0) {
      usarItensDaCompra(compra);
      toast.success(`${compra.itens.length} ${compra.itens.length === 1 ? 'item carregado' : 'itens carregados'} do Compras.gov.`);
    }
  };

  const usarItensDaCompra = (compra: CompraDoComprasGov) => {
    applyImportedItems(itensDaCompraParaDisputa(compra.itens));
    setItensDaCompraDe(compra.idCompra);
  };

  const handleBuscarCompra = async () => {
    setBuscandoCompra(true);
    setErroDaCompra(null);
    setComprasAchadas([]);
    const r = await buscarCompraDoComprasGov(uasg, edital);
    setBuscandoCompra(false);
    if (!r.ok) {
      setCompraEscolhida(null);
      setErroDaCompra(r.motivo ?? 'O Compras.gov não devolveu a compra.');
      return;
    }
    const compras = r.compras ?? [];
    if (compras.length === 1) aplicarCompra(compras[0]);
    else setComprasAchadas(compras);
  };

  /**
   * "Coluna de marca e modelo, se houver no anexo — do termo de referência"
   * (checklist do grupo). Sob demanda: a leitura usa IA paga, e o normal na Lei
   * 14.133 é o órgão não indicar marca. Só preenche campo vazio.
   */
  const handleMarcaModeloDoTermo = async () => {
    if (!compraEscolhida) return;
    setLendoTermo(true);
    setResultadoDoTermo(null);
    const r = await buscarMarcaModeloNoTermo(compraEscolhida, itens);
    let preenchidos = 0;
    if (r.ok && r.itens?.length) {
      const aplicado = aplicarMarcaModeloDoTermo(itens, r.itens);
      preenchidos = aplicado.preenchidos;
      setItens(aplicado.itens);
    }
    setLendoTermo(false);
    setResultadoDoTermo({ ok: r.ok, texto: textoDoResultadoDoTermo(r, preenchidos) });
  };

  /** Margem vazia grava `null`: sem ela a estratégia de desempate aguarda. */
  const handleMargemItem = (id: string, valor: number | null) => {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, margemDesempate: valor } : i)));
  };

  /** Lance final vazio grava `null`: sem ele o robô não dá o lance final fechado. */
  const handleLanceFinalItem = (id: string, valor: number | null) => {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, lanceFinalFechado: valor && valor > 0 ? valor : null } : i)));
  };

  const handleSave = () => {
    const lance: LanceConfig = {
      id: editingLance?.id || crypto.randomUUID(),
      edital, portal,
      valorReferencia: somaReferencia,
      valorInicial,
      valorMinimo,
      decrementoMin: parseFloat(decrementoMin) || 0,
      // Campo vazio é "sem decremento percentual", e não 1,5%: sem decremento
      // nenhum, o robô desce só o intervalo mínimo que o edital publica
      // (R$ 0,0100 no 7/2026), para não gastar margem à toa — decisão do Ian em
      // 16/09. O `|| 1.5` de antes, e o 1,5 já escrito no campo de disputa
      // nova, gravavam um passo que ninguém escolheu.
      decrementoPercentual: parseFloat(decrementoPercentual) > 0 ? parseFloat(decrementoPercentual) : 0,
      intervaloSegundos: parseInt(intervaloSegundos) || 30,
      // Vazio ou zero = sem teto: o robô disputa até o piso de cada item.
      maxLances: parseInt(maxLances) > 0 ? parseInt(maxLances) : null,
      modoAutomatico, status: 'aguardando', horario,
      dataSessao: dataSessao || undefined,
      meuLance: editingLance?.meuLance || 0,
      valorAtual: somaReferencia,
      // Com um item só, a grade não mostra a coluna Piso: o piso do item é o
      // do cartão "Valor mínimo (piso)", total ÷ quantidade (decisão de 17/09).
      itens: itens.length === 1
        ? itens.map(i => ({ ...i, valorMinimo: pisoUnitarioDoItemUnico(valorMinimo, i.quantidade) }))
        : itens,
      tipoDisputa,
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
  // Coluna Piso só com dois ou mais itens; com um, o cartão já é o piso.
  const mostrarPiso = itens.length > 1;

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

  const statusVariant = (s: string): BadgeVariant => {
    const map: Record<string, BadgeVariant> = {
      'Monitorando': 'info',
      'Analisando': 'warning',
      'Proposta': 'info',
      'Em Disputa': 'success',
      'Vencida': 'success',
      'Homologada': 'success',
    };
    return map[s] || 'muted';
  };

  const stepLabels = editingLance
    ? ['1. Dados da Disputa', '2. Itens / Lotes']
    : ['1. Origem', '2. Dados da Disputa', '3. Itens / Lotes'];

  const currentStepIndex = editingLance ? step - 1 : step;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4" aria-hidden="true" /> Nova Sessão de Lance
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
      {/* 6xl, não 5xl: a grade de itens tem dez colunas (três delas campos de
          112 px) e somava mais que a largura útil do 5xl — o navegador espremia
          as células de texto até uma letra por linha ("Q/t/d", "1/./4/7/0"),
          print de 17/09. Em tela menor a grade rola dentro do próprio quadro. */}
      <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 space-y-3">
          <div className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-md bg-primary-tint text-primary shrink-0">
                <Bot className="w-5 h-5" aria-hidden="true" />
              </span>
              {editingLance ? 'Editar Sessão de Lance' : 'Configurar Nova Sessão de Lance'}
            </DialogTitle>
            <DialogDescription>
              {step === 0 && 'Escolha como deseja cadastrar a disputa.'}
              {step === 1 && `Passo ${editingLance ? '1/2' : '2/3'} — Configure os parâmetros gerais da disputa.`}
              {step === 2 && `Passo ${editingLance ? '2/2' : '3/3'} — Cadastre os itens/lotes. Os valores da disputa são calculados automaticamente.`}
            </DialogDescription>
          </div>

          {/* Trilha de passos. Verde cheio no passo atual é estado ativo, não
              ação — a ação fica no rodapé. Passo concluído em tinta suave. */}
          <ol className="flex items-center gap-2 flex-wrap" aria-label="Passos">
            {stepLabels.map((label, idx) => (
              <li key={label} className="flex items-center gap-2">
                {idx > 0 && <div className="w-6 h-px bg-border" aria-hidden="true" />}
                <div
                  aria-current={currentStepIndex === idx ? 'step' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    currentStepIndex === idx ? 'bg-primary text-primary-foreground' :
                    currentStepIndex > idx ? 'bg-success-tint text-success-ink' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStepIndex > idx && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
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
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border bg-card hover:border-primary/40 hover:bg-muted transition-colors text-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary-tint transition-colors">
                  <Pencil className="w-5 h-5 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Cadastro Manual</p>
                  <p className="text-sm text-muted-foreground mt-1">Preencha todos os dados manualmente.</p>
                </div>
              </button>
              <button
                type="button"
                aria-pressed={!showEditalUpload}
                onClick={() => setShowEditalUpload(false)}
                className="relative flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-primary/40 bg-primary-tint hover:border-primary transition-colors text-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="absolute top-3 right-3 text-xs font-semibold uppercase tracking-wider text-primary bg-card rounded px-1.5 py-0.5">
                  Recomendado
                </span>
                <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center">
                  <FileSearch className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Importar do Kanban</p>
                  <p className="text-sm text-muted-foreground mt-1">Importe dados + itens precificados.</p>
                </div>
              </button>
              <button
                type="button"
                aria-pressed={showEditalUpload}
                onClick={() => setShowEditalUpload(true)}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border bg-card hover:border-primary/40 hover:bg-muted transition-colors text-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary-tint transition-colors">
                  <Sparkles className="w-5 h-5 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Extrair do Edital (IA)</p>
                  <p className="text-sm text-muted-foreground mt-1">Envie o edital e a IA extrai itens e valores.</p>
                </div>
              </button>
            </div>

            {/* AI Edital Upload area */}
            {showEditalUpload && (
              <div className="space-y-3 border border-border rounded-lg bg-muted p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  <h4 className="text-base font-semibold text-foreground">Extração Inteligente do Edital</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Envie o Edital ou Termo de Referência. A IA extrairá automaticamente: Nº do item, Descrição, Quantidade, Unidade, Valor Unitário e Valor Total de referência.
                </p>

                {!editalFile ? (
                  <button
                    type="button"
                    onClick={() => editalFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border bg-card rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary-tint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium text-foreground">Clique para enviar o arquivo</span>
                    <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT — Máx. 15MB</span>
                  </button>
                ) : (
                  <div className="bg-card rounded-lg p-4 border border-border flex flex-wrap items-center gap-3">
                    <FileText className="w-6 h-6 text-muted-foreground shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{editalFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(editalFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={handleExtractFromEdital}
                        disabled={isExtracting}
                      >
                        {isExtracting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Extraindo...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" aria-hidden="true" /> Extrair Itens e Valores</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Remover arquivo"
                        onClick={() => { setEditalFile(null); if (editalFileRef.current) editalFileRef.current.value = ''; }}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )}
                <input ref={editalFileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleEditalFileChange} />

                {isExtracting && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Analisando o documento e extraindo itens, quantidades e valores de referência...
                  </div>
                )}
              </div>
            )}

            {/* Vindo de uma pasta, a disputa é DELA. Trocar de processo aqui
                dispararia lances no pregão errado — então a lista de outros
                processos exige um passo explícito. */}
            {!showEditalUpload && processoAtivoId && licitacaoIdRef === processoAtivoId && !trocarProcesso && (
              <div className="rounded-lg border border-primary/30 bg-primary-tint px-4 py-3 flex items-center gap-2 flex-wrap">
                <Target className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Disputa do processo aberto:</span>
                <span className="text-sm font-semibold">{edital || '—'}</span>
                <Button
                  size="sm" variant="ghost" className="ml-auto"
                  onClick={() => setTrocarProcesso(true)}
                >
                  Escolher outro processo
                </Button>
              </div>
            )}

            {/* Licitações list */}
            {!showEditalUpload && !(processoAtivoId && licitacaoIdRef === processoAtivoId && !trocarProcesso) && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <FileSearch className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                    Seus Processos Licitatórios
                  </h4>
                  <Badge variant="muted">
                    {filteredLicitacoes.length} {filteredLicitacoes.length === 1 ? 'processo' : 'processos'}
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      placeholder="Buscar por número, órgão ou objeto..."
                      aria-label="Buscar processo"
                      value={searchLic}
                      onChange={(e) => setSearchLic(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={s}>
                          {s === 'todos' ? 'Todos os status' : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingLicitacoes ? (
                  <div className="space-y-2 py-2" role="status" aria-busy="true">
                    <span className="sr-only">Carregando processos</span>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : filteredLicitacoes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted">
                    <div className="w-10 h-10 rounded-full bg-primary-tint text-primary flex items-center justify-center mx-auto mb-2">
                      <Building2 className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="text-base font-semibold">Nenhum processo</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {licitacoes.length === 0
                        ? 'Nenhum processo na gestão. Inicie um processo pelo Monitoramento ou Kanban.'
                        : 'Nenhum processo encontrado com os filtros selecionados.'}
                    </p>
                  </div>
                ) : (
                  <div
                    className="min-h-[14rem] max-h-[42vh] w-full min-w-0 overflow-y-auto rounded-lg border border-border bg-muted/30 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-muted/30"
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
                          className={`w-full min-w-0 text-left rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary-tint group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            selectedLicId === lic.id && loadingItems
                              ? 'border-primary bg-primary-tint'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-base font-bold text-foreground cursor-help"
                                  title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
                                >
                                  {identidade.rotulo}
                                </span>
                                {identidade.srpNoTexto && (
                                  <Badge variant="muted">SRP</Badge>
                                )}
                                <Badge variant={statusVariant(lic.status)}>
                                  {lic.status}
                                </Badge>
                              </div>
                              {/* `truncate` (nowrap) foi o que estourava o modal
                                  em grid; aqui o pai tem min-w-0 e o modal é
                                  flex, então corta o texto, não o layout. */}
                              <p className="text-sm text-muted-foreground mt-1 truncate">{lic.orgao}</p>
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{lic.objeto}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {lic.portal && <span className="truncate">{lic.portal}</span>}
                                {lic.valor_estimado && (
                                  <span className="tabular-nums font-medium text-foreground shrink-0">
                                    {formatCurrency(lic.valor_estimado)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 self-center">
                              {loadingItems && selectedLicId === lic.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />
                              ) : (
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
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
              <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-success-tint border border-success-line text-sm text-success-ink">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {licitacaoIdRef
                      ? <>Dados importados do processo <strong>{edital}</strong>{itens.length > 0 ? <> · <strong>{itens.length}</strong> {itens.length === 1 ? 'item carregado' : 'itens carregados'}</> : ''}</>
                      : itens.length > 0 && itens.every((i) => i.origem === 'ia')
                        ? <><strong>{itens.length} {itens.length === 1 ? 'item extraído' : 'itens extraídos'}</strong> do edital por IA</>
                        : <><strong>{itens.length}</strong> {itens.length === 1 ? 'item cadastrado' : 'itens cadastrados'} nesta disputa</>
                    }
                  </p>
                  {licitacaoIdRef && (
                    <p className="text-xs text-success-ink font-normal">
                      🔗 Fonte única: estes mesmos itens estão sincronizados com a <strong>Proposta Comercial</strong> e a <strong>Precificação</strong>.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-base font-semibold text-foreground">Identificação da Licitação</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="disputa-edital">Nº do Edital / Pregão *</Label>
                  <Input
                    id="disputa-edital"
                    value={edital}
                    onChange={(e) => setEdital(e.target.value)}
                    placeholder={ehComprasGov ? '90012/2025' : 'PE-001/2026'}
                    className="mt-1"
                  />
                  {ehComprasGov && (
                    /* O robô só consegue buscar no Compras.gov com número e ano;
                       "TESTE-COMPRASGOV" é recusado antes de abrir o portal. Dizer
                       aqui poupa um envio para descobrir. */
                    <p className={cn('text-xs mt-1', /\d{1,6}\s*\/\s*\d{4}/.test(edital) ? 'text-muted-foreground' : 'text-warning-ink')}>
                      No Compras.gov, use o <b>número da compra</b> no formato número/ano — ex.: 90012/2025.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="disputa-portal">Portal *</Label>
                  <Select value={portal} onValueChange={setPortal}>
                    <SelectTrigger id="disputa-portal" className="mt-1"><SelectValue placeholder="Selecione o portal" /></SelectTrigger>
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
                  <Label htmlFor="disputa-uasg">UASG (código da unidade compradora)</Label>
                  <Input
                    id="disputa-uasg"
                    value={uasg}
                    onChange={(e) => { setUasg(e.target.value.replace(/\D/g, '').slice(0, 6)); setUasgPuxada(false); }}
                    inputMode="numeric"
                    placeholder="170162"
                    className="mt-1 w-full sm:w-40"
                  />
                  {uasgPuxada && (
                    <p className="text-xs text-muted-foreground mt-1" role="status">
                      UASG puxada do processo (espelho do PNCP). Confira no edital.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    O número da compra se repete entre órgãos; a UASG é o que torna a busca exata. Está no edital e na lista do portal (ex.: <b>170162</b> - MINISTERIO DA FAZENDA).
                  </p>
                  {/* Fase 6: com UASG e número/ano, a compra vem dos dados abertos
                      do Compras.gov — itens, datas e dados da licitação. */}
                  <div className="mt-3 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleBuscarCompra}
                      disabled={buscandoCompra || !podeBuscarCompra(uasg, edital)}
                    >
                      {buscandoCompra
                        ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Buscando a compra...</>
                        : <><Search className="w-4 h-4" aria-hidden="true" /> Buscar itens e dados no Compras.gov</>}
                    </Button>
                    {!podeBuscarCompra(uasg, edital) && (
                      <p className="text-xs text-muted-foreground">Preencha o número/ano e a UASG para buscar.</p>
                    )}
                    {erroDaCompra && (
                      <p className="text-sm text-destructive-ink" role="alert">{erroDaCompra}</p>
                    )}
                    {comprasAchadas.length > 1 && (
                      <div className="space-y-1.5" role="status">
                        <p className="text-sm text-foreground">Há {comprasAchadas.length} compras com esse número nesta UASG. Qual é a do edital?</p>
                        {comprasAchadas.map((c) => (
                          <Button key={c.idCompra} type="button" variant="outline" size="sm" className="mr-2" onClick={() => aplicarCompra(c)}>
                            {c.modalidade} · {c.itens.length} {c.itens.length === 1 ? 'item' : 'itens'}
                          </Button>
                        ))}
                      </div>
                    )}
                    {compraEscolhida && (() => {
                      const resumo = resumoDaCompra(compraEscolhida);
                      return (
                        <div className="rounded-lg border border-border bg-muted px-4 py-3 space-y-1" role="status">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-success-ink shrink-0" aria-hidden="true" />
                            {resumo.titulo} encontrada no Compras.gov
                          </p>
                          {resumo.linhas.map((linha, idx) => (
                            <p key={idx} className={cn('text-xs text-muted-foreground', idx === 2 && 'line-clamp-2')}>{linha}</p>
                          ))}
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            {compraEscolhida.urlPncp && (
                              <a
                                href={compraEscolhida.urlPncp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                Ver no PNCP
                              </a>
                            )}
                            {itens.length > 0 && itensDaCompraDe !== compraEscolhida.idCompra && compraEscolhida.itens.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  usarItensDaCompra(compraEscolhida);
                                  toast.success(`Itens trocados pelos ${compraEscolhida.itens.length} da compra.`);
                                }}
                              >
                                Usar os {compraEscolhida.itens.length} itens da compra (substitui os {itens.length} atuais)
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="disputa-data">Data da Sessão</Label>
                <Input
                  id="disputa-data"
                  type="date"
                  value={dataSessao}
                  onChange={(e) => { setDataSessao(e.target.value); setSessaoPuxada(null); }}
                  className="mt-1 w-full"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Com data e horário preenchidos, o robô entra sozinho na sala quando a
                  sessão abrir. Sem a data, a disputa só é enviada por clique.
                </p>
              </div>
              <div>
                <Label htmlFor="disputa-horario">Horário da Sessão</Label>
                <Input id="disputa-horario" type="time" value={horario} onChange={(e) => { setHorario(e.target.value); setSessaoPuxada(null); }} className="mt-1 w-full sm:w-40" />
              </div>
            </div>
            {/* De onde veio a data que a pessoa não digitou — e o pedido de
                conferência quando o horário parece a importação com o fuso
                errado. Some quando a pessoa mexe no campo. */}
            {sessaoPuxada && (
              <p className={cn('text-xs', sessaoPuxada.horarioIncomum ? 'text-warning-ink' : 'text-muted-foreground')} role="status">
                {sessaoPuxada.fonte === 'abertura'
                  ? 'Data e horário puxados da abertura do processo.'
                  : 'Data e horário puxados do fim do prazo de propostas do processo — no Compras.gov, a sessão abre logo em seguida.'}
                {sessaoPuxada.horarioIncomum
                  ? ` Horário antes das ${HORA_MINIMA_ESPERADA}h: confira no edital. Parte dos processos importados do PNCP está com o horário 3 horas adiantado.`
                  : sessaoPuxada.horario ? ' Confira no edital.' : ' O processo não tem horário: preencha.'}
              </p>
            )}
            {/* O que o agendador vai fazer com o que está preenchido — dito na
                hora, e não descoberto no dia do pregão. Só horário, ou só data,
                não agenda nada. */}
            {(() => {
              const agenda = agendamentoDaDisputa({ dataSessao, horario });
              if (agenda.tipo === 'agendada') {
                return (
                  <p className="text-sm text-muted-foreground" role="status">
                    O robô entra sozinho {agenda.textoEntrada}, 15 minutos antes da sessão de {agenda.texto}.
                  </p>
                );
              }
              if (agenda.tipo === 'so-horario') {
                return (
                  <p className="text-sm text-warning-ink" role="status">
                    Falta a data: sem ela, o robô não entra sozinho — só por Ações › Entrar agora, na página da disputa.
                  </p>
                );
              }
              if (agenda.tipo === 'so-data') {
                return (
                  <p className="text-sm text-warning-ink" role="status">
                    Falta o horário: sem ele, o robô não entra sozinho — só por Ações › Entrar agora, na página da disputa.
                  </p>
                );
              }
              return null;
            })()}

            <div className="space-y-3">
              <h4 className="text-base font-semibold text-foreground">Regras de Decremento Automático</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="disputa-decremento-min">Decremento Mínimo (R$)</Label>
                  <MoneyInput id="disputa-decremento-min" value={Number(decrementoMin) || 0} onValueChange={(v) => setDecrementoMin(String(v))} placeholder="R$ 50.000,00" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="disputa-decremento-pct">Decremento Percentual (%)</Label>
                  <Input id="disputa-decremento-pct" type="number" step="0.1" value={decrementoPercentual} onChange={(e) => setDecrementoPercentual(e.target.value)} placeholder="vazio = intervalo do edital" className="mt-1" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Vazios, o robô desce só o intervalo mínimo entre lances publicado no edital, para não gastar margem à toa. Preencha só para descer mais a cada lance; um valor menor que o intervalo do edital sobe para ele, porque o portal recusaria o lance.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="disputa-intervalo">Intervalo entre lances (seg)</Label>
                  <Input id="disputa-intervalo" type="number" min={10} value={intervaloSegundos} onChange={(e) => setIntervaloSegundos(e.target.value)} placeholder="30" title="Mínimo de 10 s: abaixo disso o robô relê o portal a cada 10 s de qualquer jeito" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="disputa-max-lances">Máx. lances por sessão</Label>
                  <Input id="disputa-max-lances" type="number" min={0} value={maxLances} onChange={(e) => setMaxLances(e.target.value)} placeholder="sem limite" className="mt-1" />
                  <p className="text-sm text-muted-foreground mt-1">Conta os lances enviados. Vazio: disputa até o piso de cada item.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 bg-muted rounded-lg p-4 border border-border">
              <div>
                <Label htmlFor="disputa-modo-automatico" className="text-base font-medium">Modo Automático</Label>
                <p className="text-sm text-muted-foreground mt-1">O robô enviará lances automaticamente respeitando os parâmetros configurados</p>
              </div>
              <Switch id="disputa-modo-automatico" checked={modoAutomatico} onCheckedChange={setModoAutomatico} />
            </div>
          </div>
        )}

        {/* ── STEP 2: Items/Lots ── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-base font-semibold text-foreground flex flex-wrap items-center gap-2">
                  <Layers className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Tipo de Disputa
                  {(licitacaoIdRef || editalFile) && (
                    <Badge variant="info">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={tipoDisputa === 'item' ? 'default' : 'outline'}
                  aria-pressed={tipoDisputa === 'item'}
                  onClick={() => setTipoDisputa('item')}
                >
                  <Package className="w-4 h-4" aria-hidden="true" /> Por Item
                </Button>
                <Button
                  type="button"
                  variant={tipoDisputa === 'lote' ? 'default' : 'outline'}
                  aria-pressed={tipoDisputa === 'lote'}
                  onClick={() => setTipoDisputa('lote')}
                >
                  <Layers className="w-4 h-4" aria-hidden="true" /> Por Lote
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {tipoDisputa === 'item'
                  ? 'Cada item será disputado individualmente. Os lances são enviados item a item.'
                  : 'Os itens são agrupados em lotes. O lance é enviado para o lote como um todo. Remova lotes ou itens que não deseja disputar.'}
              </p>
            </div>

            {/* Add item form */}
            <div className="space-y-3">
              <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Adicionar {tipoDisputa === 'lote' ? 'Item ao Lote' : 'Item'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
                <div className="col-span-2 md:col-span-5">
                  <Label htmlFor="novo-item-descricao">Descrição *</Label>
                  <Input id="novo-item-descricao" value={novoDesc} onChange={(e) => setNovoDesc(e.target.value)} placeholder="Ex: Toner HP 26A" className="mt-1" />
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="novo-item-qtd">Qtd</Label>
                  <Input id="novo-item-qtd" type="number" min="1" value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="novo-item-unidade">Unid.</Label>
                  <Input id="novo-item-unidade" value={novoUnidade} onChange={(e) => setNovoUnidade(e.target.value)} placeholder="UN" className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="novo-item-valor">Valor Unit. (R$)</Label>
                  <MoneyInput id="novo-item-valor" value={Number(novoValorRef) || 0} onValueChange={(v) => setNovoValorRef(String(v))} placeholder="R$ 0,00" className="mt-1" />
                </div>
                {tipoDisputa === 'lote' && (
                  <div className="md:col-span-2">
                    <Label htmlFor="novo-item-lote">Lote</Label>
                    <Input id="novo-item-lote" value={novoLote} onChange={(e) => setNovoLote(e.target.value)} placeholder="Lote 1" className="mt-1" />
                  </div>
                )}
                <div className={tipoDisputa === 'lote' ? 'col-span-2 md:col-span-1' : 'col-span-2 md:col-span-3'}>
                  <Button onClick={handleAddItem} disabled={!novoDesc.trim()} className="w-full" aria-label="Adicionar item">
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span className="md:sr-only">Adicionar</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Items list */}
            {itens.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-foreground">
                    {itens.length} {itens.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
                    {tipoDisputa === 'lote' && lotes.length > 0 && (
                      <span className="font-normal text-muted-foreground ml-2">em {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}</span>
                    )}
                  </h4>
                  {licitacaoIdRef && (
                    <Badge variant="success">
                      Importados do Kanban
                    </Badge>
                  )}
                </div>

                {compraEscolhida && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleMarcaModeloDoTermo} disabled={lendoTermo}>
                        {lendoTermo
                          ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Lendo o termo de referência...</>
                          : <><FileSearch className="w-4 h-4" aria-hidden="true" /> Procurar marca e modelo no termo de referência</>}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Lê o termo publicado no PNCP com IA e preenche só campo vazio. Pode levar até 1 minuto.
                      </span>
                    </div>
                    {resultadoDoTermo && (
                      <p className={cn('text-xs', resultadoDoTermo.ok ? 'text-muted-foreground' : 'text-destructive-ink')} role={resultadoDoTermo.ok ? 'status' : 'alert'}>
                        {resultadoDoTermo.texto}
                      </p>
                    )}
                  </div>
                )}

                {tipoDisputa === 'lote' && lotes.length > 0 ? (
                  /* Grouped by lote view */
                  <div className="space-y-3">
                    {lotes.map((lote) => {
                      const loteItens = itens.filter(i => i.lote === lote);
                      const loteTotal = loteItens.reduce((s, i) => s + (i.valorReferencia * i.quantidade), 0);
                      // overflow-x-auto, não hidden: com a largura mínima da grade,
                      // hidden cortaria as últimas colunas em tela estreita.
                      return (
                        <div key={lote} className="border border-border rounded-lg overflow-x-auto">
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted px-3 py-2 border-b border-border">
                            <div className="flex flex-wrap items-center gap-2">
                              <Layers className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                              <span className="text-sm font-bold text-foreground">{lote}</span>
                              <Badge variant="muted">{loteItens.length} {loteItens.length === 1 ? 'item' : 'itens'}</Badge>
                              <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(loteTotal)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveLote(lote)}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" /> Remover Lote
                            </Button>
                          </div>
                          <Table className={GRADE_DE_ITENS}>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="w-10 text-center">Nº</TableHead>
                                <TableHead className="min-w-[10rem]">Descrição</TableHead>
                                <TableHead title="Marca e modelo ofertados. Em item do processo, vêm da Proposta">Marca / Modelo</TableHead>
                                <TableHead className="text-center">Qtd</TableHead>
                                <TableHead className="text-center">Unid.</TableHead>
                                <TableHead className="text-right">Vlr Unit.</TableHead>
                                <TableHead className="text-right">Vlr Total</TableHead>
                                {mostrarPiso && <TableHead className="text-right" title="Piso deste item — o robô não desce abaixo dele">Piso</TableHead>}
                                <TableHead title="Melhor preço: cobre o 1º lugar sempre. Iminência: só nos 2 minutos finais da etapa aberta.">Estratégia</TableHead>
                                <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loteItens.map((item) => (
                                <LinhaDeItem
                                  key={item.id}
                                  item={item}
                                  larguraDescricao="max-w-[180px]"
                                  aoMudarValor={handleValorItem}
                                  aoMudarMarcaModelo={handleMarcaModeloItem}
                                  aoMudarPiso={handlePisoItem}
                                  aoMudarEstrategia={handleEstrategiaItem}
                                  aoMudarMargem={handleMargemItem}
                                  mostrarLanceFinal={mostrarLanceFinal} mostrarPiso={mostrarPiso}
                                  aoMudarLanceFinal={handleLanceFinalItem}
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
                  <div className="border border-border rounded-lg max-h-56 overflow-auto">
                    <Table className={GRADE_DE_ITENS}>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-10 text-center">Nº</TableHead>
                          <TableHead className="min-w-[10rem]">Descrição</TableHead>
                          <TableHead title="Marca e modelo ofertados. Em item do processo, vêm da Proposta">Marca / Modelo</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-center">Unid.</TableHead>
                          <TableHead className="text-right">Vlr Unit.</TableHead>
                          <TableHead className="text-right">Vlr Total</TableHead>
                          {mostrarPiso && <TableHead className="text-right" title="Piso deste item — o robô não desce abaixo dele">Piso</TableHead>}
                                <TableHead title="Melhor preço: cobre o 1º lugar sempre. Iminência: só nos 2 minutos finais da etapa aberta.">Estratégia</TableHead>
                          <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((item) => (
                          <LinhaDeItem
                            key={item.id}
                            item={item}
                            larguraDescricao="max-w-[160px]"
                            aoMudarValor={handleValorItem}
                                  aoMudarMarcaModelo={handleMarcaModeloItem}
                                  aoMudarPiso={handlePisoItem}
                            aoMudarEstrategia={handleEstrategiaItem}
                            aoMudarMargem={handleMargemItem}
                            mostrarLanceFinal={mostrarLanceFinal} mostrarPiso={mostrarPiso}
                            aoMudarLanceFinal={handleLanceFinalItem}
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
              <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary-tint text-primary flex items-center justify-center mx-auto">
                  <Package className="w-6 h-6" aria-hidden="true" />
                </div>
                <p className="text-base font-semibold">Nenhum item cadastrado ainda</p>
                <p className="text-sm text-muted-foreground">
                  Extraia automaticamente via IA ou preencha o formulário acima.
                </p>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => editalFileRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" aria-hidden="true" /> Enviar Edital (PDF/DOC)
                    </Button>
                    {editalFile && (
                      <Button
                        onClick={handleAutoExtractItems}
                      >
                        <Sparkles className="w-4 h-4" aria-hidden="true" /> Extrair Itens via IA
                      </Button>
                    )}
                  </div>
                  {editalFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4" aria-hidden="true" />
                      <span className="truncate max-w-[200px]">{editalFile.name}</span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-destructive"
                        onClick={() => { setEditalFile(null); if (editalFileRef.current) editalFileRef.current.value = ''; }}
                      >
                        remover
                      </Button>
                    </div>
                  )}
                </div>
                <input ref={editalFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.xls" className="hidden" onChange={handleEditalFileChange} />
              </div>
            )}

            {itens.length === 0 && isExtracting && (
              <div className="text-center py-8 border border-border rounded-lg bg-muted space-y-3" role="status" aria-busy="true">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="text-base font-medium text-foreground">Extraindo itens automaticamente...</p>
                <p className="text-sm text-muted-foreground">
                  A IA está analisando o edital para identificar descrição, quantidade, unidade e valores de referência.
                </p>
              </div>
            )}

            {/* ── Values panel ── */}
            {itens.length > 0 && (
              <div className="space-y-3 border border-border rounded-lg bg-muted p-4">
                <h4 className="text-base font-semibold text-foreground flex flex-wrap items-center gap-2">
                  <Calculator className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  Valores da Disputa
                  <Badge variant="muted" className="sm:ml-auto">
                    Desconto calculado automaticamente
                  </Badge>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Edite os valores em R$ abaixo. O percentual de desconto é calculado automaticamente com base no Valor de Referência.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Valor de Referência – read-only sum */}
                  <div className="bg-card rounded-lg border border-border p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor de Referência</p>
                    <p className="text-[2rem] leading-10 font-bold text-foreground mt-1 tabular-nums">{formatCurrency(somaReferencia)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Σ (Qtd × Vlr Unit.)</p>
                  </div>

                  {/* Valor Inicial – editable R$ */}
                  <div className={`bg-card rounded-lg border p-4 text-center ${inexequibilidadeInicial ? 'border-destructive' : 'border-border'}`}>
                    <Label htmlFor="disputa-valor-inicial" className="text-xs text-muted-foreground uppercase tracking-wider font-normal">Valor Inicial (1º lance)</Label>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <MoneyInput
                        id="disputa-valor-inicial"
                        value={Number(valorInicialInput) || 0}
                        onValueChange={(v) => setValorInicialInput(String(v))}
                        placeholder="R$ 0,00"
                        className="w-40 text-center tabular-nums font-bold"
                      />
                    </div>
                    <p className={`text-xs font-semibold mt-2 ${inexequibilidadeInicial ? 'text-destructive' : 'text-foreground'}`}>
                      {pctDescontoInicial >= 0 ? `↓ ${pctDescontoInicial.toFixed(2)}% de desconto` : `↑ ${Math.abs(pctDescontoInicial).toFixed(2)}% acima`}
                    </p>
                    {inexequibilidadeInicial && (
                      <p className="text-xs text-destructive font-bold mt-0.5 animate-pulse">⚠️ INEXEQUÍVEL</p>
                    )}
                  </div>

                  {/* Valor Mínimo – editable R$ */}
                  <div className={`bg-card rounded-lg border p-4 text-center ${inexequibilidadeMinimo ? 'border-destructive' : 'border-destructive-line'}`}>
                    <Label htmlFor="disputa-valor-minimo" className="text-xs text-muted-foreground uppercase tracking-wider font-normal">Valor Mínimo (piso)</Label>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <MoneyInput
                        id="disputa-valor-minimo"
                        value={Number(valorMinimoInput) || 0}
                        onValueChange={(v) => setValorMinimoInput(String(v))}
                        placeholder="R$ 0,00"
                        className="w-40 text-center tabular-nums font-bold"
                      />
                    </div>
                    <p className={`text-xs font-semibold mt-2 ${inexequibilidadeMinimo ? 'text-destructive' : 'text-destructive-ink'}`}>
                      {pctDescontoMinimo >= 0 ? `↓ ${pctDescontoMinimo.toFixed(2)}% de desconto` : `↑ ${Math.abs(pctDescontoMinimo).toFixed(2)}% acima`}
                    </p>
                    {inexequibilidadeMinimo && (
                      <p className="text-xs text-destructive font-bold mt-0.5 animate-pulse">⚠️ INEXEQUÍVEL</p>
                    )}
                  </div>
                </div>

                {/* Inexequibilidade alert banner */}
                {(inexequibilidadeInicial || inexequibilidadeMinimo) && (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-destructive-tint border border-destructive-line text-sm text-destructive-ink" role="alert">
                    <span className="text-base leading-none mt-0.5" aria-hidden="true">🚨</span>
                    <div>
                      <p className="font-bold">Risco de Inexequibilidade (Art. 59, §4º da Lei 14.133/2021)</p>
                      <p className="mt-0.5">
                        Propostas com desconto superior a 50% do valor de referência podem ser consideradas inexequíveis pelo pregoeiro, exigindo comprovação de viabilidade econômica.
                      </p>
                    </div>
                  </div>
                )}

                {valorMinimo > valorInicial && (
                  <p className="text-sm text-destructive-ink flex items-center gap-1" role="alert">
                    ⚠️ O valor mínimo (piso) está acima do valor inicial. Revise os valores.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        </div>

        {/* Rodapé fixo. A ação principal é o `default` verde do Button de ui;
            a trilha de passos usa o mesmo verde só para dizer "aqui". */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-muted shrink-0 flex-row flex-wrap items-center justify-between sm:justify-between gap-3">
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as 0 | 1)}>
                Voltar
              </Button>
            )}
          </div>
          {/* O robô não disputa item sem piso (nem o próprio, nem o geral da
              disputa), e "Desempatar no 1º lugar" sem margem aguarda. Não
              impede salvar — a disputa pode ser cadastrada meses antes e
              completada depois —, mas diz antes, e não no pregão. */}
          {step === 2 && (() => {
            const a = avisosDaGrade({ itens, pisoGeral: valorMinimo, ehComprasGov });
            if (!a.semPiso && !a.semMargem && !a.iminenciaSemTempo && !a.lanceFinalAbaixoDoPiso) return null;
            return (
              <p className="text-sm text-warning-ink" role="status">
                {a.semPiso > 0 && `${a.semPiso} item(ns) sem piso: o robô não disputa esses itens. `}
                {a.semMargem > 0 && `${a.semMargem} item(ns) em "Desempatar no 1º lugar" sem margem: o robô aguarda neles. `}
                {a.iminenciaSemTempo > 0 &&
                  `${a.iminenciaSemTempo} item(ns) em "Iminência": no Compras.gov o robô ainda não lê o tempo restante da sala, então nesses itens ele só acompanha — para disputar, use "Melhor preço". `}
                {a.lanceFinalAbaixoDoPiso > 0 &&
                  `${a.lanceFinalAbaixoDoPiso} item(ns) com lance final abaixo do piso: o robô não dá esse lance.`}
              </p>
            );
          })()}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            {step === 0 && (
              <Button onClick={() => setStep(1)} variant="outline">
                <Pencil className="w-4 h-4" aria-hidden="true" /> Pular para cadastro manual
              </Button>
            )}
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                Próximo: Itens / Lotes
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={handleSave}
                disabled={itens.length === 0 || somaReferencia <= 0 || valorMinimo > valorInicial}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                {editingLance ? 'Salvar Alterações' : 'Cadastrar Sessão'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
