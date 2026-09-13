import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, Copy, Check, Trash2, Loader2, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

// Endereço do sistema em produção. Apontava para app.praefectus.com.br —
// implantação antiga que não conhece a função convite_por_token e devolvia
// "convite inválido" a quem clicasse.
const SITE_URL = 'https://praefectus.com.br';

const equipeLabels: Record<string, string> = {
  geral: 'Geral',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  logistica: 'Logística',
  juridico: 'Jurídico',
  contabil: 'Contábil',
  licitacoes: 'Licitações',
  documentos: 'Documentos',
};

type Convite = {
  id: string;
  token: string;
  equipe: string;
  papel: string;
  email_setor: string;
  expires_at: string;
  usos: number | null;
  max_usos: number | null;
};

/**
 * Convites de setor ativos.
 *
 * Antes não existia: o admin criava o convite, o e-mail saía, e não havia como
 * recuperar o link nem cancelar. Como a criação bloqueia enquanto houver um
 * convite válido para o setor, perder o e-mail deixava o admin preso até o
 * convite expirar — cinco minutos.
 *
 * O link é o mesmo para todo o setor: quantos colaboradores quiserem criam o
 * próprio acesso com ele, cada um escolhendo o seu login.
 */
export default function ConvitesPendentes() {
  const { empresaAtiva } = useEmpresa();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Com 5 minutos de validade, um rótulo estático mentiria em segundos: o
  // relógio avança de 10 em 10s para o restante ser sempre verdadeiro na tela.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aCancelar, setACancelar] = useState<Convite | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresaAtiva) return;
    setCarregando(true);
    const { data } = await supabase
      .from('empresa_convites')
      .select('id, token, equipe, papel, email_setor, expires_at, usos, max_usos')
      .eq('empresa_id', empresaAtiva.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setConvites((data ?? []) as unknown as Convite[]);
    setCarregando(false);
  }, [empresaAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const linkDe = (c: Convite) => `${SITE_URL}/aceitar-convite?token=${c.token}`;

  const copiar = async (c: Convite) => {
    try {
      await navigator.clipboard.writeText(linkDe(c));
      setCopiado(c.id);
      toast.success('Link copiado. Vale para todos os colaboradores do setor.');
      setTimeout(() => setCopiado((atual) => (atual === c.id ? null : atual)), 2500);
    } catch {
      toast.error('Não foi possível copiar. Selecione o link manualmente.');
    }
  };

  const cancelar = async () => {
    if (!aCancelar) return;
    setCancelando(true);
    const { error } = await supabase.from('empresa_convites').delete().eq('id', aCancelar.id);
    setCancelando(false);
    setACancelar(null);
    if (error) { toast.error(`Erro ao cancelar: ${error.message}`); return; }
    toast.success('Convite cancelado. O link deixa de funcionar.');
    carregar();
  };

  /** O link do setor vale 5 minutos: contar em dias mostrava "1 dia" para um
   *  convite que morreria em segundos. Aqui o restante é dito na unidade certa. */
  const tempoRestante = (iso: string) => {
    const ms = new Date(iso).getTime() - agora;
    if (ms <= 0) return { texto: 'expirado', urgente: true, vivo: false };
    const min = Math.floor(ms / 60_000);
    if (min >= 1440) {
      const d = Math.ceil(min / 1440);
      return { texto: `${d} ${d === 1 ? 'dia' : 'dias'}`, urgente: false, vivo: true };
    }
    if (min >= 60) {
      const h = Math.floor(min / 60);
      return { texto: `${h}h${String(min % 60).padStart(2, '0')}`, urgente: false, vivo: true };
    }
    if (min >= 1) return { texto: `${min} min`, urgente: min <= 2, vivo: true };
    return { texto: `${Math.ceil(ms / 1000)}s`, urgente: true, vivo: true };
  };

  if (carregando) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-base text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />Carregando convites…
        </CardContent>
      </Card>
    );
  }

  if (convites.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="border-b px-5 py-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
            Convites de setor ativos
            <Badge variant="muted">{convites.length}</Badge>
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              O mesmo link serve para todo o setor
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="divide-y p-0">
          {convites.map((c) => {
            const restante = tempoRestante(c.expires_at);
            const usos = c.usos ?? 0;
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">
                      {equipeLabels[c.equipe] ?? c.equipe}
                    </span>
                    <Badge variant="muted">{c.papel}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.email_setor}</p>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1" title="Acessos criados com este link">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {usos} {usos === 1 ? 'acesso' : 'acessos'}
                    {c.max_usos !== null && ` de ${c.max_usos}`}
                  </span>
                  {restante.urgente ? (
                    <Badge variant="warning" className="gap-1" title={`Expira em ${new Date(c.expires_at).toLocaleString('pt-BR')}`}>
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {restante.vivo ? restante.texto : 'expirado'}
                    </Badge>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1"
                      title={`Expira em ${new Date(c.expires_at).toLocaleString('pt-BR')}`}
                    >
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {restante.texto}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => copiar(c)}>
                    {copiado === c.id
                      ? <><Check aria-hidden="true" />Copiado</>
                      : <><Copy aria-hidden="true" />Copiar link</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => setACancelar(c)}
                    title="Cancelar convite"
                    aria-label="Cancelar convite"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog open={!!aCancelar} onOpenChange={(o) => !o && setACancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar o convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link do setor <strong>{aCancelar && (equipeLabels[aCancelar.equipe] ?? aCancelar.equipe)}</strong>{' '}
              deixa de funcionar imediatamente. Quem já criou acesso continua com ele —
              {' '}{aCancelar?.usos ?? 0} até agora. Para convidar de novo, será preciso gerar
              um convite novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={cancelar}
              disabled={cancelando}
            >
              {cancelando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              Cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
