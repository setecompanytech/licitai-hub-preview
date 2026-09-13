import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import CalendarioLicitacoes from '@/components/calendario/CalendarioLicitacoes';

/**
 * Calendário (identidade 12/09).
 *
 * Título, descrição, ícone e trilha vêm do registro `lib/navegacao/paginas.ts`
 * pela própria rota — a tela não repete o que já está padronizado.
 *
 * O registro declara a ação principal "Novo compromisso", que esta tela NÃO
 * tem: aqui não existe criação de compromisso (isso vive em
 * `/meus-compromissos`). Inventar o botão seria colocar na régua um controle
 * sem função, então o cabeçalho fica sem ação e a divergência foi reportada.
 * A ação real da tela — sincronizar a agenda com Google/Outlook/ICS — segue
 * junto do calendário que ela exporta, dentro de `CalendarioLicitacoes`.
 */
export default function Calendario() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina />
        <CalendarioLicitacoes />
      </div>
    </AppLayout>
  );
}
