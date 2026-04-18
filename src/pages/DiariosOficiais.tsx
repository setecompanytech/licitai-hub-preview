import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, ExternalLink, Loader2, RefreshCw, Calendar as CalendarIcon,
  FileText, MapPin, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Diario {
  id: string;
  fonte: string;
  data_publicacao: string;
  edicao: string | null;
  secao: string | null;
  uf: string | null;
  municipio: string | null;
  orgao: string | null;
  tipo_publicacao: string | null;
  modalidade: string | null;
  numero_processo: string | null;
  objeto: string | null;
  valor_estimado: number | null;
  link_html: string | null;
  link_pdf: string | null;
  total_count: number;
  rank_busca: number;
}

const FONTES = ['DOU', 'DOE-PA', 'DOE-SP', 'DOE-RJ', 'DOE-MG', 'DOE-RS', 'DOE-BA'];
const TIPOS = [
  { v: 'aviso_licitacao', l: 'Aviso de Licitação' },
  { v: 'aviso_dispensa', l: 'Aviso de Dispensa' },
  { v: 'extrato_contrato', l: 'Extrato de Contrato' },
  { v: 'homologacao', l: 'Homologação' },
  { v: 'ata_registro_precos', l: 'Ata de Registro de Preços' },
  { v: 'credenciamento', l: 'Credenciamento' },
  { v: 'resultado_licitacao', l: 'Resultado de Licitação' },
];

const PAGE_SIZE = 20;

export default function DiariosOficiais() {
  const [q, setQ] = useState('');
  const [fonte, setFonte] = useState<string>('all');
  const [uf, setUf] = useState<string>('all');
  const [tipo, setTipo] = useState<string>('all');
  const [pagina, setPagina] = useState(1);
  const [resultados, setResultados] = useState<Diario[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<any>(null);

  const carregarStatus = useCallback(async () => {
    const { data } = await supabase.rpc('diarios_status_sincronizacao' as any);
    if (data) setStatus(data);
  }, []);

  useEffect(() => { carregarStatus(); }, [carregarStatus]);

  const buscar = useCallback(async (paginaAlvo = 1) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('busca_diarios_instantanea' as any, {
        p_q: q.trim() || null,
        p_fonte: fonte === 'all' ? null : fonte,
        p_uf: uf === 'all' ? null : uf,
        p_tipo: tipo === 'all' ? null : tipo,
        p_pagina: paginaAlvo,
        p_tamanho: PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as Diario[];
      setResultados(rows);
      setTotal(rows[0]?.total_count ? Number(rows[0].total_count) : 0);
      setPagina(paginaAlvo);
    } catch (err: any) {
      toast.error('Erro na busca: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [q, fonte, uf, tipo]);

  const sincronizar = async () => {
    setSyncing(true);
    try {
      toast.info('Sincronizando Diários Oficiais... pode levar 1-2 minutos.');
      const { data, error } = await supabase.functions.invoke('dou-diarios-sync', {
        body: {},
      });
      if (error) throw error;
      toast.success(
        `Sincronização concluída: ${data?.total_inseridos || 0} publicações novas, ` +
        `${data?.total_erros || 0} erros.`
      );
      await carregarStatus();
      await buscar(1);
    } catch (err: any) {
      toast.error('Erro na sincronização: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppLayout>
      <div className="space-y-4 p-4 max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Diários Oficiais
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Avisos de licitação, contratos e homologações publicados no DOU e DOEs estaduais.
            </p>
          </div>
          <Button onClick={sincronizar} disabled={syncing} variant="outline" size="sm">
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar agora
          </Button>
        </header>

        {status && (
          <Card className="bg-muted/30">
            <CardContent className="p-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Total no cache:</span> <strong>{status.total_diarios || 0}</strong></div>
              <div><span className="text-muted-foreground">Mais recente:</span> <strong>{status.mais_recente || '—'}</strong></div>
              {status.por_fonte && Object.entries(status.por_fonte).map(([f, n]) => (
                <div key={f}><span className="text-muted-foreground">{f}:</span> <strong>{String(n)}</strong></div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filtros de Busca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <Label className="text-xs">Termo de busca</Label>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscar(1)}
                  placeholder="ex.: pregão, medicamentos, obras..."
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Fonte</Label>
                <Select value={fonte} onValueChange={setFonte}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {FONTES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => buscar(1)} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Buscar
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando...
            </div>
          )}
          {!loading && resultados.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma publicação encontrada. Ajuste os filtros ou clique em "Sincronizar agora".
            </CardContent></Card>
          )}
          {!loading && resultados.map((d) => (
            <Card key={d.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Badge variant="secondary">{d.fonte}</Badge>
                  {d.tipo_publicacao && <Badge variant="outline">{d.tipo_publicacao.replace(/_/g, ' ')}</Badge>}
                  {d.uf && <Badge variant="outline" className="gap-1"><MapPin className="w-3 h-3" />{d.uf}</Badge>}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {format(parseISO(d.data_publicacao), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground line-clamp-2">{d.objeto || 'Sem descrição'}</div>
                {d.orgao && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />{d.orgao}
                  </div>
                )}
                {d.link_html && (
                  <a href={d.link_html} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" /> Abrir publicação original
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-xs text-muted-foreground">
              Página {pagina} de {totalPaginas} • {total} resultados
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={pagina <= 1 || loading}
                onClick={() => buscar(pagina - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={pagina >= totalPaginas || loading}
                onClick={() => buscar(pagina + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
