import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText, Sparkles, Loader2, Copy, CheckCircle, Settings2,
  ChevronRight, ChevronLeft, Building2, User, Receipt, Scale,
  Send, Calendar, MapPin, Clock, CreditCard,
  Eye, AlertCircle, Banknote, X,
  PanelRightOpen, PanelRightClose
, FolderOpen, ArrowRight } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { toast } from 'sonner';
import { valorPorExtenso } from '@/lib/numero-extenso';
import EditalUploader, { type ExtractedEditalData, type EditalItem } from '@/components/proposta/EditalUploader';
import ReextrairEditalButton from '@/components/shared/ReextrairEditalButton';
import LimparItensExtraidosButton from '@/components/licitacoes/LimparItensExtraidosButton';
import PlanilhaPrecos from '@/components/proposta/PlanilhaPrecos';
import { Link } from 'react-router-dom';
import EnvioProposta from '@/components/proposta/EnvioProposta';
import PropostaDownload from '@/components/proposta/PropostaDownload';
import PropostaRenderer from '@/components/proposta/PropostaRenderer';
import PropostaLivePreview from '@/components/proposta/PropostaLivePreview';
import BancoSelector from '@/components/proposta/BancoSelector';
import ImportarDoCatalogo from '@/components/proposta/ImportarDoCatalogo';

import { useIsMobile } from '@/hooks/use-mobile';
import { useRascunho } from '@/hooks/useRascunho';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';

const STEPS = [
  { id: 1, label: 'Edital', icon: FileText, desc: 'Upload e extração IA' },
  { id: 2, label: 'Empresa', icon: Building2, desc: 'Dados cadastrais' },
  { id: 3, label: 'Representante', icon: User, desc: 'Dados pessoais' },
  { id: 4, label: 'Licitação', icon: Receipt, desc: 'Dados do processo' },
  { id: 5, label: 'Planilha', icon: CreditCard, desc: 'Preços e itens' },
  { id: 6, label: 'Declarações', icon: Scale, desc: 'Obrigatórias' },
  { id: 7, label: 'Formatação', icon: Settings2, desc: 'Layout e marca' },
  { id: 8, label: 'Gerar', icon: Sparkles, desc: 'Proposta final' },
];

const DECLARACOES_PADRAO = [
  { key: 'meEpp', label: 'Declaração de ME/EPP ou equiparada', base: 'LC 123/2006 c/c Lei 14.133/2021, Art. 4º, §2º' },
  { key: 'inexistenciaFato', label: 'Inexistência de fato impeditivo à habilitação', base: 'Lei 14.133/2021, Art. 63, §1º' },
  { key: 'menorAprendiz', label: 'Não emprego de menor de 18 anos em trabalho noturno, perigoso ou insalubre', base: 'Lei 14.133/2021, Art. 68, VI' },
  { key: 'elaboracaoIndep', label: 'Elaboração independente de proposta', base: 'IN nº 01/2009 — MPOG' },
  { key: 'reservadoMeEpp', label: 'Ciência de itens exclusivos/reservados para ME/EPP', base: 'LC 123/2006, Art. 48' },
  { key: 'responsabilidade', label: 'Nos preços estão inclusos frete, tributos e encargos', base: 'Lei 14.133/2021, Art. 12, §3º' },
  { key: 'conformidade', label: 'Os produtos/serviços atendem às normas técnicas vigentes', base: 'Lei 14.133/2021, Art. 41' },
  { key: 'idoneidade', label: 'Declaração de idoneidade financeira e técnica', base: 'Lei 14.133/2021, Art. 62' },
];

export default function PropostaTecnica({ embedded = false, licitacaoIdEmbed }: { embedded?: boolean; licitacaoIdEmbed?: string } = {}) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const { pendingItems, clearPending, hasPending } = usePropostaCart();
  const { processoId, setProcessoId, ensureProcesso, processo } = useProcessoAtivo();

  // Modo embutido (aba Proposta do prontuário): o processo aberto É o processo
  // ativo — fixa o lid para o wizard carregar este certame, não o último usado.
  useEffect(() => {
    if (embedded && licitacaoIdEmbed && processoId !== licitacaoIdEmbed) {
      setProcessoId(licitacaoIdEmbed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, licitacaoIdEmbed]);
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [proposal, setProposal] = useState('');
  // Espelho da pasta Proposta (aba Anexos): a aba e a pasta são o mesmo
  // trabalho visto de dois lugares — quem edita aqui precisa ver o que já
  // está arquivado lá, e vice-versa.
  const [naPasta, setNaPasta] = useState<{ nome: string; em: string } | null>(null);
  const [nonceArquivo, setNonceArquivo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(!isMobile);
  const resultRef = useRef<HTMLDivElement>(null);

  // Timbrado – centralizado em Configurações Gerais
  const timbradoUrl = empresaAtiva?.timbrado_url ?? null;
  const [usarMarcaDagua, setUsarMarcaDagua] = useState(true);

  // Form fields
  const [numeroLicitacao, setNumeroLicitacao] = useState('');
  // Ano do certame — compõe "PREGÃO ELETRÔNICO Nº 87/2026", que é como o edital
  // se identifica. Vem do encerramento do processo, o dado mais próximo do
  // exercício; sem processo vinculado, a referência sai sem ano em vez de
  // arriscar um errado.
  const [anoDoCertame, setAnoDoCertame] = useState<number | null>(null);
  // Transcritos da capa do edital pela leitura automática. Têm precedência
  // sobre a montagem a partir de modalidade e número: o certame se chama como o
  // órgão o nomeou, e reconstruir é aproximação.
  const [identificacaoEdital, setIdentificacaoEdital] = useState('');
  const [processoAdministrativo, setProcessoAdministrativo] = useState('');

  useEffect(() => {
    const fim = (processo as { data_encerramento?: string | null } | null)?.data_encerramento;
    setAnoDoCertame(fim ? new Date(fim).getFullYear() : null);
  }, [processo]);
  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('Pregão Eletrônico');
  const [objeto, setObjeto] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [prazoValidade, setPrazoValidade] = useState('60 dias corridos');
  const [prazoPagamento, setPrazoPagamento] = useState('Até 30 dias após recebimento definitivo e apresentação da Nota Fiscal');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [localEntrega, setLocalEntrega] = useState('');
  const [liquidacaoNfe, setLiquidacaoNfe] = useState('');
  const [garantia, setGarantia] = useState('');
  const [condicoesEntrega, setCondicoesEntrega] = useState('');
  const [editalRawText, setEditalRawText] = useState('');

  // Planilha de preços
  const [itens, setItens] = useState<EditalItem[]>([
    { item: '1', descricao: '', quantidade: '', unidade: 'UN', marca: '', fabricante: '', modelo: '', valorUnitario: '', valorUnitarioExtenso: '', valorTotal: '', valorTotalExtenso: '' },
  ]);

  // Representante Legal
  const [repNome, setRepNome] = useState('');
  const [repCpf, setRepCpf] = useState('');
  const [repRg, setRepRg] = useState('');
  const [repOrgaoExp, setRepOrgaoExp] = useState('');
  const [repCargo, setRepCargo] = useState('');
  const [repNaturalidade, setRepNaturalidade] = useState('');
  const [repNacionalidade, setRepNacionalidade] = useState('Brasileira');
  const [repEstadoCivil, setRepEstadoCivil] = useState('');
  const [repEndereco, setRepEndereco] = useState('');

  // Dados bancários
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [tipoConta, setTipoConta] = useState('Conta Corrente');
  const [pix, setPix] = useState('');

  // Empresa extras
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [inscEstadual, setInscEstadual] = useState('');
  const [inscMunicipal, setInscMunicipal] = useState('');

  // Declarações
  const [declaracoes, setDeclaracoes] = useState<Record<string, boolean>>(
    Object.fromEntries(DECLARACOES_PADRAO.map(d => [d.key, true]))
  );
  const [declaracoesCustom, setDeclaracoesCustom] = useState<string[]>([]);

  // Formatting options
  const [fontFamily, setFontFamily] = useState('Times New Roman');
  const [fontSize, setFontSize] = useState(12);
  const [lineSpacing, setLineSpacing] = useState('1.5');
  const [marginStyle, setMarginStyle] = useState('ABNT (3/2 cm)');
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // ── Rascunho (Draft) ──
  const { loadRascunho, autoSave, saving, lastSaved, markLoaded, deleteRascunho, rascunhoId } = useRascunho<any>({
    modulo: 'proposta',
    licitacaoId: processoId || null,
    debounceMs: 3000,
  });

  // Collect all form state into a saveable object
  const collectFormData = useCallback(() => ({
    numeroLicitacao, orgao, modalidade, objeto, valorEstimado,
    prazoValidade, prazoPagamento, prazoEntrega, localEntrega, liquidacaoNfe,
    editalRawText, itens, repNome, repCpf, repRg, repOrgaoExp, repCargo,
    repNaturalidade, repNacionalidade, repEstadoCivil, repEndereco,
    banco, agencia, conta, tipoConta, pix, telefone, email,
    inscEstadual, inscMunicipal, declaracoes, declaracoesCustom,
    fontFamily, fontSize, lineSpacing, marginStyle, pageOrientation, currentStep,
    timbradoUrl, usarMarcaDagua,
  }), [
    numeroLicitacao, orgao, modalidade, objeto, valorEstimado,
    prazoValidade, prazoPagamento, prazoEntrega, localEntrega, liquidacaoNfe,
    editalRawText, itens, repNome, repCpf, repRg, repOrgaoExp, repCargo,
    repNaturalidade, repNacionalidade, repEstadoCivil, repEndereco,
    banco, agencia, conta, tipoConta, pix, telefone, email,
    inscEstadual, inscMunicipal, declaracoes, declaracoesCustom,
    fontFamily, fontSize, lineSpacing, marginStyle, pageOrientation, currentStep,
    timbradoUrl, usarMarcaDagua,
  ]);

  // Load draft and catalog items when process changes
  useEffect(() => {
    setProposal('');
    loadRascunho().then(data => {
      if (data) {
        if (data.numeroLicitacao) setNumeroLicitacao(data.numeroLicitacao);
        if (data.orgao) setOrgao(data.orgao);
        if (data.modalidade) setModalidade(data.modalidade);
        if (data.objeto) setObjeto(data.objeto);
        if (data.valorEstimado) setValorEstimado(data.valorEstimado);
        if (data.prazoValidade) setPrazoValidade(data.prazoValidade);
        if (data.prazoPagamento) setPrazoPagamento(data.prazoPagamento);
        if (data.prazoEntrega) setPrazoEntrega(data.prazoEntrega);
        if (data.localEntrega) setLocalEntrega(data.localEntrega);
        if (data.liquidacaoNfe) setLiquidacaoNfe(data.liquidacaoNfe);
        if (data.editalRawText) setEditalRawText(data.editalRawText);
        if (data.itens?.length > 0) {
          setItens(data.itens);
          // Sincroniza itens do rascunho com licitacao_itens para que apareçam
          // em ImportarDoCatalogo e Precificação em visitas futuras
          if (processoId && user) {
            const parseVal = (v: string) =>
              parseFloat((v || '0').replace(/\./g, '').replace(',', '.')) || 0;
            const rows = (data.itens as any[]).map((it: any, idx: number) => ({
              licitacao_id: processoId,
              user_id: user.id,
              numero: parseInt(it.item) || idx + 1,
              descricao: it.descricao || '',
              quantidade: parseFloat(it.quantidade) || 1,
              unidade: it.unidade || 'UN',
              valor_unitario: parseVal(it.valorUnitario),
              valor_total: parseVal(it.valorTotal),
              marca: it.marca || null,
              fabricante: it.fabricante || null,
              modelo: it.modelo || null,
            }));
            supabase.from('licitacao_itens')
              .upsert(rows, { onConflict: 'licitacao_id,numero' })
              .then(({ error }) => {
                if (error) console.warn('[rascunho-sync] licitacao_itens:', error);
              });
          }
        }
        if (data.repNome !== undefined) setRepNome(data.repNome ?? '');
        if (data.repCpf !== undefined) setRepCpf(data.repCpf ?? '');
        if (data.repRg !== undefined) setRepRg(data.repRg ?? '');
        if (data.repOrgaoExp !== undefined) setRepOrgaoExp(data.repOrgaoExp ?? '');
        if (data.repCargo !== undefined) setRepCargo(data.repCargo ?? '');
        if (data.repNaturalidade !== undefined) setRepNaturalidade(data.repNaturalidade ?? '');
        if (data.repNacionalidade !== undefined) setRepNacionalidade(data.repNacionalidade ?? '');
        if (data.repEstadoCivil !== undefined) setRepEstadoCivil(data.repEstadoCivil ?? '');
        if (data.repEndereco !== undefined) setRepEndereco(data.repEndereco ?? '');
        if (data.banco) setBanco(data.banco);
        if (data.agencia) setAgencia(data.agencia);
        if (data.conta) setConta(data.conta);
        if (data.tipoConta) setTipoConta(data.tipoConta);
        if (data.pix) setPix(data.pix);
        if (data.telefone) setTelefone(data.telefone);
        if (data.email) setEmail(data.email);
        if (data.inscEstadual) setInscEstadual(data.inscEstadual);
        if (data.inscMunicipal) setInscMunicipal(data.inscMunicipal);
        if (data.declaracoes) setDeclaracoes(data.declaracoes);
        if (data.declaracoesCustom) setDeclaracoesCustom(data.declaracoesCustom);
        if (data.fontFamily) setFontFamily(data.fontFamily);
        if (data.fontSize) setFontSize(data.fontSize);
        if (data.lineSpacing) setLineSpacing(data.lineSpacing);
        if (data.marginStyle) setMarginStyle(data.marginStyle);
        if (data.pageOrientation) setPageOrientation(data.pageOrientation);
        if (data.currentStep) setCurrentStep(data.currentStep);
        if (typeof data.usarMarcaDagua === 'boolean') setUsarMarcaDagua(data.usarMarcaDagua);
        toast.info('Rascunho restaurado automaticamente.');
        // Se o rascunho não tem itens, ainda carrega do banco para não deixar a tabela vazia
        if (!data.itens?.length && processoId) {
          loadProcessoData(processoId);
        }
      } else if (processoId) {
        // No draft found — try to load process data from licitacoes table
        loadProcessoData(processoId);
      }
      markLoaded();
    });
  }, [processoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load licitacao data when selecting a process without existing draft
  const loadProcessoData = async (lid: string) => {
    if (!user) return;
    const { data: lic } = await supabase
      .from('licitacoes')
      .select('numero, orgao, objeto, modalidade, valor_estimado')
      .eq('id', lid)
      .single();
    if (lic) {
      if (lic.numero) setNumeroLicitacao(lic.numero);
      if (lic.orgao) setOrgao(lic.orgao);
      if (lic.objeto) setObjeto(lic.objeto);
      if (lic.modalidade) setModalidade(lic.modalidade);
      if (lic.valor_estimado) setValorEstimado(String(lic.valor_estimado));
    }

    // Also try to import priced items from catalog
    const selectFields = 'descricao, quantidade, unidade, marca, fabricante, modelo, preco_unitario, preco_total';
    const { data: catalogById } = await supabase
      .from('catalogo_itens_precificados')
      .select(selectFields)
      .eq('user_id', user.id)
      .eq('licitacao_id', lid);
    let catalogItems = catalogById;

    if ((!catalogItems || catalogItems.length === 0) && lic?.numero) {
      const { data: catalogByNumero } = await supabase
        .from('catalogo_itens_precificados')
        .select(selectFields)
        .eq('user_id', user.id)
        .eq('licitacao_numero', lic.numero);
      catalogItems = catalogByNumero;
    }

    if (catalogItems && catalogItems.length > 0) {
      const mapped = catalogItems.map((ci: any, idx: number) => ({
        item: String(idx + 1),
        descricao: ci.descricao || '',
        quantidade: String(ci.quantidade || 1),
        unidade: ci.unidade || 'UN',
        marca: ci.marca || '',
        fabricante: ci.fabricante || '',
        modelo: ci.modelo || '',
        valorUnitario: (ci.preco_unitario || 0).toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(ci.preco_unitario || 0),
        valorTotal: (ci.preco_total || 0).toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(ci.preco_total || 0),
      }));
      setItens(mapped);
      toast.success(`${mapped.length} item(ns) carregado(s) da precificação deste processo.`);
      return;
    }

    // Fallback: carregar itens extraídos do edital (sem preços preenchidos)
    const { data: editalItens } = await supabase
      .from('licitacao_itens')
      .select('numero, descricao, quantidade, unidade, valor_unitario, valor_total, marca')
      // Itens são do processo (empresa); o RLS decide quem lê.
      .eq('licitacao_id', lid)
      .order('numero', { ascending: true });

    if (editalItens && editalItens.length > 0) {
      const mapped = editalItens.map((it: any, idx: number) => ({
        item: String(it.numero || idx + 1),
        descricao: it.descricao || '',
        quantidade: String(it.quantidade || 1),
        unidade: it.unidade || 'UN',
        marca: it.marca || '',
        fabricante: '',
        modelo: '',
        valorUnitario: (it.valor_unitario || 0).toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(it.valor_unitario || 0),
        valorTotal: (it.valor_total || 0).toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(it.valor_total || 0),
      }));
      setItens(mapped);
      toast.info(`${mapped.length} item(ns) do edital carregado(s). Preencha os preços.`);
    }
  };

  // Clear all form fields to start a new proposal
  const limparFormulario = useCallback(async () => {
    setNumeroLicitacao('');
    setOrgao('');
    setModalidade('Pregão Eletrônico');
    setObjeto('');
    setValorEstimado('');
    setPrazoValidade('60 dias corridos');
    setPrazoPagamento('Até 30 dias após recebimento definitivo e apresentação da Nota Fiscal');
    setPrazoEntrega('');
    setLocalEntrega('');
    setLiquidacaoNfe('');
    setGarantia('');
    setCondicoesEntrega('');
    setEditalRawText('');
    setItens([{ item: '1', descricao: '', quantidade: '', unidade: 'UN', marca: '', fabricante: '', modelo: '', valorUnitario: '', valorUnitarioExtenso: '', valorTotal: '', valorTotalExtenso: '' }]);
    setRepNome('');
    setRepCpf('');
    setRepRg('');
    setRepOrgaoExp('');
    setRepCargo('');
    setRepNaturalidade('');
    setRepNacionalidade('Brasileira');
    setRepEstadoCivil('');
    setRepEndereco('');
    setBanco('');
    setAgencia('');
    setConta('');
    setTipoConta('Conta Corrente');
    setPix('');
    setTelefone('');
    setEmail('');
    setInscEstadual('');
    setInscMunicipal('');
    setDeclaracoes(Object.fromEntries(DECLARACOES_PADRAO.map(d => [d.key, true])));
    setDeclaracoesCustom([]);
    setProposal('');
    setCurrentStep(1);
    // Embutido, a aba pertence AO processo do prontuário: limpar o formulário
    // esvazia os campos, mas não pode desfazer esse vínculo — o efeito que o
    // fixa observa só [embedded, licitacaoIdEmbed] e não voltaria a rodar, e
    // sem processo somem a faixa da pasta Proposta, a releitura do edital, o
    // recorte do catálogo e o "Salvar na pasta Proposta".
    setProcessoId(embedded && licitacaoIdEmbed ? licitacaoIdEmbed : null);
    if (rascunhoId) await deleteRascunho();
    toast.success('Formulário limpo. Pronto para uma nova proposta!');
  }, [rascunhoId, deleteRascunho, setProcessoId, embedded, licitacaoIdEmbed]);

  // Auto-save on form changes
  useEffect(() => {
    const data = collectFormData();
    const titulo = objeto ? `${numeroLicitacao || 'Proposta'} — ${orgao || objeto.slice(0, 40)}` : undefined;
    autoSave(data, titulo);
  }, [collectFormData, autoSave]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (proposal && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [proposal]);

  // Sincroniza campos da empresa e representante sempre que a empresa ativa mudar
  useEffect(() => {
    if (!empresaAtiva) return;
    const ea = empresaAtiva as any;
    // Dados da empresa
    setInscEstadual(ea.inscricao_estadual || '');
    setInscMunicipal(ea.inscricao_municipal || '');
    if (ea.telefone) setTelefone(ea.telefone);
    if (ea.email) setEmail(ea.email);
    // Representante legal — sobrescreve com dados da nova empresa
    setRepNome(ea.rep_nome || '');
    setRepCpf(ea.rep_cpf || '');
    setRepRg(ea.rep_rg || '');
    setRepOrgaoExp(ea.rep_orgao_expedidor || '');
    setRepCargo(ea.rep_cargo || '');
    setRepNaturalidade(ea.rep_naturalidade || '');
    setRepNacionalidade(ea.rep_nacionalidade || 'Brasileira');
    // Endereço do representante: usa endereço da empresa como fallback quando vazio
    const partes = [
      empresaAtiva.endereco,
      empresaAtiva.bairro,
      empresaAtiva.municipio && empresaAtiva.uf
        ? `${empresaAtiva.municipio}/${empresaAtiva.uf}`
        : (empresaAtiva.municipio || empresaAtiva.uf),
      empresaAtiva.cep,
    ].filter(Boolean);
    if (partes.length > 0) setRepEndereco(partes.join(', '));
  }, [empresaAtiva]);

  // Quando chega no passo 3, preenche campos ainda vazios (caso empresa já estivesse carregada)
  useEffect(() => {
    if (currentStep !== 3 || !empresaAtiva) return;
    const ea = empresaAtiva as any;
    if (!repNome && ea.rep_nome) setRepNome(ea.rep_nome);
    if (!repCpf && ea.rep_cpf) setRepCpf(ea.rep_cpf);
    if (!repRg && ea.rep_rg) setRepRg(ea.rep_rg);
    if (!repOrgaoExp && ea.rep_orgao_expedidor) setRepOrgaoExp(ea.rep_orgao_expedidor);
    if (!repCargo && ea.rep_cargo) setRepCargo(ea.rep_cargo);
    if (!repNaturalidade && ea.rep_naturalidade) setRepNaturalidade(ea.rep_naturalidade);
    if ((!repNacionalidade || repNacionalidade === 'Brasileira') && ea.rep_nacionalidade) setRepNacionalidade(ea.rep_nacionalidade);
    if (!repEndereco) {
      const partes = [
        empresaAtiva.endereco,
        empresaAtiva.bairro,
        empresaAtiva.municipio && empresaAtiva.uf
          ? `${empresaAtiva.municipio}/${empresaAtiva.uf}`
          : (empresaAtiva.municipio || empresaAtiva.uf),
        empresaAtiva.cep,
      ].filter(Boolean);
      if (partes.length > 0) setRepEndereco(partes.join(', '));
    }
  }, [currentStep, empresaAtiva]); // eslint-disable-line react-hooks/exhaustive-deps

  // Import pending items from Precificação — react to changes
  useEffect(() => {
    if (hasPending && pendingItems.length > 0) {
      setItens(prev => {
        const hasEmpty = prev.length === 1 && !prev[0].descricao.trim();
        const base = hasEmpty ? [] : prev;
        const newItens = pendingItems.map((p, idx) => ({
          ...p,
          item: String(base.length + idx + 1),
        }));
        return [...base, ...newItens];
      });
      toast.success(`${pendingItems.length} ${pendingItems.length === 1 ? 'item importado' : 'itens importados'} da Precificação!`);
      clearPending();
    }
  }, [hasPending, pendingItems, clearPending]);

  const handleEditalExtracted = async (data: ExtractedEditalData) => {
    if (data.numeroLicitacao) setNumeroLicitacao(data.numeroLicitacao);
    if (data.identificacaoEdital) setIdentificacaoEdital(data.identificacaoEdital);
    if (data.processoAdministrativo) setProcessoAdministrativo(data.processoAdministrativo);
    if (data.orgao) setOrgao(data.orgao);
    if (data.modalidade) setModalidade(data.modalidade);
    if (data.objeto) setObjeto(data.objeto);
    if (data.valorEstimado) setValorEstimado(data.valorEstimado);
    if (data.prazoValidade) setPrazoValidade(data.prazoValidade);
    if (data.prazoPagamento) setPrazoPagamento(data.prazoPagamento);
    if (data.prazoEntrega) setPrazoEntrega(data.prazoEntrega);
    if (data.localEntrega) setLocalEntrega(data.localEntrega);
    if (data.liquidacaoNfe) setLiquidacaoNfe(data.liquidacaoNfe);
    if (data.itens && data.itens.length > 0) setItens(data.itens);
    if (data.rawText) setEditalRawText(data.rawText);

    // Auto-create a process if none is linked
    let lid = processoId;
    if (!lid && user && (data.numeroLicitacao || data.orgao)) {
      const linkedId = await ensureProcesso({
        numero: data.numeroLicitacao || 'Processo Manual',
        orgao: data.orgao || '',
        objeto: data.objeto || '',
        modalidade: data.modalidade || 'Pregão Eletrônico',
        valorEstimado: data.valorEstimado ? parseFloat(data.valorEstimado.replace(/[^\d,.-]/g, '').replace(',', '.')) || null : undefined,
      });
      if (linkedId) {
        lid = linkedId;
        setProcessoId(linkedId);
        toast.info('Processo licitatório criado automaticamente.');
      }
    }

    // Persist extracted items to licitacao_itens so they appear in ImportarDoCatalogo
    // and in Precificação on future visits
    if (lid && user && data.itens && data.itens.length > 0) {
      const parseVal = (v: string) => parseFloat((v || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const rows = data.itens.map((it: any, idx: number) => ({
        licitacao_id: lid,
        user_id: user.id,
        numero: parseInt(it.item) || idx + 1,
        descricao: it.descricao || '',
        quantidade: parseFloat(it.quantidade) || 1,
        unidade: it.unidade || 'UN',
        valor_unitario: parseVal(it.valorUnitario),
        valor_total: parseVal(it.valorTotal),
        marca: it.marca || null,
        fabricante: it.fabricante || null,
        modelo: it.modelo || null,
      }));
      supabase.from('licitacao_itens')
        .upsert(rows, { onConflict: 'licitacao_id,numero' })
        .then(({ error }) => { if (error) console.warn('[handleEditalExtracted] upsert licitacao_itens:', error); });
    }

    toast.info('Dados extraídos! Avance para revisá-los.');
  };

  /**
   * Lê valor em pt-BR com ou sem separador de milhar: "70.083,00", "70083,00"
   * e "70083.00" chegam todos a 70083. O parser antigo (replace(',', '.') solto)
   * transformava "70.083,00" em 70,083 — o Valor Global saía centenas de vezes
   * menor no documento gerado.
   */
  const parseBRL = (v: string): number => {
    const t = String(v ?? '').replace(/[^\d,.-]/g, '').trim();
    if (!t) return 0;
    return t.includes(',')
      ? parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0
      : parseFloat(t) || 0;
  };
  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Valor Global = soma da planilha de preços. Sem digitação paralela que
  // pudesse divergir do que a própria proposta apresenta na tabela.
  const valorGlobal = itens.reduce((acc, i) => acc + parseBRL(i.valorTotal), 0);

  useEffect(() => {
    if (valorGlobal > 0) {
      const formatado = fmtBRL(valorGlobal);
      setValorEstimado((prev) => (prev === formatado ? prev : formatado));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorGlobal]);

  useEffect(() => {
    if (!processoId) { setNaPasta(null); return; }
    supabase
      .from('processo_anexos')
      .select('nome_arquivo, created_at')
      .eq('licitacao_id', processoId)
      .eq('categoria', 'proposta')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const a = data?.[0];
        setNaPasta(a ? { nome: a.nome_arquivo, em: a.created_at } : null);
      });
  }, [processoId, nonceArquivo]);

  const buildContext = () => {
    const parts: string[] = [];

    parts.push(`## Preferências de Formatação`);
    parts.push(`- Fonte: ${fontFamily}, Tamanho: ${fontSize}pt, Espaçamento: ${lineSpacing}, Margens: ${marginStyle}, Orientação: ${pageOrientation === 'portrait' ? 'Retrato' : 'Paisagem'}`);

    if (empresaAtiva) {
      parts.push(`\n## Dados da Empresa Licitante`);
      parts.push(`- Razão Social: ${empresaAtiva.razao_social}`);
      if (empresaAtiva.nome_fantasia) parts.push(`- Nome Fantasia: ${empresaAtiva.nome_fantasia}`);
      parts.push(`- CNPJ: ${empresaAtiva.cnpj}`);
      if (empresaAtiva.cnae_principal) parts.push(`- CNAE Principal: ${empresaAtiva.cnae_principal}`);
      if (inscEstadual) parts.push(`- Inscrição Estadual: ${inscEstadual}`);
      if (inscMunicipal) parts.push(`- Inscrição Municipal: ${inscMunicipal}`);
      if (empresaAtiva.endereco) parts.push(`- Endereço: ${empresaAtiva.endereco}${empresaAtiva.complemento ? `, ${empresaAtiva.complemento}` : ''}${empresaAtiva.bairro ? ` - ${empresaAtiva.bairro}` : ''}`);
      if (empresaAtiva.cep) parts.push(`- CEP: ${empresaAtiva.cep}`);
      if (empresaAtiva.uf) parts.push(`- UF: ${empresaAtiva.uf}`);
      if (empresaAtiva.municipio) parts.push(`- Município: ${empresaAtiva.municipio}`);
      if (empresaAtiva.regime_tributario) parts.push(`- Regime Tributário: ${empresaAtiva.regime_tributario}`);
    }
    if (telefone) parts.push(`- Telefone: ${telefone}`);
    if (email) parts.push(`- E-mail: ${email}`);

    parts.push(`\n## Representante Legal`);
    if (repNome) parts.push(`- Nome: ${repNome}`);
    if (repCpf) parts.push(`- CPF: ${repCpf}`);
    if (repRg) parts.push(`- RG: ${repRg} — Expedido por: ${repOrgaoExp}`);
    if (repCargo) parts.push(`- Cargo/Função: ${repCargo}`);
    if (repNaturalidade) parts.push(`- Naturalidade: ${repNaturalidade}`);
    if (repNacionalidade) parts.push(`- Nacionalidade: ${repNacionalidade}`);
    if (repEstadoCivil) parts.push(`- Estado Civil: ${repEstadoCivil}`);
    if (repEndereco) parts.push(`- Endereço: ${repEndereco}`);

    parts.push(`\n## Dados Bancários`);
    if (banco) parts.push(`- Banco: ${banco}`);
    if (agencia) parts.push(`- Agência: ${agencia}`);
    if (conta) parts.push(`- ${tipoConta}: ${conta}`);
    if (pix) parts.push(`- Chave PIX: ${pix}`);

    parts.push(`\n## Dados da Licitação`);
    if (numeroLicitacao) parts.push(`- Número: ${numeroLicitacao}`);
    if (orgao) parts.push(`- Órgão Gerenciador: ${orgao}`);
    parts.push(`- Modalidade: ${modalidade}`);
    if (objeto) parts.push(`- Objeto: ${objeto}`);
    if (valorEstimado) parts.push(`- Valor Global: R$ ${valorEstimado}`);
    if (prazoValidade) parts.push(`- Validade da Proposta Comercial: ${prazoValidade}`);
    if (prazoPagamento) parts.push(`- Prazo de Pagamento: ${prazoPagamento}`);
    if (prazoEntrega) parts.push(`- Prazo de Entrega: ${prazoEntrega}`);
    if (localEntrega) parts.push(`- Local de Entrega: ${localEntrega}`);
    if (liquidacaoNfe) parts.push(`- Liquidação NFe: ${liquidacaoNfe}`);

    if (itens.length > 0 && itens.some(i => i.descricao.trim())) {
      parts.push(`\n## Planilha de Preços (REPRODUZA FIELMENTE COM TODAS AS 11 COLUNAS)`);
      parts.push('| ITEM | DESCRIÇÃO | QTDE | UNID | MARCA | FABRICANTE | MODELO | VL. UNIT. (R$) | VL. UNIT. EXTENSO | VL. TOTAL (R$) | VL. TOTAL EXTENSO |');
      parts.push('|------|-----------|------|------|-------|------------|--------|----------------|-------------------|----------------|-------------------|');
      itens.forEach(i => {
        parts.push(`| ${i.item} | ${i.descricao} | ${i.quantidade} | ${i.unidade} | ${i.marca || '-'} | ${i.fabricante || '-'} | ${i.modelo || '-'} | R$ ${i.valorUnitario} | ${i.valorUnitarioExtenso || '-'} | R$ ${i.valorTotal} | ${i.valorTotalExtenso || '-'} |`);
      });
      parts.push(`\nValor Global: R$ ${fmtBRL(valorGlobal)}`);
    }

    const declAtivas = DECLARACOES_PADRAO.filter(d => declaracoes[d.key]);
    if (declAtivas.length > 0) {
      parts.push(`\n## Declarações Obrigatórias (INCLUA TODAS NO DOCUMENTO)`);
      declAtivas.forEach(d => parts.push(`- ${d.label} (${d.base})`));
    }
    if (declaracoesCustom.length > 0) {
      declaracoesCustom.forEach(d => parts.push(`- ${d}`));
    }

    if (editalRawText) {
      parts.push(`\n## Texto do Edital (parcial)`);
      parts.push(editalRawText.slice(0, 8000));
    }

    return parts.join('\n');
  };

  const handleGenerate = async () => {
    if (!empresaAtiva) {
      toast.error('Empresa não configurada', {
        description: 'Cadastre sua empresa em Configurações → Empresa antes de gerar a proposta.',
        duration: 8000,
      });
      return;
    }
    if (!objeto.trim()) {
      toast.error('Objeto da licitação não preenchido', {
        description: 'Volte à etapa "Licitação" (passo 4) e informe o objeto antes de gerar.',
        duration: 6000,
      });
      return;
    }
    if (!orgao.trim()) {
      toast.error('Órgão licitante não preenchido', {
        description: 'Volte à etapa "Licitação" (passo 4) e informe o órgão licitante antes de gerar.',
        duration: 6000,
      });
      return;
    }

    if (itens.filter(i => i.descricao.trim()).length === 0) {
      toast.warning('Planilha de preços vazia', {
        description: 'Nenhum item foi adicionado à planilha. A proposta será gerada sem planilha de preços. Adicione itens na etapa "Planilha" (passo 5) se necessário.',
        duration: 7000,
      });
    }

    if (!repNome || !repCpf) {
      toast.warning('Representante legal incompleto', {
        description: 'Nome e/ou CPF do representante não foram preenchidos. A proposta será gerada sem esses dados. Preencha na etapa "Representante" (passo 3).',
        duration: 7000,
      });
    }

    setIsLoading(true);
    setProposal('');
    let content = '';

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: 'Gere a Proposta Comercial completa seguindo rigorosamente a estrutura: 1) Cabeçalho e endereçamento ao Órgão Gerenciador, 2) Objeto, 3) Planilha de Preços com TODAS as 11 colunas (Item, Descrição, Qtde, Unid, Marca, Fabricante, Modelo, Vlr Unitário, Vlr Extenso, Vlr Total, Vlr Total Extenso) — REPRODUZA EXATAMENTE os valores fornecidos sem alterar nenhum número, 4) Validade da Proposta, 5) Prazo e Condições de Pagamento, 6) Prazo e Local de Entrega, 7) Declarações obrigatórias, 8) Local, Data e Assinatura com nome do representante e cargo. REGRA CRÍTICA: NÃO inclua seção separada de "Dados da Empresa", "Dados do Representante" ou "Dados Bancários" no corpo — essas informações já constam no cabeçalho e na assinatura. Apenas a assinatura final com nome, cargo, empresa e CNPJ. NÃO duplique dados cadastrais. IMPORTANTE: Use EXATAMENTE os dados fornecidos no contexto. NÃO invente, altere ou omita nenhum dado. Reproduza fielmente todos os valores da planilha.' }],
        action: 'proposta_tecnica',
        context: buildContext(),
        onDelta: (chunk) => { content += chunk; setProposal(content); },
        onDone: () => {
          setIsLoading(false);
          if (content.trim().length > 50) {
            toast.success('Proposta gerada com sucesso!');
          }
        },
        onError: (error) => {
          setIsLoading(false);
          const isAuth = /invalid token|unauthorized|sessão/i.test(error);
          toast.error(
            isAuth ? 'Sessão expirada' : 'Erro ao gerar proposta',
            {
              description: isAuth
                ? 'Sua sessão expirou. Recarregue a página (F5) e tente novamente.'
                : error,
              duration: 8000,
            }
          );
        },
      });
    } catch (err: any) {
      toast.error('Falha crítica na geração da proposta', { 
        description: err?.message || 'Erro desconhecido. Tente novamente.',
        duration: 10000 
      });
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(proposal);
    setCopied(true);
    toast.success('Proposta copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const nextStep = () => {
    if (currentStep === 1 && !empresaAtiva) {
      toast.warning('Empresa não cadastrada', {
        description: 'Você ainda não tem uma empresa configurada. Vá em Configurações → Empresa para cadastrar antes de continuar.',
        duration: 6000,
      });
    }
    if (currentStep === 2 && !empresaAtiva) {
      toast.error('Selecione ou cadastre uma empresa antes de continuar', {
        description: 'Acesse Configurações → Empresa para cadastrar os dados da sua empresa.',
        duration: 6000,
      });
      return;
    }
    if (currentStep === 3 && (!repNome.trim() || !repCpf.trim())) {
      toast.warning('Representante legal incompleto', {
        description: 'Preencha pelo menos o Nome Completo e o CPF do representante antes de avançar.',
        duration: 5000,
      });
    }
    if (currentStep === 4 && (!objeto.trim() || !orgao.trim())) {
      toast.warning('Dados da licitação incompletos', {
        description: `Preencha ${!objeto.trim() ? 'o Objeto' : ''}${!objeto.trim() && !orgao.trim() ? ' e ' : ''}${!orgao.trim() ? 'o Órgão Licitante' : ''} antes de avançar.`,
        duration: 5000,
      });
    }
    setCurrentStep(s => Math.min(s + 1, STEPS.length));
  };
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  const completedSteps = () => {
    const done = new Set<number>();
    if (editalRawText || numeroLicitacao) done.add(1);
    if (empresaAtiva) done.add(2);
    if (repNome && repCpf) done.add(3);
    if (orgao && objeto) done.add(4);
    if (itens.some(i => i.descricao.trim())) done.add(5);
    done.add(6);
    done.add(7);
    return done;
  };
  const completed = completedSteps();

  const totalItens = itens.filter(i => i.descricao.trim()).length;

  const declaracoesAtivasLabels = DECLARACOES_PADRAO
    .filter(d => declaracoes[d.key])
    .map(d => d.label)
    .concat(declaracoesCustom.filter(d => d.trim()));

  // Ações do topo. O toggle de prévia vale nos dois modos; "Nova proposta" é a
  // ação que o registro declara para a ROTA /proposta-tecnica — na aba Proposta
  // do prontuário ela não aparece, porque ali o wizard existe para UM processo.
  // Como o handler apaga o formulário inteiro E o rascunho salvo, passa por
  // confirmação, igual ao "Limpar itens" da planilha.
  const temAcoesTopo = !isMobile || !embedded;
  const acoesTopo = (
    <>
      {!isMobile && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          {showPreview ? 'Ocultar prévia' : 'Mostrar prévia'}
        </Button>
      )}
      {!embedded && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm">
              <Sparkles className="w-4 h-4" />
              Nova proposta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Começar uma proposta nova?</AlertDialogTitle>
              <AlertDialogDescription>
                Zera os campos das oito etapas e a planilha de preços, e apaga o rascunho
                salvo automaticamente. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={limparFormulario}
              >
                Limpar e começar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );

  const chipRascunho = lastSaved ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" aria-hidden="true" />
      {saving ? 'Salvando…' : `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
    </span>
  ) : null;

  const conteudo = (
      <div className="space-y-4">
        {/* Tela de menu: título, descrição e trilha vêm do registro. Embutida na
            aba Proposta do prontuário, o cabeçalho do prontuário já cumpre esse
            papel — aqui sobra só a barra de ações. */}
        {!embedded ? (
          <CabecalhoPagina acoes={acoesTopo}>
            {chipRascunho}
          </CabecalhoPagina>
        ) : (
          (chipRascunho || temAcoesTopo) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {chipRascunho}
              {temAcoesTopo && <div className="flex flex-wrap items-center gap-2">{acoesTopo}</div>}
            </div>
          )
        )}

        {/* No modo avulso, declara sobre qual processo o wizard age; embutido,
            o cabeçalho do prontuário já cumpre esse papel. */}
        {!embedded && <ProcessoContextoBanner />}

        {/* Ligação com a pasta Proposta dos Anexos */}
        {processoId && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            {naPasta ? (
              <>
                <span className="text-muted-foreground">Arquivada na pasta Proposta:</span>
                <span className="font-medium text-foreground">{naPasta.nome}</span>
                <span className="text-xs text-muted-foreground">
                  · {new Date(naPasta.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                Ainda não há proposta arquivada neste processo — ao gerar, use
                <span className="font-medium text-foreground"> Salvar na pasta Proposta</span>.
              </span>
            )}
            <Button size="sm" variant="ghost" className="ml-auto" asChild>
              <Link to={`/processo/${processoId}?aba=documentos`}>
                Ver pasta Proposta <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        )}

        {/* Split-screen layout */}
        <div className="flex gap-4">
          {/* Left: Form */}
          <div className={`${showPreview && !isMobile ? 'w-1/2 min-w-0' : 'w-full max-w-6xl mx-auto'} space-y-4`}>

        {/* REBRAND — a régua de passos do protótipo (`mstep`).
            Antes eram oito pastilhas lado a lado, todas do mesmo tamanho: nada
            dizia que uma vinha DEPOIS da outra, nem quanto faltava. Agora os nós
            são ligados por um trilho que fica verde onde já passou — a mesma
            gramática da trilha do Tutorial. Os oito passos, os rótulos, as
            descrições e o clique para pular continuam idênticos. */}
        <nav
          aria-label="Etapas da proposta"
          className="overflow-x-auto rounded-lg border border-border bg-card px-3 py-4 shadow-sm"
        >
          <ol className="flex items-start min-w-max list-none m-0 p-0">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isDone = completed.has(step.id);
              const proximoFeito = completed.has(STEPS[idx + 1]?.id);
              return (
                <li key={step.id} className="flex items-start">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Etapa ${step.id}: ${step.label}${isDone ? ' — concluída' : ''}`}
                    className="group flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-md text-center"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                        isActive
                          ? 'bg-primary border-primary text-primary-foreground'
                          : isDone
                            ? 'border-success text-success bg-card'
                            : 'border-border text-muted-foreground bg-card group-hover:border-muted-foreground'
                      }`}
                    >
                      {isDone && !isActive
                        ? <CheckCircle className="w-4 h-4" aria-hidden="true" />
                        : <Icon className="w-4 h-4" aria-hidden="true" />}
                    </span>
                    <span className="px-0.5">
                      <span
                        className={`block text-xs font-semibold ${
                          isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="mt-0.5 hidden text-xs text-muted-foreground md:block">
                        {step.desc}
                      </span>
                    </span>
                  </button>

                  {idx < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`-mx-3 mt-5 h-0.5 w-6 rounded-full transition-colors ${
                        isDone && proximoFeito ? 'bg-success' : isDone ? 'bg-success-line' : 'bg-border'
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step Content */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {/* Step 1: Edital Upload */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Upload do edital</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Envie o edital (PDF, DOC, DOCX ou TXT) para que a IA extraia automaticamente: órgão gerenciador, número do processo,
                objeto, planilha de itens com quantidades e preços, prazos de validade, pagamento, entrega e local de entrega.
              </p>
              {processoId && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Sem download/upload manual</p>
                    <p className="text-sm text-muted-foreground">Lemos o edital direto da fonte (PNCP/portal) e importamos os itens automaticamente.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <LimparItensExtraidosButton
                      licitacaoId={processoId}
                      fontes={['licitacao_itens', 'composicoes_custo']}
                      onCleared={() => loadProcessoData(processoId)}
                      label="Limpar itens"
                    />
                    <ReextrairEditalButton licitacaoId={processoId} onCompleted={() => loadProcessoData(processoId)} />
                  </div>
                </div>
              )}
              <EditalUploader onExtracted={handleEditalExtracted} isExtracting={isExtracting} setIsExtracting={setIsExtracting} licitacaoId={processoId || undefined} />

              {/* Quick summary of extracted data */}
              {(editalRawText || numeroLicitacao) && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    {[
                      { label: 'Órgão', value: orgao, icon: Building2 },
                      { label: 'Licitação', value: numeroLicitacao, icon: FileText },
                      { label: 'Itens', value: `${totalItens} encontrado(s)`, icon: CreditCard },
                      { label: 'Modalidade', value: modalidade, icon: Receipt },
                    ].map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <div key={i} className="rounded-lg border border-border bg-muted p-4">
                          <div className="mb-1 flex items-center gap-1.5">
                            <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                          </div>
                          <p className="truncate text-sm font-semibold text-foreground">{s.value || '—'}</p>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive-line text-destructive hover:bg-destructive-tint hover:text-destructive"
                    onClick={limparFormulario}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Limpar e iniciar nova proposta
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Empresa */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="mb-1 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Dados da empresa licitante</h2>
              </div>

              {empresaAtiva ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-muted p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 font-semibold text-foreground">{empresaAtiva.razao_social}</p>
                        {empresaAtiva.nome_fantasia && (
                          <p className="text-xs text-muted-foreground">Nome Fantasia: {empresaAtiva.nome_fantasia}</p>
                        )}
                        <p className="text-muted-foreground">
                          CNPJ: {empresaAtiva.cnpj}
                          {empresaAtiva.cnae_principal && ` · CNAE: ${empresaAtiva.cnae_principal}`}
                        </p>
                        <p className="text-muted-foreground">
                          {empresaAtiva.municipio && `${empresaAtiva.municipio}`}
                          {empresaAtiva.uf && `/${empresaAtiva.uf}`}
                          {empresaAtiva.regime_tributario && ` · ${empresaAtiva.regime_tributario}`}
                        </p>
                        {empresaAtiva.endereco && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {empresaAtiva.endereco}
                            {empresaAtiva.complemento && `, ${empresaAtiva.complemento}`}
                            {empresaAtiva.bairro && ` - ${empresaAtiva.bairro}`}
                            {empresaAtiva.cep && ` · CEP: ${empresaAtiva.cep}`}
                          </p>
                        )}
                        {(empresaAtiva.telefone || empresaAtiva.email) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {empresaAtiva.telefone && `Tel: ${empresaAtiva.telefone}`}
                            {empresaAtiva.telefone && empresaAtiva.email && ' · '}
                            {empresaAtiva.email && `E-mail: ${empresaAtiva.email}`}
                          </p>
                        )}
                        {(empresaAtiva.inscricao_estadual || empresaAtiva.inscricao_municipal) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {empresaAtiva.inscricao_estadual && `IE: ${empresaAtiva.inscricao_estadual}`}
                            {empresaAtiva.inscricao_estadual && empresaAtiva.inscricao_municipal && ' · '}
                            {empresaAtiva.inscricao_municipal && `IM: ${empresaAtiva.inscricao_municipal}`}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          if (empresaAtiva.telefone) setTelefone(empresaAtiva.telefone);
                          if (empresaAtiva.email) setEmail(empresaAtiva.email);
                          if (empresaAtiva.inscricao_estadual) setInscEstadual(empresaAtiva.inscricao_estadual);
                          if (empresaAtiva.inscricao_municipal) setInscMunicipal(empresaAtiva.inscricao_municipal);
                          // Also fill representative
                          if ((empresaAtiva as any).rep_nome) setRepNome((empresaAtiva as any).rep_nome);
                          if ((empresaAtiva as any).rep_cpf) setRepCpf((empresaAtiva as any).rep_cpf);
                          if ((empresaAtiva as any).rep_rg) setRepRg((empresaAtiva as any).rep_rg);
                          if ((empresaAtiva as any).rep_orgao_expedidor) setRepOrgaoExp((empresaAtiva as any).rep_orgao_expedidor);
                          if ((empresaAtiva as any).rep_cargo) setRepCargo((empresaAtiva as any).rep_cargo);
                          if ((empresaAtiva as any).rep_naturalidade) setRepNaturalidade((empresaAtiva as any).rep_naturalidade);
                          if ((empresaAtiva as any).rep_nacionalidade) setRepNacionalidade((empresaAtiva as any).rep_nacionalidade);
                          toast.success('Dados da empresa e representante preenchidos via Configurações!');
                        }}
                      >
                        <Building2 className="w-4 h-4" />
                        Preencher via Configurações
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  <AlertDescription>
                    Nenhuma empresa ativa selecionada. Selecione uma empresa no menu superior.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prop-telefone">Telefone</Label>
                  <Input id="prop-telefone" placeholder="(XX) XXXXX-XXXX" value={telefone} onChange={e => setTelefone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-email">E-mail</Label>
                  <Input id="prop-email" placeholder="contato@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-insc-estadual">Inscrição Estadual</Label>
                  <Input id="prop-insc-estadual" placeholder="ISENTO ou número" value={inscEstadual} onChange={e => setInscEstadual(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-insc-municipal">Inscrição Municipal</Label>
                  <Input id="prop-insc-municipal" value={inscMunicipal} onChange={e => setInscMunicipal(e.target.value)} />
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Banknote className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Dados bancários
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prop-banco" id="prop-banco-label">Banco</Label>
                    <BancoSelector id="prop-banco" aria-labelledby="prop-banco-label" value={banco} onChange={setBanco} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prop-agencia">Agência</Label>
                    <Input id="prop-agencia" value={agencia} onChange={e => setAgencia(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prop-conta">Conta</Label>
                    <Input id="prop-conta" value={conta} onChange={e => setConta(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prop-tipo-conta">Tipo de Conta</Label>
                    <Select value={tipoConta} onValueChange={setTipoConta}>
                      <SelectTrigger id="prop-tipo-conta"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Conta Corrente">Conta Corrente</SelectItem>
                        <SelectItem value="Conta Poupança">Conta Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="prop-pix">Chave PIX (opcional)</Label>
                    <Input id="prop-pix" placeholder="CNPJ, e-mail, telefone ou chave aleatória" value={pix} onChange={e => setPix(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Representante Legal */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="mb-1 flex items-center gap-2">
                <User className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Representante legal</h2>
              </div>

              {/* Mesma analogia da aba Empresa: a fonte é o cadastro em
                  Configurações — sem upload. */}
              {empresaAtiva && (empresaAtiva as any).rep_nome ? (
                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-foreground">{(empresaAtiva as any).rep_nome}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[(empresaAtiva as any).rep_cargo,
                          (empresaAtiva as any).rep_cpf && `CPF: ${(empresaAtiva as any).rep_cpf}`,
                          (empresaAtiva as any).rep_rg && `RG: ${(empresaAtiva as any).rep_rg}${(empresaAtiva as any).rep_orgao_expedidor ? ` ${(empresaAtiva as any).rep_orgao_expedidor}` : ''}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        const ea = empresaAtiva as any;
                        setRepNome(ea.rep_nome || '');
                        setRepCpf(ea.rep_cpf || '');
                        setRepRg(ea.rep_rg || '');
                        setRepOrgaoExp(ea.rep_orgao_expedidor || '');
                        setRepCargo(ea.rep_cargo || '');
                        setRepNaturalidade(ea.rep_naturalidade || '');
                        setRepNacionalidade(ea.rep_nacionalidade || 'Brasileira');
                        const partes = [
                          empresaAtiva.endereco,
                          empresaAtiva.bairro,
                          empresaAtiva.municipio && empresaAtiva.uf
                            ? `${empresaAtiva.municipio}/${empresaAtiva.uf}`
                            : (empresaAtiva.municipio || empresaAtiva.uf),
                          empresaAtiva.cep,
                        ].filter(Boolean);
                        if (partes.length > 0) setRepEndereco(partes.join(', '));
                        toast.success('Dados do representante preenchidos via Configurações!');
                      }}
                    >
                      <User className="w-4 h-4" />
                      Preencher via Configurações
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert variant="warning">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  <AlertDescription>
                    Nenhum representante cadastrado nas Configurações da empresa. Cadastre em
                    {' '}<span className="font-semibold">Configurações Gerais → Empresa</span>{' '}
                    para preencher automaticamente — ou preencha os campos abaixo manualmente.
                  </AlertDescription>
                </Alert>
              )}
              {repNome && (
                <Alert variant="info">
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  <AlertDescription>
                    Dados preenchidos automaticamente do cadastro da empresa. Revise e ajuste se necessário.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-nome">Nome Completo *</Label>
                  <Input id="prop-rep-nome" value={repNome} onChange={e => setRepNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-cpf">CPF *</Label>
                  <Input id="prop-rep-cpf" placeholder="000.000.000-00" value={repCpf} onChange={e => setRepCpf(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-rg">RG</Label>
                  <Input id="prop-rep-rg" value={repRg} onChange={e => setRepRg(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-orgao-exp">Órgão Expedidor</Label>
                  <Input id="prop-rep-orgao-exp" placeholder="SSP/XX" value={repOrgaoExp} onChange={e => setRepOrgaoExp(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-cargo">Cargo / Função</Label>
                  <Input id="prop-rep-cargo" placeholder="Sócio-Administrador" value={repCargo} onChange={e => setRepCargo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-naturalidade">Naturalidade</Label>
                  <Input id="prop-rep-naturalidade" value={repNaturalidade} onChange={e => setRepNaturalidade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-nacionalidade">Nacionalidade</Label>
                  <Input id="prop-rep-nacionalidade" value={repNacionalidade} onChange={e => setRepNacionalidade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-rep-estado-civil">Estado Civil</Label>
                  <Select value={repEstadoCivil} onValueChange={setRepEstadoCivil}>
                    <SelectTrigger id="prop-rep-estado-civil"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                      <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                      <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                      <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                      <SelectItem value="União Estável">União Estável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="prop-rep-endereco">Endereço do Representante</Label>
                  <Input id="prop-rep-endereco" placeholder="Rua, número, bairro, cidade/UF" value={repEndereco} onChange={e => setRepEndereco(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Dados da Licitação */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="mb-1 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Dados da licitação</h2>
              </div>

              {editalRawText && (
                <Alert variant="info">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <AlertDescription>
                    Campos pré-preenchidos pela extração do edital. Revise e ajuste conforme necessário.
                  </AlertDescription>
                </Alert>
              )}

              {/* Identificação do certame */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prop-numero-licitacao">Número da Licitação *</Label>
                  <Input id="prop-numero-licitacao" placeholder="Ex: PE 001/2026" value={numeroLicitacao} onChange={e => setNumeroLicitacao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-orgao">Órgão Gerenciador *</Label>
                  <Input id="prop-orgao" placeholder="Ex: SEGEP/Prefeitura Municipal de Belém" value={orgao} onChange={e => setOrgao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-modalidade">Modalidade</Label>
                  <Select value={modalidade} onValueChange={setModalidade}>
                    <SelectTrigger id="prop-modalidade"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pregão Eletrônico">Pregão Eletrônico</SelectItem>
                      <SelectItem value="Concorrência">Concorrência</SelectItem>
                      <SelectItem value="Concurso">Concurso</SelectItem>
                      <SelectItem value="Leilão">Leilão</SelectItem>
                      <SelectItem value="Diálogo Competitivo">Diálogo Competitivo</SelectItem>
                      <SelectItem value="Dispensa de Licitação">Dispensa de Licitação</SelectItem>
                      <SelectItem value="Inexigibilidade">Inexigibilidade</SelectItem>
                      <SelectItem value="Credenciamento">Credenciamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-valor-global">Valor Global (R$)</Label>
                  {valorGlobal > 0 ? (
                    <>
                      <Input
                        id="prop-valor-global"
                        value={`R$ ${fmtBRL(valorGlobal)}`}
                        readOnly
                        className="bg-muted font-semibold tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground">
                        Soma dos {itens.filter(i => parseBRL(i.valorTotal) > 0).length} item(ns) da planilha de preços.
                      </p>
                    </>
                  ) : (
                    <>
                      <Input
                        id="prop-valor-global"
                        placeholder="R$ 0,00"
                        value={valorEstimado}
                        onChange={e => setValorEstimado(e.target.value)}
                        onBlur={e => { const n = parseBRL(e.target.value); if (n > 0) setValorEstimado(fmtBRL(n)); }}
                        className="tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground">
                        Preencha a planilha de preços para o valor ser somado automaticamente.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prop-objeto">Objeto da Licitação *</Label>
                <Textarea id="prop-objeto" placeholder="Descrição detalhada do produto ou serviço conforme Termo de Referência..." value={objeto} onChange={e => setObjeto(e.target.value)} rows={4} />
              </div>

              {/* Prazos, entrega e garantia — tudo que a proposta promete cumprir */}
              <div className="border-t border-border pt-6">
                <h3 className="mb-3 text-lg font-semibold text-foreground">Prazos e condições</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prop-prazo-validade" className="flex items-center gap-1"><Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Validade da Proposta Comercial</Label>
                  <Input id="prop-prazo-validade" value={prazoValidade} onChange={e => setPrazoValidade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-prazo-pagamento" className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Prazo de Pagamento</Label>
                  <Input id="prop-prazo-pagamento" placeholder="Até 30 dias após recebimento definitivo" value={prazoPagamento} onChange={e => setPrazoPagamento(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-prazo-entrega" className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Prazo de Entrega</Label>
                  <Input id="prop-prazo-entrega" placeholder="Até X dias úteis/corridos após emissão da OF" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-local-entrega" className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Local de Entrega</Label>
                  <Input id="prop-local-entrega" value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-liquidacao-nfe">Condições de Liquidação / NFe</Label>
                  <Input id="prop-liquidacao-nfe" placeholder="Conforme edital" value={liquidacaoNfe} onChange={e => setLiquidacaoNfe(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-garantia">Garantia</Label>
                  <Input id="prop-garantia" placeholder="Conforme Lei 8.078/1990 (CDC)" value={garantia} onChange={e => setGarantia(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="prop-condicoes-entrega">Condições Especiais de Entrega</Label>
                  <Input id="prop-condicoes-entrega" placeholder="Ex: Entrega parcelada conforme cronograma..." value={condicoesEntrega} onChange={e => setCondicoesEntrega(e.target.value)} />
                </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Planilha de Preços */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-foreground">Planilha de preços</h2>
                </div>
                {totalItens > 0 && (
                  <Badge variant="info">
                    {totalItens} item(ns) · R$ {valorGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                11 colunas: Item, Descrição, Qtd, Unid, Marca, Fabricante, Modelo, Vlr Unit., Vlr Unit. Extenso, Vlr Total, Vlr Total Extenso.
                Importe do Excel, do catálogo de precificação ou preencha manualmente.
              </p>

              {/* Import from Catálogo */}
              <ImportarDoCatalogo
                onImport={(catalogItems) => {
                  // Importar RECONCILIA por descrição: item que já está na
                  // planilha é atualizado (preço/qtd), não duplicado — importar
                  // duas vezes não vira 8, 12 itens.
                  setItens(prev => {
                    const hasEmpty = prev.length === 1 && !prev[0].descricao.trim();
                    const base = hasEmpty ? [] : [...prev];
                    const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
                    for (const ci of catalogItems) {
                      const novo = {
                        descricao: ci.descricao,
                        quantidade: String(ci.quantidade),
                        unidade: ci.unidade,
                        marca: ci.marca || '',
                        fabricante: ci.fabricante || '',
                        modelo: ci.modelo || '',
                        valorUnitario: ci.preco_unitario.toFixed(2).replace('.', ','),
                        valorUnitarioExtenso: valorPorExtenso(ci.preco_unitario),
                        valorTotal: ci.preco_total.toFixed(2).replace('.', ','),
                        valorTotalExtenso: valorPorExtenso(ci.preco_total),
                      };
                      const idx = base.findIndex(b => norm(b.descricao) === norm(ci.descricao));
                      if (idx >= 0) base[idx] = { ...base[idx], ...novo };
                      else base.push({ item: String(base.length + 1), ...novo });
                    }
                    return base.map((b, i) => ({ ...b, item: String(i + 1) }));
                  });
                  toast.success(`${catalogItems.length} item(ns) importado(s) do catálogo!`);
                }}
                licitacaoNumero={numeroLicitacao}
                licitacaoId={processoId}
              />

              <PlanilhaPrecos itens={itens} setItens={setItens} />
            </div>
          )}

          {/* Step 6: Declarações */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="mb-1 flex items-center gap-2">
                <Scale className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Declarações obrigatórias</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione as declarações que devem constar na proposta conforme exigências do edital e legislação vigente.
              </p>
              <div className="space-y-2">
                {DECLARACOES_PADRAO.map(decl => (
                  <label
                    key={decl.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                      declaracoes[decl.key]
                        ? 'border-primary bg-primary-tint'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <Checkbox
                      checked={declaracoes[decl.key]}
                      onCheckedChange={(v) => setDeclaracoes(prev => ({ ...prev, [decl.key]: !!v }))}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{decl.label}</p>
                      <p className="text-xs text-muted-foreground">{decl.base}</p>
                    </div>
                  </label>
                ))}
              </div>

              {declaracoesCustom.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-lg font-semibold text-foreground">Declarações adicionais</h3>
                  {declaracoesCustom.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        aria-label={`Declaração personalizada ${i + 1}`}
                        value={d}
                        onChange={e => {
                          const upd = [...declaracoesCustom];
                          upd[i] = e.target.value;
                          setDeclaracoesCustom(upd);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label={`Remover declaração personalizada ${i + 1}`}
                        onClick={() => setDeclaracoesCustom(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => setDeclaracoesCustom(prev => [...prev, ''])}>
                Adicionar declaração personalizada
              </Button>
            </div>
          )}

          {/* Step 7: Formatação */}
           {currentStep === 7 && (
            <div className="space-y-6">
              <div className="mb-1 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Formatação</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="prop-fonte">Fonte</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger id="prop-fonte"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Calibri">Calibri</SelectItem>
                      <SelectItem value="Verdana">Verdana</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* O rótulo do Slider é um grupo nomeado: o `aria-label` do
                    componente pousa no Root, que o Radix renderiza sem `role`
                    (quem carrega `role="slider"` é o Thumb), então sozinho ele
                    não nomeia o controle. O grupo faz o leitor de tela anunciar
                    "Tamanho da fonte" ao entrar; o `aria-label` fica para quando
                    ui/slider.tsx repassar o rótulo ao Thumb. */}
                <div className="space-y-2" role="group" aria-labelledby="prop-tamanho-fonte-rotulo">
                  <p id="prop-tamanho-fonte-rotulo" className="text-sm font-medium text-foreground">Tamanho da fonte: {fontSize}pt</p>
                  <Slider aria-label="Tamanho da fonte, em pontos" value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={10} max={14} step={1} className="mt-3" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-espacamento">Espaçamento</Label>
                  <Select value={lineSpacing} onValueChange={setLineSpacing}>
                    <SelectTrigger id="prop-espacamento"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">Simples (1.0)</SelectItem>
                      <SelectItem value="1.15">1.15</SelectItem>
                      <SelectItem value="1.5">1.5 (ABNT)</SelectItem>
                      <SelectItem value="2.0">Duplo (2.0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-margens">Margens</Label>
                  <Select value={marginStyle} onValueChange={setMarginStyle}>
                    <SelectTrigger id="prop-margens"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABNT (3/2 cm)">ABNT (3/2 cm)</SelectItem>
                      <SelectItem value="Normal (2.5 cm)">Normal (2.5 cm)</SelectItem>
                      <SelectItem value="Estreita (1.27 cm)">Estreita (1.27 cm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Orientação da Página */}
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-foreground">Orientação da página</legend>
                <div className="grid max-w-xs grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPageOrientation('portrait')}
                    aria-pressed={pageOrientation === 'portrait'}
                    className={`flex flex-col items-center gap-2 rounded-md border-2 p-3 transition-colors ${
                      pageOrientation === 'portrait'
                        ? 'border-primary bg-primary-tint shadow-sm'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span aria-hidden="true" className={`h-11 w-8 rounded-sm border-2 ${pageOrientation === 'portrait' ? 'border-primary bg-primary-tint' : 'border-border bg-muted'}`}>
                      <span className="m-1 block space-y-0.5">
                        <span className={`block h-0.5 rounded-full ${pageOrientation === 'portrait' ? 'bg-primary' : 'bg-border'}`} />
                        <span className={`block h-0.5 w-3/4 rounded-full ${pageOrientation === 'portrait' ? 'bg-primary' : 'bg-border'}`} />
                      </span>
                    </span>
                    <span className="text-sm font-medium text-foreground">Retrato</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageOrientation('landscape')}
                    aria-pressed={pageOrientation === 'landscape'}
                    className={`flex flex-col items-center gap-2 rounded-md border-2 p-3 transition-colors ${
                      pageOrientation === 'landscape'
                        ? 'border-primary bg-primary-tint shadow-sm'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span aria-hidden="true" className={`h-8 w-11 rounded-sm border-2 ${pageOrientation === 'landscape' ? 'border-primary bg-primary-tint' : 'border-border bg-muted'}`}>
                      <span className="m-1 block space-y-0.5">
                        <span className={`block h-0.5 rounded-full ${pageOrientation === 'landscape' ? 'bg-primary' : 'bg-border'}`} />
                        <span className={`block h-0.5 w-3/4 rounded-full ${pageOrientation === 'landscape' ? 'bg-primary' : 'bg-border'}`} />
                      </span>
                    </span>
                    <span className="text-sm font-medium text-foreground">Paisagem</span>
                  </button>
                </div>
              </fieldset>

              {/* Envio da Proposta */}
              <div className="space-y-2 border-t border-border pt-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Send className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Envio da proposta
                </h3>
                <p className="text-base text-muted-foreground">Prepare e envie sua proposta para portais de compras públicas</p>
                <EnvioProposta />
              </div>
            </div>
          )}

          {/* Step 8: Gerar */}
          {currentStep === 8 && (
            <div className="space-y-5">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Gerar proposta final</h2>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {[
                  { label: 'Órgão', value: orgao || '—', icon: Building2 },
                  { label: 'Licitação', value: numeroLicitacao || '—', icon: FileText },
                  { label: 'Itens', value: `${totalItens} · R$ ${valorGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CreditCard },
                  { label: 'Declarações', value: `${Object.values(declaracoes).filter(Boolean).length + declaracoesCustom.length} ativa(s)`, icon: Scale },
                ].map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className="rounded-lg border border-border bg-muted p-4 text-center">
                      <Icon className="mx-auto mb-1 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="truncate text-sm font-semibold text-foreground">{s.value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Validation warnings */}
              {(!orgao || !objeto) && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  <AlertDescription>
                    {!orgao && 'Órgão gerenciador não informado. '}
                    {!objeto && 'Objeto da licitação não informado. '}
                    Preencha na etapa 4.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isLoading || isExtracting || !orgao || !objeto}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Gerando proposta...</>
                ) : (
                  <><Sparkles className="w-5 h-5" aria-hidden="true" /> Gerar Proposta Comercial com IA</>
                )}
              </Button>
            </div>
          )}

          {/* Navegação — a ação de avançar mora no rodapé de todos os passos */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1} size="sm">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Anterior
            </Button>
            <div className="flex items-center gap-1.5">
              {STEPS.map(step => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  aria-label={`Ir para a etapa ${step.id}: ${step.label}`}
                  aria-current={currentStep === step.id ? 'step' : undefined}
                  className={`h-2 rounded-full transition-all ${
                    currentStep === step.id ? 'w-4 bg-primary' : completed.has(step.id) ? 'w-2 bg-success' : 'w-2 bg-border'
                  }`}
                />
              ))}
            </div>
            <Button onClick={nextStep} disabled={currentStep === STEPS.length} size="sm">
              Próximo <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Result */}
        {proposal && (
          <div ref={resultRef} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <CheckCircle className="w-5 h-5 text-success" aria-hidden="true" />
                Proposta comercial gerada
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <PropostaDownload
                  licitacaoId={processoId}
                  onArquivado={() => setNonceArquivo((n) => n + 1)}
                  proposal={proposal}
                  numeroLicitacao={numeroLicitacao}
                  timbradoUrl={timbradoUrl}
                  empresaData={empresaAtiva}
                  repData={{
                    nome: repNome,
                    cpf: repCpf,
                    rg: repRg,
                    orgaoExp: repOrgaoExp,
                    cargo: repCargo,
                    naturalidade: repNaturalidade,
                    nacionalidade: repNacionalidade,
                    estadoCivil: repEstadoCivil,
                    endereco: repEndereco,
                  }}
                  bancData={{ banco, agencia, conta, tipoConta, pix }}
                  itens={itens}
                  licitacaoData={{
                    orgao,
                    modalidade,
                    objeto,
                    valorEstimado,
                    prazoValidade,
                    prazoPagamento,
                    prazoEntrega,
                    localEntrega,
                    liquidacaoNfe,
                    garantia,
                    condicoesEntrega,
                    anoDoCertame,
                    identificacaoEdital,
                    processoAdministrativo,
                  }}
                  telefone={telefone}
                  email={email}
                  inscEstadual={inscEstadual}
                  inscMunicipal={inscMunicipal}
                  pageOrientation={pageOrientation}
                />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>


            {/* Fac-símile do papel: a fonte é a escolhida para o documento, não a da interface. */}
            <div
              className="relative overflow-hidden rounded-lg border border-border bg-card p-8 shadow-sm"
              style={{ fontFamily: `'${fontFamily}', Times, serif` }}
            >
              {/* Marca d'água */}
              {usarMarcaDagua && timbradoUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                  <img
                    src={timbradoUrl}
                    alt=""
                    className="w-[400px] h-[400px] object-contain opacity-[0.06]"
                    style={{ transform: 'rotate(-25deg)' }}
                  />
                </div>
              )}
              <div className="relative z-10">
                <PropostaRenderer
                  proposal={proposal}
                  timbradoUrl={timbradoUrl}
                  usarMarcaDagua={usarMarcaDagua}
                  empresaData={empresaAtiva}
                  repData={{
                    nome: repNome,
                    cpf: repCpf,
                    cargo: repCargo,
                  }}
                />
              </div>
            </div>
          </div>
        )}
          </div>{/* End left panel */}

          {/* Right: Live Preview */}
          {showPreview && !isMobile && (
            <div className="w-1/2 min-w-0">
              <div className="sticky top-20">
                <div className="mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-semibold text-muted-foreground">Prévia em tempo real</span>
                </div>
                <div className="max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-border shadow-sm scrollbar-thin">
                  <PropostaLivePreview
                    empresa={empresaAtiva}
                    telefone={telefone}
                    email={email}
                    inscEstadual={inscEstadual}
                    inscMunicipal={inscMunicipal}
                    repNome={repNome}
                    repCpf={repCpf}
                    repRg={repRg}
                    repOrgaoExp={repOrgaoExp}
                    repCargo={repCargo}
                    repNaturalidade={repNaturalidade}
                    repNacionalidade={repNacionalidade}
                    repEstadoCivil={repEstadoCivil}
                    repEndereco={repEndereco}
                    numeroLicitacao={numeroLicitacao}
                    orgao={orgao}
                    modalidade={modalidade}
                    anoDoCertame={anoDoCertame}
                    identificacaoEdital={identificacaoEdital}
                    processoAdministrativo={processoAdministrativo}
                    objeto={objeto}
                    valorEstimado={valorEstimado}
                    prazoValidade={prazoValidade}
                    prazoPagamento={prazoPagamento}
                    prazoEntrega={prazoEntrega}
                    localEntrega={localEntrega}
                    garantia={garantia}
                    condicoesEntrega={condicoesEntrega}
                    liquidacaoNfe={liquidacaoNfe}
                    itens={itens}
                    declaracoesAtivas={declaracoesAtivasLabels}
                    banco={banco}
                    agencia={agencia}
                    conta={conta}
                    tipoConta={tipoConta}
                    pix={pix}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    timbradoUrl={timbradoUrl}
                    usarMarcaDagua={usarMarcaDagua}
                    pageOrientation={pageOrientation}
                  />
                </div>
              </div>
            </div>
          )}
        </div>{/* End split-screen */}
      </div>
  );

  // Embutido (aba Proposta do prontuário) o layout global já existe em volta.
  return embedded ? conteudo : <AppLayout>{conteudo}</AppLayout>;
}
