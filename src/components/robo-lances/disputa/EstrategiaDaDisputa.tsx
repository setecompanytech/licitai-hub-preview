import { useState } from 'react';
import { Brain, CheckCircle2, ChevronDown, ShieldCheck, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import AceiteTermosDialog from '@/components/robo-lances/AceiteTermosDialog';
import AutorizacaoLanceDialog from '@/components/robo-lances/AutorizacaoLanceDialog';
import EstrategiaIAPanel from '@/components/robo-lances/EstrategiaIAPanel';
import DialogoModoDeOperacao from '@/components/robo-lances/cliente/DialogoModoDeOperacao';
import type { ModoDeOperacao } from '@/components/robo-lances/cliente/useModoDeOperacao';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import { formatarMoeda, formatarPercentual } from '@/components/workspace/robo/formatos';
import { cn } from '@/lib/utils';

/**
 * Aba "Estratégia" — com que regra o robô disputa, e até onde a empresa deixa.
 *
 * Reúne o que a tela antiga espalhava: parâmetros no modal "Detalhes", limite e
 * nível na coluna da direita, autorização como botão solto e a análise por IA
 * aberta no meio da disputa selecionada. Tudo em leitura: alterar parâmetro é
 * "Editar parâmetros", no topo; alterar o limite exige passar de novo pelo
 * aceite de termos.
 *
 * A análise com IA vem recolhida e marcada como opcional: é texto a partir de
 * padrões gerais de pregões, não usa os lances desta disputa e não define limite.
 */
export default function EstrategiaDaDisputa({
  lance,
  modo,
  podeOperar,
}: {
  lance: LanceConfig;
  modo: ModoDeOperacao;
  podeOperar: boolean;
}) {
  const [autorizacaoAberta, setAutorizacaoAberta] = useState(false);
  const [iaAberta, setIaAberta] = useState(false);

  /** Zero não é "R$ 0,00": é "ninguém definiu". */
  const moedaOuAusente = (valor: number, razao: string) =>
    valor > 0 ? formatarMoeda(valor) : <ValorIndisponivel razao={razao} />;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <section className="g-cartao flex min-w-0 flex-col p-4">
          <BlocoDoPainel titulo="Parâmetros da disputa">
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Primeiro lance',
                  valor: moedaOuAusente(lance.valorInicial, 'Valor inicial não definido'),
                  numerico: lance.valorInicial > 0,
                },
                {
                  rotulo: 'Piso da disputa',
                  valor: moedaOuAusente(lance.valorMinimo, 'Piso não definido no cadastro da disputa'),
                  numerico: lance.valorMinimo > 0,
                },
                {
                  rotulo: 'Decremento mínimo',
                  valor: moedaOuAusente(lance.decrementoMin, 'Decremento em reais não definido'),
                  numerico: lance.decrementoMin > 0,
                },
                {
                  rotulo: 'Decremento percentual',
                  valor:
                    lance.decrementoPercentual > 0 ? (
                      formatarPercentual(lance.decrementoPercentual)
                    ) : (
                      <ValorIndisponivel razao="Decremento percentual não definido" />
                    ),
                  numerico: lance.decrementoPercentual > 0,
                },
                { rotulo: 'Intervalo entre lances', valor: `${lance.intervaloSegundos} s`, numerico: true },
                { rotulo: 'Máx. lances por sessão', valor: String(lance.maxLances), numerico: true },
                { rotulo: 'Modo dos lances', valor: lance.modoAutomatico ? 'Automático' : 'Manual' },
                { rotulo: 'Disputa', valor: lance.tipoDisputa === 'lote' ? 'Por lote' : 'Por item' },
                {
                  rotulo: 'Valor de referência',
                  valor: moedaOuAusente(lance.valorReferencia, 'Soma dos itens não informada'),
                  numerico: lance.valorReferencia > 0,
                },
              ]}
            />
            <p className="g-meta text-muted-foreground">
              {podeOperar
                ? 'Para alterar, use “Editar parâmetros”, no topo da disputa.'
                : 'Alterar os parâmetros exige o papel de operador.'}
            </p>
          </BlocoDoPainel>
        </section>

        <section className="g-cartao flex min-w-0 flex-col p-4">
          <BlocoDoPainel titulo="Limite e modo de operação">
            <ListaDeCampos
              campos={[
                {
                  rotulo: (
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Limite financeiro autorizado
                    </span>
                  ),
                  valor: !modo.limiteCarregado ? (
                    <ValorIndisponivel razao="Consultando o aceite vigente" />
                  ) : modo.limiteFinanceiro > 0 ? (
                    formatarMoeda(modo.limiteFinanceiro)
                  ) : (
                    // Zero aqui NÃO é "limite de R$ 0,00": é ausência de aceite
                    // vigente. Exibi-lo como número seria afirmar sobre a
                    // empresa uma coisa que ninguém decidiu.
                    <ValorIndisponivel razao="Nenhum aceite vigente — definido ao ativar o nível 2 ou 3" />
                  ),
                  numerico: modo.limiteCarregado && modo.limiteFinanceiro > 0,
                },
                {
                  rotulo: 'Nível de automação',
                  valor: (
                    <DialogoModoDeOperacao nivel={modo.nivel} podeAlterar={modo.podeAlterar} aoAlterar={modo.alterarNivel} />
                  ),
                },
              ]}
            />
            <p className="g-meta text-muted-foreground">
              O limite vem do aceite de termos e não é editável aqui: alterá-lo exige passar de novo pelo aceite, com a
              política de uso e a declaração de responsabilidade.
            </p>
            {podeOperar && modo.nivel === 2 && !modo.estrategiaAutorizada && lance.status === 'aguardando' && (
              <Button variant="outline" onClick={() => setAutorizacaoAberta(true)} className="g-controle self-start">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Autorizar Estratégia
              </Button>
            )}
            {modo.estrategiaAutorizada && (
              <Badge variant="success" className="gap-1 self-start">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Estratégia Autorizada
              </Badge>
            )}
          </BlocoDoPainel>
        </section>
      </div>

      <Collapsible open={iaAberta} onOpenChange={setIaAberta} className="g-cartao min-w-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 rounded-[var(--g-raio)] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 items-start gap-3">
              <Brain aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <span className="g-titulo-secao text-foreground">Análise com IA (opcional)</span>
                <span className="g-meta text-muted-foreground">
                  Texto a partir de padrões gerais de pregões. Não usa os lances desta disputa e não define limites.
                </span>
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', iaAberta && 'rotate-180')}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border p-4">
          <EstrategiaIAPanel lance={lance} />
        </CollapsibleContent>
      </Collapsible>

      {/* ── Diálogos de governança ── o aceite abre depois da troca de nível;
          a autorização, pelo botão do nível 2. */}
      <AceiteTermosDialog
        open={modo.aceiteAberto}
        onOpenChange={modo.definirAceiteAberto}
        nivel={modo.nivel}
        sessaoId={undefined}
        licitacaoId={lance.licitacaoId}
        onAceite={modo.aoAceitar}
      />
      <AutorizacaoLanceDialog
        open={autorizacaoAberta}
        onOpenChange={setAutorizacaoAberta}
        estrategia={{
          valorInicial: lance.valorInicial,
          valorMinimo: lance.valorMinimo,
          decrementoMin: lance.decrementoMin,
          decrementoPercentual: lance.decrementoPercentual,
          maxLances: lance.maxLances,
          intervaloSegundos: lance.intervaloSegundos,
        }}
        limiteFinanceiro={modo.limiteFinanceiro}
        sessaoId={undefined}
        licitacaoId={lance.licitacaoId}
        edital={lance.edital}
        onAutorizar={modo.autorizarEstrategia}
      />
    </div>
  );
}
