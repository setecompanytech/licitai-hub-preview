import { Shield, Monitor, Server, Globe, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    cor: 'text-primary',
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
      <div className="mb-1 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-foreground">Segurança do Certificado Digital</h3>
      </div>

      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          <strong>Política de segurança:</strong> o PRAEFECTUS <strong>não armazena</strong> certificados
          digitais na nuvem. O certificado permanece exclusivamente na sua infraestrutura local.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {MODOS.map((modo) => (
          <div
            key={modo.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted ${modo.cor}`}>
                <modo.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">{modo.nome}</h4>
                  <Badge variant="info">{modo.badge}</Badge>
                  <Badge variant="muted">
                    Segurança: {modo.seguranca}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{modo.descricao}</p>
                <ol className="mt-3 space-y-2">
                  {modo.detalhes.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="shrink-0 font-bold text-primary">{i + 1}.</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Por que não fazemos upload?</strong> Plataformas líderes como Compras.gov.br, Effecti e
          BLL nunca armazenam certificados em servidores centrais. O padrão do mercado é execução local
          (via extensão de navegador ou agente dedicado no VPS do cliente), garantindo que a chave privada
          permaneça sob controle exclusivo do titular.
        </AlertDescription>
      </Alert>
    </div>
  );
}
