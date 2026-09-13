import { useState, useEffect, type KeyboardEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen, Search, Clock, User, ArrowRight, TrendingUp,
  Scale, Lightbulb, CloudRain, AlertTriangle, FileText,
  Gavel, RefreshCw, ExternalLink, ChevronLeft, Star, X,
} from 'lucide-react';
import { toast } from 'sonner';

type Artigo = {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  categoria: string;
  autor: string;
  data_publicacao: string;
  tempo_leitura: string;
  tags: string[];
  destaque: boolean;
  fonte_url: string | null;
  fonte_nome: string | null;
  tcu_referencia: string | null;
  caso_fortuito: boolean;
  forca_maior: boolean;
};

const categorias = [
  { id: 'todos', label: 'Todos', icon: BookOpen },
  { id: 'clima-alimentos', label: 'Clima & Alimentos', icon: CloudRain },
  { id: 'forca-maior', label: 'Força Maior', icon: AlertTriangle },
  { id: 'jurisprudencia', label: 'Jurisprudência', icon: Gavel },
  { id: 'como-licitar', label: 'Como Licitar', icon: Lightbulb },
  { id: 'legislacao', label: 'Legislação', icon: Scale },
  { id: 'mercado', label: 'Mercado', icon: TrendingUp },
  { id: 'reajustes', label: 'Reajustes & CCTs', icon: TrendingUp },
];

/* O corpo do artigo vem em Markdown, e este projeto NÃO tem o plugin
   `@tailwindcss/typography` — as classes `prose` que estavam aqui não pintavam
   nada, e com o preflight do Tailwind o texto saía todo do mesmo tamanho, sem
   título nem lista. A hierarquia abaixo é escrita com os tokens da identidade,
   para o artigo ficar legível de verdade. */
const CORPO_ARTIGO = [
  'max-w-none text-base leading-7 text-foreground',
  '[&>*+*]:mt-4',
  '[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mt-6',
  '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-6',
  '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
  '[&_strong]:font-semibold [&_strong]:text-foreground',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm',
  '[&_table]:w-full [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_td]:text-sm [&_td]:align-top',
].join(' ');

export default function Blog() {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [artigoAberto, setArtigoAberto] = useState<Artigo | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    fetchArtigos();
  }, []);

  const fetchArtigos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_artigos')
      .select('*')
      .order('data_publicacao', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao buscar artigos:', error);
    } else {
      setArtigos((data as unknown as Artigo[]) || []);
    }
    setLoading(false);
  };

  const gerarArtigos = async () => {
    setGerando(true);
    toast.info('Gerando artigos com IA... Isso pode levar até 1 minuto.');
    try {
      const { data, error } = await supabase.functions.invoke('blog-ia-alimentar');
      if (error) throw error;
      if (data?.success) {
        toast.success(`${data.artigos_gerados} artigos gerados com sucesso!`);
        await fetchArtigos();
      } else {
        toast.error(data?.error || 'Erro ao gerar artigos');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao conectar com o serviço');
    } finally {
      setGerando(false);
    }
  };

  const artigosFiltrados = artigos.filter(a => {
    const matchBusca = !busca || a.titulo.toLowerCase().includes(busca.toLowerCase()) || a.resumo.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoriaAtiva === 'todos' || a.categoria === categoriaAtiva;
    return matchBusca && matchCategoria;
  });

  const destaques = artigos.filter(a => a.destaque).slice(0, 2);

  /* O cartão inteiro é a área de clique — então ele também precisa responder ao
     teclado, senão quem navega por Tab não consegue abrir artigo nenhum. */
  const abrirPorTeclado = (artigo: Artigo) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setArtigoAberto(artigo);
    }
  };

  const CARTAO_CLICAVEL =
    'group cursor-pointer p-6 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  const botaoGerar = (
    <Button onClick={gerarArtigos} disabled={gerando}>
      <RefreshCw className={gerando ? 'animate-spin' : undefined} aria-hidden="true" />
      {gerando ? 'Gerando...' : 'Gerar artigos'}
    </Button>
  );

  /* Vazio por filtro e vazio por base sem artigo são coisas diferentes, e a
     ação tem de casar com o texto: quem filtrou tudo precisa LIMPAR o filtro —
     "Gerar artigos" não devolveria o artigo que a busca escondeu, e ainda
     duplicaria o botão que já está no cabeçalho. */
  const temFiltro = busca.trim() !== '' || categoriaAtiva !== 'todos';

  const limparFiltros = () => {
    setBusca('');
    setCategoriaAtiva('todos');
  };

  if (artigoAberto) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl space-y-6">
          <CabecalhoPagina
            titulo={artigoAberto.titulo}
            /* Sem `descricao` explícita, o cabeçalho cai no registro e o artigo
               herdaria a linha do MÓDULO ("Artigos sobre licitação…") — a URL
               continua /blog. O resumo do próprio artigo é o que cabe aqui, e
               ele não aparecia em lugar nenhum da leitura. */
            descricao={artigoAberto.resumo}
            /* Mesmo vazamento da descrição, agora no ícone: a URL continua
               /blog, então sem prop explícita o cabeçalho pinta o BookOpen do
               MÓDULO colado no título do ARTIGO. Prop explícita vence o
               registro, e a subview passa a ter o ícone que é dela — um
               documento —, como as telas de detalhe de contrato já fazem. */
            icone={<FileText />}
            trilha={[
              { rotulo: 'Painel', para: '/dashboard' },
              { rotulo: 'Ferramentas' },
              { rotulo: 'Blog' },
            ]}
            acoes={
              <Button variant="outline" onClick={() => setArtigoAberto(null)}>
                <ChevronLeft aria-hidden="true" />
                Voltar ao blog
              </Button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {artigoAberto.caso_fortuito && (
                <Badge variant="warning">
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" /> Caso fortuito
                </Badge>
              )}
              {artigoAberto.forca_maior && (
                <Badge variant="danger">
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" /> Força maior
                </Badge>
              )}
              {artigoAberto.tcu_referencia && (
                <Badge variant="info">
                  <Gavel className="mr-1 h-3 w-3" aria-hidden="true" /> TCU: {artigoAberto.tcu_referencia}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" aria-hidden="true" /> {artigoAberto.autor}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {artigoAberto.tempo_leitura}
              </span>
              <span>{new Date(artigoAberto.data_publicacao).toLocaleDateString('pt-BR')}</span>
              {artigoAberto.fonte_nome && artigoAberto.fonte_url && (
                <a
                  href={artigoAberto.fonte_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {artigoAberto.fonte_nome}
                </a>
              )}
            </div>
          </CabecalhoPagina>

          <Card className="p-6">
            <div className={CORPO_ARTIGO}>
              <ReactMarkdown>{artigoAberto.conteudo}</ReactMarkdown>
            </div>
          </Card>

          {artigoAberto.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {artigoAberto.tags.map(tag => (
                <Badge key={tag} variant="muted">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina
          acoes={botaoGerar}
          filtros={
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Buscar artigo"
                placeholder="Buscar artigo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
          }
        />

        {/* Destaques */}
        {destaques.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {destaques.map(artigo => (
              <Card
                key={artigo.id}
                role="button"
                tabIndex={0}
                onClick={() => setArtigoAberto(artigo)}
                onKeyDown={abrirPorTeclado(artigo)}
                className={CARTAO_CLICAVEL}
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="muted">
                    <Star className="mr-1 h-3 w-3" aria-hidden="true" /> Destaque
                  </Badge>
                  {artigo.caso_fortuito && <Badge variant="warning">Caso fortuito</Badge>}
                  {artigo.forca_maior && <Badge variant="danger">Força maior</Badge>}
                </div>
                <h2 className="mb-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                  {artigo.titulo}
                </h2>
                <p className="mb-4 text-base text-muted-foreground">{artigo.resumo}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" aria-hidden="true" /> {artigo.autor}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" /> {artigo.tempo_leitura}
                    </span>
                  </div>
                  <span>{new Date(artigo.data_publicacao).toLocaleDateString('pt-BR')}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Categorias */}
        <div className="flex flex-wrap gap-2">
          {categorias.map(cat => {
            const Icon = cat.icon;
            const ativa = categoriaAtiva === cat.id;
            return (
              <Button
                key={cat.id}
                variant={ativa ? 'default' : 'outline'}
                size="sm"
                aria-pressed={ativa}
                onClick={() => setCategoriaAtiva(cat.id)}
              >
                <Icon aria-hidden="true" /> {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-6">
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="mb-2 h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </Card>
            ))}
          </div>
        ) : artigosFiltrados.length === 0 ? (
          <EstadoVazio
            icone={<Search />}
            titulo="Nenhum artigo encontrado"
            descricao={
              busca || categoriaAtiva !== 'todos'
                ? 'Nenhum artigo casa com a busca ou a categoria escolhida — limpe os filtros para ver tudo'
                : 'Gere artigos com IA para alimentar o blog'
            }
            acao={botaoGerar}
          />
        ) : (
          <div className="space-y-3">
            {artigosFiltrados.map(artigo => (
              <Card
                key={artigo.id}
                role="button"
                tabIndex={0}
                onClick={() => setArtigoAberto(artigo)}
                onKeyDown={abrirPorTeclado(artigo)}
                className={CARTAO_CLICAVEL}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {(artigo.caso_fortuito || artigo.forca_maior || artigo.tcu_referencia) && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {artigo.caso_fortuito && <Badge variant="warning">Caso fortuito</Badge>}
                        {artigo.forca_maior && <Badge variant="danger">Força maior</Badge>}
                        {artigo.tcu_referencia && <Badge variant="info">TCU</Badge>}
                      </div>
                    )}
                    <h3 className="mb-1 text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                      {artigo.titulo}
                    </h3>
                    <p className="mb-2 text-sm text-muted-foreground">{artigo.resumo}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden="true" /> {artigo.autor}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" /> {artigo.tempo_leitura}
                      </span>
                      <span>{new Date(artigo.data_publicacao).toLocaleDateString('pt-BR')}</span>
                      {artigo.fonte_nome && (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" aria-hidden="true" /> {artigo.fonte_nome}
                        </span>
                      )}
                    </div>
                    {artigo.tags?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {artigo.tags.slice(0, 5).map(tag => (
                          <Badge key={tag} variant="muted">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
