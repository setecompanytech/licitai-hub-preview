import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Target, Plus, Trash2, Loader2, RotateCcw, Info, XCircle } from 'lucide-react';
import {
  useMetasConfig, useSalvarMetasConfig,
  useValoresAlvo, useSalvarValorAlvo, useExcluirValorAlvo,
  useMotivosPerda, useSalvarMotivoPerda,
  useRestaurarPadroes,
} from '@/hooks/useMetasComercial';
import { MODALIDADES, rotuloModalidade } from '@/lib/metas/modalidades';
import { formatBRL } from '@/lib/financeiro/formatters';
import { APURACAO } from '@/lib/metas/apuracao';
import { MoneyInput } from '@/components/ui/money-input';
import { LinhaApuracao } from './comuns';
import FeriadosManager from './FeriadosManager';

export default function ParametrizacaoMetas() {
  const { data: config } = useMetasConfig();
  const { data: valores, isLoading: carregandoValores } = useValoresAlvo();
  const { data: motivos } = useMotivosPerda();

  const salvarConfig = useSalvarMetasConfig();
  const salvarValor = useSalvarValorAlvo();
  const excluirValor = useExcluirValorAlvo();
  const salvarMotivo = useSalvarMotivoPerda();
  const restaurar = useRestaurarPadroes();

  const [novo, setNovo] = useState<{ modalidade: string; valor: number; inicio: string }>({
    modalidade: 'pregao_eletronico',
    valor: 0,
    inicio: new Date().toISOString().slice(0, 10),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const campo = (k: keyof NonNullable<typeof config>, fallback: number) =>
    form[k] ?? String(config?.[k] ?? fallback);

  /**
   * "Restaurar padrões" é a ação que tira do vazio tanto os valores-alvo
   * quanto os motivos de perda — a mesma RPC idempotente cria os dois. Ela
   * aparece no topo e DENTRO de cada vazio: quem chega pela tabela vazia não
   * deveria precisar caçar o botão em outro cartão.
   */
  const botaoRestaurar = (rotulo = 'Restaurar padrões') => (
    <Button
      variant="outline"
      onClick={() => restaurar.mutate()}
      disabled={restaurar.isPending}
      title="Recria os padrões que estiverem faltando; não altera o que já existe"
    >
      {restaurar.isPending
        ? <Loader2 aria-hidden="true" className="animate-spin" />
        : <RotateCcw aria-hidden="true" />}
      {rotulo}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ── Valores-alvo por modalidade ── */}
      <SecaoGestao
        titulo="Valores-alvo por modalidade"
        acoes={<span className="g-meta text-muted-foreground">Referência de meta usada nas projeções</span>}
      >
        <div className="g-cartao flex flex-col">
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-6">
            <Alert variant="info">
              <Info aria-hidden="true" className="w-4 h-4" />
              <AlertDescription>
                O motor usa o valor-alvo como ticket de referência quando não há histórico
                suficiente de contratos na modalidade. Um valor com <strong>colaborador</strong>{' '}
                preenchido tem precedência sobre o padrão da empresa.
              </AlertDescription>
            </Alert>

            {/* Novo valor-alvo */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="valor-alvo-modalidade" className="g-meta mb-1 block text-muted-foreground">Modalidade</Label>
                <Select value={novo.modalidade} onValueChange={(v) => setNovo((n) => ({ ...n, modalidade: v }))}>
                  <SelectTrigger id="valor-alvo-modalidade" className="g-controle"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => (
                      <SelectItem key={m.codigo} value={m.codigo}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Label htmlFor="valor-alvo-valor" className="g-meta mb-1 block text-muted-foreground">Valor-alvo (R$)</Label>
                <MoneyInput
                  id="valor-alvo-valor"
                  className="g-controle"
                  value={novo.valor}
                  onValueChange={(v) => setNovo((n) => ({ ...n, valor: v }))}
                />
              </div>
              <div className="w-full sm:w-44">
                <Label htmlFor="valor-alvo-vigencia" className="g-meta mb-1 block text-muted-foreground">Vigência a partir de</Label>
                <Input
                  id="valor-alvo-vigencia"
                  type="date"
                  className="g-controle"
                  value={novo.inicio}
                  onChange={(e) => setNovo((n) => ({ ...n, inicio: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={novo.valor <= 0 || salvarValor.isPending}
                  onClick={() =>
                    salvarValor.mutate(
                      {
                        modalidade_codigo: novo.modalidade,
                        valor_alvo: novo.valor,
                        vigencia_inicio: novo.inicio,
                      },
                      { onSuccess: () => setNovo((n) => ({ ...n, valor: 0 })) },
                    )
                  }
                >
                  {salvarValor.isPending
                    ? <Loader2 aria-hidden="true" className="animate-spin" />
                    : <Plus aria-hidden="true" />}
                  Adicionar
                </Button>
                {botaoRestaurar()}
              </div>
            </div>

            {/* O ticket real que o valor-alvo substitui vem dos contratos da
                janela — e contrato entra no mês pela assinatura, não pela
                disputa. Sem isso escrito, a carteira parece atrasada. */}
            <LinhaApuracao
              curto={`Ticket real da carteira: ${APURACAO.ganhos.curto}`}
              explicacao={APURACAO.ganhos.explicacao}
            />
          </div>

          {carregandoValores ? (
            <div role="status" aria-label="Carregando" className="g-corpo flex items-center justify-center gap-2 p-12 text-muted-foreground">
              <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
              Carregando…
            </div>
          ) : (valores?.length ?? 0) === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<Target />}
              titulo="Nenhum valor-alvo cadastrado"
              descricao="Sem valor-alvo, a projeção de quem ainda não tem carteira na janela fica sem ticket de referência."
              /* Vazio com AÇÃO, não com instrução: o botão que resolve fica
                 aqui dentro, em vez de só citado no texto. */
              acao={botaoRestaurar('Criar os valores padrão')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="pl-4 sm:pl-6">Modalidade</TableHead>
                    <TableHead className="w-[170px] text-right">Valor-alvo</TableHead>
                    <TableHead className="w-[140px]">Vigência</TableHead>
                    <TableHead className="w-[140px]">Escopo</TableHead>
                    <TableHead className="w-[72px] pr-4 text-right sm:pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(valores ?? []).map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="g-corpo pl-4 font-medium sm:pl-6">{rotuloModalidade(v.modalidade_codigo)}</TableCell>
                      <TableCell className="g-corpo text-right tabular-nums">{formatBRL(Number(v.valor_alvo))}</TableCell>
                      <TableCell className="g-corpo text-muted-foreground">
                        {new Date(`${v.vigencia_inicio}T12:00:00`).toLocaleDateString('pt-BR')}
                        {v.vigencia_fim && ` → ${new Date(`${v.vigencia_fim}T12:00:00`).toLocaleDateString('pt-BR')}`}
                      </TableCell>
                      <TableCell>
                        {/* Escopo do colaborador tem precedência sobre o da
                            empresa, e a linha precisa dizer isso de relance:
                            `info` tem fundo, `outline` não — `muted` pintaria o
                            mesmo fundo de `info` e as duas ficariam iguais. */}
                        <Badge variant={v.user_id ? 'info' : 'outline'}>
                          {v.user_id ? 'Colaborador' : 'Empresa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right sm:pr-6">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Excluir valor-alvo de ${rotuloModalidade(v.modalidade_codigo)}`}
                          onClick={() => excluirValor.mutate(v.id)}
                          disabled={excluirValor.isPending}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SecaoGestao>

      {/* ── Limiares de alerta e janela histórica ── */}
      <SecaoGestao titulo="Alertas e histórico">
        <div className="g-cartao flex flex-col gap-6 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="metas-janela-historica" className="g-meta mb-1 block text-muted-foreground">Janela histórica (meses)</Label>
              <Input
                id="metas-janela-historica"
                type="number" min={1} max={36}
                className="g-controle"
                value={campo('janela_historica_meses', 6)}
                onChange={(e) => setForm((f) => ({ ...f, janela_historica_meses: e.target.value }))}
              />
              <p className="g-meta mt-1 text-muted-foreground">Base da taxa de conversão e do ticket médio.</p>
            </div>
            <div>
              <Label htmlFor="metas-alerta-dias" className="g-meta mb-1 block text-muted-foreground">Alertar faltando (dias úteis)</Label>
              <Input
                id="metas-alerta-dias"
                type="number" min={1} max={31}
                className="g-controle"
                value={campo('alerta_dias_limite', 10)}
                onChange={(e) => setForm((f) => ({ ...f, alerta_dias_limite: e.target.value }))}
              />
              <p className="g-meta mt-1 text-muted-foreground">Antes disso, cobrar percentual não diria nada.</p>
            </div>
            <div>
              <Label htmlFor="metas-alerta-minimo" className="g-meta mb-1 block text-muted-foreground">Realizado mínimo (%)</Label>
              <Input
                id="metas-alerta-minimo"
                type="number" min={0} max={100} step="0.01"
                className="g-controle"
                value={campo('alerta_percentual_minimo', 70)}
                onChange={(e) => setForm((f) => ({ ...f, alerta_percentual_minimo: e.target.value }))}
              />
              <p className="g-meta mt-1 text-muted-foreground">Abaixo disso, dispara alerta de risco.</p>
            </div>
            <div>
              <Label htmlFor="metas-min-amostra" className="g-meta mb-1 block text-muted-foreground">Amostra mínima (contratos)</Label>
              <Input
                id="metas-min-amostra"
                type="number" min={1}
                className="g-controle"
                value={campo('min_amostra_ticket', 3)}
                onChange={(e) => setForm((f) => ({ ...f, min_amostra_ticket: e.target.value }))}
              />
              <p className="g-meta mt-1 text-muted-foreground">Abaixo disso usa o valor-alvo da modalidade.</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={salvarConfig.isPending || Object.keys(form).length === 0}
              onClick={() =>
                salvarConfig.mutate(
                  {
                    janela_historica_meses: Number(campo('janela_historica_meses', 6)),
                    alerta_dias_limite: Number(campo('alerta_dias_limite', 10)),
                    alerta_percentual_minimo: Number(campo('alerta_percentual_minimo', 70)),
                    min_amostra_ticket: Number(campo('min_amostra_ticket', 3)),
                  },
                  { onSuccess: () => setForm({}) },
                )
              }
            >
              {salvarConfig.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              Salvar parâmetros
            </Button>
          </div>
        </div>
      </SecaoGestao>

      {/* ── Motivos de perda ── */}
      <SecaoGestao
        titulo="Motivos de perda"
        contagem={motivos?.length ?? 0}
        acoes={<span className="g-meta text-muted-foreground">Usados no registro obrigatório de perda</span>}
      >
        <div className="g-cartao">
          {(motivos?.length ?? 0) === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<XCircle />}
              titulo="Nenhum motivo cadastrado"
              descricao="O registro de perda é obrigatório e exige um motivo da lista — sem nenhum cadastrado, ninguém consegue registrar a perda."
              acao={botaoRestaurar('Criar os motivos padrão')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="w-[80px] pl-4 sm:pl-6">Ordem</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-[150px]">Código</TableHead>
                    <TableHead className="w-[100px] pr-4 text-right sm:pr-6">Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(motivos ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="g-corpo pl-4 tabular-nums text-muted-foreground sm:pl-6">{m.ordem}</TableCell>
                      <TableCell className="g-corpo font-medium">{m.label}</TableCell>
                      <TableCell className="g-corpo font-mono text-muted-foreground">{m.codigo}</TableCell>
                      <TableCell className="pr-4 text-right sm:pr-6">
                        <Switch
                          checked={m.ativo}
                          aria-label={`Motivo ${m.label} ativo`}
                          onCheckedChange={(v) =>
                            salvarMotivo.mutate({
                              id: m.id, codigo: m.codigo, label: m.label, ordem: m.ordem, ativo: v,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SecaoGestao>

      {/* ── Feriados (dias úteis por praça) ── */}
      <FeriadosManager />
    </div>
  );
}
