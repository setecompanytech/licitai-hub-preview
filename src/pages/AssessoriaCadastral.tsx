import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardCheck, FileText, CheckCircle2, Clock, AlertTriangle,
  ExternalLink, HelpCircle, Building2, Shield, RefreshCw
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
  { id: '1', nome: 'Sistema de Cadastramento Unificado de Fornecedores', sigla: 'SICAF', descricao: 'Cadastro federal obrigatório para licitações do Governo Federal', url: 'https://www.gov.br/compras/pt-br/sistemas/sicaf', status: 'ativo', validade: '2026-08-15', documentosPendentes: 0, progressoCadastro: 100 },
  { id: '2', nome: 'Cadastro Unificado de Fornecedores do Estado de SP', sigla: 'CAUFESP', descricao: 'Cadastro para participar de licitações do Estado de São Paulo', url: 'https://www.bec.sp.gov.br', status: 'pendente', validade: '2026-03-01', documentosPendentes: 3, progressoCadastro: 65 },
  { id: '3', nome: 'Sistema Integrado de Gestão Administrativa', sigla: 'SIGA/PA', descricao: 'Cadastro para fornecedores do Estado do Pará', url: '#', status: 'ativo', validade: '2026-12-31', documentosPendentes: 0, progressoCadastro: 100 },
  { id: '4', nome: 'Certificado de Registro Cadastral', sigla: 'CRC Municipal', descricao: 'Cadastro para licitações municipais de Belém', url: '#', status: 'expirado', validade: '2026-01-15', documentosPendentes: 5, progressoCadastro: 40 },
  { id: '5', nome: 'Cadastro Nacional de Empresas Inidôneas e Suspensas', sigla: 'CEIS', descricao: 'Consulta de impedimentos e penalidades', url: 'https://portaldatransparencia.gov.br/sancoes/ceis', status: 'ativo', documentosPendentes: 0, progressoCadastro: 100 },
  { id: '6', nome: 'Portal de Compras Públicas', sigla: 'PCP', descricao: 'Plataforma eletrônica de compras públicas', url: 'https://www.portaldecompraspublicas.com.br', status: 'nao_cadastrado', documentosPendentes: 8, progressoCadastro: 0 },
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

const statusConfig = {
  ativo: { label: 'Ativo', color: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
  pendente: { label: 'Pendente', color: 'bg-warning/15 text-warning border-warning/30', icon: Clock },
  expirado: { label: 'Expirado', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
  nao_cadastrado: { label: 'Não cadastrado', color: 'bg-muted text-muted-foreground border-border', icon: HelpCircle },
};

const docStatusConfig: Record<string, { label: string; color: string }> = {
  ok: { label: 'OK', color: 'bg-success/15 text-success border-success/30' },
  vencer: { label: 'A vencer', color: 'bg-warning/15 text-warning border-warning/30' },
  pendente: { label: 'Pendente', color: 'bg-info/15 text-info border-info/30' },
  expirado: { label: 'Expirado', color: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function AssessoriaCadastral() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-accent" />
              Assessoria Cadastral
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Suporte para cadastro no SICAF, CAUFESP, SIGA e demais CRCs
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="stat-card text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-success" />
            <p className="text-lg font-bold">{cadastros.filter(c => c.status === 'ativo').length}</p>
            <p className="text-[10px] text-muted-foreground">Ativos</p>
          </div>
          <div className="stat-card text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-warning" />
            <p className="text-lg font-bold">{cadastros.filter(c => c.status === 'pendente').length}</p>
            <p className="text-[10px] text-muted-foreground">Pendentes</p>
          </div>
          <div className="stat-card text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold">{cadastros.filter(c => c.status === 'expirado').length}</p>
            <p className="text-[10px] text-muted-foreground">Expirados</p>
          </div>
          <div className="stat-card text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-info" />
            <p className="text-lg font-bold">{cadastros.reduce((a, c) => a + c.documentosPendentes, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Docs Pendentes</p>
          </div>
        </div>

        <Tabs defaultValue="cadastros" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cadastros"><Building2 className="w-4 h-4 mr-1" /> Cadastros</TabsTrigger>
            <TabsTrigger value="documentos"><FileText className="w-4 h-4 mr-1" /> Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastros" className="space-y-3">
            {cadastros.map(c => {
              const cfg = statusConfig[c.status];
              const Icon = cfg.icon;
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">{c.sigla}</span>
                        <Badge variant="outline" className={cfg.color + ' text-[10px]'}>
                          <Icon className="w-3 h-3 mr-1" /> {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{c.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.descricao}</p>
                      {c.validade && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Validade: <span className="font-medium">{new Date(c.validade).toLocaleDateString('pt-BR')}</span>
                        </p>
                      )}
                      {c.status !== 'ativo' && c.status !== 'nao_cadastrado' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progresso do cadastro</span>
                            <span className="font-medium">{c.progressoCadastro}%</span>
                          </div>
                          <Progress value={c.progressoCadastro} className="h-2" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 ml-4">
                      {c.status === 'nao_cadastrado' ? (
                        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                          <ClipboardCheck className="w-3 h-3 mr-1" /> Iniciar Cadastro
                        </Button>
                      ) : c.status === 'expirado' ? (
                        <Button size="sm" className="bg-warning hover:bg-warning/90 text-warning-foreground">
                          <RefreshCw className="w-3 h-3 mr-1" /> Renovar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-3 h-3 mr-1" /> Acessar Portal
                        </Button>
                      )}
                      {c.documentosPendentes > 0 && (
                        <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px] justify-center">
                          {c.documentosPendentes} docs pendentes
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="documentos">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Documentos para Habilitação</h3>
              <div className="space-y-2">
                {documentosNecessarios.map((doc, i) => {
                  const cfg = docStatusConfig[doc.status];
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.nome}</p>
                          <p className="text-xs text-muted-foreground">{doc.portal}{doc.validade ? ` • Validade: ${new Date(doc.validade).toLocaleDateString('pt-BR')}` : ''}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cfg.color + ' text-[10px]'}>{cfg.label}</Badge>
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
