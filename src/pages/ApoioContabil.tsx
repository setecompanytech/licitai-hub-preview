import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Calculator, FileText, Download, Copy, Sparkles, Search,
  BookOpen, BarChart3, ClipboardList, DollarSign, FileWarning
} from 'lucide-react';
import AnaliseBalancoIA from '@/components/apoio-contabil/AnaliseBalancoIA';
import GeradorContabilIA from '@/components/apoio-contabil/GeradorContabilIA';
import BaseContabilUpload from '@/components/apoio-contabil/BaseContabilUpload';

type Modelo = {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  icon: typeof FileText;
  fundamentacao: string;
};

const modelos: Modelo[] = [
  { id: '1', titulo: 'Composição de Custos Unitários', categoria: 'Precificação', descricao: 'Planilha analítica de custos e formação de preços para licitações', icon: DollarSign, fundamentacao: 'Art. 58, Lei 14.133/2021' },
  { id: '2', titulo: 'Cálculo de BDI', categoria: 'Precificação', descricao: 'Bonificação e Despesas Indiretas conforme Acórdão TCU 2.622/2013', icon: Calculator, fundamentacao: 'Acórdão TCU 2.622/2013' },
  { id: '3', titulo: 'Análise de Inexequibilidade', categoria: 'Precificação', descricao: 'Verificação de preços inexequíveis conforme critérios legais', icon: FileWarning, fundamentacao: 'Art. 59, §4º, Lei 14.133/2021' },
  { id: '4', titulo: 'Parecer de Viabilidade Econômica', categoria: 'Pareceres', descricao: 'Análise de viabilidade econômico-financeira para contratação', icon: BarChart3, fundamentacao: 'Art. 18, Lei 14.133/2021' },
  { id: '5', titulo: 'Demonstrativo de Encargos Sociais', categoria: 'Precificação', descricao: 'Cálculo detalhado de encargos sociais e trabalhistas', icon: ClipboardList, fundamentacao: 'IN SEGES/ME 65/2021' },
  { id: '6', titulo: 'Parecer sobre Reequilíbrio Financeiro', categoria: 'Pareceres', descricao: 'Fundamentação contábil para pedido de reequilíbrio econômico-financeiro', icon: Calculator, fundamentacao: 'Art. 124, II, d, Lei 14.133/2021' },
  { id: '7', titulo: 'Análise de Qualificação Econômico-Financeira', categoria: 'Habilitação', descricao: 'Verificação de índices contábeis para habilitação em licitação', icon: BarChart3, fundamentacao: 'Art. 69, Lei 14.133/2021' },
  { id: '8', titulo: 'Memorial de Cálculo Tributário', categoria: 'Tributário', descricao: 'Detalhamento de alíquotas e carga tributária incidente na contratação', icon: Calculator, fundamentacao: 'LC 123/2006, Art. 18' },
  { id: '9', titulo: 'Certidão de Regularidade Fiscal', categoria: 'Habilitação', descricao: 'Checklist de certidões fiscais e previdenciárias obrigatórias', icon: FileText, fundamentacao: 'Art. 68, Lei 14.133/2021' },
  { id: '10', titulo: 'Análise de Fluxo de Caixa Projetado', categoria: 'Pareceres', descricao: 'Projeção de fluxo de caixa para execução contratual', icon: BarChart3, fundamentacao: 'NBC TG 03' },
];

const categorias = [...new Set(modelos.map((m) => m.categoria))];

export default function ApoioContabil() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('modelos');

  const filteredModelos = modelos.filter(
    (m) =>
      m.titulo.toLowerCase().includes(search.toLowerCase()) ||
      m.categoria.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" />
            Apoio Contábil Especializado
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Análises contábeis, tributárias e precificação assistida por IA – NBC, CFC, Lei 14.133/2021
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="modelos">Modelos e Templates</TabsTrigger>
            <TabsTrigger value="analise-balanco">Análise de Balanço IA</TabsTrigger>
            <TabsTrigger value="gerador">Gerador IA</TabsTrigger>
            <TabsTrigger value="legislacao">Legislação Contábil</TabsTrigger>
            <TabsTrigger value="base-contabil">Base Contábil IA</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos" className="space-y-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar modelo ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            {categorias.map((cat) => {
              const items = filteredModelos.filter((m) => m.categoria === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <BookOpen className="w-4 h-4" /> {cat}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((m) => (
                      <div key={m.id} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <m.icon className="w-4 h-4 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{m.titulo}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{m.descricao}</p>
                            <Badge variant="outline" className="mt-2 text-xs">{m.fundamentacao}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="flex-1">
                            <Download className="w-3 h-3 mr-1" /> Baixar
                          </Button>
                          <Button size="sm" variant="outline"><Copy className="w-3 h-3" /></Button>
                          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            <Sparkles className="w-3 h-3 mr-1" /> Gerar com IA
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="analise-balanco">
            <AnaliseBalancoIA />
          </TabsContent>

          <TabsContent value="gerador" className="space-y-4">
            <GeradorContabilIA />
          </TabsContent>

          <TabsContent value="base-contabil">
            <BaseContabilUpload />
          </TabsContent>

          <TabsContent value="legislacao">
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm">
              <h3 className="text-sm font-semibold mb-4">Referências Legais e Normativas</h3>
              <div className="space-y-3">
                {[
                  { lei: 'Lei 14.133/2021', desc: 'Nova Lei de Licitações – qualificação econômico-financeira e precificação' },
                  { lei: 'Lei 4.320/1964', desc: 'Normas Gerais de Direito Financeiro e Contabilidade Pública' },
                  { lei: 'LC 101/2000 (LRF)', desc: 'Lei de Responsabilidade Fiscal – limites e gestão fiscal' },
                  { lei: 'NBC TSP (CFC)', desc: 'Normas Brasileiras de Contabilidade do Setor Público' },
                  { lei: 'NBC TG 26', desc: 'Apresentação das Demonstrações Contábeis' },
                  { lei: 'IN SEGES/ME 65/2021', desc: 'Procedimentos para contratação de serviços continuados' },
                  { lei: 'LC 123/2006', desc: 'Simples Nacional – regime tributário de ME/EPP' },
                  { lei: 'Acórdão TCU 2.622/2013', desc: 'Referencial de BDI para obras e serviços de engenharia' },
                  { lei: 'CPC 00 (R2)', desc: 'Estrutura Conceitual para Relatório Financeiro' },
                  { lei: 'Lei 6.404/1976', desc: 'Lei das Sociedades por Ações – demonstrações financeiras' },
                ].map((l) => (
                  <div key={l.lei} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{l.lei}</p>
                      <p className="text-xs text-muted-foreground">{l.desc}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <BookOpen className="w-3 h-3 mr-1" /> Consultar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
