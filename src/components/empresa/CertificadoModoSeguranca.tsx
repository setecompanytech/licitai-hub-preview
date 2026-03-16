import { Shield, Monitor, Server, Globe, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MODOS = [
  {
    id: 'agente-vps',
    nome: 'Agente Externo (VPS)',
    descricao: 'Certificado fica no servidor VPS do cliente. Nunca sai da sua infraestrutura.',
    seguranca: 'Máxima',
    badge: 'Recomendado',
    icon: Server,
    cor: 'text-success',
    detalhes: [
      'Instale o Agente de Lances no seu VPS (Ubuntu 22.04+)',
      'Copie o certificado .pfx para a pasta certs/ do agente',
      'Configure CERT_PATH e CERT_PASSWORD no .env do agente',
      'O certificado nunca é transmitido — autenticação mTLS local',
    ],
  },
  {
    id: 'extensao-browser',
    nome: 'Extensão de Navegador',
    descricao: 'O robô executa no seu próprio navegador, usando o certificado local instalado.',
    seguranca: 'Alta',
    badge: 'Prático',
    icon: Monitor,
    cor: 'text-accent',
    detalhes: [
      'Instale a extensão PRAEFECTUS no Chrome/Edge',
      'O certificado A1 deve estar instalado no navegador',
      'A extensão se comunica com o sistema via WebSocket seguro',
      'Ideal para quem não possui VPS dedicado',
    ],
  },
  {
    id: 'plugin-java',
    nome: 'Plugin Java / Browser Nativo',
    descricao: 'Usa o plugin Java ou API nativa do navegador para acessar certificados A3 (token/smartcard).',
    seguranca: 'Alta',
    badge: 'Certificado A3',
    icon: Globe,
    cor: 'text-warning',
    detalhes: [
      'Instale o Java Runtime 8+ e o driver do token/smartcard',
      'O navegador apresenta o certificado via mTLS nativo',
      'Compatível com tokens SafeNet, GD Starsign, etc.',
      'Necessário para portais que exigem certificado A3',
    ],
  },
] as const;

export default function CertificadoModoSeguranca() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-5 h-5 text-accent" />
        <h3 className="text-sm font-semibold">Segurança do Certificado Digital</h3>
      </div>

      <div className="bg-success/10 border border-success/20 rounded-lg p-3">
        <p className="text-xs text-success flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            <strong>Política de segurança:</strong> o PRAEFECTUS <strong>não armazena</strong> certificados
            digitais na nuvem. O certificado permanece exclusivamente na sua infraestrutura local.
          </span>
        </p>
      </div>

      <div className="space-y-3">
        {MODOS.map((modo) => (
          <div
            key={modo.id}
            className="bg-card rounded-xl border border-border/50 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 ${modo.cor}`}>
                <modo.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm">{modo.nome}</h4>
                  <Badge variant="outline" className="text-[10px]">{modo.badge}</Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    Segurança: {modo.seguranca}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{modo.descricao}</p>
                <div className="mt-3 space-y-1.5">
                  {modo.detalhes.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-accent font-bold shrink-0">{i + 1}.</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
        <p className="text-xs text-warning flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Por que não fazemos upload?</strong> Plataformas líderes como Compras.gov.br, Effecti e
            BLL nunca armazenam certificados em servidores centrais. O padrão do mercado é execução local
            (via extensão de navegador ou agente dedicado no VPS do cliente), garantindo que a chave privada
            permaneça sob controle exclusivo do titular.
          </span>
        </p>
      </div>
    </div>
  );
}
