import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Target, Plus, Trash2, Loader2, RotateCcw, Bell, Info } from 'lucide-react';
import {
  useMetasConfig, useSalvarMetasConfig,
  useValoresAlvo, useSalvarValorAlvo, useExcluirValorAlvo,
  useMotivosPerda, useSalvarMotivoPerda,
  useRestaurarPadroes,
} from '@/hooks/useMetasComercial';
import { MODALIDADES, rotuloModalidade } from '@/lib/metas/modalidades';
import { formatBRL } from '@/lib/financeiro/formatters';
import { MoneyInput } from '@/components/ui/money-input';

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

  return (
    <div className="space-y-4">
      {/* ── Valores-alvo por modalidade ── */}
      <Card>
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Valores-alvo por modalidade
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              Referência de meta usada nas projeções
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-start gap-2 px-5 py-3 text-base text-muted-foreground border-b bg-muted/20">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              O motor usa o valor-alvo como ticket de referência quando não há histórico
              suficiente de contratos na modalidade. Um valor com <strong>colaborador</strong>{' '}
              preenchido tem precedência sobre o padrão da empresa.
            </p>
          </div>

          {/* Novo valor-alvo */}
          <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b">
            <div className="min-w-[200px] flex-1">
              <Label className="text-sm text-muted-foreground mb-1 block">Modalidade</Label>
              <Select value={novo.modalidade} onValueChange={(v) => setNovo((n) => ({ ...n, modalidade: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((m) => (
                    <SelectItem key={m.codigo} value={m.codigo}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <Label className="text-sm text-muted-foreground mb-1 block">Valor-alvo (R$)</Label>
              <MoneyInput
                className="h-9 text-sm"
                value={novo.valor}
                onValueChange={(v) => setNovo((n) => ({ ...n, valor: v }))}
              />
            </div>
            <div className="w-[150px]">
              <Label className="text-sm text-muted-foreground mb-1 block">Vigência a partir de</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={novo.inicio}
                onChange={(e) => setNovo((n) => ({ ...n, inicio: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              className="h-9"
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
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Adicionar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-muted-foreground"
              onClick={() => restaurar.mutate()}
              disabled={restaurar.isPending}
              title="Recria os padrões que estiverem faltando; não altera o que já existe"
            >
              {restaurar.isPending
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
              Restaurar padrões
            </Button>
          </div>

          {carregandoValores ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 inline animate-spin mr-2" />Carregando…
            </div>
          ) : (valores?.length ?? 0) === 0 ? (
            <div className="py-10 text-center text-base text-muted-foreground">
              Nenhum valor-alvo cadastrado. Use "Restaurar padrões" para criar os valores iniciais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-muted/30">
                  <TableHead className="pl-5">Modalidade</TableHead>
                  <TableHead className="w-[160px] text-right">Valor-alvo</TableHead>
                  <TableHead className="w-[130px]">Vigência</TableHead>
                  <TableHead className="w-[130px]">Escopo</TableHead>
                  <TableHead className="w-[60px] text-right pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(valores ?? []).map((v) => (
                  <TableRow key={v.id} className="text-sm">
                    <TableCell className="pl-5 font-medium">{rotuloModalidade(v.modalidade_codigo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(Number(v.valor_alvo))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(`${v.vigencia_inicio}T12:00:00`).toLocaleDateString('pt-BR')}
                      {v.vigencia_fim && ` → ${new Date(`${v.vigencia_fim}T12:00:00`).toLocaleDateString('pt-BR')}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.user_id ? 'default' : 'outline'} className="text-[10px]">
                        {v.user_id ? 'Colaborador' : 'Empresa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive/70 hover:text-destructive"
                        onClick={() => excluirValor.mutate(v.id)}
                        disabled={excluirValor.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Limiares de alerta e janela histórica ── */}
      <Card>
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Alertas e histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Janela histórica (meses)</Label>
              <Input
                type="number" min={1} max={36} className="h-9 text-sm"
                value={campo('janela_historica_meses', 6)}
                onChange={(e) => setForm((f) => ({ ...f, janela_historica_meses: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Base da taxa de conversão e do ticket médio.</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Alertar faltando (dias úteis)</Label>
              <Input
                type="number" min={1} max={31} className="h-9 text-sm"
                value={campo('alerta_dias_limite', 10)}
                onChange={(e) => setForm((f) => ({ ...f, alerta_dias_limite: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Realizado mínimo (%)</Label>
              <Input
                type="number" min={0} max={100} step="0.01" className="h-9 text-sm"
                value={campo('alerta_percentual_minimo', 70)}
                onChange={(e) => setForm((f) => ({ ...f, alerta_percentual_minimo: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Abaixo disso, dispara alerta de risco.</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Amostra mínima (contratos)</Label>
              <Input
                type="number" min={1} className="h-9 text-sm"
                value={campo('min_amostra_ticket', 3)}
                onChange={(e) => setForm((f) => ({ ...f, min_amostra_ticket: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Abaixo disso usa o valor-alvo da modalidade.</p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              size="sm"
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
              {salvarConfig.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Salvar parâmetros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Motivos de perda ── */}
      <Card>
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Motivos de perda
            <Badge variant="outline" className="text-xs">{motivos?.length ?? 0}</Badge>
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              Usados no registro obrigatório de perda
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-muted/30">
                <TableHead className="w-[70px] pl-5">Ordem</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="w-[140px]">Código</TableHead>
                <TableHead className="w-[90px] text-right pr-5">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(motivos ?? []).map((m) => (
                <TableRow key={m.id} className="text-sm">
                  <TableCell className="pl-5 tabular-nums text-muted-foreground">{m.ordem}</TableCell>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{m.codigo}</TableCell>
                  <TableCell className="text-right pr-5">
                    <Switch
                      checked={m.ativo}
                      onCheckedChange={(v) =>
                        salvarMotivo.mutate({
                          id: m.id, codigo: m.codigo, label: m.label, ordem: m.ordem, ativo: v,
                        })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
              {(motivos?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-base text-muted-foreground">
                    Nenhum motivo cadastrado. Use "Restaurar padrões" acima.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
