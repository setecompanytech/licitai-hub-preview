import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Sparkles, Loader2, Copy, CheckCircle, Upload, ImageIcon, X } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function PropostaTecnica() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState('');
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timbrado
  const [timbradoUrl, setTimbradoUrl] = useState<string | null>(null);
  const [uploadingTimbrado, setUploadingTimbrado] = useState(false);

  // Form fields
  const [numeroLicitacao, setNumeroLicitacao] = useState('');
  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('Pregão Eletrônico');
  const [objeto, setObjeto] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [diferenciais, setDiferenciais] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Load existing timbrado
  useEffect(() => {
    if (!empresaAtiva) return;
    // Check if empresa has timbrado
    supabase
      .from('empresas')
      .select('timbrado_url')
      .eq('id', empresaAtiva.id)
      .single()
      .then(({ data }) => {
        if (data?.timbrado_url) setTimbradoUrl(data.timbrado_url);
        else setTimbradoUrl(null);
      });
  }, [empresaAtiva]);

  useEffect(() => {
    if (proposal && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [proposal]);

  const handleUploadTimbrado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresaAtiva || !user) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPG, WEBP ou SVG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setUploadingTimbrado(true);
    const ext = file.name.split('.').pop();
    const filePath = `${empresaAtiva.id}/timbrado.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('timbrados')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Erro ao enviar timbrado: ' + uploadError.message);
      setUploadingTimbrado(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('timbrados')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    await supabase
      .from('empresas')
      .update({ timbrado_path: filePath, timbrado_url: publicUrl })
      .eq('id', empresaAtiva.id);

    setTimbradoUrl(publicUrl);
    setUploadingTimbrado(false);
    toast.success('Timbrado enviado com sucesso!');
  };

  const handleRemoveTimbrado = async () => {
    if (!empresaAtiva) return;

    await supabase
      .from('empresas')
      .update({ timbrado_path: null, timbrado_url: null })
      .eq('id', empresaAtiva.id);

    setTimbradoUrl(null);
    toast.success('Timbrado removido.');
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
      if (timbradoUrl) parts.push(`- Timbrado da empresa disponível (será aplicado na impressão)`);
    }

    parts.push(`\n## Dados da Licitação`);
    if (numeroLicitacao) parts.push(`- Número: ${numeroLicitacao}`);
    if (orgao) parts.push(`- Órgão: ${orgao}`);
    parts.push(`- Modalidade: ${modalidade}`);
    if (objeto) parts.push(`- Objeto: ${objeto}`);
    if (valorEstimado) parts.push(`- Valor Estimado: R$ ${valorEstimado}`);

    if (experiencia.trim()) {
      parts.push(`\n## Experiência da Empresa`);
      parts.push(experiencia);
    }

    if (diferenciais.trim()) {
      parts.push(`\n## Diferenciais Competitivos`);
      parts.push(diferenciais);
    }

    if (observacoes.trim()) {
      parts.push(`\n## Observações Adicionais`);
      parts.push(observacoes);
    }

    return parts.join('\n');
  };

  const handleGenerate = async () => {
    if (!objeto.trim()) {
      toast.error('Informe o objeto da licitação');
      return;
    }
    if (!orgao.trim()) {
      toast.error('Informe o órgão licitante');
      return;
    }

    setIsLoading(true);
    setProposal('');
    let content = '';

    await streamAIChat({
      messages: [{ role: 'user', content: 'Gere uma proposta técnica completa com base nos dados fornecidos.' }],
      action: 'proposta_tecnica',
      context: buildContext(),
      onDelta: (chunk) => {
        content += chunk;
        setProposal(content);
      },
      onDone: () => {
        setIsLoading(false);
        toast.success('Proposta técnica gerada com sucesso!');
      },
      onError: (error) => {
        toast.error(error);
        setIsLoading(false);
      },
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
            Geração de Proposta Técnica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere propostas técnicas completas com IA baseadas nos dados da licitação e da sua empresa
          </p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-lg">Dados da Licitação</h2>
          </div>

          {empresaAtiva && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium text-foreground mb-1">Empresa selecionada:</p>
              <p className="text-muted-foreground">
                {empresaAtiva.razao_social} — CNPJ: {empresaAtiva.cnpj}
                {empresaAtiva.uf && ` — ${empresaAtiva.municipio || ''}/${empresaAtiva.uf}`}
              </p>
            </div>
          )}

          {/* Timbrado Upload */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Timbrado da Empresa
            </Label>

            {timbradoUrl ? (
              <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4 border border-border/50">
                <img
                  src={timbradoUrl}
                  alt="Timbrado"
                  className="h-16 max-w-[200px] object-contain rounded border border-border/50 bg-white p-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Timbrado carregado</p>
                  <p className="text-xs text-muted-foreground">Será aplicado no cabeçalho da proposta</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" />
                    Trocar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRemoveTimbrado} className="text-destructive hover:text-destructive">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingTimbrado || !empresaAtiva}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingTimbrado ? (
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                ) : (
                  <Upload className="w-8 h-8 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {uploadingTimbrado ? 'Enviando...' : 'Clique para enviar o timbrado'}
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, WEBP ou SVG — Máx. 5MB
                </span>
                {!empresaAtiva && (
                  <span className="text-xs text-destructive mt-1">Selecione uma empresa primeiro</span>
                )}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleUploadTimbrado}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número da Licitação</Label>
              <Input id="numero" placeholder="Ex: PE 001/2026" value={numeroLicitacao} onChange={(e) => setNumeroLicitacao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgao">Órgão Licitante *</Label>
              <Input id="orgao" placeholder="Ex: Prefeitura Municipal de São Paulo" value={orgao} onChange={(e) => setOrgao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modalidade">Modalidade</Label>
              <Input id="modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor Estimado (R$)</Label>
              <Input id="valor" placeholder="Ex: 500000.00" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objeto">Objeto da Licitação *</Label>
            <Textarea
              id="objeto"
              placeholder="Descreva detalhadamente o objeto da licitação (serviços, produtos, obras...)"
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="experiencia">Experiência e Atestados</Label>
            <Textarea
              id="experiencia"
              placeholder="Descreva projetos similares já realizados pela empresa, atestados de capacidade técnica..."
              value={experiencia}
              onChange={(e) => setExperiencia(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="diferenciais">Diferenciais Competitivos</Label>
            <Textarea
              id="diferenciais"
              placeholder="Certificações, equipamentos próprios, equipe especializada, tecnologias..."
              value={diferenciais}
              onChange={(e) => setDiferenciais(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações Adicionais</Label>
            <Textarea
              id="obs"
              placeholder="Informações extras que devem constar na proposta..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Gerando proposta...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Gerar Proposta Técnica com IA
              </>
            )}
          </Button>
        </div>

        {/* Result */}
        {proposal && (
          <div ref={resultRef} className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Proposta Técnica Gerada
              </h2>
              <div className="flex gap-2">
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

            <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-6 whitespace-pre-wrap text-sm leading-relaxed">
              {proposal}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
