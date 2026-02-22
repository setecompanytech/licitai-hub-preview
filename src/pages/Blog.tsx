import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  BookOpen, Search, Clock, User, Tag, ArrowRight, TrendingUp,
  Scale, FileText, Building2, Lightbulb
} from 'lucide-react';

type Artigo = {
  id: string;
  titulo: string;
  resumo: string;
  categoria: string;
  autor: string;
  dataPublicacao: string;
  tempoLeitura: string;
  tags: string[];
  destaque: boolean;
  imagem?: string;
};

const categorias = [
  { id: 'todos', label: 'Todos', icon: BookOpen },
  { id: 'como-licitar', label: 'Como Licitar', icon: Lightbulb },
  { id: 'legislacao', label: 'Legislação', icon: Scale },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'mercado', label: 'Mercado', icon: TrendingUp },
  { id: 'orgaos', label: 'Órgãos Públicos', icon: Building2 },
];

const mockArtigos: Artigo[] = [
  {
    id: '1', titulo: 'Guia Completo: Como participar de licitações públicas em 2026',
    resumo: 'Tudo o que você precisa saber para começar a vender para o governo. Desde o cadastro até a participação em pregões eletrônicos.',
    categoria: 'como-licitar', autor: 'Equipe LicitIA', dataPublicacao: '2026-02-20', tempoLeitura: '12 min',
    tags: ['iniciante', 'pregão', 'cadastro'], destaque: true,
  },
  {
    id: '2', titulo: 'Nova Lei de Licitações (14.133/2021): o que mudou na prática',
    resumo: 'Análise das principais mudanças trazidas pela nova lei e como elas impactam os fornecedores do governo.',
    categoria: 'legislacao', autor: 'Dr. Carlos Mendes', dataPublicacao: '2026-02-18', tempoLeitura: '8 min',
    tags: ['lei 14.133', 'compliance', 'mudanças'], destaque: true,
  },
  {
    id: '3', titulo: 'Checklist de documentos para habilitação em licitações',
    resumo: 'Lista completa e atualizada de todos os documentos que podem ser exigidos nos editais de licitação.',
    categoria: 'documentos', autor: 'Ana Souza', dataPublicacao: '2026-02-15', tempoLeitura: '6 min',
    tags: ['documentos', 'habilitação', 'checklist'], destaque: false,
  },
  {
    id: '4', titulo: 'Análise de mercado: setores que mais contratam com o governo',
    resumo: 'Descubra quais segmentos concentram o maior volume financeiro em compras governamentais.',
    categoria: 'mercado', autor: 'Equipe LicitIA', dataPublicacao: '2026-02-12', tempoLeitura: '10 min',
    tags: ['mercado', 'análise', 'oportunidades'], destaque: false,
  },
  {
    id: '5', titulo: 'SICAF: como realizar o cadastro passo a passo',
    resumo: 'Tutorial detalhado para cadastrar sua empresa no Sistema de Cadastramento Unificado de Fornecedores.',
    categoria: 'como-licitar', autor: 'Marcos Lima', dataPublicacao: '2026-02-10', tempoLeitura: '15 min',
    tags: ['SICAF', 'cadastro', 'tutorial'], destaque: false,
  },
  {
    id: '6', titulo: 'Impugnação de edital: quando e como fazer',
    resumo: 'Entenda seus direitos e saiba como impugnar editais com cláusulas restritivas ou ilegais.',
    categoria: 'legislacao', autor: 'Dr. Carlos Mendes', dataPublicacao: '2026-02-08', tempoLeitura: '7 min',
    tags: ['impugnação', 'edital', 'jurídico'], destaque: false,
  },
  {
    id: '7', titulo: 'Pregão eletrônico: estratégias para oferecer o melhor lance',
    resumo: 'Dicas práticas para se preparar e ter vantagem competitiva nos pregões eletrônicos.',
    categoria: 'como-licitar', autor: 'Equipe LicitIA', dataPublicacao: '2026-02-05', tempoLeitura: '9 min',
    tags: ['pregão', 'lances', 'estratégia'], destaque: false,
  },
  {
    id: '8', titulo: 'Portais de compras públicas: guia dos principais sistemas',
    resumo: 'Conheça os principais portais de compras governamentais e como se cadastrar em cada um.',
    categoria: 'orgaos', autor: 'Ana Souza', dataPublicacao: '2026-02-03', tempoLeitura: '11 min',
    tags: ['portais', 'compras públicas', 'governo'], destaque: false,
  },
];

export default function Blog() {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');

  const artigosFiltrados = mockArtigos.filter(a => {
    const matchBusca = !busca || a.titulo.toLowerCase().includes(busca.toLowerCase()) || a.resumo.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoriaAtiva === 'todos' || a.categoria === categoriaAtiva;
    return matchBusca && matchCategoria;
  });

  const destaques = mockArtigos.filter(a => a.destaque);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" />
            Blog & Conteúdos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Artigos, guias e notícias sobre licitações públicas
          </p>
        </div>

        {/* Destaques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {destaques.map(artigo => (
            <Card key={artigo.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-[10px] mb-3">
                ⭐ Destaque
              </Badge>
              <h2 className="font-bold text-lg mb-2 group-hover:text-accent transition-colors">{artigo.titulo}</h2>
              <p className="text-sm text-muted-foreground mb-3">{artigo.resumo}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {artigo.autor}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {artigo.tempoLeitura}</span>
                </div>
                <span>{new Date(artigo.dataPublicacao).toLocaleDateString('pt-BR')}</span>
              </div>
            </Card>
          ))}
        </div>

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

        {/* Lista de artigos */}
        <div className="space-y-3">
          {artigosFiltrados.filter(a => !a.destaque || categoriaAtiva !== 'todos').map(artigo => (
            <Card key={artigo.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm group-hover:text-accent transition-colors mb-1">{artigo.titulo}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{artigo.resumo}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {artigo.autor}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {artigo.tempoLeitura}</span>
                    <span>{new Date(artigo.dataPublicacao).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {artigo.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors ml-3 mt-1" />
              </div>
            </Card>
          ))}
          {artigosFiltrados.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum artigo encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
