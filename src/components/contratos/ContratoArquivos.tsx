import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { salvarNaPastaDoProcesso } from '@/lib/processo/salvarNaPasta';
import { efeitoNoLimite } from '@/lib/contratos/rotulos';
import {
  assinarReleituras, releiturasEmCurso, releituraDe,
  comecarReleitura, progredirReleitura, terminarReleitura,
} from '@/lib/contratos/releitura';
import {
  Upload, Download, FileText, Trash2, Pencil, Loader2, File, DollarSign, Package, Calendar, Layers, FilePlus2, RefreshCw, Repeat, Eye, Sparkles, MoreHorizontal
} from 'lucide-react';
import DocumentDetectionDialog, { type DetectionResult } from './DocumentDetectionDialog';
import { confrontarContratoComAta, type ConfrontoComAta } from '@/lib/contratos/confronto';
import { extractContractDataFromFile, mapDetectedToFileTipo, motivoDaUltimaFalha } from './utils/extractContractData';
import ItensDoTermo from './ItensDoTermo';
import { Checkbox } from '@/components/ui/checkbox';
import {
  avisoBloqueia, avisoExigeRessalva, avisosJuridicos, casarLinhasLidas, errosDasLinhas, fundamentoDoTipo,
  linhaDaLeitura, linhaSemMudanca, linhasParaGravar, modoDoTipo, resumoDoTermo,
  type Aviso, type ItemDoContrato, type LinhaDoTermo, type LinhaLida,
} from '@/lib/contratos/itens-do-termo';
import { validateExtractedContract, buildParentUpdates, autoridadeDoArquivo } from './utils/validateExtractedContract';
import ContratoIaAuditoriaPanel from './ContratoIaAuditoriaPanel';
import { createLogger } from '@/services/logger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AbasGestao from '@/components/gestao/AbasGestao';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const logger = createLogger('ContratoArquivos');

/**
 * Mapeia cada código de rejeição produzido por `validateExtractedContract` para
 * uma explicação humana usada em logs e na trilha de auditoria.
 */
const REJECTION_REASONS: Record<string, string> = {
  payload_vazio: 'Payload retornado pela IA estava vazio ou não era um objeto.',
  numero_contrato: 'numero_contrato vazio, com tamanho inválido ou caractere inválido.',
  numero_ata: 'numero_ata vazio, com tamanho inválido ou caractere inválido.',
  objeto: 'objeto vazio ou fora do tamanho permitido (2-2000 chars).',
  orgao_contratante: 'orgao_contratante vazio ou fora do tamanho permitido (2-300 chars).',
  modalidade: 'modalidade vazia ou fora do tamanho permitido.',
  valor_global: 'valor_global não numérico, ≤ 0 ou acima do teto de sanidade (R$ 1 trilhão).',
  data_assinatura: 'data_assinatura em formato inválido (esperado ISO yyyy-mm-dd ou dd/mm/yyyy).',
  data_inicio: 'data_inicio em formato inválido (esperado ISO yyyy-mm-dd ou dd/mm/yyyy).',
  data_fim: 'data_fim em formato inválido (esperado ISO yyyy-mm-dd ou dd/mm/yyyy).',
  data_fim_anterior_a_inicio: 'Coerência: data_fim é anterior a data_inicio — data_fim descartada.',
  data_assinatura_posterior_a_inicio: 'Coerência: data_assinatura posterior a data_inicio — data_assinatura descartada.',
  vigencia_meses: 'vigencia_meses não inteiro positivo ou acima do teto (120 meses).',
  validade_ata_meses: 'validade_ata_meses não inteiro positivo ou acima do teto (120 meses).',
  prazo_entrega_sem_evidencia: 'prazo_entrega_dias veio sem cláusula que fale em prazo — o número parece quantidade, valor ou data lida como dias (17/09: "481,78950" de uma linha de item virou 481 dias).',
  prazo_recebimento_sem_evidencia: 'prazo_recebimento_dias veio sem cláusula que fale em prazo.',
  prazo_pagamento_sem_evidencia: 'prazo_pagamento_dias veio sem cláusula que fale em prazo.',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtQty = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

// Tipos disponíveis para CONTRATOS ADMINISTRATIVOS
const TIPOS_ARQUIVO_CONTRATO: Record<string, { label: string; color: string; isAditivo?: boolean; tipoAditivo?: string; semLimite?: boolean }> = {
  contrato_original: { label: 'Contrato Original', color: 'bg-muted text-foreground' },
  ata_srp: { label: 'ATA SRP (referência)', color: 'bg-warning-tint text-warning-ink' },
  // ── O rótulo é o INSTITUTO e o ARTIGO ────────────────────────────────────
  //
  // Padrão do "Reequilíbrio Econômico-Financeiro (art. 124, II, 'd')", que já
  // estava certo, estendido aos demais. Antes só dois dos treze citavam a
  // norma: escolher entre "Termo Aditivo de Prazo" e "Termo Aditivo de Prazo e
  // Quantidade" era escolher às cegas, sem saber qual regra o sistema ia
  // aplicar.
  //
  // O efeito no limite do art. 125 NÃO entra no rótulo — vai na linha de ajuda
  // abaixo do seletor. Rótulo é nome de instituto; consequência é outra coisa,
  // e misturar as duas produz um menu que ninguém lê até o fim.
  // ── Uma hipótese legal, uma opção ────────────────────────────────────────
  //
  // O art. 124, I, "b" descreve UMA hipótese: "modificação do valor contratual
  // EM DECORRÊNCIA de acréscimo ou diminuição quantitativa de seu objeto".
  // Quantidade é a causa; valor é o efeito — não são espécies alternativas. As
  // três opções anteriores (Quantidade / Valor / Quantidade e Valor)
  // fragmentavam a mesma hipótese, e quem registrava escolhia no palpite.
  // Viram UMA, com os dois campos numéricos no formulário: impacto financeiro
  // é campo do documento, não categoria classificatória.
  //
  // As duas mistas ("Prorrogação e Alteração — Valor/— Quantidade") citavam o
  // art. 124 para o aumento que decorre da RENOVAÇÃO do período — fundamento
  // errado: pagar mais um período é consequência do art. 107, não alteração
  // do 124. A prorrogação de contínuo passa a carregar a ESTIMATIVA do novo
  // período nos próprios campos (soma no saldo; NÃO consome o art. 125). A
  // mista única que restou é para o caso genuíno — prorrogar E acrescer
  // dentro da vigência — e grava tipo `valor_quantidade`, que conta no limite.
  aditivo_prazo: { label: 'Prorrogação de Contrato por Escopo (art. 111)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'prazo' },
  prorrogacao_continuo: { label: 'Prorrogação de Fornecimento ou Serviço Contínuo (art. 107)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'prorrogacao' },
  aditivo_escopo: { label: 'Alteração Qualitativa — Projeto ou Especificações (art. 124, I, \u201ca\u201d)', color: 'bg-muted text-foreground', isAditivo: true, tipoAditivo: 'escopo' },
  aditivo_valor_quantidade: { label: 'Alteração Quantitativa (art. 124, I, \u201cb\u201d)', color: 'bg-muted text-foreground', isAditivo: true, tipoAditivo: 'valor_quantidade' },
  aditivo_prazo_alteracao: { label: 'Prorrogação com Alteração Quantitativa (arts. 107 e 124, I, \u201cb\u201d)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'valor_quantidade' },
  // ── Uma opção, não duas ──────────────────────────────────────────────────
  //
  // "Reequilíbrio Econômico-Financeiro" e "Revisão Contratual" citavam a MESMA
  // alínea (art. 124, II, "d") — e são a mesma coisa vista de dois ângulos:
  // REVISÃO é o instrumento, REEQUILÍBRIO é a finalidade. O art. 124, II, "d"
  // é a via para força maior, caso fortuito, fato do príncipe e fato
  // imprevisível; as outras duas vias do reequilíbrio têm artigos próprios
  // (reajuste: 136, I; repactuação: 135) e opções próprias abaixo.
  //
  // Duas opções com o mesmo fundamento fazem quem registra escolher no
  // palpite — e metade dos registros cair em cada tipo, quebrando qualquer
  // soma por tipo. O rótulo único nomeia instrumento e finalidade juntos.
  aditivo_reequilibrio: { label: 'Revisão para Reequilíbrio Econômico-Financeiro (art. 124, II, \u201cd\u201d)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'reequilibrio', semLimite: true },
  aditivo_repactuacao: { label: 'Repactuação (art. 135)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'repactuacao', semLimite: true },
  aditivo_reajuste: { label: 'Reajuste (art. 136, I)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'reajuste', semLimite: true },
  // A nota de empenho tinha `tipo = 'ordem_fornecimento'` gravado desde a
  // 20260830000001, mas nenhum rótulo aqui — e aparecia como "Outro
  // Documento", que é o carimbo de quem não sabe o que guardou. É o documento
  // que autoriza a despesa (Lei 4.320/64, art. 60): merece o próprio nome.
  outro: { label: 'Outro Documento', color: 'bg-muted text-muted-foreground' },
};

/**
 * O que se anexa a uma ATA SRP, nomeado pelo instituto e pelo amparo.
 *
 * O seletor tinha só "Apostilamento" genérico e nada de termo aditivo — mas a
 * ARP comporta os dois, cada um com hipóteses PRÓPRIAS na lei, e a hipótese
 * muda o efeito no sistema: reajuste registrado por apostila (art. 136, I)
 * mexe em valor e fica fora do teto do art. 125; mudança de razão social
 * (art. 136, III) não mexe em número nenhum. Um rótulo genérico obrigava o
 * sistema a tratar tudo igual.
 *
 * A "pergunta do tipo" é o próprio seletor: cada hipótese é uma entrada, com o
 * artigo no nome — quem escolhe aprende a lei no caminho. As entradas com
 * `isAditivo` abrem o sub-formulário de valores e gravam o registro em
 * contrato_aditivos junto do upload (mesmo mecanismo do contrato).
 *
 * Chaves com prefixo próprio (apostilamento_*, ata_aditivo_*): o dicionário
 * final funde contrato e ATA, e reusar `aditivo_prazo` aqui trocaria o rótulo
 * dos arquivos de contrato já gravados.
 */
const TIPOS_ARQUIVO_ATA: Record<string, { label: string; color: string; isAditivo?: boolean; tipoAditivo?: string; semLimite?: boolean }> = {
  ata_srp: { label: 'ATA SRP Original', color: 'bg-warning-tint text-warning-ink' },
  // ── Apostilamento (Lei 14.133/2021, art. 136) — registro SEM termo aditivo ──
  apostilamento_reajuste: { label: 'Apostilamento — Reajuste/repactuação previstos (art. 136, I)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'reajuste', semLimite: true },
  apostilamento_financeiro: { label: 'Apostilamento — Atualização/compensação financeira (art. 136, II)', color: 'bg-warning-tint text-warning-ink' },
  apostilamento_razao_social: { label: 'Apostilamento — Alteração de razão social (art. 136, III)', color: 'bg-muted text-muted-foreground' },
  apostilamento_empenho: { label: 'Apostilamento — Empenho de dotação (art. 136, IV)', color: 'bg-muted text-muted-foreground' },
  // ── Contrato derivado: a ATA cumpre-se por contrato (ou empenho, art. 95) ──
  contrato_derivado: { label: 'Contrato Administrativo (derivado da ATA)', color: 'bg-muted text-foreground' },
  // ── Termo aditivo da ATA — cada hipótese com sua regra ──
  ata_aditivo_prazo: { label: 'Termo Aditivo — Prorrogação da vigência (art. 84)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'prazo' },
  ata_aditivo_adesao: { label: 'Termo Aditivo — Adesão de órgão não participante (Decreto 11.462/2023, art. 32)', color: 'bg-muted text-foreground', isAditivo: true, tipoAditivo: 'adesao' },
  ata_aditivo_remanejamento: { label: 'Termo Aditivo — Remanejamento entre participantes', color: 'bg-muted text-muted-foreground', isAditivo: true, tipoAditivo: 'remanejamento' },
  ata_aditivo_revisao: { label: 'Termo Aditivo — Revisão de preços registrados (Decreto 11.462/2023, arts. 26 e 27)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'revisao', semLimite: true },
  outro: { label: 'Outro Documento', color: 'bg-muted text-muted-foreground' },
};

// Dicionário completo (para lookup de tipos já salvos no banco).
// 'apostilamento' genérico saiu do seletor, mas arquivo antigo gravado com ele
// continua existindo — sem a chave aqui, o rótulo do badge sumiria.
const TIPOS_ARQUIVO: Record<string, { label: string; color: string; isAditivo?: boolean; tipoAditivo?: string; semLimite?: boolean }> = {
  ...TIPOS_ARQUIVO_CONTRATO,
  ...TIPOS_ARQUIVO_ATA,
  // Fica AQUI e não em TIPOS_ARQUIVO_CONTRATO de propósito: este mapa nomeia o
  // que já está guardado, e aquele lista o que se pode anexar por esta aba.
  // A nota de empenho é anexada pelo "Registrar Ordem/Empenho" em Pedidos,
  // porque lá ela também CRIA o empenho — subi-la por aqui deixaria o PDF no
  // dossiê e a autorização sem existir. Sem esta linha ela aparecia como
  // "Outro Documento", o carimbo de quem não sabe o que guardou.
  ordem_fornecimento: { label: 'Ordem de Fornecimento / Nota de Empenho', color: 'bg-muted text-foreground' },
  apostilamento: { label: 'Apostilamento', color: 'bg-warning-tint text-warning-ink' },
  // Saiu do seletor na fusão com o reequilíbrio (mesma alínea, mesmo
  // instituto); fica aqui para o arquivo antigo continuar nomeado.
  aditivo_revisao: { label: 'Revisão Contratual (art. 124, II, \u201cd\u201d)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'revisao', semLimite: true },
  // Saíram na fusão da tríade do art. 124, I, "b" e das duas mistas
  // (01/09/2026) — a hipótese legal é uma; o impacto virou campo numérico.
  aditivo_quantidade: { label: 'Alteração Quantitativa — Quantidade (art. 124, I, \u201cb\u201d)', color: 'bg-muted text-foreground', isAditivo: true, tipoAditivo: 'quantidade' },
  aditivo_valor: { label: 'Alteração Quantitativa — Valor (art. 124, I, \u201cb\u201d)', color: 'bg-success-tint text-success-ink', isAditivo: true, tipoAditivo: 'valor' },
  aditivo_prazo_valor: { label: 'Prorrogação e Alteração Quantitativa — Valor (arts. 107 e 124, I, \u201cb\u201d)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'prazo_valor' },
  aditivo_prazo_quantidade: { label: 'Prorrogação e Alteração Quantitativa — Quantidade (arts. 107 e 124, I, \u201cb\u201d)', color: 'bg-warning-tint text-warning-ink', isAditivo: true, tipoAditivo: 'prazo_quantidade' },
};

/** Nome do tipo de aditivo, para a confirmação dizer o que será apagado. */
const TIPOS_ADITIVO_LABEL: Record<string, string> = {
  valor: 'Valor', quantidade: 'Quantidade', valor_quantidade: 'Valor e Qtde',
  prazo: 'Prazo', escopo: 'Escopo', reequilibrio: 'Reequilíbrio',
  revisao: 'Revisão', repactuacao: 'Repactuação', reajuste: 'Reajuste',
  adesao: 'Adesão', remanejamento: 'Remanejamento',
};

const TIPOS_ARQUIVO_SEM_LIMITE = ['aditivo_reequilibrio', 'aditivo_revisao', 'aditivo_repactuacao', 'aditivo_reajuste', 'ata_aditivo_revisao', 'apostilamento_reajuste'];
// `prorrogacao_continuo` entra nos dois: a renovação registra a ESTIMATIVA do
// novo período (art. 107). O gatilho de saldos soma sem olhar tipo, então o
// lastro entra; o alerta do art. 125 ignora `prorrogacao` por lista de
// inclusão — lastro sim, limite não. Era a ausência daqui que fazia a
// reclassificação de ontem GRAVAR ZERO e derrubar o saldo de 7.200 para 3.600.
const showValueFields = (tipo: string) => ['aditivo_valor', 'aditivo_valor_quantidade', 'aditivo_prazo_valor', 'aditivo_prazo_alteracao', 'prorrogacao_continuo', 'aditivo_escopo', 'ata_aditivo_adesao', 'ata_aditivo_remanejamento', ...TIPOS_ARQUIVO_SEM_LIMITE].includes(tipo);
const showQtyFields = (tipo: string) => ['aditivo_quantidade', 'aditivo_valor_quantidade', 'aditivo_prazo_quantidade', 'aditivo_prazo_alteracao', 'prorrogacao_continuo', 'ata_aditivo_adesao', 'ata_aditivo_remanejamento'].includes(tipo);
const showDateField = (tipo: string) => ['aditivo_prazo', 'aditivo_prazo_valor', 'aditivo_prazo_quantidade', 'aditivo_prazo_alteracao', 'prorrogacao_continuo', 'ata_aditivo_prazo'].includes(tipo);
const isAditivoType = (tipo: string) => TIPOS_ARQUIVO[tipo]?.isAditivo === true;

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const emptyAditivoForm = {
  numero_aditivo: '',
  valor_acrescimo: '',
  valor_supressao: '',
  quantidade_acrescimo: '',
  quantidade_supressao: '',
  nova_data_fim: '',
  data_assinatura: '',
  // 26/09: vigência dos novos preços/quantidades e o período da renovação.
  data_efeitos: '',
  periodo_inicio: '',
  periodo_fim: '',
  justificativa: '',
  observacoes: '',
};

/** Como uma linha de contrato_aditivo_itens volta do banco. */
type LinhaGravada = {
  contrato_item_id: string;
  valor_unitario_anterior: number | null;
  valor_unitario_novo: number | null;
  quantidade_acrescimo: number | null;
  quantidade_supressao: number | null;
  origem: 'leitura' | 'manual';
  valor_lido: number | null;
  quantidade_lida: number | null;
  numero_item_lido: string | null;
  descricao_lida: string | null;
  aplicado_em: string | null;
};

/**
 * Tipos que valem espelhar na pasta do processo: o documento original e seus
 * aditivos. Planilha de custos e anexos internos ficam só no contrato — a pasta
 * do certame é para o que o órgão emitiu ou assinou.
 */
const DOCUMENTOS_DO_CERTAME = [
  'contrato_original', 'ata_srp', 'aditivo_valor', 'aditivo_prazo',
  'aditivo_quantidade', 'aditivo_reequilibrio', 'apostilamento',
];

export default function ContratoArquivos({ contratoId, onCadastrarDerivado }: { contratoId: string; onCadastrarDerivado?: () => void }) {
  const { user } = useAuth();
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [aditivos, setAditivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Subaba: documentos, termos aditivos e o diário de auditoria.
   *
   * Os três viviam na mesma rolagem, nesta ordem: diário no topo, arquivos no
   * meio, aditivos no fim. Quem vinha conferir um termo passava por tudo.
   */
  const [subAba, setSubAba] = useState<'arquivos' | 'aditivos' | 'auditoria'>('arquivos');
  /** Busca local sobre os documentos já carregados — nenhuma consulta nova. */
  const [buscaArquivo, setBuscaArquivo] = useState('');
  /** Termo aberto no painel lateral. */
  const [aditivoSelecionado, setAditivoSelecionado] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; arquivo: any | null }>({ open: false, arquivo: null });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editTipo, setEditTipo] = useState('contrato_original');
  const [editDescricao, setEditDescricao] = useState('');
  const [editAditivoForm, setEditAditivoForm] = useState(emptyAditivoForm);
  const [editLinkedAditivoId, setEditLinkedAditivoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [uploadTipo, setUploadTipo] = useState('contrato_original');
  const [aditivoForm, setAditivoForm] = useState(emptyAditivoForm);
  const [showAditivoFields, setShowAditivoFields] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  // Quais documentos estão sendo relidos — no módulo, para sobreviver à troca
  // de aba. Ver src/lib/contratos/releitura.ts.
  useSyncExternalStore(assinarReleituras, releiturasEmCurso);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<any>(null);
  const [parentContrato, setParentContrato] = useState<any>(null);
  const [detectionOpen, setDetectionOpen] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detectionFileName, setDetectionFileName] = useState('');
  const [confrontoAta, setConfrontoAta] = useState<ConfrontoComAta | null>(null);
  // ── Itens do termo (26/09) ────────────────────────────────────────────────
  // A tabela item a item do termo: o que a leitura do anexo trouxe, o que a
  // pessoa corrigiu, e as linhas que a leitura não casou com item nenhum.
  const [itensDoContrato, setItensDoContrato] = useState<ItemDoContrato[]>([]);
  const [linhasDoTermo, setLinhasDoTermo] = useState<Record<string, LinhaDoTermo>>({});
  const [linhasSemItem, setLinhasSemItem] = useState<LinhaLida[]>([]);
  const [comRessalva, setComRessalva] = useState(false);
  /** A última leitura de aditivo, guardada para recasar as linhas se o tipo mudar. */
  const [leituraDoTermo, setLeituraDoTermo] = useState<any>(null);
  const [linhasPorAditivo, setLinhasPorAditivo] = useState<Record<string, number>>({});
  const [aplicandoTermo, setAplicandoTermo] = useState<string | null>(null);
  const [editItens, setEditItens] = useState<ItemDoContrato[]>([]);
  const [editLinhas, setEditLinhas] = useState<Record<string, LinhaDoTermo>>({});
  const [editLinhasSemItem, setEditLinhasSemItem] = useState<LinhaLida[]>([]);
  const [editComRessalva, setEditComRessalva] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [arqRes, adtRes, contratoRes] = await Promise.all([
      supabase.from('contrato_arquivos').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: false }),
      supabase.from('contrato_aditivos').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('contratos').select('id, tipo_documento, ata_srp_id, numero_contrato, numero_ata, objeto, orgao_contratante, modalidade, valor_global, valor_global_original, data_assinatura, data_inicio, data_fim, vigencia_meses, validade_ata_meses, empresa_id, licitacao_id, data_base_reajuste').eq('id', contratoId).maybeSingle(),
    ]);
    setArquivos((arqRes.data as any[]) || []);
    setAditivos((adtRes.data as any[]) || []);
    setParentContrato(contratoRes.data || null);
    setLoading(false);

    // Quantas linhas de item cada termo tem (26/09): o painel do termo diz se
    // foram aplicadas e oferece aplicar quando ficaram pendentes. A tabela vem
    // de migration colada à mão: ausente, o painel segue sem a informação.
    const { data: linhas } = await supabase
      .from('contrato_aditivo_itens' as never)
      .select('aditivo_id')
      .eq('contrato_id', contratoId);
    const contagem: Record<string, number> = {};
    for (const l of ((linhas ?? []) as unknown as Array<{ aditivo_id: string }>)) {
      contagem[l.aditivo_id] = (contagem[l.aditivo_id] ?? 0) + 1;
    }
    setLinhasPorAditivo(contagem);
  };

  /**
   * Aplica aos itens as linhas de um termo que ficaram gravadas sem aplicar
   * (a gravação e a aplicação são dois passos; se o segundo falha, o termo
   * fica pendente e nenhum preço muda). O erro real vai para o toast.
   */
  const aplicarItensDoTermo = async (aditivoId: string) => {
    setAplicandoTermo(aditivoId);
    try {
      const { data, error } = await supabase.rpc('aplicar_itens_do_aditivo' as never, { p_aditivo_id: aditivoId } as never);
      if (error) throw error;
      const n = (data as { aplicadas?: number } | null)?.aplicadas ?? 0;
      toast.success(n > 0 ? `${n} item(ns) atualizado(s) pelo termo.` : 'Nada a aplicar: as linhas já estavam aplicadas.');
      loadData();
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
      toast.error('Não foi possível aplicar o termo aos itens.', { description: motivo, duration: 12000 });
    } finally {
      setAplicandoTermo(null);
    }
  };

  useEffect(() => { loadData(); }, [contratoId]);

  // Deep-link dos cards do Dashboard (?aba=contratos-aditivos&reler=1):
  // "reanalise os documentos anexados" tinha que ser UM clique, não "vá à
  // aba Arquivos, ache o documento e clique em Reler". Dispara a releitura
  // do documento principal (tipo 'contrato'; na falta, o primeiro PDF) e
  // limpa o parâmetro para o F5 não reler de novo.
  const [buscaParams, setBuscaParams] = useSearchParams();
  const autoRelerRef = useRef(false);
  useEffect(() => {
    if (autoRelerRef.current) return;
    if (buscaParams.get('reler') !== '1') return;
    if (loading) return;
    autoRelerRef.current = true;
    const next = new URLSearchParams(buscaParams);
    next.delete('reler');
    setBuscaParams(next, { replace: true });
    // O documento-fonte das cláusulas é o INSTRUMENTO (contrato ou ata), na
    // ordem de autoridade — nunca empenho nem publicação: o primeiro seletor
    // procurava tipo 'contrato' (valor que não existe: é 'contrato_original')
    // e caía no primeiro PDF da lista, que era uma Nota de Empenho (12/09).
    const ORDEM_DE_AUTORIDADE = ['contrato_original', 'ata_srp', 'prorrogacao_continuo', 'aditivo_reequilibrio', 'ata_aditivo_prazo'];
    const principal =
      ORDEM_DE_AUTORIDADE.map((t) => arquivos.find((a) => a.tipo === t)).find(Boolean) ??
      arquivos.find((a) => /contrato|ata(?!mento)/i.test(String(a.nome_arquivo || '')) &&
        String(a.nome_arquivo || '').toLowerCase().endsWith('.pdf'));
    if (!principal) {
      toast.warning('Nenhum contrato, ata ou aditivo anexado para reanalisar.', {
        description: 'A leitura de cláusulas usa o instrumento — empenhos e publicações não a alimentam. Envie o PDF do contrato.',
      });
      return;
    }
    toast.info(`Relendo ${principal.nome_arquivo}…`, {
      description: 'A leitura preenche só o que estiver em branco — correções manuais são preservadas.',
    });
    handleReler(principal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaParams, loading, arquivos]);

  const parentTipoDocumento: 'ata_srp' | 'contrato' | null =
    parentContrato?.tipo_documento === 'ata_srp' ? 'ata_srp'
    : parentContrato?.tipo_documento === 'contrato' ? 'contrato'
    : null;

  // Tipos disponíveis no dropdown de acordo com o tipo do documento pai
  const tiposDisponiveis = parentTipoDocumento === 'ata_srp' ? TIPOS_ARQUIVO_ATA : TIPOS_ARQUIVO_CONTRATO;

  // O padrão era 'contrato_original', que não existe entre os tipos de ATA: o
  // seletor abria VAZIO e um envio sem escolha gravava o arquivo com tipo de
  // contrato dentro de uma ata. Ao trocar de instrumento, o tipo volta para o
  // primeiro que aquele instrumento aceita.
  useEffect(() => {
    if (!tiposDisponiveis[uploadTipo]) setUploadTipo(Object.keys(tiposDisponiveis)[0]);
  }, [tiposDisponiveis, uploadTipo]);

  // When upload type changes, show/hide aditivo fields
  useEffect(() => {
    const isAdt = isAditivoType(uploadTipo);
    setShowAditivoFields(isAdt);
    if (isAdt) {
      const count = aditivos.length + 1;
      setAditivoForm(f => ({ ...f, numero_aditivo: f.numero_aditivo || `${count}º Aditivo` }));
    }
  }, [uploadTipo, aditivos.length]);

  // ── Itens do termo: carga, leitura, totais, avisos, gravação ─────────────

  /** Os itens físicos do contrato, uma linha por item, para a tabela do termo. */
  const carregarItensDoContrato = async (): Promise<ItemDoContrato[]> => {
    const { data } = await supabase
      .from('contrato_itens')
      .select('id, codigo_item, descricao, unidade, valor_unitario, valor_unitario_original, quantidade_contratada, saldo_quantitativo, numero_lote' as never)
      .eq('contrato_id', contratoId)
      .is('origem_aditivo_id', null)
      .order('created_at', { ascending: true });
    const lista = ((data ?? []) as unknown as ItemDoContrato[]).map((i) => ({
      ...i,
      valor_unitario: Number(i.valor_unitario) || 0,
      quantidade_contratada: Number(i.quantidade_contratada) || 0,
      saldo_quantitativo: Number(i.saldo_quantitativo) || 0,
    }));
    setItensDoContrato(lista);
    return lista;
  };

  useEffect(() => {
    if (modoDoTipo(uploadTipo)) void carregarItensDoContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadTipo, contratoId]);

  /**
   * As linhas lidas do anexo viram linhas da tabela. Recasa sempre que o tipo
   * muda (a pessoa pode ter escolhido "prazo" e a leitura dizer reequilíbrio)
   * e quando os itens chegam. O que a pessoa já editou não é sobrescrito: a
   * leitura só entra enquanto a tabela está vazia.
   */
  useEffect(() => {
    const a = leituraDoTermo?.aditivo;
    const modo = modoDoTipo(uploadTipo);
    if (!a || !modo || itensDoContrato.length === 0) return;
    if (Object.keys(linhasDoTermo).length > 0) return;
    const lidas: LinhaLida[] = Array.isArray(a.itens_alterados) ? a.itens_alterados : [];
    if (lidas.length === 0) return;
    const r = casarLinhasLidas(lidas, itensDoContrato);
    const novas: Record<string, LinhaDoTermo> = {};
    for (const c of r.casadas) {
      const it = itensDoContrato.find((i) => i.id === c.itemId);
      if (it) novas[it.id] = linhaDaLeitura(it, c.linha, modo);
    }
    setLinhasDoTermo(novas);
    setLinhasSemItem(r.semItem);
    toast.success(`Leitura do termo: ${lidas.length} linha(s) de item, ${r.casadas.length} casada(s) com o cadastro${r.semItem.length ? `, ${r.semItem.length} para você apontar` : ''}.`, {
      description: 'Confira cada preço e quantidade antes de confirmar — o que a leitura errou, corrija na tabela.',
      duration: 10000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leituraDoTermo, uploadTipo, itensDoContrato]);

  // Com linhas na tabela, os totais do termo são a SOMA delas — o campo não
  // se digita por cima, porque dois números para a mesma coisa divergem.
  useEffect(() => {
    if (!modoDoTipo(uploadTipo)) return;
    const r = resumoDoTermo(linhasDoTermo, itensDoContrato);
    if (r.itensAlterados === 0) return;
    setAditivoForm((f) => ({
      ...f,
      valor_acrescimo: String(r.valorAcrescimo),
      valor_supressao: String(r.valorSupressao),
      quantidade_acrescimo: String(r.quantidadeAcrescimo),
      quantidade_supressao: String(r.quantidadeSupressao),
    }));
  }, [linhasDoTermo, itensDoContrato, uploadTipo]);

  useEffect(() => {
    if (!modoDoTipo(editTipo)) return;
    const r = resumoDoTermo(editLinhas, editItens);
    if (r.itensAlterados === 0) return;
    setEditAditivoForm((f) => ({
      ...f,
      valor_acrescimo: String(r.valorAcrescimo),
      valor_supressao: String(r.valorSupressao),
      quantidade_acrescimo: String(r.quantidadeAcrescimo),
      quantidade_supressao: String(r.quantidadeSupressao),
    }));
  }, [editLinhas, editItens, editTipo]);

  const limparTermo = () => {
    setLinhasDoTermo({});
    setLinhasSemItem([]);
    setComRessalva(false);
    setLeituraDoTermo(null);
  };

  /** O que a lei diz deste termo, com as datas e os números que estão no formulário. */
  const avisosDoTermo = (tipo: string, form: typeof emptyAditivoForm, linhas: Record<string, LinhaDoTermo>, itens: ItemDoContrato[]): Aviso[] => {
    if (!isAditivoType(tipo)) return [];
    const pc = parentContrato as { data_inicio?: string | null; data_fim?: string | null; valor_global?: number | null; valor_global_original?: number | null; data_base_reajuste?: string | null } | null;
    return avisosJuridicos({
      tipoArquivo: tipo,
      dataAssinatura: form.data_assinatura || null,
      dataEfeitos: form.data_efeitos || form.data_assinatura || null,
      dataBaseReajuste: pc?.data_base_reajuste ?? null,
      dataInicioContrato: pc?.data_inicio ?? null,
      dataFimAtual: pc?.data_fim ?? null,
      periodoInicio: form.periodo_inicio || null,
      periodoFim: form.periodo_fim || form.nova_data_fim || null,
      valorGlobalOriginal: Number(pc?.valor_global_original ?? pc?.valor_global) || null,
      resumo: resumoDoTermo(linhas, itens),
    });
  };

  /** O motivo de não salvar, ou null. */
  const problemaDoTermo = (tipo: string, form: typeof emptyAditivoForm, linhas: Record<string, LinhaDoTermo>, itens: ItemDoContrato[], ressalva: boolean): string | null => {
    const modo = modoDoTipo(tipo);
    if (modo) {
      const erros = errosDasLinhas(linhas, itens, modo);
      if (erros.length > 0) return erros[0];
    }
    const avisos = avisosDoTermo(tipo, form, linhas, itens);
    const bloqueio = avisos.find((a) => a.nivel === 'bloqueia');
    if (bloqueio) return bloqueio.texto;
    if (avisoExigeRessalva(avisos) && !ressalva) {
      return 'Há aviso que exige registro com ressalva: marque "Registrado com ressalva" ou corrija os dados.';
    }
    return null;
  };

  /** O registro do termo, com os totais vindos das linhas quando elas existem. */
  const montarPayloadDoTermo = (tipo: string, form: typeof emptyAditivoForm, linhas: Record<string, LinhaDoTermo>, itens: ItemDoContrato[], ressalva: boolean) => {
    const tipoAditivo = TIPOS_ARQUIVO[tipo]?.tipoAditivo || 'valor';
    const r = resumoDoTermo(linhas, itens);
    const linhasMandam = r.itensAlterados > 0;
    const ehRenovacao = tipo === 'prorrogacao_continuo';
    const payload: any = {
      contrato_id: contratoId,
      user_id: user!.id,
      numero_aditivo: form.numero_aditivo || `${aditivos.length + 1}º Aditivo`,
      tipo: tipoAditivo,
      valor_acrescimo: linhasMandam ? r.valorAcrescimo : (showValueFields(tipo) ? (parseFloat(form.valor_acrescimo) || 0) : 0),
      valor_supressao: linhasMandam ? r.valorSupressao : (showValueFields(tipo) ? (parseFloat(form.valor_supressao) || 0) : 0),
      quantidade_acrescimo: linhasMandam ? r.quantidadeAcrescimo : (showQtyFields(tipo) ? (parseFloat(form.quantidade_acrescimo) || 0) : 0),
      quantidade_supressao: linhasMandam ? r.quantidadeSupressao : (showQtyFields(tipo) ? (parseFloat(form.quantidade_supressao) || 0) : 0),
      nova_data_fim: form.nova_data_fim || (ehRenovacao ? form.periodo_fim : '') || null,
      data_assinatura: form.data_assinatura || null,
      data_aditivo: form.data_assinatura || null,
      data_efeitos: form.data_efeitos || form.data_assinatura || null,
      periodo_inicio: ehRenovacao ? (form.periodo_inicio || null) : null,
      periodo_fim: ehRenovacao ? (form.periodo_fim || form.nova_data_fim || null) : null,
      fundamento_legal: fundamentoDoTipo(tipo),
      com_ressalva: ressalva && avisoExigeRessalva(avisosDoTermo(tipo, form, linhas, itens)),
      justificativa: form.justificativa || null,
      observacoes: form.observacoes || null,
      // Sem isto a coluna caía no DEFAULT 'contrato' e o guarda do banco
      // barrava o aditivo de ATA: "Aditivo marcado como Contrato, mas o
      // documento referenciado é uma ATA SRP". Quem grava sabe o alvo.
      referencia_tipo: parentTipoDocumento === 'ata_srp' ? 'ata_srp' : 'contrato',
    };
    payload.valor_aditivo = payload.valor_acrescimo - payload.valor_supressao;
    return payload;
  };

  /**
   * Grava as linhas do termo e as aplica aos itens (preço vigente, saldo).
   * Ao editar, o que estava aplicado é revertido antes: o "preço anterior"
   * das linhas novas tem de ser o preço de antes do termo.
   */
  const gravarLinhasDoTermo = async (aditivoId: string, linhas: Record<string, LinhaDoTermo>, itens: ItemDoContrato[], substituir: boolean): Promise<number> => {
    if (substituir) {
      const { error: erroRev } = await supabase.rpc('reverter_itens_do_aditivo' as never, { p_aditivo_id: aditivoId } as never);
      if (erroRev) throw erroRev;
      const { error: erroDel } = await supabase.from('contrato_aditivo_itens' as never).delete().eq('aditivo_id', aditivoId);
      if (erroDel) throw erroDel;
    }
    const gravar = linhasParaGravar(linhas, itens);
    if (gravar.length === 0) return 0;
    const { error } = await supabase
      .from('contrato_aditivo_itens' as never)
      .insert(gravar.map((g) => ({ ...g, aditivo_id: aditivoId, contrato_id: contratoId })) as never);
    if (error) throw error;
    const { error: erroAplicar } = await supabase.rpc('aplicar_itens_do_aditivo' as never, { p_aditivo_id: aditivoId } as never);
    if (erroAplicar) throw erroAplicar;
    return gravar.length;
  };

  /** Preenche o formulário do aditivo com o que a leitura trouxe; as linhas entram pelo efeito acima. */
  const preencherAditivoDaLeitura = (detected: any) => {
    const a = detected?.aditivo;
    if (!a) return;
    const ehRenovacao = a.tipo_aditivo === 'renovacao';
    setAditivoForm((f) => ({
      ...f,
      numero_aditivo: a.numero_aditivo || f.numero_aditivo,
      valor_acrescimo: a.valor_acrescimo ? String(a.valor_acrescimo) : f.valor_acrescimo,
      valor_supressao: a.valor_supressao ? String(a.valor_supressao) : f.valor_supressao,
      quantidade_acrescimo: a.quantidade_acrescimo ? String(a.quantidade_acrescimo) : f.quantidade_acrescimo,
      quantidade_supressao: a.quantidade_supressao ? String(a.quantidade_supressao) : f.quantidade_supressao,
      nova_data_fim: a.periodo_fim || a.nova_data_fim || f.nova_data_fim,
      data_assinatura: detected.data_assinatura || f.data_assinatura,
      data_efeitos: f.data_efeitos || (ehRenovacao ? (a.periodo_inicio || '') : (detected.data_assinatura || '')),
      periodo_inicio: a.periodo_inicio || f.periodo_inicio,
      periodo_fim: a.periodo_fim || f.periodo_fim,
      justificativa: f.justificativa || a.justificativa || a.fundamento_citado || '',
    }));
    setLeituraDoTermo(detected);
    const tipoSugerido = mapDetectedToFileTipo('aditivo', a.tipo_aditivo);
    if (tipoSugerido && tipoSugerido !== uploadTipo && tipoSugerido !== 'outro' && tiposDisponiveis[tipoSugerido]) {
      toast.info(`A leitura classificou o documento como "${TIPOS_ARQUIVO[tipoSugerido]?.label}".`, {
        description: `O tipo escolhido é "${TIPOS_ARQUIVO[uploadTipo]?.label}". Se a leitura estiver certa, troque — os itens lidos entram na tabela do tipo certo.`,
        action: { label: 'Usar o tipo lido', onClick: () => { setLinhasDoTermo({}); setLinhasSemItem([]); setUploadTipo(tipoSugerido); } },
        duration: 20000,
      });
    } else if (!Array.isArray(a.itens_alterados) || a.itens_alterados.length === 0) {
      toast.success('IA pré-preencheu os campos do aditivo. Revise antes de confirmar.');
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    if (isAditivoType(uploadTipo)) {
      // Manual aditivo path: keep existing behaviour, but also try IA pre-fill
      setPendingFile(file);
      if (fileRef.current) fileRef.current.value = '';
      // best-effort IA pre-fill of aditivo fields
      runIaPreFillForAditivo(file).catch(() => {/* noop */});
      return;
    }

    // Non-aditivo upload: run IA detection BEFORE persisting to suggest correct registry
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setPendingFile(file);
      if (fileRef.current) fileRef.current.value = '';
      // O id fixo faz cada etapa SUBSTITUIR a anterior — uma linha de status,
      // não uma pilha de toasts. Documento digitalizado leva minutos, e espera
      // sem narração parece travamento.
      const TID = 'leitura-documento';
      toast.loading('Analisando documento via IA… Documento digitalizado pode levar 1–2 min.', { id: TID });
      try {
        const detected = await extractContractDataFromFile(
          file,
          uploadTipo,
          (msg) => toast.loading(msg, { id: TID }),
        );
        toast.dismiss(TID);
        // Falha de leitura NÃO pode ser silenciosa: o arquivo era guardado sem
        // análise e ninguém sabia que o confronto com a ATA não aconteceu.
        if (!detected) {
          toast.warning('Não foi possível ler o documento para o confronto com a ATA.', {
            description: `${motivoDaUltimaFalha() ?? 'Erro desconhecido na leitura.'} O arquivo será guardado sem análise — reenvie pelo ícone de substituir para tentar de novo.`,
            duration: 12000,
          });
        }
        if (detected && detected.tipo_documento_detectado) {
          const detectedType = detected.tipo_documento_detectado;
          const isAditivoDetected = detectedType === 'aditivo';
          const mismatch = !isAditivoDetected && parentTipoDocumento &&
            ((parentTipoDocumento === 'contrato' && detectedType === 'ata_srp') ||
             (parentTipoDocumento === 'ata_srp' && detectedType === 'contrato'));
          if (mismatch || isAditivoDetected) {
            // O confronto que a doutrina exige, ANTES de criar: quantidade do
            // contrato × saldo do item da ata, preço × registrado, valor ×
            // teto, assinatura × vigência. A leitura sozinha não basta — ela é
            // batida contra o que a ata tem GRAVADO.
            if (parentTipoDocumento === 'ata_srp' && detectedType === 'contrato' && parentContrato) {
              try {
                const [{ data: ataFresca }, { data: ataItens }] = await Promise.all([
                  supabase.from('contratos').select('valor_global, valor_consumido, data_fim').eq('id', parentContrato.id).maybeSingle(),
                  supabase.from('contrato_itens').select('id, codigo_item, descricao, unidade, quantidade_contratada, quantidade_ata_consumida, valor_unitario').eq('contrato_id', parentContrato.id),
                ]);
                setConfrontoAta(confrontarContratoComAta(
                  {
                    valorGlobal: Number(detected.valor_global) || 0,
                    dataAssinatura: detected.data_assinatura ?? null,
                    itens: Array.isArray(detected.itens) ? detected.itens : [],
                  },
                  {
                    valorGlobal: Number(ataFresca?.valor_global) || 0,
                    valorConsumido: Number(ataFresca?.valor_consumido) || 0,
                    dataFim: ataFresca?.data_fim ?? null,
                    itens: (ataItens as never[]) ?? [],
                  },
                ));
              } catch { setConfrontoAta(null); }
            } else {
              setConfrontoAta(null);
            }
            setDetection(detected as DetectionResult);
            setDetectionFileName(file.name);
            setDetectionOpen(true);
            return; // wait for user decision
          }
          // Matches expected type → upload AND auto-populate parent record fields
          const created = await doUpload(file, uploadTipo);
          await applyExtractedToParent(detected, created, uploadTipo);
          setPendingFile(null);
          return;
        }
      } catch (err) {
        toast.dismiss(TID);
        console.warn('IA detection skipped:', err);
      }
      // No detection → upload as chosen
      await doUpload(file, uploadTipo);
      // O upload guarda o PDF; o CONTRATO como registro — com saldo, itens e
      // pedidos — ainda não existe. Sem esta ponte, a aba Contratos derivados
      // fica vazia e parece dessincronizada do upload.
      if (uploadTipo === 'contrato_derivado' && onCadastrarDerivado) {
        toast.info('O arquivo foi guardado — mas o contrato ainda não existe como registro.', {
          description: 'A aba Contratos derivados só mostra registros com saldo e itens.',
          action: { label: 'Registrar contrato derivado', onClick: onCadastrarDerivado },
          duration: 20000,
        });
      }
      setPendingFile(null);
    } else {
      doUpload(file, uploadTipo);
    }
  };

  /**
   * Updates the parent `contratos` row with structured data extracted from the
   * uploaded ATA SRP / Contract PDF. Only fills empty/zero fields so it never
   * overwrites manual edits done by the user. Records every field filled into
   * the audit log table `contrato_ia_auditoria`, linking it to the source file.
   */
  const applyExtractedToParent = async (d: any, sourceFile?: { id: string; nome: string } | null, tipoArquivo?: string) => {
    if (!d || !parentContrato || !parentTipoDocumento || !user) return;

    // 1) Validar e normalizar payload da IA (datas ISO, números finitos, strings limpas, coerência).
    const { normalized, rejected } = validateExtractedContract(d);

    // 1a) Logging estruturado de rejeições — console em dev, persistido em prod
    // via `Logger.persist` (system_logs) e replicado na trilha de auditoria do
    // contrato como `origem='ia_rejeicao'` para inspeção no painel da UI.
    if (rejected.length > 0) {
      const detalhes = rejected.map((campo) => ({
        campo,
        motivo: REJECTION_REASONS[campo] || 'Motivo desconhecido.',
        valor_recebido: campo in (d || {}) ? d[campo] : undefined,
      }));

      logger.warn('Validação rejeitou campos extraídos pela IA', undefined, {
        contrato_id: contratoId,
        parent_tipo: parentTipoDocumento,
        arquivo_id: sourceFile?.id || null,
        arquivo_nome: sourceFile?.nome || null,
        rejeicoes: detalhes,
        payload_ia: d,
      });

      const rejectionRows = detalhes.map((r) => ({
        contrato_id: contratoId,
        arquivo_id: sourceFile?.id || null,
        arquivo_nome: sourceFile?.nome || null,
        campo: r.campo,
        valor_anterior: parentContrato?.[r.campo] != null ? String(parentContrato[r.campo]) : null,
        valor_novo: JSON.stringify({
          motivo: r.motivo,
          valor_recebido: r.valor_recebido ?? null,
        }),
        origem: 'ia_rejeicao',
        user_id: user.id,
      }));
      const { error: rejErr } = await supabase
        .from('contrato_ia_auditoria')
        .insert(rejectionRows as any);
      if (rejErr) logger.warn('Falha ao gravar trilha de rejeições', rejErr);
    }

    // 2) Construir UPDATE respeitando edições manuais, a autoridade do arquivo
    //    (aditivo não fala por assinatura nem valor do contrato) e as colunas reais.
    const updates = buildParentUpdates(normalized, parentContrato, parentTipoDocumento, tipoArquivo);

    if (Object.keys(updates).length === 0) {
      const motivo = rejected.length > 0
        ? `IA retornou dados inválidos (${rejected.join(', ')}).`
        : 'IA não encontrou novos campos para preencher (registro já preenchido).';
      toast.info(motivo);
      return;
    }

    const { error } = await supabase.from('contratos').update(updates).eq('id', contratoId);
    if (error) {
      logger.warn('applyExtractedToParent: UPDATE em contratos falhou', error, {
        contrato_id: contratoId,
        updates,
      });
      toast.warning('Arquivo registrado, mas falha ao atualizar o Dashboard.', { description: error.message });
      return;
    }

    // 3) Auditoria: 1 linha por campo preenchido pela IA.
    const auditRows = Object.entries(updates).map(([campo, novo]) => ({
      contrato_id: contratoId,
      arquivo_id: sourceFile?.id || null,
      arquivo_nome: sourceFile?.nome || null,
      campo,
      valor_anterior: parentContrato?.[campo] != null ? String(parentContrato[campo]) : null,
      valor_novo: novo != null ? String(novo) : null,
      origem: 'ia_extracao',
      user_id: user.id,
    }));
    if (auditRows.length > 0) {
      const { error: auditErr } = await supabase.from('contrato_ia_auditoria').insert(auditRows as any);
      if (auditErr) logger.warn('Falha ao gravar trilha de extrações', auditErr);
    }

    const aviso = rejected.length > 0 ? ` (${rejected.length} campo(s) rejeitado(s) pela validação)` : '';
    toast.success(`Dashboard atualizado pela IA: ${Object.keys(updates).length} campo(s) preenchido(s)${aviso}.`);
    loadData();
  };

  const runIaPreFillForAditivo = async (file: File) => {
    const TID = 'leitura-do-termo';
    toast.loading('Lendo o termo aditivo… a tabela de itens vem preenchida para conferência.', { id: TID });
    try {
      const detected = await extractContractDataFromFile(file, uploadTipo, (msg) => toast.loading(msg, { id: TID }));
      toast.dismiss(TID);
      if (detected?.aditivo) {
        preencherAditivoDaLeitura(detected);
      } else if (!detected) {
        // Falha de leitura não é silenciosa: quem registra precisa saber que
        // vai digitar tudo à mão (princípio 3).
        toast.warning('Não foi possível ler o termo; preencha os campos e a tabela à mão.', {
          description: motivoDaUltimaFalha() ?? undefined,
          duration: 10000,
        });
      }
    } catch (e) {
      toast.dismiss(TID);
      console.warn('[runIaPreFillForAditivo]', e);
    }
  };

  const doUpload = async (file: File, tipo: string, aditivoData?: typeof emptyAditivoForm): Promise<{ id: string; nome: string } | null> => {
    if (!user) return null;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('contratos-docs').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: inserted, error: dbError } = await supabase.from('contrato_arquivos').insert({
        contrato_id: contratoId,
        user_id: user.id,
        nome_arquivo: file.name,
        storage_path: path,
        tipo,
        tamanho_bytes: file.size,
      } as any).select('id, nome_arquivo').single();
      if (dbError) throw dbError;

      // O documento assinado também vai para a pasta Contrato do processo, quando
      // há elo. Quem procura o contrato meses depois costuma partir da pasta do
      // certame — é lá que estão o edital e o Termo de Referência com que ele
      // precisa ser confrontado. Falha aqui não derruba o upload: o arquivo já
      // está guardado no contrato, e o espelho é conveniência.
      if (parentContrato?.licitacao_id && DOCUMENTOS_DO_CERTAME.includes(tipo)) {
        const r = await salvarNaPastaDoProcesso({
          licitacaoId: parentContrato.licitacao_id,
          categoria: 'contrato',
          nomeArquivo: file.name,
          blob: file,
          descricao: `Anexado em Gestão de Contratos · ${TIPOS_ARQUIVO[tipo]?.label || tipo}`,
          metadata: { contrato_id: contratoId, tipo },
        });
        if (!r.ok) toast.warning('Arquivo salvo no contrato, mas não foi copiado para a pasta do processo.');
      }

      // If aditivo type, also create the aditivo record
      let linhasGravadas = 0;
      if (aditivoData && isAditivoType(tipo)) {
        const payload = montarPayloadDoTermo(tipo, aditivoData, linhasDoTermo, itensDoContrato, comRessalva);
        // O elo com o PDF que originou o registro: sem ele, o cartão do
        // aditivo não tinha como dizer de que documento nasceu.
        payload.arquivo_id = inserted?.id ?? null;

        const { data: termo, error: adtError } = await supabase.from('contrato_aditivos').insert(payload).select('id').single();
        if (adtError) throw adtError;
        if (modoDoTipo(tipo) && termo?.id) {
          linhasGravadas = await gravarLinhasDoTermo(termo.id, linhasDoTermo, itensDoContrato, false);
        }
      }

      toast.success(linhasGravadas > 0
        ? `Documento registrado; ${linhasGravadas} item(ns) atualizado(s) pelo termo.`
        : 'Documento registrado com sucesso!');
      setPendingFile(null);
      setAditivoForm(emptyAditivoForm);
      limparTermo();
      loadData();
      return inserted ? { id: (inserted as any).id, nome: (inserted as any).nome_arquivo } : null;
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar documento', { description: err.message });
      return null;
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConfirmAditivo = () => {
    // A lei fala antes de gravar: linha inválida, bloqueio ou ressalva sem
    // a caixa marcada param aqui, com o motivo dito.
    const problema = problemaDoTermo(uploadTipo, aditivoForm, linhasDoTermo, itensDoContrato, comRessalva);
    if (problema) {
      toast.error('O termo não pode ser registrado assim.', { description: problema, duration: 12000 });
      return;
    }
    if (pendingFile) {
      doUpload(pendingFile, uploadTipo, aditivoForm);
    } else {
      // Manual registration without file
      if (!user) return;
      doManualAditivo();
    }
  };

  const doManualAditivo = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const payload = montarPayloadDoTermo(uploadTipo, aditivoForm, linhasDoTermo, itensDoContrato, comRessalva);
      const { data: termo, error } = await supabase.from('contrato_aditivos').insert(payload).select('id').single();
      if (error) throw error;
      let linhasGravadas = 0;
      if (modoDoTipo(uploadTipo) && termo?.id) {
        linhasGravadas = await gravarLinhasDoTermo(termo.id, linhasDoTermo, itensDoContrato, false);
      }

      toast.success(linhasGravadas > 0
        ? `Aditivo registrado; ${linhasGravadas} item(ns) atualizado(s) pelo termo.`
        : 'Aditivo registrado com sucesso!');
      setAditivoForm(emptyAditivoForm);
      setPendingFile(null);
      limparTermo();
      loadData();
    } catch (err: any) {
      toast.error('Erro ao registrar aditivo', { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  /**
   * Ver o documento sem baixá-lo.
   *
   * Conferir um aditivo obrigava a baixar o PDF, abrir fora do sistema e voltar
   * — para uma checagem de trinta segundos. O link é assinado e expira em dez
   *  minutos: o arquivo continua privado, e o endereço não sobrevive ao dia.
   */
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  /** O termo cuja justificativa está aberta para leitura integral. */
  const [justificativaAberta, setJustificativaAberta] = useState<any | null>(null);

  const handleVisualizar = async (arquivo: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('contratos-docs')
        .createSignedUrl(arquivo.storage_path, 600);
      if (error || !data?.signedUrl) throw error ?? new Error('link não gerado');
      setVisualizando({ url: data.signedUrl, nome: arquivo.nome_arquivo });
    } catch (err: any) {
      toast.error('Não foi possível abrir o documento', { description: err?.message });
    }
  };

  const handleDownload = async (arquivo: any) => {
    try {
      const { data, error } = await supabase.storage.from('contratos-docs').download(arquivo.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Erro ao baixar arquivo', { description: err.message });
    }
  };

  /**
   * Relê um documento e preenche o que estiver em branco no contrato.
   *
   * `buildParentUpdates` só grava campo VAZIO — nunca sobrescreve o que
   * alguém corrigiu à mão. É o que torna a releitura segura de repetir: ela
   * preenche lacuna, não revisa decisão.
   */
  const relerDocumento = async (
    file: File,
    arquivo: any,
    aoProgredir?: (msg: string) => void,
  ): Promise<void> => {
    // Empenho, ordem de fornecimento, publicação e "outro" não falam pelo
    // contrato: em 17/09 a releitura de uma nota de empenho pôs no 17/2025
    // "481 dias" de prazo (quantidade de item) e "assinado só pelo órgão" —
    // e o painel mandou não iniciar a execução de um contrato assinado pelos
    // dois. A recusa vem ANTES do OCR: não se gasta leitura para descartar tudo.
    if (autoridadeDoArquivo(arquivo?.tipo, parentTipoDocumento ?? 'contrato') === 'nenhuma') {
      toast.info('Este documento não alimenta os dados do contrato.', {
        description: 'Só o instrumento (contrato ou ata) e seus aditivos preenchem prazos, local, pagamento e assinaturas. Empenho, ordem de fornecimento e publicação ficam guardados como prova.',
      });
      return;
    }
    // O leitor completo do importador, e não uma cópia local dele: OCR página
    // a página, reversão automática no 429 (que é o erro NORMAL logo depois do
    // OCR de um documento grande) e o motivo REAL da falha em vez de um null
    // mudo. A cópia que estava aqui não tinha nada disso.
    const dados = await extractContractDataFromFile(file, arquivo.tipo, aoProgredir);
    if (!dados) {
      toast.warning('Não foi possível ler o documento.', { description: motivoDaUltimaFalha() ?? undefined });
      return;
    }

    // A régua do upload: validar, depois montar o UPDATE respeitando o que foi
    // editado à mão. Havia aqui uma SEGUNDA cópia dessa regra, com dois
    // defeitos — escrevia `orgao` (a coluna é `orgao_contratante`, então o
    // UPDATE INTEIRO falhava em silêncio) e não conhecia prazo nem local de
    // entrega. Duas cópias da mesma regra divergem sempre.
    const { normalized, rejected } = validateExtractedContract(dados);
    const updates = buildParentUpdates(
      normalized,
      parentContrato ?? {},
      parentTipoDocumento ?? 'contrato',
      arquivo?.tipo,
    );

    if (Object.keys(updates).length === 0) {
      toast.info(
        rejected.length > 0
          ? `A IA leu, mas devolveu dados inválidos (${rejected.join(', ')}).`
          : 'Nada a preencher — os campos que este documento alimenta já estão preenchidos.',
      );
      return;
    }

    const { error: cErr } = await supabase.from('contratos').update(updates).eq('id', contratoId);
    if (cErr) {
      // Falha de gravação não pode virar sucesso na tela: era exatamente isso
      // que escondia o defeito da coluna inexistente.
      toast.error('A IA leu o documento, mas a gravação falhou.', { description: cErr.message });
      return;
    }

    toast.success(`Documento relido: ${Object.keys(updates).length} campo(s) preenchido(s).`, {
      description: Object.keys(updates).join(', '),
    });
  };

  /**
   * Relê o PDF que JÁ está guardado.
   *
   * Faltava este caminho, e a falta tinha um preço absurdo: para o Dashboard
   * receber o que a leitura passou a extrair — prazo de entrega, local, prazo
   * de pagamento —, era preciso APAGAR o contrato de Arquivos e Aditivos e
   * anexá-lo de novo. Destruir o registro do dossiê para reprocessar um
   * arquivo que nunca saiu do lugar.
   *
   * O documento está no storage. Basta baixá-lo e lê-lo outra vez.
   */
  const handleReler = async (arquivo: any) => {
    // O módulo é o dono, não o componente: trocar de aba desmonta esta tela e
    // levaria junto o spinner, o progresso e a recarga do fim — a leitura
    // seguiria rodando sem nada que a anunciasse, e quem voltasse dispararia
    // outra por cima.
    if (!comecarReleitura(arquivo.id, arquivo.nome_arquivo)) {
      toast.info('Este documento já está sendo lido.');
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('contratos-docs')
        .download(arquivo.storage_path);
      if (error || !data) throw error ?? new Error('arquivo não encontrado no storage');
      // `File` sem qualificar resolveria para o ícone do lucide, importado
      // neste arquivo — e o erro sairia como "só função void aceita new".
      const comoArquivo = new globalThis.File([data], arquivo.nome_arquivo, { type: 'application/pdf' });
      await relerDocumento(comoArquivo, arquivo, (msg) => progredirReleitura(arquivo.id, msg));
      loadData();
    } catch (err: any) {
      toast.error('Não foi possível reler o documento', { description: err?.message });
    } finally {
      terminarReleitura(arquivo.id);
    }
  };

  const handleReplaceFile = (arquivo: any) => {
    replaceTargetRef.current = arquivo;
    replaceFileRef.current?.click();
  };

  const onReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const arquivo = replaceTargetRef.current;
    if (e.target) e.target.value = '';
    if (!file || !arquivo || !user) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      return;
    }

    setReplacingId(arquivo.id);
    try {
      // 1) Save current version into history
      await supabase.from('contrato_arquivos_versoes').insert({
        arquivo_id: arquivo.id,
        contrato_id: contratoId,
        user_id: user.id,
        nome_arquivo: arquivo.nome_arquivo,
        storage_path: arquivo.storage_path,
        tamanho_bytes: arquivo.tamanho_bytes,
        tipo: arquivo.tipo,
        descricao: arquivo.descricao || null,
      } as any);

      // 2) Upload new file to storage
      const ext = file.name.split('.').pop() || 'pdf';
      const newPath = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('contratos-docs').upload(newPath, file);
      if (upErr) throw upErr;

      // 3) Update arquivo row to point to new file
      const { error: updErr } = await supabase.from('contrato_arquivos').update({
        storage_path: newPath,
        nome_arquivo: file.name,
        tamanho_bytes: file.size,
      } as any).eq('id', arquivo.id);
      if (updErr) throw updErr;

      toast.success('Arquivo substituído. Relendo o documento…');

      try {
        await relerDocumento(file, arquivo);
      } catch (extErr: any) {
        console.warn('Reextração falhou:', extErr);
        toast.warning('Arquivo substituído, mas a releitura falhou.', { description: extErr?.message });
      }

      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao substituir arquivo', { description: err.message });
    } finally {
      setReplacingId(null);
      replaceTargetRef.current = null;
    }
  };

  const handleDelete = async (arquivo: any) => {
    // O ADITIVO é outro registro: `contrato_aditivos.arquivo_id` aponta para o
    // arquivo com ON DELETE SET NULL, então apagar o PDF deixa o aditivo vivo e
    // órfão — com o valor ainda somado ao contrato e ainda gerando alerta legal.
    // Quem apagou o arquivo acredita ter apagado o aditivo, e o sistema segue
    // acusando o que a pessoa jura ter removido.
    const vinculados = aditivos.filter((a: any) => a.arquivo_id === arquivo.id);

    if (vinculados.length > 0) {
      const lista = vinculados.map((a: any) => `• ${a.numero_aditivo || 'sem número'} (${TIPOS_ADITIVO_LABEL[a.tipo] || a.tipo})`).join('\n');
      const juntos = confirm(
        `Este arquivo tem ${vinculados.length} aditivo(s) registrado(s):\n\n${lista}\n\n` +
        'OK — excluir o arquivo E o(s) aditivo(s): os valores voltam ao contrato e os alertas legais são recalculados.\n' +
        'Cancelar — não excluir nada.',
      );
      if (!juntos) return;
      const { error: aditErr } = await supabase
        .from('contrato_aditivos')
        .delete()
        .in('id', vinculados.map((a: any) => a.id));
      if (aditErr) { toast.error('Erro ao excluir o aditivo', { description: aditErr.message }); return; }
    } else if (!confirm('Excluir este arquivo permanentemente?')) {
      return;
    }

    try {
      await supabase.storage.from('contratos-docs').remove([arquivo.storage_path]);
      await supabase.from('contrato_arquivos').delete().eq('id', arquivo.id);
      toast.success(vinculados.length > 0 ? 'Arquivo e aditivo(s) excluídos' : 'Arquivo excluído');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao excluir', { description: err.message });
    }
  };

  const handleDeleteAditivo = async (id: string) => {
    if (!confirm('Excluir este aditivo?')) return;
    await supabase.from('contrato_aditivos').delete().eq('id', id);
    toast.success('Aditivo excluído');
    loadData();
  };

  const openEdit = (arquivo: any) => {
    setEditDialog({ open: true, arquivo });
    setEditTipo(arquivo.tipo);
    setEditDescricao(arquivo.descricao || '');
    setEditFile(null);

    // If file is aditivo type, find linked aditivo and populate fields
    setEditItens([]);
    setEditLinhas({});
    setEditLinhasSemItem([]);
    setEditComRessalva(false);
    if (isAditivoType(arquivo.tipo)) {
      // O elo certo é o arquivo_id gravado no termo; o tipo é só o
      // desempate para registros antigos, que nasceram sem o elo.
      const tipoAditivo = TIPOS_ARQUIVO[arquivo.tipo]?.tipoAditivo || 'valor';
      const linked = aditivos.find((a: any) => a.arquivo_id === arquivo.id)
        ?? aditivos.find((a: any) => a.tipo === tipoAditivo);
      if (linked) {
        setEditLinkedAditivoId(linked.id);
        setEditComRessalva(!!linked.com_ressalva);
        setEditAditivoForm({
          numero_aditivo: linked.numero_aditivo || '',
          valor_acrescimo: linked.valor_acrescimo?.toString() || '',
          valor_supressao: linked.valor_supressao?.toString() || '',
          quantidade_acrescimo: linked.quantidade_acrescimo?.toString() || '',
          quantidade_supressao: linked.quantidade_supressao?.toString() || '',
          nova_data_fim: linked.nova_data_fim || '',
          data_assinatura: linked.data_assinatura || linked.data_aditivo || '',
          data_efeitos: linked.data_efeitos || '',
          periodo_inicio: linked.periodo_inicio || '',
          periodo_fim: linked.periodo_fim || '',
          justificativa: linked.justificativa || '',
          observacoes: linked.observacoes || '',
        });
        if (modoDoTipo(arquivo.tipo)) void carregarLinhasParaEdicao(linked.id);
      } else {
        setEditLinkedAditivoId(null);
        setEditAditivoForm({ ...emptyAditivoForm, numero_aditivo: `${aditivos.length + 1}º Aditivo` });
        if (modoDoTipo(arquivo.tipo)) void carregarItensDoContrato().then(setEditItens);
      }
    } else {
      setEditLinkedAditivoId(null);
      setEditAditivoForm(emptyAditivoForm);
    }
  };

  /**
   * As linhas de um termo já gravado, para edição. A tabela mostra o preço
   * de ANTES do termo como vigente (senão a linha aplicada pareceria "sem
   * mudança" e sumiria ao salvar), e o saldo sem o acréscimo dele.
   */
  const carregarLinhasParaEdicao = async (aditivoId: string) => {
    const itens = await carregarItensDoContrato();
    const { data } = await supabase
      .from('contrato_aditivo_itens' as never)
      .select('contrato_item_id, valor_unitario_anterior, valor_unitario_novo, quantidade_acrescimo, quantidade_supressao, origem, valor_lido, quantidade_lida, numero_item_lido, descricao_lida, aplicado_em')
      .eq('aditivo_id', aditivoId);
    const gravadas = ((data ?? []) as unknown as LinhaGravada[]);
    const porItem = new Map(gravadas.map((g) => [g.contrato_item_id, g]));
    const itensDeAntes = itens.map((it) => {
      const g = porItem.get(it.id);
      if (!g || !g.aplicado_em) return it;
      return {
        ...it,
        valor_unitario: g.valor_unitario_novo !== null && g.valor_unitario_anterior !== null ? Number(g.valor_unitario_anterior) : it.valor_unitario,
        saldo_quantitativo: it.saldo_quantitativo - (Number(g.quantidade_acrescimo) || 0) + (Number(g.quantidade_supressao) || 0),
      };
    });
    const linhas: Record<string, LinhaDoTermo> = {};
    for (const it of itensDeAntes) {
      const g = porItem.get(it.id);
      if (!g) continue;
      linhas[it.id] = {
        ...linhaSemMudanca(it),
        valor_novo: g.valor_unitario_novo !== null ? Number(g.valor_unitario_novo) : it.valor_unitario,
        quantidade_acrescimo: Number(g.quantidade_acrescimo) || 0,
        quantidade_supressao: Number(g.quantidade_supressao) || 0,
        origem: g.origem,
        valor_lido: g.valor_lido,
        quantidade_lida: g.quantidade_lida,
        numero_item_lido: g.numero_item_lido,
        descricao_lida: g.descricao_lida,
      };
    }
    setEditItens(itensDeAntes);
    setEditLinhas(linhas);
  };

  const handleSaveEdit = async () => {
    if (!editDialog.arquivo || !user) return;
    setSaving(true);
    try {
      let newPath = editDialog.arquivo.storage_path;
      let newName = editDialog.arquivo.nome_arquivo;
      let newSize = editDialog.arquivo.tamanho_bytes;

      if (editFile) {
        await supabase.storage.from('contratos-docs').remove([editDialog.arquivo.storage_path]);
        const ext = editFile.name.split('.').pop() || 'pdf';
        newPath = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('contratos-docs').upload(newPath, editFile);
        if (upErr) throw upErr;
        newName = editFile.name;
        newSize = editFile.size;
      }

      const { error } = await supabase.from('contrato_arquivos').update({
        tipo: editTipo,
        descricao: editDescricao || null,
        storage_path: newPath,
        nome_arquivo: newName,
        tamanho_bytes: newSize,
      } as any).eq('id', editDialog.arquivo.id);

      if (error) throw error;

      // Sync aditivo record if type is aditivo
      if (isAditivoType(editTipo)) {
        const problema = problemaDoTermo(editTipo, editAditivoForm, editLinhas, editItens, editComRessalva);
        if (problema) throw new Error(problema);
        const payload = montarPayloadDoTermo(editTipo, editAditivoForm, editLinhas, editItens, editComRessalva);
        payload.arquivo_id = editDialog.arquivo.id;

        let aditivoId = editLinkedAditivoId;
        if (editLinkedAditivoId) {
          const { error: erroUpd } = await supabase.from('contrato_aditivos').update(payload).eq('id', editLinkedAditivoId);
          if (erroUpd) throw erroUpd;
        } else {
          const { data: termo, error: erroIns } = await supabase.from('contrato_aditivos').insert(payload).select('id').single();
          if (erroIns) throw erroIns;
          aditivoId = termo?.id ?? null;
        }
        if (modoDoTipo(editTipo) && aditivoId) {
          await gravarLinhasDoTermo(aditivoId, editLinhas, editItens, !!editLinkedAditivoId);
        }
      }

      toast.success('Documento atualizado!');
      setEditDialog({ open: false, arquivo: null });
      loadData();
    } catch (err: any) {
      toast.error('Erro ao atualizar', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Aditivos summaries
  const totalAcrescimo = aditivos.reduce((s: number, a: any) => s + (a.valor_acrescimo || 0), 0);
  const totalSupressao = aditivos.reduce((s: number, a: any) => s + (a.valor_supressao || 0), 0);
  const saldoAditivos = totalAcrescimo - totalSupressao;
  const totalQtyAcrescimo = aditivos.reduce((s: number, a: any) => s + (a.quantidade_acrescimo || 0), 0);
  const totalQtySupressao = aditivos.reduce((s: number, a: any) => s + (a.quantidade_supressao || 0), 0);
  const saldoQty = totalQtyAcrescimo - totalQtySupressao;

  const ADITIVO_ICON: Record<string, typeof DollarSign> = {
    valor: DollarSign,
    quantidade: Package,
    valor_quantidade: Layers,
    prazo: Calendar,
    prazo_valor: Calendar,
    prazo_quantidade: Calendar,
    escopo: FilePlus2,
  };

  // Com linhas na tabela do termo, os totais vêm delas (campos travados) e a
  // lei é lida sobre o que está no formulário, a cada render.
  const linhasMandamUpload = resumoDoTermo(linhasDoTermo, itensDoContrato).itensAlterados > 0;
  const avisosUpload = avisosDoTermo(uploadTipo, aditivoForm, linhasDoTermo, itensDoContrato);
  const linhasMandamEdit = resumoDoTermo(editLinhas, editItens).itensAlterados > 0;
  const avisosEdit = avisosDoTermo(editTipo, editAditivoForm, editLinhas, editItens);

  /** Assinatura, efeitos, período da renovação e o fundamento — iguais no envio e na edição. */
  const camposDeVigencia = (
    tipo: string,
    form: typeof emptyAditivoForm,
    setForm: (atualiza: (f: typeof emptyAditivoForm) => typeof emptyAditivoForm) => void,
  ) => (
    <>
      <div className="space-y-1.5">
        <Label>Data Assinatura</Label>
        <Input type="date" value={form.data_assinatura}
          onChange={(e) => setForm((f) => ({ ...f, data_assinatura: e.target.value, data_efeitos: f.data_efeitos || e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>Efeitos a partir de</Label>
        <Input type="date" value={form.data_efeitos} onChange={(e) => setForm((f) => ({ ...f, data_efeitos: e.target.value }))} />
        <p className="g-meta text-muted-foreground">Dia em que os novos preços ou quantidades passam a valer. Antecipação além de um mês exige formalização (art. 132).</p>
      </div>
      {tipo === 'prorrogacao_continuo' && (
        <>
          <div className="space-y-1.5">
            <Label>Início do novo período</Label>
            <Input type="date" value={form.periodo_inicio} onChange={(e) => setForm((f) => ({ ...f, periodo_inicio: e.target.value, data_efeitos: f.data_efeitos || e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Fim do novo período</Label>
            <Input type="date" value={form.periodo_fim} onChange={(e) => setForm((f) => ({ ...f, periodo_fim: e.target.value, nova_data_fim: e.target.value }))} />
            <p className="g-meta text-muted-foreground">A renovação repõe as quantidades pelo período: informe-as na tabela de itens (art. 107).</p>
          </div>
        </>
      )}
      {fundamentoDoTipo(tipo) && (
        <p className="g-meta text-muted-foreground sm:col-span-2" data-testid="fundamento-legal">
          <span className="font-medium text-foreground">Fundamento:</span> {fundamentoDoTipo(tipo)}
        </p>
      )}
    </>
  );

  /** Os avisos jurídicos e a caixa de ressalva, iguais no envio e na edição. */
  const blocoDeAvisos = (avisos: Aviso[], ressalva: boolean, setRessalva: (v: boolean) => void) => avisos.length === 0 ? null : (
    <div className="space-y-2" data-testid="avisos-do-termo">
      <ul className="space-y-1">
        {avisos.map((a, i) => (
          <li key={i} className={`rounded-md border px-3 py-2 text-sm ${
            a.nivel === 'bloqueia' ? 'border-destructive-line bg-destructive-tint text-destructive-ink'
            : a.nivel === 'ressalva' ? 'border-warning-line bg-warning-tint text-warning-ink'
            : 'border-border bg-muted text-muted-foreground'}`}>
            {a.texto}
          </li>
        ))}
      </ul>
      {avisoExigeRessalva(avisos) && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox checked={ressalva} onCheckedChange={(v) => setRessalva(v === true)} className="mt-0.5" />
          <span>Registrado com ressalva: o termo entra assim mesmo, e o aviso fica gravado no registro.</span>
        </label>
      )}
    </div>
  );

  // ── Detection Dialog handlers ──────────────────────────────────────────
  const handleDetectionIgnore = () => {
    setDetectionOpen(false);
    if (pendingFile) {
      doUpload(pendingFile, uploadTipo);
      setPendingFile(null);
    }
    setDetection(null);
  };

  const handleCreateLinkedRegistry = async (data: DetectionResult) => {
    if (!user || !pendingFile || !parentContrato) return;
    try {
      const detectedType = data.tipo_documento_detectado;
      const newTipoDoc: 'ata_srp' | 'contrato' = detectedType === 'ata_srp' ? 'ata_srp' : 'contrato';
      const isDerivado = newTipoDoc === 'contrato' && parentTipoDocumento === 'ata_srp';

      // ── O teto da ata é lei, não configuração ─────────────────────────────
      // A ARP registra a quantidade MÁXIMA; os contratos derivados a fracionam
      // até o esgotamento — a soma deles não pode passar do registrado. Este
      // guarda também é a defesa contra OCR ruim: foi um contrato "derivado" de
      // R$ 180 milhões, lido de um scan, que consumiu 2.126% de uma ata de
      // R$ 8,4 milhões. O valor extraído pode mentir; o saldo da ata, não.
      if (isDerivado) {
        const { data: ata } = await supabase
          .from('contratos')
          .select('valor_global, valor_consumido, data_fim')
          .eq('id', parentContrato.id)
          .maybeSingle();
        const saldoAta = (ata?.valor_global ?? 0) - (ata?.valor_consumido ?? 0);
        const valorNovo = data.valor_global || 0;
        if (valorNovo > saldoAta) {
          toast.error('Contrato derivado excede o saldo da ATA', {
            description:
              `O documento traz ${valorNovo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, ` +
              `mas o saldo registrado da ata é ${saldoAta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. ` +
              'A soma dos contratos não pode passar do total registrado. Se o valor veio de leitura ' +
              'errada do PDF (scan), confira o documento e cadastre o contrato manualmente.',
            duration: 12000,
          });
          return;
        }
      }

      // Estrutura: usa o que a IA detectou (fallback para 'itens')
      const estruturaIA = (data as any).tipo_estrutura_detectado as 'itens' | 'lotes' | undefined;
      const estruturaConfianca = (data as any).tipo_estrutura_confianca as number | undefined;

      const newRow: any = {
        user_id: user.id,
        empresa_id: parentContrato.empresa_id,
        tipo_documento: newTipoDoc,
        tipo_estrutura: estruturaIA || 'itens',
        tipo_estrutura_detectado_ia: estruturaIA || null,
        tipo_estrutura_confianca: estruturaConfianca ?? null,
        numero_contrato: data.numero_contrato || data.numero_ata || pendingFile.name,
        objeto: data.objeto || parentContrato.objeto || null,
        orgao_contratante: parentContrato.orgao_contratante || null,
        valor_global_original: data.valor_global || 0,
        valor_global: data.valor_global || 0,
        data_assinatura: (data as any).data_assinatura || null,
        data_inicio: data.data_inicio || null,
        data_fim: data.data_fim || null,
        modalidade: (data as any).modalidade || parentContrato.modalidade || null,
        status: 'vigente',
      };
      if (isDerivado) newRow.ata_srp_id = parentContrato.id;

      const { data: created, error: insErr } = await supabase
        .from('contratos').insert(newRow).select('id').single();
      if (insErr) throw insErr;

      const ext = pendingFile.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${created.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('contratos-docs').upload(path, pendingFile);
      if (upErr) throw upErr;
      await supabase.from('contrato_arquivos').insert({
        contrato_id: created.id,
        user_id: user.id,
        nome_arquivo: pendingFile.name,
        storage_path: path,
        tipo: newTipoDoc === 'ata_srp' ? 'ata_srp' : 'contrato_original',
        tamanho_bytes: pendingFile.size,
      } as any);

      // ── Itens extraídos: vincula automaticamente aos itens da ATA quando derivado ──
      const itensExtraidos: any[] = Array.isArray((data as any).itens) ? (data as any).itens : [];
      let vinculados = 0;
      let semMatch = 0;

      if (itensExtraidos.length > 0) {
        let matches: any[] = [];
        if (isDerivado) {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('match_itens_ata' as any, {
            p_ata_id: parentContrato.id,
            p_itens: itensExtraidos as any,
          });
          if (rpcErr) {
            logger.warn('match_itens_ata falhou — itens criados sem vínculo', rpcErr);
          } else {
            matches = (rpcData as any[]) || [];
          }
        }

        // A unidade do derivado é a DA ATA: mesmo preço e condições incluem o
        // "kg". A extração vinha com "null" textual e o item nascia sem unidade.
        const unidadesDaAta = new Map<string, string>();
        {
          const ids = matches.map((m: any) => m?.ata_item_id).filter(Boolean);
          if (ids.length > 0) {
            const { data: uns } = await supabase
              .from('contrato_itens').select('id, unidade').in('id', ids);
            (uns || []).forEach((u: any) => { if (u.unidade) unidadesDaAta.set(u.id, u.unidade); });
          }
        }

        let inferidas = 0;
        const itensInsert = itensExtraidos.map((it: any, idx: number) => {
          const m = matches[idx];
          let qtd = Number(it.quantidade) || 0;
          let vu = Number(it.valor_unitario) || (m?.ata_valor_unitario ?? 0);
          let vt = Number(it.valor_total) || qtd * vu;
          let obsInferencia: string | null = null;
          // Scan que não rendeu a quantidade deixava o item em ZERO: o dinheiro
          // dizia 25% da ata e os quilos diziam nada — as duas cascatas
          // divergiam. Quando o contrato tem UM item casado e o valor global,
          // a quantidade é DERIVÁVEL: global ÷ preço registrado. Inferência
          // dita em voz alta (observação + auditoria), nunca calada.
          if (isDerivado && m?.ata_item_id && itensExtraidos.length === 1 && qtd === 0) {
            const global = Number((data as any).valor_global) || 0;
            const precoAta = Number(m?.ata_valor_unitario) || 0;
            if (global > 0 && precoAta > 0) {
              qtd = Math.round((global / precoAta) * 1000) / 1000;
              vu = precoAta;
              vt = global;
              inferidas++;
              obsInferencia = `Quantidade inferida (${qtd.toLocaleString('pt-BR')}) = valor global ÷ preço registrado da ata. Confira com o contrato.`;
            }
          }
          if (m?.ata_item_id) vinculados++; else if (isDerivado) semMatch++;
          return {
            contrato_id: created.id,
            user_id: user.id,
            descricao: it.descricao || 'Item',
            unidade: (m?.ata_item_id && unidadesDaAta.get(m.ata_item_id))
              || (it.unidade && !/^null$/i.test(String(it.unidade)) ? it.unidade : 'UN'),
            quantidade_contratada: qtd,
            valor_unitario: vu,
            valor_total: vt,
            saldo_quantitativo: qtd,
            saldo_financeiro: vt,
            codigo_item: it.codigo_item || null,
            observacoes: obsInferencia,
            numero_lote: estruturaIA === 'lotes' ? (it.numero_lote || null) : null,
            descricao_lote: estruturaIA === 'lotes' ? (it.descricao_lote || null) : null,
            estrutura: estruturaIA || null,
            ata_item_id: isDerivado ? (m?.ata_item_id || null) : null,
          };
        });

        const { error: itErr } = await supabase.from('contrato_itens').insert(itensInsert as any);
        if (itErr) {
          logger.warn('Falha ao inserir itens do contrato derivado', itErr);
          toast.warning('Contrato criado, mas houve erro ao importar itens.', { description: itErr.message });
        }

        // Auditoria: registra a auto-vinculação
        if (isDerivado) {
          await supabase.from('contrato_ia_auditoria').insert([{
            contrato_id: created.id,
            arquivo_id: null,
            arquivo_nome: pendingFile.name,
            campo: 'auto_vinculacao_ata',
            valor_anterior: null,
            valor_novo: JSON.stringify({
              ata_origem: parentContrato.id,
              total_itens: itensInsert.length,
              vinculados,
              sem_match: semMatch,
              quantidades_inferidas: inferidas,
              estrutura: estruturaIA,
            }),
            origem: 'ia_extracao',
            user_id: user.id,
          }] as any);
        }
      }

      const msgEstrutura = estruturaIA ? ` Estrutura detectada: ${estruturaIA}.` : '';
      const msgVinc = isDerivado
        ? ` ${vinculados}/${itensExtraidos.length} itens vinculados à ATA${semMatch > 0 ? ` (${semMatch} sem correspondência)` : ''}.`
        : '';
      toast.success(
        `${newTipoDoc === 'ata_srp' ? 'ATA SRP' : 'Contrato derivado'} criado.${msgEstrutura}${msgVinc}`,
      );
      setDetectionOpen(false);
      setPendingFile(null);
      setDetection(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao criar registro vinculado', { description: err.message });
    }
  };

  const handleConfirmAditivoFromDetection = async (form: {
    numero_aditivo: string;
    valor_acrescimo: number;
    valor_supressao: number;
    quantidade_acrescimo: number;
    quantidade_supressao: number;
    nova_data_fim: string | null;
    justificativa: string | null;
    target: 'contrato' | 'ata_srp';
  }) => {
    if (!user || !pendingFile) return;
    // Termo que muda preço ou repõe quantidades (reequilíbrio, reajuste,
    // repactuação, renovação), ou que trouxe linhas de item, não cabe no
    // registro resumido: vai para o formulário com a tabela item a item.
    const a = detection?.aditivo as { tipo_aditivo?: string | null; itens_alterados?: unknown[] | null } | undefined;
    const tipoLido = a?.tipo_aditivo ? mapDetectedToFileTipo('aditivo', a.tipo_aditivo) : null;
    if (tipoLido && tipoLido !== 'outro' && (modoDoTipo(tipoLido) || (a?.itens_alterados?.length ?? 0) > 0) && tiposDisponiveis[tipoLido]) {
      setDetectionOpen(false);
      setUploadTipo(tipoLido);
      setShowAditivoFields(true);
      setAditivoForm((f) => ({ ...f, numero_aditivo: form.numero_aditivo || f.numero_aditivo, nova_data_fim: form.nova_data_fim || f.nova_data_fim, justificativa: form.justificativa || f.justificativa }));
      preencherAditivoDaLeitura(detection);
      toast.info('Confira a tabela de itens do termo e confirme o registro.', { duration: 8000 });
      return;
    }
    try {
      const ext = pendingFile.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('contratos-docs').upload(path, pendingFile);
      if (upErr) throw upErr;

      let tipoArq = 'aditivo_valor';
      if ((form.valor_acrescimo + form.valor_supressao) > 0 && (form.quantidade_acrescimo + form.quantidade_supressao) > 0) tipoArq = 'aditivo_valor_quantidade';
      else if ((form.quantidade_acrescimo + form.quantidade_supressao) > 0) tipoArq = 'aditivo_quantidade';
      else if (form.nova_data_fim) tipoArq = 'aditivo_prazo';

      await supabase.from('contrato_arquivos').insert({
        contrato_id: contratoId,
        user_id: user.id,
        nome_arquivo: pendingFile.name,
        storage_path: path,
        tipo: tipoArq,
        tamanho_bytes: pendingFile.size,
      } as any);

      const tipoAditivo = TIPOS_ARQUIVO[tipoArq]?.tipoAditivo || 'valor';
      const payload: any = {
        contrato_id: contratoId,
        user_id: user.id,
        numero_aditivo: form.numero_aditivo || `${aditivos.length + 1}º Aditivo`,
        tipo: tipoAditivo,
        valor_acrescimo: form.valor_acrescimo,
        valor_supressao: form.valor_supressao,
        quantidade_acrescimo: form.quantidade_acrescimo,
        quantidade_supressao: form.quantidade_supressao,
        nova_data_fim: form.nova_data_fim,
        justificativa: form.justificativa,
        referencia_tipo: form.target,
      };
      payload.valor_aditivo = payload.valor_acrescimo - payload.valor_supressao;
      const { error: adtErr } = await supabase.from('contrato_aditivos').insert(payload);
      if (adtErr) throw adtErr;

      toast.success('Aditivo registrado e saldos atualizados!');
      setDetectionOpen(false);
      setPendingFile(null);
      setDetection(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar aditivo', { description: err.message });
    }
  };


  /** Abre um documento do contrato pelo id — é o que a Auditoria pede emprestado. */
  const verDocumentoPorId = (arquivoId: string) => {
    const arq = arquivos.find((f: any) => f.id === arquivoId);
    if (!arq) {
      toast.error('O documento não está mais anexado a este contrato.');
      return;
    }
    handleVisualizar(arq);
  };

  // ── Busca local dos documentos ───────────────────────────────────────────
  // Filtra o que já está carregado. Contrato com dois anos de vida acumula
  // dezenas de anexos, e achar "3º termo" rolando cartões empilhados era a
  // razão de a aba nunca caber numa tela.
  const termoArquivo = buscaArquivo.trim().toLowerCase();
  const arquivosVisiveis = termoArquivo
    ? arquivos.filter((a: any) =>
        (a.nome_arquivo ?? '').toLowerCase().includes(termoArquivo)
        || (a.descricao ?? '').toLowerCase().includes(termoArquivo)
        || (TIPOS_ARQUIVO[a.tipo]?.label ?? a.tipo ?? '').toLowerCase().includes(termoArquivo))
    : arquivos;

  const aditivoAberto = aditivos.find((a: any) => a.id === aditivoSelecionado) ?? null;

  /**
   * A área de registro — seletor de tipo, envio do arquivo e, quando o tipo é
   * de aditivo, o formulário do termo.
   *
   * Desenhada uma vez e usada nas subabas Arquivos e Aditivos, porque ela é
   * literalmente as duas coisas ("Registro de Documento / Aditivo"): quem está
   * na aba de aditivos precisa poder registrar um sem voltar. Só uma das
   * subabas fica montada por vez, e o estado do formulário mora aqui no
   * componente — trocar de subaba no meio do preenchimento não perde nada.
   */
  const areaDeRegistro = (
    <Card className="space-y-4 p-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label className="block">Registro de Documento / Aditivo</Label>
          <Select value={uploadTipo} onValueChange={(v) => { setUploadTipo(v); setPendingFile(null); setAditivoForm(emptyAditivoForm); }}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(tiposDisponiveis).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* A consequência, depois da escolha — que é quando se quer saber o
              que vai acontecer. No rótulo ela produzia linhas longas demais
              para o menu, e ninguém lê um menu até o fim. */}
          {efeitoNoLimite(TIPOS_ARQUIVO[uploadTipo]?.tipoAditivo) && (
            <p className="g-meta text-muted-foreground mt-1 max-w-[26rem]">
              {efeitoNoLimite(TIPOS_ARQUIVO[uploadTipo]?.tipoAditivo)}
            </p>
          )}
          {TIPOS_ARQUIVO[uploadTipo]?.semLimite && (
            <p className="g-meta text-warning-ink mt-1 flex items-center gap-1">
              <RefreshCw aria-hidden="true" className="h-3 w-3 shrink-0" />
              Não sujeito ao limite de 25% do art. 125, Lei 14.133/21.
            </p>
          )}
          {/* Cada instituto da ATA carrega a própria regra — o seletor diz qual. */}
          {uploadTipo === 'ata_aditivo_adesao' && (
            <p className="g-meta text-foreground mt-1">
              Somadas, as adesões não podem exceder o dobro do quantitativo registrado
              (Decreto 11.462/2023, art. 32, §4º) — o sistema confere ao gravar.
            </p>
          )}
          {uploadTipo === 'ata_aditivo_prazo' && (
            <p className="g-meta text-muted-foreground mt-1">
              A ARP vale 1 ano, prorrogável por igual período — 24 meses no total (art. 84).
            </p>
          )}
          {uploadTipo === 'contrato_derivado' && (
            <p className="g-meta text-muted-foreground mt-1">
              O arquivo fica guardado aqui; para saldo, itens e pedidos, registre o contrato
              na aba <strong>Contratos derivados</strong>, vinculado a esta ATA.
            </p>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            size="sm"
            className="g-controle"
          >
            {uploading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
            Enviar Arquivo
          </Button>
        </div>
      </div>

      {/* Aditivo detail fields - shown when aditivo type selected */}
      {showAditivoFields && (
        <div className="space-y-4 rounded-lg border border-border bg-secondary p-4">
          <p className="text-sm font-semibold text-foreground">Dados do Aditivo {pendingFile && <Badge variant="muted" className="ml-2">Arquivo: {pendingFile.name}</Badge>}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nº/Identificação</Label>
              <Input value={aditivoForm.numero_aditivo} onChange={(e) => setAditivoForm(f => ({ ...f, numero_aditivo: e.target.value }))} placeholder="1º Aditivo" />
            </div>
            {camposDeVigencia(uploadTipo, aditivoForm, setAditivoForm)}

            {/* A "Calculadora de Reequilíbrio" (um par custo atual × novo para
                o contrato inteiro) saiu em 26/09: doze itens reequilibrados
                não cabem num par. A tabela de itens abaixo faz a conta
                exata, e os totais vêm dela. */}
            {showValueFields(uploadTipo) && (
              <>
                <div className="space-y-1.5">
                  <Label>Valor Acréscimo (R$){linhasMandamUpload && <span className="g-meta text-muted-foreground"> · soma das linhas</span>}</Label>
                  <MoneyInput value={parseFloat(aditivoForm.valor_acrescimo) || 0} onValueChange={v => setAditivoForm(f => ({ ...f, valor_acrescimo: String(v) }))} placeholder="R$ 0,00" disabled={linhasMandamUpload} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor Supressão (R$)</Label>
                  <MoneyInput value={parseFloat(aditivoForm.valor_supressao) || 0} onValueChange={v => setAditivoForm(f => ({ ...f, valor_supressao: String(v) }))} placeholder="R$ 0,00" disabled={linhasMandamUpload} />
                </div>
              </>
            )}

            {showQtyFields(uploadTipo) && (
              <>
                <div className="space-y-1.5">
                  <Label>Qtde Acréscimo{linhasMandamUpload && <span className="g-meta text-muted-foreground"> · soma das linhas</span>}</Label>
                  <Input type="number" step="1" value={aditivoForm.quantidade_acrescimo} onChange={(e) => setAditivoForm(f => ({ ...f, quantidade_acrescimo: e.target.value }))} placeholder="0" disabled={linhasMandamUpload} />
                </div>
                <div className="space-y-1.5">
                  <Label>Qtde Supressão</Label>
                  <Input type="number" step="1" value={aditivoForm.quantidade_supressao} onChange={(e) => setAditivoForm(f => ({ ...f, quantidade_supressao: e.target.value }))} placeholder="0" disabled={linhasMandamUpload} />
                </div>
              </>
            )}

            {(showDateField(uploadTipo) || isAditivoType(uploadTipo)) && (
              <div className="space-y-1.5">
                <Label>Nova Data Fim (se prorrogação)</Label>
                <Input type="date" value={aditivoForm.nova_data_fim} onChange={(e) => setAditivoForm(f => ({ ...f, nova_data_fim: e.target.value }))} />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Justificativa / Fundamentação</Label>
              <Textarea value={aditivoForm.justificativa} onChange={(e) => setAditivoForm(f => ({ ...f, justificativa: e.target.value }))} rows={2} placeholder="Fundamentação legal do aditivo" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={aditivoForm.observacoes} onChange={(e) => setAditivoForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>

          {modoDoTipo(uploadTipo) && (
            <ItensDoTermo
              itens={itensDoContrato}
              modo={modoDoTipo(uploadTipo)!}
              linhas={linhasDoTermo}
              onChange={setLinhasDoTermo}
              semItem={linhasSemItem}
              onSemItemChange={setLinhasSemItem}
              disabled={uploading}
            />
          )}
          {blocoDeAvisos(avisosUpload, comRessalva, setComRessalva)}

          {/* Live preview */}
          {(showValueFields(uploadTipo) || showQtyFields(uploadTipo)) && (
            <Card className="bg-secondary p-3 shadow-none">
              <p className="g-meta text-muted-foreground mb-1 font-medium">Resumo do Aditivo</p>
              <div className="flex flex-wrap gap-4 text-xs">
                {showValueFields(uploadTipo) && (
                  <span className={`font-semibold ${(parseFloat(aditivoForm.valor_acrescimo) || 0) - (parseFloat(aditivoForm.valor_supressao) || 0) >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                    Saldo Valor: {fmt((parseFloat(aditivoForm.valor_acrescimo) || 0) - (parseFloat(aditivoForm.valor_supressao) || 0))}
                  </span>
                )}
                {showQtyFields(uploadTipo) && (
                  <span className={`font-semibold ${(parseFloat(aditivoForm.quantidade_acrescimo) || 0) - (parseFloat(aditivoForm.quantidade_supressao) || 0) >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                    Saldo Qtde: {fmtQty((parseFloat(aditivoForm.quantidade_acrescimo) || 0) - (parseFloat(aditivoForm.quantidade_supressao) || 0))}
                  </span>
                )}
              </div>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="g-controle" onClick={() => { setShowAditivoFields(false); setPendingFile(null); setAditivoForm(emptyAditivoForm); limparTermo(); setUploadTipo('contrato_original'); }}>
              Cancelar
            </Button>
            <Button size="sm" className="g-controle" onClick={handleConfirmAditivo} disabled={uploading || avisoBloqueia(avisosUpload)}>
              {uploading && <Loader2 aria-hidden="true" className="animate-spin" />}
              {pendingFile ? 'Enviar e Registrar Aditivo' : 'Registrar Aditivo (sem arquivo)'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );

  /** O painel do termo aditivo selecionado — o cartão de antes, inteiro. */
  const painelDoAditivo = aditivoAberto ? (() => {
    const a = aditivoAberto as any;
    const Icon = ADITIVO_ICON[a.tipo] || FilePlus2;
    const tipoLabel = { valor: 'Valor', quantidade: 'Quantidade', valor_quantidade: 'Quantidade e Valor', prazo: 'Prazo', prazo_valor: 'Prazo e Valor', prazo_quantidade: 'Prazo e Quantidade', escopo: 'Escopo' }[a.tipo as string] || a.tipo;
    const saldoValor = (a.valor_acrescimo || 0) - (a.valor_supressao || 0);
    const saldoQtyItem = (a.quantidade_acrescimo || 0) - (a.quantidade_supressao || 0);
    const arq = arquivos.find((f: any) => f.id === a.arquivo_id);
    return (
      <div className="flex flex-col gap-4">
        <BlocoDoPainel
          titulo={
            <span className="inline-flex items-center gap-2">
              <span className="rounded-md bg-muted p-1.5"><Icon className="h-4 w-4" aria-hidden="true" /></span>
              {a.numero_aditivo}
            </span>
          }
          acao={<Badge variant="muted">{tipoLabel}</Badge>}
        >
          <ListaDeCampos
            campos={[
              { rotulo: 'Acréscimo (R$)', numerico: true, valor: fmt(a.valor_acrescimo || 0) },
              { rotulo: 'Supressão (R$)', numerico: true, valor: fmt(a.valor_supressao || 0) },
              {
                rotulo: 'Saldo de valor',
                numerico: true,
                valor: <span className={saldoValor >= 0 ? 'text-success-ink' : 'text-destructive-ink'}>{fmt(saldoValor)}</span>,
              },
              { rotulo: 'Acréscimo (qtde)', numerico: true, valor: `+${fmtQty(a.quantidade_acrescimo || 0)}` },
              { rotulo: 'Supressão (qtde)', numerico: true, valor: `-${fmtQty(a.quantidade_supressao || 0)}` },
              {
                rotulo: 'Saldo de quantidade',
                numerico: true,
                valor: <span className={saldoQtyItem >= 0 ? 'text-success-ink' : 'text-destructive-ink'}>{fmtQty(saldoQtyItem)}</span>,
              },
              {
                rotulo: 'Nova vigência',
                valor: a.nova_data_fim
                  ? new Date(a.nova_data_fim + 'T00:00:00').toLocaleDateString('pt-BR')
                  : <ValorIndisponivel razao="Não prorroga" />,
              },
              {
                rotulo: 'Assinatura',
                valor: (a.data_assinatura || a.data_aditivo)
                  ? new Date((a.data_assinatura || a.data_aditivo) + 'T00:00:00').toLocaleDateString('pt-BR')
                  : <ValorIndisponivel razao="Não informada" />,
              },
            ]}
          />
        </BlocoDoPainel>

        {(linhasPorAditivo[a.id] ?? 0) > 0 && (
          <BlocoDoPainel titulo="Itens do termo">
            {a.itens_aplicados_em ? (
              <p className="g-corpo" data-testid="itens-do-termo-aplicados">
                {linhasPorAditivo[a.id]} item(ns) com preço ou quantidade alterados, aplicados em{' '}
                {new Date(a.itens_aplicados_em).toLocaleDateString('pt-BR')}.
              </p>
            ) : (
              <div className="flex flex-col gap-2" data-testid="itens-do-termo-pendentes">
                <p className="g-corpo text-warning-ink">
                  {linhasPorAditivo[a.id]} item(ns) gravados neste termo ainda NÃO foram aplicados: os preços e saldos dos itens continuam os de antes.
                </p>
                <div>
                  <Button size="sm" className="g-controle" onClick={() => aplicarItensDoTermo(a.id)} disabled={aplicandoTermo === a.id}>
                    {aplicandoTermo === a.id ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
                    Aplicar aos itens
                  </Button>
                </div>
              </div>
            )}
          </BlocoDoPainel>
        )}

        <BlocoDoPainel titulo="Justificativa / fundamentação">
          {a.justificativa
            ? <p className="g-corpo whitespace-pre-wrap leading-relaxed">{a.justificativa}</p>
            : <ValorIndisponivel razao="Não registrada" />}
          {a.observacoes && (
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="g-meta text-muted-foreground mb-1">Observações</p>
              <p className="g-meta whitespace-pre-wrap">{a.observacoes}</p>
            </div>
          )}
        </BlocoDoPainel>

        <BlocoDoPainel titulo="Documento do termo">
          {/* "Onde está o arquivo deste aditivo?" — a pergunta que o cartão não
              respondia. O elo (arquivo_id) já existia no banco; faltava a tela
              usá-lo. E o registro anterior ao elo automático (ou digitado sem
              documento) resolve o vínculo aqui mesmo, em vez de virar beco. */}
          {arq ? (
            <button
              type="button"
              onClick={() => handleVisualizar(arq)}
              title="Visualizar o documento deste aditivo"
              className="g-corpo inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">{arq.nome_arquivo}</span>
              <Eye aria-hidden="true" className="h-4 w-4 shrink-0" />
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <ValorIndisponivel razao="Sem arquivo vinculado" />
              {arquivos.length > 0 && (
                <Select onValueChange={async (fid) => {
                  const { error } = await supabase.from('contrato_aditivos')
                    .update({ arquivo_id: fid } as never).eq('id', a.id);
                  if (error) { toast.error('Não foi possível vincular', { description: error.message }); return; }
                  toast.success('Arquivo vinculado ao aditivo.');
                  loadData();
                }}>
                  <SelectTrigger className="g-controle">
                    <SelectValue placeholder="Vincular arquivo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {arquivos.map((f: any) => (
                      <SelectItem key={f.id} value={f.id} className="g-meta">
                        {f.nome_arquivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </BlocoDoPainel>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="g-controle text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
            onClick={() => { handleDeleteAditivo(a.id); setAditivoSelecionado(null); }}>
            <Trash2 aria-hidden="true" /> Excluir termo
          </Button>
        </div>
      </div>
    );
  })() : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ── Subabas ──────────────────────────────────────────────────────────
          Documentos, termos aditivos e o diário de auditoria são três assuntos
          que dividiam a mesma rolagem: o diário aberto no topo empurrava a
          lista de arquivos para fora da tela, e os aditivos ficavam depois de
          tudo. Separados, cada um começa no alto da sua subaba. */}
      <AbasGestao
        abas={[
          { valor: 'arquivos', rotulo: 'Arquivos', contagem: arquivos.length },
          { valor: 'aditivos', rotulo: 'Aditivos', contagem: aditivos.length },
          { valor: 'auditoria', rotulo: 'Auditoria' },
        ]}
        valor={subAba}
        aoMudar={(v) => setSubAba(v as 'arquivos' | 'aditivos' | 'auditoria')}
      />

      {/* Hidden input for file replacement */}
      <input
        ref={replaceFileRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
        className="hidden"
        onChange={onReplaceFileSelected}
      />

      {subAba === 'arquivos' && (
        <>
          {areaDeRegistro}

          <BarraFiltros
            busca={buscaArquivo}
            aoBuscar={setBuscaArquivo}
            placeholderBusca="Buscar por nome, tipo ou descrição do documento..."
            filtrosAplicados={termoArquivo ? 1 : 0}
            aoLimpar={() => setBuscaArquivo('')}
          />

          {loading ? (
            <Card className="overflow-hidden" role="status" aria-busy="true">
              <span className="sr-only">Carregando documentos…</span>
              <div className="flex flex-col gap-px bg-border">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="ml-auto h-4 w-16" />
                  </div>
                ))}
              </div>
            </Card>
          ) : arquivos.length === 0 ? (
            <Card>
              <EstadoVazio
                tamanho="compacto"
                icone={<File />}
                titulo="Nenhum documento anexado a este contrato"
                descricao="Envie o contrato original, aditivos e outros documentos."
              />
            </Card>
          ) : arquivosVisiveis.length === 0 ? (
            <Card>
              <EstadoVazio tamanho="compacto" titulo={<>Nenhum documento corresponde à busca “{buscaArquivo}”.</>} />
            </Card>
          ) : (
            /* Os documentos eram cartões empilhados de ~90px cada: dez anexos
               davam quase uma tela inteira só de molduras. Em tabela, a mesma
               informação — nome, tipo, tamanho, data, descrição — cabe em
               linhas de 44px, e as seis ações continuam todas na linha. */
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Documento</TableHead>
                    <TableHead className="whitespace-nowrap">Tipo</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Tamanho</TableHead>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead className="sticky right-0 border-l border-border bg-secondary">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arquivosVisiveis.map((arq: any) => {
                    const tipoConfig = TIPOS_ARQUIVO[arq.tipo] || TIPOS_ARQUIVO.outro;
                    return (
                      <TableRow key={arq.id}>
                        <TableCell className="max-w-[24rem]">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => handleVisualizar(arq)}
                                title="Visualizar em tela"
                                className="block w-full truncate rounded text-left font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {arq.nome_arquivo}
                              </button>
                              {arq.descricao && (
                                <span className="g-meta block truncate text-muted-foreground" title={arq.descricao}>
                                  {arq.descricao}
                                </span>
                              )}
                              {/* Onde a leitura está. Sem isto o OCR de um documento
                                  escaneado — que leva minutos — é um spinner mudo, e a
                                  espera correta é indistinguível de travamento. */}
                              {releituraDe(arq.id) && (
                                <p className="g-meta text-primary mt-0.5 flex items-center gap-1.5">
                                  <Loader2 aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin" />
                                  {releituraDe(arq.id)!.mensagem}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge className={tipoConfig.color}>{tipoConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                          {formatBytes(arq.tamanho_bytes)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {new Date(arq.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="sticky right-0 border-l border-border bg-card">
                          {/* Seis ações numa linha viravam uma fileira de ícones
                              cinzentos. O Design System v3 pede até três à vista e
                              o resto num menu "⋯": ficam Reler, Visualizar e Baixar;
                              Substituir, Editar e Excluir moram no menu — mesmos
                              handlers, mesmos `disabled` e `title`. */}
                          <div className="flex gap-0.5">
                            {/* Reler o que já está guardado. Sem isto, alimentar o
                                Dashboard com o que a leitura passou a extrair exigia
                                APAGAR o documento e anexá-lo de novo — destruir o
                                registro do dossiê para reprocessar um arquivo que nunca
                                saiu do lugar. */}
                            <Button size="icon-sm" variant="ghost"
                              onClick={() => handleReler(arq)}
                              disabled={!!releituraDe(arq.id) || autoridadeDoArquivo(arq.tipo, parentTipoDocumento ?? 'contrato') === 'nenhuma'}
                              title={autoridadeDoArquivo(arq.tipo, parentTipoDocumento ?? 'contrato') === 'nenhuma'
                                ? 'Empenho, ordem de fornecimento e publicação não alimentam os dados do contrato — só o instrumento e seus aditivos'
                                : 'Reler com a IA e preencher os campos em branco do contrato'}
                              aria-label="Reler com a IA">
                              {releituraDe(arq.id)
                                ? <Loader2 aria-hidden="true" className="animate-spin" />
                                : <Sparkles aria-hidden="true" className="text-teal" />}
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => handleVisualizar(arq)} title="Visualizar em tela" aria-label="Visualizar em tela">
                              <Eye aria-hidden="true" />
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => handleDownload(arq)} title="Baixar" aria-label="Baixar">
                              <Download aria-hidden="true" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon-sm" variant="ghost" aria-label={`Mais ações de ${arq.nome_arquivo}`}>
                                  <MoreHorizontal aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleReplaceFile(arq)} disabled={replacingId === arq.id} title="Substituir arquivo + reextrair valores">
                                  {replacingId === arq.id ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Repeat aria-hidden="true" />}
                                  Substituir arquivo + reextrair valores
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => openEdit(arq)} title="Editar">
                                  <Pencil aria-hidden="true" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => handleDelete(arq)}
                                  title="Excluir"
                                  className="text-destructive-ink focus:text-destructive-ink [&>svg]:text-destructive-ink"
                                >
                                  <Trash2 aria-hidden="true" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {subAba === 'aditivos' && (
        <>
          {/* O resumo geral vestia-se igual aos cartões de cada termo, e os dois
              níveis se confundiam. Agora ele é a tira de indicadores do topo —
              seis medidas, cada uma com a própria base declarada — e os termos
              ficam na tabela abaixo, visivelmente subordinados. */}
          {aditivos.length > 0 && (
            <FaixaIndicadores
              itens={[
                { rotulo: 'Acréscimos (R$)', valor: fmt(totalAcrescimo), detalhe: `soma de ${aditivos.length} termo${aditivos.length > 1 ? 's' : ''}`, tom: 'ok' },
                { rotulo: 'Supressões (R$)', valor: fmt(totalSupressao), detalhe: 'soma das reduções registradas', tom: 'aviso' },
                { rotulo: 'Saldo de valor', valor: fmt(saldoAditivos), detalhe: 'acréscimos − supressões', tom: saldoAditivos >= 0 ? 'ok' : 'critico' },
                { rotulo: 'Acrésc. de quantidade', valor: `+${fmtQty(totalQtyAcrescimo)}`, detalhe: 'soma dos termos de quantidade', tom: 'ok' },
                { rotulo: 'Supr. de quantidade', valor: `-${fmtQty(totalQtySupressao)}`, detalhe: 'soma das reduções de quantidade', tom: 'aviso' },
                { rotulo: 'Saldo de quantidade', valor: fmtQty(saldoQty), detalhe: 'acréscimos − supressões', tom: saldoQty >= 0 ? 'ok' : 'critico' },
              ]}
            />
          )}

          {areaDeRegistro}

          {loading ? (
            <Card className="overflow-hidden" role="status" aria-busy="true">
              <span className="sr-only">Carregando termos aditivos…</span>
              <div className="flex flex-col gap-px bg-border">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="ml-auto h-4 w-20" />
                  </div>
                ))}
              </div>
            </Card>
          ) : aditivos.length === 0 ? (
            <Card>
              <EstadoVazio
                tamanho="compacto"
                icone={<FilePlus2 />}
                titulo="Nenhum termo aditivo registrado"
                descricao="Escolha um tipo de aditivo acima e envie o termo — apostilamentos e aditivos moram na mesma lista, distinguidos pelo tipo."
              />
            </Card>
          ) : (
            <AreaComPainel
              painel={painelDoAditivo}
              tituloPainel="Termo aditivo"
              aoFechar={() => setAditivoSelecionado(null)}
            >
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Termo</TableHead>
                      <TableHead className="whitespace-nowrap">Tipo</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Efeito no valor</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Efeito na quantidade</TableHead>
                      <TableHead className="whitespace-nowrap">Vigência / assinatura</TableHead>
                      <TableHead className="whitespace-nowrap">Documento</TableHead>
                      <TableHead className="sticky right-0 border-l border-border bg-secondary">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aditivos.map((a: any) => {
                      const Icon = ADITIVO_ICON[a.tipo] || FilePlus2;
                      const tipoLabel = { valor: 'Valor', quantidade: 'Quantidade', valor_quantidade: 'Quantidade e Valor', prazo: 'Prazo', prazo_valor: 'Prazo e Valor', prazo_quantidade: 'Prazo e Quantidade', escopo: 'Escopo' }[a.tipo as string] || a.tipo;
                      const saldoValor = (a.valor_acrescimo || 0) - (a.valor_supressao || 0);
                      const saldoQtyItem = (a.quantidade_acrescimo || 0) - (a.quantidade_supressao || 0);
                      const arq = arquivos.find((f: any) => f.id === a.arquivo_id);
                      const selecionado = aditivoSelecionado === a.id;
                      return (
                        <TableRow
                          key={a.id}
                          data-state={selecionado ? 'selected' : undefined}
                          className={selecionado ? 'border-l-2 border-l-primary' : undefined}
                        >
                          <TableCell className="max-w-[16rem]">
                            <button
                              type="button"
                              onClick={() => setAditivoSelecionado(a.id)}
                              title="Abrir o termo no painel"
                              className="flex w-full items-center gap-2 rounded text-left font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span className="truncate">{a.numero_aditivo}</span>
                            </button>
                            {a.justificativa && (
                              /* A justificativa vive cortada; o clique abre a
                                 leitura integral — mesmo gesto da descrição do
                                 item na aba Itens/Lotes. */
                              <button
                                type="button"
                                onClick={() => setJustificativaAberta(a)}
                                title="Ler a justificativa completa"
                                className="g-meta mt-0.5 block w-full truncate rounded text-left text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {a.justificativa}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="muted">{tipoLabel}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {(a.valor_acrescimo || 0) > 0 && <div className="text-success-ink">+{fmt(a.valor_acrescimo)}</div>}
                            {(a.valor_supressao || 0) > 0 && <div className="text-destructive-ink">-{fmt(a.valor_supressao)}</div>}
                            {(a.valor_acrescimo || 0) === 0 && (a.valor_supressao || 0) === 0 ? (
                              <span className="text-muted-foreground">não altera</span>
                            ) : (
                              <div className={`font-medium ${saldoValor >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                                saldo {fmt(saldoValor)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {(a.quantidade_acrescimo || 0) > 0 && <div className="text-success-ink">+{fmtQty(a.quantidade_acrescimo)}</div>}
                            {(a.quantidade_supressao || 0) > 0 && <div className="text-destructive-ink">-{fmtQty(a.quantidade_supressao)}</div>}
                            {(a.quantidade_acrescimo || 0) === 0 && (a.quantidade_supressao || 0) === 0 ? (
                              <span className="text-muted-foreground">não altera</span>
                            ) : (
                              <div className={`font-medium ${saldoQtyItem >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                                saldo {fmtQty(saldoQtyItem)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            <div>
                              {a.nova_data_fim
                                ? `nova vigência: ${new Date(a.nova_data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
                                : 'não prorroga'}
                            </div>
                            <div>
                              {(a.data_assinatura || a.data_aditivo)
                                ? `assinado em ${new Date((a.data_assinatura || a.data_aditivo) + 'T00:00:00').toLocaleDateString('pt-BR')}`
                                : 'sem data de assinatura'}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[14rem]">
                            {arq ? (
                              <button
                                type="button"
                                onClick={() => handleVisualizar(arq)}
                                title="Visualizar o documento deste aditivo"
                                className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
                              >
                                <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{arq.nome_arquivo}</span>
                              </button>
                            ) : (
                              <span className="text-warning-ink">sem arquivo vinculado</span>
                            )}
                          </TableCell>
                          <TableCell className="sticky right-0 border-l border-border bg-card">
                            <div className="flex gap-0.5">
                              <Button size="icon-sm" variant="ghost" title="Abrir o termo no painel" aria-label="Abrir o termo no painel"
                                onClick={() => setAditivoSelecionado(a.id)}>
                                <Eye aria-hidden="true" />
                              </Button>
                              <Button size="icon-sm" variant="ghost-destructive" title="Excluir termo" aria-label="Excluir termo"
                                onClick={() => handleDeleteAditivo(a.id)}>
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </AreaComPainel>
          )}
        </>
      )}

      {subAba === 'auditoria' && (
        <ContratoIaAuditoriaPanel contratoId={contratoId} aoVerDocumento={verDocumentoPorId} />
      )}

      {/* Leitura integral da justificativa do termo */}
      <Dialog open={!!justificativaAberta} onOpenChange={(v) => !v && setJustificativaAberta(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Justificativa — {justificativaAberta?.numero_aditivo || 'Termo Aditivo'}
            </DialogTitle>
          </DialogHeader>
          {justificativaAberta && (
            <div className="space-y-3">
              <p className="g-corpo leading-relaxed whitespace-pre-wrap">{justificativaAberta.justificativa}</p>
              {justificativaAberta.observacoes && (
                <div className="rounded-md border border-border bg-secondary p-3 text-xs">
                  <div className="text-muted-foreground mb-1">Observações</div>
                  <p className="whitespace-pre-wrap">{justificativaAberta.observacoes}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {justificativaAberta.nova_data_fim && (
                  <span>Nova vigência: {new Date(justificativaAberta.nova_data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                )}
                {(justificativaAberta.data_assinatura || justificativaAberta.data_aditivo) && (
                  <span>Assinatura: {new Date((justificativaAberta.data_assinatura || justificativaAberta.data_aditivo) + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!visualizando} onOpenChange={(v) => !v && setVisualizando(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{visualizando?.nome}</DialogTitle>
          </DialogHeader>
          {visualizando && (
            <iframe
              src={visualizando.url}
              title={visualizando.nome}
              className="flex-1 w-full rounded-md border border-border bg-muted"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog.open} onOpenChange={(v) => setEditDialog({ open: v, arquivo: v ? editDialog.arquivo : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Documento</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo do Documento</Label>
              <Select value={editTipo} onValueChange={(v) => {
                setEditTipo(v);
                if (isAditivoType(v) && !editLinkedAditivoId) {
                  setEditAditivoForm(f => ({ ...f, numero_aditivo: f.numero_aditivo || `${aditivos.length + 1}º Aditivo` }));
                }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(tiposDisponiveis).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {TIPOS_ARQUIVO[editTipo]?.semLimite && (
                <p className="g-meta text-warning-ink mt-1 flex items-center gap-1">
                  <RefreshCw aria-hidden="true" className="h-3 w-3 shrink-0" />
                  Não sujeito ao limite de 25% do art. 125, Lei 14.133/21.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} placeholder="Ex: 1º Aditivo de Prazo" />
            </div>

            {/* Aditivo fields in edit */}
            {isAditivoType(editTipo) && (
              <div className="space-y-4 rounded-lg border border-border bg-secondary p-4">
                <p className="text-sm font-semibold text-foreground">Dados do Aditivo</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nº/Identificação</Label>
                    <Input value={editAditivoForm.numero_aditivo} onChange={(e) => setEditAditivoForm(f => ({ ...f, numero_aditivo: e.target.value }))} placeholder="1º Aditivo" />
                  </div>
                  {camposDeVigencia(editTipo, editAditivoForm, setEditAditivoForm)}

                  {showValueFields(editTipo) && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Valor Acréscimo (R$){linhasMandamEdit && <span className="g-meta text-muted-foreground"> · soma das linhas</span>}</Label>
                        <MoneyInput value={parseFloat(editAditivoForm.valor_acrescimo) || 0} onValueChange={v => setEditAditivoForm(f => ({ ...f, valor_acrescimo: String(v) }))} placeholder="R$ 0,00" disabled={linhasMandamEdit} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor Supressão (R$)</Label>
                        <MoneyInput value={parseFloat(editAditivoForm.valor_supressao) || 0} onValueChange={v => setEditAditivoForm(f => ({ ...f, valor_supressao: String(v) }))} placeholder="R$ 0,00" disabled={linhasMandamEdit} />
                      </div>
                    </>
                  )}

                  {showQtyFields(editTipo) && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Qtde Acréscimo{linhasMandamEdit && <span className="g-meta text-muted-foreground"> · soma das linhas</span>}</Label>
                        <Input type="number" step="1" value={editAditivoForm.quantidade_acrescimo} onChange={(e) => setEditAditivoForm(f => ({ ...f, quantidade_acrescimo: e.target.value }))} placeholder="0" disabled={linhasMandamEdit} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Qtde Supressão</Label>
                        <Input type="number" step="1" value={editAditivoForm.quantidade_supressao} onChange={(e) => setEditAditivoForm(f => ({ ...f, quantidade_supressao: e.target.value }))} placeholder="0" disabled={linhasMandamEdit} />
                      </div>
                    </>
                  )}

                  {(showDateField(editTipo) || isAditivoType(editTipo)) && (
                    <div>
                      <Label>Nova Data Fim (se prorrogação)</Label>
                      <Input type="date" value={editAditivoForm.nova_data_fim} onChange={(e) => setEditAditivoForm(f => ({ ...f, nova_data_fim: e.target.value }))} />
                    </div>
                  )}

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Justificativa / Fundamentação</Label>
                    <Textarea value={editAditivoForm.justificativa} onChange={(e) => setEditAditivoForm(f => ({ ...f, justificativa: e.target.value }))} rows={2} placeholder="Fundamentação legal do aditivo" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Observações</Label>
                    <Textarea value={editAditivoForm.observacoes} onChange={(e) => setEditAditivoForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                  </div>
                </div>

                {modoDoTipo(editTipo) && (
                  <ItensDoTermo
                    itens={editItens}
                    modo={modoDoTipo(editTipo)!}
                    linhas={editLinhas}
                    onChange={setEditLinhas}
                    semItem={editLinhasSemItem}
                    onSemItemChange={setEditLinhasSemItem}
                    disabled={saving}
                  />
                )}
                {blocoDeAvisos(avisosEdit, editComRessalva, setEditComRessalva)}

                {/* Preview */}
                {(showValueFields(editTipo) || showQtyFields(editTipo)) && (
                  <Card className="bg-secondary p-3 shadow-none">
                    <p className="g-meta text-muted-foreground mb-1 font-medium">Resumo do Aditivo</p>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {showValueFields(editTipo) && (
                        <span className={`font-semibold ${(parseFloat(editAditivoForm.valor_acrescimo) || 0) - (parseFloat(editAditivoForm.valor_supressao) || 0) >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                          Saldo Valor: {fmt((parseFloat(editAditivoForm.valor_acrescimo) || 0) - (parseFloat(editAditivoForm.valor_supressao) || 0))}
                        </span>
                      )}
                      {showQtyFields(editTipo) && (
                        <span className={`font-semibold ${(parseFloat(editAditivoForm.quantidade_acrescimo) || 0) - (parseFloat(editAditivoForm.quantidade_supressao) || 0) >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                          Saldo Qtde: {fmtQty((parseFloat(editAditivoForm.quantidade_acrescimo) || 0) - (parseFloat(editAditivoForm.quantidade_supressao) || 0))}
                        </span>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Substituir arquivo</Label>
              <div className="mt-1">
                <input ref={editFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
                <Button variant="outline" size="sm" onClick={() => editFileRef.current?.click()}>
                  <Upload aria-hidden="true" />
                  {editFile ? editFile.name : 'Selecionar novo arquivo'}
                </Button>
              </div>
              <p className="g-meta text-muted-foreground mt-1">Deixe em branco para manter o arquivo atual.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog({ open: false, arquivo: null })}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* IA document detection dialog */}
      <DocumentDetectionDialog
        open={detectionOpen}
        onOpenChange={(o) => { setDetectionOpen(o); if (!o) { setDetection(null); setPendingFile(null); setConfrontoAta(null); } }}
        detection={detection}
        parentTipoDocumento={parentTipoDocumento}
        fileName={detectionFileName}
        confronto={confrontoAta}
        onCreateLinkedRegistry={handleCreateLinkedRegistry}
        onConfirmAditivo={handleConfirmAditivoFromDetection}
        onIgnore={handleDetectionIgnore}
      />
    </div>
  );
}
