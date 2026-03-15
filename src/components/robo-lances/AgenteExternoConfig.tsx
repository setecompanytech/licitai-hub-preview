import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Server, Wifi, WifiOff, Loader2, Settings, CheckCircle2, XCircle, Clock,
  Layers, Cpu, HardDrive,
} from 'lucide-react';

type AgenteConfig = {
  id: string;
  nome: string;
  url_base: string;
  status: string;
  ultimo_heartbeat: string | null;
  versao_agente: string | null;
  capacidades: string[];
  max_sessoes_paralelas: number;
  sessoes_ativas: number;
  ram_mb: number | null;
};

export default function AgenteExternoConfig() {
  const { user } = useAuth();
  const [agentes, setAgentes] = useState<AgenteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [urlBase, setUrlBase] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [nome, setNome] = useState('Agente Principal');
  const [maxSessoes, setMaxSessoes] = useState('3');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('agente_externo_config')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setAgentes((data || []) as unknown as AgenteConfig[]);
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!urlBase) return;
    setSaving(true);

    try {
      const resp = await supabase.functions.invoke('robo-lances-webhook/configurar-agente', {
        body: {
          url_base: urlBase,
          nome,
          api_key: apiKey,
          max_sessoes_paralelas: parseInt(maxSessoes),
        },
      });

      if (resp.error) throw resp.error;
      const result = resp.data as { success: boolean; agente: AgenteConfig; error?: string };
      if (!result.success) throw new Error(result.error || 'Erro ao configurar');

      toast.success(`Agente configurado: ${result.agente.status}`);
      setAgentes((prev) => {
        const exists = prev.find((a) => a.id === result.agente.id);
        if (exists) return prev.map((a) => (a.id === result.agente.id ? result.agente : a));
        return [...prev, result.agente];
      });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao configurar agente');
    } finally {
      setSaving(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ativo': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'offline': return <WifiOff className="w-4 h-4 text-destructive" />;
      case 'verificando': return <Loader2 className="w-4 h-4 animate-spin text-warning" />;
      default: return <XCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ativo: 'bg-success/15 text-success border-success/30',
      offline: 'bg-destructive/15 text-destructive border-destructive/30',
      verificando: 'bg-warning/15 text-warning border-warning/30',
      inativo: 'bg-muted text-muted-foreground border-border',
      erro: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    return map[status] || map.inativo;
  };

  const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robo-lances-webhook/callback`;

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Server className="w-4 h-4 text-accent" />
          Agente Externo de Lances
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Settings className="w-4 h-4 mr-1" /> Configurar Agente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-accent" />
                Configurar Agente Externo
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                <p className="text-xs text-info">
                  O agente externo suporta <strong>múltiplas sessões paralelas</strong>, permitindo
                  disputar em vários portais simultaneamente com empresas diferentes. Cada sessão
                  consome ~500MB de RAM.
                </p>
              </div>

              <div>
                <Label className="text-xs">Nome do Agente</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Agente Principal"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">URL Base do Agente *</Label>
                <Input
                  value={urlBase}
                  onChange={(e) => setUrlBase(e.target.value)}
                  placeholder="https://meu-agente.exemplo.com"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Servidor que roda Puppeteer + certificado digital para automação real
                </p>
              </div>

              <div>
                <Label className="text-xs">Chave de API do Agente</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Chave secreta para autenticação"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Máximo de Sessões Paralelas</Label>
                <Select value={maxSessoes} onValueChange={setMaxSessoes}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 sessão (~2GB RAM)</SelectItem>
                    <SelectItem value="2">2 sessões (~2.5GB RAM)</SelectItem>
                    <SelectItem value="3">3 sessões (~3GB RAM)</SelectItem>
                    <SelectItem value="4">4 sessões (~4GB RAM)</SelectItem>
                    <SelectItem value="5">5 sessões (~5GB RAM)</SelectItem>
                    <SelectItem value="6">6 sessões (~6GB RAM)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Cada sessão abre um navegador Chromium isolado (~500MB). Ajuste conforme a RAM do VPS.
                </p>
              </div>

              <div className="border border-border/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  URL de Callback (configure no agente)
                </p>
                <code className="block text-[11px] bg-muted p-2 rounded break-all font-mono">
                  {callbackUrl}
                </code>
              </div>

              <div className="border border-border/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Protocolo de Comunicação
                </p>
                <div className="text-[11px] text-muted-foreground space-y-1">
                  <p>Endpoints do agente:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li><code className="bg-muted px-1 rounded">GET /health</code> — Status, capacidade e sessões</li>
                    <li><code className="bg-muted px-1 rounded">POST /sessao/iniciar</code> — Iniciar sessão (paralela)</li>
                    <li><code className="bg-muted px-1 rounded">POST /sessao/pausar</code> — Pausar sessão</li>
                    <li><code className="bg-muted px-1 rounded">POST /sessao/encerrar</code> — Encerrar sessão</li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={!urlBase || saving}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wifi className="w-4 h-4 mr-1" />}
                Conectar Agente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : agentes.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <Server className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Nenhum agente externo configurado. Configure um servidor dedicado para
            habilitar lances reais nos portais de licitação.
          </p>
          <p className="text-[10px] text-muted-foreground">
            Suporte a múltiplas sessões paralelas — dispute em vários portais ao mesmo tempo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agentes.map((agente) => {
            const maxSess = agente.max_sessoes_paralelas || 3;
            const ativas = agente.sessoes_ativas || 0;
            const usagePercent = Math.min(100, (ativas / maxSess) * 100);

            return (
              <div key={agente.id} className="border border-border/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcon(agente.status)}
                    <div>
                      <p className="text-sm font-medium">{agente.nome}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{agente.url_base}</p>
                      {agente.versao_agente && (
                        <p className="text-[10px] text-muted-foreground">v{agente.versao_agente}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {agente.ultimo_heartbeat && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(agente.ultimo_heartbeat).toLocaleTimeString('pt-BR')}
                      </span>
                    )}
                    <Badge variant="outline" className={statusBadge(agente.status)}>
                      {agente.status}
                    </Badge>
                  </div>
                </div>

                {/* Capacidade de sessões paralelas */}
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="w-3.5 h-3.5" />
                      Sessões Paralelas
                    </span>
                    <span className="font-medium">
                      {ativas} / {maxSess} ativas
                    </span>
                  </div>
                  <Progress value={usagePercent} className="h-1.5" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {maxSess - ativas} slot{maxSess - ativas !== 1 ? 's' : ''} disponíve{maxSess - ativas !== 1 ? 'is' : 'l'}
                    </span>
                    {agente.ram_mb && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {agente.ram_mb}MB RAM
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
