import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Building2, Bell, Globe, Shield, Newspaper, Search, Loader2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import CnaesSecundarios from '@/components/configuracoes/CnaesSecundarios';
import PlanoAssinatura from '@/components/configuracoes/PlanoAssinatura';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';

export default function Configuracoes() {
  const { empresaAtiva, reloadEmpresas } = useEmpresa();
  const [cnpjInput, setCnpjInput] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnaePrincipal, setCnaePrincipal] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingSintegra, setLoadingSintegra] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [erroCnpj, setErroCnpj] = useState('');

  useEffect(() => {
    if (empresaAtiva) {
      setCnpjInput(empresaAtiva.cnpj || '');
      setRazaoSocial(empresaAtiva.razao_social || '');
      setCnaePrincipal(empresaAtiva.cnae_principal || '');
      setCidade(empresaAtiva.municipio || '');
      setUf(empresaAtiva.uf || '');
      setInscricaoMunicipal((empresaAtiva as any).inscricao_municipal || '');
      setInscricaoEstadual((empresaAtiva as any).inscricao_estadual || '');
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
          cnae_principal: cnaePrincipal,
          municipio: cidade,
          uf: uf,
          inscricao_municipal: inscricaoMunicipal || null,
          inscricao_estadual: inscricaoEstadual || null,
        })
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
        setRazaoSocial(data.razaoSocial || razaoSocial);
        setCnaePrincipal(data.cnaePrincipal || cnaePrincipal);
        setCidade(data.municipio || cidade);
        setUf(data.uf || uf);
        toast.success('Dados preenchidos via Receita Federal!');
      }
    } catch (e: any) {
      setErroCnpj(e.message || 'Erro ao consultar CNPJ');
    } finally {
      setLoadingCnpj(false);
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
    setLoadingSintegra(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-sintegra', {
        body: { cnpj: cnpjLimpo, uf: uf },
      });
      if (error) throw error;
      if (data.error) {
        setErroCnpj(data.error);
      } else {
        if (data.inscricaoEstadual) setInscricaoEstadual(data.inscricaoEstadual);
        if (data.razaoSocial) setRazaoSocial(data.razaoSocial);
        toast.success('Dados preenchidos via SINTEGRA!');
      }
    } catch (e: any) {
      setErroCnpj(e.message || 'Erro ao consultar SINTEGRA');
    } finally {
      setLoadingSintegra(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Personalize a plataforma para sua empresa</p>
        </div>

        <div className="space-y-6">
          {/* Empresa */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Dados da Empresa</h2>
            </div>
            <div className="grid gap-4">
              <div>
                <Label className="text-xs">Razão Social</Label>
                <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={cnpjInput} onChange={e => setCnpjInput(e.target.value)} className="mt-1" />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input value={cidade} onChange={e => setCidade(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Input value={uf} onChange={e => setUf(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Inscrição Municipal</Label>
                  <Input
                    value={inscricaoMunicipal}
                    onChange={e => setInscricaoMunicipal(e.target.value)}
                    placeholder="Número da inscrição municipal"
                    className="mt-1"
                  />
                </div>
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
              </div>
            </div>
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
            {loadingSalvar ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
