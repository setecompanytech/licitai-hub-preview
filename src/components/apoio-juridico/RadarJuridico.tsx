import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { useRadarJuridico } from '@/hooks/useRadarJuridico';
import { rotaDoEvento, type EventoDoRadar } from '@/lib/juridico/radar';
import { Radar, ArrowRight, FileText, ShieldCheck } from 'lucide-react';

/**
 * Radar Jurídico — a primeira aba do Apoio Jurídico (decisão do dono, 27/09).
 *
 * A leitura e a régua vivem em `useRadarJuridico`; aqui só a lista. Cada
 * evento abre o modelo certo com o caso já montado (`?contrato=`), para
 * ninguém digitar o que o sistema sabe; sem peça a redigir, abre a rota.
 */
const ROTULO: Record<EventoDoRadar['gravidade'], string> = { critico: 'Crítico', atencao: 'Atenção', info: 'Informação' };

export default function RadarJuridico() {
  const navigate = useNavigate();
  const { data: eventos, isLoading, error } = useRadarJuridico();

  if (isLoading) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>;
  }
  if (error) {
    return <Card className="p-5 text-sm text-destructive-ink">Não foi possível ler os contratos e processos: {error instanceof Error ? error.message : String(error)}</Card>;
  }
  if (!eventos || eventos.length === 0) {
    return (
      <Card>
        <EstadoVazio
          icone={<ShieldCheck />}
          titulo="Nada pendente no jurídico"
          descricao="Nenhum contrato com reajuste devido, vigência vencendo, saldo esgotado ou extrato por registrar; nenhuma certidão vencendo, convenção nova ou edital alterado; nenhum processo com prazo de recurso aberto. O Radar reavalia a cada abertura."
        />
      </Card>
    );
  }
  const criticos = eventos.filter((e) => e.gravidade === 'critico').length;

  return (
    <div className="space-y-3" data-testid="radar-juridico">
      <p className="g-corpo flex items-center gap-2 text-muted-foreground">
        <Radar className="h-4 w-4" aria-hidden="true" />
        {eventos.length} providência(s) apontada(s) pelos dados do sistema{criticos > 0 ? `, ${criticos} crítica(s)` : ''}. Cada uma abre a peça com o caso já montado.
      </p>
      <ul className="flex flex-col gap-3">
        {eventos.map((e) => (
          <li key={e.chave}>
            <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <SeloSituacao tom={e.gravidade}>{ROTULO[e.gravidade]}</SeloSituacao>
                  <span className="g-meta text-muted-foreground">{e.caso}</span>
                </div>
                <p className="text-base font-semibold leading-6 text-foreground">{e.titulo}</p>
                <p className="text-sm text-muted-foreground">{e.detalhe}</p>
                <p className="g-meta text-muted-foreground">Fundamento: {e.fundamento}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant={e.gravidade === 'critico' ? 'default' : 'outline'} onClick={() => { const rota = rotaDoEvento(e); if (rota) navigate(rota); }}>
                  {e.modeloId ? <FileText aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                  {e.rotuloDaAcao}
                </Button>
                {e.modeloId && e.rota && (
                  <Button size="sm" variant="ghost" onClick={() => navigate(e.rota!)}>
                    <ArrowRight aria-hidden="true" /> Ver o caso
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
