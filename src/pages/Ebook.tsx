import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Download, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { generateEbook } from '@/lib/ebook-generator';
import { toast } from 'sonner';

const chapters = [
  { icon: '📊', title: 'Dashboard', pages: '3' },
  { icon: '🔍', title: 'Monitoramento de Editais', pages: '4' },
  { icon: '💬', title: 'Chat do Pregão', pages: '5' },
  { icon: '📧', title: 'Boletins Diários', pages: '6' },
  { icon: '🎯', title: 'Licitações Estratégicas', pages: '7' },
  { icon: '📈', title: 'Análise de Mercado', pages: '8' },
  { icon: '📋', title: 'Kanban de Licitações', pages: '9' },
  { icon: '🤖', title: 'Robô de Lances', pages: '10' },
  { icon: '👥', title: 'Análise de Concorrentes', pages: '11' },
  { icon: '📁', title: 'Gestão de Documentos', pages: '12' },
  { icon: '✅', title: 'Assessoria Cadastral', pages: '13' },
  { icon: '⚖️', title: 'Apoio Jurídico com IA', pages: '14' },
  { icon: '💰', title: 'Precificação Inteligente', pages: '15' },
  { icon: '🧠', title: 'Assistente IA', pages: '16' },
  { icon: '📰', title: 'Blog e Conteúdos', pages: '17' },
  { icon: '🏢', title: 'Gestão Multi-empresa', pages: '18' },
  { icon: '💎', title: 'Planos e Assinaturas', pages: '19' },
];

export default function Ebook() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      generateEbook();
      toast.success('E-book gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar o e-book');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-accent" />
              E-book da Plataforma
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Guia completo com todas as funcionalidades – para uso interno da empresa
            </p>
          </div>
          <Badge variant="outline" className="text-xs">v1.0</Badge>
        </div>

        {/* Download card */}
        <Card className="p-6 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <div className="flex items-center gap-4">
            <div className="w-16 h-20 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">ConLicitação – Guia Completo</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manual com {chapters.length} capítulos cobrindo todas as funcionalidades da plataforma.
                Ideal para treinamento de equipes e onboarding de novos colaboradores.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Button
                  onClick={handleDownload}
                  disabled={generating}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {generating ? 'Gerando PDF...' : 'Baixar E-book (PDF)'}
                </Button>
                <span className="text-xs text-muted-foreground">~20 páginas • PDF A4</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Chapters list */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Conteúdo do E-book</h3>
          <div className="space-y-1.5">
            {chapters.map((ch, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-base">{ch.icon}</span>
                  <span className="text-sm font-medium">{ch.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">Pág. {ch.pages}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 p-4 bg-info/10 border border-info/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Este material é de uso exclusivo para empresas com plano ativo. 
            A distribuição externa é proibida conforme os termos de uso da plataforma.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
