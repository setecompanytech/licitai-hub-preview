import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, Globe, Shield, Eye, Bot, Zap,
  XCircle, RefreshCw, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';

const PORTAIS_SUPORTADOS = [
  { id: 'compras-gov', nome: 'Compras.gov.br', tipo: 'federal', icon: '🏛️' },
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
  // Compras.gov: o número da compra se repete entre órgãos; a UASG desambigua.
  const [uasg, setUasg] = useState('');
  const [portal, setPortal] = useState('compras-gov');
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
  const [agenteConfigurado, setAgenteConfigurado] = useState<boolean | null>(null);
  const [agenteErro, setAgenteErro] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<File[]>([]);

  // Verificar credenciais e status do agente
  useEffect(() => {
    if (!empresaAtiva?.id || !portal) return;
    
    const verificar = async () => {
      if (!user) return;
      // Verificar credencial do portal (mesma tabela usada pelo Robô de Lances)
      const { data: cred } = await supabase
        .from('credenciais_portais_safe' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('portal_id', portal)
        .maybeSingle();
      setTemCredencial(!!cred);

      // Healthcheck REAL do agente. A checagem anterior só via se existia uma
      // linha com status='ativo' — carimbo da configuração, que ficou parado
      // por meses: a tela dizia "Agente Online" sem nunca ter perguntado nada
      // ao agente. Agora ela pergunta, e distingue três estados.
      try {
        const { data: saude } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', {
          body: {},
        });
        const s = saude as { configurado?: boolean; online?: boolean; agentes?: Array<{ erro?: string | null }> } | null;
        setAgenteConfigurado(s?.configurado ?? false);
        setAgenteOnline(s?.online ?? false);
        setAgenteErro(s?.online ? null : (s?.agentes?.[0]?.erro ?? null));
      } catch {
        setAgenteConfigurado(true);
        setAgenteOnline(false);
        setAgenteErro('não foi possível consultar o agente');
      }
    };

    verificar();
  }, [empresaAtiva?.id, portal, user]);

  const itensFormatados = pendingItems.map((item, idx) => ({
    numero: idx + 1,
    descricao: item.descricao || '',
    quantidade: parseFloat(item.quantidade) || 1,
    unidade: item.unidade || 'UN',
    valor_unitario: parseFloat(item.valorUnitario) || 0,
    marca: item.marca || '',
    modelo: item.modelo || '',
    fabricante: item.fabricante || '',
  }));

  // COMPRAS.GOV PAUSADO (17/09/2026, decisão do Ian): o robô não cadastra
  // proposta lá — a equipe monta no portal. E esta tela numera os itens pela
  // ordem do carrinho (1, 2, 3…), enquanto no Compras.gov cada item tem o número
  // da compra: o valor do item 12 iria para o item 2.
  const pausadoNoPortal = portal === 'compras-gov';

  const handleEnviar = async () => {
    if (pausadoNoPortal) {
      toast.info('No Compras.gov a proposta é cadastrada no portal pela equipe — o robô não faz esse envio.');
      return;
    }
    if (!numeroPregao.trim()) {
      toast.error('Informe o número do pregão');
      return;
    }
    if (!empresaAtiva?.id) {
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

      // Pelo webhook do robô (16/09/2026): a função `enviar-proposta-portal`
      // lia colunas que não existem nas credenciais e não mandava login nem
      // UASG ao robô. O webhook usa as mesmas peças do envio de sessão.
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robo-lances-webhook/enviar-proposta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          portal,
          numero_pregao: numeroPregao,
          uasg: portal === 'compras-gov' ? uasg : null,
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

      if (result.status === 'nao_implementado') {
        // Não é falha de envio: o robô recebeu tudo e diz o que falta.
        setEnvioStatus('idle');
        setEnvioResult({ ok: false, status: result.status, mensagem: result.mensagem });
        toast.info('O robô recebeu a proposta, mas ainda não a cadastra neste portal.');
        setTab('revisao');
      } else if (resp.ok && result.ok) {
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
  const prontaParaEnvio = !pausadoNoPortal && numeroPregao.trim() && itensFormatados.length > 0 && temCredencial && agenteOnline;

  return (
    <div className="space-y-4">
      {/* Header com status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted" className="gap-1">
          <Bot className="w-3 h-3" aria-hidden="true" />
          Envio automatizado via Agente Cloud
        </Badge>
        {/* Três estados honestos: respondeu / configurado mas mudo / inexistente */}
        {agenteOnline === true && (
          <Badge variant="success" className="gap-1">
            <Zap className="w-3 h-3" aria-hidden="true" /> Agente respondeu agora
          </Badge>
        )}
        {agenteOnline === false && agenteConfigurado === true && (
          <Badge variant="danger" className="gap-1" title={agenteErro || undefined}>
            <XCircle className="w-3 h-3" aria-hidden="true" /> Agente não responde
          </Badge>
        )}
        {agenteConfigurado === false && (
          <Badge variant="warning" className="gap-1">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Nenhum agente configurado
          </Badge>
        )}
      </div>

      {/* Portal + Pregão */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={portal} onValueChange={setPortal}>
          <SelectTrigger className="w-full sm:w-[260px]" aria-label="Portal de compras">
            <Globe className="w-4 h-4 mr-2 text-muted-foreground" aria-hidden="true" />
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
          className="w-full sm:w-[280px]"
          aria-label="Número do pregão"
        />
        {portal === 'compras-gov' && (
          <Input
            placeholder="UASG (6 dígitos)"
            value={uasg}
            onChange={e => setUasg(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            className="w-full sm:w-[160px]"
            aria-label="UASG da unidade compradora"
          />
        )}
        {temCredencial === false && (
          <Badge variant="danger" className="gap-1">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Sem credencial para {portalSelecionado?.nome}
          </Badge>
        )}
        {temCredencial === true && (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Credencial OK
          </Badge>
        )}
      </div>

      {pausadoNoPortal && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>No Compras.gov, a proposta é feita no portal pela equipe</AlertTitle>
          <AlertDescription>
            O robô não cadastra proposta no Compras.gov: o foco dele é a disputa (lances e acompanhamento). Use esta tela para
            revisar itens, valores e declarações antes de cadastrar no portal.
          </AlertDescription>
        </Alert>
      )}

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
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Itens da proposta (vindos da Precificação)</h3>
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {itensFormatados.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border border-border bg-muted p-3">
                      <span className="mt-1 w-6 text-right text-sm text-muted-foreground tabular-nums">#{item.numero}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.descricao}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="tabular-nums">{item.quantidade} {item.unidade}</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            R$ {item.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {item.marca && <span>Marca: {item.marca}</span>}
                          {item.modelo && <span>Modelo: {item.modelo}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: {itensFormatados.length} itens — Valor total: R$ {itensFormatados.reduce((acc, i) => acc + i.valor_unitario * i.quantidade, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ) : (
              <EstadoVazio
                icone={<Package />}
                titulo="Nenhum item na proposta"
                descricao={'Adicione itens via Precificação → "Adicionar à Proposta".'}
              />
            )}
          </Card>
        </TabsContent>

        {/* Declarações */}
        <TabsContent value="declaracoes" className="space-y-3">
          <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold text-foreground">Declarações obrigatórias</h3>
            {[
              { key: 'meEpp', label: 'Declaração de enquadramento como ME/EPP', desc: 'Conforme LC 123/2006' },
              { key: 'inexistenciaFato', label: 'Inexistência de fato impeditivo', desc: 'Art. 63, §1º da Lei 14.133/2021' },
              { key: 'menorAprendiz', label: 'Não emprego de menor', desc: 'Art. 68, VI da Lei 14.133/2021' },
              { key: 'elaboracaoIndep', label: 'Elaboração independente de proposta', desc: 'Instrução Normativa nº 01/2009' },
              { key: 'reservadoMeEpp', label: 'Ciência de item reservado para ME/EPP', desc: 'Quando aplicável' },
            ].map(decl => (
              <label key={decl.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                <input
                  type="checkbox"
                  checked={(declaracoes as any)[decl.key]}
                  onChange={e => setDeclaracoes(prev => ({ ...prev, [decl.key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{decl.label}</p>
                  <p className="text-xs text-muted-foreground">{decl.desc}</p>
                </div>
              </label>
            ))}
          </Card>
        </TabsContent>

        {/* Anexos */}
        <TabsContent value="anexos" className="space-y-3">
          <Card className="p-5">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Anexos da proposta</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-10 transition-colors hover:border-primary hover:bg-primary-tint focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Upload className="mb-2 w-8 h-8 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-foreground">Arraste documentos ou clique para selecionar</span>
              <span className="mt-1 text-xs text-muted-foreground">Proposta comercial (PDF), planilhas, atestados, certidões</span>
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
                  <div key={i} className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => setAnexos(prev => prev.filter((_, j) => j !== i))}
                      className="rounded-md p-1 text-destructive transition-colors hover:bg-destructive-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remover anexo ${f.name}`}
                    >
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
          <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold text-foreground">Resumo da proposta</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <Globe className="mx-auto mb-1 w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">Portal</p>
                <p className="text-sm font-semibold text-foreground">{portalSelecionado?.icon} {portalSelecionado?.nome}</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <Package className="mx-auto mb-1 w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">Itens</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">{itensFormatados.length}</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <Shield className="mx-auto mb-1 w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">Declarações</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">{declaracoesCompletas}/5</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <FileText className="mx-auto mb-1 w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">Pregão</p>
                <p className="text-sm font-semibold text-foreground">{numeroPregao || '—'}</p>
              </div>
            </div>

            {/* Checklist de prontidão */}
            <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
              <p className="text-sm font-semibold text-foreground">Checklist de envio</p>
              {[
                { ok: !!numeroPregao.trim(), label: 'Número do pregão informado' },
                ...(portal === 'compras-gov' ? [{ ok: /^\d{6}$/.test(uasg), label: 'UASG informada (Compras.gov)' }] : []),
                { ok: itensFormatados.length > 0, label: 'Itens com valores cadastrados' },
                { ok: temCredencial === true, label: `Credenciais do ${portalSelecionado?.nome} cadastradas` },
                { ok: agenteOnline === true, label: 'Agente Cloud online e disponível' },
                { ok: declaracoesCompletas >= 3, label: 'Declarações obrigatórias preenchidas' },
              ].map((check, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {check.ok ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-success-ink" aria-hidden="true" />
                  ) : (
                    <XCircle className="w-4 h-4 flex-shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  <span className={check.ok ? 'text-foreground' : 'text-muted-foreground'}>
                    {check.label} — {check.ok ? 'pronto' : 'pendente'}
                  </span>
                </div>
              ))}
            </div>

            {/* Aviso */}
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                O Agente Cloud acessará o portal <strong>{portalSelecionado?.nome}</strong> com suas credenciais e
                preencherá os campos da proposta automaticamente. Você poderá acompanhar o progresso em tempo real
                no <strong>Monitoramento de Chat</strong>.
              </AlertDescription>
            </Alert>

            {/* Resultado do envio */}
            {envioResult && (
              <Alert variant={envioResult.ok ? 'success' : envioResult.status === 'nao_implementado' ? 'warning' : 'destructive'}>
                {envioResult.ok ? <CheckCircle2 className="h-4 w-4" /> : envioResult.status === 'nao_implementado' ? <AlertTriangle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <AlertTitle>{envioResult.ok ? 'Proposta enviada' : envioResult.status === 'nao_implementado' ? 'Cadastro automático ainda não disponível neste portal' : 'Falha no envio'}</AlertTitle>
                <AlertDescription>{envioResult.mensagem}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleEnviar}
              disabled={envioStatus === 'enviando' || envioStatus === 'validando' || !prontaParaEnvio}
              className="w-full"
            >
              {envioStatus === 'enviando' || envioStatus === 'validando' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {envioStatus === 'validando' ? 'Validando...' : 'Enviando ao Agente Cloud...'}</>
              ) : envioStatus === 'sucesso' ? (
                <><CheckCircle2 className="w-4 h-4" /> Enviado com sucesso</>
              ) : (
                <><Bot className="w-4 h-4" /> Enviar proposta via Agente Cloud</>
              )}
            </Button>

            {envioStatus === 'sucesso' && (
              <Button
                variant="outline"
                onClick={() => { setEnvioStatus('idle'); setEnvioResult(null); }}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4" /> Enviar nova proposta
              </Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
