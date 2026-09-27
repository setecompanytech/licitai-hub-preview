import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { hojeLocal } from '@/lib/financeiro/data-local';
import { eventosDoRadar, type ContratoDoRadar, type EventoDoRadar, type LicitacaoDoRadar } from '@/lib/juridico/radar';
import { Radar, ArrowRight, FileText, ShieldCheck } from 'lucide-react';

/**
 * Radar Jurídico — a primeira aba do Apoio Jurídico (decisão do dono, 27/09).
 *
 * Lê os contratos, termos, publicações e processos da empresa ativa e deixa a
 * régua pura (`lib/juridico/radar.ts`) dizer o que precisa de peça. Cada
 * evento abre o modelo certo com o caso já montado (`?contrato=`), para
 * ninguém digitar o que o sistema sabe.
 */
const TOM: Record<EventoDoRadar['gravidade'], 'critico' | 'atencao' | 'info'> = { critico: 'critico', atencao: 'atencao', info: 'info' };
const ROTULO: Record<EventoDoRadar['gravidade'], string> = { critico: 'Crítico', atencao: 'Atenção', info: 'Informação' };

export default function RadarJuridico() {
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contratos, setContratos] = useState<ContratoDoRadar[]>([]);
  const [licitacoes, setLicitacoes] = useState<LicitacaoDoRadar[]>([]);

  useEffect(() => {
    let vivo = true;
    const empresaId = empresaAtiva?.id;
    if (!empresaId) { setCarregando(false); return; }
    setCarregando(true);
    setErro(null);
    (async () => {
      const [c, a, p, l] = await Promise.all([
        supabase.from('contratos')
          // As colunas de reajuste vieram por migration colada à mão e não
          // estão no types.ts gerado: o select entra como `never`.
          .select('id, numero_contrato, orgao_contratante, tipo_documento, status, data_assinatura, data_fim, indice_reajuste, data_base_reajuste, saldo_remanescente, valor_global, fiscal_nome' as never)
          .eq('empresa_id', empresaId).is('excluido_em', null),
        supabase.from('contrato_aditivos').select('contrato_id, tipo, data_assinatura, data_base_reajuste' as never),
        supabase.from('contrato_publicacoes' as never).select('contrato_id, tipo'),
        supabase.from('licitacoes').select('id, numero, orgao, status, resultado, updated_at').eq('empresa_id', empresaId).is('arquivado_em', null),
      ]);
      if (!vivo) return;
      const falha = c.error ?? a.error ?? l.error;
      if (falha) { setErro(falha.message); setCarregando(false); return; }
      type Ad = { contrato_id: string; tipo: string | null; data_assinatura: string | null; data_base_reajuste: string | null };
      type Pub = { contrato_id: string; tipo: string | null };
      const aditivos = ((a.data ?? []) as unknown as Ad[]);
      // A tabela de publicações veio por migration colada à mão: ausente, o
      // radar segue sem a régua de extratos em vez de cair inteiro.
      const publicacoes = (p.error ? [] : ((p.data ?? []) as unknown as Pub[]));
      setContratos(((c.data ?? []) as unknown as Array<Omit<ContratoDoRadar, 'aditivos' | 'publicacoes'>>).map((ct) => ({
        ...ct,
        saldo_remanescente: ct.saldo_remanescente === null ? null : Number(ct.saldo_remanescente),
        valor_global: ct.valor_global === null ? null : Number(ct.valor_global),
        aditivos: aditivos.filter((x) => x.contrato_id === ct.id),
        publicacoes: publicacoes.filter((x) => x.contrato_id === ct.id),
      })));
      setLicitacoes((l.data ?? []) as LicitacaoDoRadar[]);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [empresaAtiva?.id]);

  const eventos = useMemo(() => eventosDoRadar({ contratos, licitacoes, hoje: hojeLocal() }), [contratos, licitacoes]);
  const criticos = eventos.filter((e) => e.gravidade === 'critico').length;

  const abrir = (e: EventoDoRadar) => {
    if (e.modeloId) {
      const q = e.contratoId ? `?contrato=${e.contratoId}` : e.licitacaoId ? `?licitacao=${e.licitacaoId}` : '';
      navigate(`/apoio-juridico/redigir/${e.modeloId}${q}`);
    } else if (e.rota) {
      navigate(e.rota);
    }
  };

  if (carregando) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>;
  }
  if (erro) {
    return <Card className="p-5 text-sm text-destructive-ink">Não foi possível ler os contratos e processos: {erro}</Card>;
  }
  if (eventos.length === 0) {
    return (
      <Card>
        <EstadoVazio
          icone={<ShieldCheck />}
          titulo="Nada pendente no jurídico"
          descricao="Nenhum contrato com reajuste devido, vigência vencendo, saldo esgotado ou extrato por registrar, e nenhum processo com prazo de recurso aberto. O Radar reavalia a cada abertura."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="radar-juridico">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="g-corpo flex items-center gap-2 text-muted-foreground">
          <Radar className="h-4 w-4" aria-hidden="true" />
          {eventos.length} providência(s) apontada(s) pelos dados do sistema{criticos > 0 ? `, ${criticos} crítica(s)` : ''}. Cada uma abre a peça com o caso já montado.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {eventos.map((e) => (
          <li key={e.chave}>
            <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <SeloSituacao tom={TOM[e.gravidade]}>{ROTULO[e.gravidade]}</SeloSituacao>
                  <span className="g-meta text-muted-foreground">{e.caso}</span>
                </div>
                <p className="text-base font-semibold leading-6 text-foreground">{e.titulo}</p>
                <p className="text-sm text-muted-foreground">{e.detalhe}</p>
                <p className="g-meta text-muted-foreground">Fundamento: {e.fundamento}</p>
              </div>
              <div className="shrink-0">
                <Button size="sm" variant={e.gravidade === 'critico' ? 'default' : 'outline'} onClick={() => abrir(e)}>
                  {e.modeloId ? <FileText aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                  {e.rotuloDaAcao}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
