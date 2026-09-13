import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { BadgeCheck, ChevronRight, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui/dialog';
import mascote from '@/assets/brand/mascote-robo-sem-fundo.png';

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
 * Identidade 12/09: o modal passou a ser o Dialog de ui (véu, foco preso,
 * Escape, rolagem interna) vestido com os tokens do tema. A folha
 * `styles/mascote.css` que o desenhava — selo navy com letra dourada, sombras
 * em rgba, tamanhos fora da escala — deixou de ser importada; o único efeito
 * dela que valia a pena, o robô flutuando, veio para cá em framer-motion e
 * respeita `prefers-reduced-motion`.
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
  const reduzirMovimento = useReducedMotion();

  const irParaTutorial = () => { onClose(); navigate('/tutorial'); };

  return (
    /* Escape e o X fecham (onOpenChange → onClose). Clique no véu NÃO fecha,
       como antes: é a apresentação do guia, e um clique perdido não deve
       dispensá-la para sempre. */
    <Dialog open={open} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <DialogContent
        className="max-w-3xl gap-0 p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        /* O foco nasce no "Entendi" — o caminho mais curto para quem só quer
           seguir — e não no primeiro botão da ordem do DOM. */
        onOpenAutoFocus={(e) => { e.preventDefault(); okRef.current?.focus(); }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr]">
          {/* Coluna do robô: sem fundo próprio, centralizado na vertical — assim
              não sobra vazio em cima dele quando o texto ao lado é mais alto. */}
          <div className="flex items-center justify-center px-6 pt-6 sm:py-6 sm:pl-6 sm:pr-3">
            <div className="relative w-full max-w-[150px] sm:max-w-[220px]">
              {/* A sombra elíptica no chão é o que impede o robô de flutuar sem
                  peso. Fica presa à figura para acompanhá-lo onde ele estiver. */}
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 hidden h-4 w-3/5 -translate-x-1/2 rounded-full bg-foreground/15 blur-md sm:block"
              />
              <motion.img
                src={mascote}
                alt="Praefectus, o assistente de licitações, de terno e com o dedo indicador levantado"
                className="relative z-10 block h-auto w-full"
                animate={reduzirMovimento ? undefined : { y: [0, -8, 0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>

          <div className="flex flex-col p-6 sm:py-8 sm:pr-8 sm:pl-4">
            <Badge variant="info" className="w-fit gap-1">
              <BadgeCheck className="w-4 h-4" aria-hidden="true" />
              Seu assistente
            </Badge>

            {/* Navy pelo token de texto: no claro `--foreground` e `--navy` são
                o mesmo #102A43, e no escuro só o primeiro continua legível. */}
            <DialogTitle className="mt-4 text-xl font-semibold text-foreground text-balance">
              Muito prazer — sou o Praefectus.
            </DialogTitle>

            <DialogDescription className="mt-3 text-sm text-muted-foreground">
              Seja bem-vindo. Vou acompanhar você por aqui e, se me permite, começo
              indicando o caminho mais curto.
            </DialogDescription>
            <p className="mt-3 text-sm text-muted-foreground">
              Deixei preparado um <b className="font-semibold text-foreground">guia passo a passo</b> com o percurso completo de uma
              licitação: da busca do edital nos portais até o resultado no Painel. Você vai
              marcando cada etapa conforme avança — o sistema guarda de onde você parou.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Ele mora no menu à esquerda, dentro de <b className="font-semibold text-foreground">Ferramentas</b> — ou vá direto pelo
              atalho abaixo.
            </p>

            <div className="mt-4">
              <Button type="button" variant="outline" onClick={irParaTutorial}>
                <GraduationCap aria-hidden="true" />
                Ferramentas
                <ChevronRight className="text-muted-foreground" aria-hidden="true" />
                Tutorial
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button type="button" onClick={onClose} ref={okRef}>
                Entendi, obrigado!
              </Button>
              <span className="text-xs text-muted-foreground">
                Quando precisar de mim outra vez,<br />
                o guia continua em <b className="font-semibold text-foreground">Ferramentas › Tutorial</b>.
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
