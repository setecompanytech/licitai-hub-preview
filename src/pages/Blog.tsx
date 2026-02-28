import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen, Search, Clock, User, Tag, ArrowRight, TrendingUp,
  Scale, FileText, Building2, Lightbulb, CloudRain, AlertTriangle,
  Gavel, RefreshCw, ExternalLink, ChevronLeft
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
];

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
      setArtigos((data as any[]) || []);
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
    } catch (e: any) {
      toast.error(e.message || 'Erro ao conectar com o serviço');
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

  if (artigoAberto) {
    return (
      <AppLayout>
        <div className="space-y-4 max-w-4xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => setArtigoAberto(null)} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Voltar ao Blog
          </Button>
          <div>
            <div className="flex gap-2 mb-3">
              {artigoAberto.caso_fortuito && (
                <Badge variant="outline" className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[10px]">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Caso Fortuito
                </Badge>
              )}
              {artigoAberto.forca_maior && (
                <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Força Maior
                </Badge>
              )}
              {artigoAberto.tcu_referencia && (
                <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">
                  <Gavel className="w-3 h-3 mr-1" /> TCU: {artigoAberto.tcu_referencia}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{artigoAberto.titulo}</h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {artigoAberto.autor}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {artigoAberto.tempo_leitura}</span>
              <span>{new Date(artigoAberto.data_publicacao).toLocaleDateString('pt-BR')}</span>
              {artigoAberto.fonte_nome && artigoAberto.fonte_url && (
                <a href={artigoAberto.fonte_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent hover:underline">
                  <ExternalLink className="w-3 h-3" /> {artigoAberto.fonte_nome}
                </a>
              )}
            </div>
          </div>
          <Card className="p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{artigoAberto.conteudo}</ReactMarkdown>
            </div>
          </Card>
          <div className="flex gap-1 flex-wrap">
            {artigoAberto.tags?.map(tag => (
              <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-accent" />
              Blog & Conteúdos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Artigos gerados por IA sobre clima, licitações e jurisprudência do TCU
            </p>
          </div>
          <Button onClick={gerarArtigos} disabled={gerando} size="sm" className="gap-1">
            <RefreshCw className={`w-4 h-4 ${gerando ? 'animate-spin' : ''}`} />
            {gerando ? 'Gerando...' : 'Gerar Artigos'}
          </Button>
        </div>

        {/* Destaques */}
        {destaques.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {destaques.map(artigo => (
              <Card key={artigo.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setArtigoAberto(artigo)}>
                <div className="flex gap-2 mb-2">
                  <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-[10px]">
                    ⭐ Destaque
                  </Badge>
                  {artigo.caso_fortuito && (
                    <Badge variant="outline" className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[10px]">
                      Caso Fortuito
                    </Badge>
                  )}
                  {artigo.forca_maior && (
                    <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">
                      Força Maior
                    </Badge>
                  )}
                </div>
                <h2 className="font-bold text-lg mb-2 group-hover:text-accent transition-colors">{artigo.titulo}</h2>
                <p className="text-sm text-muted-foreground mb-3">{artigo.resumo}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {artigo.autor}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {artigo.tempo_leitura}</span>
                  </div>
                  <span>{new Date(artigo.data_publicacao).toLocaleDateString('pt-BR')}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Busca e filtros */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar artigo..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10" />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categorias.map(cat => {
            const Icon = cat.icon;
            return (
              <Button key={cat.id} variant={categoriaAtiva === cat.id ? 'default' : 'outline'} size="sm"
                onClick={() => setCategoriaAtiva(cat.id)}
                className={categoriaAtiva === cat.id ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}>
                <Icon className="w-3 h-3 mr-1" /> {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </Card>
            ))}
          </div>
        ) : artigosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum artigo encontrado.</p>
            <p className="text-xs mt-1">Clique em "Gerar Artigos" para alimentar o blog com IA.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {artigosFiltrados.map(artigo => (
              <Card key={artigo.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setArtigoAberto(artigo)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex gap-1 mb-1">
                      {artigo.caso_fortuito && (
                        <Badge variant="outline" className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[9px] px-1.5 py-0">
                          Caso Fortuito
                        </Badge>
                      )}
                      {artigo.forca_maior && (
                        <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 text-[9px] px-1.5 py-0">
                          Força Maior
                        </Badge>
                      )}
                      {artigo.tcu_referencia && (
                        <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[9px] px-1.5 py-0">
                          TCU
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm group-hover:text-accent transition-colors mb-1">{artigo.titulo}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{artigo.resumo}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {artigo.autor}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {artigo.tempo_leitura}</span>
                      <span>{new Date(artigo.data_publicacao).toLocaleDateString('pt-BR')}</span>
                      {artigo.fonte_nome && (
                        <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {artigo.fonte_nome}</span>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {artigo.tags?.slice(0, 5).map(tag => (
                        <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors ml-3 mt-1" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
