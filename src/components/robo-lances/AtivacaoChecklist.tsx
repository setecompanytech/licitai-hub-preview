import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, Circle, AlertTriangle, Server, Key, Shield, 
  FileCheck, Rocket, Loader2, Award, RefreshCw, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type CheckItem = {
  id: string;
  label: string;
  descricao: string;
  status: 'pendente' | 'ok' | 'erro' | 'verificando';
  icon: typeof Server;
  acao?: () => void;
  acaoLabel?: string;
};

export default function AtivacaoChecklist() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [items, setItems] = useState<CheckItem[]>([]);
  const [checking, setChecking] = useState(false);
  const [showReenvio, setShowReenvio] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [invalidando, setInvalidando] = useState(false);
  const [showInvalidar, setShowInvalidar] = useState(false);
  const [certTokenId, setCertTokenId] = useState<string | null>(null);
  const [testandoFreio, setTestandoFreio] = useState(false);

  /** Aciona a parada de emergência de propósito, com o robô parado, para
   *  provar que o freio responde. Recusado pelo servidor se houver disputa. */
  const testarFreio = async () => {
    if (testandoFreio) return;
    setTestandoFreio(true);
    try {
      const { data, error } = await supabase.functions.invoke('robo-lances-webhook/testar-kill-switch', { body: {} });
      const r = data as { verificado?: boolean; error?: string; resultados?: Array<{ detalhe?: string | null }> } | null;
      if (error || r?.error) {
        toast.error(r?.error || 'Não foi possível testar o freio de emergência.', { duration: 12000 });
      } else if (r?.verificado) {
        toast.success('Freio de emergência confirmado pelo agente. Níveis 2 e 3 liberados.');
      } else {
        toast.error(
          `O agente NÃO confirmou a parada${r?.resultados?.[0]?.detalhe ? ` (${r.resultados[0].detalhe})` : ''}. ` +
          'Envio automático permanece bloqueado — veja docs/agente-cloud-pendencias.md.',
          { duration: 20000 },
        );
      }
      await verificarStatus();
    } finally {
      setTestandoFreio(false);
    }
  };

  const gerarNovoLink = async () => {
    if (!user || !empresaAtiva) return;
    setReenviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-link-certificado', {
        body: { empresa_id: empresaAtiva.id },
      });
      if (error) throw error;
      toast.success('Novo link de upload enviado para seu e-mail.');
      await verificarStatus();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar link');
    } finally {
      setReenviando(false);
      setShowReenvio(false);
    }
  };

  const invalidarCertificado = async () => {
    if (!certTokenId) return;
    setInvalidando(true);
    try {
      // Mark the token's cert_file_path as null and used_at as null to allow re-upload
      const { error } = await supabase
        .from('cert_upload_tokens')
        .update({ cert_file_path: null, used_at: null } as any)
        .eq('id', certTokenId);

      if (error) throw error;
      toast.success('Certificado invalidado. Gere um novo link para enviar o arquivo correto.');
      setCertTokenId(null);
      setShowInvalidar(false);
      await verificarStatus();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao invalidar certificado');
    } finally {
      setInvalidando(false);
    }
  };

  const verificarStatus = async () => {
    if (!user) return;
    setChecking(true);

    const newItems: CheckItem[] = [];

    // 1. Verificar agente configurado
    const { data: agentes } = await supabase
      .from('agente_externo_config')
      .select('*')
      .eq('user_id', user.id);

    const agenteAtivo = agentes?.find(a => a.status === 'ativo');
    const agenteConfigurado = agentes && agentes.length > 0;

    newItems.push({
      id: 'agente',
      label: 'Agente Externo Configurado',
      descricao: agenteAtivo
        ? `Conectado: ${agenteAtivo.url_base} (v${agenteAtivo.versao_agente || '?'})`
        : agenteConfigurado
        ? `Configurado mas offline (${agentes[0].status})`
        : 'Configure o servidor VPS com o agente de automação',
      status: agenteAtivo ? 'ok' : agenteConfigurado ? 'erro' : 'pendente',
      icon: Server,
    });

    // Healthcheck AO VIVO — a tela lia colunas gravadas na configuração
    // (versão, RAM, heartbeat) e as exibia como se fossem de agora.
    let saudeAoVivo: {
      online?: boolean;
      agentes?: Array<{ online?: boolean; erro?: string | null; versao?: string | null;
        capacidade?: { ram_total_mb?: number; max_sessoes?: number; slots_disponiveis?: number };
        certificado?: { carregado?: boolean; path?: string } | null }>;
    } | null = null;
    try {
      const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', { body: {} });
      saudeAoVivo = data as typeof saudeAoVivo;
    } catch { /* sem resposta — os itens abaixo caem para o registro do banco */ }
    const agenteVivo = saudeAoVivo?.agentes?.[0];

    // 2. Verificar healthcheck do agente
    if (agenteAtivo) {
      // O agente nunca empurrou heartbeat; agora PUXAMOS o sinal de vida.
      newItems.push({
        id: 'heartbeat',
        label: 'Sinal de vida (healthcheck)',
        descricao: agenteVivo?.online
          ? `Respondeu agora — ${new Date().toLocaleTimeString('pt-BR')}${agenteVivo.versao ? ` · v${agenteVivo.versao}` : ''}`
          : `O agente não respondeu ao healthcheck${agenteVivo?.erro ? ` (${agenteVivo.erro})` : ''}`,
        status: agenteVivo?.online ? 'ok' : 'erro',
        icon: Shield,
      });

      // Freio de emergência — etapa própria: o botão existir na tela não prova
      // que o agente para. Só o teste deliberado prova.
      const ks = (agenteVivo as { kill_switch?: { ok?: boolean; detalhe?: string | null; testado_em?: string } | null } | undefined)?.kill_switch;
      newItems.push({
        id: 'kill_switch',
        label: 'Freio de emergência verificado',
        descricao: ks?.ok
          ? `Parada de emergência confirmada pelo agente${ks.testado_em ? ` em ${new Date(ks.testado_em).toLocaleString('pt-BR')}` : ''}`
          : ks
          ? `O agente NÃO confirmou a parada${ks.detalhe ? ` (${ks.detalhe})` : ''} — níveis 2 e 3 permanecem bloqueados`
          : 'Nunca testado — obrigatório antes de ativar envio automático (níveis 2 e 3)',
        status: ks?.ok ? 'ok' : ks ? 'erro' : 'pendente',
        icon: Shield,
        acao: () => testarFreio(),
        acaoLabel: 'Testar freio',
      });

      // 3. Verificar capacidade
      const capacidadeViva = agenteVivo?.capacidade;
      const slotsLivres = capacidadeViva?.slots_disponiveis
        ?? ((agenteAtivo.max_sessoes_paralelas || 3) - (agenteAtivo.sessoes_ativas || 0));
      const slotsTotais = capacidadeViva?.max_sessoes ?? agenteAtivo.max_sessoes_paralelas;
      const ram = capacidadeViva?.ram_total_mb ?? agenteAtivo.ram_mb;
      newItems.push({
        id: 'capacidade',
        label: 'Slots Disponíveis',
        descricao: `${slotsLivres} de ${slotsTotais} slots livres | ${ram || '?'}MB RAM`,
        status: slotsLivres > 0 ? 'ok' : 'erro',
        icon: Rocket,
      });
    }

    // 4. Certificado Digital
    if (empresaAtiva) {
      const { data: tokens } = await supabase
        .from('cert_upload_tokens')
        .select('id, cert_file_path, used_at, expires_at')
        .eq('empresa_id', empresaAtiva.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const token = tokens?.[0];
      const certEnviado = token?.cert_file_path ? true : false;
      const tokenPendente = token && !token.used_at && new Date(token.expires_at) > new Date();

      if (certEnviado && token) {
        setCertTokenId(token.id);
      } else {
        setCertTokenId(null);
      }

      // Duas fontes falavam do mesmo fato e discordavam: o registro de upload
      // no banco dizia "faltando" enquanto o agente reportava o .pfx carregado
      // na VPS. O que vale é o certificado estar onde ele é usado — no agente.
      const certNoAgente = agenteVivo?.certificado?.carregado === true;

      newItems.push({
        id: 'certificado',
        label: 'Certificado Digital',
        descricao: certEnviado
          ? 'Certificado recebido e vinculado à empresa'
          : certNoAgente
          ? `Instalado no agente${agenteVivo?.certificado?.path ? ` (${agenteVivo.certificado.path})` : ''} — envie por aqui para o sistema também versionar e alertar o vencimento`
          : tokenPendente
          ? 'Link de upload enviado — aguardando envio do certificado'
          : 'Envie o certificado digital (.pfx) para autenticação nos portais',
        status: certEnviado || certNoAgente ? 'ok' : tokenPendente ? 'erro' : 'pendente',
        icon: Award,
        acao: certEnviado
          ? () => setShowInvalidar(true)
          : () => setShowReenvio(true),
        acaoLabel: certEnviado ? 'Substituir' : tokenPendente ? 'Reenviar link' : 'Enviar certificado',
      });
    }

    // 5. Verificar credenciais de portal
    // A tabela é `credenciais_portais` (plural) — o singular devolvia PGRST205 e
    // o erro descartado virava "pendente", idêntico a não ter credencial nenhuma.
    // A view `_safe` basta para contar e não traz o `senha_hash` para o navegador.
    const { data: credenciais, error: errCredenciais } = await supabase
      .from('credenciais_portais_safe')
      .select('id')
      .eq('user_id', user.id);

    const temCredencial = !errCredenciais && !!credenciais && credenciais.length > 0;
    newItems.push({
      id: 'credenciais',
      label: 'Credenciais de Portal',
      descricao: errCredenciais
        ? `Não foi possível consultar as credenciais: ${errCredenciais.message}`
        : temCredencial
        ? `${credenciais.length} portal(is) configurado(s)`
        : 'Configure credenciais para pelo menos um portal de licitação',
      status: errCredenciais ? 'erro' : temCredencial ? 'ok' : 'pendente',
      icon: Key,
    });

    // 6. Verificar healthcheck dos portais
    const { data: healthchecks } = await supabase
      .from('portal_healthcheck')
      .select('id')
      .eq('status', 'ok');

    const portaisOk = healthchecks?.length || 0;
    newItems.push({
      id: 'portais',
      label: 'Portais Operacionais',
      descricao: portaisOk > 0
        ? `${portaisOk} portal(is) verificado(s) e operacional(is)`
        : 'Execute o healthcheck para verificar a disponibilidade dos portais',
      status: portaisOk > 0 ? 'ok' : 'pendente',
      icon: FileCheck,
    });

    setItems(newItems);
    setChecking(false);
  };

  useEffect(() => {
    verificarStatus();
  }, [user, empresaAtiva]);

  const okCount = items.filter(i => i.status === 'ok').length;
  const total = items.length;
  const progress = total > 0 ? (okCount / total) * 100 : 0;
  const pronto = okCount === total && total > 0;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
      case 'erro': return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
      case 'verificando': return <Loader2 className="w-4 h-4 animate-spin text-warning shrink-0" />;
      default: return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Rocket className="w-4 h-4 text-muted-foreground" />
            Checklist de Ativação — Robô de Lances
          </h3>
          <div className="flex items-center gap-2">
            {pronto ? (
              <Badge className="bg-success/15 text-success border-success/30 text-xs">
                Pronto
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {okCount}/{total} etapas
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={verificarStatus}
              disabled={checking}
            >
              {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
              Reverificar
            </Button>
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        <div className="space-y-2">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  item.status === 'ok'
                    ? 'border-success/20 bg-success/5'
                    : item.status === 'erro'
                    ? 'border-destructive/20 bg-destructive/5'
                    : 'border-border/50 bg-muted/10'
                }`}
              >
                {statusIcon(item.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold">{item.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>
                </div>
                {item.acao && (
                  <Button size="sm" variant="outline" className="text-xs h-6" onClick={item.acao}>
                    {item.acaoLabel || 'Configurar'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {pronto && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
            <p className="text-xs text-success font-semibold">
              Sistema pronto para disputas reais. O robô pode participar de licitações no Compras.gov e outros portais.
            </p>
          </div>
        )}
      </div>

      {/* Dialog: Gerar/Reenviar link de upload */}
      <AlertDialog open={showReenvio} onOpenChange={setShowReenvio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-muted-foreground" />
              Enviar Certificado Digital
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                Será gerado um link seguro e temporário (24h) para upload do arquivo
                <strong> .pfx</strong> ou <strong>.p12</strong> da empresa <strong>{empresaAtiva?.razao_social}</strong>.
              </p>
              <p>O link será enviado para seu e-mail cadastrado.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={gerarNovoLink} disabled={reenviando}>
              {reenviando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Gerar Link de Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Invalidar e substituir certificado */}
      <AlertDialog open={showInvalidar} onOpenChange={setShowInvalidar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-destructive" />
              Substituir Certificado Digital
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                O certificado atual será invalidado e um <strong>novo link de upload</strong> será
                gerado para a empresa <strong>{empresaAtiva?.razao_social}</strong>.
              </p>
              <p className="text-destructive font-medium">
                Utilize esta opção caso tenha enviado o certificado errado (outra empresa ou pessoa física).
              </p>
              <p>O novo link será enviado para seu e-mail cadastrado.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await invalidarCertificado();
                await gerarNovoLink();
              }}
              disabled={invalidando || reenviando}
              className="bg-destructive hover:bg-destructive/90"
            >
              {(invalidando || reenviando) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Invalidar e Gerar Novo Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
