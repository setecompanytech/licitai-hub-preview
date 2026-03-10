import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Bell, Globe, Shield, Newspaper, Search, Loader2, ExternalLink, CheckCircle2, AlertTriangle, ImageIcon, User, Save, CreditCard, Settings } from 'lucide-react';
import CnaesSecundarios from '@/components/configuracoes/CnaesSecundarios';
import PlanoAssinatura from '@/components/configuracoes/PlanoAssinatura';
import RepresentanteUploader, { type ExtractedRepresentanteData } from '@/components/configuracoes/RepresentanteUploader';
import TimbradoUploader from '@/components/proposta/TimbradoUploader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';

export default function Configuracoes() {
  const { empresaAtiva, reloadEmpresas } = useEmpresa();
  const location = useLocation();
  const defaultTab = location.hash === '#plano' ? 'plano' : 'geral';

  // Empresa fields
  const [cnpjInput, setCnpjInput] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnaePrincipal, setCnaePrincipal] = useState('');
  const [endereco, setEndereco] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [timbradoUrl, setTimbradoUrl] = useState<string | null>(null);

  // Representante fields
  const [repNome, setRepNome] = useState('');
  const [repCpf, setRepCpf] = useState('');
  const [repRg, setRepRg] = useState('');
  const [repOrgaoExp, setRepOrgaoExp] = useState('');
  const [repCargo, setRepCargo] = useState('');
  const [repNaturalidade, setRepNaturalidade] = useState('');
  const [repNacionalidade, setRepNacionalidade] = useState('Brasileira');

  // Loading states
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingSintegra, setLoadingSintegra] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [erroCnpj, setErroCnpj] = useState('');

  useEffect(() => {
    if (empresaAtiva) {
      setCnpjInput(empresaAtiva.cnpj || '');
      setRazaoSocial(empresaAtiva.razao_social || '');
      setNomeFantasia(empresaAtiva.nome_fantasia || '');
      setCnaePrincipal(empresaAtiva.cnae_principal || '');
      setEndereco(empresaAtiva.endereco || '');
      setComplemento(empresaAtiva.complemento || '');
      setBairro(empresaAtiva.bairro || '');
      setCep(empresaAtiva.cep || '');
      setCidade(empresaAtiva.municipio || '');
      setUf(empresaAtiva.uf || '');
      setTelefone(empresaAtiva.telefone || '');
      setEmail(empresaAtiva.email || '');
      setInscricaoMunicipal(empresaAtiva.inscricao_municipal || '');
      setInscricaoEstadual(empresaAtiva.inscricao_estadual || '');
      setTimbradoUrl(empresaAtiva.timbrado_url || null);
      // Representante
      setRepNome((empresaAtiva as any).rep_nome || '');
      setRepCpf((empresaAtiva as any).rep_cpf || '');
      setRepRg((empresaAtiva as any).rep_rg || '');
      setRepOrgaoExp((empresaAtiva as any).rep_orgao_expedidor || '');
      setRepCargo((empresaAtiva as any).rep_cargo || '');
      setRepNaturalidade((empresaAtiva as any).rep_naturalidade || '');
      setRepNacionalidade((empresaAtiva as any).rep_nacionalidade || 'Brasileira');
    }
  }, [empresaAtiva]);

  const handleSalvar = async () => {
    if (!empresaAtiva) {
      toast.error('Nenhuma empresa ativa selecionada');
      return;
    }
    setLoadingSalvar(true);
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          cnpj: cnpjInput,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia || null,
          cnae_principal: cnaePrincipal,
          endereco: endereco || null,
          complemento: complemento || null,
          bairro: bairro || null,
          cep: cep || null,
          municipio: cidade,
          uf: uf,
          telefone: telefone || null,
          email: email || null,
          inscricao_municipal: inscricaoMunicipal || null,
          inscricao_estadual: inscricaoEstadual || null,
          rep_nome: repNome || null,
          rep_cpf: repCpf || null,
          rep_rg: repRg || null,
          rep_orgao_expedidor: repOrgaoExp || null,
          rep_cargo: repCargo || null,
          rep_naturalidade: repNaturalidade || null,
          rep_nacionalidade: repNacionalidade || null,
        } as any)
        .eq('id', empresaAtiva.id);
      if (error) throw error;
      await reloadEmpresas();
      toast.success('Configurações salvas com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar configurações');
    } finally {
      setLoadingSalvar(false);
    }
  };

  const handleConsultaCNPJ = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setErroCnpj('CNPJ deve conter 14 dígitos');
      return;
    }
    setErroCnpj('');
    setLoadingCnpj(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: cnpjLimpo },
      });
      if (error) throw error;
      if (data.error) {
        setErroCnpj(data.error);
      } else {
        if (data.razaoSocial) setRazaoSocial(data.razaoSocial);
        if (data.nomeFantasia) setNomeFantasia(data.nomeFantasia);
        if (data.cnaePrincipal) setCnaePrincipal(data.cnaePrincipal);
        if (data.municipio) setCidade(data.municipio);
        if (data.uf) setUf(data.uf);
        if (data.endereco) setEndereco(data.endereco);
        setComplemento(data.complemento || '');
        setBairro(data.bairro || '');
        if (data.cep) setCep(data.cep);
        if (data.telefone) setTelefone(data.telefone);
        if (data.email && data.email.trim()) setEmail(data.email.trim());
        if (data.cnpj) setCnpjInput(data.cnpj);
        // IE comes directly from CNPJA (real SINTEGRA data) in consulta-cnpj
        if (data.inscricaoEstadual) setInscricaoEstadual(data.inscricaoEstadual);
        
        const sources = [];
        sources.push('Receita Federal');
        if (data.inscricaoEstadual) sources.push('SINTEGRA/Cadastro Contribuintes');
        if (data.email) sources.push('E-mail');
        toast.success(`Dados reais obtidos via ${sources.join(' + ')}!`);

        // Also trigger standalone SINTEGRA if IE wasn't found in the main query
        if (!data.inscricaoEstadual && data.uf) {
          await handleConsultaSintegraInternal(cnpjLimpo, data.uf);
        }
      }
    } catch (e: any) {
      setErroCnpj(e.message || 'Erro ao consultar CNPJ');
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleConsultaSintegraInternal = async (cnpjLimpo: string, ufParam: string) => {
    setLoadingSintegra(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-sintegra', {
        body: { cnpj: cnpjLimpo, uf: ufParam },
      });
      if (error) throw error;
      if (data?.inscricaoEstadual) {
        setInscricaoEstadual(data.inscricaoEstadual);
        toast.success('Inscrição Estadual obtida via SINTEGRA!');
      }
    } catch {
      // Silent
    } finally {
      setLoadingSintegra(false);
    }
  };

  const handleConsultaSintegra = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setErroCnpj('CNPJ deve conter 14 dígitos');
      return;
    }
    if (!uf) {
      setErroCnpj('Informe a UF para consultar o SINTEGRA');
      return;
    }
    setErroCnpj('');
    await handleConsultaSintegraInternal(cnpjLimpo, uf);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Personalize a plataforma para sua empresa</p>
        </div>

        <div className="space-y-6">
          {/* Dados da Empresa */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Dados da Empresa</h2>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={cnpjInput} onChange={e => setCnpjInput(e.target.value)} className="mt-1" placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <Label className="text-xs">CNAE Principal</Label>
                  <Input value={cnaePrincipal} onChange={e => setCnaePrincipal(e.target.value)} className="mt-1" />
                </div>
              </div>

              {/* Consulta buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConsultaCNPJ}
                  disabled={loadingCnpj || loadingSintegra}
                  className="text-xs gap-1.5"
                >
                  {loadingCnpj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Consultar Receita Federal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConsultaSintegra}
                  disabled={loadingCnpj || loadingSintegra}
                  className="text-xs gap-1.5"
                >
                  {loadingSintegra ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Consultar SINTEGRA
                </Button>
                <a
                  href="https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Receita Federal
                </a>
                <a
                  href="http://www.sintegra.gov.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> SINTEGRA
                </a>
              </div>

              {erroCnpj && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" /> {erroCnpj}
                </div>
              )}

              <div>
                <Label className="text-xs">Razão Social</Label>
                <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nome Fantasia</Label>
                <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className="mt-1" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">CEP</Label>
                  <Input value={cep} onChange={e => setCep(e.target.value)} className="mt-1" placeholder="00000-000" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Endereço (Logradouro, Nº)</Label>
                  <Input value={endereco} onChange={e => setEndereco(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Complemento</Label>
                  <Input value={complemento} onChange={e => setComplemento(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Input value={uf} onChange={e => setUf(e.target.value)} className="mt-1" maxLength={2} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Município</Label>
                <Input value={cidade} onChange={e => setCidade(e.target.value)} className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={telefone} onChange={e => setTelefone(e.target.value)} className="mt-1" placeholder="(XX) XXXXX-XXXX" />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} className="mt-1" placeholder="contato@empresa.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Inscrição Estadual</Label>
                  <Input
                    value={inscricaoEstadual}
                    onChange={e => setInscricaoEstadual(e.target.value)}
                    placeholder="Número da inscrição estadual"
                    className="mt-1"
                  />
                  {inscricaoEstadual && (
                    <Badge variant="outline" className="mt-1 text-[10px] bg-success/10 text-success border-success/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Preenchido
                    </Badge>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Inscrição Municipal</Label>
                  <Input
                    value={inscricaoMunicipal}
                    onChange={e => setInscricaoMunicipal(e.target.value)}
                    placeholder="Número da inscrição municipal"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Dados do Representante */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Dados do Representante Legal</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Preencha os dados do representante legal ou extraia automaticamente via upload de documento (contrato social, procuração, RG/CPF). Essas informações serão propagadas para propostas, declarações, petições, recursos e demais documentos.
            </p>

            <RepresentanteUploader
              onExtracted={(data: ExtractedRepresentanteData) => {
                if (data.repNome) setRepNome(data.repNome);
                if (data.repCpf) setRepCpf(data.repCpf);
                if (data.repRg) setRepRg(data.repRg);
                if (data.repOrgaoExp) setRepOrgaoExp(data.repOrgaoExp);
                if (data.repCargo) setRepCargo(data.repCargo);
                if (data.repNaturalidade) setRepNaturalidade(data.repNaturalidade);
                if (data.repNacionalidade) setRepNacionalidade(data.repNacionalidade);
              }}
            />

            <div className="grid gap-4 mt-4">
              <div>
                <Label className="text-xs">Nome Completo</Label>
                <Input value={repNome} onChange={e => setRepNome(e.target.value)} className="mt-1" placeholder="Nome completo do representante" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">CPF</Label>
                  <Input value={repCpf} onChange={e => setRepCpf(e.target.value)} className="mt-1" placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label className="text-xs">RG</Label>
                  <Input value={repRg} onChange={e => setRepRg(e.target.value)} className="mt-1" placeholder="Número do RG" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Órgão Expedidor</Label>
                  <Input value={repOrgaoExp} onChange={e => setRepOrgaoExp(e.target.value)} className="mt-1" placeholder="SSP/XX" />
                </div>
                <div>
                  <Label className="text-xs">Cargo / Função</Label>
                  <Input value={repCargo} onChange={e => setRepCargo(e.target.value)} className="mt-1" placeholder="Sócio-Administrador" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Naturalidade</Label>
                  <Input value={repNaturalidade} onChange={e => setRepNaturalidade(e.target.value)} className="mt-1" placeholder="Cidade/UF" />
                </div>
                <div>
                  <Label className="text-xs">Nacionalidade</Label>
                  <Input value={repNacionalidade} onChange={e => setRepNacionalidade(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>
          </section>

          {/* Timbrado / Marca d'Água */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <TimbradoUploader
              empresaId={empresaAtiva?.id}
              timbradoUrl={timbradoUrl}
              setTimbradoUrl={setTimbradoUrl}
            />
          </section>

          {/* Notificações */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Notificações</h2>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Novos editais compatíveis', desc: 'Alerta ao detectar licitação com CNAE compatível', default: true },
                { label: 'Prazos próximos', desc: 'Aviso 48h antes do encerramento', default: true },
                { label: 'Atividade de concorrentes', desc: 'Notificação sobre novos lances de concorrentes monitorados', default: false },
                { label: 'Relatórios semanais', desc: 'Resumo por e-mail toda segunda-feira', default: true },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch defaultChecked={n.default} />
                </div>
              ))}
            </div>
          </section>

          {/* Integrações */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Portais Monitorados</h2>
            </div>
            <div className="space-y-3">
              {['Compras Governamentais', 'PNCP', 'BEC/SP', 'Licitações-e (BB)', 'Bolsa Nacional de Compras', 'Banparanet (PA)', 'Compras Públicas RJ', 'BLL Compras', 'Licitanet', 'Portal de Compras Públicas'].map((portal) => (
                <div key={portal} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium">{portal}</span>
                  <Switch defaultChecked={portal !== 'BEC/SP'} />
                </div>
              ))}
            </div>
          </section>

          {/* Diários Oficiais */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Diários Oficiais Monitorados</h2>
            </div>
            <div className="space-y-3">
              {[
                'DOU (Federal)',
                'IOEPA (Estadual)',
                'TCMPA (Municípios)',
                'DOE/SP',
                'IOERJ',
                'DODF.e (Distrito Federal)',
              ].map((fonte) => (
                <div key={fonte} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium">{fonte}</span>
                  <Switch defaultChecked />
                </div>
              ))}
            </div>
          </section>

          {/* Plano & Assinatura */}
          <PlanoAssinatura />

          {/* CNAEs Secundários */}
          <CnaesSecundarios />

          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={handleSalvar}
            disabled={loadingSalvar || !empresaAtiva}
          >
            {loadingSalvar ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
