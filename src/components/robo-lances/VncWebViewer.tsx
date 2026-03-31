import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Monitor, ExternalLink, Maximize2, Minimize2, RefreshCw,
  ShieldCheck, AlertTriangle, X, Loader2,
} from 'lucide-react';

const NOVNC_BASE_URL = 'https://agente.praefectus.com.br/vnc';

export default function VncWebViewer() {
  const [expanded, setExpanded] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [loading, setLoading] = useState(false);

  const vncUrl = `${NOVNC_BASE_URL}/vnc.html?path=/vnc/&autoconnect=true&resize=scale&reconnect=true&reconnect_delay=3000`;

  const handleOpenViewer = () => {
    setLoading(true);
    setShowViewer(true);
  };

  const handleOpenExternal = () => {
    window.open(vncUrl, '_blank', 'noopener,noreferrer');
  };

  const handleClose = () => {
    setShowViewer(false);
    setExpanded(false);
    setLoading(false);
  };

  const handleRefresh = () => {
    setLoading(true);
    setShowViewer(false);
    setTimeout(() => setShowViewer(true), 300);
  };

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-accent" />
          <h4 className="text-sm font-semibold">Acesso Remoto — VNC Web</h4>
          <Badge variant="outline" className="text-[9px] ml-1">noVNC</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {showViewer && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleRefresh}
                title="Reconectar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Reduzir' : 'Expandir'}
              >
                {expanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleOpenExternal}
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleClose}
                title="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {!showViewer ? (
        <div className="p-5 space-y-4">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto">
              <Monitor className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Acesse a tela do servidor diretamente pelo navegador para resolver
                desafios de <strong>2FA</strong>, <strong>Captcha</strong> ou <strong>código de acesso gov.br</strong>,
                sem precisar instalar programas adicionais.
              </p>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Quando usar o VNC?</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>O robô solicitou código de verificação por SMS/e-mail</li>
                  <li>Apareceu um Captcha na tela de login do portal</li>
                  <li>É necessário autorizar acesso via gov.br (2 etapas)</li>
                  <li>Precisa gerar código de acesso no app gov.br</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleOpenViewer}
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground text-xs gap-2"
            >
              <Monitor className="w-4 h-4" />
              Abrir VNC Integrado
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenExternal}
              className="flex-1 text-xs gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir em Nova Aba
            </Button>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Conexão segura via HTTPS — sem necessidade de instalar software</span>
          </div>
        </div>
      ) : (
        <div className={`relative bg-black ${expanded ? 'h-[600px]' : 'h-[400px]'} transition-all duration-300`}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
                <p className="text-xs text-muted-foreground">Conectando ao servidor VPS...</p>
              </div>
            </div>
          )}
          <iframe
            src={vncUrl}
            className="w-full h-full border-0"
            title="VNC Web Viewer — noVNC"
            allow="clipboard-read; clipboard-write; fullscreen"
            allowFullScreen
            onLoad={() => setLoading(false)}
          />
        </div>
      )}
    </div>
  );
}
