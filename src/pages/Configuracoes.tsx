import { useState, useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TimbradoConfig from '@/components/configuracoes/TimbradoConfig';
import { Building2, Bell, Globe, Shield, Newspaper, Search, Loader2, ExternalLink, CheckCircle2, AlertTriangle, ImageIcon, User, Save, CreditCard, Settings, MapPin, BarChart3 } from 'lucide-react';
import CnaesSecundarios from '@/components/configuracoes/CnaesSecundarios';
import SegurancaConta from '@/components/configuracoes/SegurancaConta';
import PlanoAssinatura from '@/components/configuracoes/PlanoAssinatura';
import PlanoVerificacao from '@/components/configuracoes/PlanoVerificacao';
import AnalyseCustosPlanos from '@/components/configuracoes/AnalyseCustosPlanos';
import AnaliseCNPJAdicional from '@/components/configuracoes/AnaliseCNPJAdicional';
import RepresentanteUploader, { type ExtractedRepresentanteData } from '@/components/configuracoes/RepresentanteUploader';
import TimbradoUploader from '@/components/proposta/TimbradoUploader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import ExportarDados from '@/components/export/ExportarDados';
import BackupAgendado from '@/components/configuracoes/BackupAgendado';
import ApuracaoRegimeTributario from '@/components/configuracoes/ApuracaoRegimeTributario';
import IndicadoresGerenciais from '@/components/configuracoes/IndicadoresGerenciais';
import { UFS_BRASIL, normalizeUfs } from '@/constants/ufsBrasil';


export default function Configuracoes() {
  const { empresaAtiva, reloadEmpresas } = useEmpresa();
  const location = useLocation();
  const { isAdmin } = useUserRole();
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

  // Notification & portal preferences
  const [notifConfig, setNotifConfig] = useState({
    editais_compativeis: true, prazos_proximos: true,
    atividade_concorrentes: false, relatorios_semanais: true,
  });
  const [portaisConfig, setPortaisConfig] = useState<Record<string, boolean>>({
    compras_governamentais: true, pncp: true, bec_sp: false,
    licitacoes_e_bb: true, bolsa_nacional: true, banparanet_pa: true,
    compras_publicas_rj: true, bll_compras: true, licitanet: true,
    portal_compras_publicas: true,
  });
  const [diariosConfig, setDiariosConfig] = useState<Record<string, boolean>>({
    dou_federal: true, ioepa_estadual: true, tcmpa_municipios: true,
    doe_sp: true, ioerj: true, dodf_e: true,
  });
  const [ufsInteresse, setUfsInteresse] = useState<string[]>([]);

  // Loading states
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingSintegra, setLoadingSintegra] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [erroCnpj, setErroCnpj] = useState('');
  const [username, setUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Load saved notification/portal config
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if ((data as any)?.username) setUsername((data as any).username); });
  }, [user]);

  const handleSalvarUsername = async () => {
    if (!user) return;
    const u = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!u) { toast.error('Informe um nome de usuário válido'); return; }
    setSavingUsername(true);
    const { error } = await supabase.from('profiles').update({ username: u } as any).eq('user_id', user.id);
    setSavingUsername(false);
    if (error) {
      toast.error(error.message.includes('unique') ? 'Este usuário já está em uso. Escolha outro.' : error.message);
    } else {
      setUsername(u);
      toast.success('Usuário de acesso atualizado!');
    }
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from('configuracoes')
        .select('notificacoes_config, portais_monitorados, diarios_monitorados, ufs_interesse')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('preferencias_alertas' as any)
        .select('ufs')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]).then(([configResp, alertasResp]) => {
      const configData = configResp.data;
      const alertasData = alertasResp.data as { ufs?: string[] } | null;

      if (configData?.notificacoes_config) setNotifConfig(configData.notificacoes_config as any);
      if (configData?.portais_monitorados) setPortaisConfig(configData.portais_monitorados as any);
      if (configData?.diarios_monitorados) setDiariosConfig(configData.diarios_monitorados as any);

      setUfsInteresse(normalizeUfs([
        ...(configData?.ufs_interesse || []),
        ...(alertasData?.ufs || []),
      ]));
    });
  }, [user]);

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

  const toggleUfInteresse = (sigla: string) => {
    setUfsInteresse((prev) =>
      prev.includes(sigla)
        ? prev.filter((ufSelecionada) => ufSelecionada !== sigla)
        : [...prev, sigla]
    );
  };

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

      // Save notification/portal/diário preferences
      if (user) {
        const prefPayload = {
          user_id: user.id,
          notificacoes_config: notifConfig as any,
          portais_monitorados: portaisConfig as any,
          diarios_monitorados: diariosConfig as any,
          ufs_interesse: ufsInteresse,
          uf_sede: uf || null,
        };
        const { data: existing } = await supabase
          .from('configuracoes')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (existing) {
          await supabase.from('configuracoes').update(prefPayload as any).eq('user_id', user.id);
        } else {
          await supabase.from('configuracoes').insert(prefPayload as any);
        }

        const { data: alertasExisting } = await supabase
          .from('preferencias_alertas' as any)
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (alertasExisting) {
          await supabase
            .from('preferencias_alertas' as any)
            .update({
              ufs: ufsInteresse,
              email_notificacao: user.email || email || null,
            })
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('preferencias_alertas' as any)
            .insert({
              user_id: user.id,
              ufs: ufsInteresse,
              segmentos: [],
              receber_editais: true,
              receber_alteracoes: true,
              receber_suspensoes: true,
              receber_cancelamentos: true,
              receber_homologacoes: true,
              canal_push: true,
              canal_email: false,
              canal_whatsapp: false,
              email_notificacao: user.email || email || null,
              frequencia: 'imediato',
              ativo: true,
            });
        }
      }

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
      {/* mx-auto: o max-w prendia a largura em 1024px sem centralizar, e o
          conteúdo encostava à esquerda com a sobra toda do lado direito. */}
      <div className="mx-auto max-w-5xl">
        <Tabs defaultValue={defaultTab} className="w-full">
          {/* Item de menu: título, descrição, ícone e trilha vêm do registro
              `lib/navegacao/paginas.ts` — a tela não os repete. */}
          <CabecalhoPagina>
            <TabsList>
              <TabsTrigger value="geral" className="gap-2">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="plano" className="gap-2">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Plano
              </TabsTrigger>
              <TabsTrigger value="regime" className="gap-2">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Regime
              </TabsTrigger>
              <TabsTrigger value="timbrado" className="gap-2">
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                Timbrado
              </TabsTrigger>
              <TabsTrigger value="seguranca" className="gap-2">
                <Shield className="h-4 w-4" aria-hidden="true" />
                Segurança
              </TabsTrigger>
            </TabsList>
          </CabecalhoPagina>

          {/* ── Tab: Timbrado — o ÚNICO lugar do timbrado (10/09) ──
              Dois pipelines convivem e são complementares:
              1) TimbradoConfig → cabeçalho/rodapé/logotipo dos PDFs de
                 relatórios e exportações (tabela empresa_timbrado);
              2) TimbradoUploader → papel timbrado completo (imagem/Word)
                 usado como fundo/marca d'água nas peças jurídicas e
                 composições (empresas.timbrado_url).
              Antes o 2 morava na aba Geral e parecia duplicidade. */}
          <TabsContent value="timbrado" className="space-y-6">
            <TimbradoConfig />
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Papel timbrado completo (fundo / marca d'água)</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Imagem ou documento Word do papel timbrado pronto — usado como fundo nas peças
                jurídicas, declarações e planilhas de composição. Complementa o cabeçalho/rodapé
                acima (que veste os relatórios em PDF).
              </p>
              <TimbradoUploader empresaId={empresaAtiva?.id} timbradoUrl={timbradoUrl} setTimbradoUrl={setTimbradoUrl} />
            </section>
          </TabsContent>

          {/* ── Tab: Configurações Gerais ── */}
          <TabsContent value="geral" className="space-y-6">
            {/* Dados da Empresa */}
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Dados da Empresa</h2>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="empresa-cnpj">CNPJ</Label>
                    <Input
                      id="empresa-cnpj"
                      value={cnpjInput}
                      onChange={e => setCnpjInput(e.target.value)}
                      onBlur={() => {
                        if (cnpjInput.replace(/\D/g, '').length === 14) handleConsultaCNPJ();
                      }}
                      className="mt-1"
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="empresa-cnae">CNAE Principal</Label>
                    <Input id="empresa-cnae" value={cnaePrincipal} onChange={e => setCnaePrincipal(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleConsultaCNPJ} disabled={loadingCnpj || loadingSintegra}>
                    {loadingCnpj ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
                    Consultar Receita Federal
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleConsultaSintegra} disabled={loadingCnpj || loadingSintegra}>
                    {loadingSintegra ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
                    Consultar SINTEGRA
                  </Button>
                  <a href="https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> Receita Federal
                  </a>
                  <a href="http://www.sintegra.gov.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> SINTEGRA
                  </a>
                </div>

                {erroCnpj && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>{erroCnpj}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="empresa-razao-social">Razão Social</Label>
                  <Input id="empresa-razao-social" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="empresa-nome-fantasia">Nome Fantasia</Label>
                  <Input id="empresa-nome-fantasia" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className="mt-1" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="empresa-cep">CEP</Label>
                    <Input id="empresa-cep" value={cep} onChange={e => setCep(e.target.value)} className="mt-1" placeholder="00000-000" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="empresa-endereco">Endereço (Logradouro, Nº)</Label>
                    <Input id="empresa-endereco" value={endereco} onChange={e => setEndereco(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="empresa-complemento">Complemento</Label>
                    <Input id="empresa-complemento" value={complemento} onChange={e => setComplemento(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="empresa-bairro">Bairro</Label>
                    <Input id="empresa-bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="empresa-uf">UF</Label>
                    <Input id="empresa-uf" value={uf} onChange={e => setUf(e.target.value)} className="mt-1" maxLength={2} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="empresa-municipio">Município</Label>
                  <Input id="empresa-municipio" value={cidade} onChange={e => setCidade(e.target.value)} className="mt-1" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="empresa-telefone">Telefone</Label>
                    <Input id="empresa-telefone" value={telefone} onChange={e => setTelefone(e.target.value)} className="mt-1" placeholder="(XX) XXXXX-XXXX" />
                  </div>
                  <div>
                    <Label htmlFor="empresa-email">E-mail</Label>
                    <Input id="empresa-email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" placeholder="contato@empresa.com" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="empresa-ie">Inscrição Estadual</Label>
                    <Input id="empresa-ie" value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)} placeholder="Número da inscrição estadual" className="mt-1" />
                    {inscricaoEstadual && (
                      <Badge variant="success" className="mt-2 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Preenchido
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="empresa-im">Inscrição Municipal</Label>
                    <Input id="empresa-im" value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)} placeholder="Número da inscrição municipal" className="mt-1" />
                  </div>
                </div>
              </div>
            </section>

            {/* Dados do Representante */}
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Dados do Representante Legal</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Preencha os dados do representante legal ou extraia automaticamente via upload de documento (contrato social, procuração, RG/CPF). Essas informações serão propagadas para propostas, declarações, petições, recursos e demais documentos.
              </p>

              <RepresentanteUploader
                onExtracted={(data: ExtractedRepresentanteData) => {
                  if (data.repNome !== undefined) setRepNome(data.repNome ?? '');
                  if (data.repCpf !== undefined) setRepCpf(data.repCpf ?? '');
                  if (data.repRg !== undefined) setRepRg(data.repRg ?? '');
                  if (data.repOrgaoExp !== undefined) setRepOrgaoExp(data.repOrgaoExp ?? '');
                  if (data.repCargo !== undefined) setRepCargo(data.repCargo ?? '');
                  if (data.repNaturalidade !== undefined) setRepNaturalidade(data.repNaturalidade ?? '');
                  if (data.repNacionalidade !== undefined) setRepNacionalidade(data.repNacionalidade ?? '');
                }}
              />

              <div className="mt-4 grid gap-4">
                <div>
                  <Label htmlFor="rep-nome">Nome Completo</Label>
                  <Input id="rep-nome" value={repNome} onChange={e => setRepNome(e.target.value)} className="mt-1" placeholder="Nome completo do representante" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="rep-cpf">CPF</Label>
                    <Input id="rep-cpf" value={repCpf} onChange={e => setRepCpf(e.target.value)} className="mt-1" placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <Label htmlFor="rep-rg">RG</Label>
                    <Input id="rep-rg" value={repRg} onChange={e => setRepRg(e.target.value)} className="mt-1" placeholder="Número do RG" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="rep-orgao-expedidor">Órgão Expedidor</Label>
                    <Input id="rep-orgao-expedidor" value={repOrgaoExp} onChange={e => setRepOrgaoExp(e.target.value)} className="mt-1" placeholder="SSP/XX" />
                  </div>
                  <div>
                    <Label htmlFor="rep-cargo">Cargo / Função</Label>
                    <Input id="rep-cargo" value={repCargo} onChange={e => setRepCargo(e.target.value)} className="mt-1" placeholder="Sócio-Administrador" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="rep-naturalidade">Naturalidade</Label>
                    <Input id="rep-naturalidade" value={repNaturalidade} onChange={e => setRepNaturalidade(e.target.value)} className="mt-1" placeholder="Cidade/UF" />
                  </div>
                  <div>
                    <Label htmlFor="rep-nacionalidade">Nacionalidade</Label>
                    <Input id="rep-nacionalidade" value={repNacionalidade} onChange={e => setRepNacionalidade(e.target.value)} className="mt-1" />
                  </div>
                </div>
              </div>
            </section>

            {/* Timbrado saiu daqui (10/09): duplicava a aba dedicada e o
                usuário configurava em dois lugares sem saber qual valia.
                O uploader mudou-se para a aba Timbrado — os DOIS pipelines
                (papel timbrado completo e cabeçalho/rodapé) num lugar só. */}

            {/* Notificações */}
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Notificações</h2>
              </div>
              <div className="space-y-4">
                {([
                  { key: 'editais_compativeis' as const, label: 'Novos editais compatíveis', desc: 'Alerta ao detectar licitação com CNAE compatível' },
                  { key: 'prazos_proximos' as const, label: 'Prazos próximos', desc: 'Aviso 48h antes do encerramento' },
                  { key: 'atividade_concorrentes' as const, label: 'Atividade de concorrentes', desc: 'Notificação sobre novos lances de concorrentes monitorados' },
                  { key: 'relatorios_semanais' as const, label: 'Relatórios semanais', desc: 'Resumo por e-mail toda segunda-feira' },
                ]).map((n) => (
                  <div key={n.key} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label htmlFor={`notif-${n.key}`} className="block text-base font-medium text-foreground">{n.label}</Label>
                      <p className="mt-1 text-sm text-muted-foreground">{n.desc}</p>
                    </div>
                    <Switch
                      id={`notif-${n.key}`}
                      checked={notifConfig[n.key]}
                      onCheckedChange={(v) => setNotifConfig(prev => ({ ...prev, [n.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Portais Monitorados */}
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Portais Monitorados</h2>
              </div>
              <div className="space-y-3">
                {([
                  { key: 'compras_governamentais', label: 'Compras Governamentais' },
                  { key: 'pncp', label: 'PNCP' },
                  { key: 'bec_sp', label: 'BEC/SP' },
                  { key: 'licitacoes_e_bb', label: 'Licitações-e (BB)' },
                  { key: 'bolsa_nacional', label: 'Bolsa Nacional de Compras' },
                  { key: 'banparanet_pa', label: 'Banparanet (PA)' },
                  { key: 'compras_publicas_rj', label: 'Compras Públicas RJ' },
                  { key: 'bll_compras', label: 'BLL Compras' },
                  { key: 'licitanet', label: 'Licitanet' },
                  { key: 'portal_compras_publicas', label: 'Portal de Compras Públicas' },
                ]).map((p) => (
                  <div key={p.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted p-3">
                    <Label htmlFor={`portal-${p.key}`} className="min-w-0 text-sm font-medium text-foreground">{p.label}</Label>
                    <Switch
                      id={`portal-${p.key}`}
                      checked={portaisConfig[p.key] ?? false}
                      onCheckedChange={(v) => setPortaisConfig(prev => ({ ...prev, [p.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Diários Oficiais */}
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Diários Oficiais Monitorados</h2>
              </div>
              <div className="space-y-3">
                {([
                  { key: 'dou_federal', label: 'DOU (Federal)' },
                  { key: 'ioepa_estadual', label: 'IOEPA (Estadual)' },
                  { key: 'tcmpa_municipios', label: 'TCMPA (Municípios)' },
                  { key: 'doe_sp', label: 'DOE/SP' },
                  { key: 'ioerj', label: 'IOERJ' },
                  { key: 'dodf_e', label: 'DODF.e (Distrito Federal)' },
                ]).map((d) => (
                  <div key={d.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted p-3">
                    <Label htmlFor={`diario-${d.key}`} className="min-w-0 text-sm font-medium text-foreground">{d.label}</Label>
                    <Switch
                      id={`diario-${d.key}`}
                      checked={diariosConfig[d.key] ?? true}
                      onCheckedChange={(v) => setDiariosConfig(prev => ({ ...prev, [d.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">UFs prioritárias do Monitoramento</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Escolha as UFs que devem ser priorizadas no Monitoramento de Editais e na Central de Avisos.
                Sem seleção, o sistema continua considerando todos os estados.
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setUfsInteresse([...UFS_BRASIL])}>
                  Selecionar todas
                </Button>
                <Button size="sm" variant="outline" onClick={() => setUfsInteresse([])}>
                  Limpar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="UFs prioritárias">
                {UFS_BRASIL.map((sigla) => {
                  const ativa = ufsInteresse.includes(sigla);
                  return (
                    <Button
                      key={sigla}
                      type="button"
                      size="sm"
                      variant={ativa ? 'default' : 'outline'}
                      aria-pressed={ativa}
                      onClick={() => toggleUfInteresse(sigla)}
                    >
                      {sigla}
                    </Button>
                  );
                })}
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                {ufsInteresse.length > 0
                  ? `Prioridade ativa para: ${ufsInteresse.join(', ')}`
                  : 'Nenhuma UF específica selecionada.'}
              </p>
            </section>

            {/* CNAEs Secundários */}
            <CnaesSecundarios />

            {/* Backup Programado */}
            <BackupAgendado />

            {/* Exportar Dados */}
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Privacidade &amp; Dados (LGPD)</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Exporte todos os seus dados em formato JSON. Conforme a LGPD, você tem direito à portabilidade dos seus dados a qualquer momento.
              </p>
              <ExportarDados />
            </section>

            <Button
              onClick={handleSalvar}
              disabled={loadingSalvar || !empresaAtiva}
            >
              {loadingSalvar ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Salvar Configurações
            </Button>
          </TabsContent>

          {/* ── Tab: Plano & Assinatura ── */}
          <TabsContent value="plano" className="space-y-6">
            <PlanoAssinatura />
            <PlanoVerificacao />
            {isAdmin && <AnalyseCustosPlanos />}
            {isAdmin && <AnaliseCNPJAdicional />}
          </TabsContent>

          {/* ── Tab: Regime Tributário ── */}
          <TabsContent value="regime" className="space-y-6">
            <ApuracaoRegimeTributario />
            {/* Mora aqui porque é a mesma pergunta: qual é a base de cálculo
                que o comercial usa. A apuração dá os tributos; os indicadores
                dão o custo da estrutura. */}
            <IndicadoresGerenciais />
          </TabsContent>

          {/* ── Tab: Segurança ── */}
          <TabsContent value="seguranca" className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Usuário de Acesso</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Defina um nome de usuário para fazer login sem precisar digitar o e-mail. Use apenas letras minúsculas, números, ponto, hífen ou underscore.
              </p>
              <div className="flex max-w-sm flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="usuario-acesso">Nome de usuário</Label>
                  <Input
                    id="usuario-acesso"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="ex: joao.silva"
                    className="mt-1 font-mono"
                  />
                </div>
                <Button onClick={handleSalvarUsername} disabled={savingUsername || !username.trim()}>
                  {savingUsername ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  Salvar
                </Button>
              </div>
              {username && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Você pode fazer login com <span className="font-mono font-medium text-foreground">{username}</span> ou com seu e-mail.
                </p>
              )}
            </section>
            <SegurancaConta />
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}
