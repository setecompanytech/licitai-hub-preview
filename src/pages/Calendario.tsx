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
 * Pendência fora deste lote: o registro ainda declara `acao: 'Novo
 * compromisso'` para `/calendario`, ação que não existe aqui — criar
 * compromisso é de `/meus-compromissos`. A linha tem que sair de `paginas.ts`.
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
