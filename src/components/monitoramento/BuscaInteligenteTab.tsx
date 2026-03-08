import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Send, Sparkles, Search, Download, ExternalLink, Loader2,
  Building2, MapPin, Calendar, DollarSign, Filter,
  ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Resultado = {
  titulo: string;
  orgao: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_abertura: string | null;
  data_publicacao: string | null;
  portal: string;
  url: string;
  numero: string;
  cnpj_orgao?: string;
  ano_compra?: string;
  seq_compra?: string;
  pncp_numero?: string;
  fonte_real: boolean;
  tem_download: boolean;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'resultados';
  content: string;
  resultados?: Resultado[];
  portais?: string[];
  total?: number;
};

const PORTAIS_OPCOES = [
  // Federais / API
  { id: 'pncp', label: 'PNCP (API oficial)', group: 'federal' },
  { id: 'comprasnet', label: 'Compras Governamentais', group: 'federal' },
  // Plataformas nacionais
  { id: 'bll', label: 'BLL Compras', group: 'plataforma' },
  { id: 'bnc', label: 'BNC', group: 'plataforma' },
  { id: 'licitacoese', label: 'Licitações-e (BB)', group: 'plataforma' },
  { id: 'portalcompras', label: 'Portal de Compras Públicas', group: 'plataforma' },
  { id: 'licitanet', label: 'Licitanet', group: 'plataforma' },
  { id: 'bbmnet', label: 'BBMNet', group: 'plataforma' },
  { id: 'comprasbr', label: 'ComprasBR', group: 'plataforma' },
  { id: 'licitardigital', label: 'Licitar Digital', group: 'plataforma' },
  // Estaduais
  { id: 'becsp', label: 'BEC/SP', group: 'estadual' },
  { id: 'comprasrj', label: 'Compras RJ', group: 'estadual' },
  { id: 'comprasmg', label: 'Compras MG', group: 'estadual' },
  { id: 'comprasba', label: 'ComprasNet BA', group: 'estadual' },
  { id: 'comprasce', label: 'Compras CE', group: 'estadual' },
  { id: 'compraspe', label: 'PE Integrado', group: 'estadual' },
  { id: 'comprasgo', label: 'ComprasNet GO', group: 'estadual' },
  { id: 'compraspr', label: 'Compras PR', group: 'estadual' },
  { id: 'comprasrs', label: 'Compras RS', group: 'estadual' },
  { id: 'comprassc', label: 'Compras SC', group: 'estadual' },
  { id: 'banparanet', label: 'Banparanet PA', group: 'estadual' },
  { id: 'comprasam', label: 'e-Compras AM', group: 'estadual' },
  { id: 'comprases', label: 'Compras ES', group: 'estadual' },
  { id: 'comprasdf', label: 'e-Compras DF', group: 'estadual' },
  { id: 'comprasmt', label: 'Compras MT', group: 'estadual' },
  { id: 'comprasms', label: 'Compras MS', group: 'estadual' },
  { id: 'comprasto', label: 'Compras TO', group: 'estadual' },
  { id: 'comprasma', label: 'Compras MA', group: 'estadual' },
  { id: 'comprasro', label: 'ComprasNet RO', group: 'estadual' },
];

const UFS = [
  '', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS',
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BuscaInteligenteTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [uf, setUf] = useState('');
  const [portaisSelecionados, setPortaisSelecionados] = useState<string[]>(['pncp']);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const togglePortal = (id: string) => {
    setPortaisSelecionados(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSearch = async (text?: string) => {
    const query = text || input;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-editais-ia`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            query,
            uf: uf || undefined,
            portais: portaisSelecionados.length > 0 ? portaisSelecionados : ['pncp'],
            com_analise_ia: true,
            limite: 30,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) toast.error('Limite de requisições atingido.');
        else if (response.status === 402) toast.error('Créditos insuficientes.');
        else toast.error('Erro na busca.');
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        if (data.analise_ia) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.analise_ia }]);
        }
        if (data.resultados?.length > 0) {
          setMessages(prev => [...prev, {
            role: 'resultados',
            content: `${data.total} editais encontrados em ${data.portais_consultados?.join(', ') || 'portais'}`,
            resultados: data.resultados,
            portais: data.portais_consultados,
            total: data.total,
          }]);
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Nenhum edital encontrado para **"${query}"**. Tente ampliar os termos ou selecionar mais portais.`,
          }]);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Erro na busca: ${data.error || 'Erro desconhecido'}`,
        }]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao conectar com o serviço');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (resultado: Resultado) => {
    if (!resultado.url) return;
    setDownloadingUrl(resultado.url);

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-edital`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            url: resultado.url,
            numero: resultado.numero,
            orgao: resultado.orgao,
            objeto: resultado.titulo,
            portal: resultado.portal,
            cnpjOrgao: resultado.cnpj_orgao,
            anoCompra: resultado.ano_compra,
            sequencialCompra: resultado.seq_compra,
            pncpNumero: resultado.pncp_numero,
          }),
        }
      );

      if (!response.ok) {
        window.open(resultado.url, '_blank');
        toast.info('Edital aberto no portal oficial.');
        return;
      }

      const data = await response.json();
      if (data.tipo === 'arquivo_direto' && data.arquivo?.conteudo_base64) {
        const byteChars = atob(data.arquivo.conteudo_base64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArray], { type: data.arquivo.content_type || 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = data.arquivo.nome || 'edital.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.success('Download concluído!');
      } else if (data.tipo === 'download_urls' && data.documentos?.[0]?.url) {
        window.open(data.documentos[0].url, '_blank');
        toast.success(`Abrindo: ${data.documentos[0].nome}`);
      } else {
        window.open(resultado.url, '_blank');
        toast.info('Edital aberto no portal.');
      }
    } catch {
      window.open(resultado.url, '_blank');
      toast.info('Edital aberto no portal.');
    } finally {
      setDownloadingUrl(null);
    }
  };

  const sugestoes = [
    'Busque editais de pavimentação em PA',
    'Licitações de TI acima de R$ 500 mil',
    'Pregões eletrônicos de saúde em SP',
    'Obras de saneamento no Nordeste',
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-3 shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs"
          onClick={() => setShowFilters(!showFilters)}
        >
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filtros e portais ({portaisSelecionados.length} selecionados)
            {uf && <Badge variant="outline" className="text-[10px] ml-1">{uf}</Badge>}
          </span>
          {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>

        {showFilters && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block">UF</label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todas</SelectItem>
                    {UFS.filter(Boolean).map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-2 block">Portais de busca</label>
              {(['federal', 'plataforma', 'estadual'] as const).map(group => {
                const groupPortais = PORTAIS_OPCOES.filter(p => p.group === group);
                const groupLabel = group === 'federal' ? '🏛️ Federais' : group === 'plataforma' ? '🌐 Plataformas' : '📍 Estaduais';
                const allSelected = groupPortais.every(p => portaisSelecionados.includes(p.id));
                const toggleGroup = () => {
                  if (allSelected) {
                    setPortaisSelecionados(prev => prev.filter(id => !groupPortais.some(p => p.id === id)));
                  } else {
                    setPortaisSelecionados(prev => [...new Set([...prev, ...groupPortais.map(p => p.id)])]);
                  }
                };
                return (
                  <div key={group} className="mb-2">
                    <button
                      onClick={toggleGroup}
                      className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {groupLabel}
                      <span className="text-[9px] text-muted-foreground/60">
                        ({groupPortais.filter(p => portaisSelecionados.includes(p.id)).length}/{groupPortais.length})
                      </span>
                    </button>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                      {groupPortais.map(p => (
                        <label
                          key={p.id}
                          className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                            portaisSelecionados.includes(p.id)
                              ? 'bg-accent/10 border-accent/40 text-accent'
                              : 'bg-muted/30 border-border/30 hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={portaisSelecionados.includes(p.id)}
                            onCheckedChange={() => togglePortal(p.id)}
                            className="h-3 w-3"
                          />
                          <span className="truncate">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-3 mt-1">
                <Button
                  variant="link"
                  size="sm"
                  className="text-[10px] h-auto p-0"
                  onClick={() => setPortaisSelecionados(PORTAIS_OPCOES.map(p => p.id))}
                >
                  Marcar todos
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="text-[10px] h-auto p-0 text-muted-foreground"
                  onClick={() => setPortaisSelecionados([])}
                >
                  Desmarcar todos
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm min-h-[500px] flex flex-col">
        <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-lg font-semibold mb-2">O que você procura?</h2>
              <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                Descreva o que busca e a IA pesquisará automaticamente nos portais selecionados, trazendo editais reais com opção de download direto.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {sugestoes.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(s)}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left text-xs"
                  >
                    <Search className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => {
                if (msg.role === 'user') {
                  return (
                    <div key={i} className="flex justify-end animate-fade-in">
                      <div className="max-w-[80%] rounded-xl px-4 py-3 text-sm bg-primary text-primary-foreground">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'assistant') {
                  return (
                    <div key={i} className="flex justify-start animate-fade-in">
                      <div className="max-w-[90%] rounded-xl px-4 py-3 text-sm bg-muted prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'resultados' && msg.resultados) {
                  return (
                    <div key={i} className="animate-fade-in space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>{msg.content}</span>
                      </div>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {msg.resultados.map((r, j) => (
                          <div
                            key={j}
                            className="bg-muted/40 rounded-lg border border-border/30 p-3 hover:border-accent/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium line-clamp-2">{r.titulo}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {r.orgao}
                                  </span>
                                  {r.uf && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> {r.municipio ? `${r.municipio}/${r.uf}` : r.uf}
                                    </span>
                                  )}
                                  {r.valor_estimado && (
                                    <span className="flex items-center gap-1 text-accent font-medium">
                                      <DollarSign className="w-3 h-3" /> {formatCurrency(r.valor_estimado)}
                                    </span>
                                  )}
                                  {r.data_abertura && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" /> {r.data_abertura}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1.5 mt-1.5">
                                  <Badge variant="outline" className="text-[9px] h-4">
                                    {r.portal}
                                  </Badge>
                                  <Badge variant="outline" className="text-[9px] h-4">
                                    {r.modalidade}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => handleDownload(r)}
                                  disabled={downloadingUrl === r.url}
                                >
                                  {downloadingUrl === r.url ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <><Download className="w-3 h-3 mr-1" /> Baixar</>
                                  )}
                                </Button>
                                {r.url && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[10px] px-2"
                                    onClick={() => window.open(r.url, '_blank')}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" /> Portal
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span className="text-muted-foreground">Buscando nos portais...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        <div className="border-t border-border/50 p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            className="flex gap-2"
          >
            <Input
              placeholder="Ex: pavimentação em Belém, material hospitalar SP, TI federal..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-accent text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
