import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle2, Lock } from 'lucide-react';
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

// Verbo HTTP em família semântica do Badge: leitura verde, escrita neutra,
// atualização âmbar, remoção vermelha.
const methodVariant: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  GET: 'success',
  POST: 'info',
  PUT: 'warning',
  DELETE: 'danger',
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
      <div className="max-w-5xl space-y-6">
        {/* Título, descrição e ícone vêm de `lib/navegacao/paginas.ts` —
            /api-integracao é item de menu. O "(ERP)" que estava no h1 virou
            a primeira linha do bloco de endpoints, onde o leitor precisa
            dele. */}
        <CabecalhoPagina />

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Autenticação</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Envie o token JWT do usuário no header <code className="rounded-sm bg-muted px-1 font-mono">Authorization: Bearer {'<token>'}</code>.
            O token é obtido ao fazer login na plataforma.
          </p>
          <div className="relative overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap pr-12">{curlExample}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => copyExample(-1, curlExample)}
              aria-label="Copiar exemplo de autenticação"
            >
              {copiedIdx === -1 ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Endpoints disponíveis</h2>
          <p className="text-sm text-muted-foreground mb-4">
            REST em JSON, para integrar com sistemas externos — ERPs, CRMs e afins.
          </p>
          <div className="space-y-2">
            {endpoints.map((ep, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted"
              >
                <Badge variant={methodVariant[ep.method]} className="min-w-16 justify-center font-mono">
                  {ep.method}
                </Badge>
                <code className="break-all font-mono text-sm text-foreground sm:min-w-48">{ep.path}</code>
                <span className="min-w-48 flex-1 text-sm text-muted-foreground">{ep.desc}</span>
                {ep.auth && (
                  <Badge variant="muted" className="gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Requer token
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Exemplo: criar licitação</h2>
          <div className="relative overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap pr-12">{postExample}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => copyExample(-2, postExample)}
              aria-label="Copiar exemplo de criação"
            >
              {copiedIdx === -2 ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Base URL</h2>
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-4 font-mono text-sm">
            <span className="min-w-0 break-all">{BASE_URL}</span>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={() => copyExample(-3, BASE_URL)}
              aria-label="Copiar Base URL"
            >
              {copiedIdx === -3 ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
