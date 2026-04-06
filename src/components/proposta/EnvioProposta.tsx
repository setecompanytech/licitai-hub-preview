import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, Globe, Shield, Clock, Eye, Bot, Zap,
  XCircle, RefreshCw, ExternalLink, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';

const PORTAIS_SUPORTADOS = [
  { id: 'comprasgov', nome: 'Compras.gov.br', tipo: 'federal', icon: '🏛️' },
  { id: 'bll', nome: 'BLL Compras', tipo: 'privado', icon: '🟢' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', tipo: 'federal', icon: '🏦' },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras', tipo: 'privado', icon: '🔵' },
  { id: 'licitanet', nome: 'Licitanet', tipo: 'privado', icon: '🟠' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', tipo: 'privado', icon: '🟣' },
  { id: 'bec-sp', nome: 'BEC/SP', tipo: 'estadual', icon: '🏢' },
  { id: 'bbmnet', nome: 'BBMNet', tipo: 'privado', icon: '🔴' },
];

type EnvioStatus = 'idle' | 'validando' | 'enviando' | 'sucesso' | 'erro';

interface EnvioResult {
  ok: boolean;
  status: string;
  mensagem: string;
  itens_enviados?: number;
}

export default function EnvioProposta() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { pendingItems } = usePropostaCart();
  
  const [tab, setTab] = useState('itens');
  const [numeroPregao, setNumeroPregao] = useState('');
  const [portal, setPortal] = useState('comprasgov');
  const [declaracoes, setDeclaracoes] = useState({
    meEpp: false,
    inexistenciaFato: false,
    menorAprendiz: false,
    elaboracaoIndep: false,
    reservadoMeEpp: false,
  });
  const [envioStatus, setEnvioStatus] = useState<EnvioStatus>('idle');
  const [envioResult, setEnvioResult] = useState<EnvioResult | null>(null);
  const [temCredencial, setTemCredencial] = useState<boolean | null>(null);
  const [agenteOnline, setAgenteOnline] = useState<boolean | null>(null);
  const [anexos, setAnexos] = useState<File[]>([]);

  // Verificar credenciais e status do agente
  useEffect(() => {
    if (!empresa?.id || !portal) return;
    
    const verificar = async () => {
      // Verificar credencial do portal
      const { data: cred } = await supabase
        .from('credenciais_portais')
        .select('id')
        .eq('empresa_id', empresaAtiva?.id)
        .eq('portal', portal)
        .maybeSingle();
      setTemCredencial(!!cred);

      // Verificar agente
      if (!user) return;
      const { data: agente } = await supabase
        .from('agente_externo_config')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle();
      setAgenteOnline(!!agente);
    };

    verificar();
  }, [empresa?.id, portal, user]);

  const itensFormatados = pendingItems.map((item, idx) => ({
    numero: idx + 1,
    descricao: item.descricao || '',
    quantidade: parseFloat(item.quantidade) || 1,
    unidade: item.unidade || 'UN',
    valor_unitario: parseFloat(item.valorUnitario) || 0 || 0,
    marca: item.marca || '',
    modelo: item.modelo || '',
    fabricante: item.fabricante || '',
  }));

  const handleEnviar = async () => {
    if (!numeroPregao.trim()) {
      toast.error('Informe o número do pregão');
      return;
    }
    if (!empresa?.id) {
      toast.error('Selecione uma empresa');
      return;
    }
    if (itensFormatados.length === 0) {
      toast.error('Adicione itens à proposta via Precificação antes de enviar');
      return;
    }

    setEnvioStatus('validando');
    setEnvioResult(null);

    // Validação local
    const itensInvalidos = itensFormatados.filter(i => !i.descricao || i.valor_unitario <= 0);
    if (itensInvalidos.length > 0) {
      toast.error(`${itensInvalidos.length} item(ns) sem descrição ou valor. Revise antes de enviar.`);
      setEnvioStatus('idle');
      return;
    }

    setEnvioStatus('enviando');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        setEnvioStatus('erro');
        return;
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-proposta-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          portal,
          numero_pregao: numeroPregao,
          empresa_id: empresaAtiva?.id,
          itens: itensFormatados,
          declaracoes: {
            me_epp: declaracoes.meEpp,
            inexistencia_fato: declaracoes.inexistenciaFato,
            menor_aprendiz: declaracoes.menorAprendiz,
            elaboracao_independente: declaracoes.elaboracaoIndep,
            reservado_me_epp: declaracoes.reservadoMeEpp,
          },
        }),
      });

      const result = await resp.json();

      if (resp.ok && result.ok) {
        setEnvioStatus('sucesso');
        setEnvioResult(result);
        toast.success('Proposta enviada ao Agente Cloud com sucesso!');
        setTab('revisao');
      } else {
        setEnvioStatus('erro');
        setEnvioResult(result);
        
        if (result.code === 'CREDENCIAL_NAO_ENCONTRADA') {
          toast.error('Credenciais do portal não cadastradas. Acesse Robô de Lances → Credenciais.');
        } else if (result.code === 'AGENTE_INATIVO') {
          toast.error('Agente Cloud inativo. Verifique a configuração.');
        } else {
          toast.error(result.error || result.mensagem || 'Erro ao enviar proposta');
        }
      }
    } catch (err) {
      setEnvioStatus('erro');
      setEnvioResult({ ok: false, status: 'erro_rede', mensagem: 'Erro de conexão com o servidor' });
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  const portalSelecionado = PORTAIS_SUPORTADOS.find(p => p.id === portal);
  const declaracoesCompletas = Object.values(declaracoes).filter(Boolean).length;
  const prontaParaEnvio = numeroPregao.trim() && itensFormatados.length > 0 && temCredencial && agenteOnline;

  return (
    <div className="space-y-4">
      {/* Header com status */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1 text-xs">
          <Bot className="w-3 h-3" />
          Envio Automatizado via Agente Cloud
        </Badge>
        {agenteOnline === true && (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 text-xs">
            <Zap className="w-3 h-3" /> Agente Online
          </Badge>
        )}
        {agenteOnline === false && (
          <Badge variant="destructive" className="gap-1 text-xs">
            <XCircle className="w-3 h-3" /> Agente Offline
          </Badge>
        )}
      </div>

      {/* Portal + Pregão */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={portal} onValueChange={setPortal}>
          <SelectTrigger className="w-[260px]">
            <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PORTAIS_SUPORTADOS.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className="mr-2">{p.icon}</span> {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Número do Pregão (ex: PE-001/2026)"
          value={numeroPregao}
          onChange={e => setNumeroPregao(e.target.value)}
          className="w-[280px]"
        />
        {temCredencial === false && (
          <Badge variant="outline" className="text-destructive border-destructive/30 gap-1 text-xs">
            <AlertTriangle className="w-3 h-3" /> Sem credencial para {portalSelecionado?.nome}
          </Badge>
        )}
        {temCredencial === true && (
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 gap-1 text-xs">
            <CheckCircle2 className="w-3 h-3" /> Credencial OK
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="itens" className="flex items-center gap-1">
            <Package className="w-4 h-4" /> Itens ({itensFormatados.length})
          </TabsTrigger>
          <TabsTrigger value="declaracoes" className="flex items-center gap-1">
            <Shield className="w-4 h-4" /> Declarações ({declaracoesCompletas}/5)
          </TabsTrigger>
          <TabsTrigger value="anexos" className="flex items-center gap-1">
            <FileText className="w-4 h-4" /> Anexos
          </TabsTrigger>
          <TabsTrigger value="revisao" className="flex items-center gap-1">
            <Eye className="w-4 h-4" /> Revisão & Envio
          </TabsTrigger>
        </TabsList>

        {/* Itens da Proposta */}
        <TabsContent value="itens" className="space-y-3">
          <Card className="p-5">
            {itensFormatados.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm mb-3">Itens da Proposta (vindos da Precificação)</h3>
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {itensFormatados.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                      <span className="text-xs font-mono text-muted-foreground mt-1 w-6 text-right">#{item.numero}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.descricao}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{item.quantidade} {item.unidade}</span>
                          <span className="font-semibold text-foreground">
                            R$ {item.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {item.marca && <span>Marca: {item.marca}</span>}
                          {item.modelo && <span>Modelo: {item.modelo}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total: {itensFormatados.length} itens — Valor total: R$ {itensFormatados.reduce((acc, i) => acc + i.valor_unitario * i.quantidade, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhum item na proposta</p>
                <p className="text-xs mt-1">Adicione itens via <strong>Precificação</strong> → <strong>"Adicionar à Proposta"</strong></p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Declarações */}
        <TabsContent value="declaracoes" className="space-y-3">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-sm mb-2">Declarações obrigatórias</h3>
            {[
              { key: 'meEpp', label: 'Declaração de enquadramento como ME/EPP', desc: 'Conforme LC 123/2006' },
              { key: 'inexistenciaFato', label: 'Inexistência de fato impeditivo', desc: 'Art. 63, §1º da Lei 14.133/2021' },
              { key: 'menorAprendiz', label: 'Não emprego de menor', desc: 'Art. 68, VI da Lei 14.133/2021' },
              { key: 'elaboracaoIndep', label: 'Elaboração independente de proposta', desc: 'Instrução Normativa nº 01/2009' },
              { key: 'reservadoMeEpp', label: 'Ciência de item reservado para ME/EPP', desc: 'Quando aplicável' },
            ].map(decl => (
              <label key={decl.key} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={(declaracoes as any)[decl.key]}
                  onChange={e => setDeclaracoes(prev => ({ ...prev, [decl.key]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-accent"
                />
                <div>
                  <p className="text-sm font-medium">{decl.label}</p>
                  <p className="text-xs text-muted-foreground">{decl.desc}</p>
                </div>
              </label>
            ))}
          </Card>
        </TabsContent>

        {/* Anexos */}
        <TabsContent value="anexos" className="space-y-3">
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Anexos da Proposta</h3>
            <label className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Arraste documentos ou clique para selecionar</span>
              <span className="text-xs text-muted-foreground/60 mt-1">Proposta comercial (PDF), planilhas, atestados, certidões</span>
              <input 
                type="file" 
                multiple 
                className="hidden" 
                onChange={e => {
                  if (e.target.files) setAnexos(prev => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
            </label>
            {anexos.length > 0 && (
              <div className="mt-3 space-y-1">
                {anexos.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30">
                    <FileText className="w-4 h-4 text-accent" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setAnexos(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Revisão & Envio */}
        <TabsContent value="revisao" className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-sm">Resumo da Proposta</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Globe className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Portal</p>
                <p className="text-sm font-semibold">{portalSelecionado?.icon} {portalSelecionado?.nome}</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Package className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Itens</p>
                <p className="text-sm font-semibold">{itensFormatados.length}</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Shield className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Declarações</p>
                <p className="text-sm font-semibold">{declaracoesCompletas}/5</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <FileText className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Pregão</p>
                <p className="text-sm font-semibold">{numeroPregao || '—'}</p>
              </div>
            </div>

            {/* Checklist de prontidão */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklist de Envio</p>
              {[
                { ok: !!numeroPregao.trim(), label: 'Número do pregão informado' },
                { ok: itensFormatados.length > 0, label: 'Itens com valores cadastrados' },
                { ok: temCredencial === true, label: `Credenciais do ${portalSelecionado?.nome} cadastradas` },
                { ok: agenteOnline === true, label: 'Agente Cloud online e disponível' },
                { ok: declaracoesCompletas >= 3, label: 'Declarações obrigatórias preenchidas' },
              ].map((check, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {check.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  )}
                  <span className={check.ok ? 'text-foreground' : 'text-muted-foreground'}>{check.label}</span>
                </div>
              ))}
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-amber-700">Atenção</p>
                <p className="mt-0.5">
                  O Agente Cloud acessará o portal <strong>{portalSelecionado?.nome}</strong> com suas credenciais e 
                  preencherá os campos da proposta automaticamente. Você poderá acompanhar o progresso em tempo real 
                  no <strong>Monitoramento de Chat</strong>.
                </p>
              </div>
            </div>

            {/* Resultado do envio */}
            {envioResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                envioResult.ok 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-destructive/10 border-destructive/30'
              }`}>
                {envioResult.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-sm">{envioResult.ok ? 'Proposta enviada!' : 'Falha no envio'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{envioResult.mensagem}</p>
                </div>
              </div>
            )}

            <Button 
              onClick={handleEnviar} 
              disabled={envioStatus === 'enviando' || envioStatus === 'validando' || !prontaParaEnvio} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {envioStatus === 'enviando' || envioStatus === 'validando' ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {envioStatus === 'validando' ? 'Validando...' : 'Enviando ao Agente Cloud...'}</>
              ) : envioStatus === 'sucesso' ? (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Enviado com sucesso</>
              ) : (
                <><Bot className="w-4 h-4 mr-2" /> Enviar Proposta via Agente Cloud</>
              )}
            </Button>

            {envioStatus === 'sucesso' && (
              <Button 
                variant="outline" 
                onClick={() => { setEnvioStatus('idle'); setEnvioResult(null); }}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Enviar nova proposta
              </Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
