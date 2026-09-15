import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useProcessoWorkspace, type CategoriaAnexo, type ProcessoAnexo } from '@/hooks/useProcessoWorkspace';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Upload, Download, Trash2, FileText, Folder, Search, Eye, ExternalLink, Loader2, ArrowRight, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ARTIGO_POR_GRUPO, LABEL_SEGMENTO, classificarTipo } from '@/lib/habilitacao/tipos';
import { ROTULO_TIPO_EDITAL, avisarAnexosAlterados, tipoPeloNome, type TipoDocumentoEdital } from '@/lib/processo/edital-anexado';

/** Estrutura da pasta Habilitação — mesma ordem e rótulos do Jurídico → Documentos. */
const GRUPOS_HABILITACAO: { key: string; label: string }[] = [
  { key: 'juridica', label: 'Habilitação Jurídica' },
  { key: 'fiscal', label: 'Regularidade Fiscal, Social e Trabalhista' },
  { key: 'economica', label: 'Qualificação Econômico-Financeira' },
  { key: 'tecnica', label: 'Qualificação Técnica' },
  { key: 'declaracoes', label: 'Declarações' },
  { key: 'outros', label: 'Outros' },
];

/** Pastas cujo conteúdo nasce em uma aba do processo — a vazia leva até lá. */
const ORIGEM_DA_PASTA: Record<string, { texto: string; aba: string; botao: string }> = {
  proposta: {
    texto: 'A proposta comercial é montada na aba Proposta e arquivada aqui com "Salvar na pasta Proposta".',
    aba: 'proposta',
    botao: 'Ir para a aba Proposta',
  },
  recursos: {
    texto: 'Recursos, impugnações e esclarecimentos são redigidos no Apoio Jurídico ("Abrir nos módulos", na Visão geral) e arquivados aqui.',
    aba: 'visao',
    botao: 'Ir para a Visão geral → Apoio Jurídico',
  },
  declaracoes: {
    texto: 'As declarações são geradas no Apoio Jurídico ("Abrir nos módulos", na Visão geral) e arquivadas aqui.',
    aba: 'visao',
    botao: 'Ir para a Visão geral → Apoio Jurídico',
  },
  habilitacao: {
    texto: 'O checklist da aba Habilitação monta esta pasta com os documentos do cofre.',
    aba: 'habilitacao',
    botao: 'Ir para o checklist de habilitação',
  },
};

const grupoDoAnexo = (a: ProcessoAnexo): string => {
  const g = (a.metadata as { grupo?: string } | null)?.grupo;
  return g && GRUPOS_HABILITACAO.some((x) => x.key === g) ? g : 'outros';
};

const CATEGORIAS: { value: CategoriaAnexo; label: string }[] = [
  { value: 'edital', label: 'Edital' },
  { value: 'habilitacao', label: 'Habilitação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'declaracoes', label: 'Declarações' },
  { value: 'recursos', label: 'Recursos' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'outros', label: 'Outros' },
];

function formatBytes(b: number | null) {
  if (!b) return '-';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnexosManager({ licitacaoId, editalViewer, pncpEditalCount }: { licitacaoId: string; editalViewer?: ReactNode; pncpEditalCount?: number }) {
  const { anexos, loading, uploadAnexo, downloadAnexo, urlVisualizacao, deleteAnexo } = useProcessoWorkspace(licitacaoId);
  // Visualização em tela: o usuário conferia o documento só baixando — agora
  // abre no próprio sistema, sem sair do processo.
  const [visualizando, setVisualizando] = useState<{ anexo: ProcessoAnexo; url: string } | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const abrirVisualizacao = async (anexo: ProcessoAnexo) => {
    setAbrindo(anexo.id);
    const url = await urlVisualizacao(anexo);
    setAbrindo(null);
    if (url) setVisualizando({ anexo, url });
  };
  const fileRef = useRef<HTMLInputElement>(null);
  // Processo sem PNCP e sem edital anexado: a primeira coisa que a pasta
  // precisa é o edital, então o envio já nasce apontado para ele. A escolha
  // explícita da pessoa (ou a pasta do último envio) prevalece.
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<CategoriaAnexo | null>(null);
  const temAnexoEdital = anexos.some((a) => a.categoria === 'edital');
  const semPncp = !((pncpEditalCount ?? 0) > 0);
  const categoria: CategoriaAnexo = categoriaEscolhida ?? (!loading && semPncp && !temAnexoEdital ? 'edital' : 'outros');
  const setCategoria = (c: CategoriaAnexo) => setCategoriaEscolhida(c);
  // Arquivos da pasta Edital aguardando a pessoa dizer o tipo de cada um.
  const [pendentesEdital, setPendentesEdital] = useState<{ file: File; tipo: TipoDocumentoEdital }[] | null>(null);
  // Upload para Habilitação pergunta o grupo da Lei; 'auto' classifica pelo
  // nome do arquivo com a mesma taxonomia do checklist.
  const [grupoHab, setGrupoHab] = useState<string>('auto');
  // Grupos da Lei recolhíveis: clique no cabeçalho abre/fecha. Todos nascem
  // abertos — recolher é gesto de quem quer varrer a lista, não o padrão.
  const [gruposFechados, setGruposFechados] = useState<Set<string>>(new Set());
  const alternarGrupo = (key: string) => {
    setGruposFechados((atual) => {
      const novo = new Set(atual);
      if (novo.has(key)) novo.delete(key); else novo.add(key);
      return novo;
    });
  };
  // editalViewer: o "Edital em tela" (arquivos materializados do PNCP) mora na
  // pasta Edital desta aba — antes vivia solto na Visão Geral, criando dois
  // mundos de arquivo (a pasta dizia "0 arquivos" com o edital renderizando
  // em outra aba).
  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [searchParams, setSearchParams] = useSearchParams();
  const raizRef = useRef<HTMLDivElement>(null);
  // `?pasta=edital`: o card da preparação manda para cá quando falta o edital.
  const pastaDaUrl = searchParams.get('pasta');
  useEffect(() => {
    if (!pastaDaUrl) return;
    const pasta = CATEGORIAS.find((c) => c.value === pastaDaUrl)?.value;
    if (pasta) {
      setFiltroCat(pasta);
      setCategoriaEscolhida(pasta);
      raizRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('pasta');
      return next;
    }, { replace: true });
  }, [pastaDaUrl, setSearchParams]);
  const [busca, setBusca] = useState('');
  const [uploading, setUploading] = useState(false);

  /** Envia na pasta indicada e fixa essa pasta: enviar o primeiro edital não
   *  pode trocar a pasta padrão debaixo da pessoa no meio do trabalho. */
  const enviarArquivos = async (itens: { file: File; metadata?: Record<string, unknown> }[], cat: CategoriaAnexo) => {
    setUploading(true);
    try {
      for (const { file, metadata } of itens) await uploadAnexo(file, cat, undefined, metadata);
    } finally {
      setUploading(false);
    }
    setCategoriaEscolhida(cat);
    avisarAnexosAlterados(licitacaoId);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    if (categoria === 'edital') {
      // A pasta Edital pergunta o tipo: é ele que põe o edital antes do TR e
      // dos anexos na leitura do checklist, da proposta e do robô.
      setPendentesEdital(files.map((file, i) => ({
        file,
        tipo: tipoPeloNome(file.name) ?? (!temAnexoEdital && i === 0 ? 'edital' : 'anexo_edital'),
      })));
      return;
    }
    await enviarArquivos(files.map((f) => {
      if (categoria !== 'habilitacao') return { file: f };
      const taxo = classificarTipo(f.name);
      const grupo = grupoHab === 'auto' ? (taxo?.grupo ?? 'outros') : grupoHab;
      return { file: f, metadata: { grupo, tipo: taxo?.id ?? null } };
    }), categoria);
  };

  const confirmarEdital = async () => {
    if (!pendentesEdital) return;
    const itens = pendentesEdital.map(({ file, tipo }) => ({ file, metadata: { tipo } }));
    setPendentesEdital(null);
    await enviarArquivos(itens, 'edital');
  };

  const filtrados = anexos.filter(a =>
    (filtroCat === 'todas' || a.categoria === filtroCat) &&
    (!busca || a.nome_arquivo.toLowerCase().includes(busca.toLowerCase()))
  );

  const grupos = CATEGORIAS.map(c => ({ ...c, count: anexos.filter(a => a.categoria === c.value).length }));

  const classeTile = (ativo: boolean) =>
    `h-auto flex-col items-start justify-start gap-1 whitespace-normal p-3 text-left ${ativo ? 'border-primary bg-primary-tint' : ''}`;

  const renderAnexo = (a: ProcessoAnexo) => {
    const cat = CATEGORIAS.find(c => c.value === a.categoria);
    const meta = a.metadata as { segmento?: string | null; tipo?: string | null } | null;
    return (
      <div key={a.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
        <FileText className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{a.nome_arquivo}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="muted">{cat?.label}</Badge>
            {meta?.tipo === 'atestado_tecnico' && meta?.segmento && (
              <Badge variant="outline">{LABEL_SEGMENTO[meta.segmento] || meta.segmento}</Badge>
            )}
            {a.categoria === 'edital' && meta?.tipo && meta.tipo in ROTULO_TIPO_EDITAL && (
              <Badge variant="outline">{ROTULO_TIPO_EDITAL[meta.tipo as TipoDocumentoEdital]}</Badge>
            )}
            <span>{formatBytes(a.tamanho_bytes)}</span>
            <span aria-hidden="true">·</span>
            <span>{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
            {a.origem === 'cofre' && <Badge variant="outline">Do cofre</Badge>}
            {a.origem !== 'upload' && a.origem !== 'cofre' && <Badge variant="outline">Gerado</Badge>}
          </div>
        </div>
        <Button
          variant="ghost" size="sm" title="Visualizar" aria-label={`Visualizar ${a.nome_arquivo}`}
          onClick={() => abrirVisualizacao(a)} disabled={abrindo === a.id} className="w-9 px-0"
        >
          {abrindo === a.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="sm" title="Baixar" aria-label={`Baixar ${a.nome_arquivo}`} onClick={() => downloadAnexo(a)} className="w-9 px-0">
          <Download className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost" size="sm" title="Excluir" aria-label={`Excluir ${a.nome_arquivo}`}
          onClick={async () => {
            if (!confirm(`Excluir "${a.nome_arquivo}"?`)) return;
            await deleteAnexo(a);
            avisarAnexosAlterados(licitacaoId);
          }}
          className="w-9 px-0 text-destructive"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    );
  };

  return (
    <div ref={raizRef} className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-full flex-col gap-1 sm:w-[180px]">
            <Label htmlFor="anexo-pasta">Pasta</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaAnexo)}>
              <SelectTrigger id="anexo-pasta"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {categoria === 'habilitacao' && (
            <div className="flex w-full flex-col gap-1 sm:w-[280px]">
              <Label htmlFor="anexo-grupo">Grupo da Lei</Label>
              <Select value={grupoHab} onValueChange={setGrupoHab}>
                <SelectTrigger id="anexo-grupo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar grupo pelo nome (automático)</SelectItem>
                  {GRUPOS_HABILITACAO.map(g => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.label}{ARTIGO_POR_GRUPO[g.key] ? ` — ${ARTIGO_POR_GRUPO[g.key]}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4" aria-hidden="true" />
            {uploading ? 'Enviando...' : 'Enviar Arquivo(s)'}
          </Button>
          <input ref={fileRef} type="file" multiple hidden onChange={handleFile} aria-label="Selecionar arquivos para enviar" />
          <div className="flex w-full flex-col gap-1 sm:ml-auto sm:w-[240px]">
            <Label htmlFor="anexo-busca">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="anexo-busca" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar arquivo..." className="pl-9" />
            </div>
          </div>
        </div>
      </Card>

      {/* Pastas */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Button
          type="button"
          variant="outline"
          aria-pressed={filtroCat === 'todas'}
          onClick={() => setFiltroCat('todas')}
          className={classeTile(filtroCat === 'todas')}
        >
          <Folder className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">Todas</span>
          <span className="text-xs font-normal text-muted-foreground">{anexos.length} arquivos</span>
        </Button>
        {grupos.map(g => (
          <Button
            key={g.value}
            type="button"
            variant="outline"
            aria-pressed={filtroCat === g.value}
            onClick={() => setFiltroCat(g.value)}
            className={classeTile(filtroCat === g.value)}
          >
            <Folder className="w-4 h-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold">{g.label}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {/* O PNCP só entra na conta quando trouxe arquivo: processo fora
                  do portal não pode exibir "+ PNCP". */}
              {g.value === 'edital' && (pncpEditalCount ?? 0) > 0
                ? `${g.count + (pncpEditalCount ?? 0)} arquivo(s) · ${pncpEditalCount} do PNCP`
                : `${g.count} arquivos`}
            </span>
          </Button>
        ))}
      </div>

      {/* Edital em tela — arquivos oficiais da contratação no PNCP. Fica sempre
          montado (oculto fora da pasta) para a listagem carregar uma vez só e o
          contador da pasta refletir os arquivos do PNCP desde o início. */}
      {editalViewer && <div className={filtroCat === 'edital' ? '' : 'hidden'}>{editalViewer}</div>}

      {/* Lista */}
      <Card className="divide-y divide-border">
        {loading && (
          <div role="status" aria-busy="true" className="space-y-4 p-4">
            <span className="sr-only">Carregando...</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtrados.length === 0 && (
          /* Pastas alimentadas por um módulo do processo apontam para ele —
             a pasta e a aba que a produz são o mesmo trabalho. */
          <EstadoVazio
            icone={<Folder />}
            titulo="Nenhum arquivo nesta pasta"
            descricao={ORIGEM_DA_PASTA[filtroCat]?.texto ?? (filtroCat === 'edital'
              ? 'Envie aqui o edital, o Termo de Referência e os anexos — é deles que o checklist, a proposta e o robô leem quando o processo não está no PNCP.'
              : 'Envie o primeiro arquivo pela barra acima.')}
            acao={
              ORIGEM_DA_PASTA[filtroCat] ? (
                <Button variant="outline" onClick={() => setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('aba', ORIGEM_DA_PASTA[filtroCat].aba);
                  return next;
                }, { replace: true })}>
                  {ORIGEM_DA_PASTA[filtroCat].botao} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    // Enviar a partir de uma pasta vazia envia PARA essa pasta.
                    if (filtroCat !== 'todas') setCategoriaEscolhida(filtroCat as CategoriaAnexo);
                    fileRef.current?.click();
                  }}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4" aria-hidden="true" /> {uploading ? 'Enviando...' : 'Enviar Arquivo(s)'}
                </Button>
              )
            }
          />
        )}
        {filtroCat !== 'habilitacao' && filtrados.map((a: ProcessoAnexo) => renderAnexo(a))}

        {/* Pasta Habilitação: espelha a organização do Jurídico → Documentos —
            grupos da Lei 14.133 na ordem canônica, ordenados pela referência
            do edital; sem classificação, cai em "Outros" (nada some). */}
        {filtroCat === 'habilitacao' && GRUPOS_HABILITACAO.map(({ key, label }) => {
          const doGrupo = filtrados
            .filter((a) => grupoDoAnexo(a) === key)
            .sort((x, y) => String((x.metadata as { referencia?: string } | null)?.referencia || x.nome_arquivo)
              .localeCompare(String((y.metadata as { referencia?: string } | null)?.referencia || y.nome_arquivo), 'pt-BR', { numeric: true }));
          if (!doGrupo.length) return null;
          const fechado = gruposFechados.has(key);
          return (
            <div key={key}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => alternarGrupo(key)}
                aria-expanded={!fechado}
                title={fechado ? 'Abrir o grupo' : 'Recolher o grupo'}
                className="h-auto w-full justify-start gap-2 rounded-none bg-muted/50 px-3 py-2 text-left font-normal hover:bg-muted"
              >
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${fechado ? '-rotate-90' : ''}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-muted-foreground">{label}</span>
                {ARTIGO_POR_GRUPO[key] && (
                  <Badge variant="outline">{ARTIGO_POR_GRUPO[key]}</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{doGrupo.length} arquivo(s)</span>
              </Button>
              {!fechado && (
                <div className="divide-y divide-border">
                  {doGrupo.map((a) => renderAnexo(a))}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* Tipo do documento da pasta Edital — gravado em metadata.tipo. */}
      <Dialog open={!!pendentesEdital} onOpenChange={(o) => { if (!o) setPendentesEdital(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Que documento é este?</DialogTitle>
            <DialogDescription>
              O tipo orienta a leitura do checklist, da proposta e do robô: o edital é lido primeiro,
              depois o Termo de Referência e os anexos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendentesEdital?.map((p, i) => (
              <div key={`${p.file.name}-${i}`} className="flex flex-col gap-1">
                <Label htmlFor={`tipo-edital-${i}`} className="block truncate">{p.file.name}</Label>
                <Select
                  value={p.tipo}
                  onValueChange={(v) => setPendentesEdital((atual) =>
                    atual?.map((x, j) => (j === i ? { ...x, tipo: v as TipoDocumentoEdital } : x)) ?? null)}
                >
                  <SelectTrigger id={`tipo-edital-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROTULO_TIPO_EDITAL) as TipoDocumentoEdital[]).map((t) => (
                      <SelectItem key={t} value={t}>{ROTULO_TIPO_EDITAL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendentesEdital(null)}>Cancelar</Button>
            <Button onClick={confirmarEdital} disabled={uploading}>
              <Upload className="w-4 h-4" aria-hidden="true" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizador — PDF e imagem renderizam inline; formatos que o
          navegador não exibe (Word, Excel) oferecem abrir/baixar. */}
      <Dialog open={!!visualizando} onOpenChange={(o) => { if (!o) setVisualizando(null); }}>
        <DialogContent className="flex h-[85vh] max-w-5xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
            <DialogTitle className="truncate pr-8 text-base font-semibold">
              {visualizando?.anexo.nome_arquivo}
            </DialogTitle>
          </DialogHeader>
          {visualizando && (() => {
            const nome = visualizando.anexo.nome_arquivo.toLowerCase();
            const ehPdf = nome.endsWith('.pdf') || visualizando.anexo.mime_type === 'application/pdf';
            const ehImagem = /\.(png|jpe?g|webp|gif)$/.test(nome) || (visualizando.anexo.mime_type || '').startsWith('image/');
            if (ehPdf) {
              return <iframe src={visualizando.url} title={visualizando.anexo.nome_arquivo} className="w-full flex-1 border-0" />;
            }
            if (ehImagem) {
              return (
                <div className="flex flex-1 items-center justify-center overflow-auto bg-muted p-4">
                  <img src={visualizando.url} alt={visualizando.anexo.nome_arquivo} className="max-h-full max-w-full object-contain" />
                </div>
              );
            }
            return (
              <div className="flex flex-1 items-center justify-center">
                <EstadoVazio
                  icone={<FileText />}
                  titulo="O navegador não exibe este formato"
                  descricao="Abra em uma nova aba ou baixe o arquivo para ler no aplicativo correspondente."
                  acao={
                    <>
                      <Button variant="outline" asChild>
                        <a href={visualizando.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4" aria-hidden="true" /> Abrir em nova aba
                        </a>
                      </Button>
                      <Button variant="outline" onClick={() => downloadAnexo(visualizando.anexo)}>
                        <Download className="w-4 h-4" aria-hidden="true" /> Baixar
                      </Button>
                    </>
                  }
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
