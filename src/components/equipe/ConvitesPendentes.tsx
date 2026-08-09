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

const SITE_URL = 'https://app.praefectus.com.br';

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
 * convite expirar — sete dias.
 *
 * O link é o mesmo para todo o setor: quantos colaboradores quiserem criam o
 * próprio acesso com ele, cada um escolhendo o seu login.
 */
export default function ConvitesPendentes() {
  const { empresaAtiva } = useEmpresa();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
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

  const diasRestantes = (iso: string) =>
    Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

  if (carregando) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 inline animate-spin mr-2" />Carregando convites…
        </CardContent>
      </Card>
    );
  }

  if (convites.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Convites de setor ativos
            <Badge variant="outline" className="text-xs">{convites.length}</Badge>
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              O mesmo link serve para todo o setor
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 divide-y">
          {convites.map((c) => {
            const dias = diasRestantes(c.expires_at);
            const usos = c.usos ?? 0;
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {equipeLabels[c.equipe] ?? c.equipe}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{c.papel}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.email_setor}</p>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span className="inline-flex items-center gap-1" title="Acessos criados com este link">
                    <Users className="w-3.5 h-3.5" />
                    {usos} {usos === 1 ? 'acesso' : 'acessos'}
                    {c.max_usos !== null && ` de ${c.max_usos}`}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 ${dias <= 2 ? 'text-warning' : ''}`}
                    title={`Expira em ${new Date(c.expires_at).toLocaleDateString('pt-BR')}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {dias === 0 ? 'expira hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => copiar(c)}>
                    {copiado === c.id
                      ? <><Check className="w-3.5 h-3.5 mr-1.5" />Copiado</>
                      : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copiar link</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive/70 hover:text-destructive"
                    onClick={() => setACancelar(c)}
                    title="Cancelar convite"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
              {cancelando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
