import { useCallback, useEffect, useMemo, useState, type ElementType, type MouseEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { AvisoDeFalha, ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { SEGMENTOS_OBJETO, LABEL_SEGMENTO } from '@/lib/habilitacao/tipos';
import { buildDocumentAnalysisPayload } from '@/lib/documentos/leitura-de-atestado';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Upload, Download, Trash2, Loader2, Bot, Eye, Lock, Pencil, MoreHorizontal,
  CheckCircle2, AlertTriangle, Plus, FileText, Paperclip, CalendarDays,
  ShoppingBasket, Monitor, Sparkles, Package, Utensils,
  Wrench, Shirt, Pill, Building2,
} from 'lucide-react';

/**
 * Aba Atestados do módulo /documentos — a tabela+painel do padrão de Gestão.
 *
 * ATENÇÃO ao que sustenta esta tela, porque nada disso é visível no código de
 * quem só lê a UI:
 *
 *  1. Atestado NÃO tem tabela própria. Ele vive em `documentos`, identificado
 *     pelo PREFIXO do `nome` — `ACT – ` com travessão U+2013. Mudar uma letra
 *     ou trocar o travessão por hífen faz a leitura devolver zero linha e a
 *     tela dizer "nenhum atestado" para quem tem dezenas gravados.
 *  2. Os dados extraídos pela IA moram em `dados_extraidos` (objeto, órgão,
 *     ano, PERÍODO, valor, CNPJ). O período sempre foi gravado e nunca exibido:
 *     agora aparece na coluna Ano/período, no painel, no formulário de envio e
 *     ainda alimenta o filtro de ano quando o campo "ano" veio vazio.
 *  3. O atestado é da EMPRESA, não de quem o digitalizou: é emitido por órgão
 *     público ou empresa privada, assinado por representante, e integra a
 *     documentação da fase de habilitação. Grava com `empresa_id` e na pasta
 *     `empresa/<id>/` do storage. O legado — gravado antes disso, com
 *     `empresa_id` nulo — continua aparecendo para o próprio dono até a
 *     migration `20260914000001` rodar; é o que o `.or()` da leitura sustenta.
 */

/** ⚠️ Travessão U+2013, não hífen. É a chave de leitura de tudo o que já existe. */
const PREFIXO_ACT = 'ACT – ';
/** O mesmo prefixo no dialeto do `like` do PostgREST. */
const FILTRO_NOME_ACT = 'ACT –%';
const BUCKET = 'documentos-habilitacao';

/**
 * Ícone e explicação de cada segmento. Os VALORES e RÓTULOS não nascem aqui:
 * vêm de `SEGMENTOS_OBJETO`/`LABEL_SEGMENTO`, o mesmo vocabulário que a IA usa
 * para classificar o objeto do edital e casar com o atestado certo. Duas listas
 * paralelas divergiriam no primeiro segmento novo — e o casamento passaria a
 * procurar um segmento que o cofre não grava.
 */
const DETALHE_SEGMENTO: Record<string, { sublabel: string; icone: ElementType }> = {
  alimentos: { sublabel: 'Cestas básicas, merenda escolar', icone: Utensils },
  informatica: { sublabel: 'Equipamentos, suprimentos, software', icone: Monitor },
  limpeza: { sublabel: 'Produtos de limpeza, descartáveis', icone: Sparkles },
  escritorio: { sublabel: 'Papelaria, expediente', icone: Package },
  moveis: { sublabel: 'Mobiliário, eletrodomésticos', icone: Building2 },
  vestuario: { sublabel: 'Uniformes, fardamento, EPIs', icone: Shirt },
  medicamentos: { sublabel: 'Medicamentos, material hospitalar', icone: Pill },
  manutencao: { sublabel: 'Manutenção predial, elétrica', icone: Wrench },
  outros: { sublabel: 'Segmentos não listados', icone: ShoppingBasket },
};

const SEGMENTOS_ACT = SEGMENTOS_OBJETO.map((value) => ({
  value: value as string,
  label: LABEL_SEGMENTO[value] ?? value,
  sublabel: DETALHE_SEGMENTO[value]?.sublabel ?? '',
  icon: DETALHE_SEGMENTO[value]?.icone ?? ShoppingBasket,
}));

const SEGMENTO_PADRAO = 'outros';

const segmentoDe = (valor?: string | null) =>
  SEGMENTOS_ACT.find((s) => s.value === valor) ??
  SEGMENTOS_ACT.find((s) => s.value === SEGMENTO_PADRAO)!;

/** O `nome` da linha é derivado do segmento — e nunca perde o prefixo. */
const nomeDoAtestado = (segmento: string) => `${PREFIXO_ACT}${segmentoDe(segmento).label}`;

type DadosAtestado = {
  objeto?: string;
  orgao_emissor?: string;
  ano_fornecimento?: string;
  valor?: string;
  cnpj_contratante?: string;
  periodo?: string;
};

type ACTDoc = {
  id: string;
  nome: string;
  segmento: string;
  validade?: string | null;
  arquivo_path?: string | null;
  tamanho_bytes?: number | null;
  user_id?: string | null;
  /** Nulo no legado gravado antes de 14/09/2026 — ver o cabeçalho, item 3. */
  empresa_id?: string | null;
  dados_extraidos?: DadosAtestado;
};

type ExtractionStatus = 'idle' | 'success' | 'warning' | 'error';

const createEmptyExtractedData = (): DadosAtestado => ({
  objeto: '',
  orgao_emissor: '',
  ano_fornecimento: '',
  valor: '',
  cnpj_contratante: '',
  periodo: '',
});

const hasExtractedContent = (value?: DadosAtestado) =>
  Boolean(
    value?.objeto ||
    value?.orgao_emissor ||
    value?.ano_fornecimento ||
    value?.valor ||
    value?.cnpj_contratante ||
    value?.periodo,
  );

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const nomeDoArquivo = (path?: string | null) => (path ? path.split('/').pop() || path : '');

/**
 * A mensagem REAL do erro, quando existe (princípio 3 do CLAUDE.md).
 *
 * Erro de Supabase/Storage não é `Error`: é um objeto com `message`. Tratar o
 * `catch` como `any` funcionava por acidente e escondia o caso em que não há
 * mensagem nenhuma — aí a pessoa via "undefined" no lugar do motivo.
 */
const mensagemDoErro = (err: unknown, padrao: string): string => {
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const mensagem = (err as { message?: unknown }).message;
    if (typeof mensagem === 'string' && mensagem.trim()) return mensagem;
  }
  return padrao;
};

/** Texto não vazio depois de aparado — o que a IA não achou vem como '' ou undefined. */
const preenchido = (valor?: string | null) => Boolean(valor && valor.trim());

/**
 * O ano de referência do atestado, para o filtro e para a coluna.
 *
 * O campo `ano_fornecimento` é o primeiro a valer, mas ele volta vazio com
 * frequência — e quando volta, o ano quase sempre está DENTRO do período
 * ("de jan/2023 a dez/2024"). Usar o último ano citado é deliberado: é o fim
 * do fornecimento, que é a data pela qual um edital cobra recência.
 */
const anoDe = (doc: ACTDoc): string => {
  const bruto = doc.dados_extraidos?.ano_fornecimento?.trim();
  if (bruto) return bruto;
  const noPeriodo = doc.dados_extraidos?.periodo?.match(/\b(?:19|20)\d{2}\b/g);
  return noPeriodo?.[noPeriodo.length - 1] ?? '';
};

/** Clique em botão/link dentro da linha não pode abrir o painel junto. */
const naoAbrirPainel = (e: MouseEvent<HTMLElement>) => {
  if ((e.target as HTMLElement).closest('button,a')) e.stopPropagation();
};

/**
 * A frase que o comando exige por escrito, e o motivo dela.
 *
 * "Cadastrado" descreve o ARQUIVO no cofre — nada mais. Quem lê um selo verde
 * numa tela de habilitação tende a ler "aprovado", e aí deixa de conferir se o
 * objeto atestado cobre o que o edital exige. A compatibilidade é análise
 * humana contra um edital concreto; esta tela não a faz e não a insinua.
 */
const NOTA_SEM_ANALISE =
  'Cadastro do arquivo não representa análise de compatibilidade com um edital.';

export default function AtestadosCapacidadeTecnica() {
  const { user } = useAuth();
  const { empresaAtiva, empresas } = useEmpresa();
  /* O id, e não o objeto: o contexto devolve referência nova a cada render, e é
     o id que decide o que a consulta lê. Passar o objeto na lista de
     dependências do `carregar` recarregaria a tela a cada render. */
  const idEmpresa = empresaAtiva?.id ?? null;
  /* Papel na empresa ATIVA — é o que a policy de delete exige. */
  const ehAdmin = empresas.some((m) => m.empresa_id === idEmpresa && m.papel === 'admin');
  const [docs, setDocs] = useState<ACTDoc[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedSegmento, setSelectedSegmento] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<DadosAtestado>();
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle');
  const [extractionMessage, setExtractionMessage] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);

  const [emEdicao, setEmEdicao] = useState<ACTDoc | null>(null);
  const [edicaoSegmento, setEdicaoSegmento] = useState('');
  const [edicaoDados, setEdicaoDados] = useState<DadosAtestado>(createEmptyExtractedData());
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const [aExcluir, setAExcluir] = useState<ACTDoc | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState<string>('todos');
  const [filtroAno, setFiltroAno] = useState<string>('todos');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  /**
   * Lê o acervo da EMPRESA mais o legado pessoal ainda não migrado.
   * `.like('nome', 'ACT –%')` é o que separa atestado do resto do cofre.
   *
   * A dependência é o `user.id`, não o objeto `user`: o contexto entrega um
   * objeto novo a cada render, e com ele na lista o efeito se reagenda
   * sozinho — carga em laço, tela presa no esqueleto.
   */
  const userId = user?.id ?? null;
  const carregar = useCallback(async () => {
    if (!userId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErroCarga(null);
    /* O atestado é da EMPRESA desde 14/09/2026, por decisão do dono do produto:
       ele é emitido por órgão ou contratante, assinado por representante, e
       integra a habilitação do certame — é da empresa que se habilita, não de
       quem digitalizou o papel.
       O `.or(...)` é a MESMA régua da aba Documentos: a linha da empresa vem
       para todo mundo, e o legado pessoal continua aparecendo para o dono
       enquanto a migração de vínculo não alcançar todos. Trocar por
       `eq('empresa_id')` puro esconderia hoje o que ainda não foi convertido. */
    /* `as never` na tabela: o `types.ts` gerado está congelado em 16/08 e não
       conhece `documentos.empresa_id`, que existe desde 03/09 — sem o escape o
       TypeScript recusa a coluna que o banco tem. É o mesmo escape que o resto
       do módulo usa, e sai quando os tipos forem regerados. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let consulta: any = (supabase.from('documentos' as never) as any)
      .select('id, nome, segmento, validade, arquivo_path, tamanho_bytes, dados_extraidos, user_id, empresa_id')
      .like('nome', FILTRO_NOME_ACT)
      .order('created_at', { ascending: false });
    consulta = idEmpresa
      ? consulta.or(`empresa_id.eq.${idEmpresa},and(user_id.eq.${userId},empresa_id.is.null)`)
      : consulta.eq('user_id', userId);
    const { data, error } = await consulta;

    // Falha silenciosa é proibida (princípio 3): o `error` era descartado e a
    // tela dizia "nenhum atestado cadastrado" quando o banco tinha recusado.
    if (error) {
      setErroCarga(error.message);
      setCarregando(false);
      return;
    }

    setDocs(
      (data ?? []).map((d) => ({
        ...d,
        segmento: d.segmento || SEGMENTO_PADRAO,
        dados_extraidos: (d.dados_extraidos ?? undefined) as DadosAtestado | undefined,
      })),
    );
    setCarregando(false);
    /* Sem `idEmpresa` na lista, trocar de empresa deixava na tela os atestados
       da anterior — a consulta só rodava de novo ao recarregar a página. */
  }, [userId, idEmpresa]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Contagens e opções de filtro, sempre derivadas dos dados ──────────────
  const contagemPorSegmento = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const doc of docs) mapa.set(doc.segmento, (mapa.get(doc.segmento) ?? 0) + 1);
    return mapa;
  }, [docs]);

  /* Quantos ainda são do legado pessoal. Derivado dos dados, nunca fixo: é o
     que faz o aviso desaparecer no instante em que a migração roda. */
  const legadoPessoal = useMemo(() => docs.filter((d) => !d.empresa_id).length, [docs]);

  const segmentosComAtestado = useMemo(
    () => SEGMENTOS_ACT.filter((s) => (contagemPorSegmento.get(s.value) ?? 0) > 0).length,
    [contagemPorSegmento],
  );

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>();
    for (const doc of docs) {
      const ano = anoDe(doc);
      if (ano) anos.add(ano);
    }
    return [...anos].sort((a, b) => b.localeCompare(a, 'pt-BR'));
  }, [docs]);

  const temAtestadoSemAno = useMemo(() => docs.some((d) => !anoDe(d)), [docs]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return docs.filter((doc) => {
      if (filtroSegmento !== 'todos' && doc.segmento !== filtroSegmento) return false;

      if (filtroAno !== 'todos') {
        const ano = anoDe(doc);
        if (filtroAno === 'sem-ano' ? Boolean(ano) : ano !== filtroAno) return false;
      }

      if (termo) {
        // Objeto e órgão são o que a barra promete; segmento e período entram
        // de carona porque já eram buscáveis antes — tirar seria perder função.
        const alvo = [
          doc.dados_extraidos?.objeto,
          doc.dados_extraidos?.orgao_emissor,
          doc.dados_extraidos?.periodo,
          segmentoDe(doc.segmento).label,
        ].join(' ').toLowerCase();
        if (!alvo.includes(termo)) return false;
      }

      return true;
    });
  }, [docs, filtroSegmento, filtroAno, busca]);

  const selecionado = useMemo(
    () => filtrados.find((d) => d.id === selecionadoId) ?? null,
    [filtrados, selecionadoId],
  );

  const filtrosAplicados =
    (busca.trim() ? 1 : 0) + (filtroSegmento !== 'todos' ? 1 : 0) + (filtroAno !== 'todos' ? 1 : 0);

  const limparFiltros = () => {
    setBusca('');
    setFiltroSegmento('todos');
    setFiltroAno('todos');
  };

  // ── Envio ─────────────────────────────────────────────────────────────────
  const resetUploadDialog = () => {
    setSelectedSegmento('');
    setPendingFile(null);
    setExtractedData(undefined);
    setExtractionStatus('idle');
    setExtractionMessage('');
    setErroUpload(null);
    setFileInputKey((current) => current + 1);
  };

  const openUploadDialog = () => {
    resetUploadDialog();
    setUploadDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setUploadDialogOpen(open);
    if (!open) resetUploadDialog();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(f.type)) {
      toast.error('Use PDF, PNG, JPG ou WEBP.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Máximo 10MB.');
      return;
    }
    setPendingFile(f);
    setExtractedData(undefined);
    setExtractionStatus('idle');
    setExtractionMessage('');
    setErroUpload(null);
  };

  const handleAIExtract = async () => {
    if (!pendingFile || !selectedSegmento) return;
    setAnalyzing(true);
    setExtractionStatus('idle');
    setExtractionMessage('');

    try {
      const payload = await buildDocumentAnalysisPayload(pendingFile);

      if (payload.images.length === 0 && !payload.supportText.trim()) {
        throw new Error('Não foi possível preparar o documento para leitura.');
      }

      const { data: aiData, error: aiError } = await supabase.functions.invoke('extrair-atestado-capacidade', {
        body: {
          fileName: pendingFile.name,
          segmento: selectedSegmento,
          images: payload.images,
          text: payload.supportText,
        },
      });
      if (aiError) throw aiError;

      const parsed = aiData?.result ?? aiData ?? {};
      const nextData: DadosAtestado = {
        objeto: typeof parsed.objeto === 'string' ? parsed.objeto.trim() : '',
        orgao_emissor: typeof parsed.orgao_emissor === 'string' ? parsed.orgao_emissor.trim() : '',
        ano_fornecimento: typeof parsed.ano_fornecimento === 'string' ? parsed.ano_fornecimento.trim() : '',
        valor: typeof parsed.valor === 'string' ? parsed.valor.trim() : '',
        cnpj_contratante: typeof parsed.cnpj_contratante === 'string' ? parsed.cnpj_contratante.trim() : '',
        periodo: typeof parsed.periodo === 'string' ? parsed.periodo.trim() : '',
      };

      setExtractedData(nextData);

      if (nextData.objeto || nextData.orgao_emissor || nextData.ano_fornecimento) {
        setExtractionStatus('success');
        setExtractionMessage('Leitura concluída. Objeto, Cliente/Órgão e Ano foram validados para revisão.');
        toast.success('Dados do atestado extraídos com sucesso.');
      } else {
        setExtractionStatus('warning');
        setExtractionMessage('A leitura foi executada, mas nenhum campo principal foi encontrado com confiança suficiente.');
        toast.info('A IA não encontrou dados confiáveis. Revise e preencha manualmente se necessário.');
      }
    } catch (err) {
      console.error('ACT extraction error:', err);
      setExtractedData(createEmptyExtractedData());
      setExtractionStatus('error');
      setExtractionMessage(mensagemDoErro(err, 'A leitura do documento falhou nesta tentativa.'));
      toast.error(mensagemDoErro(err, 'Erro na extração do documento.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!user || !pendingFile || !selectedSegmento) return;
    setUploading(true);
    setErroUpload(null);

    try {
      const segLabel = segmentoDe(selectedSegmento).label;
      const ext = pendingFile.name.split('.').pop();
      /* Atestado novo nasce na pasta da EMPRESA — é lá que as policies de
         storage liberam a leitura para a equipe e para a montagem automática
         da pasta de habilitação. Sem empresa ativa cai na pasta pessoal, que é
         o único lugar em que o upload é permitido. */
      const path = idEmpresa
        ? `empresa/${idEmpresa}/act-${selectedSegmento}-${Date.now()}.${ext}`
        : `${user.id}/act-${selectedSegmento}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, pendingFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documentos').insert({
        user_id: user.id,
        empresa_id: idEmpresa,
        nome: nomeDoAtestado(selectedSegmento),
        tipo: 'Qualificação Técnica',
        descricao: extractedData?.objeto || `Atestado de Capacidade Técnica - ${segLabel}`,
        arquivo_path: path,
        validade: null, // ACTs de fornecimento não possuem validade
        tamanho_bytes: pendingFile.size,
        segmento: selectedSegmento,
        dados_extraidos: hasExtractedContent(extractedData) ? extractedData : null,
      });
      if (dbError) throw dbError;

      toast.success(`Atestado de "${segLabel}" adicionado!`);
      resetUploadDialog();
      setUploadDialogOpen(false);
      await carregar();
    } catch (err) {
      // Mensagem real do banco/storage, no diálogo, sem fechar o que foi
      // preenchido: o toast some em segundos e levava o motivo junto.
      const motivo = mensagemDoErro(err, 'Erro ao salvar atestado.');
      setErroUpload(motivo);
      toast.error(motivo);
    }
    setUploading(false);
  };

  // ── Edição do cadastro ────────────────────────────────────────────────────
  /**
   * As duas réguas são o espelho exato das policies de `documentos` — e elas
   * NÃO são a mesma:
   *
   *   `documentos_update_empresa`  dono OU qualquer membro da empresa
   *   `documentos_delete_empresa`  dono OU **admin** da empresa
   *
   * Corrigir o CNPJ de um contratante é rotina de equipe; apagar o atestado
   * tira da empresa uma prova de capacidade técnica que ela talvez não consiga
   * emitir de novo. Desenhar o botão com régua mais frouxa que a do banco só
   * troca a recusa clara por um erro no meio da ação.
   */
  const ehMembroDesteAtestado = (doc: ACTDoc) =>
    Boolean(doc.empresa_id && idEmpresa && doc.empresa_id === idEmpresa);
  const ehDono = (doc: ACTDoc) => Boolean(user && doc.user_id === user.id);
  const podeEditar = (doc: ACTDoc) => ehDono(doc) || ehMembroDesteAtestado(doc);
  const podeExcluir = (doc: ACTDoc) => ehDono(doc) || (ehMembroDesteAtestado(doc) && ehAdmin);

  const abrirEdicao = (doc: ACTDoc) => {
    setEmEdicao(doc);
    setEdicaoSegmento(doc.segmento);
    setEdicaoDados({ ...createEmptyExtractedData(), ...(doc.dados_extraidos ?? {}) });
    setErroEdicao(null);
  };

  const salvarEdicao = async () => {
    if (!emEdicao) return;
    setSalvandoEdicao(true);
    setErroEdicao(null);

    const segLabel = segmentoDe(edicaoSegmento).label;
    const dados = hasExtractedContent(edicaoDados) ? edicaoDados : null;

    // `select('id')` depois do update: sem ele, um UPDATE barrado pelo RLS
    // volta "sucesso" com zero linha afetada e a tela mente que salvou.
    const { data, error } = await supabase
      .from('documentos')
      .update({
        // O nome acompanha o segmento — e continua começando por `ACT – `.
        nome: nomeDoAtestado(edicaoSegmento),
        segmento: edicaoSegmento,
        descricao: edicaoDados.objeto?.trim() || `Atestado de Capacidade Técnica - ${segLabel}`,
        dados_extraidos: dados,
      })
      .eq('id', emEdicao.id)
      .select('id');

    if (error || !data?.length) {
      setErroEdicao(error?.message ?? 'Nenhuma linha foi alterada — sem permissão para este atestado.');
      setSalvandoEdicao(false);
      return;
    }

    toast.success('Cadastro do atestado atualizado.');
    setEmEdicao(null);
    setSalvandoEdicao(false);
    await carregar();
  };

  // ── Arquivo ───────────────────────────────────────────────────────────────
  const visualizar = async (doc: ACTDoc) => {
    if (!doc.arquivo_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.arquivo_path, 300);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || 'Não foi possível abrir o arquivo.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const baixar = async (doc: ACTDoc) => {
    if (!doc.arquivo_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).download(doc.arquivo_path);
    if (error || !data) {
      toast.error(error?.message || 'Erro ao baixar o arquivo.');
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeDoArquivo(doc.arquivo_path) || 'atestado';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const excluir = async (doc: ACTDoc) => {
    setRemovendoId(doc.id);
    try {
      if (doc.arquivo_path) {
        await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
      }
      const { error } = await supabase.from('documentos').delete().eq('id', doc.id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      if (selecionadoId === doc.id) setSelecionadoId(null);
      toast.success('Atestado removido.');
    } catch (err) {
      toast.error(mensagemDoErro(err, 'Erro ao remover o atestado.'));
    }
    setRemovendoId(null);
    setAExcluir(null);
  };

  // ── Colunas ───────────────────────────────────────────────────────────────
  const colunas: ColunaGestao<ACTDoc>[] = [
    {
      chave: 'objeto',
      titulo: 'Objeto',
      tituloCurto: 'Objeto',
      prioridade: 'sempre',
      render: (doc) => (
        <div className="flex min-w-0 flex-col gap-0.5" onClick={naoAbrirPainel}>
          {preenchido(doc.dados_extraidos?.objeto) ? (
            // Resumo na linha; o texto inteiro fica no painel, sem corte.
            <TextoExpansivel texto={doc.dados_extraidos!.objeto!} linhas={2} className="text-foreground" />
          ) : (
            <ValorIndisponivel razao="Objeto não cadastrado" />
          )}
          <span className="g-meta truncate text-muted-foreground">
            {preenchido(doc.dados_extraidos?.orgao_emissor)
              ? doc.dados_extraidos!.orgao_emissor
              : 'Órgão não informado'}
          </span>
        </div>
      ),
    },
    {
      chave: 'segmento',
      titulo: 'Segmento',
      prioridade: 'sempre',
      largura: '210px',
      render: (doc) => {
        const seg = segmentoDe(doc.segmento);
        return <SeloSituacao tom="neutro" icone={seg.icon}>{seg.label}</SeloSituacao>;
      },
    },
    {
      chave: 'ano',
      titulo: 'Ano / período',
      tituloCurto: 'Período',
      prioridade: 'sempre',
      largura: '190px',
      render: (doc) => {
        const ano = anoDe(doc);
        const periodo = doc.dados_extraidos?.periodo?.trim();
        if (!ano && !periodo) return <ValorIndisponivel razao="Sem data no cadastro" />;
        return (
          <span className="flex min-w-0 flex-col">
            {ano && <span className="tabular-nums text-foreground">{ano}</span>}
            {/* O período era extraído pela IA e nunca chegava à tela. */}
            {periodo && <span className="g-meta truncate text-muted-foreground" title={periodo}>{periodo}</span>}
          </span>
        );
      },
    },
    {
      chave: 'arquivo',
      titulo: 'Arquivo',
      prioridade: 'sempre',
      largura: '170px',
      render: (doc) =>
        doc.arquivo_path ? (
          // "Anexado" é afirmação sobre o ARQUIVO: só com arquivo associado.
          <SeloSituacao tom="sucesso" icone={Paperclip} explicacao={nomeDoArquivo(doc.arquivo_path)}>
            Anexado
          </SeloSituacao>
        ) : (
          <SeloSituacao
            tom="atencao"
            icone={AlertTriangle}
            explicacao="A linha existe no cofre, mas nenhum arquivo foi associado a ela."
          >
            Sem arquivo
          </SeloSituacao>
        ),
    },
    {
      chave: 'acoes',
      titulo: <span className="sr-only">Ações</span>,
      alinhamento: 'direita',
      prioridade: 'desktop',
      largura: '120px',
      render: (doc) => (
        <div className="flex items-center justify-end gap-1" onClick={naoAbrirPainel}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => baixar(doc)}
            disabled={!doc.arquivo_path}
            title={doc.arquivo_path ? 'Baixar arquivo' : 'Este atestado não tem arquivo anexado'}
            aria-label={`Baixar o atestado de ${segmentoDe(doc.segmento).label}`}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Mais ações do atestado de ${segmentoDe(doc.segmento).label}`}
              >
                <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => visualizar(doc)} disabled={!doc.arquivo_path}>
                <Eye aria-hidden="true" className="mr-2 h-4 w-4" /> Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => baixar(doc)} disabled={!doc.arquivo_path}>
                <Download aria-hidden="true" className="mr-2 h-4 w-4" /> Baixar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => abrirEdicao(doc)} disabled={!podeEditar(doc)}>
                <Pencil aria-hidden="true" className="mr-2 h-4 w-4" /> Editar cadastro
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setAExcluir(doc)}
                disabled={!podeExcluir(doc)}
                className="text-destructive-ink focus:text-destructive-ink"
              >
                <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const total = docs.length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cabeçalho da aba ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="g-titulo-secao flex flex-wrap items-center gap-2 text-foreground">
            <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
            Atestados de capacidade técnica
            <SeloSituacao tom="neutro" icone={FileText} explicacao="Qualificação técnica — Lei 14.133/2021">
              Art. 67
            </SeloSituacao>
          </h2>
          <p className="mt-1 g-corpo text-muted-foreground">
            <span className="tabular-nums">{total}</span> atestado{total !== 1 ? 's' : ''}
            {' · '}
            <span className="tabular-nums">{segmentosComAtestado}</span> segmento{segmentosComAtestado !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openUploadDialog} className="g-controle rounded-[var(--g-raio)] max-sm:w-full">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Adicionar atestado
        </Button>
      </div>

      {/* ── Duas verdades que a tela precisa dizer ─────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="g-meta flex items-start gap-2 text-muted-foreground">
          <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          {NOTA_SEM_ANALISE} A conferência do que cada edital exige continua sendo leitura humana.
        </p>
        {/*
          O aviso é CONDICIONAL, e some sozinho: aparece só enquanto houver
          atestado gravado antes de 14/09/2026, quando a tela ainda os prendia
          à conta de quem subiu o arquivo. Enquanto ele estiver na tela, há
          atestado que o colega não vê e que a montagem automática da pasta de
          habilitação não consegue baixar. Aviso fixo dizendo "são pessoais"
          seria mentira depois da migração — e ninguém confere um aviso que
          está sempre lá.
        */}
        {legadoPessoal > 0 && (
          <p role="note" className="g-meta flex items-start gap-2 rounded-[var(--g-raio)] border border-border bg-muted px-3 py-2 text-muted-foreground">
            <Lock aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              {legadoPessoal === 1
                ? '1 atestado ainda está ligado à sua conta'
                : `${legadoPessoal} atestados ainda estão ligados à sua conta`}
              , e não à empresa — são de antes de os atestados passarem a ser do acervo da
              empresa. Colegas não os veem, e a montagem automática da pasta de habilitação não
              consegue baixar o arquivo. Os novos já nascem da empresa.
            </span>
          </p>
        )}
      </div>

      {erroCarga && (
        <AvisoDeFalha aoTentarNovamente={carregar}>
          Não foi possível carregar os atestados: {erroCarga}
        </AvisoDeFalha>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <BarraFiltros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por objeto ou órgão…"
        filtrosAplicados={filtrosAplicados}
        aoLimpar={limparFiltros}
      >
        {/* Chips de segmento — contagem SEMPRE calculada dos dados. Os nove
            segmentos aparecem mesmo zerados: "Medicamentos (0)" é informação
            de qualificação técnica (não há o que provar naquele ramo), não
            uma linha vazia a esconder. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltroSegmento('todos')}
            aria-pressed={filtroSegmento === 'todos'}
            className={cn(
              'g-controle inline-flex items-center gap-1.5 rounded-full border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              filtroSegmento === 'todos'
                ? 'border-primary bg-primary-tint font-semibold text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Todos <span className="tabular-nums">({total})</span>
          </button>
          {SEGMENTOS_ACT.map((seg) => {
            const quantos = contagemPorSegmento.get(seg.value) ?? 0;
            const ativo = filtroSegmento === seg.value;
            const Icone = seg.icon;
            return (
              <button
                key={seg.value}
                type="button"
                onClick={() => setFiltroSegmento(seg.value)}
                aria-pressed={ativo}
                className={cn(
                  'g-controle inline-flex items-center gap-1.5 rounded-full border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  ativo
                    ? 'border-primary bg-primary-tint font-semibold text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                  quantos === 0 && !ativo && 'opacity-60',
                )}
              >
                <Icone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                {seg.label} <span className="tabular-nums">({quantos})</span>
              </button>
            );
          })}
        </div>

        {/* Rótulo visível: depois de escolher "2024", o controle sozinho não
            diz mais o que está filtrando. */}
        <div className="flex items-center gap-2">
          <Label htmlFor="act-filtro-ano" className="g-corpo whitespace-nowrap text-muted-foreground">
            Ano / período
          </Label>
          <Select value={filtroAno} onValueChange={setFiltroAno}>
            <SelectTrigger id="act-filtro-ano" className="g-controle w-44 rounded-[var(--g-raio)]">
              <SelectValue placeholder="Todos os anos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {anosDisponiveis.map((ano) => (
                <SelectItem key={ano} value={ano}>{ano}</SelectItem>
              ))}
              {temAtestadoSemAno && <SelectItem value="sem-ano">Sem ano informado</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </BarraFiltros>

      {/* ── Tabela + painel ───────────────────────────────────────────────── */}
      <AreaComPainel
        painel={
          selecionado && (
            <PainelAtestado
              key={selecionado.id}
              doc={selecionado}
              podeEditar={podeEditar(selecionado)}
              podeExcluir={podeExcluir(selecionado)}
              aoVisualizar={() => visualizar(selecionado)}
              aoBaixar={() => baixar(selecionado)}
              aoEditar={() => abrirEdicao(selecionado)}
              aoExcluir={() => setAExcluir(selecionado)}
            />
          )
        }
        tituloPainel={
          selecionado ? `Atestado — ${segmentoDe(selecionado.segmento).label}` : 'Detalhes do atestado'
        }
        aoFechar={() => setSelecionadoId(null)}
      >
        <TabelaGestao
          descricao="Atestados de capacidade técnica cadastrados"
          colunas={colunas}
          itens={filtrados}
          chaveDoItem={(doc) => doc.id}
          carregando={carregando}
          aoSelecionar={(doc) => setSelecionadoId((atual) => (atual === doc.id ? null : doc.id))}
          selecionado={(doc) => doc.id === selecionadoId}
          rodape={
            filtrados.length > 0 ? (
              <span className="tabular-nums">
                {filtrados.length} de {total} atestado{total !== 1 ? 's' : ''}
              </span>
            ) : undefined
          }
          vazio={
            erroCarga ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<AlertTriangle />}
                titulo="Os atestados não puderam ser carregados"
                descricao="O aviso acima traz a mensagem do banco e o botão para tentar de novo."
              />
            ) : (
              <EstadoVazio
                tamanho="compacto"
                icone={<FileText />}
                titulo={total === 0 ? 'Nenhum atestado cadastrado' : 'Nenhum atestado para este filtro'}
                descricao={
                  total === 0
                    ? 'O atestado prova o que a empresa já forneceu — é ele que a qualificação técnica do art. 67 pede.'
                    : 'Ajuste a busca, troque o segmento ou escolha outro ano.'
                }
                acao={
                  total === 0 ? (
                    <Button variant="outline" onClick={openUploadDialog}>
                      <Plus aria-hidden="true" className="h-4 w-4" /> Adicionar primeiro atestado
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={limparFiltros}>Limpar filtros</Button>
                  )
                }
              />
            )
          }
        />
      </AreaComPainel>

      {/* ── Diálogo de envio ──────────────────────────────────────────────── */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
              Adicionar atestado de capacidade técnica
            </DialogTitle>
            <DialogDescription>{NOTA_SEM_ANALISE}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="act-segmento" className="g-corpo font-medium">Segmento</Label>
              <Select value={selectedSegmento} onValueChange={setSelectedSegmento}>
                <SelectTrigger id="act-segmento" className="g-controle rounded-[var(--g-raio)]">
                  <SelectValue placeholder="Selecione o segmento do atestado" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_ACT.map((seg) => {
                    const Icone = seg.icon;
                    return (
                      <SelectItem key={seg.value} value={seg.value}>
                        <span className="flex items-center gap-2">
                          <Icone aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                          <span className="g-corpo">{seg.label}</span>
                          <span className="g-meta text-muted-foreground">– {seg.sublabel}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="act-arquivo" className="g-corpo font-medium">Arquivo (PDF/PNG/JPG)</Label>
              <Input
                id="act-arquivo"
                key={fileInputKey}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="g-controle rounded-[var(--g-raio)]"
              />

              {pendingFile && (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--g-raio)] border border-border bg-muted px-3 py-2">
                  <div className="min-w-0">
                    <p className="g-corpo truncate font-medium text-foreground">{pendingFile.name}</p>
                    <p className="g-meta text-muted-foreground">
                      {pendingFile.type === 'application/pdf' ? 'PDF' : 'Imagem'} • {formatFileSize(pendingFile.size)}
                    </p>
                  </div>
                  <SeloSituacao tom="neutro" icone={Paperclip}>Arquivo selecionado</SeloSituacao>
                </div>
              )}
            </div>

            {pendingFile && selectedSegmento && (
              <Button
                variant="outline"
                className="g-controle w-full rounded-[var(--g-raio)]"
                onClick={handleAIExtract}
                disabled={analyzing}
              >
                {analyzing
                  ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  : <Bot aria-hidden="true" className="h-4 w-4" />}
                {analyzing ? 'Extraindo dados com IA…' : 'Extrair dados com IA'}
              </Button>
            )}

            {extractionStatus !== 'idle' && (
              <Alert
                variant={
                  extractionStatus === 'success' ? 'success'
                    : extractionStatus === 'warning' ? 'warning'
                      : 'destructive'
                }
              >
                {extractionStatus === 'success'
                  ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
                <AlertDescription>{extractionMessage}</AlertDescription>
              </Alert>
            )}

            {/* Os campos existem mesmo sem passar pela IA: a extração PREENCHE
                o formulário, não é a única porta para ele. Antes, quem não
                rodasse a leitura (ou tivesse uma leitura sem resultado) gravava
                o arquivo sem objeto, órgão, ano nem período — e o atestado
                ficava mudo na hora de procurar por segmento ou por ano. */}
            {pendingFile && selectedSegmento && (
              <div className="flex flex-col gap-4 rounded-[var(--g-raio)] border border-border bg-muted p-4">
                <p className="g-corpo flex items-center gap-2 font-semibold text-foreground">
                  <Bot aria-hidden="true" className="h-4 w-4" />
                  {/* O título fala da LEITURA, não do preenchimento: chamar de
                      "dados da IA" o que a pessoa digitou seria atribuir à
                      máquina uma informação que ela não produziu. */}
                  {extractionStatus === 'success'
                    ? 'Dados lidos pela IA — confira antes de enviar'
                    : 'Dados do atestado'}
                </p>
                {extractionStatus !== 'success' && (
                  <p className="g-meta text-muted-foreground">
                    Preencha o que souber ou use a leitura por IA acima. Nada aqui é obrigatório,
                    mas é por estes campos que o atestado é encontrado depois.
                  </p>
                )}
                <CamposDoAtestado
                  prefixo="act"
                  dados={extractedData ?? createEmptyExtractedData()}
                  aoMudar={(patch) => setExtractedData((prev) => ({ ...(prev ?? createEmptyExtractedData()), ...patch }))}
                />
              </div>
            )}

            {erroUpload && (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                <AlertDescription>{erroUpload}</AlertDescription>
              </Alert>
            )}

            <p className="g-meta text-muted-foreground">
              Atestados de capacidade técnica para fornecimento não possuem validade e permanecem
              válidos permanentemente.
            </p>
          </div>

          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading || !pendingFile || !selectedSegmento}>
              {uploading
                ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                : <Upload aria-hidden="true" className="h-4 w-4" />}
              {uploading ? 'Enviando atestado…' : 'Enviar atestado'}
            </Button>
          </DialogFooter>
          {uploading && (
            <p role="status" aria-live="polite" className="g-meta text-muted-foreground">
              Enviando o arquivo e gravando o cadastro…
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de edição ─────────────────────────────────────────────── */}
      <Dialog open={Boolean(emEdicao)} onOpenChange={(aberto) => !aberto && setEmEdicao(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
              Editar cadastro do atestado
            </DialogTitle>
            <DialogDescription>
              O arquivo anexado não muda aqui — só o que foi cadastrado sobre ele.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="act-edit-segmento" className="g-corpo font-medium">Segmento</Label>
              <Select value={edicaoSegmento} onValueChange={setEdicaoSegmento}>
                <SelectTrigger id="act-edit-segmento" className="g-controle rounded-[var(--g-raio)]">
                  <SelectValue placeholder="Selecione o segmento do atestado" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_ACT.map((seg) => (
                    <SelectItem key={seg.value} value={seg.value}>{seg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CamposDoAtestado
              prefixo="act-edit"
              dados={edicaoDados}
              aoMudar={(patch) => setEdicaoDados((prev) => ({ ...prev, ...patch }))}
            />

            {erroEdicao && (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                <AlertDescription>{erroEdicao}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setEmEdicao(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={salvandoEdicao || !edicaoSegmento}>
              {salvandoEdicao && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              Salvar cadastro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de exclusão ───────────────────────────────────────── */}
      <AlertDialog open={Boolean(aExcluir)} onOpenChange={(aberto) => !aberto && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este atestado?</AlertDialogTitle>
            <AlertDialogDescription>
              {aExcluir && (
                <>
                  O cadastro do atestado de <strong>{segmentoDe(aExcluir.segmento).label}</strong>
                  {preenchido(aExcluir.dados_extraidos?.orgao_emissor)
                    ? ` (${aExcluir.dados_extraidos!.orgao_emissor})`
                    : ''}
                  {' '}sai do cofre{aExcluir.arquivo_path ? ', junto com o arquivo anexado' : ''}. A ação
                  não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                // O Radix fecha no clique; a remoção precisa do estado vivo
                // enquanto o `await` roda, então o fechamento é nosso.
                e.preventDefault();
                if (aExcluir) excluir(aExcluir);
              }}
              disabled={Boolean(removendoId)}
            >
              {removendoId ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              Excluir atestado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Os campos do atestado, iguais no envio e na edição.
 *
 * O `periodo` tem campo próprio aqui — antes ele era extraído pela IA, gravado
 * no banco e não tinha nem onde ser corrigido, quanto mais onde ser lido.
 */
function CamposDoAtestado({
  prefixo,
  dados,
  aoMudar,
}: {
  prefixo: string;
  dados: DadosAtestado;
  aoMudar: (patch: Partial<DadosAtestado>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefixo}-objeto`} className="g-corpo">Objeto</Label>
        <Textarea
          id={`${prefixo}-objeto`}
          value={dados.objeto || ''}
          onChange={(e) => aoMudar({ objeto: e.target.value })}
          rows={3}
          placeholder="Descrição do objeto atestado"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefixo}-orgao`} className="g-corpo">Cliente / órgão contratante</Label>
        <Input
          id={`${prefixo}-orgao`}
          className="g-controle rounded-[var(--g-raio)]"
          value={dados.orgao_emissor || ''}
          onChange={(e) => aoMudar({ orgao_emissor: e.target.value })}
          placeholder="Órgão público ou empresa contratante"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefixo}-ano`} className="g-corpo">Ano do fornecimento</Label>
          <Input
            id={`${prefixo}-ano`}
            className="g-controle rounded-[var(--g-raio)] tabular-nums"
            value={dados.ano_fornecimento || ''}
            onChange={(e) => aoMudar({ ano_fornecimento: e.target.value })}
            placeholder="Ex: 2024"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefixo}-periodo`} className="g-corpo">Período do fornecimento</Label>
          <Input
            id={`${prefixo}-periodo`}
            className="g-controle rounded-[var(--g-raio)]"
            value={dados.periodo || ''}
            onChange={(e) => aoMudar({ periodo: e.target.value })}
            placeholder="Ex: jan/2023 a dez/2024"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefixo}-valor`} className="g-corpo">Valor</Label>
          <Input
            id={`${prefixo}-valor`}
            className="g-controle rounded-[var(--g-raio)] tabular-nums"
            value={dados.valor || ''}
            onChange={(e) => aoMudar({ valor: e.target.value })}
            placeholder="Valor contratual"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefixo}-cnpj`} className="g-corpo">CNPJ contratante</Label>
          <Input
            id={`${prefixo}-cnpj`}
            className="g-controle rounded-[var(--g-raio)] tabular-nums"
            value={dados.cnpj_contratante || ''}
            onChange={(e) => aoMudar({ cnpj_contratante: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * O detalhe do atestado — onde o objeto aparece INTEIRO.
 *
 * A linha da tabela mostra resumo (duas linhas); quem precisa conferir se o
 * objeto cobre o que o edital pede lê aqui, sem truncamento e sem clique
 * adicional. Campo sem valor aparece como "Não informado" em vez de sumir: a
 * lacuna do cadastro é justamente o que o botão "Editar cadastro" resolve.
 */
function PainelAtestado({
  doc,
  podeEditar,
  podeExcluir,
  aoVisualizar,
  aoBaixar,
  aoEditar,
  aoExcluir,
}: {
  doc: ACTDoc;
  podeEditar: boolean;
  podeExcluir: boolean;
  aoVisualizar: () => void;
  aoBaixar: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const seg = segmentoDe(doc.segmento);
  const objeto = doc.dados_extraidos?.objeto?.trim();
  const naoInformado = <span className="g-corpo text-muted-foreground">Não informado</span>;

  const campos: Campo[] = [
    { rotulo: 'Segmento', valor: seg.label },
    {
      rotulo: 'Cliente / órgão',
      valor: preenchido(doc.dados_extraidos?.orgao_emissor)
        ? doc.dados_extraidos!.orgao_emissor
        : naoInformado,
      largo: true,
    },
    {
      rotulo: 'Ano do fornecimento',
      valor: preenchido(doc.dados_extraidos?.ano_fornecimento)
        ? doc.dados_extraidos!.ano_fornecimento
        : naoInformado,
      numerico: true,
    },
    {
      rotulo: 'Período',
      valor: preenchido(doc.dados_extraidos?.periodo) ? doc.dados_extraidos!.periodo : naoInformado,
    },
    {
      // "quando cadastrado": sem valor cadastrado não se escreve R$ 0,00 —
      // zero é afirmação sobre o contrato, ausência é sobre o cadastro.
      rotulo: 'Valor',
      valor: preenchido(doc.dados_extraidos?.valor) ? doc.dados_extraidos!.valor : naoInformado,
      numerico: true,
    },
    {
      rotulo: 'CNPJ contratante',
      valor: preenchido(doc.dados_extraidos?.cnpj_contratante)
        ? doc.dados_extraidos!.cnpj_contratante
        : naoInformado,
      numerico: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeloSituacao tom="neutro" icone={seg.icon}>{seg.label}</SeloSituacao>
        {doc.arquivo_path ? (
          <SeloSituacao tom="sucesso" icone={Paperclip}>Anexado</SeloSituacao>
        ) : (
          <SeloSituacao tom="atencao" icone={AlertTriangle}>Sem arquivo</SeloSituacao>
        )}
      </div>

      <BlocoDoPainel titulo="Objeto atestado">
        {objeto ? (
          <p className="g-corpo whitespace-pre-wrap break-words text-foreground">{objeto}</p>
        ) : (
          <ValorIndisponivel razao="Objeto não cadastrado" />
        )}
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Fornecimento">
        <ListaDeCampos campos={campos} />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Arquivo">
        {doc.arquivo_path ? (
          <div className="flex flex-col gap-2">
            <p className="g-corpo flex items-start gap-2 break-all text-foreground">
              <Paperclip aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              {nomeDoArquivo(doc.arquivo_path)}
            </p>
            <p className="g-meta text-muted-foreground">
              {typeof doc.tamanho_bytes === 'number' && doc.tamanho_bytes > 0
                ? formatFileSize(doc.tamanho_bytes)
                : 'Tamanho não registrado no cadastro'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={aoVisualizar} className="g-controle rounded-[var(--g-raio)]">
                <Eye aria-hidden="true" className="h-4 w-4" /> Visualizar
              </Button>
              <Button variant="outline" onClick={aoBaixar} className="g-controle rounded-[var(--g-raio)]">
                <Download aria-hidden="true" className="h-4 w-4" /> Baixar
              </Button>
            </div>
          </div>
        ) : (
          <p className="g-corpo text-muted-foreground">
            Nenhum arquivo anexado a este cadastro — não há o que visualizar ou baixar.
          </p>
        )}
      </BlocoDoPainel>

      <p className="g-meta flex items-start gap-2 text-muted-foreground">
        <CalendarDays aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
        Atestado de fornecimento não tem validade. {NOTA_SEM_ANALISE}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={aoEditar}
          disabled={!podeEditar}
          title={podeEditar ? undefined : 'Este atestado pertence a outra empresa.'}
          className="g-controle rounded-[var(--g-raio)]"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" /> Editar cadastro
        </Button>
        <Button
          variant="outline"
          onClick={aoExcluir}
          disabled={!podeExcluir}
          title={podeExcluir ? undefined : 'Excluir atestado da empresa é ação de administrador.'}
          className="g-controle rounded-[var(--g-raio)] text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" /> Excluir
        </Button>
      </div>
    </div>
  );
}
