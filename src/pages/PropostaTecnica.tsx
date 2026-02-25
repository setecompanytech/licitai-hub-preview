import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Sparkles, Loader2, Copy, CheckCircle } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { toast } from 'sonner';
import EditalUploader, { type ExtractedEditalData, type EditalItem } from '@/components/proposta/EditalUploader';
import PlanilhaPrecos from '@/components/proposta/PlanilhaPrecos';
import TimbradoUploader from '@/components/proposta/TimbradoUploader';
import EnvioProposta from '@/components/proposta/EnvioProposta';
import PropostaDownload from '@/components/proposta/PropostaDownload';
import { Send } from 'lucide-react';

export default function PropostaTecnica() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const { pendingItems, clearPending, hasPending } = usePropostaCart();
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [proposal, setProposal] = useState('');
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Timbrado
  const [timbradoUrl, setTimbradoUrl] = useState<string | null>(null);

  // Form fields
  const [numeroLicitacao, setNumeroLicitacao] = useState('');
  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('Pregão Eletrônico');
  const [objeto, setObjeto] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [prazoValidade, setPrazoValidade] = useState('60 dias corridos');
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

  // Dados bancários
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');

  // Empresa extras
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (proposal && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [proposal]);

  // Import pending items from Precificação
  useEffect(() => {
    if (hasPending) {
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
  }, []);

  const handleEditalExtracted = (data: ExtractedEditalData) => {
    if (data.numeroLicitacao) setNumeroLicitacao(data.numeroLicitacao);
    if (data.orgao) setOrgao(data.orgao);
    if (data.modalidade) setModalidade(data.modalidade);
    if (data.objeto) setObjeto(data.objeto);
    if (data.valorEstimado) setValorEstimado(data.valorEstimado);
    if (data.prazoValidade) setPrazoValidade(data.prazoValidade);
    if (data.localEntrega) setLocalEntrega(data.localEntrega);
    if (data.liquidacaoNfe) setLiquidacaoNfe(data.liquidacaoNfe);
    if (data.itens && data.itens.length > 0) setItens(data.itens);
    if (data.rawText) setEditalRawText(data.rawText);
  };

  const buildContext = () => {
    const parts: string[] = [];

    if (empresaAtiva) {
      parts.push(`## Dados da Empresa`);
      parts.push(`- Razão Social: ${empresaAtiva.razao_social}`);
      if (empresaAtiva.nome_fantasia) parts.push(`- Nome Fantasia: ${empresaAtiva.nome_fantasia}`);
      parts.push(`- CNPJ: ${empresaAtiva.cnpj}`);
      if (empresaAtiva.cnae_principal) parts.push(`- CNAE Principal: ${empresaAtiva.cnae_principal}`);
      if (empresaAtiva.uf) parts.push(`- UF: ${empresaAtiva.uf}`);
      if (empresaAtiva.municipio) parts.push(`- Município: ${empresaAtiva.municipio}`);
    }

    if (telefone) parts.push(`- Telefone: ${telefone}`);
    if (email) parts.push(`- E-mail: ${email}`);

    parts.push(`\n## Dados do Representante Legal`);
    if (repNome) parts.push(`- Nome: ${repNome}`);
    if (repCpf) parts.push(`- CPF: ${repCpf}`);
    if (repRg) parts.push(`- RG: ${repRg} — Expedido por: ${repOrgaoExp}`);
    if (repCargo) parts.push(`- Cargo/Função: ${repCargo}`);
    if (repNaturalidade) parts.push(`- Naturalidade: ${repNaturalidade}`);
    if (repNacionalidade) parts.push(`- Nacionalidade: ${repNacionalidade}`);

    parts.push(`\n## Dados Bancários`);
    if (banco) parts.push(`- Banco: ${banco}`);
    if (agencia) parts.push(`- Agência: ${agencia}`);
    if (conta) parts.push(`- Conta Corrente: ${conta}`);

    parts.push(`\n## Dados da Licitação`);
    if (numeroLicitacao) parts.push(`- Número: ${numeroLicitacao}`);
    if (orgao) parts.push(`- Órgão: ${orgao}`);
    parts.push(`- Modalidade: ${modalidade}`);
    if (objeto) parts.push(`- Objeto: ${objeto}`);
    if (valorEstimado) parts.push(`- Valor Estimado: R$ ${valorEstimado}`);
    if (prazoValidade) parts.push(`- Prazo de Validade: ${prazoValidade}`);
    if (localEntrega) parts.push(`- Local de Entrega: ${localEntrega}`);
    if (liquidacaoNfe) parts.push(`- Liquidação NFe: ${liquidacaoNfe}`);

    if (itens.length > 0 && itens.some(i => i.descricao.trim())) {
      parts.push(`\n## Planilha de Preços`);
      parts.push('| Item | Descrição | Qtd | Und | Vlr Unit (R$) | Vlr Unit Extenso | Vlr Total (R$) | Vlr Total Extenso |');
      parts.push('|------|-----------|-----|-----|---------------|------------------|----------------|-------------------|');
      itens.forEach(i => {
        parts.push(`| ${i.item} | ${i.descricao} | ${i.quantidade} | ${i.unidade} | ${i.valorUnitario} | ${i.valorUnitarioExtenso} | ${i.valorTotal} | ${i.valorTotalExtenso} |`);
      });
      const total = itens.reduce((s, i) => s + (parseFloat(i.valorTotal.replace(',', '.')) || 0), 0);
      parts.push(`\nValor Global: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
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

    setIsLoading(true);
    setProposal('');
    let content = '';

    await streamAIChat({
      messages: [{ role: 'user', content: 'Gere a Proposta Comercial/Técnica completa seguindo a estrutura definida, com todas as declarações obrigatórias, preenchendo os dados da empresa e do representante legal fornecidos.' }],
      action: 'proposta_tecnica',
      context: buildContext(),
      onDelta: (chunk) => { content += chunk; setProposal(content); },
      onDone: () => { setIsLoading(false); toast.success('Proposta gerada com sucesso!'); },
      onError: (error) => { toast.error(error); setIsLoading(false); },
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(proposal);
    setCopied(true);
    toast.success('Proposta copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            Proposta Comercial / Técnica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie o edital para extração automática por IA e gere propostas completas com declarações obrigatórias
          </p>
        </div>

        {/* Edital Upload */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            1. Upload do Edital
          </h2>
          <p className="text-sm text-muted-foreground">
            Envie o edital em PDF ou TXT para que a IA extraia automaticamente os dados da licitação.
          </p>
          <EditalUploader onExtracted={handleEditalExtracted} isExtracting={isExtracting} setIsExtracting={setIsExtracting} />
        </div>

        {/* Company & Representative Info */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-6">
          <h2 className="font-semibold text-lg">2. Dados da Empresa e Representante Legal</h2>

          {empresaAtiva && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium text-foreground mb-1">Empresa selecionada:</p>
              <p className="text-muted-foreground">
                {empresaAtiva.razao_social} — CNPJ: {empresaAtiva.cnpj}
                {empresaAtiva.uf && ` — ${empresaAtiva.municipio || ''}/${empresaAtiva.uf}`}
              </p>
            </div>
          )}

          <TimbradoUploader empresaId={empresaAtiva?.id} timbradoUrl={timbradoUrl} setTimbradoUrl={setTimbradoUrl} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(XX) XXXXX-XXXX" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input placeholder="contato@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-sm font-medium text-foreground mb-3">Representante Legal</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={repNome} onChange={e => setRepNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
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
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-sm font-medium text-foreground mb-3">Dados Bancários</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input value={banco} onChange={e => setBanco(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input value={agencia} onChange={e => setAgencia(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Conta Corrente</Label>
                <Input value={conta} onChange={e => setConta(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Licitação Data */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-6">
          <h2 className="font-semibold text-lg">3. Dados da Licitação</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número da Licitação *</Label>
              <Input placeholder="Ex: PE 001/2026" value={numeroLicitacao} onChange={e => setNumeroLicitacao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Órgão Licitante *</Label>
              <Input placeholder="Ex: SEGEP/Prefeitura Municipal de Belém" value={orgao} onChange={e => setOrgao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Input value={modalidade} onChange={e => setModalidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor Estimado (R$)</Label>
              <Input placeholder="500000.00" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Objeto da Licitação *</Label>
            <Textarea placeholder="Descrição detalhada do produto ou serviço conforme Termo de Referência..." value={objeto} onChange={e => setObjeto(e.target.value)} rows={4} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prazo de Validade</Label>
              <Input value={prazoValidade} onChange={e => setPrazoValidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Local e Horário de Entrega</Label>
              <Input value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Liquidação da NFe</Label>
              <Input placeholder="Conforme edital" value={liquidacaoNfe} onChange={e => setLiquidacaoNfe(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Planilha de preços e Envio */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-6">
          <h2 className="font-semibold text-lg">4. Planilha de Preços e Envio da Proposta</h2>
          <PlanilhaPrecos itens={itens} setItens={setItens} />
          <div className="border-t border-border/50 pt-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Send className="w-4 h-4 text-accent" />
              Envio da Proposta
            </p>
            <p className="text-sm text-muted-foreground">
              Prepare e envie sua proposta para portais de compras públicas
            </p>
            <EnvioProposta />
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isLoading || isExtracting}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3"
          size="lg"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Gerando proposta...</>
          ) : (
            <><Sparkles className="w-5 h-5 mr-2" /> Gerar Proposta Comercial / Técnica com IA</>
          )}
        </Button>

        {/* Result */}
        {proposal && (
          <div ref={resultRef} className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Proposta Comercial / Técnica Gerada
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <PropostaDownload proposal={proposal} numeroLicitacao={numeroLicitacao} timbradoUrl={timbradoUrl} />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCircle className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>

            {timbradoUrl && (
              <div className="border-b border-border/50 pb-4 mb-4">
                <img src={timbradoUrl} alt="Timbrado" className="h-20 max-w-[300px] object-contain" />
              </div>
            )}

            <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-6 text-sm leading-relaxed">
              <ReactMarkdown>{proposal}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
