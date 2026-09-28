import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calculator, FileText, Download, Copy, Sparkles, Search,
  BookOpen, BarChart3, ClipboardList, DollarSign, FileWarning
} from 'lucide-react';
import { CATEGORIAS_CONTABEIS, MODELOS_CONTABEIS, REFERENCIAS_CONTABEIS, htmlDoRoteiro, nomeDoArquivoDoModelo, roteiroEmTexto, type ModeloContabil } from '@/lib/contabil/modelos';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import AnaliseBalancoIA from '@/components/apoio-contabil/AnaliseBalancoIA';
import GeradorContabilIA from '@/components/apoio-contabil/GeradorContabilIA';
import BaseContabilUpload from '@/components/apoio-contabil/BaseContabilUpload';

const ICONE_DA_CATEGORIA: Record<string, typeof FileText> = { 'Precificação': DollarSign, 'Pareceres': BarChart3, 'Habilitação': ClipboardList, 'Tributário': Calculator };
const ICONE_DO_MODELO: Record<string, typeof FileText> = { '2': Calculator, '3': FileWarning, '5': ClipboardList, '9': FileText };

export default function ApoioContabil() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('modelos');
  // O modelo escolhido em "Gerar com IA" vai pré-preenchido para o Gerador.
  const [modeloParaGerar, setModeloParaGerar] = useState<ModeloContabil | null>(null);

  // Os três botões de cada modelo (28/09/2026): antes não faziam nada.
  const baixar = (m: ModeloContabil) => {
    const blob = new Blob(['\ufeff', htmlDoRoteiro(m)], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeDoArquivoDoModelo(m);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copiar = async (m: ModeloContabil) => {
    try { await navigator.clipboard.writeText(roteiroEmTexto(m)); toast.success('Roteiro copiado'); } catch { toast.info('Copie o roteiro', { description: roteiroEmTexto(m) }); }
  };
  const gerar = (m: ModeloContabil) => { setModeloParaGerar(m); setActiveTab('gerador'); };

  const filteredModelos = MODELOS_CONTABEIS.filter(
    (m) =>
      m.titulo.toLowerCase().includes(search.toLowerCase()) ||
      m.categoria.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina
          icone={<Calculator />}
          titulo="Apoio Contábil Especializado"
          descricao="Análises contábeis, tributárias e precificação assistida por IA — NBC, CFC, Lei 14.133/2021"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="gap-1">
              <BookOpen className="w-3 h-3" aria-hidden="true" /> NBC · CFC
            </Badge>
            {/* Módulo de IA (Design System v3): o selo "Praefectus IA" ocupa
                o lugar do antigo chip "IA Contábil". */}
            <SeloPraefectusIA />
          </div>
        </CabecalhoPagina>

        {/* Fila sublinhada que rola quando não cabe — rótulos inteiros. */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-nowrap overflow-x-auto [scrollbar-width:thin]">
            <TabsTrigger value="modelos" className="shrink-0">Modelos e Templates</TabsTrigger>
            <TabsTrigger value="analise-balanco" className="shrink-0">Análise de Balanço IA</TabsTrigger>
            <TabsTrigger value="gerador" className="shrink-0">Gerador IA</TabsTrigger>
            <TabsTrigger value="legislacao" className="shrink-0">Legislação Contábil</TabsTrigger>
            <TabsTrigger value="base-contabil" className="shrink-0">Base Contábil IA</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos" className="space-y-6">
            <div className="w-full max-w-md space-y-2">
              <Label htmlFor="busca-modelo">Buscar modelo</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="busca-modelo"
                  placeholder="Buscar modelo ou categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {filteredModelos.length === 0 && (
              <EstadoVazio
                icone={<Search />}
                titulo="Nenhum modelo encontrado"
                descricao={`Nenhum modelo ou categoria corresponde a "${search}".`}
                acao={
                  <Button variant="outline" onClick={() => setSearch('')}>
                    Limpar busca
                  </Button>
                }
              />
            )}

            {CATEGORIAS_CONTABEIS.map((cat) => {
              const items = filteredModelos.filter((m) => m.categoria === cat);
              if (items.length === 0) return null;
              return (
                <section key={cat} className="space-y-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" /> {cat}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((m) => {
                      const Icone = ICONE_DO_MODELO[m.id] ?? ICONE_DA_CATEGORIA[m.categoria] ?? FileText;
                      return (
                        <div key={m.id} className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid={`modelo-${m.id}`}>
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-md bg-primary-tint text-primary flex items-center justify-center flex-shrink-0">
                              <Icone className="w-5 h-5" aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base text-foreground">{m.titulo}</p>
                              <p className="text-sm text-muted-foreground mt-1">{m.descricao}</p>
                              <a href={m.fundamentacaoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex" title="Abrir o texto oficial">
                                <Badge variant="muted" className="gap-1">{m.fundamentacao} <ExternalLink className="h-3 w-3" aria-hidden="true" /></Badge>
                              </a>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button variant="outline" className="flex-1" onClick={() => baixar(m)} title="Baixa o roteiro do modelo em Word, com o fundamento">
                              <Download aria-hidden="true" /> Baixar
                            </Button>
                            <Button variant="outline" aria-label={`Copiar roteiro de ${m.titulo}`} onClick={() => copiar(m)}>
                              <Copy aria-hidden="true" />
                            </Button>
                            <Button onClick={() => gerar(m)}>
                              <Sparkles aria-hidden="true" /> Gerar com IA
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </TabsContent>

          <TabsContent value="analise-balanco">
            <AnaliseBalancoIA />
          </TabsContent>

          <TabsContent value="gerador" className="space-y-4">
            <GeradorContabilIA modeloInicial={modeloParaGerar} />
          </TabsContent>

          <TabsContent value="base-contabil">
            <BaseContabilUpload />
          </TabsContent>

          <TabsContent value="legislacao">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold leading-6 text-foreground">Referências Legais e Normativas</h2>
              <p className="mb-4 text-sm text-muted-foreground">Os fundamentos dos modelos, cada um ligado ao texto oficial. A Lei 14.133, a LC 123, a Lei 4.320 e as INs 5/2017 e 65/2021 também estão na base normativa (Apoio Jurídico › Base Jurídica), lidas todo dia, e a IA cita só o que está lá.</p>
              <div className="space-y-3">
                {REFERENCIAS_CONTABEIS.map((l) => (
                  <div key={l.rotulo} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3 transition-colors duration-150 hover:bg-muted/60">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{l.rotulo}</p>
                      <p className="text-sm text-muted-foreground">{l.descricao}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={l.url} target="_blank" rel="noreferrer"><BookOpen aria-hidden="true" /> Texto oficial <ExternalLink aria-hidden="true" /></a>
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
