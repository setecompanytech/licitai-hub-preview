import { Card } from '@/components/ui/card';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { resumoDasNotas } from '@/lib/juridico/notas-de-origem';
import type { Dossie } from '@/lib/juridico/dossie-do-contrato';
import { prazoDaPeca } from '@/lib/juridico/prazos-da-peca';
import { CalendarClock, ListChecks, ShieldAlert, BookMarked, Send } from 'lucide-react';

/**
 * A terceira zona da redação (27/09/2026): prazo da peça, o que o caso já tem
 * e o que falta, riscos apontados pelos dados, notas de origem e a saída
 * (revisão e protocolo). Tudo derivado — nada aqui se digita.
 */
export type PropsDiligencias = {
  categoria: string;
  titulo: string;
  dossie: Dossie | null;
  contratoEscolhido: boolean;
  fatos: number;
  resultado: string;
  revisaoOk: boolean;
  pedido: { numero_formatado: string; status: string } | null;
};

export default function DiligenciasDaPeca(p: PropsDiligencias) {
  const prazo = prazoDaPeca(p.categoria, p.titulo);
  const notas = resumoDasNotas(p.resultado);
  const riscos: string[] = [];
  if (p.dossie?.reajuste?.devido) riscos.push(`Reajuste devido há ${p.dossie.reajuste.meses} mês(es) (aniversário em ${p.dossie.reajuste.aniversario.slice(8, 10)}/${p.dossie.reajuste.aniversario.slice(5, 7)}/${p.dossie.reajuste.aniversario.slice(0, 4)}). Requerer antes de assinar prorrogação: aceitá-la sem ressalva pode ser lida como renúncia.`);
  if (p.categoria === 'Judicial') riscos.push('Minuta para advogado inscrito na OAB: a petição só vai a juízo assinada por ele (Lei 8.906/1994, art. 1º, I).');
  if (!p.contratoEscolhido && (p.categoria === 'Reequilíbrio' || p.categoria === 'Contratos')) riscos.push('Sem contrato do sistema escolhido, a IA só sabe o que for digitado ou anexado: valores e datas ficam sem conferência.');
  if (p.resultado && notas.normasAConfirmar.length > 0) riscos.push(`${notas.normasAConfirmar.length} citação(ões) fora da lista conferida — confira no texto oficial antes de protocolar.`);

  const item = (ok: boolean, texto: string) => (
    <li className="flex items-start gap-2 text-sm">
      <SeloSituacao tom={ok ? 'sucesso' : 'neutro'} className="shrink-0">{ok ? 'ok' : 'falta'}</SeloSituacao>
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{texto}</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-3" data-testid="diligencias-da-peca">
      <Card className="space-y-1.5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Prazo da peça</p>
        <p className="text-sm text-foreground">{prazo.prazo}</p>
        {prazo.fundamento && <p className="g-meta text-muted-foreground">{prazo.fundamento} · confira no edital ou na intimação</p>}
      </Card>
      <Card className="space-y-2 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> O caso</p>
        <ul className="space-y-1.5">
          {item(p.contratoEscolhido, p.contratoEscolhido ? 'Contrato do sistema lido (dossiê montado)' : 'Contrato ou ata do sistema')}
          {item(p.fatos > 0, p.fatos > 0 ? `${p.fatos} fato(s) extraído(s) dos documentos` : 'Documentos anexados e fatos extraídos')}
          {item(!!p.resultado, p.resultado ? 'Peça redigida' : 'Peça ainda não redigida')}
        </ul>
      </Card>
      {riscos.length > 0 && (
        <Card className="space-y-2 border-warning-line bg-warning-tint p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning-ink"><ShieldAlert className="h-4 w-4" aria-hidden="true" /> Riscos e pontos de atenção</p>
          <ul className="space-y-1.5">
            {riscos.map((r) => <li key={r} className="text-sm text-warning-ink">{r}</li>)}
          </ul>
        </Card>
      )}
      {p.resultado && (
        <Card className="space-y-1.5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><BookMarked className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Notas de origem</p>
          <p className="text-sm text-foreground">{notas.normasConferidas} norma(s) conferida(s) · {notas.normasAConfirmar.length} a confirmar</p>
          <p className="g-meta text-muted-foreground">{notas.fontesDoSistema} do sistema · {notas.anexos} de anexos · {notas.base} da base jurídica</p>
          {notas.normasAConfirmar.length > 0 && (
            <ul className="space-y-0.5">{notas.normasAConfirmar.map((n) => <li key={n} className="g-meta text-warning-ink">{n}</li>)}</ul>
          )}
        </Card>
      )}
      <Card className="space-y-2 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Send className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Saída</p>
        <ul className="space-y-1.5">
          {item(p.revisaoOk, p.revisaoOk ? 'Revisão registrada' : 'Revisado por + declaração de leitura (exigidos para exportar)')}
          {item(!!p.pedido, p.pedido ? `Pedido ${p.pedido.numero_formatado} · ${p.pedido.status}` : 'Numeração e protocolo (nascem ao gerar)')}
        </ul>
      </Card>
    </div>
  );
}
