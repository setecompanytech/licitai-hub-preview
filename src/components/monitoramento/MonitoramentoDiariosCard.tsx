import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Radar } from 'lucide-react';

type AlertaRow = {
  id: string; tipo: string; titulo: string; orgao: string | null;
  fonte: string; url_publicacao: string | null; created_at: string; urgente: boolean;
};

const TIPO_LABEL: Record<string, string> = {
  aviso_licitacao: 'Aviso de licitação',
  extrato_contrato: 'Extrato de contrato',
  ata_registro: 'Ata de registro',
  aditivo: 'Termo aditivo',
  suspensao: 'Suspensão',
  cancelamento: 'Cancelamento',
  homologacao: 'Homologação',
  alteracao: 'Alteração',
};

const fmtCnpj = (d: string) =>
  d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;

/**
 * O radar da empresa nos Diários Oficiais — a vigília automática, distinta
 * da busca manual logo abaixo.
 *
 * Os termos NÃO se digitam: saem do cadastro (CNPJ formatado como as
 * publicações imprimem, razão social e fantasia de cada empresa do usuário).
 * A varredura roda a cada 4 horas contra o DOU (in.gov.br), o DOE-PA
 * (IOEPA — o PDF diário inteiro é extraído e pesquisado) e os diários
 * municipais (Querido Diário), classifica aviso/extrato/ata/aditivo e
 * entrega em alertas — o mesmo feed do módulo de Editais.
 */
export default function MonitoramentoDiariosCard() {
  const { user } = useAuth();
  const [ativo, setAtivo] = useState(false);
  const [temPref, setTemPref] = useState(false);
  const [termos, setTermos] = useState<string[]>([]);
  const [alertas, setAlertas] = useState<AlertaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    if (!user) return;
    setCarregando(true);
    const [prefRes, empRes, alertasRes] = await Promise.all([
      (supabase.from('preferencias_alertas' as never) as any)
        .select('ativo').eq('user_id', user.id).maybeSingle(),
      supabase.from('empresas').select('cnpj, razao_social, nome_fantasia'),
      (supabase.from('alertas_gerados' as never) as any)
        .select('id, tipo, titulo, orgao, fonte, url_publicacao, created_at, urgente')
        .eq('user_id', user.id)
        .in('fonte', ['DOU', 'DOE', 'DOE-PA'])
        .order('created_at', { ascending: false })
        .limit(6),
    ]);
    setTemPref(!!prefRes.data);
    setAtivo(!!(prefRes.data as { ativo?: boolean } | null)?.ativo);
    const ts: string[] = [];
    for (const e of (empRes.data as Array<{ cnpj: string | null; razao_social: string | null; nome_fantasia: string | null }> | null) || []) {
      const d = (e.cnpj || '').replace(/\D/g, '');
      if (d.length === 14) ts.push(fmtCnpj(d));
      if (e.razao_social) ts.push(e.razao_social);
      if (e.nome_fantasia && e.nome_fantasia !== e.razao_social) ts.push(e.nome_fantasia);
    }
    setTermos([...new Set(ts)]);
    setAlertas((alertasRes.data as AlertaRow[]) || []);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const alternar = async (novo: boolean) => {
    if (!user) return;
    setSalvando(true);
    let error;
    if (temPref) {
      ({ error } = await (supabase.from('preferencias_alertas' as never) as any)
        .update({ ativo: novo }).eq('user_id', user.id));
    } else {
      ({ error } = await (supabase.from('preferencias_alertas' as never) as any)
        .insert({ user_id: user.id, ativo: novo }));
    }
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    setAtivo(novo);
    setTemPref(true);
    toast.success(novo
      ? 'Radar ligado — varredura a cada 4h no DOU, no DOE-PA (IOEPA) e nos diários municipais.'
      : 'Radar dos diários desligado.');
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2">
          <Radar className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">Monitoramento automático — publicações sobre a empresa</h3>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Varredura a cada 4 horas, todos os dias, no <b>DOU</b> (in.gov.br), no <b>DOE-PA</b>{' '}
              (IOEPA — a edição diária inteira é lida) e nos <b>diários municipais</b> (Querido
              Diário), atrás de avisos de licitação, extratos de contrato, atas e aditivos que
              citem a empresa. Os termos saem do cadastro — nada a digitar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {salvando && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <Switch id="radar-diarios" checked={ativo} disabled={carregando || salvando} onCheckedChange={alternar} />
          <Label htmlFor="radar-diarios" className="text-sm">{ativo ? 'Ligado' : 'Desligado'}</Label>
        </div>
      </div>

      {!carregando && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Termos vigiados:</span>
            {termos.length === 0 ? (
              <span className="text-xs text-warning">nenhuma empresa com CNPJ cadastrado</span>
            ) : termos.map(t => (
              <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
            ))}
          </div>

          {ativo && alertas.length > 0 && (
            <div className="rounded-md border border-border/50 divide-y divide-border/50">
              {alertas.map(a => (
                <div key={a.id} className="flex items-baseline gap-2 px-3 py-2 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {new Date(a.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <Badge variant="outline" className={`text-xs font-normal shrink-0 ${a.urgente ? 'bg-destructive/10 text-destructive border-destructive/30' : ''}`}>
                    {TIPO_LABEL[a.tipo] ?? a.tipo}
                  </Badge>
                  <span className="truncate flex-1" title={a.titulo}>
                    {a.url_publicacao
                      ? <a href={a.url_publicacao} target="_blank" rel="noopener noreferrer" className="hover:underline">{a.titulo}</a>
                      : a.titulo}
                  </span>
                  <Badge variant="secondary" className="text-xs shrink-0">{a.fonte}</Badge>
                </div>
              ))}
            </div>
          )}
          {ativo && alertas.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma publicação encontrada ainda — o radar avisa aqui e no feed de alertas quando a
              empresa aparecer num diário.
            </p>
          )}
        </>
      )}
    </div>
  );
}
