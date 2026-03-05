import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code2, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sbnlovigyifvrkgsoalj'}.supabase.co/functions/v1/api-integracao`;

const endpoints = [
  { method: 'GET', path: '/health', desc: 'Status da API e listagem de endpoints', auth: false },
  { method: 'GET', path: '/licitacoes', desc: 'Listar licitações (paginado: ?page=1&limit=50&status=...)', auth: true },
  { method: 'GET', path: '/licitacoes/:id', desc: 'Detalhe de uma licitação', auth: true },
  { method: 'POST', path: '/licitacoes', desc: 'Criar licitação', auth: true },
  { method: 'PUT', path: '/licitacoes/:id', desc: 'Atualizar licitação', auth: true },
  { method: 'DELETE', path: '/licitacoes/:id', desc: 'Excluir licitação', auth: true },
  { method: 'GET', path: '/empresas', desc: 'Listar empresas do usuário', auth: true },
  { method: 'GET', path: '/empresas/:id', desc: 'Detalhe de uma empresa', auth: true },
  { method: 'GET', path: '/documentos', desc: 'Listar documentos (?licitacao_id=...)', auth: true },
  { method: 'GET', path: '/kanban', desc: 'Listar tarefas do Kanban', auth: true },
  { method: 'PUT', path: '/kanban/:id', desc: 'Atualizar tarefa do Kanban', auth: true },
  { method: 'GET', path: '/catalogo', desc: 'Listar itens precificados do catálogo', auth: true },
];

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  POST: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  PUT: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  DELETE: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export default function ApiIntegracao() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyExample = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success('Copiado!');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const curlExample = `curl -X GET "${BASE_URL}/licitacoes?page=1&limit=10" \\
  -H "Authorization: Bearer SEU_TOKEN_JWT" \\
  -H "Content-Type: application/json"`;

  const postExample = `curl -X POST "${BASE_URL}/licitacoes" \\
  -H "Authorization: Bearer SEU_TOKEN_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "numero": "PE-001/2026",
    "objeto": "Aquisição de material de escritório",
    "orgao": "Prefeitura Municipal",
    "modalidade": "Pregão Eletrônico",
    "status": "Publicado"
  }'`;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Code2 className="w-6 h-6 text-accent" />
            API de Integração (ERP)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Endpoints REST para integrar com sistemas externos (ERPs, CRMs, etc.)
          </p>
        </div>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Autenticação</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Envie o token JWT do usuário no header <code className="bg-muted px-1 rounded">Authorization: Bearer {'<token>'}</code>.
            O token é obtido ao fazer login na plataforma.
          </p>
          <div className="bg-muted rounded-lg p-3 text-xs font-mono relative">
            <pre className="whitespace-pre-wrap">{curlExample}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => copyExample(-1, curlExample)}
            >
              {copiedIdx === -1 ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Endpoints Disponíveis</h2>
          <div className="space-y-2">
            {endpoints.map((ep, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <Badge variant="outline" className={`font-mono text-xs min-w-[60px] justify-center ${methodColors[ep.method]}`}>
                  {ep.method}
                </Badge>
                <code className="text-sm font-mono text-foreground/80 min-w-[200px]">{ep.path}</code>
                <span className="text-sm text-muted-foreground flex-1">{ep.desc}</span>
                {ep.auth && (
                  <Badge variant="secondary" className="text-[10px]">🔒 Auth</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Exemplo: Criar Licitação</h2>
          <div className="bg-muted rounded-lg p-3 text-xs font-mono relative">
            <pre className="whitespace-pre-wrap">{postExample}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => copyExample(-2, postExample)}
            >
              {copiedIdx === -2 ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Base URL</h2>
          <div className="bg-muted rounded-lg p-3 text-sm font-mono flex items-center justify-between">
            <span className="truncate">{BASE_URL}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copyExample(-3, BASE_URL)}>
              {copiedIdx === -3 ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
