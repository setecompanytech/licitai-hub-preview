import { useMemo, useState, type ElementType } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Ban, CheckCircle2, Info, Megaphone, OctagonAlert, Pencil, Plus, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import SeloSituacao, { AvisoDeFalha, type TomSituacao } from '@/components/gestao/SeloSituacao';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { dataHoraDeBrasilia } from '@/components/workspace/precificacao/formato';
import { PORTAIS_ROBO } from '@/lib/robo/portais';
import AvisoAoCliente from './AvisoAoCliente';
import MigracaoPendente from './MigracaoPendente';
import { ehMigracaoPendente, mensagemDoErro, useLeituraDaPlataforma } from './leitura';
import {
  ROTULO_DA_SEVERIDADE,
  ROTULO_DA_SITUACAO,
  SEVERIDADES,
  TODOS_OS_PORTAIS,
  nomeDoPortalDoAviso,
  ordenarAvisos,
  payloadDoAviso,
  rascunhoDoAviso,
  rascunhoNovo,
  situacaoDoAviso,
  validarAviso,
  type AvisoComSituacao,
  type AvisoDoPortal,
  type RascunhoDoAviso,
  type SeveridadeDoAviso,
  type SituacaoDoAviso,
} from './avisos';

/**
 * Avisos da Praefectus aos clientes do Robô de Lances.
 *
 * Existe porque, até 14/09/2026, o cliente descobria instabilidade de portal
 * lendo o erro técnico cru da própria sessão ("Signal timed out."). Agora o
 * erro completo fica no Diagnóstico, e o que chega ao cliente é uma frase
 * escrita por gente: o que está acontecendo, o que continua funcionando e o
 * que fazer.
 *
 * As regras (situação, validação, payload, horário de Brasília) moram em
 * `avisos.ts`; aqui só a tela.
 */

// `types.ts` é anterior a 14/09 e não conhece `robo_avisos_portal`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabelaDeAvisos = (): any => (supabase as any).from('robo_avisos_portal');

/** Função de módulo: identidade estável para o efeito de leitura. */
const lerAvisos = () =>
  tabelaDeAvisos().select('*').order('inicio_em', { ascending: false }).limit(200);

const SEM_AVISOS: AvisoDoPortal[] = [];

const APARENCIA_DA_SITUACAO: Record<
  SituacaoDoAviso,
  { tom: TomSituacao; icone?: ElementType; explicacao: string }
> = {
  vigente: { tom: 'sucesso', explicacao: 'Ativo e dentro do período: o cliente está lendo agora' },
  agendado: { tom: 'atencao', explicacao: 'Ativo, mas o início ainda não chegou' },
  encerrado: { tom: 'neutro', icone: CheckCircle2, explicacao: 'O fim já passou: o cliente não lê mais' },
  inativo: { tom: 'neutro', icone: Ban, explicacao: 'Desativado: não aparece ao cliente, seja qual for o período' },
};

const APARENCIA_DA_SEVERIDADE: Record<SeveridadeDoAviso, { tom: TomSituacao; icone: ElementType }> = {
  informativo: { tom: 'neutro', icone: Info },
  atencao: { tom: 'atencao', icone: AlertTriangle },
  critico: { tom: 'critico', icone: OctagonAlert },
};

const AO_SALVAR: Record<SituacaoDoAviso, string> = {
  vigente: 'Aviso no ar para os clientes.',
  agendado: 'Aviso agendado.',
  encerrado: 'Aviso salvo, mas o período já terminou: o cliente não vai lê-lo.',
  inativo: 'Aviso salvo desativado: o cliente não vai lê-lo.',
};

function periodoDoAviso(aviso: AvisoDoPortal): string {
  const inicio = dataHoraDeBrasilia(aviso.inicio_em);
  return aviso.fim_em
    ? `${inicio} até ${dataHoraDeBrasilia(aviso.fim_em)}`
    : `Desde ${inicio}, sem fim marcado`;
}

function ErroDoCampo({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p id={id} className="g-meta font-medium text-destructive-ink">
      {texto}
    </p>
  );
}

export default function GestorDeAvisos() {
  const leitura = useLeituraDaPlataforma<AvisoDoPortal[]>(lerAvisos);
  const { recarregar } = leitura;

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<AvisoDoPortal | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoDoAviso>(() => rascunhoNovo());
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [desativando, setDesativando] = useState<string | null>(null);

  const avisos = leitura.dados ?? SEM_AVISOS;
  const linhas = useMemo(() => ordenarAvisos(avisos), [avisos]);
  const migracaoPendente = leitura.estado === 'migracao_pendente';

  // Erro só aparece depois da primeira tentativa de salvar — campo vermelho
  // antes de a pessoa digitar é bronca, não ajuda. Depois, acompanha a digitação.
  const erros = tentouSalvar ? validarAviso(rascunho) : {};

  const alterar = <K extends keyof RascunhoDoAviso>(campo: K, valor: RascunhoDoAviso[K]) =>
    setRascunho((r) => ({ ...r, [campo]: valor }));

  const abrirNovo = () => {
    setEditando(null);
    setRascunho(rascunhoNovo());
    setTentouSalvar(false);
    setAberto(true);
  };

  const abrirEdicao = (aviso: AvisoDoPortal) => {
    setEditando(aviso);
    setRascunho(rascunhoDoAviso(aviso));
    setTentouSalvar(false);
    setAberto(true);
  };

  const fechar = () => {
    if (!salvando) setAberto(false);
  };

  const salvar = async () => {
    setTentouSalvar(true);
    if (Object.keys(validarAviso(rascunho)).length > 0) return;

    const payload = payloadDoAviso(rascunho);
    setSalvando(true);
    try {
      const { error } = editando
        ? await tabelaDeAvisos().update(payload).eq('id', editando.id)
        : await tabelaDeAvisos().insert(payload);
      if (error) throw error;
    } catch (e) {
      setSalvando(false);
      if (ehMigracaoPendente(e)) {
        toast.error('Migração pendente: a tabela de avisos ainda não existe neste banco.');
        setAberto(false);
        recarregar();
        return;
      }
      // Mensagem real do banco, e o formulário continua aberto com o que foi digitado.
      toast.error(`Não foi possível salvar o aviso: ${mensagemDoErro(e)}`);
      return;
    }
    setSalvando(false);
    setAberto(false);
    toast.success(AO_SALVAR[situacaoDoAviso(payload)]);
    recarregar();
  };

  const desativar = async (aviso: AvisoDoPortal) => {
    setDesativando(aviso.id);
    try {
      const { error } = await tabelaDeAvisos().update({ ativo: false }).eq('id', aviso.id);
      if (error) throw error;
      toast.success('Aviso desativado: sai da tela do cliente na próxima leitura.');
      recarregar();
    } catch (e) {
      toast.error(`Não foi possível desativar o aviso: ${mensagemDoErro(e)}`);
    } finally {
      setDesativando(null);
    }
  };

  const colunas: ColunaGestao<AvisoComSituacao>[] = [
    {
      chave: 'situacao',
      titulo: 'Situação',
      prioridade: 'sempre',
      render: ({ situacao }) => {
        const ap = APARENCIA_DA_SITUACAO[situacao];
        return (
          <SeloSituacao tom={ap.tom} icone={ap.icone} explicacao={ap.explicacao}>
            {ROTULO_DA_SITUACAO[situacao]}
          </SeloSituacao>
        );
      },
    },
    {
      chave: 'aviso',
      titulo: 'Aviso',
      prioridade: 'sempre',
      render: ({ aviso }) => (
        <div className="flex min-w-0 max-w-[32rem] flex-col gap-0.5">
          <span className="font-semibold">{aviso.titulo}</span>
          <span className="line-clamp-2 text-muted-foreground">{aviso.mensagem}</span>
        </div>
      ),
    },
    {
      chave: 'portal',
      titulo: 'Portal',
      prioridade: 'sempre',
      render: ({ aviso }) => nomeDoPortalDoAviso(aviso.portal_id),
    },
    {
      chave: 'severidade',
      titulo: 'Severidade',
      prioridade: 'desktop',
      render: ({ aviso }) => {
        const ap = APARENCIA_DA_SEVERIDADE[aviso.severidade] ?? APARENCIA_DA_SEVERIDADE.atencao;
        return (
          <SeloSituacao tom={ap.tom} icone={ap.icone}>
            {ROTULO_DA_SEVERIDADE[aviso.severidade] ?? aviso.severidade}
          </SeloSituacao>
        );
      },
    },
    {
      chave: 'periodo',
      titulo: 'Período (Brasília)',
      tituloCurto: 'Período',
      prioridade: 'desktop',
      render: ({ aviso }) => <span className="whitespace-nowrap">{periodoDoAviso(aviso)}</span>,
    },
    {
      chave: 'acoes',
      titulo: <span className="sr-only">Ações</span>,
      tituloCurto: 'Ações',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: ({ aviso }) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => abrirEdicao(aviso)}
            aria-label={`Editar aviso "${aviso.titulo}"`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
          </Button>
          {aviso.ativo && (
            <Button
              variant="outline"
              size="sm"
              disabled={desativando === aviso.id}
              onClick={() => void desativar(aviso)}
              aria-label={`Desativar aviso "${aviso.titulo}"`}
            >
              <Ban className="h-4 w-4" aria-hidden="true" /> Desativar
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Portal gravado que saiu da lista de portais continua editável, com o id à mostra.
  const portalForaDaLista =
    rascunho.portal !== TODOS_OS_PORTAIS && !PORTAIS_ROBO.some((p) => p.id === rascunho.portal);

  return (
    <SecaoGestao
      titulo="Avisos aos clientes"
      contagem={leitura.estado === 'pronta' ? avisos.length : undefined}
      acoes={
        <>
          <Button variant="outline" size="sm" onClick={recarregar} disabled={leitura.estado === 'carregando'}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
          </Button>
          <Button size="sm" onClick={abrirNovo} disabled={migracaoPendente}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Novo aviso
          </Button>
        </>
      }
    >
      <p className="g-corpo text-muted-foreground">
        O cliente lê o aviso na tela do Robô de Lances enquanto ele estiver vigente. Use para
        instabilidade de portal, manutenção e qualquer mudança que afete a disputa — no lugar do erro
        técnico, que fica só no Diagnóstico.
      </p>

      {migracaoPendente ? (
        <MigracaoPendente assunto="A tabela de avisos (robo_avisos_portal)" detalhe={leitura.erro} />
      ) : leitura.estado === 'erro' ? (
        <AvisoDeFalha aoTentarNovamente={recarregar}>
          Não foi possível carregar os avisos: {leitura.erro}
        </AvisoDeFalha>
      ) : (
        <TabelaGestao
          colunas={colunas}
          itens={linhas}
          chaveDoItem={({ aviso }) => aviso.id}
          carregando={leitura.estado === 'carregando'}
          descricao="Avisos da operação aos clientes do Robô de Lances"
          vazio={
            <EstadoVazio
              tamanho="compacto"
              icone={<Megaphone />}
              titulo="Nenhum aviso publicado"
              descricao="Quando um portal ficar instável, publique aqui o que o cliente precisa saber."
            />
          }
        />
      )}

      <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar aviso' : 'Novo aviso aos clientes'}</DialogTitle>
            <DialogDescription>
              Aparece na tela do Robô de Lances de toda empresa que usa o portal escolhido, dentro do
              período.
            </DialogDescription>
          </DialogHeader>

          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void salvar();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="aviso-portal">Portal</Label>
                <Select value={rascunho.portal} onValueChange={(v) => alterar('portal', v)}>
                  <SelectTrigger id="aviso-portal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS_OS_PORTAIS}>Todos os portais</SelectItem>
                    {portalForaDaLista && (
                      <SelectItem value={rascunho.portal}>{rascunho.portal} (fora da lista)</SelectItem>
                    )}
                    {PORTAIS_ROBO.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="aviso-severidade">Severidade</Label>
                <Select
                  value={rascunho.severidade}
                  onValueChange={(v) => alterar('severidade', v as SeveridadeDoAviso)}
                >
                  <SelectTrigger id="aviso-severidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERIDADES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ROTULO_DA_SEVERIDADE[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="aviso-titulo">Título</Label>
              <Input
                id="aviso-titulo"
                value={rascunho.titulo}
                maxLength={120}
                placeholder="Ex.: Instabilidade no Compras.gov.br"
                onChange={(e) => alterar('titulo', e.target.value)}
                aria-invalid={erros.titulo ? true : undefined}
                aria-describedby={erros.titulo ? 'aviso-titulo-erro' : undefined}
              />
              <ErroDoCampo id="aviso-titulo-erro" texto={erros.titulo} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="aviso-mensagem">Mensagem</Label>
              <Textarea
                id="aviso-mensagem"
                rows={4}
                maxLength={600}
                value={rascunho.mensagem}
                onChange={(e) => alterar('mensagem', e.target.value)}
                aria-invalid={erros.mensagem ? true : undefined}
                aria-describedby={
                  erros.mensagem ? 'aviso-mensagem-orientacao aviso-mensagem-erro' : 'aviso-mensagem-orientacao'
                }
              />
              <p id="aviso-mensagem-orientacao" className="g-meta text-muted-foreground">
                Escreva para o cliente: o que acontece, o que continua funcionando, o que fazer. Nada de
                erro técnico.
              </p>
              <ErroDoCampo id="aviso-mensagem-erro" texto={erros.mensagem} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <Label htmlFor="aviso-inicio">Início (horário de Brasília)</Label>
                <Input
                  id="aviso-inicio"
                  type="datetime-local"
                  value={rascunho.inicio}
                  onChange={(e) => alterar('inicio', e.target.value)}
                  aria-invalid={erros.inicio ? true : undefined}
                  aria-describedby={erros.inicio ? 'aviso-inicio-erro' : undefined}
                />
                <ErroDoCampo id="aviso-inicio-erro" texto={erros.inicio} />
              </div>
              <div className="grid content-start gap-1.5">
                <Label htmlFor="aviso-fim">Fim (opcional)</Label>
                <Input
                  id="aviso-fim"
                  type="datetime-local"
                  value={rascunho.fim}
                  onChange={(e) => alterar('fim', e.target.value)}
                  aria-invalid={erros.fim ? true : undefined}
                  aria-describedby={erros.fim ? 'aviso-fim-dica aviso-fim-erro' : 'aviso-fim-dica'}
                />
                <p id="aviso-fim-dica" className="g-meta text-muted-foreground">
                  Em branco, fica no ar até ser desativado.
                </p>
                <ErroDoCampo id="aviso-fim-erro" texto={erros.fim} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="aviso-ativo"
                checked={rascunho.ativo}
                onCheckedChange={(v) => alterar('ativo', v)}
              />
              <Label htmlFor="aviso-ativo">Aviso ativo</Label>
            </div>

            <div className="grid gap-2">
              <p className="g-meta font-semibold uppercase tracking-wide text-muted-foreground">
                Como o cliente vai ler
              </p>
              <AvisoAoCliente
                previa
                severidade={rascunho.severidade}
                titulo={rascunho.titulo}
                mensagem={rascunho.mensagem}
                portalId={rascunho.portal === TODOS_OS_PORTAIS ? null : rascunho.portal}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={fechar} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar aviso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SecaoGestao>
  );
}
