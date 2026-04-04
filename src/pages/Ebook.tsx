import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Download, FileText, Loader2, CheckCircle2, Lightbulb } from 'lucide-react';
import { generateEbook } from '@/lib/ebook-generator';
import { toast } from 'sonner';

const chapters = [
  { code: '01', title: 'Dashboard — Visão Estratégica' },
  { code: '02', title: 'Monitoramento de Editais' },
  { code: '03', title: 'Chat do Pregão em Tempo Real' },
  { code: '04', title: 'Proposta Técnica e Comercial' },
  { code: '05', title: 'Precificação Inteligente' },
  { code: '06', title: 'Apoio Jurídico com IA' },
  { code: '07', title: 'Gestão de Documentos' },
  { code: '08', title: 'Kanban de Licitações' },
  { code: '09', title: 'Robô de Lances' },
  { code: '10', title: 'Governança Multiempresa' },
];

export default function Ebook() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await generateEbook();
      toast.success('Guia PRAEFECTUS gerado com sucesso.');
    } catch {
      toast.error('Erro ao gerar o e-book.');
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
              Guia Completo PRAEFECTUS
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manual didático e ilustrado com todas as funções da plataforma, passo a passo e dicas práticas.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            v4.0
          </Badge>
        </div>

        <Card className="p-6 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <div className="flex items-center gap-4">
            <div className="w-16 h-20 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">PRAEFECTUS — Guia Técnico e Operacional</h2>
              <p className="text-sm text-muted-foreground mt-1">
                10 capítulos ilustrados com capturas de tela, explicações didáticas, passo a passo e dicas práticas para cada módulo.
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
                  {generating ? 'Gerando PDF...' : 'Baixar Guia Completo'}
                </Button>
                <span className="text-xs text-muted-foreground">PDF A4 • sumário clicável • ilustrado</span>
              </div>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="text-sm font-semibold mb-3">Capítulos</h3>
          <div className="space-y-1.5">
            {chapters.map((ch) => (
              <div
                key={ch.code}
                className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-right font-mono">{ch.code}</span>
                  <span className="text-sm font-medium">{ch.title}</span>
                </div>
                <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 p-4 bg-accent/5 border border-accent/15 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Material interno para equipes com plano ativo. O documento contém explicações didáticas, ilustrações das telas do sistema e dicas práticas para cada módulo.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
