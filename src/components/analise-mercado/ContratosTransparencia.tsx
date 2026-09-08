import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Loader2, Building2, FileText, ExternalLink,
  Download, ShieldCheck, ShieldAlert, DollarSign, Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/download-utils';
import { mascaraCNPJ } from '@/lib/financeiro/formatters';

type ContratoFederal = {
  id?: string;
  dataInicioVigencia?: string;
  dataFimVigencia?: string;
  valorInicial?: number;
  objeto?: string;
  fornecedor?: { nome?: string; cnpjFormatado?: string };
  unidadeGestora?: { nome?: string; codigoOrgao?: string };
  modalidadeCompra?: { descricao?: string };
  situacaoContrato?: string;
};

type LicitacaoFederal = {
  id?: string;
  dataAbertura?: string;
  objeto?: string;
  valorEstimado?: number;
  modalidadeLicitacao?: { descricao?: string };
  unidadeGestora?: { nome?: string };
  situacao?: string;
};

const formatCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
};

export default function ContratosTransparencia() {
  const [tipo, setTipo] = useState<'contratos' | 'licitacoes'>('contratos');
  const [busca, setBusca] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  // A API federal filtra por CNPJ do contratado ou por código SIAFI do órgão
  // — UF nunca foi filtro aceito por estes endpoints (spec conferida em
  // 08/09); o seletor de UF que havia aqui não filtrava nada.
  const [orgaoBusca, setOrgaoBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [erro, setErro] = useState('');

  const handleBuscar = async () => {
    setLoading(true);
    setErro('');
    setDados([]);

    try {
      const now = new Date();
      const dataFim = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const inicio = new Date(now);
      inicio.setMonth(inicio.getMonth() - 6);
      const dataInicio = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const { data, error } = await supabase.functions.invoke('consulta-transparencia', {
        body: {
          tipo,
          cnpj: cnpjBusca || undefined,
          orgao: orgaoBusca.trim() || undefined,
          dataInicio,
          dataFim,
        },
      });

      if (error) throw error;
      if (data.error) {
        setErro(data.error);
      } else {
        setDados(data.dados || []);
        if ((data.dados || []).length === 0) {
          toast.info('Nenhum resultado encontrado para os filtros informados.');
        } else {
          toast.success(`${data.dados.length} resultado(s) encontrado(s)!`);
        }
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao consultar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          Consulta Federal – Portal da Transparência
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contratos">Contratos Federais</SelectItem>
              <SelectItem value="licitacoes">Licitações Federais</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="CNPJ do contratado (opcional)"
            value={cnpjBusca}
            inputMode="numeric"
            onChange={(e) => setCnpjBusca(mascaraCNPJ(e.target.value))}
          />

          <Input
            placeholder="Código do órgão SIAFI (ex.: 26403)"
            value={orgaoBusca}
            onChange={(e) => setOrgaoBusca(e.target.value)}
          />

          <Button onClick={handleBuscar} disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <ShieldAlert className="w-4 h-4" /> {erro}
          </div>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
            API Pública
          </Badge>
          <span>Contratos: por CNPJ ou órgão · Licitações: exigem o código do órgão · janela de 6 meses</span>
          <a href="https://portaldatransparencia.gov.br" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-accent">
            <ExternalLink className="w-3 h-3" /> Portal da Transparência
          </a>
        </div>
      </div>

      {/* Resultados */}
      {dados.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <h4 className="text-sm font-semibold">
              {dados.length} resultado(s) – {tipo === 'contratos' ? 'Contratos' : 'Licitações'} Federais
            </h4>
            <Button size="sm" variant="outline" onClick={() => {
              downloadCSV(
                `transparencia-${tipo}`,
                tipo === 'contratos'
                  ? ['Órgão', 'Fornecedor', 'CNPJ', 'Objeto', 'Valor', 'Vigência']
                  : ['Órgão', 'Modalidade', 'Objeto', 'Valor Estimado', 'Data Abertura'],
                dados.map((d: any) => tipo === 'contratos'
                  ? [
                    d.unidadeGestora?.nome || '',
                    d.fornecedor?.nome || '',
                    d.fornecedor?.cnpjFormatado || '',
                    (d.objeto || '').substring(0, 100),
                    String(d.valorInicial || 0),
                    `${d.dataInicioVigencia || ''} a ${d.dataFimVigencia || ''}`,
                  ]
                  : [
                    d.unidadeGestora?.nome || '',
                    d.modalidadeLicitacao?.descricao || '',
                    (d.objeto || '').substring(0, 100),
                    String(d.valorEstimado || 0),
                    d.dataAbertura || '',
                  ]
                )
              );
              toast.success('CSV exportado!');
            }}>
              <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
            </Button>
          </div>

          <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
            {dados.slice(0, 50).map((item: any, i: number) => (
              <div key={i} className="p-4 hover:bg-muted/30 transition-colors">
                {tipo === 'contratos' ? (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-2">{item.objeto || 'Sem descrição'}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {item.unidadeGestora?.nome || 'N/I'}
                          </span>
                          {item.fornecedor?.nome && (
                            <span className="text-xs text-muted-foreground">
                              → {item.fornecedor.nome}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        {item.valorInicial && (
                          <p className="text-sm font-bold text-foreground">{formatCurrency(item.valorInicial)}</p>
                        )}
                        {item.dataInicioVigencia && (
                          <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
                            <Calendar className="w-3 h-3" />
                            {item.dataInicioVigencia}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-2">{item.objeto || 'Sem descrição'}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {item.unidadeGestora?.nome || 'N/I'}
                          </span>
                          {item.modalidadeLicitacao?.descricao && (
                            <Badge variant="outline" className="text-xs">
                              {item.modalidadeLicitacao.descricao}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        {item.valorEstimado && (
                          <p className="text-sm font-bold text-foreground">{formatCurrency(item.valorEstimado)}</p>
                        )}
                        {item.dataAbertura && (
                          <p className="text-xs text-muted-foreground">{item.dataAbertura}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
