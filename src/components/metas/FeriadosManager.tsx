import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
import { CalendarDays, Plus, Trash2, Loader2, Info, Pencil, X, AlertTriangle } from 'lucide-react';
import {
  useFeriados, useSalvarFeriado, useExcluirFeriado, useColaboradores,
  type Feriado,
} from '@/hooks/useMetasComercial';
import { UFS_BRASIL } from '@/lib/ibge-municipios';
import { atingeAlgumaPraca } from '@/lib/metas/feriados';
import { filtrarColaboradoresDoPainel } from '@/lib/metas/colaboradores';
import { ehFimDeSemana } from '@/lib/metas/dias-uteis';

const NACIONAL = '__nacional__';

type Rascunho = { data: string; descricao: string; uf: string; municipio: string };

const VAZIO: Rascunho = { data: '', descricao: '', uf: NACIONAL, municipio: '' };

const rotuloAbrangencia = (f: Feriado) =>
  !f.uf ? 'Nacional' : f.municipio ? `${f.municipio}/${f.uf}` : `Estadual ${f.uf}`;

/**
 * Abrangência é rótulo, não estado: quem informa é o texto do badge
 * ("Nacional", "Estadual PA", "Belém/PA"). A tinta só separa o nacional — que
 * vale para todo mundo — do recorte regional.
 *
 * `info` (fundo `bg-muted`) × `outline` (sem fundo) porque `info` e `muted`
 * pintam o MESMO fundo: distinguir por elas seria distinguir por nada, e a
 * leitura de relance da coluna se perderia.
 */
const varianteAbrangencia = (f: Feriado): 'info' | 'outline' => (!f.uf ? 'info' : 'outline');

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
   * Só as praças de quem está no painel de metas: feriado só afeta o cálculo
   * de quem tem meta, então listar a praça de um administrativo qualquer daria
   * a impressão errada de que aquela UF importa.
   */
  const doPainel = useMemo(
    () => filtrarColaboradoresDoPainel(colaboradores ?? []),
    [colaboradores],
  );

  /**
   * Praças em uso. A regra do projeto é cadastrar só os feriados das UFs e
   * cidades onde há colaborador — sem isso, o admin não tem como saber quais
   * importam.
   */
  const pracas = useMemo(() => {
    const ufs = new Set<string>();
    const municipios = new Set<string>();
    for (const c of doPainel) {
      if (c.praca_uf) ufs.add(c.praca_uf);
      if (c.praca_uf && c.praca_municipio) municipios.add(`${c.praca_municipio}/${c.praca_uf}`);
    }
    return { ufs: [...ufs].sort(), municipios: [...municipios].sort() };
  }, [doPainel]);

  const ufEscolhida = rascunho.uf === NACIONAL ? '' : rascunho.uf;
  const podeSalvar = rascunho.data !== '' && rascunho.descricao.trim() !== '';

  /** Feriado em fim de semana não muda nada no cálculo — vale avisar. */
  const cairaNoFimDeSemana = rascunho.data !== '' && ehFimDeSemana(rascunho.data);

  /** O feriado em edição não atinge praça nenhuma? Avisa, não bloqueia. */
  const semPracaAtingida =
    ufEscolhida !== '' &&
    !atingeAlgumaPraca(
      { uf: ufEscolhida, municipio: rascunho.municipio.trim() || null },
      doPainel,
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
      {/* O seletor de ano é IRMÃO do título, não filho: CardTitle renderiza um
          <h3>, que não comporta bloco de formulário dentro. */}
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b p-6">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          <CalendarDays aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
          Feriados
          <Badge variant="muted">{feriados?.length ?? 0} em {ano}</Badge>
        </CardTitle>
        <div className="w-full sm:w-32">
          <Label htmlFor="feriados-ano" className="sr-only">Ano dos feriados</Label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger id="feriados-ano" className="font-normal"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-b p-6 pb-0">
          <Alert variant="info">
            <Info aria-hidden="true" className="w-4 h-4" />
            <AlertDescription>
              Feriado desconta um dia útil do mês, o que muda o ritmo diário e a projeção.
              Cadastre apenas os das praças onde há colaborador
              {pracas.ufs.length > 0 && <> — hoje: <strong>{pracas.ufs.join(', ')}</strong></>}
              {pracas.ufs.length === 0 && <> — nenhuma praça definida ainda, então só os nacionais valem</>}.
            </AlertDescription>
          </Alert>

          {/* Formulário */}
          <div className="flex flex-wrap items-end gap-3 py-6">
            <div className="w-full sm:w-44">
              <Label htmlFor="feriado-data" className="mb-1 block text-sm text-muted-foreground">Data</Label>
              <Input
                id="feriado-data"
                type="date"
                value={rascunho.data}
                onChange={(e) => setRascunho((r) => ({ ...r, data: e.target.value }))}
              />
            </div>

            <div className="min-w-[12rem] flex-1">
              <Label htmlFor="feriado-descricao" className="mb-1 block text-sm text-muted-foreground">Descrição</Label>
              <Input
                id="feriado-descricao"
                placeholder="Independência do Brasil"
                value={rascunho.descricao}
                onChange={(e) => setRascunho((r) => ({ ...r, descricao: e.target.value }))}
              />
            </div>

            <div className="w-full sm:w-48">
              <Label htmlFor="feriado-abrangencia" className="mb-1 block text-sm text-muted-foreground">Abrangência</Label>
              <Select
                value={rascunho.uf}
                onValueChange={(v) => setRascunho((r) => ({
                  ...r,
                  uf: v,
                  municipio: v === NACIONAL ? '' : r.municipio,
                }))}
              >
                <SelectTrigger id="feriado-abrangencia"><SelectValue /></SelectTrigger>
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

            <div className="w-full sm:w-48">
              <Label htmlFor="feriado-municipio" className="mb-1 block text-sm text-muted-foreground">
                Município {ufEscolhida === '' && <span className="text-xs">(só com UF)</span>}
              </Label>
              <Input
                id="feriado-municipio"
                placeholder="deixe vazio = estadual"
                disabled={ufEscolhida === ''}
                value={rascunho.municipio}
                onChange={(e) => setRascunho((r) => ({ ...r, municipio: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!podeSalvar || salvar.isPending} onClick={enviar}>
                {salvar.isPending
                  ? <Loader2 aria-hidden="true" className="animate-spin" />
                  : <Plus aria-hidden="true" />}
                {editando ? 'Salvar' : 'Adicionar'}
              </Button>

              {editando && (
                <Button variant="ghost" onClick={limpar}>
                  <X aria-hidden="true" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          {/* Avisos — nenhum bloqueia o cadastro, só informam */}
          {(cairaNoFimDeSemana || semPracaAtingida) && (
            <div className="space-y-2 pb-6">
              {cairaNoFimDeSemana && (
                <Alert variant="info">
                  <Info aria-hidden="true" className="w-4 h-4" />
                  <AlertDescription>
                    Essa data cai em fim de semana — já não era dia útil, então o cálculo não muda.
                  </AlertDescription>
                </Alert>
              )}
              {semPracaAtingida && (
                <Alert variant="warning">
                  <AlertTriangle aria-hidden="true" className="w-4 h-4" />
                  <AlertDescription>
                    Nenhum colaborador tem praça em{' '}
                    <strong>{rascunho.municipio.trim() ? `${rascunho.municipio}/${ufEscolhida}` : ufEscolhida}</strong>.
                    O feriado será salvo, mas não afetará ninguém até alguém receber essa praça.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div role="status" aria-label="Carregando" className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
            Carregando…
          </div>
        ) : (feriados?.length ?? 0) === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<CalendarDays />}
            titulo={`Nenhum feriado em ${ano}`}
            descricao="Sem cadastro, o mês conta todos os dias de segunda a sexta."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-[130px] pl-6">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[190px]">Abrangência</TableHead>
                  <TableHead className="w-[120px] pr-6 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(feriados ?? []).map((f) => {
                  const fds = ehFimDeSemana(f.data);
                  return (
                    <TableRow key={f.id} className={fds ? 'opacity-60' : undefined}>
                      <TableCell className="pl-6 text-sm tabular-nums">
                        {new Date(`${f.data}T12:00:00`).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', weekday: 'short',
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {f.descricao}
                        {fds && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            fim de semana — não afeta o cálculo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={varianteAbrangencia(f)}>
                          {rotuloAbrangencia(f)}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm" variant="ghost"
                            aria-label={`Editar feriado ${f.descricao}`}
                            onClick={() => editar(f)}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Remover feriado ${f.descricao}`}
                            onClick={() => setConfirmarExclusao(f)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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
