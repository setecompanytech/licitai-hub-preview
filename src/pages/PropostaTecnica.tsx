import { useState, useRef, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
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
  ShieldCheck, Stamp, Send, Calendar, MapPin, Clock, CreditCard,
  FileSignature, Upload as UploadIcon, Eye, AlertCircle, Banknote,
  PanelRightOpen, PanelRightClose
} from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { toast } from 'sonner';
import { valorPorExtenso } from '@/lib/numero-extenso';
import EditalUploader, { type ExtractedEditalData, type EditalItem } from '@/components/proposta/EditalUploader';
import PlanilhaPrecos from '@/components/proposta/PlanilhaPrecos';
import TimbradoUploader from '@/components/proposta/TimbradoUploader';
import EnvioProposta from '@/components/proposta/EnvioProposta';
import PropostaDownload from '@/components/proposta/PropostaDownload';
import PropostaRenderer from '@/components/proposta/PropostaRenderer';
import PropostaLivePreview from '@/components/proposta/PropostaLivePreview';
import DadosEmpresaUploader, { type ExtractedEmpresaData } from '@/components/proposta/DadosEmpresaUploader';
import BancoSelector from '@/components/proposta/BancoSelector';
import ImportarDoCatalogo from '@/components/proposta/ImportarDoCatalogo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRascunho } from '@/hooks/useRascunho';

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

export default function PropostaTecnica() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const { pendingItems, clearPending, hasPending } = usePropostaCart();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [proposal, setProposal] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(!isMobile);
  const resultRef = useRef<HTMLDivElement>(null);

  // Timbrado / Marca d'água
  const [timbradoUrl, setTimbradoUrl] = useState<string | null>(empresaAtiva?.timbrado_url ?? null);
  const [usarMarcaDagua, setUsarMarcaDagua] = useState(true);

  // Auto-sync timbrado when empresa changes
  useEffect(() => {
    if (empresaAtiva?.timbrado_url) {
      setTimbradoUrl(empresaAtiva.timbrado_url);
    }
  }, [empresaAtiva?.timbrado_url]);

  // Form fields
  const [numeroLicitacao, setNumeroLicitacao] = useState('');
  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('Pregão Eletrônico');
  const [objeto, setObjeto] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [prazoValidade, setPrazoValidade] = useState('60 dias corridos');
  const [prazoPagamento, setPrazoPagamento] = useState('Até 30 dias após recebimento definitivo e apresentação da Nota Fiscal');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [localEntrega, setLocalEntrega] = useState('');
  const [liquidacaoNfe, setLiquidacaoNfe] = useState('');
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

  // ── Rascunho (Draft) ──
  const { loadRascunho, autoSave, saving, lastSaved, markLoaded, deleteRascunho, rascunhoId } = useRascunho<any>({
    modulo: 'proposta',
    licitacaoId: null,
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
    fontFamily, fontSize, lineSpacing, marginStyle, currentStep,
    timbradoUrl, usarMarcaDagua,
  }), [
    numeroLicitacao, orgao, modalidade, objeto, valorEstimado,
    prazoValidade, prazoPagamento, prazoEntrega, localEntrega, liquidacaoNfe,
    editalRawText, itens, repNome, repCpf, repRg, repOrgaoExp, repCargo,
    repNaturalidade, repNacionalidade, repEstadoCivil, repEndereco,
    banco, agencia, conta, tipoConta, pix, telefone, email,
    inscEstadual, inscMunicipal, declaracoes, declaracoesCustom,
    fontFamily, fontSize, lineSpacing, marginStyle, currentStep,
    timbradoUrl, usarMarcaDagua,
  ]);

  // Restore draft on mount
  useEffect(() => {
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
        if (data.itens?.length > 0) setItens(data.itens);
        if (data.repNome) setRepNome(data.repNome);
        if (data.repCpf) setRepCpf(data.repCpf);
        if (data.repRg) setRepRg(data.repRg);
        if (data.repOrgaoExp) setRepOrgaoExp(data.repOrgaoExp);
        if (data.repCargo) setRepCargo(data.repCargo);
        if (data.repNaturalidade) setRepNaturalidade(data.repNaturalidade);
        if (data.repNacionalidade) setRepNacionalidade(data.repNacionalidade);
        if (data.repEstadoCivil) setRepEstadoCivil(data.repEstadoCivil);
        if (data.repEndereco) setRepEndereco(data.repEndereco);
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
        if (data.currentStep) setCurrentStep(data.currentStep);
        if (data.timbradoUrl) setTimbradoUrl(data.timbradoUrl);
        if (typeof data.usarMarcaDagua === 'boolean') setUsarMarcaDagua(data.usarMarcaDagua);
        toast.info('Rascunho restaurado automaticamente.');
      }
      markLoaded();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (empresaAtiva) {
      if (empresaAtiva.inscricao_estadual) setInscEstadual(empresaAtiva.inscricao_estadual);
      if (empresaAtiva.inscricao_municipal) setInscMunicipal(empresaAtiva.inscricao_municipal);
      if (empresaAtiva.telefone) setTelefone(empresaAtiva.telefone);
      if (empresaAtiva.email) setEmail(empresaAtiva.email);
      // Auto-fill representative data from Configurações
      if ((empresaAtiva as any).rep_nome) setRepNome((empresaAtiva as any).rep_nome);
      if ((empresaAtiva as any).rep_cpf) setRepCpf((empresaAtiva as any).rep_cpf);
      if ((empresaAtiva as any).rep_rg) setRepRg((empresaAtiva as any).rep_rg);
      if ((empresaAtiva as any).rep_orgao_expedidor) setRepOrgaoExp((empresaAtiva as any).rep_orgao_expedidor);
      if ((empresaAtiva as any).rep_cargo) setRepCargo((empresaAtiva as any).rep_cargo);
      if ((empresaAtiva as any).rep_naturalidade) setRepNaturalidade((empresaAtiva as any).rep_naturalidade);
      if ((empresaAtiva as any).rep_nacionalidade) setRepNacionalidade((empresaAtiva as any).rep_nacionalidade);
    }
  }, [empresaAtiva]);

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

  const handleEditalExtracted = (data: ExtractedEditalData) => {
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
    if (data.itens && data.itens.length > 0) setItens(data.itens);
    if (data.rawText) setEditalRawText(data.rawText);
    toast.info('Dados extraídos! Avance para revisá-los.');
  };

  const handleEmpresaExtracted = (data: ExtractedEmpresaData) => {
    if (data.telefone) setTelefone(data.telefone);
    if (data.email) setEmail(data.email);
    if (data.repNome) setRepNome(data.repNome);
    if (data.repCpf) setRepCpf(data.repCpf);
    if (data.repRg) setRepRg(data.repRg);
    if (data.repOrgaoExp) setRepOrgaoExp(data.repOrgaoExp);
    if (data.repCargo) setRepCargo(data.repCargo);
    if (data.repNaturalidade) setRepNaturalidade(data.repNaturalidade);
    if (data.repNacionalidade) setRepNacionalidade(data.repNacionalidade);
    if (data.banco) setBanco(data.banco);
    if (data.agencia) setAgencia(data.agencia);
    if (data.conta) setConta(data.conta);
  };

  const buildContext = () => {
    const parts: string[] = [];

    parts.push(`## Preferências de Formatação`);
    parts.push(`- Fonte: ${fontFamily}, Tamanho: ${fontSize}pt, Espaçamento: ${lineSpacing}, Margens: ${marginStyle}`);

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
    if (valorEstimado) parts.push(`- Valor Estimado: R$ ${valorEstimado}`);
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
      const total = itens.reduce((s, i) => s + (parseFloat(i.valorTotal.replace(',', '.')) || 0), 0);
      parts.push(`\nValor Global: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
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
    if (!objeto.trim()) { toast.error('Informe o objeto da licitação'); return; }
    if (!orgao.trim()) { toast.error('Informe o órgão licitante'); return; }

    if (itens.filter(i => i.descricao.trim()).length === 0) {
      toast.warning('Nenhum item na planilha de preços. A proposta será gerada sem planilha.');
    }

    if (!repNome || !repCpf) {
      toast.warning('Representante legal não preenchido. Verifique a aba Representante.');
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
        onDone: () => { setIsLoading(false); toast.success('Proposta gerada com sucesso!'); },
        onError: (error) => { 
          toast.error('Erro ao gerar proposta', { description: error, duration: 8000 }); 
          setIsLoading(false); 
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

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, STEPS.length));
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
  const valorGlobal = itens.reduce((s, i) => s + (parseFloat(i.valorTotal.replace(',', '.')) || 0), 0);

  const declaracoesAtivasLabels = DECLARACOES_PADRAO
    .filter(d => declaracoes[d.key])
    .map(d => d.label)
    .concat(declaracoesCustom.filter(d => d.trim()));

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-accent" />
              Proposta Comercial
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              Montagem assistida por IA · Modelo conforme Lei 14.133/2021 e ABNT NBR 14724
              {lastSaved && (
                <span className="inline-flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  {saving ? 'Salvando...' : `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              )}
            </p>
          </div>
          {!isMobile && (
            <Button
              variant={showPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              {showPreview ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              {showPreview ? 'Ocultar Preview' : 'Mostrar Preview'}
            </Button>
          )}
        </div>

        {/* Split-screen layout */}
        <div className={`flex gap-4 ${showPreview && !isMobile ? '' : ''}`}>
          {/* Left: Form */}
          <div className={`${showPreview && !isMobile ? 'w-1/2 min-w-0' : 'w-full max-w-6xl mx-auto'} space-y-4`}>

        {/* Stepper */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-3">
          <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isDone = completed.has(step.id);
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`group flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
                    isActive
                      ? 'bg-accent text-accent-foreground shadow-md'
                      : isDone
                        ? 'bg-accent/10 text-accent hover:bg-accent/20'
                        : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    isActive ? 'bg-accent-foreground/20' : isDone ? 'bg-accent/20' : 'bg-muted'
                  }`}>
                    {isDone && !isActive ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="leading-tight">{step.label}</div>
                    <div className="text-[9px] opacity-60 leading-tight">{step.desc}</div>
                  </div>
                  {idx < STEPS.length - 1 && <ChevronRight className="w-3 h-3 ml-0.5 opacity-20" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
          {/* Step 1: Edital Upload */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Upload do Edital</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Envie o edital (PDF, DOC, DOCX ou TXT) para que a IA extraia automaticamente: órgão gerenciador, número do processo,
                objeto, planilha de itens com quantidades e preços, prazos de validade, pagamento, entrega e local de entrega.
              </p>
              <EditalUploader onExtracted={handleEditalExtracted} isExtracting={isExtracting} setIsExtracting={setIsExtracting} />

              {/* Quick summary of extracted data */}
              {(editalRawText || numeroLicitacao) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  {[
                    { label: 'Órgão', value: orgao, icon: Building2 },
                    { label: 'Licitação', value: numeroLicitacao, icon: FileText },
                    { label: 'Itens', value: `${totalItens} encontrado(s)`, icon: CreditCard },
                    { label: 'Modalidade', value: modalidade, icon: Receipt },
                  ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={i} className="bg-accent/5 rounded-lg p-3 border border-accent/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5 text-accent" />
                          <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
                        </div>
                        <p className="text-xs font-semibold text-foreground truncate">{s.value || '—'}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Empresa */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Dados da Empresa Licitante</h2>
              </div>

              {empresaAtiva ? (
                <div className="space-y-3">
                  <div className="bg-accent/5 rounded-lg p-4 text-sm border border-accent/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground mb-1">{empresaAtiva.razao_social}</p>
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
                        className="shrink-0 text-xs gap-1.5"
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
                        <Building2 className="w-3.5 h-3.5" />
                        Preencher via Configurações
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">Nenhuma empresa ativa selecionada. Selecione uma empresa no menu superior.</p>
                </div>
              )}

              <DadosEmpresaUploader onExtracted={handleEmpresaExtracted} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input placeholder="(XX) XXXXX-XXXX" value={telefone} onChange={e => setTelefone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input placeholder="contato@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input placeholder="ISENTO ou número" value={inscEstadual} onChange={e => setInscEstadual(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Inscrição Municipal</Label>
                  <Input value={inscMunicipal} onChange={e => setInscMunicipal(e.target.value)} />
                </div>
              </div>

              <div className="border-t border-border/50 pt-4">
                <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-accent" /> Dados Bancários
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <BancoSelector value={banco} onChange={setBanco} />
                  </div>
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input value={agencia} onChange={e => setAgencia(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input value={conta} onChange={e => setConta(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Conta</Label>
                    <Select value={tipoConta} onValueChange={setTipoConta}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Conta Corrente">Conta Corrente</SelectItem>
                        <SelectItem value="Conta Poupança">Conta Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Chave PIX (opcional)</Label>
                    <Input placeholder="CNPJ, e-mail, telefone ou chave aleatória" value={pix} onChange={e => setPix(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Representante Legal */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Representante Legal</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Preencha os dados do representante legal que assinará a proposta. Esses dados podem ser extraídos automaticamente
                do contrato social ou procuração na etapa anterior.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={repNome} onChange={e => setRepNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input placeholder="000.000.000-00" value={repCpf} onChange={e => setRepCpf(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={repRg} onChange={e => setRepRg(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Órgão Expedidor</Label>
                  <Input placeholder="SSP/XX" value={repOrgaoExp} onChange={e => setRepOrgaoExp(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo / Função</Label>
                  <Input placeholder="Sócio-Administrador" value={repCargo} onChange={e => setRepCargo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Naturalidade</Label>
                  <Input value={repNaturalidade} onChange={e => setRepNaturalidade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidade</Label>
                  <Input value={repNacionalidade} onChange={e => setRepNacionalidade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado Civil</Label>
                  <Select value={repEstadoCivil} onValueChange={setRepEstadoCivil}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
                  <Label>Endereço do Representante</Label>
                  <Input placeholder="Rua, número, bairro, cidade/UF" value={repEndereco} onChange={e => setRepEndereco(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Dados da Licitação */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Dados da Licitação</h2>
              </div>

              {editalRawText && (
                <div className="flex items-center gap-2 p-2.5 bg-accent/5 border border-accent/15 rounded-lg text-xs text-accent">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  Campos pré-preenchidos pela extração do edital. Revise e ajuste conforme necessário.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número da Licitação *</Label>
                  <Input placeholder="Ex: PE 001/2026" value={numeroLicitacao} onChange={e => setNumeroLicitacao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Órgão Gerenciador *</Label>
                  <Input placeholder="Ex: SEGEP/Prefeitura Municipal de Belém" value={orgao} onChange={e => setOrgao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <Select value={modalidade} onValueChange={setModalidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pregão Eletrônico">Pregão Eletrônico</SelectItem>
                      <SelectItem value="Pregão Presencial">Pregão Presencial</SelectItem>
                      <SelectItem value="Concorrência">Concorrência</SelectItem>
                      <SelectItem value="Tomada de Preços">Tomada de Preços</SelectItem>
                      <SelectItem value="Convite">Convite</SelectItem>
                      <SelectItem value="Dispensa de Licitação">Dispensa de Licitação</SelectItem>
                      <SelectItem value="Inexigibilidade">Inexigibilidade</SelectItem>
                      <SelectItem value="RDC">RDC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor Estimado (R$)</Label>
                  <Input placeholder="500.000,00" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Objeto da Licitação *</Label>
                <Textarea placeholder="Descrição detalhada do produto ou serviço conforme Termo de Referência..." value={objeto} onChange={e => setObjeto(e.target.value)} rows={4} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-accent" /> Validade da Proposta Comercial</Label>
                  <Input value={prazoValidade} onChange={e => setPrazoValidade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-accent" /> Prazo de Pagamento</Label>
                  <Input placeholder="Até 30 dias após recebimento definitivo" value={prazoPagamento} onChange={e => setPrazoPagamento(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-accent" /> Prazo de Entrega</Label>
                  <Input placeholder="Até X dias úteis/corridos após emissão da OF" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-accent" /> Local de Entrega</Label>
                  <Input value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Condições de Liquidação / NFe</Label>
                  <Input placeholder="Conforme edital" value={liquidacaoNfe} onChange={e => setLiquidacaoNfe(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Planilha de Preços */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent" />
                  <h2 className="font-semibold text-lg">Planilha de Preços</h2>
                </div>
                {totalItens > 0 && (
                  <Badge variant="outline" className="text-xs">
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
                  setItens(prev => {
                    const hasEmpty = prev.length === 1 && !prev[0].descricao.trim();
                    const base = hasEmpty ? [] : prev;
                    const newItens = catalogItems.map((ci, idx) => ({
                      item: String(base.length + idx + 1),
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
                    }));
                    return [...base, ...newItens];
                  });
                  toast.success(`${catalogItems.length} item(ns) importado(s) do catálogo!`);
                }}
                licitacaoNumero={numeroLicitacao}
              />

              <PlanilhaPrecos itens={itens} setItens={setItens} />
            </div>
          )}

          {/* Step 6: Declarações */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Declarações Obrigatórias</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione as declarações que devem constar na proposta conforme exigências do edital e legislação vigente.
              </p>
              <div className="space-y-2">
                {DECLARACOES_PADRAO.map(decl => (
                  <label
                    key={decl.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      declaracoes[decl.key]
                        ? 'border-accent/30 bg-accent/5'
                        : 'border-border/50 hover:bg-muted/30'
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
                  <p className="text-sm font-medium">Declarações adicionais:</p>
                  {declaracoesCustom.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={d} onChange={e => {
                        const upd = [...declaracoesCustom];
                        upd[i] = e.target.value;
                        setDeclaracoesCustom(upd);
                      }} className="text-sm" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeclaracoesCustom(prev => prev.filter((_, idx) => idx !== i))}>✕</Button>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => setDeclaracoesCustom(prev => [...prev, ''])}>
                + Adicionar declaração personalizada
              </Button>
            </div>
          )}

          {/* Step 7: Formatação e Marca d'Água */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <Settings2 className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Formatação e Marca d'Água</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Calibri">Calibri</SelectItem>
                      <SelectItem value="Verdana">Verdana</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamanho: {fontSize}pt</Label>
                  <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={10} max={14} step={1} className="mt-3" />
                </div>
                <div className="space-y-2">
                  <Label>Espaçamento</Label>
                  <Select value={lineSpacing} onValueChange={setLineSpacing}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">Simples (1.0)</SelectItem>
                      <SelectItem value="1.15">1.15</SelectItem>
                      <SelectItem value="1.5">1.5 (ABNT)</SelectItem>
                      <SelectItem value="2.0">Duplo (2.0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Margens</Label>
                  <Select value={marginStyle} onValueChange={setMarginStyle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABNT (3/2 cm)">ABNT (3/2 cm)</SelectItem>
                      <SelectItem value="Normal (2.5 cm)">Normal (2.5 cm)</SelectItem>
                      <SelectItem value="Estreita (1.27 cm)">Estreita (1.27 cm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-4">
                <p className="font-medium text-sm flex items-center gap-2"><Stamp className="w-4 h-4 text-accent" /> Timbrado e Marca d'Água</p>
                <TimbradoUploader empresaId={empresaAtiva?.id} timbradoUrl={timbradoUrl} setTimbradoUrl={setTimbradoUrl} />
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  usarMarcaDagua ? 'border-accent/30 bg-accent/5' : 'border-border/50 hover:bg-muted/30'
                }`}>
                  <Checkbox checked={usarMarcaDagua} onCheckedChange={(v) => setUsarMarcaDagua(!!v)} />
                  <div>
                    <p className="text-sm font-medium">Aplicar logomarca como marca d'água</p>
                    <p className="text-xs text-muted-foreground">A logomarca do timbrado será exibida como fundo translúcido em todas as páginas</p>
                  </div>
                </label>
              </div>

              {/* Envio da Proposta */}
              <div className="border-t border-border/50 pt-4 space-y-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Send className="w-4 h-4 text-accent" /> Envio da Proposta
                </p>
                <p className="text-sm text-muted-foreground">Prepare e envie sua proposta para portais de compras públicas</p>
                <EnvioProposta />
              </div>
            </div>
          )}

          {/* Step 8: Gerar */}
          {currentStep === 8 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Gerar Proposta Final</h2>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Órgão', value: orgao || '—', icon: Building2, color: 'text-accent' },
                  { label: 'Licitação', value: numeroLicitacao || '—', icon: FileText, color: 'text-accent' },
                  { label: 'Itens', value: `${totalItens} · R$ ${valorGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CreditCard, color: 'text-accent' },
                  { label: 'Declarações', value: `${Object.values(declaracoes).filter(Boolean).length + declaracoesCustom.length} ativa(s)`, icon: Scale, color: 'text-accent' },
                ].map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className="bg-muted/30 rounded-lg p-3 text-center border border-border/30">
                      <Icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-xs font-semibold truncate">{s.value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Validation warnings */}
              {(!orgao || !objeto) && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">
                    {!orgao && 'Órgão gerenciador não informado. '}
                    {!objeto && 'Objeto da licitação não informado. '}
                    Preencha na etapa 4.
                  </p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isLoading || isExtracting || !orgao || !objeto}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3"
                size="lg"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Gerando proposta...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Gerar Proposta Comercial com IA</>
                )}
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-border/50">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1} size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <div className="flex items-center gap-1.5">
              {STEPS.map(step => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentStep === step.id ? 'bg-accent w-4' : completed.has(step.id) ? 'bg-accent/40' : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
            <Button onClick={nextStep} disabled={currentStep === STEPS.length} size="sm">
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Result */}
        {proposal && (
          <div ref={resultRef} className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Proposta Comercial Gerada
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <PropostaDownload
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
                  }}
                  bancData={{ banco, agencia, conta }}
                  itens={itens}
                  licitacaoData={{
                    orgao,
                    modalidade,
                    objeto,
                    valorEstimado,
                    prazoValidade,
                    localEntrega,
                    liquidacaoNfe,
                  }}
                  telefone={telefone}
                  email={email}
                />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCircle className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>


            <div
              className="bg-white dark:bg-card rounded-lg p-8 shadow-inner border border-border/30 relative overflow-hidden"
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
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-accent" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview em Tempo Real</span>
                </div>
                <div className="max-h-[calc(100vh-120px)] overflow-y-auto rounded-xl border border-border/50 shadow-sm scrollbar-thin">
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
                    objeto={objeto}
                    valorEstimado={valorEstimado}
                    prazoValidade={prazoValidade}
                    prazoPagamento={prazoPagamento}
                    prazoEntrega={prazoEntrega}
                    localEntrega={localEntrega}
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
                  />
                </div>
              </div>
            </div>
          )}
        </div>{/* End split-screen */}
      </div>
    </AppLayout>
  );
}
