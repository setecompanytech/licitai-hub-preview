import { useState } from 'react';
import { ChevronDown, ExternalLink, ShieldAlert, Route } from 'lucide-react';

/**
 * O caminho manual até o Compras.gov — e por que não instalar o certificado
 * na própria máquina.
 *
 * ─── POR QUE ISTO ESTÁ NA TELA, E NÃO SÓ NA DOCUMENTAÇÃO ────────────────────
 *
 * As duas informações abaixo custaram tempo real para serem descobertas em
 * 09/09/2026, e as duas são contraintuitivas:
 *
 * 1. O endereço óbvio (`compras.gov.br`) leva ao site institucional, que é
 *    conteúdo — não ao sistema onde se disputa. Foram três portas testadas até
 *    achar a certa.
 *
 * 2. A reação natural de quem tem o `.pfx` em mãos é instalá-lo no próprio
 *    navegador para "só dar uma olhada". Isso espalha a chave privada da
 *    empresa do cliente por máquinas que ninguém controla — e não resolve,
 *    porque a verificação em duas etapas continua caindo no celular do
 *    responsável.
 *
 * Documentação em `.md` não chega a quem está com a tela aberta às pressas
 * antes de um pregão. Aqui chega.
 */

export default function AcessoManualPortal() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <Route className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Como entrar no portal manualmente</h3>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            o caminho certo, e o que não fazer
          </span>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && (
        <div className="border-t border-border p-6 space-y-4">
          <div>
            <p className="text-base font-medium mb-2">Compras.gov.br — o caminho que funciona</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>
                Abra{' '}
                <a
                  href="https://www.comprasnet.gov.br/seguro/loginPortalUASG.asp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 font-mono text-xs"
                >
                  comprasnet.gov.br/seguro/loginPortalUASG.asp
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </li>
              <li>Escolha o perfil <strong>Fornecedor Brasileiro</strong></li>
              <li>Clique em <strong>Entrar com Gov.br</strong></li>
              <li>Na tela do gov.br, escolha <strong>Seu certificado digital</strong></li>
              <li>Confirme a identidade, se a verificação em duas etapas estiver ativa</li>
            </ol>
          </div>

          {/* O erro que a intuição comete: ir pelo endereço que parece o certo. */}
          <div className="bg-muted border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Não vá por <code>compras.gov.br</code>.</strong>{' '}
              Aquele endereço leva ao site institucional, que é conteúdo — não ao sistema onde se
              disputa. Verificado em 09/09/2026: três portas foram testadas até achar esta.
            </p>
          </div>

          <div className="bg-warning-tint border border-warning-line rounded-lg p-4">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-warning-ink shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">
                  Não instale o certificado no seu navegador
                </p>
                <p>
                  Para clicar em "Seu certificado digital" no seu Chrome, o <strong>.pfx</strong>{' '}
                  teria que ser importado na sua máquina. Um certificado A1 é a{' '}
                  <strong>assinatura digital da empresa</strong>: com o arquivo e a senha, alguém
                  assina documento, emite nota e entra em portal como se fosse ela.
                </p>
                <p>
                  E não resolveria: a verificação em duas etapas continua caindo no celular do
                  responsável pela conta gov.br.
                </p>
                <p className="text-foreground">
                  O certificado já está instalado no navegador do robô, na VPS. Para olhar o portal,
                  use a <strong>tela remota (VNC)</strong> acima — é para isso que ela existe.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-base font-medium mb-2">Portal de Compras Públicas</p>
            <p className="text-sm text-muted-foreground">
              Entra por{' '}
              <a
                href="https://operacao.portaldecompraspublicas.com.br/18/loginext/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 font-mono text-xs"
              >
                operacao.portaldecompraspublicas.com.br/18/loginext/
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>{' '}
              — usuário e senha, sem certificado. Os processos ficam em{' '}
              <strong>Processo → Seus Processos</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
