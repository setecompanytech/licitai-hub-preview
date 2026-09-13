import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2, AlertTriangle, FileText, CalendarDays, Clock, Loader2, Inbox,
  Brain, ExternalLink, Mail, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A lista de boletins enviados — que agora ABRE ao clique.
 *
 * O defeito que motivou a reescrita: o clique alternava um painel que só
 * renderizava com `itens.length > 0`, e `itens: []` era fixo no código. A
 * linha era uma fachada. Além disso o tipo real da maioria dos envios
 * ('ia_diario', o Boletim IA das 06h) não existia no mapeamento — tudo
 * aparecia como "Boletim da Tarde".
 *
 * Agora as edges arquivam em `boletim_envios.conteudo` o instantâneo do que
 * o e-mail levou (resumo + até 20 editais), e é isso que o clique mostra.
 * Envio anterior ao arquivamento abre com o aviso honesto: o conteúdo
 * completo está no e-mail.
 */

type EditalDoBoletim = {
  orgao: string | null;
  objeto: string | null;
  municipio: string | null;
  uf: string | null;
  valor: number | null;
  url: string | null;
  data_abertura: string | null;
};

type EnvioRow = {
  id: string;
  tipo: string;
  status: string;
  erro: string | null;
  created_at: string;
  total_itens: number | null;
  conteudo: { resumo?: string; uf_sede?: string | null; editais?: EditalDoBoletim[] } | null;
};

const TIPO = {
  ia_diario: { titulo: 'Boletim IA — panorama do dia', label: 'Boletim IA', variante: 'info', ladrilho: 'bg-primary-tint text-primary', icon: Brain },
  manha: { titulo: 'Boletim da Manhã', label: 'Novas licitações', variante: 'success', ladrilho: 'bg-success-tint text-success-ink', icon: FileText },
  meiodia: { titulo: 'Boletim do Meio-dia', label: 'Alterações', variante: 'warning', ladrilho: 'bg-warning-tint text-warning-ink', icon: AlertTriangle },
  tarde: { titulo: 'Boletim da Tarde', label: 'Resultados', variante: 'muted', ladrilho: 'bg-muted text-foreground', icon: CheckCircle2 },
} as const;

const configDe = (tipo: string) => TIPO[tipo as keyof typeof TIPO] ?? TIPO.ia_diario;

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function BoletimList() {
  const { user } = useAuth();
  const [envios, setEnvios] = useState<EnvioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('boletim_envios')
      .select('id, tipo, status, erro, created_at, total_itens, conteudo')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setEnvios((data as unknown as EnvioRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (envios.length === 0) {
    return (
      <EstadoVazio
        icone={<Inbox />}
        titulo="Nenhum boletim enviado ainda"
        descricao="Configure suas preferências de boletim na aba Configuração para começar a receber."
      />
    );
  }

  return (
    <div className="space-y-3">
      {envios.map((envio) => {
        const cfg = configDe(envio.tipo);
        const Icon = cfg.icon;
        const isOpen = aberto === envio.id;
        const editais = envio.conteudo?.editais ?? [];
        const total = envio.total_itens ?? editais.length;
        return (
          <Card key={envio.id} className="p-6 transition-shadow hover:shadow-md">
            <button
              className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={isOpen}
              onClick={() => setAberto(isOpen ? null : envio.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${cfg.ladrilho}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-semibold text-foreground">{cfg.titulo}</span>
                      {envio.status === 'erro' && (
                        <Badge variant="danger">falhou</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <CalendarDays className="w-3 h-3" />
                      <span>{new Date(envio.created_at).toLocaleDateString('pt-BR')}</span>
                      <Clock className="w-3 h-3" />
                      <span>{new Date(envio.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {total > 0 && (
                        <span className="tabular-nums">· {total} edita{total === 1 ? 'l' : 'is'}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={cfg.variante}>{cfg.label}</Badge>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {envio.conteudo?.resumo && (
                  <p className="text-sm italic leading-relaxed text-muted-foreground">{envio.conteudo.resumo}</p>
                )}

                {editais.length > 0 ? (
                  <>
                    {editais.map((e, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 rounded-md bg-muted p-2 text-sm">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium text-foreground">{e.objeto || 'Objeto não informado'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {e.orgao}
                            {e.municipio ? ` · ${e.municipio}` : ''}{e.uf ? `/${e.uf}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {typeof e.valor === 'number' && e.valor > 0 && (
                            <p className="text-xs font-semibold tabular-nums">{moeda(e.valor)}</p>
                          )}
                          {e.url && (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Abrir edital <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {total > editais.length && (
                      <p className="text-xs text-muted-foreground">
                        Mostrando {editais.length} de {total} — a lista completa foi no e-mail.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {total > 0
                        ? `Este envio levou ${total} editais, mas é anterior ao arquivamento de conteúdo — o boletim completo está no seu e-mail.`
                        : envio.status === 'erro'
                          ? `O envio falhou${envio.erro ? `: ${envio.erro}` : ''}.`
                          : 'Este envio é anterior ao arquivamento de conteúdo — o boletim completo está no seu e-mail. Os próximos abrem aqui.'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
