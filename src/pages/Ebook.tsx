import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Download, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { generateEbook } from '@/lib/ebook-generator';
import { toast } from 'sonner';

const chapters = [
  { code: '01', title: 'Visao Estrategica do Dashboard', pages: '1' },
  { code: '02', title: 'Monitoramento de Editais e Diarios', pages: '2' },
  { code: '03', title: 'Chat do Pregao em Tempo Real', pages: '3' },
  { code: '04', title: 'Proposta Tecnica e Comercial Normatizada', pages: '4' },
  { code: '05', title: 'Precificacao Inteligente', pages: '5' },
  { code: '06', title: 'Apoio Juridico com IA', pages: '6' },
  { code: '07', title: 'Gestao de Documentos e Validades', pages: '7' },
  { code: '08', title: 'Kanban Operacional de Licitacoes', pages: '8' },
  { code: '09', title: 'Robo de Lances Configuravel', pages: '9' },
  { code: '10', title: 'Governanca Multiempresa', pages: '10' },
];

export default function Ebook() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await generateEbook();
      toast.success('E-book ABNT gerado com sucesso.');
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
              E-book LicitaIA (Padrao ABNT)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Documento tecnico com sumario clicavel, tipografia unica e contexto funcional completo.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            v3.0
          </Badge>
        </div>

        <Card className="p-6 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <div className="flex items-center gap-4">
            <div className="w-16 h-20 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">LicitaIA - Guia Tecnico e Operacional</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Estrutura com fundamento tecnico e juridico, figuras funcionais dos modulos e paginacao logica de acordo com ABNT.
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
                  {generating ? 'Gerando PDF...' : 'Baixar E-book ABNT'}
                </Button>
                <span className="text-xs text-muted-foreground">PDF A4 • sumario clicavel</span>
              </div>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="text-sm font-semibold mb-3">Capitulos</h3>
          <div className="space-y-1.5">
            {chapters.map((ch) => (
              <div
                key={ch.code}
                className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-right">{ch.code}</span>
                  <span className="text-sm font-medium">{ch.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">Pag. {ch.pages}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 p-4 bg-info/10 border border-info/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Material interno para equipes com plano ativo. O documento contem orientacao operacional, base normativa e padrao visual unico.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
