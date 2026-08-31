import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Truck, Pencil, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { ROTULO_DO_MARCO } from '@/lib/contratos/prazo-de-entrega';

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

  const semNada = !dados?.prazo_entrega_dias && !dados?.local_entrega
    && !dados?.prazo_recebimento_dias && !dados?.prazo_pagamento_dias;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-muted-foreground" /> Condições de entrega
        </h4>
        {!editando && (
          <Button variant="ghost" size="icon" className="h-5 w-5 nao-imprime" onClick={abrir} title="Editar">
            <Pencil className="w-3 h-3" />
          </Button>
        )}
      </div>

      {editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Prazo de entrega</Label>
              <Input type="number" min={1} max={1825} placeholder="dias"
                value={form.prazo_entrega_dias ?? ''}
                onChange={e => setForm(f => ({ ...f, prazo_entrega_dias: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Contagem</Label>
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
              <Label className="text-xs text-muted-foreground">Ateste pelo órgão (art. 140)</Label>
              <Input type="number" min={1} max={1825} placeholder="dias"
                value={form.prazo_recebimento_dias ?? ''}
                onChange={e => setForm(f => ({ ...f, prazo_recebimento_dias: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Prazo de pagamento</Label>
              <Input type="number" min={1} max={365} placeholder="dias"
                value={form.prazo_pagamento_dias ?? ''}
                onChange={e => setForm(f => ({ ...f, prazo_pagamento_dias: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Contagem</Label>
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
              <Label className="text-xs text-muted-foreground">Contado a partir</Label>
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
            <Label className="text-xs text-muted-foreground">Local de entrega</Label>
            <Input placeholder="Endereço, unidade ou a regra do contrato"
              value={form.local_entrega ?? ''}
              onChange={e => setForm(f => ({ ...f, local_entrega: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditando(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : semNada ? (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5 text-warning">
            <AlertTriangle className="w-3.5 h-3.5" /> Nenhuma condição de entrega registrada
          </p>
          <p>
            Sem elas, a aba Pedidos não calcula a data-limite de cada pedido. Reenvie
            o PDF do contrato para a leitura automática, ou preencha aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* ── Três prazos, três donos ────────────────────────────────────
              "Órgão recebe em" era um rótulo enganoso: lia-se como o momento
              em que a mercadoria chega, que é o mesmo da entrega. O prazo é
              outro — é o que o órgão tem para ATESTAR (art. 140), e é dele que
              costuma correr o pagamento. Nomear quem deve o quê separa os três
              sem precisar explicar. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Você entrega em:</span>
              <p className="font-medium">{emDias(dados!.prazo_entrega_dias, dados!.prazo_entrega_unidade) ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground">contado do marco da cláusula</p>
            </div>
            <div>
              <span className="text-muted-foreground">Órgão atesta em:</span>
              <p className="font-medium">
                {emDias(dados!.prazo_recebimento_dias, dados!.prazo_recebimento_unidade)
                  ?? <span className="text-muted-foreground font-normal">não fixado</span>}
              </p>
              <p className="text-[11px] text-muted-foreground">
                recebimento definitivo — art. 140
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Órgão paga em:</span>
              <p className="font-medium">
                {emDias(dados!.prazo_pagamento_dias, dados!.prazo_pagamento_unidade)
                  ?? <span className="text-warning font-normal">não fixado</span>}
                {dados!.prazo_pagamento_marco && (
                  <span className="text-muted-foreground font-normal">
                    {' '}{ROTULO_DO_MARCO[dados!.prazo_pagamento_marco as keyof typeof ROTULO_DO_MARCO]}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                cláusula obrigatória — art. 92, V
              </p>
            </div>
            <div className="col-span-1 sm:col-span-3">
              <span className="text-muted-foreground">Local:</span>
              <p className="font-medium">{dados!.local_entrega ?? '—'}</p>
            </div>
          </div>

          {/* O que a ausência custa, dita onde ela aparece. Um traço não
              informa que falta a cláusula que faz o Contas a Receber projetar,
              nem que a lei tem uma resposta quando ela falta. */}
          {!dados!.prazo_pagamento_dias && (
            <p className="text-[11px] text-warning flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Sem prazo de pagamento o Contas a Receber não tem data para projetar — e projetar
                sobre um número inventado é pior do que não projetar. Enquanto não for preenchido,
                o único marco que resta é o do art. 137, §2º, IV: dois meses da emissão da nota
                fiscal ou de instrumento de cobrança equivalente, quando nasce o direito de pedir
                a extinção do contrato.
              </span>
            </p>
          )}

          {/* A frase de onde o número saiu. Sem ela o prazo é um número que
              ninguém consegue contestar — e prazo errado só se descobre no dia
              em que já era. */}
          {(dados!.prazo_entrega_clausula || dados!.local_entrega_clausula
            || dados!.prazo_recebimento_clausula || dados!.prazo_pagamento_clausula) && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-[11px] text-muted-foreground">Conforme o documento:</p>
              {[dados!.prazo_entrega_clausula, dados!.local_entrega_clausula,
                dados!.prazo_recebimento_clausula, dados!.prazo_pagamento_clausula]
                .filter(Boolean)
                .map((c, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground/80 italic border-l-2 border-border pl-2">
                    “{c}”
                  </p>
                ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
