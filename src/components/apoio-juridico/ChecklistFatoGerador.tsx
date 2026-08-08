import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Scale, BookOpen, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TipoFato = 'caso_fortuito' | 'forca_maior' | 'fato_principe' | 'fato_superveniente';

interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  obrigatorio: boolean;
}

interface MatrizValidacao {
  origem: string;
  previsibilidade: string;
  irresistibilidade: string;
  dispositivo: string;
  enquadramento14133: string;
  exemplos: string[];
  itens: ChecklistItem[];
}

const MATRIZ: Record<TipoFato, MatrizValidacao> = {
  caso_fortuito: {
    origem: 'Humana / interna ao processo (atos de terceiros, falhas operacionais, greves)',
    previsibilidade: 'Imprevisível ao tempo da contratação',
    irresistibilidade: 'Inevitável apesar das diligências ordinárias',
    dispositivo: 'CC art. 393, parágrafo único',
    enquadramento14133: 'Art. 124, II, "d" c/c art. 134 da Lei 14.133/2021',
    exemplos: ['Greve geral de transportes', 'Ato terrorista isolado', 'Falha catastrófica de equipamento sem culpa'],
    itens: [
      { id: 'cf1', label: 'O evento tem origem humana ou interna (não é fenômeno da natureza)', hint: 'Greves, atos de terceiros, falhas operacionais sem culpa do contratado', obrigatorio: true },
      { id: 'cf2', label: 'Era imprevisível na data da assinatura do contrato', hint: 'Não constava de cenários ordinários de risco do edital/proposta', obrigatorio: true },
      { id: 'cf3', label: 'O contratado adotou diligências ordinárias e ainda assim não pôde evitar', hint: 'Comprovar dever de cuidado: planos de contingência, seguros usuais', obrigatorio: true },
      { id: 'cf4', label: 'Há nexo causal direto entre o fato e a onerosidade excessiva', hint: 'Documentar relação causa-efeito com notas, índices ou laudos', obrigatorio: true },
      { id: 'cf5', label: 'O contrato não atribui expressamente este risco ao contratado', hint: 'Verificar matriz de risco (art. 22 e 103 da Lei 14.133/2021)', obrigatorio: true },
    ],
  },
  forca_maior: {
    origem: 'Natural / externa (fenômenos da natureza, pandemias, desastres)',
    previsibilidade: 'Imprevisível ou, se previsível, de consequências inevitáveis',
    irresistibilidade: 'Absolutamente irresistível pela diligência humana',
    dispositivo: 'CC art. 393, parágrafo único',
    enquadramento14133: 'Art. 124, II, "d" c/c art. 137, §2º, II da Lei 14.133/2021',
    exemplos: ['Enchentes e desastres naturais', 'Pandemia (COVID-19)', 'Terremotos e furacões'],
    itens: [
      { id: 'fm1', label: 'O evento tem origem natural ou externa ao controle humano', hint: 'Fenômenos da natureza, pandemias declaradas oficialmente', obrigatorio: true },
      { id: 'fm2', label: 'É absolutamente irresistível (não se evita com diligência ordinária)', hint: 'Nenhuma medida razoável evitaria os efeitos sobre o contrato', obrigatorio: true },
      { id: 'fm3', label: 'Há comprovação oficial do evento (decreto, boletim, INMET, ANS, OMS)', hint: 'Documentos públicos que materializam o fato', obrigatorio: true },
      { id: 'fm4', label: 'O impacto econômico é mensurável por índices ou laudos', hint: 'Variação de preços, custos extras, perda de produtividade', obrigatorio: true },
      { id: 'fm5', label: 'O contrato não transferiu este risco ao contratado (matriz de risco)', hint: 'Art. 22 e 103 da Lei 14.133/2021', obrigatorio: true },
    ],
  },
  fato_principe: {
    origem: 'Ato geral e extracontratual do Poder Público',
    previsibilidade: 'Imprevisível em sua edição, vigência ou efeitos',
    irresistibilidade: 'Repercussão indireta e inevitável sobre a economia do contrato',
    dispositivo: 'Lei 14.133/2021, art. 124, II, "d"; doutrina de Hely Lopes Meirelles',
    enquadramento14133: 'Art. 124, II, "d" — distinto de "Fato da Administração" (ato específico do contratante)',
    exemplos: ['Nova carga tributária geral', 'Embargo comercial decretado', 'Mudança regulatória setorial obrigatória'],
    itens: [
      { id: 'fp1', label: 'O ato é GERAL (atinge a coletividade), não dirigido ao contrato', hint: 'Se for ato específico do ente contratante = Fato da Administração', obrigatorio: true },
      { id: 'fp2', label: 'Foi editado por autoridade pública competente', hint: 'Lei, decreto, portaria, resolução de agência reguladora', obrigatorio: true },
      { id: 'fp3', label: 'Repercute indiretamente, agravando a equação econômico-financeira', hint: 'Ex.: nova alíquota tributária impacta custos do insumo', obrigatorio: true },
      { id: 'fp4', label: 'Era imprevisível na data da apresentação da proposta', hint: 'Não havia projeto de lei em estágio avançado ou consulta pública concluída', obrigatorio: true },
      { id: 'fp5', label: 'O impacto está documentado e quantificado', hint: 'Comparativo antes/depois, planilhas de composição de custos', obrigatorio: true },
    ],
  },
  fato_superveniente: {
    origem: 'Álea econômica extraordinária e extracontratual',
    previsibilidade: 'Imprevisível ou previsível de consequências incalculáveis',
    irresistibilidade: 'Onerosidade excessiva que rompe a equação econômica original',
    dispositivo: 'CC arts. 317 e 478 (Teoria da Imprevisão)',
    enquadramento14133: 'Art. 124, II, "d" da Lei 14.133/2021 — recomposição/revisão',
    exemplos: ['Hiperinflação setorial súbita', 'Disparada cambial atípica', 'Crise de fornecimento global'],
    itens: [
      { id: 'fs1', label: 'O fato é superveniente (posterior à apresentação da proposta)', hint: 'Não pode ser anterior nem contemporâneo à contratação', obrigatorio: true },
      { id: 'fs2', label: 'É imprevisível OU previsível de consequências incalculáveis', hint: 'Teoria da Imprevisão — basta um dos requisitos', obrigatorio: true },
      { id: 'fs3', label: 'Está fora da álea ordinária do contrato (extracontratual)', hint: 'Não é flutuação normal de mercado prevista nos riscos', obrigatorio: true },
      { id: 'fs4', label: 'Causa onerosidade excessiva, rompendo o equilíbrio inicial', hint: 'Quantificar a variação real vs projetada (índices oficiais)', obrigatorio: true },
      { id: 'fs5', label: 'Não decorre de culpa, mora ou risco assumido pelo contratado', hint: 'Verificar matriz de risco e cláusulas de alocação', obrigatorio: true },
    ],
  },
};

interface Props {
  tipoFato: TipoFato;
  onConfirm: () => void;
  onCancel?: () => void;
  className?: string;
}

export function ChecklistFatoGerador({ tipoFato, onConfirm, onCancel, className }: Props) {
  const matriz = MATRIZ[tipoFato];
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked(p => ({ ...p, [id]: !p[id] }));

  const { totalObrig, marcadosObrig, score, podeAceitar } = useMemo(() => {
    const obrig = matriz.itens.filter(i => i.obrigatorio);
    const marcadosObrig = obrig.filter(i => checked[i.id]).length;
    const totalMarcados = matriz.itens.filter(i => checked[i.id]).length;
    return {
      totalObrig: obrig.length,
      marcadosObrig,
      score: Math.round((totalMarcados / matriz.itens.length) * 100),
      podeAceitar: marcadosObrig === obrig.length,
    };
  }, [checked, matriz]);

  return (
    <Card className={cn('p-4 space-y-4 border-border/60 bg-muted/30', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <h4 className="text-sm font-semibold">Checklist de Validação Jurídica</h4>
            <p className="text-xs text-muted-foreground">Confirme cada requisito antes de aceitar a classificação do fato gerador.</p>
          </div>
        </div>
        <Badge variant={podeAceitar ? 'default' : 'secondary'} className="shrink-0">
          {marcadosObrig}/{totalObrig} obrigatórios
        </Badge>
      </div>

      {/* Matriz de enquadramento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-border/60 bg-background/50 p-2">
          <div className="text-muted-foreground font-semibold uppercase text-xs mb-0.5">Origem do evento</div>
          <div>{matriz.origem}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/50 p-2">
          <div className="text-muted-foreground font-semibold uppercase text-xs mb-0.5">Previsibilidade</div>
          <div>{matriz.previsibilidade}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/50 p-2">
          <div className="text-muted-foreground font-semibold uppercase text-xs mb-0.5 flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Dispositivo legal
          </div>
          <div>{matriz.dispositivo}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/50 p-2">
          <div className="text-muted-foreground font-semibold uppercase text-xs mb-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Lei 14.133/2021
          </div>
          <div>{matriz.enquadramento14133}</div>
        </div>
      </div>

      {/* Exemplos típicos */}
      <div className="text-xs">
        <span className="text-muted-foreground font-semibold uppercase text-xs">Exemplos típicos: </span>
        <span>{matriz.exemplos.join(' • ')}</span>
      </div>

      {/* Checklist itens */}
      <div className="space-y-2">
        {matriz.itens.map(item => (
          <label
            key={item.id}
            className={cn(
              'flex items-start gap-2 rounded-md border p-2 cursor-pointer transition-colors',
              checked[item.id] ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-background/50 hover:border-border'
            )}
          >
            <Checkbox checked={!!checked[item.id]} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium leading-snug">
                {item.label}
                {item.obrigatorio && <span className="text-destructive ml-1">*</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.hint}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Footer score + ações */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
        <div className="flex items-center gap-2 text-xs">
          {podeAceitar ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-success font-medium">Enquadramento jurídico validado ({score}%)</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-warning">Marque todos os requisitos obrigatórios para aceitar</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="w-3 h-3 mr-1" /> Cancelar
            </Button>
          )}
          <Button size="sm" disabled={!podeAceitar} onClick={onConfirm}>
            <CheckCircle2 className="w-3 h-3 mr-1" /> Aceitar classificação
          </Button>
        </div>
      </div>
    </Card>
  );
}
