import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BadgeCheck, ChevronRight, GraduationCap, X } from 'lucide-react';
import mascote from '@/assets/brand/mascote-robo-sem-fundo.png';
import '@/styles/mascote.css';

/**
 * Apresentação do assistente, no primeiro acesso.
 *
 * Existe porque o Tutorial mora dentro de um grupo recolhido da coluna
 * esquerda: quem entra pela primeira vez não tem como saber que ele está ali.
 * Em vez de descrever o caminho por escrito, o modal ACENDE o caminho — recorta
 * um buraco no véu sobre o grupo "Ferramentas" e aponta para ele.
 *
 * QUANDO APARECE. Só no primeiro acesso, e só DEPOIS que o OnboardingWizard
 * terminou: os dois disparam na mesma condição e empilhados se atropelariam.
 * A ordem é a natural — configura a conta, depois é apresentado ao guia.
 *
 * Cada um tem seu próprio marcador em localStorage. Compartilhar um faria
 * dispensar um dispensar o outro, e quem pulasse a configuração nunca veria o
 * tutorial.
 */

const CHAVE = 'praefectus_mascote_visto_v1';

/** Já mostramos este modal para esta pessoa neste navegador? */
function jaViu(): boolean {
  try {
    return localStorage.getItem(CHAVE) === 'true';
  } catch {
    // Janela privada recusa armazenamento. Melhor não mostrar do que mostrar
    // a cada carregamento de página.
    return true;
  }
}

export function useMascoteBoasVindas(liberado: boolean) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!user || !liberado || jaViu()) return;
    // Um quadro de folga para a coluna esquerda existir e ser medível — sem
    // isso o holofote nasce sem alvo e o modal cai no centro.
    const t = setTimeout(() => setAberto(true), 350);
    return () => clearTimeout(t);
  }, [user, liberado]);

  const fechar = useCallback(() => {
    setAberto(false);
    try {
      localStorage.setItem(CHAVE, 'true');
    } catch { /* sem armazenamento: volta na próxima sessão, e tudo bem */ }
  }, []);

  return { mascoteAberto: aberto, fecharMascote: fechar };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Onde o holofote cai: o botão do grupo que contém o Tutorial. */
const SELETOR_ALVO = '[data-grupo="Ferramentas"]';

type Geo = {
  foco: { top: number; left: number; width: number; height: number };
  seta: string;
  padLeft: number;
} | null;

export default function MascoteBoasVindas({ open, onClose }: Props) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const [geo, setGeo] = useState<Geo>(null);

  const medir = useCallback(() => {
    const alvo = document.querySelector(SELETOR_ALVO);
    const r = alvo?.getBoundingClientRect();

    // Sem alvo utilizável, nada de holofote nem seta. Abaixo de 900px a coluna
    // vira gaveta e o rótulo some; apontar para o que não está na tela é pior
    // que não apontar.
    const temAlvo =
      !!r && r.width > 10 && r.height > 10 &&
      r.bottom > 70 && r.top < window.innerHeight - 20 &&
      window.innerWidth > 900;

    if (!temAlvo || !r) { setGeo(null); return; }

    const pad = 7;
    const foco = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };

    // O card encosta na coluna. Vão curto é o que permite conector firme em vez
    // da curva longa e frouxa do protótipo.
    const padLeft = Math.min(r.right + 56, window.innerWidth * 0.34);

    const c = cardRef.current?.getBoundingClientRect();
    if (!c) { setGeo({ foco, seta: '', padLeft }); return; }

    const x1 = c.left - 10;
    const y1 = c.top + Math.min(c.height * 0.34, 150);
    const x2 = r.right + 16;
    const y2 = r.top + r.height / 2;

    // Uma curvatura só, quadrática, com o controle perto do destino: o traço
    // sai reto do card e se acomoda na horizontal ao chegar. Bezier cúbica com
    // controles no meio do vão é o que produz a onda de rabisco.
    const seta = `M ${x1} ${y1} Q ${x2 + (x1 - x2) * 0.35} ${y2} ${x2} ${y2}`;

    setGeo({ foco, seta, padLeft });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    medir();
    // Segunda medição depois que o card assumiu o padding: a primeira roda com
    // o card ainda centralizado, e a seta sairia do lugar errado.
    const t = setTimeout(medir, 30);
    window.addEventListener('resize', medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', medir);
    };
  }, [open, medir]);

  useEffect(() => {
    if (!open) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const irParaTutorial = () => { onClose(); navigate('/tutorial'); };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="masc-titulo"
      className={`masc${geo ? '' : ' masc--sem-alvo'}`}
      style={geo ? { paddingLeft: geo.padLeft } : undefined}
    >
      {geo && (
        <>
          <div className="masc__foco" style={geo.foco} aria-hidden="true" />
          <svg className="masc__seta" aria-hidden="true">
            <defs>
              {/* Cabeça sólida e proporcional ao traço de 3px. A do protótipo
                  tinha 10 unidades para uma linha de 525px — some. */}
              <marker
                id="masc-ponta"
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 12 6 L 0 12 z" fill="hsl(var(--logo-accent))" />
              </marker>
            </defs>
            <path d={geo.seta} markerEnd="url(#masc-ponta)" />
          </svg>
        </>
      )}

      <div className="masc__card" ref={cardRef}>
        <button className="masc__x" onClick={onClose} aria-label="Fechar">
          <X className="w-[17px] h-[17px]" />
        </button>

        <div className="masc__robo">
          <img
            src={mascote}
            alt="Praefectus, o assistente de licitações, de terno e com o dedo indicador levantado"
          />
        </div>

        <div className="masc__txt">
          <span className="masc__selo">
            <BadgeCheck className="w-3 h-3" /> Seu assistente
          </span>

          <h2 className="masc__t" id="masc-titulo">Muito prazer — sou o Praefectus.</h2>

          <p className="masc__d">
            Seja bem-vindo. Vou acompanhar você por aqui e, se me permite, começo
            indicando o caminho mais curto.
          </p>
          <p className="masc__d">
            Deixei preparado um <b>guia passo a passo</b> com o percurso completo de uma
            licitação: da busca do edital nos portais até o resultado no Painel. Você vai
            marcando cada etapa conforme avança — o sistema guarda de onde você parou.
          </p>
          <p className="masc__d">
            Ele mora no menu à esquerda, dentro de <b>Ferramentas</b>. Estou apontando para lá.
          </p>

          <button className="masc__caminho" onClick={irParaTutorial}>
            <GraduationCap className="w-[15px] h-[15px]" />
            Ferramentas
            <ChevronRight className="w-3.5 h-3.5" />
            Tutorial
          </button>

          <div className="masc__pe">
            <button className="masc__ok" onClick={onClose} ref={okRef}>
              Entendi, obrigado!
            </button>
            <span className="masc__dica">
              Quando precisar de mim outra vez,<br />
              o guia continua em <b>Ferramentas › Tutorial</b>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
