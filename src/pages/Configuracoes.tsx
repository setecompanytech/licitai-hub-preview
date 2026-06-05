import { useState, useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Personalize a plataforma para sua empresa</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-6 w-full justify-start">
            <TabsTrigger value="geral" className="gap-2">
              <Settings className="w-4 h-4" />
              Configurações Gerais
            </TabsTrigger>
            <TabsTrigger value="plano" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Plano & Assinatura
            </TabsTrigger>
            <TabsTrigger value="regime" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Regime Tributário
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="gap-2">
              <Shield className="w-4 h-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Configurações Gerais ── */}
          <TabsContent value="geral" className="space-y-6">
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
                    <Input
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
                    <Label className="text-xs">CNAE Principal</Label>
                    <Input value={cnaePrincipal} onChange={e => setCnaePrincipal(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleConsultaCNPJ} disabled={loadingCnpj || loadingSintegra} className="text-xs gap-1.5">
                    {loadingCnpj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Consultar Receita Federal
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleConsultaSintegra} disabled={loadingCnpj || loadingSintegra} className="text-xs gap-1.5">
                    {loadingSintegra ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Consultar SINTEGRA
                  </Button>
                  <a href="https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors">
                    <ExternalLink className="w-3 h-3" /> Receita Federal
                  </a>
                  <a href="http://www.sintegra.gov.br/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors">
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
                    <Input value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)} placeholder="Número da inscrição estadual" className="mt-1" />
                    {inscricaoEstadual && (
                      <Badge variant="outline" className="mt-1 text-[10px] bg-success/10 text-success border-success/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Preenchido
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Inscrição Municipal</Label>
                    <Input value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)} placeholder="Número da inscrição municipal" className="mt-1" />
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
                  if (data.repNome !== undefined) setRepNome(data.repNome ?? '');
                  if (data.repCpf !== undefined) setRepCpf(data.repCpf ?? '');
                  if (data.repRg !== undefined) setRepRg(data.repRg ?? '');
                  if (data.repOrgaoExp !== undefined) setRepOrgaoExp(data.repOrgaoExp ?? '');
                  if (data.repCargo !== undefined) setRepCargo(data.repCargo ?? '');
                  if (data.repNaturalidade !== undefined) setRepNaturalidade(data.repNaturalidade ?? '');
                  if (data.repNacionalidade !== undefined) setRepNacionalidade(data.repNacionalidade ?? '');
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

            {/* Timbrado e Marca d'Água — Sistema global */}
            <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-semibold">Timbrado e Marca d'Água</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                O timbrado cadastrado aqui será aplicado automaticamente a <strong>todos os documentos gerados</strong> pelo sistema: propostas comerciais, planilhas de composição de custos, declarações, pedidos de recursos, pareceres e demais peças.
              </p>
              <TimbradoUploader empresaId={empresaAtiva?.id} timbradoUrl={timbradoUrl} setTimbradoUrl={setTimbradoUrl} />
            </section>

            {/* Notificações */}
            <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-semibold">Notificações</h2>
              </div>
              <div className="space-y-4">
                {([
                  { key: 'editais_compativeis' as const, label: 'Novos editais compatíveis', desc: 'Alerta ao detectar licitação com CNAE compatível' },
                  { key: 'prazos_proximos' as const, label: 'Prazos próximos', desc: 'Aviso 48h antes do encerramento' },
                  { key: 'atividade_concorrentes' as const, label: 'Atividade de concorrentes', desc: 'Notificação sobre novos lances de concorrentes monitorados' },
                  { key: 'relatorios_semanais' as const, label: 'Relatórios semanais', desc: 'Resumo por e-mail toda segunda-feira' },
                ]).map((n) => (
                  <div key={n.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{n.label}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <Switch
                      checked={notifConfig[n.key]}
                      onCheckedChange={(v) => setNotifConfig(prev => ({ ...prev, [n.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Portais Monitorados */}
            <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-semibold">Portais Monitorados</h2>
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
                  <div key={p.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium">{p.label}</span>
                    <Switch
                      checked={portaisConfig[p.key] ?? false}
                      onCheckedChange={(v) => setPortaisConfig(prev => ({ ...prev, [p.key]: v }))}
                    />
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
                {([
                  { key: 'dou_federal', label: 'DOU (Federal)' },
                  { key: 'ioepa_estadual', label: 'IOEPA (Estadual)' },
                  { key: 'tcmpa_municipios', label: 'TCMPA (Municípios)' },
                  { key: 'doe_sp', label: 'DOE/SP' },
                  { key: 'ioerj', label: 'IOERJ' },
                  { key: 'dodf_e', label: 'DODF.e (Distrito Federal)' },
                ]).map((d) => (
                  <div key={d.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium">{d.label}</span>
                    <Switch
                      checked={diariosConfig[d.key] ?? true}
                      onCheckedChange={(v) => setDiariosConfig(prev => ({ ...prev, [d.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-semibold">UFs prioritárias do Monitoramento</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Escolha as UFs que devem ser priorizadas no Monitoramento de Editais e na Central de Avisos.
                Sem seleção, o sistema continua considerando todos os estados.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setUfsInteresse([...UFS_BRASIL])}>
                  Selecionar todas
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setUfsInteresse([])}>
                  Limpar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {UFS_BRASIL.map((sigla) => {
                  const ativa = ufsInteresse.includes(sigla);
                  return (
                    <button
                      key={sigla}
                      type="button"
                      onClick={() => toggleUfInteresse(sigla)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        ativa
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
                      }`}
                    >
                      {sigla}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground mt-4">
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
            <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-semibold">Privacidade & Dados (LGPD)</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Exporte todos os seus dados em formato JSON. Conforme a LGPD, você tem direito à portabilidade dos seus dados a qualquer momento.
              </p>
              <ExportarDados />
            </section>

            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleSalvar}
              disabled={loadingSalvar || !empresaAtiva}
            >
              {loadingSalvar ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
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
          </TabsContent>

          {/* ── Tab: Segurança ── */}
          <TabsContent value="seguranca" className="space-y-6">
            <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-semibold">Usuário de Acesso</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Defina um nome de usuário para fazer login sem precisar digitar o e-mail. Use apenas letras minúsculas, números, ponto, hífen ou underscore.
              </p>
              <div className="flex items-end gap-3 max-w-sm">
                <div className="flex-1">
                  <Label className="text-xs">Nome de usuário</Label>
                  <Input
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="ex: joao.silva"
                    className="mt-1 font-mono"
                  />
                </div>
                <Button size="sm" onClick={handleSalvarUsername} disabled={savingUsername || !username.trim()}>
                  {savingUsername ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
              {username && (
                <p className="text-[11px] text-muted-foreground mt-2">
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
