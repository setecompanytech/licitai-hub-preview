import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ListaDeCampos from '@/components/gestao/ListaDeCampos';
import { supabase } from '@/integrations/supabase/client';
import BotaoReanalisar from '@/components/contratos/BotaoReanalisar';
import { toast } from 'sonner';
import { Truck, Pencil, Check, X, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { ROTULO_DO_MARCO, clausulaFalaDePrazo } from '@/lib/contratos/prazo-de-entrega';

type Entrega = {
  prazo_entrega_dias: number | null;
  prazo_entrega_unidade: string | null;
  prazo_entrega_clausula: string | null;
  local_entrega: string | null;
  local_entrega_clausula: string | null;
  prazo_recebimento_dias: number | null;
  prazo_recebimento_unidade: string | null;
  prazo_recebimento_clausula: string | null;
  prazo_pagamento_dias: number | null;
  prazo_pagamento_unidade: string | null;
  prazo_pagamento_marco: string | null;
  prazo_pagamento_clausula: string | null;
};

const VAZIO: Entrega = {
  prazo_entrega_dias: null, prazo_entrega_unidade: null, prazo_entrega_clausula: null,
  local_entrega: null, local_entrega_clausula: null,
  prazo_recebimento_dias: null, prazo_recebimento_unidade: null, prazo_recebimento_clausula: null,
  prazo_pagamento_dias: null, prazo_pagamento_unidade: null, prazo_pagamento_marco: null,
  prazo_pagamento_clausula: null,
};

const COLUNAS =
  'prazo_entrega_dias, prazo_entrega_unidade, prazo_entrega_clausula, local_entrega, ' +
  'local_entrega_clausula, prazo_recebimento_dias, prazo_recebimento_unidade, prazo_recebimento_clausula, ' +
  'prazo_pagamento_dias, prazo_pagamento_unidade, prazo_pagamento_marco, prazo_pagamento_clausula';

const emDias = (d: number | null, u: string | null) =>
  d ? `${d} dia${d > 1 ? 's' : ''} ${u === 'uteis' ? 'úteis' : 'corridos'}` : null;

/**
 * Os três prazos do cartão, com as colunas de cada um. É a lista que desenha
 * as linhas, confere a evidência e monta o "descartar" — uma fonte só, para
 * o ateste e o pagamento não ficarem com regra diferente da entrega.
 */
type Prazo = {
  chave: 'entrega' | 'recebimento' | 'pagamento';
  rotulo: string;
  dias: 'prazo_entrega_dias' | 'prazo_recebimento_dias' | 'prazo_pagamento_dias';
  unidade: 'prazo_entrega_unidade' | 'prazo_recebimento_unidade' | 'prazo_pagamento_unidade';
  clausula: 'prazo_entrega_clausula' | 'prazo_recebimento_clausula' | 'prazo_pagamento_clausula';
};
const PRAZOS: Prazo[] = [
  { chave: 'entrega', rotulo: 'prazo de entrega', dias: 'prazo_entrega_dias', unidade: 'prazo_entrega_unidade', clausula: 'prazo_entrega_clausula' },
  { chave: 'recebimento', rotulo: 'prazo de ateste', dias: 'prazo_recebimento_dias', unidade: 'prazo_recebimento_unidade', clausula: 'prazo_recebimento_clausula' },
  { chave: 'pagamento', rotulo: 'prazo de pagamento', dias: 'prazo_pagamento_dias', unidade: 'prazo_pagamento_unidade', clausula: 'prazo_pagamento_clausula' },
];

/**
 * Prazo com evidência que não fala em prazo.
 *
 * É o "481 dias corridos" de 18/09: a frase citada era uma linha de tabela de
 * itens (481,79 kg × R$ 38,00), lida como se fosse dias. A leitura nova já
 * recusa isso na entrada; o que JÁ está gravado precisa ser dito na tela, com
 * a saída ao lado. Prazo preenchido à mão não tem cláusula e não entra aqui.
 */
const prazoSuspeito = (d: Entrega, p: Prazo): boolean =>
  !!d[p.dias] && !!d[p.clausula] && !clausulaFalaDePrazo(d[p.clausula]);

/**
 * O que o contrato exige na entrega — e onde corrigir quando a IA erra.
 *
 * Estes três dados vinham no PDF, eram lidos, e não tinham onde aparecer: o
 * único lugar que os usava era o aviso da aba Pedidos. Quem quisesse conferir
 * o que a IA entendeu, ou preencher o que ela não achou, não tinha por onde.
 *
 * A cláusula literal fica visível junto do número. É o que transforma o dado
 * em algo conferível: quem lê "10 dias úteis" ao lado da frase de onde o 10
 * saiu decide em dois segundos se está certo.
 */
export default function ContratoEntrega({ contratoId }: { contratoId: string }) {
  const [dados, setDados] = useState<Entrega | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [descartando, setDescartando] = useState<Prazo['chave'] | null>(null);
  const [form, setForm] = useState<Entrega>(VAZIO);

  useEffect(() => {
    let vivo = true;
    supabase.from('contratos').select(COLUNAS).eq('id', contratoId).single().then(({ data, error }) => {
      if (!vivo) return;
      // As colunas vêm da migration 20260829000004, colada à mão. Enquanto ela
      // não rodar, o bloco se recolhe em vez de derrubar o Dashboard.
      if (error) { setIndisponivel(true); return; }
      setDados(data as unknown as Entrega);
    });
    return () => { vivo = false; };
  }, [contratoId]);

  if (indisponivel) return null;

  const abrir = () => { setForm(dados ?? VAZIO); setEditando(true); };

  const salvar = async () => {
    setSalvando(true);
    // Dias e unidade andam juntos: o CHECK do banco recusa unidade sem dias, e
    // dia sem unidade seria contado como corrido por omissão.
    const payload = {
      prazo_entrega_dias: form.prazo_entrega_dias || null,
      prazo_entrega_unidade: form.prazo_entrega_dias ? (form.prazo_entrega_unidade || 'corridos') : null,
      local_entrega: form.local_entrega?.trim() || null,
      prazo_recebimento_dias: form.prazo_recebimento_dias || null,
      prazo_recebimento_unidade: form.prazo_recebimento_dias ? (form.prazo_recebimento_unidade || 'corridos') : null,
      prazo_pagamento_dias: form.prazo_pagamento_dias || null,
      prazo_pagamento_unidade: form.prazo_pagamento_dias ? (form.prazo_pagamento_unidade || 'corridos') : null,
      prazo_pagamento_marco: form.prazo_pagamento_dias ? (form.prazo_pagamento_marco || null) : null,
    };
    // `types.ts` é gerado do schema e ainda não conhece estas colunas — elas
    // nasceram na 20260829000004, que é colada à mão. O cast some quando
    // alguém regenerar os tipos; regenerá-los aqui traria junto toda a deriva
    // de schema que o Lovable acumulou, que é mudança grande demais para
    // caber num ajuste de entrega.
    const { error } = await supabase
      .from('contratos')
      .update(payload as never)
      .eq('id', contratoId);
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    setDados({ ...(dados ?? VAZIO), ...payload });
    setEditando(false);
    toast.success('Condições de entrega atualizadas.');
  };

  /**
   * Apaga um prazo cuja evidência não o sustenta — dias, unidade e a frase
   * citada saem juntos (e o marco, no pagamento). O campo volta a "não fixado",
   * que é a verdade: ninguém leu um prazo neste contrato ainda.
   */
  const descartarPrazo = async (p: Prazo) => {
    setDescartando(p.chave);
    const payload: Record<string, null> = { [p.dias]: null, [p.unidade]: null, [p.clausula]: null };
    if (p.chave === 'pagamento') payload.prazo_pagamento_marco = null;
    const { error } = await supabase.from('contratos').update(payload as never).eq('id', contratoId);
    setDescartando(null);
    if (error) { toast.error('Não foi possível descartar', { description: error.message }); return; }
    setDados({ ...(dados ?? VAZIO), ...payload });
    toast.success(`O ${p.rotulo} foi descartado.`, {
      description: 'O campo volta a "não fixado". Preencha pelo lápis quando o contrato disser o prazo.',
    });
  };

  const semNada = !dados?.prazo_entrega_dias && !dados?.local_entrega
    && !dados?.prazo_recebimento_dias && !dados?.prazo_pagamento_dias;

  const referencia = (texto: string) => (
    <span className="g-meta whitespace-nowrap text-muted-foreground"> · {texto}</span>
  );
  const naoFixado = (tom: 'neutro' | 'aviso' = 'neutro') => (
    <span className={`whitespace-nowrap font-normal ${tom === 'aviso' ? 'text-warning-ink' : 'text-muted-foreground'}`}>não fixado</span>
  );

  const evidencias: Array<[string, string]> = dados ? ([
    ['Prazo de entrega', dados.prazo_entrega_clausula],
    ['Local', dados.local_entrega_clausula],
    ['Ateste', dados.prazo_recebimento_clausula],
    ['Pagamento', dados.prazo_pagamento_clausula],
  ] as Array<[string, string | null]>).filter((e): e is [string, string] => !!e[1]) : [];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="w-4 h-4 text-muted-foreground" /> Condições de entrega
        </h4>
        {!editando && (
          <Button variant="ghost" size="icon" className="h-9 w-9 nao-imprime" onClick={abrir} title="Editar" aria-label="Editar condições de entrega">
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </div>

      {editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Prazo de entrega</Label>
              <Input type="number" min={1} max={1825} placeholder="dias"
                value={form.prazo_entrega_dias ?? ''}
                onChange={e => setForm(f => ({ ...f, prazo_entrega_dias: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <Label>Contagem</Label>
              <Select value={form.prazo_entrega_unidade ?? 'corridos'}
                onValueChange={v => setForm(f => ({ ...f, prazo_entrega_unidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corridos">dias corridos</SelectItem>
                  <SelectItem value="uteis">dias úteis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ateste pelo órgão (art. 140)</Label>
              <Input type="number" min={1} max={1825} placeholder="dias"
                value={form.prazo_recebimento_dias ?? ''}
                onChange={e => setForm(f => ({ ...f, prazo_recebimento_dias: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Prazo de pagamento</Label>
              <Input type="number" min={1} max={365} placeholder="dias"
                value={form.prazo_pagamento_dias ?? ''}
                onChange={e => setForm(f => ({ ...f, prazo_pagamento_dias: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <Label>Contagem</Label>
              <Select value={form.prazo_pagamento_unidade ?? 'corridos'}
                onValueChange={v => setForm(f => ({ ...f, prazo_pagamento_unidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corridos">dias corridos</SelectItem>
                  <SelectItem value="uteis">dias úteis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              {/* Sem padrão de propósito: trocar ateste por nota fiscal
                  desloca a previsão de entrada em semanas. */}
              <Label>Contado a partir</Label>
              <Select value={form.prazo_pagamento_marco ?? ''}
                onValueChange={v => setForm(f => ({ ...f, prazo_pagamento_marco: v }))}>
                <SelectTrigger><SelectValue placeholder="o que a cláusula diz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ateste">do ateste</SelectItem>
                  <SelectItem value="nota_fiscal">da emissão da NF</SelectItem>
                  <SelectItem value="protocolo">do protocolo da NF</SelectItem>
                  <SelectItem value="entrega">da entrega</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Local de entrega</Label>
            <Input placeholder="Endereço, unidade ou a regra do contrato"
              value={form.local_entrega ?? ''}
              onChange={e => setForm(f => ({ ...f, local_entrega: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} aria-label="Cancelar edição">
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : semNada ? (
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="flex items-center gap-2 font-medium text-warning-ink">
            <AlertTriangle className="w-4 h-4" /> Nenhuma condição de entrega registrada
          </p>
          <p>
            Sem elas, a aba Pedidos não calcula a data-limite de cada pedido. Os documentos já
            anexados podem responder: reanalise-os, ou preencha aqui pelo lápis.
          </p>
          <BotaoReanalisar />
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── Três prazos, três donos — em LINHAS, não em colunas ─────────
              As três colunas de antes, num painel de 400px, quebravam cada
              valor em quatro linhas, e "481 dias corridos contado do marco da
              cláusula" escorria para debaixo de "Órgão atesta em" (18/09).
              Uma linha por prazo, rótulo à esquerda e valor à direita, não
              mistura nada. "Órgão recebe em" era rótulo enganoso: o prazo é o
              que o órgão tem para ATESTAR (art. 140), e é dele que costuma
              correr o pagamento. Nomear quem deve o quê separa os três. */}
          <ListaDeCampos
            campos={[
              {
                rotulo: 'Você entrega em',
                valor: emDias(dados!.prazo_entrega_dias, dados!.prazo_entrega_unidade)
                  ? (
                    <span title="Contado do marco que a cláusula fixa — o pedido ou a ordem de fornecimento">
                      {emDias(dados!.prazo_entrega_dias, dados!.prazo_entrega_unidade)}
                    </span>
                  )
                  : naoFixado(),
              },
              {
                rotulo: 'Órgão atesta em',
                valor: (
                  <span>
                    {emDias(dados!.prazo_recebimento_dias, dados!.prazo_recebimento_unidade) ?? naoFixado()}
                    {referencia('recebimento definitivo, art. 140')}
                  </span>
                ),
              },
              {
                rotulo: 'Órgão paga em',
                valor: (
                  <span>
                    {emDias(dados!.prazo_pagamento_dias, dados!.prazo_pagamento_unidade) ?? naoFixado('aviso')}
                    {dados!.prazo_pagamento_dias && dados!.prazo_pagamento_marco && (
                      <span className="font-normal text-muted-foreground">
                        {' '}{ROTULO_DO_MARCO[dados!.prazo_pagamento_marco as keyof typeof ROTULO_DO_MARCO]}
                      </span>
                    )}
                    {/* Cláusula necessária: art. 92, V (condições de pagamento) e
                        VI (prazo para liquidação e para pagamento). */}
                    {referencia('cláusula obrigatória, art. 92, VI')}
                  </span>
                ),
              },
              {
                rotulo: 'Local de entrega',
                largo: true,
                valor: dados!.local_entrega ?? <span className="text-muted-foreground">não informado</span>,
              },
            ]}
          />

          {/* Prazo gravado com evidência que não fala em prazo: dito aqui, com a
              saída ao lado — a leitura nova já recusa isso na entrada. */}
          {PRAZOS.filter((p) => prazoSuspeito(dados!, p)).map((p) => (
            <div key={p.chave} role="alert" className="space-y-1.5 rounded-md border border-warning-line bg-warning-tint p-2.5 text-xs text-warning-ink">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <strong>O {p.rotulo} de {dados![p.dias]} dias não tem cláusula que o sustente.</strong>{' '}
                  A frase lida não fala em prazo — parece uma linha de tabela de itens (quantidade ou valor
                  lidos como dias). Confira o documento: corrija pelo lápis, ou descarte.
                </span>
              </p>
              <Button size="sm" variant="outline" className="nao-imprime" onClick={() => descartarPrazo(p)} disabled={descartando === p.chave}>
                {descartando === p.chave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Descartar este prazo
              </Button>
            </div>
          ))}

          {/* O que a ausência custa, dita onde ela aparece. Um traço não
              informa que falta a cláusula que faz o Contas a Receber projetar,
              nem que a lei tem uma resposta quando ela falta. */}
          {!dados!.prazo_pagamento_dias && (
            <p className="text-xs text-warning-ink flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Sem prazo de pagamento o Contas a Receber não tem data para projetar — e projetar
                sobre um número inventado é pior do que não projetar. Enquanto não for preenchido,
                o único marco que resta é o do art. 137, §2º, IV: dois meses da emissão da nota
                fiscal, quando nasce o direito de pedir
                a extinção do contrato.
              </span>
            </p>
          )}

          {/* A frase de onde cada número saiu, com o nome do campo na frente.
              Sem ela o prazo é um número que ninguém consegue contestar — e
              prazo errado só se descobre no dia em que já era. */}
          {evidencias.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs text-muted-foreground">Conforme o documento:</p>
              {evidencias.map(([rotulo, texto]) => (
                <p key={rotulo} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                  <span className="font-medium">{rotulo}:</span> <span className="italic">“{texto}”</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
