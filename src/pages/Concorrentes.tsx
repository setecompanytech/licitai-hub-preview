import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle, CheckCircle, Trophy, XCircle, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConsultaCNPJ from '@/components/concorrentes/ConsultaCNPJ';
import ConsultaSintegra from '@/components/concorrentes/ConsultaSintegra';
import CertidoesNegativas from '@/components/concorrentes/CertidoesNegativas';
import AnaliseDocsConcorrente from '@/components/documentos/AnaliseDocsConcorrente';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Concorrente = {
  id: string;
  razao_social: string;
  cnpj: string;
  nome_fantasia: string | null;
  capital_social: number | null;
  situacao: string | null;
  notas: string | null;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function Concorrentes() {
  const { user } = useAuth();
  const [concorrentes, setConcorrentes] = useState<Concorrente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('concorrentes')
      .select('id, razao_social, cnpj, nome_fantasia, capital_social, situacao, notas')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setConcorrentes(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Análise de Concorrentes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inteligência competitiva baseada em dados do SICAF e portais públicos
        </p>
      </div>

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista">Concorrentes ({concorrentes.length})</TabsTrigger>
          <TabsTrigger value="consulta-cnpj">Consulta CNPJ</TabsTrigger>
          <TabsTrigger value="sintegra">SINTEGRA</TabsTrigger>
          <TabsTrigger value="certidoes">Certidões Negativas</TabsTrigger>
          <TabsTrigger value="analise-docs">Análise de Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : concorrentes.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum concorrente cadastrado ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Use a aba "Consulta CNPJ" para pesquisar e adicionar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {concorrentes.map((c, i) => (
                <div
                  key={c.id}
                  className="bg-card rounded-xl border border-border/50 p-5 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold">{c.nome_fantasia || c.razao_social}</h3>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{c.cnpj}</p>
                    </div>
                    {c.situacao && (
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5',
                        c.situacao === 'ATIVA' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                      )}>
                        {c.situacao}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <DollarSign className="w-4 h-4 mx-auto text-accent mb-1" />
                      <p className="text-sm font-bold">{c.capital_social ? formatCurrency(c.capital_social) : '-'}</p>
                      <p className="text-[10px] text-muted-foreground">Capital Social</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <Shield className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-bold">{c.razao_social.length > 15 ? c.razao_social.slice(0, 15) + '...' : c.razao_social}</p>
                      <p className="text-[10px] text-muted-foreground">Razão Social</p>
                    </div>
                  </div>

                  {c.notas && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/30 line-clamp-2">{c.notas}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="consulta-cnpj">
          <ConsultaCNPJ />
        </TabsContent>

        <TabsContent value="sintegra">
          <ConsultaSintegra />
        </TabsContent>

        <TabsContent value="certidoes">
          <CertidoesNegativas />
        </TabsContent>

        <TabsContent value="analise-docs">
          <AnaliseDocsConcorrente />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
