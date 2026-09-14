import { useState } from 'react';
import { Zap } from 'lucide-react';
import { badgeVariants } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import NivelAutomacaoSelector, { type NivelAutomacao } from '@/components/robo-lances/NivelAutomacaoSelector';

/**
 * O modo de operação do robô — o antigo selo "Nível 1" que agora abre a escolha.
 *
 * O selo continua sendo a informação mais cara da tela: nível 3 significa lance
 * com dinheiro da empresa sem ninguém confirmar. Por isso ele segue no topo, com
 * o tom do risco e o nome do nível em texto. O que mudou é que ele deixou de ser
 * só um enfeite e virou o caminho até a escolha — o seletor saiu do estado vazio
 * da disputa e da antiga aba Configurações.
 *
 * Só o administrador da empresa altera. Os demais veem o seletor travado e
 * leem o motivo: decisão de risco financeiro é da empresa, não de quem opera.
 */

const ROTULO: Record<NivelAutomacao, string> = {
  1: 'Assistente',
  2: 'Semiautomático',
  3: 'Automação controlada',
};

type Props = {
  nivel: NivelAutomacao;
  podeAlterar: boolean;
  /** Devolve `true` quando o nível foi aplicado — o diálogo fecha para o aceite de termos abrir. */
  aoAlterar: (nivel: NivelAutomacao) => Promise<boolean> | boolean;
};

export default function DialogoModoDeOperacao({ nivel, podeAlterar, aoAlterar }: Props) {
  const [aberto, setAberto] = useState(false);

  const alterar = async (novo: NivelAutomacao) => {
    if (!podeAlterar || novo === nivel) return;
    const aplicado = await aoAlterar(novo);
    if (aplicado) setAberto(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            badgeVariants({ variant: nivel >= 3 ? 'danger' : nivel === 2 ? 'warning' : 'muted' }),
            'cursor-pointer gap-1.5 py-1 hover:brightness-95',
          )}
          title={
            nivel >= 3
              ? 'O sistema envia lances sem confirmação humana.'
              : nivel === 2
                ? 'O sistema sugere; o envio pede confirmação.'
                : 'Somente acompanhamento — nenhum lance é enviado.'
          }
        >
          <Zap className="h-3 w-3" aria-hidden="true" />
          Modo: Nível {nivel} — {ROTULO[nivel]}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modo de operação do robô</DialogTitle>
          <DialogDescription>
            Define até onde o robô age sozinho nas disputas desta empresa. Os níveis 2 e 3 pedem o
            aceite de termos e um limite financeiro antes de valer.
          </DialogDescription>
        </DialogHeader>
        {!podeAlterar && (
          <p className="g-corpo rounded-md border border-dashed border-border px-3 py-2 text-muted-foreground">
            Só o administrador da empresa altera o modo de operação. Você vê a escolha atual; para
            mudá-la, peça a um administrador em Equipe → Permissões.
          </p>
        )}
        <NivelAutomacaoSelector nivel={nivel} onChange={alterar} disabled={!podeAlterar} />
      </DialogContent>
    </Dialog>
  );
}
