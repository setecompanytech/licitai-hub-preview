import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Scale, FileText, Download, Copy, Sparkles, Search,
  BookOpen, Gavel, FileWarning, MessageSquare, ShieldQuestion,
  ArrowUpDown, Calculator
} from 'lucide-react';
import ReequilibrioIA from '@/components/apoio-juridico/ReequilibrioIA';
import BaseJuridicaUpload from '@/components/apoio-juridico/BaseJuridicaUpload';
import GeradorIAComBase from '@/components/apoio-juridico/GeradorIAComBase';
import ModelosTemplatesTab from '@/components/apoio-juridico/ModelosTemplatesTab';

type Modelo = {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  icon: typeof FileText;
  fundamentacao: string;
};

const modelos: Modelo[] = [
  { id: '1', titulo: 'Pedido de Esclarecimento', categoria: 'Esclarecimentos', descricao: 'Solicitar esclarecimentos sobre termos ambíguos do edital', icon: MessageSquare, fundamentacao: 'Art. 164 da Lei 14.133/2021' },
  { id: '2', titulo: 'Impugnação ao Edital', categoria: 'Impugnações', descricao: 'Contestar cláusulas restritivas ou ilegais do edital', icon: FileWarning, fundamentacao: 'Art. 164 da Lei 14.133/2021' },
  { id: '3', titulo: 'Recurso Administrativo', categoria: 'Recursos', descricao: 'Recurso contra decisão de habilitação ou julgamento', icon: Gavel, fundamentacao: 'Art. 165 da Lei 14.133/2021' },
  { id: '4', titulo: 'Contrarrazões de Recurso', categoria: 'Recursos', descricao: 'Resposta ao recurso interposto por outro licitante', icon: ArrowUpDown, fundamentacao: 'Art. 165, §3º da Lei 14.133/2021' },
  { id: '5', titulo: 'Pedido de Reconsideração', categoria: 'Recursos', descricao: 'Reconsideração de penalidades aplicadas', icon: ShieldQuestion, fundamentacao: 'Art. 166 da Lei 14.133/2021' },
  { id: '6', titulo: 'Recurso Hierárquico', categoria: 'Recursos', descricao: 'Recurso à autoridade superior quando pedido de reconsideração indeferido', icon: ArrowUpDown, fundamentacao: 'Art. 167 da Lei 14.133/2021' },
  { id: '7', titulo: 'Reequilíbrio Econômico-Financeiro', categoria: 'Contratos', descricao: 'Solicitação de reequilíbrio por fatos supervenientes', icon: Calculator, fundamentacao: 'Art. 124, II, d da Lei 14.133/2021' },
  { id: '8', titulo: 'Planilha de Composição de Custos', categoria: 'Propostas', descricao: 'Modelo de planilha analítica de custos e formação de preços', icon: Calculator, fundamentacao: 'Art. 58 da Lei 14.133/2021' },
  { id: '9', titulo: 'Declaração de ME/EPP', categoria: 'Declarações', descricao: 'Declaração de enquadramento como microempresa ou EPP', icon: FileText, fundamentacao: 'LC 123/2006, Art. 3º' },
  { id: '10', titulo: 'Declaração de Inexistência de Fato Impeditivo', categoria: 'Declarações', descricao: 'Declaração de que não existem fatos impeditivos à habilitação', icon: FileText, fundamentacao: 'Art. 63, §1º da Lei 14.133/2021' },
  { id: '11', titulo: 'Declaração de Não Emprego de Menor', categoria: 'Declarações', descricao: 'Cumprimento ao disposto no Art. 7º, XXXIII da CF', icon: FileText, fundamentacao: 'Art. 68, VI da Lei 14.133/2021' },
  { id: '12', titulo: 'Declaração de Reserva de Cargos (PCD)', categoria: 'Declarações', descricao: 'Cumprimento da reserva de cargos para PCD e reabilitados', icon: FileText, fundamentacao: 'Art. 63, IV da Lei 14.133/2021' },
];

const categorias = [...new Set(modelos.map((m) => m.categoria))];

export default function ApoioJuridico() {
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-accent" />
            Apoio Jurídico Especializado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modelos, templates e geração assistida por IA – Lei 14.133/2021
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="modelos">Modelos e Templates</TabsTrigger>
            <TabsTrigger value="reequilibrio">Reequilíbrio IA</TabsTrigger>
            <TabsTrigger value="gerador">Gerador IA</TabsTrigger>
            <TabsTrigger value="legislacao">Legislação</TabsTrigger>
            <TabsTrigger value="base-juridica">Base Jurídica IA</TabsTrigger>
          </TabsList>

          {/* Modelos */}
          <TabsContent value="modelos" className="space-y-4">
            <ModelosTemplatesTab />
          </TabsContent>

          {/* Reequilíbrio IA */}
          <TabsContent value="reequilibrio">
            <ReequilibrioIA />
          </TabsContent>

          {/* Gerador IA */}
          <TabsContent value="gerador" className="space-y-4">
            <GeradorIAComBase />
          </TabsContent>

          {/* Base Jurídica */}
          <TabsContent value="base-juridica">
            <BaseJuridicaUpload />
          </TabsContent>

          {/* Legislação */}
          <TabsContent value="legislacao">
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm">
              <h3 className="text-sm font-semibold mb-4">Referências Legais</h3>
              <div className="space-y-3">
                {[
                  { lei: 'Lei 14.133/2021', desc: 'Nova Lei de Licitações e Contratos Administrativos' },
                  { lei: 'LC 123/2006', desc: 'Estatuto da ME e EPP – tratamento diferenciado' },
                  { lei: 'Decreto 11.462/2023', desc: 'Regulamenta a Lei 14.133/2021 no âmbito federal' },
                  { lei: 'IN SEGES 73/2022', desc: 'Procedimentos para contratação de TIC' },
                  { lei: 'Lei 12.846/2013', desc: 'Lei Anticorrupção' },
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
