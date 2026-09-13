import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import LinhaKpis from '@/components/shared/LinhaKpis';
import TarjaExemplo from '@/components/shared/TarjaExemplo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardCheck, FileText, CheckCircle2, Clock, AlertTriangle,
  ExternalLink, HelpCircle, Building2, RefreshCw
} from 'lucide-react';

type CadastroPortal = {
  id: string;
  nome: string;
  sigla: string;
  descricao: string;
  url: string;
  status: 'ativo' | 'pendente' | 'expirado' | 'nao_cadastrado';
  validade?: string;
  documentosPendentes: number;
  progressoCadastro: number;
};

const cadastros: CadastroPortal[] = [
  { id: '1', nome: 'Sistema de Cadastramento Unificado de Fornecedores', sigla: 'SICAF', descricao: 'Cadastro federal obrigatório para licitações do Governo Federal', url: 'https://www.gov.br/compras/pt-br/sistemas/sicaf-digital', status: 'ativo', validade: '2026-08-15', documentosPendentes: 0, progressoCadastro: 100 },
  { id: '2', nome: 'Cadastro Unificado de Fornecedores do Estado de SP', sigla: 'CAUFESP', descricao: 'Cadastro para participar de licitações do Estado de São Paulo', url: 'https://www.bec.sp.gov.br/BEC_Acesso_UI/Login/ui_login.aspx', status: 'pendente', validade: '2026-03-01', documentosPendentes: 3, progressoCadastro: 65 },
  { id: '3', nome: 'Sistema Integrado de Gestão Administrativa', sigla: 'SIGA/PA', descricao: 'Cadastro para fornecedores do Estado do Pará', url: 'https://www.compraspara.pa.gov.br', status: 'ativo', validade: '2026-12-31', documentosPendentes: 0, progressoCadastro: 100 },
  { id: '4', nome: 'Certificado de Registro Cadastral', sigla: 'CRC Municipal', descricao: 'Cadastro para licitações municipais de Belém', url: 'https://www.belem.pa.gov.br/licitacao/licitacao/consulta', status: 'expirado', validade: '2026-01-15', documentosPendentes: 5, progressoCadastro: 40 },
  { id: '5', nome: 'Cadastro Nacional de Empresas Inidôneas e Suspensas', sigla: 'CEIS', descricao: 'Consulta de impedimentos e penalidades', url: 'https://portaldatransparencia.gov.br/entenda-a-gestao-publica/ceis', status: 'ativo', documentosPendentes: 0, progressoCadastro: 100 },
  { id: '6', nome: 'Portal de Compras Públicas', sigla: 'PCP', descricao: 'Plataforma eletrônica de compras públicas', url: 'https://www.portaldecompraspublicas.com.br/fornecedor/cadastro', status: 'nao_cadastrado', documentosPendentes: 8, progressoCadastro: 0 },
];

const documentosNecessarios = [
  { nome: 'Certidão Negativa de Débitos Federais', portal: 'SICAF', status: 'ok', validade: '2026-06-15' },
  { nome: 'Certidão FGTS', portal: 'SICAF', status: 'ok', validade: '2026-04-20' },
  { nome: 'Certidão Negativa Trabalhista', portal: 'SICAF', status: 'vencer', validade: '2026-03-10' },
  { nome: 'Balanço Patrimonial', portal: 'CAUFESP', status: 'pendente', validade: '' },
  { nome: 'Atestado de Capacidade Técnica', portal: 'CAUFESP', status: 'pendente', validade: '' },
  { nome: 'Contrato Social Consolidado', portal: 'CRC Municipal', status: 'ok', validade: '' },
  { nome: 'Certidão Municipal de Tributos', portal: 'CRC Municipal', status: 'expirado', validade: '2026-01-30' },
];

/** Estado do cadastro → selo em tinta. Cor é reforço; o texto é a informação. */
const statusConfig = {
  ativo: { label: 'Ativo', variante: 'success' as const, icon: CheckCircle2 },
  pendente: { label: 'Pendente', variante: 'warning' as const, icon: Clock },
  expirado: { label: 'Expirado', variante: 'danger' as const, icon: AlertTriangle },
  nao_cadastrado: { label: 'Não cadastrado', variante: 'muted' as const, icon: HelpCircle },
};

const docStatusConfig: Record<string, { label: string; variante: 'success' | 'warning' | 'danger' | 'info' }> = {
  ok: { label: 'Regular', variante: 'success' },
  vencer: { label: 'A vencer', variante: 'warning' },
  pendente: { label: 'Pendente', variante: 'info' },
  expirado: { label: 'Expirado', variante: 'danger' },
};

export default function AssessoriaCadastral() {
  const ativos = cadastros.filter(c => c.status === 'ativo').length;
  const pendentes = cadastros.filter(c => c.status === 'pendente').length;
  const expirados = cadastros.filter(c => c.status === 'expirado').length;
  const docsPendentes = cadastros.reduce((a, c) => a + c.documentosPendentes, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Título, descrição, ícone e trilha vêm do registro
            `lib/navegacao/paginas.ts` pela própria rota. */}
        <CabecalhoPagina>
          {/* A tela inteira ainda é lista fixa no código: enquanto não ler o
              banco, ela se declara — cartão bonito com número inventado é
              mais convincente, não mais verdadeiro. */}
          <TarjaExemplo detalhe="Portais, validades e documentos ainda são lista fixa no código — esta tela não lê o banco." />
        </CabecalhoPagina>

        <LinhaKpis
          itens={[
            { rotulo: 'Ativos', valor: String(ativos), icone: CheckCircle2, tom: 'ok' },
            { rotulo: 'Pendentes', valor: String(pendentes), icone: Clock, tom: 'aviso' },
            { rotulo: 'Expirados', valor: String(expirados), icone: AlertTriangle, tom: 'aviso' },
            { rotulo: 'Documentos pendentes', valor: String(docsPendentes), icone: FileText, tom: 'info' },
          ]}
        />

        <Tabs defaultValue="cadastros" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cadastros"><Building2 className="w-4 h-4 mr-2" aria-hidden="true" /> Cadastros</TabsTrigger>
            <TabsTrigger value="documentos"><FileText className="w-4 h-4 mr-2" aria-hidden="true" /> Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastros" className="space-y-4">
            {cadastros.map(c => {
              const cfg = statusConfig[c.status];
              const Icon = cfg.icon;
              return (
                <Card key={c.id} className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-lg font-semibold">{c.sigla}</span>
                        <Badge variant={cfg.variante}>
                          <Icon className="w-3 h-3 mr-1" aria-hidden="true" /> {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-base text-foreground">{c.nome}</p>
                      <p className="text-sm text-muted-foreground mt-1">{c.descricao}</p>
                      {c.validade && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Validade: <span className="font-medium tabular-nums">{new Date(c.validade).toLocaleDateString('pt-BR')}</span>
                        </p>
                      )}
                      {c.status !== 'ativo' && c.status !== 'nao_cadastrado' && (
                        <div className="mt-3 max-w-sm">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Progresso do cadastro</span>
                            <span className="font-medium tabular-nums">{c.progressoCadastro}%</span>
                          </div>
                          <Progress value={c.progressoCadastro} className="h-2" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                      {c.status === 'nao_cadastrado' ? (
                        <Button size="sm" asChild>
                          <a href={c.url} target="_blank" rel="noopener noreferrer">
                            <ClipboardCheck className="w-4 h-4" aria-hidden="true" /> Iniciar cadastro
                          </a>
                        </Button>
                      ) : c.status === 'expirado' ? (
                        <Button size="sm" asChild>
                          <a href={c.url} target="_blank" rel="noopener noreferrer">
                            <RefreshCw className="w-4 h-4" aria-hidden="true" /> Renovar
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" asChild>
                          <a href={c.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" aria-hidden="true" /> Acessar portal
                          </a>
                        </Button>
                      )}
                      {c.documentosPendentes > 0 && (
                        <Badge variant="warning">{c.documentosPendentes} documentos pendentes</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="documentos">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Documentos para habilitação</h3>
              <div className="space-y-2">
                {documentosNecessarios.map((doc, i) => {
                  const cfg = docStatusConfig[doc.status];
                  return (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-base font-medium">{doc.nome}</p>
                          <p className="text-sm text-muted-foreground">{doc.portal}{doc.validade ? ` • Validade: ${new Date(doc.validade).toLocaleDateString('pt-BR')}` : ''}</p>
                        </div>
                      </div>
                      <Badge variant={cfg.variante}>{cfg.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
