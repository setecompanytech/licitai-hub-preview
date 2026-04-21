import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, FolderOpen, FileText, Calculator, Sparkles, Scale, Briefcase,
  ClipboardList, History, ExternalLink, Building2, Calendar, DollarSign, MapPin, Loader2
} from 'lucide-react';
import AnexosManager from '@/components/workspace/AnexosManager';
import DocumentosManager from '@/components/workspace/DocumentosManager';

interface Licitacao {
  id: string; numero: string | null; orgao: string | null; objeto: string | null;
  modalidade: string | null; status: string | null; valor_estimado: number | null;
  data_encerramento: string | null; uf: string | null; municipio: string | null;
}

const ATALHOS = [
  { label: 'Edital / Itens', path: '/precificacao', icon: FileText, descricao: 'Visualizar itens extraídos do edital' },
  { label: 'Precificação', path: '/precificacao', icon: Calculator, descricao: 'Calcular preços e composição de custos' },
  { label: 'Proposta Comercial', path: '/proposta-tecnica', icon: FileText, descricao: 'Editar proposta técnica e gerar PDF' },
  { label: 'AURÉLIA (IA)', path: '/aurelia', icon: Sparkles, descricao: 'Análise jurídica/contábil com IA' },
  { label: 'Apoio Jurídico', path: '/apoio-juridico', icon: Scale, descricao: 'Recursos, impugnações, esclarecimentos' },
  { label: 'Documentos', path: '/documentos', icon: Briefcase, descricao: 'Documentos de habilitação' },
  { label: 'Gestão Kanban', path: '/kanban', icon: ClipboardList, descricao: 'Status do processo no funil' },
];

export default function ProcessoWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lic, setLic] = useState<Licitacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, data_encerramento, uf, municipio')
      .eq('id', id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { setLic(data as Licitacao); setLoading(false); });
  }, [id, user]);

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!lic) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground mb-4">Processo não encontrado.</p>
      <Button onClick={() => navigate('/kanban')}>Voltar ao Kanban</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header da Pasta */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
            <FolderOpen className="w-6 h-6 text-accent" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{lic.numero || 'Processo'} {lic.orgao && `— ${lic.orgao}`}</h1>
              <p className="text-xs text-muted-foreground truncate">{lic.objeto}</p>
            </div>
            {lic.status && <Badge variant="outline">{lic.status}</Badge>}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {lic.modalidade && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {lic.modalidade}</span>}
            {lic.uf && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lic.municipio}/{lic.uf}</span>}
            {lic.data_encerramento && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Encerra: {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}</span>}
            {lic.valor_estimado != null && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> R$ {Number(lic.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 py-6">
        <Tabs defaultValue="visao" className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-6 mb-6 h-auto">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="modulos">Módulos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="info">Informações</TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="visao" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ATALHOS.map(a => (
                <Link key={a.label} to={`${a.path}?lid=${lic.id}`}>
                  <Card className="p-4 hover:border-accent transition cursor-pointer h-full">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                        <a.icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm flex items-center gap-1">
                          {a.label} <ExternalLink className="w-3 h-3 opacity-60" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          {/* Documentos editáveis */}
          <TabsContent value="documentos">
            <DocumentosManager licitacaoId={lic.id} />
          </TabsContent>

          {/* Anexos */}
          <TabsContent value="anexos">
            <AnexosManager licitacaoId={lic.id} />
          </TabsContent>

          {/* Módulos */}
          <TabsContent value="modulos">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Abrir em módulos completos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ATALHOS.map(a => (
                  <Button key={a.label} variant="outline" className="justify-start gap-2" asChild>
                    <Link to={`${a.path}?lid=${lic.id}`}>
                      <a.icon className="w-4 h-4" /> {a.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <Card className="p-8 text-center">
              <History className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">O histórico completo de movimentações será exibido aqui (próxima fase).</p>
            </Card>
          </TabsContent>

          {/* Informações */}
          <TabsContent value="info">
            <Card className="p-6 space-y-3">
              <div><span className="text-xs text-muted-foreground">Número:</span> <span className="font-medium">{lic.numero || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Órgão:</span> <span className="font-medium">{lic.orgao || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Modalidade:</span> <span className="font-medium">{lic.modalidade || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Local:</span> <span className="font-medium">{lic.municipio}/{lic.uf}</span></div>
              <div><span className="text-xs text-muted-foreground">Status:</span> <span className="font-medium">{lic.status || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Valor estimado:</span> <span className="font-medium">{lic.valor_estimado != null ? `R$ ${Number(lic.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</span></div>
              <div className="pt-3 border-t">
                <span className="text-xs text-muted-foreground">Objeto:</span>
                <p className="text-sm mt-1">{lic.objeto || '-'}</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
