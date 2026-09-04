import { useCallback, useEffect, useState } from 'react';
import { ArrowUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Salto entre as seções da página, para quem lê um painel longo.
 *
 * O botão NOMEIA o destino — "Oportunidades ⌄", não uma seta solta. Seta que
 * só aponta para baixo é o mesmo que rolar: a pessoa aperta sem saber quanto
 * anda nem onde chega. Com o nome, o botão vira sumário de um item, sempre
 * mostrando o que vem em seguida.
 *
 * Na última seção ele vira "Voltar ao topo": num painel de seis seções, o
 * caminho de volta é mais longo que o de ida, e ninguém quer rolar seis telas
 * para trás.
 *
 * Lê `[data-secao]` do documento — a página só precisa marcar as seções, sem
 * manter índice nenhum em duplicidade.
 */

/** Altura do cabeçalho grudado + folga, para o título não nascer embaixo dele. */
const FOLGA = 88;

/* Distância do elemento ao TOPO DO DOCUMENTO.
   `offsetTop` mediria até o ancestral posicionado mais próximo — e basta um
   `relative` em qualquer wrapper do layout para a conta virar outra coisa, sem
   erro nenhum aparecer. O retângulo somado à rolagem é absoluto sempre. */
function topoNoDocumento(el: HTMLElement) {
  return el.getBoundingClientRect().top + window.scrollY;
}

interface Secao {
  el: HTMLElement;
  nome: string;
}

export default function NavegadorDeSecoes() {
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [indice, setIndice] = useState(0);

  // As seções nascem com a página; o observador cobre o caso de uma delas
  // aparecer depois (bloco que só existe quando há dado).
  useEffect(() => {
    const ler = () => {
      const achadas = Array.from(document.querySelectorAll<HTMLElement>('[data-secao]'))
        .map((el) => ({ el, nome: el.dataset.secao || '' }))
        .filter((s) => s.nome);
      setSecoes((antes) =>
        antes.length === achadas.length && antes.every((a, i) => a.el === achadas[i].el)
          ? antes
          : achadas,
      );
    };
    ler();
    const obs = new MutationObserver(ler);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // Qual seção está sob o cabeçalho agora.
  useEffect(() => {
    if (secoes.length === 0) return;
    const aoRolar = () => {
      const linha = window.scrollY + FOLGA + 8;
      let atual = 0;
      secoes.forEach((s, i) => {
        if (topoNoDocumento(s.el) <= linha) atual = i;
      });
      setIndice(atual);
    };
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
    };
  }, [secoes]);

  const irPara = useCallback((topo: number) => {
    /* `scrollIntoView` alinharia o título ao topo da janela — embaixo do
       cabeçalho grudado, que tem 64px. Daí a conta com a folga. */
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: topo, behavior: suave ? 'smooth' : 'auto' });
  }, []);

  if (secoes.length < 2) return null;

  const fim = indice >= secoes.length - 1;
  const proxima = fim ? null : secoes[indice + 1];

  return (
    <div className="nao-imprime fixed bottom-5 left-1/2 -translate-x-1/2 z-40 hidden sm:block">
      <button
        type="button"
        onClick={() =>
          fim
            ? irPara(0)
            : irPara(Math.max(0, topoNoDocumento((proxima as Secao).el) - FOLGA))
        }
        aria-label={fim ? 'Voltar ao topo da página' : `Ir para a seção ${proxima?.nome}`}
        className={cn(
          'group flex items-center gap-2 rounded-full py-2 pl-4 pr-3',
          // 95 e não 92: a escala de opacidade do Tailwind vai de 5 em 5, e um
          // valor fora dela não gera classe — o botão sairia transparente.
          'bg-navy/95 text-white backdrop-blur-sm ring-1 ring-white/15',
          'shadow-lg transition-[transform,box-shadow,background-color] duration-200',
          'hover:bg-navy hover:-translate-y-0.5 hover:shadow-xl',
          'active:translate-y-0 active:duration-75',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
          'motion-reduce:transform-none motion-reduce:transition-none',
        )}
      >
        <span className="text-sm font-medium max-w-[190px] truncate">
          {fim ? 'Voltar ao topo' : proxima?.nome}
        </span>
        {fim ? (
          <ArrowUp className="w-4 h-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown
            className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transform-none"
            aria-hidden="true"
          />
        )}

        {/* Progresso: um traço por seção. Diz quanto falta sem ocupar espaço —
            e é a única parte que continua legível de canto de olho. */}
        <span aria-hidden="true" className="flex items-center gap-1 ml-1 pl-2 border-l border-white/20">
          {secoes.map((s, i) => (
            <span
              key={s.nome}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                i === indice ? 'w-3 bg-white' : 'w-1 bg-white/35',
              )}
            />
          ))}
        </span>
      </button>
    </div>
  );
}
