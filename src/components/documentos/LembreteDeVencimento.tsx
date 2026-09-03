import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  adiar,
  estaAdiado,
  gravarAdiamentos,
  lembretesDe,
  lerAdiamentos,
  prazoPorExtenso,
  semOsObsoletos,
  type Adiamentos,
  type Lembrete,
} from '@/lib/documentos/lembretes';

/**
 * O lembrete de vencimento, no canto da tela, em qualquer página.
 *
 * Vencimento não é assunto da página de Documentos: quem monta uma proposta às
 * onze da noite não vai até lá conferir certidão. Por isso o aviso acompanha a
 * pessoa — e por isso ele pode ser fechado, senão vira ruído que se aprende a
 * ignorar, que é o mesmo que não existir.
 *
 * O × ADIA. A regra de quanto tempo, e por que renovar o documento faz o aviso
 * sumir sozinho, está em `lib/documentos/lembretes` — com teste.
 */

/** Quantos cabem na caixa antes de virar parede de texto. */
const VISIVEIS = 3;

/**
 * REBRAND — o aviso segue o desenho de toast do protótipo: cartão branco,
 * borda fina em volta e uma FAIXA de 3px colorida só na esquerda. Antes o
 * cartão inteiro era tingido pela gravidade, e três avisos empilhados viravam
 * três blocos coloridos disputando a atenção. A faixa diz a mesma coisa sem
 * pintar a caixa.
 */
const ESTILO = {
  vencido: {
    caixa: 'border-l-destructive',
    texto: 'text-destructive-ink',
    Icone: AlertTriangle,
  },
  critico: {
    caixa: 'border-l-destructive',
    texto: 'text-destructive-ink',
    Icone: AlertTriangle,
  },
  atencao: {
    caixa: 'border-l-warning',
    texto: 'text-warning-ink',
    Icone: Clock,
  },
} as const;

export default function LembreteDeVencimento() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [adiamentos, setAdiamentos] = useState<Adiamentos>({});
  const [tudo, setTudo] = useState(false);

  useEffect(() => {
    if (!user) { setLembretes([]); return; }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('documentos')
        .select('id, nome, validade')
        .eq('user_id', user.id)
        .not('validade', 'is', null);
      if (!vivo) return;
      const lista = lembretesDe(
        (data ?? []).map((d) => ({ id: String(d.id), nome: String(d.nome), validade: String(d.validade) })),
      );
      setLembretes(lista);
      // Limpa na leitura: adiamento de documento já renovado não tem mais dono.
      const guardados = semOsObsoletos(lerAdiamentos(user.id), lista);
      setAdiamentos(guardados);
      gravarAdiamentos(user.id, guardados);
    })();
    return () => { vivo = false; };
  }, [user]);

  const fechar = useCallback((l: Lembrete) => {
    if (!user) return;
    setAdiamentos((atual) => {
      const novo = adiar(atual, l);
      gravarAdiamentos(user.id, novo);
      return novo;
    });
  }, [user]);

  const pendentes = lembretes.filter((l) => !estaAdiado(adiamentos, l.chave));
  if (!pendentes.length) return null;

  const mostrados = tudo ? pendentes : pendentes.slice(0, VISIVEIS);
  const ocultos = pendentes.length - mostrados.length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-5 top-[76px] z-40 flex w-[min(316px,calc(100vw-2.5rem))] flex-col gap-2.5"
    >
      {mostrados.map((l) => {
        const { caixa, texto, Icone } = ESTILO[l.gravidade];
        return (
          <div
            key={l.chave}
            className={cn(
              'animate-fade-in rounded-xl border border-border border-l-[3px] bg-card px-3.5 py-3 shadow-md',
              caixa,
            )}
          >
            <div className="flex items-start gap-2.5">
              <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', texto)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{l.nome}</p>
                <p className={cn('text-xs font-medium', texto)}>
                  {prazoPorExtenso(l.dias)}
                  {' · '}
                  {new Date(`${l.validade.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}
                </p>
                {l.gravidade === 'vencido' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Documento vencido impede a habilitação.
                  </p>
                )}
                <button
                  onClick={() => navigate('/documentos')}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  Atualizar documento <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={() => fechar(l)}
                // Dizer que só adia evita a promessa que o × costuma fazer.
                title="Lembrar mais tarde"
                aria-label={`Adiar o lembrete de ${l.nome}`}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {ocultos > 0 && (
        <button
          onClick={() => setTudo(true)}
          className="rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg hover:text-foreground"
        >
          e mais {ocultos} documento{ocultos > 1 ? 's' : ''} a vencer
        </button>
      )}
    </div>
  );
}
