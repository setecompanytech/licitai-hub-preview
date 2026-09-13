import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import CalendarioLicitacoes from '@/components/calendario/CalendarioLicitacoes';

/**
 * Calendário (identidade 12/09).
 *
 * Título, descrição, ícone e trilha vêm do registro `lib/navegacao/paginas.ts`
 * pela própria rota. A ação da tela é sincronizar a agenda (Google/Outlook/ICS)
 * e fica junto do calendário, dentro de `CalendarioLicitacoes`.
 *
 * A pendência do `acao: 'Novo compromisso'` no registro foi fechada em 13/09:
 * a linha saiu de `paginas.ts`. A tela não cria compromisso — isso é de
 * `/meus-compromissos` —, e um registro que anuncia ação inexistente é o
 * rascunho de um botão fictício.
 */
export default function Calendario() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina denso />
        <CalendarioLicitacoes />
      </div>
    </AppLayout>
  );
}
