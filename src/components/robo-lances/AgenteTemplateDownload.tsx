import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateAgentTemplate } from '@/lib/agente-template-generator';
import { toast } from 'sonner';
import {
  Download, FileCode, Server, Terminal, Shield, FolderTree,
  CheckCircle2, Copy, Loader2,
} from 'lucide-react';

export default function AgenteTemplateDownload() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateAgentTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agente-lances-externo.zip';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template baixado com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao gerar template: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robo-lances-webhook/callback`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const fileTree = [
    { name: 'setup.sh', desc: 'Instalação automática (Ubuntu/Debian)' },
    { name: 'ecosystem.config.js', desc: 'PM2 — processo persistente 24/7' },
    { name: 'docker-compose.yml', desc: 'Deploy com Docker Compose' },
    { name: 'setup-nginx.sh', desc: 'HTTPS com Nginx + Let\'s Encrypt' },
    { name: 'src/index.js', desc: 'Servidor Express v2 com validação' },
    { name: 'src/session-manager.js', desc: 'Gerenciador com portais reais' },
    { name: 'src/browser.js', desc: 'Puppeteer + certificado A1' },
    { name: 'src/portals/index.js', desc: 'Registry de 8 portais suportados' },
    { name: 'src/portals/comprasgov.js', desc: 'Compras.gov.br (certificado)' },
    { name: 'src/portals/bll.js', desc: 'Bolsa de Licitações e Leilões' },
    { name: 'src/portals/licitacoes-e.js', desc: 'Licitações-e (Banco do Brasil)' },
    { name: 'src/portals/pncp.js', desc: 'PNCP (Portal Nacional)' },
    { name: 'src/portals/bec-sp.js', desc: 'BEC-SP (Bolsa Eletrônica SP)' },
    { name: 'src/portals/licitanet.js', desc: 'Licitanet' },
  ];

  const steps = [
    {
      icon: Download,
      title: 'Baixar Template',
      desc: 'Clique no botão abaixo para baixar o projeto Node.js completo.',
    },
    {
      icon: Server,
      title: 'Deploy em VPS/EC2',
      desc: 'Suba o projeto em um servidor com Node.js 20+ e Chromium instalado.',
    },
    {
      icon: Shield,
      title: 'Configurar Certificado',
      desc: 'Copie seu certificado .pfx para a pasta certs/ e configure o .env.',
    },
    {
      icon: Terminal,
      title: 'Executar',
      desc: 'Rode npm install && npm start ou use Docker.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Download */}
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <FileCode className="w-5 h-5 text-accent" />
              Template do Agente Externo
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl">
              Projeto Node.js v2.1 com <strong>8 portais implementados</strong>, <strong>multi-sessão paralela</strong>,
              setup automático, PM2, Docker Compose e HTTPS. Pronto para deploy em VPS.
            </p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            size="lg"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Baixar Template (.zip)
          </Button>
        </div>
      </div>

      {/* Passo a passo */}
      <div className="grid grid-cols-4 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <step.icon className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xs font-semibold">{i + 1}. {step.title}</p>
            <p className="text-[11px] text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Estrutura de arquivos */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <FolderTree className="w-4 h-4 text-accent" />
          Estrutura do Projeto
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {fileTree.map((f) => (
            <div key={f.name} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/50">
              <FileCode className="w-3 h-3 text-muted-foreground shrink-0" />
              <code className="text-[11px] font-mono text-foreground">{f.name}</code>
              <span className="text-[10px] text-muted-foreground ml-auto">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Callback URL */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-3">
        <h4 className="text-sm font-semibold">Configuração de Callback</h4>
        <p className="text-xs text-muted-foreground">
          Configure esta URL no arquivo <code className="bg-muted px-1 rounded">.env</code> do agente como <code className="bg-muted px-1 rounded">CALLBACK_URL</code>:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[11px] bg-muted p-3 rounded-lg font-mono break-all">
            {callbackUrl}
          </code>
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(callbackUrl)}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Comandos rápidos */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Terminal className="w-4 h-4 text-accent" />
          Comandos Rápidos
        </h4>
        <div className="space-y-2">
          {[
            { label: 'Setup automático', cmd: 'cd agente-lances-externo && chmod +x setup.sh && bash setup.sh' },
            { label: 'Docker Compose', cmd: 'cd agente-lances-externo && docker compose up -d' },
            { label: 'HTTPS (Nginx)', cmd: 'sudo bash setup-nginx.sh agente.seudominio.com.br' },
            { label: 'Testar health', cmd: 'curl http://localhost:3500/health' },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] w-28 justify-center shrink-0">{c.label}</Badge>
              <code className="flex-1 text-[11px] bg-muted p-2 rounded font-mono break-all">{c.cmd}</code>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(c.cmd)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-3">
        <h4 className="text-sm font-semibold">Endpoints Implementados</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-muted-foreground">Método</th>
                <th className="text-left py-2 px-3 text-muted-foreground">Rota</th>
                <th className="text-left py-2 px-3 text-muted-foreground">Descrição</th>
                <th className="text-left py-2 px-3 text-muted-foreground">Auth</th>
              </tr>
            </thead>
            <tbody>
              {[
                { method: 'GET', route: '/health', desc: 'Status, versão, sessões ativas e capacidades', auth: false },
                { method: 'POST', route: '/sessao/iniciar', desc: 'Inicia uma nova sessão de lance real', auth: true },
                { method: 'POST', route: '/sessao/pausar', desc: 'Pausa sessão em andamento', auth: true },
                { method: 'POST', route: '/sessao/encerrar', desc: 'Encerra sessão e fecha navegador', auth: true },
              ].map((e) => (
                <tr key={e.route} className="border-b border-border/30">
                  <td className="py-2 px-3">
                    <Badge variant="outline" className={e.method === 'GET' ? 'bg-success/10 text-success border-success/30' : 'bg-info/10 text-info border-info/30'}>
                      {e.method}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 font-mono">{e.route}</td>
                  <td className="py-2 px-3 text-muted-foreground">{e.desc}</td>
                  <td className="py-2 px-3">
                    {e.auth ? (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                        X-Agent-Key
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Público</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tipos de callback */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-3">
        <h4 className="text-sm font-semibold">Tipos de Callback (Agente → Sistema)</h4>
        <div className="grid grid-cols-1 gap-2">
          {[
            { tipo: 'lance-enviado', desc: 'Lance enviado com sucesso ao portal', payload: '{ rodada, valor, tipo_lance, metadata }' },
            { tipo: 'lance-concorrente', desc: 'Lance de concorrente detectado na disputa', payload: '{ rodada, valor, metadata }' },
            { tipo: 'sessao-encerrada', desc: 'Sessão finalizada (venceu, perdeu ou timeout)', payload: '{ resultado, valor_final, total_rodadas }' },
            { tipo: 'erro', desc: 'Erro durante automação', payload: '{ mensagem }' },
            { tipo: 'heartbeat', desc: 'Sinal de vida periódico (30s)', payload: '{}' },
          ].map((c) => (
            <div key={c.tipo} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-muted/30">
              <code className="text-[11px] font-mono text-accent shrink-0 pt-0.5">{c.tipo}</code>
              <div className="flex-1">
                <p className="text-[11px] text-foreground">{c.desc}</p>
                <code className="text-[10px] text-muted-foreground">{c.payload}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
