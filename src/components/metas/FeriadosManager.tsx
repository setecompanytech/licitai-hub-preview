import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarDays, Plus, Trash2, Loader2, Info, Pencil, X } from 'lucide-react';
import {
  useFeriados, useSalvarFeriado, useExcluirFeriado, useColaboradores,
  type Feriado,
} from '@/hooks/useMetasComercial';
import { UFS_BRASIL } from '@/lib/ibge-municipios';
import { atingeAlgumaPraca } from '@/lib/metas/feriados';
import { ehFimDeSemana } from '@/lib/metas/dias-uteis';

const NACIONAL = '__nacional__';

type Rascunho = { data: string; descricao: string; uf: string; municipio: string };

const VAZIO: Rascunho = { data: '', descricao: '', uf: NACIONAL, municipio: '' };

const rotuloAbrangencia = (f: Feriado) =>
  !f.uf ? 'Nacional' : f.municipio ? `${f.municipio}/${f.uf}` : `Estadual ${f.uf}`;

const corAbrangencia = (f: Feriado) =>
  !f.uf
    ? 'bg-primary/10 text-primary border-primary/30'
    : f.municipio
    ? 'bg-accent/10 text-accent border-accent/30'
    : 'bg-muted text-muted-foreground border-border';

export default function FeriadosManager() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Feriado | null>(null);

  const { data: feriados, isLoading } = useFeriados(ano);
  const { data: colaboradores } = useColaboradores();
  const salvar = useSalvarFeriado();
  const excluir = useExcluirFeriado();

  /**
   * Praças em uso. A regra do projeto é cadastrar só os feriados das UFs e
   * cidades onde há colaborador — sem isso, o admin não tem como saber quais
   * importam.
   */
  const pracas = useMemo(() => {
    const ufs = new Set<string>();
    const municipios = new Set<string>();
    for (const c of colaboradores ?? []) {
      if (c.praca_uf) ufs.add(c.praca_uf);
      if (c.praca_uf && c.praca_municipio) municipios.add(`${c.praca_municipio}/${c.praca_uf}`);
    }
    return { ufs: [...ufs].sort(), municipios: [...municipios].sort() };
  }, [colaboradores]);

  const ufEscolhida = rascunho.uf === NACIONAL ? '' : rascunho.uf;
  const podeSalvar = rascunho.data !== '' && rascunho.descricao.trim() !== '';

  /** Feriado em fim de semana não muda nada no cálculo — vale avisar. */
  const cairaNoFimDeSemana = rascunho.data !== '' && ehFimDeSemana(rascunho.data);

  /** O feriado em edição não atinge praça nenhuma? Avisa, não bloqueia. */
  const semPracaAtingida =
    ufEscolhida !== '' &&
    !atingeAlgumaPraca(
      { uf: ufEscolhida, municipio: rascunho.municipio.trim() || null },
      colaboradores ?? [],
    );

  const limpar = () => { setRascunho(VAZIO); setEditando(null); };

  const enviar = () => {
    salvar.mutate(
      {
        id: editando ?? undefined,
        data: rascunho.data,
        descricao: rascunho.descricao,
        uf: ufEscolhida || null,
        municipio: ufEscolhida ? rascunho.municipio : null,
      },
      { onSuccess: limpar },
    );
  };

  const editar = (f: Feriado) => {
    setEditando(f.id);
    setRascunho({
      data: f.data,
      descricao: f.descricao,
      uf: f.uf ?? NACIONAL,
      municipio: f.municipio ?? '',
    });
  };

  return (
    <Card>
      <CardHeader className="py-3 px-5 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          <CalendarDays className="w-4 h-4 text-primary" />
          Feriados
          <Badge variant="outline" className="text-xs">{feriados?.length ?? 0} em {ano}</Badge>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="h-8 w-[100px] text-xs ml-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex items-start gap-2 px-5 py-3 text-xs text-muted-foreground border-b bg-muted/20">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>
            Feriado desconta um dia útil do mês, o que muda o ritmo diário e a projeção.
            Cadastre apenas os das praças onde há colaborador
            {pracas.ufs.length > 0 && <> — hoje: <strong>{pracas.ufs.join(', ')}</strong></>}
            {pracas.ufs.length === 0 && <> — nenhuma praça definida ainda, então só os nacionais valem</>}.
          </p>
        </div>

        {/* Formulário */}
        <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b">
          <div className="w-[150px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Data</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={rascunho.data}
              onChange={(e) => setRascunho((r) => ({ ...r, data: e.target.value }))}
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Descrição</Label>
            <Input
              className="h-9 text-sm"
              placeholder="Independência do Brasil"
              value={rascunho.descricao}
              onChange={(e) => setRascunho((r) => ({ ...r, descricao: e.target.value }))}
            />
          </div>

          <div className="w-[170px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Abrangência</Label>
            <Select
              value={rascunho.uf}
              onValueChange={(v) => setRascunho((r) => ({
                ...r,
                uf: v,
                municipio: v === NACIONAL ? '' : r.municipio,
              }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NACIONAL}>Nacional</SelectItem>
                {UFS_BRASIL.map((u) => (
                  <SelectItem key={u.uf} value={u.uf}>
                    {u.uf} — {u.nome}
                    {pracas.ufs.includes(u.uf) ? ' •' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Município {ufEscolhida === '' && <span className="text-[10px]">(só com UF)</span>}
            </Label>
            <Input
              className="h-9 text-sm"
              placeholder="deixe vazio = estadual"
              disabled={ufEscolhida === ''}
              value={rascunho.municipio}
              onChange={(e) => setRascunho((r) => ({ ...r, municipio: e.target.value }))}
            />
          </div>

          <Button size="sm" className="h-9" disabled={!podeSalvar || salvar.isPending} onClick={enviar}>
            {salvar.isPending
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            {editando ? 'Salvar' : 'Adicionar'}
          </Button>

          {editando && (
            <Button size="sm" variant="ghost" className="h-9" onClick={limpar}>
              <X className="w-3.5 h-3.5 mr-1.5" />Cancelar
            </Button>
          )}
        </div>

        {/* Avisos — nenhum bloqueia o cadastro, só informam */}
        {(cairaNoFimDeSemana || semPracaAtingida) && (
          <div className="px-5 py-2 border-b space-y-1">
            {cairaNoFimDeSemana && (
              <p className="text-xs text-muted-foreground">
                Essa data cai em fim de semana — já não era dia útil, então o cálculo não muda.
              </p>
            )}
            {semPracaAtingida && (
              <p className="text-xs text-warning">
                Nenhum colaborador tem praça em{' '}
                <strong>{rascunho.municipio.trim() ? `${rascunho.municipio}/${ufEscolhida}` : ufEscolhida}</strong>.
                O feriado será salvo, mas não afetará ninguém até alguém receber essa praça.
              </p>
            )}
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 inline animate-spin mr-2" />Carregando…
          </div>
        ) : (feriados?.length ?? 0) === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground px-6">
            Nenhum feriado em {ano}. Sem cadastro, o mês conta todos os dias de segunda a sexta.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-muted/30">
                <TableHead className="w-[120px] pl-5">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[180px]">Abrangência</TableHead>
                <TableHead className="w-[90px] text-right pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(feriados ?? []).map((f) => {
                const fds = ehFimDeSemana(f.data);
                return (
                  <TableRow key={f.id} className={`text-sm ${fds ? 'opacity-60' : ''}`}>
                    <TableCell className="pl-5 tabular-nums">
                      {new Date(`${f.data}T12:00:00`).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', weekday: 'short',
                      })}
                    </TableCell>
                    <TableCell>
                      {f.descricao}
                      {fds && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          fim de semana — não afeta o cálculo
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${corAbrangencia(f)}`}>
                        {rotuloAbrangencia(f)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <Button
                        size="sm" variant="ghost" className="h-7 px-2"
                        onClick={() => editar(f)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-destructive/70 hover:text-destructive"
                        onClick={() => setConfirmarExclusao(f)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!confirmarExclusao} onOpenChange={(o) => !o && setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover feriado?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmarExclusao?.descricao}</strong> em{' '}
              {confirmarExclusao && new Date(`${confirmarExclusao.data}T12:00:00`).toLocaleDateString('pt-BR')}.
              O dia volta a contar como útil, o que altera o ritmo diário e a projeção do mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmarExclusao) excluir.mutate(confirmarExclusao.id);
                setConfirmarExclusao(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
