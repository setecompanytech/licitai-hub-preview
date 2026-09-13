import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Loader2, Building2, ExternalLink, Download, Calendar, AlertTriangle, Inbox,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/download-utils';
import { mascaraCNPJ, isValidCNPJ } from '@/lib/financeiro/formatters';

/**
 * Consulta federal (Portal da Transparência) — componente interno da aba
 * Consultas da Análise de mercado: começa direto no conteúdo.
 */

const formatCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
};

export default function ContratosTransparencia() {
  const [tipo, setTipo] = useState<'contratos' | 'licitacoes'>('contratos');
  const [cnpjBusca, setCnpjBusca] = useState('');
  // A API federal filtra por CNPJ do contratado ou por código SIAFI do órgão
  // — UF nunca foi filtro aceito por estes endpoints (spec conferida em
  // 08/09); o seletor de UF que havia aqui não filtrava nada.
  const [orgaoBusca, setOrgaoBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [erro, setErro] = useState('');

  const handleBuscar = async () => {
    // Dígito verificador ANTES da viagem: um CNPJ com algarismos trocados
    // (33.743… em vez de 33.734…, o caso de 08/09) voltava da API federal
    // como erro genérico. Conferir aqui dá resposta imediata e clara.
    const digitos = cnpjBusca.replace(/\D/g, '');
    if (digitos.length > 0 && !isValidCNPJ(digitos)) {
      setErro('CNPJ inválido — confira os dígitos (é comum inverter dois algarismos).');
      setDados([]);
      return;
    }
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
      setBuscou(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Consulta federal — Portal da Transparência
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="federal-tipo" className="text-sm font-medium text-foreground">O que consultar</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as 'contratos' | 'licitacoes')}>
              <SelectTrigger id="federal-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contratos">Contratos federais</SelectItem>
                <SelectItem value="licitacoes">Licitações federais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="federal-cnpj" className="text-sm font-medium text-foreground">CNPJ do contratado</label>
            <Input
              id="federal-cnpj"
              placeholder="Opcional"
              value={cnpjBusca}
              inputMode="numeric"
              aria-invalid={erro ? true : undefined}
              onChange={(e) => setCnpjBusca(mascaraCNPJ(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="federal-orgao" className="text-sm font-medium text-foreground">Código do órgão SIAFI</label>
            <Input
              id="federal-orgao"
              placeholder="Ex.: 26403"
              value={orgaoBusca}
              onChange={(e) => setOrgaoBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleBuscar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="success">API pública</Badge>
          <span>Contratos: por CNPJ ou órgão · Licitações: exigem o código do órgão · janela de 6 meses</span>
          <a href="https://portaldatransparencia.gov.br" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Portal da Transparência
          </a>
        </div>
      </div>

      {buscou && !loading && !erro && dados.length === 0 && (
        <Card>
          <EstadoVazio
            icone={<Inbox />}
            titulo="Nenhum resultado para estes filtros"
            descricao="A janela consultada é de 6 meses. Licitações exigem o código do órgão SIAFI; contratos aceitam CNPJ ou órgão."
          />
        </Card>
      )}

      {/* Resultados */}
      {dados.length > 0 && (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <h3 className="text-lg font-semibold text-foreground">
              {dados.length} resultado(s) — {tipo === 'contratos' ? 'contratos' : 'licitações'} federais
            </h3>
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
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          <ul className="max-h-[500px] divide-y divide-border overflow-y-auto">
            {dados.slice(0, 50).map((item: any, i: number) => (
              <li key={i} className="p-4 transition-colors hover:bg-muted">
                {tipo === 'contratos' ? (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-base font-medium text-foreground">{item.objeto || 'Sem descrição'}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" aria-hidden="true" /> {item.unidadeGestora?.nome || 'Não informado'}
                        </span>
                        {item.fornecedor?.nome && (
                          <span className="text-sm text-muted-foreground">
                            → {item.fornecedor.nome}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {item.valorInicial && (
                        <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(item.valorInicial)}</p>
                      )}
                      {item.dataInicioVigencia && (
                        <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {item.dataInicioVigencia}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-base font-medium text-foreground">{item.objeto || 'Sem descrição'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" aria-hidden="true" /> {item.unidadeGestora?.nome || 'Não informado'}
                        </span>
                        {item.modalidadeLicitacao?.descricao && (
                          <Badge variant="info">{item.modalidadeLicitacao.descricao}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {item.valorEstimado && (
                        <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(item.valorEstimado)}</p>
                      )}
                      {item.dataAbertura && (
                        <p className="text-xs text-muted-foreground">{item.dataAbertura}</p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
