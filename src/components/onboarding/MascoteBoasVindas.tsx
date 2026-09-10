import { useCallback, useEffect, useRef, useState } from 'react';
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
 * O modal diz onde é e oferece o atalho "Ferramentas › Tutorial", que leva
 * direto.
 *
 * Até 10/09/2026 ele também ACENDIA o caminho: recortava um buraco no véu
 * sobre o grupo "Ferramentas" e desenhava uma seta dourada até lá. Saiu a
 * pedido do Ian — visualmente pesado — e por uma razão estrutural: dependia
 * de medir a posição de um botão da barra lateral, que agora se esconde até o
 * mouse chegar na borda. Apontar para o que pode não estar na tela é pior que
 * não apontar. O atalho dentro do card é o dedo apontado.
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
    // Um quadro de folga para a tela assentar antes do modal entrar animando.
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

export default function MascoteBoasVindas({ open, onClose }: Props) {
  const navigate = useNavigate();
  const okRef = useRef<HTMLButtonElement>(null);

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
    <div role="dialog" aria-modal="true" aria-labelledby="masc-titulo" className="masc">
      <div className="masc__card">
        <button className="masc__x" onClick={onClose} aria-label="Fechar">
          <X className="w-[17px] h-[17px]" />
        </button>

        <div className="masc__robo">
          <div className="masc__figura">
            <img
              src={mascote}
              alt="Praefectus, o assistente de licitações, de terno e com o dedo indicador levantado"
            />
          </div>
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
            Ele mora no menu à esquerda, dentro de <b>Ferramentas</b> — ou vá direto pelo
            atalho abaixo.
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
