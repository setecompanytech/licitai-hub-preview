import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Aviso de nova versão publicada — a solução definitiva para o bundle velho.
 *
 * O caso que motivou (03/09): um colaborador com a aba aberta há dias operava
 * o código de DIAS atrás — upload de documentos sem empresa_id, kit de
 * faturamento com filtro antigo — e cada correção publicada "não funcionava"
 * para ele. SPA não recarrega sozinha; quem avisa tem de ser o app.
 *
 * Mecânica: o index.html publicado aponta o bundle de entrada
 * (/assets/index-<hash>.js). Se o hash servido difere do que ESTA aba
 * carregou, há versão nova no ar — um toast persistente oferece recarregar.
 * Verifica ao voltar o foco (o momento típico do retorno à aba antiga) e a
 * cada 10 minutos.
 */
export function useAvisoDeNovaVersao() {
  const avisado = useRef(false);
  const ultimaChecagem = useRef(0);

  useEffect(() => {
    // Só faz sentido contra o domínio publicado — no dev, o Vite serve módulos.
    if (/localhost|127\.0\.0\.1/.test(window.location.hostname)) return;

    const bundleDaAba = (document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null)
      ?.getAttribute('src');
    if (!bundleDaAba) return;

    const checar = async () => {
      if (avisado.current) return;
      const agora = Date.now();
      if (agora - ultimaChecagem.current < 60_000) return; // foco repetido não martela
      ultimaChecagem.current = agora;
      try {
        const r = await fetch(`/?v=${agora}`, { cache: 'no-store' });
        if (!r.ok) return;
        const html = await r.text();
        const noAr = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
        if (noAr && noAr !== bundleDaAba) {
          avisado.current = true;
          toast.info('Nova versão do Praefectus publicada.', {
            description: 'Recarregue para receber as correções — a aba atual ainda roda a versão anterior.',
            duration: Infinity,
            action: { label: 'Recarregar', onClick: () => window.location.reload() },
          });
        }
      } catch {
        /* rede indisponível — a próxima checagem tenta de novo */
      }
    };

    const aoFocar = () => { void checar(); };
    window.addEventListener('focus', aoFocar);
    const intervalo = window.setInterval(() => { void checar(); }, 10 * 60_000);
    // Primeira checagem descontraída, depois que a tela assentou.
    const inicial = window.setTimeout(() => { void checar(); }, 30_000);

    return () => {
      window.removeEventListener('focus', aoFocar);
      window.clearInterval(intervalo);
      window.clearTimeout(inicial);
    };
  }, []);
}
