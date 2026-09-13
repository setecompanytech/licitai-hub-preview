import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateAgentTemplate } from '@/lib/agente-template-generator';
import { toast } from 'sonner';
import {
  Download, FileCode, Server, Terminal, Shield, FolderTree,
  Copy, Loader2,
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
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileCode className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
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
            size="lg"
            className="shrink-0"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="w-4 h-4" aria-hidden="true" />
            )}
            Baixar Template (.zip)
          </Button>
        </div>
      </div>

      {/* Passo a passo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-sm text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary-tint text-primary flex items-center justify-center mx-auto">
              <step.icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold">{i + 1}. {step.title}</p>
            <p className="text-sm text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Estrutura de arquivos */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h4 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <FolderTree className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Estrutura do Projeto
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {fileTree.map((f) => (
            <div key={f.name} className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-md bg-muted">
              <FileCode className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
              <code className="text-xs font-mono text-foreground">{f.name}</code>
              <span className="text-xs text-muted-foreground ml-auto">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Callback URL */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
        <h4 className="text-lg font-semibold">Configuração de Callback</h4>
        <p className="text-sm text-muted-foreground">
          Configure esta URL no arquivo <code className="bg-muted px-1 rounded">.env</code> do agente como <code className="bg-muted px-1 rounded">CALLBACK_URL</code>:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted p-3 rounded-md font-mono break-all">
            {callbackUrl}
          </code>
          <Button size="icon" variant="outline" onClick={() => copyToClipboard(callbackUrl)} aria-label="Copiar URL de callback">
            <Copy className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Comandos rápidos */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Terminal className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Comandos Rápidos
        </h4>
        <div className="space-y-2">
          {[
            { label: 'Setup automático', cmd: 'cd agente-lances-externo && chmod +x setup.sh && bash setup.sh' },
            { label: 'Docker Compose', cmd: 'cd agente-lances-externo && docker compose up -d' },
            { label: 'HTTPS (Nginx)', cmd: 'sudo bash setup-nginx.sh agente.seudominio.com.br' },
            { label: 'Testar health', cmd: 'curl http://localhost:3500/health' },
          ].map((c) => (
            <div key={c.label} className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="w-32 justify-center shrink-0">{c.label}</Badge>
              <code className="flex-1 min-w-0 text-xs bg-muted p-2 rounded-md font-mono break-all">{c.cmd}</code>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(c.cmd)} aria-label={`Copiar comando: ${c.label}`}>
                <Copy className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
        <h4 className="text-lg font-semibold">Endpoints Implementados</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-sm font-semibold">Método</th>
                <th className="text-left py-2 px-3 text-sm font-semibold">Rota</th>
                <th className="text-left py-2 px-3 text-sm font-semibold">Descrição</th>
                <th className="text-left py-2 px-3 text-sm font-semibold">Auth</th>
              </tr>
            </thead>
            <tbody>
              {[
                { method: 'GET', route: '/health', desc: 'Status, versão, sessões ativas e capacidades', auth: false },
                { method: 'POST', route: '/sessao/iniciar', desc: 'Inicia uma nova sessão de lance real', auth: true },
                { method: 'POST', route: '/sessao/pausar', desc: 'Pausa sessão em andamento', auth: true },
                { method: 'POST', route: '/sessao/encerrar', desc: 'Encerra sessão e fecha navegador', auth: true },
              ].map((e) => (
                <tr key={e.route} className="border-b border-border">
                  <td className="py-2 px-3">
                    <Badge variant={e.method === 'GET' ? 'success' : 'info'}>
                      {e.method}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 font-mono">{e.route}</td>
                  <td className="py-2 px-3 text-muted-foreground">{e.desc}</td>
                  <td className="py-2 px-3">
                    {e.auth ? (
                      <Badge variant="warning">
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
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
        <h4 className="text-lg font-semibold">Tipos de Callback (Agente → Sistema)</h4>
        <div className="grid grid-cols-1 gap-2">
          {[
            { tipo: 'lance-enviado', desc: 'Lance enviado com sucesso ao portal', payload: '{ rodada, valor, tipo_lance, metadata }' },
            { tipo: 'lance-concorrente', desc: 'Lance de concorrente detectado na disputa', payload: '{ rodada, valor, metadata }' },
            { tipo: 'sessao-encerrada', desc: 'Sessão finalizada (venceu, perdeu ou timeout)', payload: '{ resultado, valor_final, total_rodadas }' },
            { tipo: 'erro', desc: 'Erro durante automação', payload: '{ mensagem }' },
            { tipo: 'heartbeat', desc: 'Sinal de vida periódico (30s)', payload: '{}' },
          ].map((c) => (
            <div key={c.tipo} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-2 px-3 rounded-md bg-muted">
              <code className="text-xs font-mono text-foreground shrink-0 pt-0.5">{c.tipo}</code>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{c.desc}</p>
                <code className="text-xs text-muted-foreground break-all">{c.payload}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
