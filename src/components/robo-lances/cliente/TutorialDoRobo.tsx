import { useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, CircleHelp, Eye, Globe, KeyRound, MinusCircle, Plug, Settings2, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ESTRATEGIAS_DO_ITEM } from '@/lib/robo/estrategia-do-item';
import {
  ABAS_DA_LISTA, BOM_SABER, FASES_DO_ROBO, PASSOS_DO_TUTORIAL, PORTAIS_NO_TUTORIAL, type ComoOPortalFunciona,
} from '@/lib/robo/tutorial-do-robo';

const ICONE_DA_FASE = [Settings2, Bot, Eye];

const ICONE_DO_COMO: Record<ComoOPortalFunciona, typeof Globe> = {
  'robo-gov-br': ShieldCheck,
  'robo-login': KeyRound,
  api: Plug,
};

/**
 * O "?" discreto do topo do Robô de lances: passar o mouse diz o que é, clicar
 * abre o tutorial (pedido do Ian, 17/09/2026).
 *
 * Três abas para não virar um paredão de texto: o que o robô faz, o passo a
 * passo de uso, e um cartão por portal — porque o que o robô faz muda de um
 * portal para outro, e é isso que a empresa mais pergunta. O texto mora em
 * `lib/robo/tutorial-do-robo.ts`.
 */
export default function TutorialDoRobo() {
  const [aberto, setAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {/* Provedor próprio, como as outras telas com dica: o componente não
          depende de estar dentro do provedor do App (nem nos testes). */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Tutorial do robô de lances"
              >
                <CircleHelp className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Tutorial: como o robô funciona e como usar</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--g-raio)] bg-primary-tint text-primary"
            >
              <Bot className="h-5 w-5" />
            </span>
            Como o robô de lances funciona
          </DialogTitle>
          <DialogDescription>
            O que o robô faz, como usar passo a passo e o que muda em cada portal.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="como" className="min-w-0">
          <TabsList>
            <TabsTrigger value="como">Como funciona</TabsTrigger>
            <TabsTrigger value="passos">Passo a passo</TabsTrigger>
            <TabsTrigger value="portais">Portais</TabsTrigger>
          </TabsList>

          {/* ── Como funciona ─────────────────────────────────────────────── */}
          {/* Layout num div de dentro: `flex` no próprio TabsContent vence o
              atributo `hidden` que o Radix põe na aba inativa, e o painel vazio
              aparecia como uma faixa em cima das outras abas. */}
          <TabsContent value="como" className="mt-5">
            <div className="flex flex-col gap-6">
              <ol className="grid gap-3 md:grid-cols-3">
                {FASES_DO_ROBO.map((fase, i) => {
                  const Icone = ICONE_DA_FASE[i] ?? Bot;
                  return (
                    <li key={fase.titulo} className="g-cartao flex flex-col gap-2 p-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary"
                        >
                          <Icone className="h-4 w-4" />
                        </span>
                        <span className="g-meta text-muted-foreground">{i + 1}</span>
                      </div>
                      <p className="font-semibold text-foreground">{fase.titulo}</p>
                      <p className="g-corpo text-muted-foreground">{fase.texto}</p>
                    </li>
                  );
                })}
              </ol>

              <section className="flex flex-col gap-3">
                <h3 className="g-titulo-secao text-foreground">Estratégias de cada item</h3>
                <p className="g-corpo -mt-1 text-muted-foreground">
                  Marque uma, duas ou as três: elas somam, e o robô cobre o 1º lugar quando qualquer uma autoriza.
                </p>
                <ul className="grid gap-3 md:grid-cols-3">
                  {ESTRATEGIAS_DO_ITEM.map((e) => (
                    <li key={e.id} className="rounded-[var(--g-raio)] border border-border p-3">
                      <p className="font-medium text-foreground">{e.nome}</p>
                      <p className="g-corpo mt-1 text-muted-foreground">{e.explicacao}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="grid gap-6 md:grid-cols-2">
                <section className="flex flex-col gap-3">
                  <h3 className="g-titulo-secao text-foreground">Bom saber</h3>
                  <ul className="flex flex-col gap-2">
                    {BOM_SABER.map((texto) => (
                      <li key={texto} className="g-corpo flex items-start gap-2 text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        {texto}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="flex flex-col gap-3">
                  <h3 className="g-titulo-secao text-foreground">As abas da lista</h3>
                  <dl className="flex flex-col gap-2">
                    {ABAS_DA_LISTA.map((aba) => (
                      <div key={aba.nome} className="g-corpo">
                        <dt className="inline font-medium text-foreground">{aba.nome}: </dt>
                        <dd className="inline text-muted-foreground">{aba.texto}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </div>
          </TabsContent>

          {/* ── Passo a passo ─────────────────────────────────────────────── */}
          <TabsContent value="passos" className="mt-5">
            <ol className="grid gap-3 md:grid-cols-2">
              {PASSOS_DO_TUTORIAL.map((passo, i) => (
                <li key={passo.titulo} className="g-cartao flex gap-3 p-4">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="font-semibold text-foreground">{passo.titulo}</p>
                    <p className="g-corpo text-muted-foreground">{passo.texto}</p>
                    <p className="g-meta w-fit rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      Onde: {passo.onde}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </TabsContent>

          {/* ── Portais ───────────────────────────────────────────────────── */}
          <TabsContent value="portais" className="mt-5">
            <ul className="grid gap-3 lg:grid-cols-3">
              {PORTAIS_NO_TUTORIAL.map((portal) => {
                const Icone = ICONE_DO_COMO[portal.como];
                const doRobo = portal.como !== 'api';
                return (
                  <li key={portal.id} className="g-cartao flex flex-col gap-3 p-4">
                    <div className="flex flex-col gap-2">
                      <h3 className="g-titulo-secao text-foreground">{portal.nome}</h3>
                      <span
                        className={cn(
                          'g-meta inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
                          doRobo ? 'bg-primary-tint text-primary' : 'bg-navy-tint text-foreground',
                        )}
                      >
                        <Icone className="h-3.5 w-3.5" aria-hidden="true" />
                        {portal.rotuloDoComo}
                      </span>
                      <p className="g-corpo text-muted-foreground">{portal.resumo}</p>
                    </div>

                    <ul className="flex flex-1 flex-col gap-2">
                      {portal.oQueFaz.map((texto) => (
                        <li key={texto} className="g-corpo flex items-start gap-2 text-foreground">
                          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                          {texto}
                        </li>
                      ))}
                    </ul>

                    <p
                      className={cn(
                        'g-corpo flex items-center gap-2 rounded-[var(--g-raio)] px-3 py-2 font-medium',
                        portal.lance.liberado ? 'bg-success-tint text-success-ink' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {portal.lance.liberado ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <MinusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      {portal.lance.texto}
                    </p>

                    {portal.atencao && (
                      <p className="g-corpo flex items-start gap-2 rounded-[var(--g-raio)] bg-warning-tint px-3 py-2 text-warning-ink">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        {portal.atencao}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={() => setAberto(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
