import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, ChevronsUpDown, FileText, FolderPlus, Loader2, Trash2, Upload, XCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import { useLicitacaoIntegration, type EditalData } from '@/hooks/useLicitacaoIntegration';
import { enviarAnexoDoProcesso } from '@/lib/processo/anexos';
import { mascaraCNPJ } from '@/lib/financeiro/formatters';
import { UFS_BRASIL } from '@/constants/ufsBrasil';
import {
  ACCEPT_ARQUIVOS, OPCOES_MODALIDADE, OPCOES_SISTEMA, ORDEM_CAMPOS, SISTEMA_OUTRO, TIPOS_ANEXO,
  arquivoAceito, destinoDoTipo, filtrarSistemas, formatarTamanho, formularioVazio,
  montarEditalData, rotuloDoSistema, sugerirTipoDoArquivo, tipoLeEdital, validarPastaManual,
  type CampoPasta, type ErrosPasta, type FormPastaManual, type TipoAnexoPasta,
} from '@/lib/processo/pasta-manual';

/**
 * Nova pasta manual — o processo que o Monitoramento não enxerga.
 *
 * As pastas de Compromissos nascem do Monitoramento de Editais, que lê o PNCP.
 * Dispensas eletrônicas regionais que correm em sistema próprio (o Paradigma
 * do Banpará, no Pará) não passam por lá, e ficavam sem pasta. Aqui a pessoa
 * cria o processo com os dados e os documentos que tem; daí em diante é uma
 * pasta como qualquer outra — extração dos itens, precificação, proposta.
 *
 * Não é o "Novo compromisso" removido antes (`paginas.ts`): aquele criava um
 * compromisso solto, sem processo. Este passa pelo criador canônico
 * (`iniciarProcesso`), com dedup por empresa, operador, trilha e mensagem.
 *
 * A ordem ao salvar importa:
 *   1. processo (sem preparar a pasta — o edital ainda não subiu);
 *   2. compromisso;
 *   3. anexos, um a um;
 *   4. só então a preparação, e só se um Edital ou TR chegou à pasta.
 * Disparar a preparação antes dos anexos faria a IA rodar sobre pasta vazia e
 * gravar "Itens não extraídos".
 *
 * Falha parcial não navega em silêncio: a pasta existe, e o que não foi salvo
 * aparece com a mensagem real e com como tentar de novo.
 */

type SituacaoArquivo = 'pendente' | 'enviando' | 'enviado' | 'falhou';
type ArquivoNaFila = {
  id: string;
  arquivo: File;
  tipo: TipoAnexoPasta;
  situacao: SituacaoArquivo;
  erro?: string;
};
type Fase = 'formulario' | 'salvando' | 'pendencias';

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  /** A pasta entrou em Compromissos — a lista de quem abriu deve recarregar. */
  aoCriar?: (licitacaoId: string) => void;
};

/** Preparação da pasta em segundo plano: quem acompanha é a própria pasta. */
function pedirPreparacao(licitacaoId: string) {
  supabase.functions
    .invoke('processo-auto-prepare', { body: { licitacao_id: licitacaoId } })
    .then(({ error }) => {
      if (error) console.error('[pasta-manual] processo-auto-prepare falhou', error);
    })
    .catch((err) => console.error('[pasta-manual] processo-auto-prepare falhou', err));
}

function Campo({
  id, rotulo, obrigatorio, erro, dica, className, children,
}: {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  dica?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className="text-destructive" aria-hidden="true"> *</span>}
      </Label>
      {children}
      {dica && !erro && <p id={`${id}-dica`} className="g-meta text-muted-foreground">{dica}</p>}
      {erro && <p id={`${id}-erro`} className="g-meta text-destructive">{erro}</p>}
    </div>
  );
}

export default function NovaPastaManualDialog({ aberto, aoFechar, aoCriar }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { iniciarProcesso, criarCompromisso } = useLicitacaoIntegration();
  const base = useId();
  const idDe = (campo: string) => `${base}-${campo}`;

  const [form, setForm] = useState<FormPastaManual>(formularioVazio);
  const [erros, setErros] = useState<ErrosPasta>({});
  const [arquivos, setArquivos] = useState<ArquivoNaFila[]>([]);
  const [recusados, setRecusados] = useState<string[]>([]);
  const [duplicada, setDuplicada] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>('formulario');
  const [etapa, setEtapa] = useState('');
  const [progresso, setProgresso] = useState<{ atual: number; total: number; nome: string } | null>(null);
  const [licitacaoId, setLicitacaoId] = useState<string | null>(null);
  const [compromissoOk, setCompromissoOk] = useState<boolean | null>(null);
  const [sistemaAberto, setSistemaAberto] = useState(false);
  const [buscaSistema, setBuscaSistema] = useState('');
  const preparacaoPedida = useRef(false);
  const sequencia = useRef(0);
  const refs = useRef<Partial<Record<CampoPasta, HTMLElement | null>>>({});
  const inputArquivos = useRef<HTMLInputElement | null>(null);

  const sistemasFiltrados = useMemo(() => filtrarSistemas(buscaSistema), [buscaSistema]);
  const rotuloSistema = rotuloDoSistema(form.sistemaId);
  const temEdital = arquivos.some((a) => tipoLeEdital(a.tipo));
  const salvando = fase === 'salvando';

  const limpar = () => {
    setForm(formularioVazio());
    setErros({});
    setArquivos([]);
    setRecusados([]);
    setDuplicada(null);
    setErroGeral(null);
    setFase('formulario');
    setEtapa('');
    setProgresso(null);
    setLicitacaoId(null);
    setCompromissoOk(null);
    preparacaoPedida.current = false;
  };

  /**
   * Fechar antes de criar guarda o que foi digitado (fechar sem querer não
   * apaga o formulário). Depois que a pasta existe, a próxima abertura começa
   * limpa — reabrir mostrando um processo já criado convidaria a duplicá-lo.
   */
  const fechar = () => {
    if (salvando) return;
    if (licitacaoId) limpar();
    aoFechar();
  };

  const irParaPasta = (id: string) => {
    limpar();
    aoFechar();
    navigate(`/processo/${id}`);
  };

  const mudar = (campo: CampoPasta, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
    if (campo === 'numero' || campo === 'orgao') setDuplicada(null);
  };

  const escolherSistema = (sistemaId: string) => {
    const uf = ufDoSistema(sistemaId);
    setForm((f) => ({ ...f, sistemaId, uf: f.uf || uf }));
    setErros((e) => ({ ...e, sistemaId: undefined, sistemaOutro: undefined }));
    setSistemaAberto(false);
    setBuscaSistema('');
  };

  const adicionarArquivos = (lista: File[]) => {
    setRecusados(lista.filter((f) => !arquivoAceito(f)).map((f) => f.name));
    const novos: ArquivoNaFila[] = lista.filter(arquivoAceito).map((arquivo) => {
      sequencia.current += 1;
      return {
        id: `arquivo-${sequencia.current}`,
        arquivo,
        tipo: sugerirTipoDoArquivo(arquivo.name),
        situacao: 'pendente',
      };
    });
    if (novos.length > 0) setArquivos((atual) => [...atual, ...novos]);
  };

  const concluir = async (id: string, dados: EditalData, fila: ArquivoNaFila[], compromissoJaOk: boolean) => {
    if (!user || !empresaAtiva) return;
    setFase('salvando');

    let compOk = compromissoJaOk;
    if (!compOk) {
      setEtapa('Incluindo a pasta em Compromissos…');
      compOk = !!(await criarCompromisso(dados, id, empresaAtiva.id));
      setCompromissoOk(compOk);
      aoCriar?.(id);
    }

    let atual = fila;
    const pendentes = fila.filter((a) => a.situacao !== 'enviado');
    for (let i = 0; i < pendentes.length; i++) {
      const item = pendentes[i];
      setEtapa('Enviando anexos…');
      setProgresso({ atual: i + 1, total: pendentes.length, nome: item.arquivo.name });
      atual = atual.map((a): ArquivoNaFila => (a.id === item.id ? { ...a, situacao: 'enviando', erro: undefined } : a));
      setArquivos(atual);
      const destino = destinoDoTipo(item.tipo);
      const r = await enviarAnexoDoProcesso({
        licitacaoId: id,
        userId: user.id,
        arquivo: item.arquivo,
        categoria: destino.categoria,
        descricao: destino.descricao,
        metadata: destino.metadata,
      });
      atual = atual.map((a): ArquivoNaFila => (
        a.id === item.id
          ? { ...a, situacao: r.ok ? 'enviado' : 'falhou', erro: r.ok ? undefined : r.erro || 'falha sem mensagem' }
          : a
      ));
      setArquivos(atual);
    }
    setProgresso(null);

    const editalNaPasta = atual.some((a) => a.situacao === 'enviado' && tipoLeEdital(a.tipo));
    if (editalNaPasta && !preparacaoPedida.current) {
      preparacaoPedida.current = true;
      pedirPreparacao(id);
    }

    if (!compOk || atual.some((a) => a.situacao === 'falhou')) {
      setFase('pendencias');
      return;
    }

    toast.success(
      editalNaPasta
        ? 'Pasta criada. A leitura do edital pela IA foi solicitada — acompanhe na pasta.'
        : 'Pasta criada. Anexe o edital na aba Anexos para a IA extrair os itens.',
    );
    irParaPasta(id);
  };

  const salvar = async () => {
    if (fase !== 'formulario') return;
    if (!user || !empresaAtiva) {
      setErroGeral('Selecione uma empresa no topo da tela: o processo é criado na empresa ativa.');
      return;
    }

    const novosErros = validarPastaManual(form);
    setErros(novosErros);
    const primeiro = ORDEM_CAMPOS.find((c) => novosErros[c]);
    if (primeiro) {
      refs.current[primeiro]?.focus();
      return;
    }

    setErroGeral(null);
    setDuplicada(null);
    setFase('salvando');
    const dados = montarEditalData(form);
    let criada: string | null = null;

    try {
      // A mesma regra do iniciarProcesso (número + órgão na empresa), mas
      // perguntada ANTES: lá, a duplicata só gera um aviso e devolve a pasta
      // antiga — e os anexos desta tela iriam parar nela sem ninguém decidir.
      setEtapa('Conferindo se a licitação já está na gestão…');
      const { data: existentes, error: erroBusca } = await supabase
        .from('licitacoes')
        .select('id')
        .eq('empresa_id', empresaAtiva.id)
        .eq('numero', dados.numero)
        .eq('orgao', dados.orgao)
        .limit(1);
      if (erroBusca) {
        setErroGeral(`Não foi possível conferir se a licitação já está na gestão: ${erroBusca.message}. Nada foi criado.`);
        setFase('formulario');
        return;
      }
      if (existentes && existentes.length > 0) {
        setDuplicada(existentes[0].id);
        setFase('formulario');
        return;
      }

      setEtapa('Criando a pasta…');
      let motivo = '';
      criada = await iniciarProcesso(dados, undefined, {
        origem: 'manual',
        prepararAutomaticamente: false,
        aoFalhar: (m) => { motivo = m; },
      });
      if (!criada) {
        setErroGeral(`A pasta não foi criada${motivo ? `: ${motivo}` : '.'} Os dados continuam no formulário.`);
        setFase('formulario');
        return;
      }
      setLicitacaoId(criada);
      await concluir(criada, dados, arquivos, false);
    } catch (err) {
      console.error('[pasta-manual]', err);
      const mensagem = (err as { message?: string } | null)?.message || String(err);
      setErroGeral(criada ? `A pasta foi criada, mas o envio parou: ${mensagem}` : `A pasta não foi criada: ${mensagem}`);
      setProgresso(null);
      setFase(criada ? 'pendencias' : 'formulario');
    }
  };

  const tentarDeNovo = () => {
    if (!licitacaoId) return;
    setErroGeral(null);
    void concluir(licitacaoId, montarEditalData(form), arquivos, compromissoOk === true);
  };

  const ariaCampo = (campo: CampoPasta) => ({
    'aria-invalid': erros[campo] ? true : undefined,
    'aria-describedby': erros[campo] ? `${idDe(campo)}-erro` : undefined,
  });

  const falhas = arquivos.filter((a) => a.situacao === 'falhou');
  const enviados = arquivos.filter((a) => a.situacao === 'enviado');
  const editalFora = falhas.some((a) => tipoLeEdital(a.tipo)) && !enviados.some((a) => tipoLeEdital(a.tipo));

  const painelDeProgresso = salvando && (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <p className="g-corpo flex items-center gap-2 text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        {progresso ? `Enviando anexo ${progresso.atual} de ${progresso.total}: ${progresso.nome}` : etapa}
      </p>
      {progresso && (
        <Progress
          value={((progresso.atual - 1) / progresso.total) * 100}
          aria-label="Progresso do envio dos anexos"
        />
      )}
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" aria-hidden="true" />
            Nova pasta manual
          </DialogTitle>
          <DialogDescription>
            Para processos que não aparecem no Monitoramento — por exemplo, dispensas em sistemas estaduais
            como o Paradigma do Banpará.
          </DialogDescription>
        </DialogHeader>

        {erroGeral && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erroGeral}</AlertDescription>
          </Alert>
        )}

        {licitacaoId ? (
          <div className="flex flex-col gap-4">
            {painelDeProgresso}
            {fase === 'pendencias' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>A pasta foi criada, mas nem tudo foi salvo</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 flex flex-col gap-1">
                    {compromissoOk === false && (
                      <li>
                        <strong>Lista de Compromissos</strong> — a pasta não entrou na lista. Ela já existe no Kanban.
                      </li>
                    )}
                    {falhas.map((a) => (
                      <li key={a.id} className="break-words">
                        <strong>{a.arquivo.name}</strong> — {a.erro}
                      </li>
                    ))}
                  </ul>
                  {editalFora && (
                    <p className="mt-2">
                      Sem o edital na pasta, a extração dos itens por IA não roda. Tente de novo ou anexe depois na
                      aba Anexos da pasta.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {enviados.length > 0 && (
              <p className="g-meta text-muted-foreground">
                {enviados.length === 1 ? '1 arquivo já está na pasta.' : `${enviados.length} arquivos já estão na pasta.`}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => irParaPasta(licitacaoId)} disabled={salvando}>
                Abrir a pasta mesmo assim
              </Button>
              <Button type="button" onClick={tentarDeNovo} disabled={salvando}>
                {salvando && <Loader2 className="animate-spin" aria-hidden="true" />}
                Tentar enviar de novo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(e) => { e.preventDefault(); void salvar(); }}
          >
            {duplicada && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Esta licitação já está na gestão da empresa</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  <span>Já existe uma pasta com este número e órgão. Nenhuma pasta nova foi criada.</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => irParaPasta(duplicada)}>
                    Abrir pasta existente
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <fieldset disabled={salvando} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <legend className="sr-only">Dados do processo</legend>

              <Campo id={idDe('numero')} rotulo="Número do processo" obrigatorio erro={erros.numero}>
                <Input
                  id={idDe('numero')}
                  ref={(el) => { refs.current.numero = el; }}
                  value={form.numero}
                  onChange={(e) => mudar('numero', e.target.value)}
                  placeholder="Ex.: DE 12/2026"
                  aria-required
                  {...ariaCampo('numero')}
                />
              </Campo>

              <Campo id={idDe('modalidade')} rotulo="Modalidade" obrigatorio erro={erros.modalidade}>
                <Select value={form.modalidade} onValueChange={(v) => mudar('modalidade', v)}>
                  <SelectTrigger
                    id={idDe('modalidade')}
                    ref={(el) => { refs.current.modalidade = el; }}
                    aria-required
                    {...ariaCampo('modalidade')}
                  >
                    <SelectValue placeholder="Escolha a modalidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCOES_MODALIDADE.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>

              <Campo id={idDe('orgao')} rotulo="Órgão ou entidade" obrigatorio erro={erros.orgao} className="sm:col-span-2">
                <Input
                  id={idDe('orgao')}
                  ref={(el) => { refs.current.orgao = el; }}
                  value={form.orgao}
                  onChange={(e) => mudar('orgao', e.target.value)}
                  placeholder="Ex.: Secretaria de Estado de Saúde Pública do Pará"
                  aria-required
                  {...ariaCampo('orgao')}
                />
              </Campo>

              <Campo id={idDe('cnpj')} rotulo="CNPJ do órgão" erro={erros.cnpj} dica="Opcional.">
                <Input
                  id={idDe('cnpj')}
                  ref={(el) => { refs.current.cnpj = el; }}
                  value={form.cnpj}
                  onChange={(e) => mudar('cnpj', mascaraCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  {...ariaCampo('cnpj')}
                />
              </Campo>

              <Campo id={idDe('sistemaId')} rotulo="Sistema de origem" obrigatorio erro={erros.sistemaId}>
                <Popover open={sistemaAberto} onOpenChange={setSistemaAberto}>
                  <PopoverTrigger asChild>
                    <Button
                      id={idDe('sistemaId')}
                      ref={(el) => { refs.current.sistemaId = el; }}
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={sistemaAberto}
                      aria-required
                      {...ariaCampo('sistemaId')}
                      className="w-full justify-between font-normal"
                    >
                      <span className={cn('truncate', !rotuloSistema && 'text-muted-foreground')}>
                        {rotuloSistema ?? 'Escolha o sistema'}
                      </span>
                      <ChevronsUpDown className="opacity-50" aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] min-w-[16rem] max-w-[calc(100vw-2rem)] p-0"
                    align="start"
                    collisionPadding={12}
                    // Dentro do Dialog, a roda do mouse escaparia para a moldura.
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {/* `label` e não só `aria-label` no campo: o cmdk liga o campo ao
                        próprio rótulo por aria-labelledby, que vence o aria-label —
                        sem isto, a busca chegava sem nome ao leitor de tela. */}
                    <Command shouldFilter={false} label="Buscar sistema de origem">
                      <CommandInput
                        placeholder="Buscar por sistema, estado ou plataforma…"
                        aria-label="Buscar sistema de origem"
                        value={buscaSistema}
                        onValueChange={setBuscaSistema}
                      />
                      <CommandList className="max-h-[min(42vh,300px)] overscroll-contain">
                        {sistemasFiltrados.length > 0 && (
                          <CommandGroup>
                            {sistemasFiltrados.map((o) => (
                              <CommandItem
                                key={o.id}
                                value={o.id}
                                onSelect={() => escolherSistema(o.id)}
                                className="gap-2"
                              >
                                <Check
                                  className={cn('h-4 w-4 shrink-0', form.sistemaId === o.id ? 'opacity-100' : 'opacity-0')}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 flex-1">{o.rotulo}</span>
                                {o.uf && <span className="g-meta text-muted-foreground">{o.uf}</span>}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {sistemasFiltrados.length === 0 && (
                          <p className="g-meta px-3 py-3 text-muted-foreground">
                            Nenhum sistema com esse nome no catálogo. Use “Outro”.
                          </p>
                        )}
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem value={SISTEMA_OUTRO} onSelect={() => escolherSistema(SISTEMA_OUTRO)} className="gap-2">
                            <Check
                              className={cn('h-4 w-4 shrink-0', form.sistemaId === SISTEMA_OUTRO ? 'opacity-100' : 'opacity-0')}
                              aria-hidden="true"
                            />
                            Outro (digitar o nome)
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Campo>

              {form.sistemaId === SISTEMA_OUTRO && (
                <Campo id={idDe('sistemaOutro')} rotulo="Nome do sistema" obrigatorio erro={erros.sistemaOutro} className="sm:col-span-2">
                  <Input
                    id={idDe('sistemaOutro')}
                    ref={(el) => { refs.current.sistemaOutro = el; }}
                    value={form.sistemaOutro}
                    onChange={(e) => mudar('sistemaOutro', e.target.value)}
                    placeholder="Como o sistema se chama"
                    aria-required
                    {...ariaCampo('sistemaOutro')}
                  />
                </Campo>
              )}

              <Campo id={idDe('objeto')} rotulo="Objeto" obrigatorio erro={erros.objeto} className="sm:col-span-2">
                <Textarea
                  id={idDe('objeto')}
                  ref={(el) => { refs.current.objeto = el; }}
                  value={form.objeto}
                  onChange={(e) => mudar('objeto', e.target.value)}
                  placeholder="O que está sendo contratado"
                  className="min-h-20"
                  aria-required
                  {...ariaCampo('objeto')}
                />
              </Campo>

              <Campo
                id={idDe('url')}
                rotulo="Link do processo no sistema de origem"
                erro={erros.url}
                dica="Opcional."
                className="sm:col-span-2"
              >
                <Input
                  id={idDe('url')}
                  ref={(el) => { refs.current.url = el; }}
                  value={form.url}
                  onChange={(e) => mudar('url', e.target.value)}
                  placeholder="https://cotacao.banpara.b.br/…"
                  inputMode="url"
                  {...ariaCampo('url')}
                />
              </Campo>

              <Campo id={idDe('uf')} rotulo="UF" erro={erros.uf}>
                <Select value={form.uf} onValueChange={(v) => mudar('uf', v === '__sem_uf' ? '' : v)}>
                  <SelectTrigger id={idDe('uf')} ref={(el) => { refs.current.uf = el; }} {...ariaCampo('uf')}>
                    <SelectValue placeholder="Não informada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sem_uf">Não informar</SelectItem>
                    {UFS_BRASIL.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>

              <Campo id={idDe('municipio')} rotulo="Município" erro={erros.municipio}>
                <Input
                  id={idDe('municipio')}
                  ref={(el) => { refs.current.municipio = el; }}
                  value={form.municipio}
                  onChange={(e) => mudar('municipio', e.target.value)}
                  placeholder="Ex.: Belém"
                  {...ariaCampo('municipio')}
                />
              </Campo>

              <Campo id={idDe('dataAbertura')} rotulo="Data e hora da sessão" erro={erros.dataAbertura}>
                <Input
                  id={idDe('dataAbertura')}
                  ref={(el) => { refs.current.dataAbertura = el; }}
                  type="datetime-local"
                  value={form.dataAbertura}
                  onChange={(e) => mudar('dataAbertura', e.target.value)}
                  {...ariaCampo('dataAbertura')}
                />
              </Campo>

              <Campo
                id={idDe('dataEncerramento')}
                rotulo="Prazo de envio da proposta"
                erro={erros.dataEncerramento}
                dica="É o prazo que gera os alertas do compromisso."
              >
                <Input
                  id={idDe('dataEncerramento')}
                  ref={(el) => { refs.current.dataEncerramento = el; }}
                  type="datetime-local"
                  value={form.dataEncerramento}
                  onChange={(e) => mudar('dataEncerramento', e.target.value)}
                  {...ariaCampo('dataEncerramento')}
                />
              </Campo>

              <Campo id={idDe('valor')} rotulo="Valor estimado" erro={erros.valor} dica="Opcional. Ex.: 12.500,00">
                <Input
                  id={idDe('valor')}
                  ref={(el) => { refs.current.valor = el; }}
                  value={form.valor}
                  onChange={(e) => mudar('valor', e.target.value)}
                  placeholder="R$"
                  inputMode="decimal"
                  {...ariaCampo('valor')}
                />
              </Campo>
            </fieldset>

            <fieldset disabled={salvando} className="flex min-w-0 flex-col gap-3">
              <legend className="g-corpo mb-1 font-medium text-foreground">Edital e documentos</legend>

              <div
                className="flex flex-col items-center gap-2 rounded-[var(--g-raio)] border border-dashed border-border bg-muted/40 px-4 py-5 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!salvando) adicionarArquivos(Array.from(e.dataTransfer.files ?? []));
                }}
              >
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="g-corpo text-muted-foreground">Arraste os arquivos para cá ou</p>
                <Button type="button" variant="outline" size="sm" onClick={() => inputArquivos.current?.click()}>
                  Escolher arquivos
                </Button>
                <input
                  ref={inputArquivos}
                  type="file"
                  multiple
                  accept={ACCEPT_ARQUIVOS}
                  className="sr-only"
                  aria-label="Anexar arquivos"
                  tabIndex={-1}
                  onChange={(e) => {
                    const lista = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    adicionarArquivos(lista);
                  }}
                />
                <p className="g-meta text-muted-foreground">PDF, DOC/DOCX, XLS/XLSX, ZIP ou imagens.</p>
              </div>

              {recusados.length > 0 && (
                <p className="g-meta text-destructive" role="alert">
                  Não anexado (formato não aceito): {recusados.join(', ')}
                </p>
              )}

              {arquivos.length > 0 && (
                <ul className="flex flex-col gap-2" aria-label="Arquivos a anexar">
                  {arquivos.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-col gap-2 rounded-[var(--g-raio)] border border-border p-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="g-corpo truncate font-medium text-foreground" title={a.arquivo.name}>
                            {a.arquivo.name}
                          </p>
                          <p className="g-meta tabular-nums text-muted-foreground">{formatarTamanho(a.arquivo.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={a.tipo}
                          onValueChange={(v) =>
                            setArquivos((lista) => lista.map((x) => (x.id === a.id ? { ...x, tipo: v as TipoAnexoPasta } : x)))
                          }
                        >
                          <SelectTrigger className="w-full sm:w-52" aria-label={`Tipo do arquivo ${a.arquivo.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_ANEXO.map((t) => (
                              <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
                          onClick={() => setArquivos((lista) => lista.filter((x) => x.id !== a.id))}
                          aria-label={`Remover ${a.arquivo.name}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!temEdital && (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Nenhum Edital ou Termo de Referência anexado. Dá para criar a pasta assim, mas a extração dos
                    itens por IA só roda depois que o edital for anexado (na aba Anexos da pasta).
                  </AlertDescription>
                </Alert>
              )}
            </fieldset>

            {painelDeProgresso}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={fechar} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FolderPlus aria-hidden="true" />}
                Criar pasta
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A UF que o catálogo associa ao sistema — só preenche UF vazia. */
function ufDoSistema(sistemaId: string): string {
  return OPCOES_SISTEMA.find((o) => o.id === sistemaId)?.uf ?? '';
}

/**
 * O botão que abre a pasta manual, com a regra de quem pode.
 *
 * O processo é da empresa (`licitacoes.empresa_id` é obrigatório) e criar
 * processo é operar: admin e operador criam; quem só acompanha (viewer) vê o
 * botão desabilitado e o motivo — ausência sem explicação é indistinguível de
 * defeito, a mesma regra do Robô de Lances.
 */
export function BotaoNovaPastaManual({
  aoAbrir,
  rotulo = 'Nova pasta',
  variant = 'outline',
  size,
}: {
  aoAbrir: () => void;
  rotulo?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}) {
  const { empresaAtiva } = useEmpresa();
  const { podeOperar } = usePapelEmpresa();
  const idMotivo = useId();

  const motivo = !empresaAtiva
    ? 'Selecione uma empresa para criar a pasta: o processo é da empresa.'
    : !podeOperar
      ? 'Você acompanha em modo leitura. Para criar pastas, peça o papel de operador em Equipe → Permissões.'
      : null;

  if (motivo) {
    return (
      <span className="inline-flex" title={motivo}>
        <Button type="button" variant={variant} size={size} disabled aria-describedby={idMotivo}>
          <FolderPlus aria-hidden="true" /> {rotulo}
        </Button>
        <span id={idMotivo} className="sr-only">{motivo}</span>
      </span>
    );
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={aoAbrir}>
      <FolderPlus aria-hidden="true" /> {rotulo}
    </Button>
  );
}
