import { useRef, useState, type ReactNode } from 'react';
import { useProcessoWorkspace, type CategoriaAnexo, type ProcessoAnexo } from '@/hooks/useProcessoWorkspace';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Upload, Download, Trash2, FileText, Folder, Search } from 'lucide-react';

const CATEGORIAS: { value: CategoriaAnexo; label: string; color: string }[] = [
  { value: 'edital', label: 'Edital', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'habilitacao', label: 'Habilitação', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'proposta', label: 'Proposta', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'declaracoes', label: 'Declarações', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'recursos', label: 'Recursos', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'contrato', label: 'Contrato', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'outros', label: 'Outros', color: 'bg-muted text-muted-foreground border-border' },
];

function formatBytes(b: number | null) {
  if (!b) return '-';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnexosManager({ licitacaoId, editalViewer }: { licitacaoId: string; editalViewer?: ReactNode }) {
  const { anexos, loading, uploadAnexo, downloadAnexo, deleteAnexo } = useProcessoWorkspace(licitacaoId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<CategoriaAnexo>('outros');
  // editalViewer: o "Edital em tela" (arquivos materializados do PNCP) mora na
  // pasta Edital desta aba — antes vivia solto na Visão Geral, criando dois
  // mundos de arquivo (a pasta dizia "0 arquivos" com o edital renderizando
  // em outra aba).
  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const f of files) await uploadAnexo(f, categoria);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const filtrados = anexos.filter(a =>
    (filtroCat === 'todas' || a.categoria === filtroCat) &&
    (!busca || a.nome_arquivo.toLowerCase().includes(busca.toLowerCase()))
  );

  const grupos = CATEGORIAS.map(c => ({ ...c, count: anexos.filter(a => a.categoria === c.value).length }));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaAnexo)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
            <Upload className="w-4 h-4" />
            {uploading ? 'Enviando...' : 'Enviar Arquivo(s)'}
          </Button>
          <input ref={fileRef} type="file" multiple hidden onChange={handleFile} />
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar arquivo..." className="pl-8 w-[220px]" />
          </div>
        </div>
      </Card>

      {/* Pastas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <button
          onClick={() => setFiltroCat('todas')}
          className={`p-3 rounded-md border text-left transition ${filtroCat === 'todas' ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'}`}
        >
          <Folder className="w-4 h-4 mb-1 text-accent" />
          <div className="text-xs font-semibold">Todas</div>
          <div className="text-xs text-muted-foreground">{anexos.length} arquivos</div>
        </button>
        {grupos.map(g => (
          <button
            key={g.value}
            onClick={() => setFiltroCat(g.value)}
            className={`p-3 rounded-md border text-left transition ${filtroCat === g.value ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'}`}
          >
            <Folder className="w-4 h-4 mb-1 text-accent" />
            <div className="text-xs font-semibold">{g.label}</div>
            <div className="text-xs text-muted-foreground">
              {g.count} arquivos{g.value === 'edital' && editalViewer ? ' + PNCP' : ''}
            </div>
          </button>
        ))}
      </div>

      {/* Edital em tela — arquivos oficiais da contratação no PNCP */}
      {filtroCat === 'edital' && editalViewer}

      {/* Lista */}
      <Card className="divide-y divide-border">
        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>}
        {!loading && filtrados.length === 0 && (
          <div className="p-12 text-center">
            <Folder className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum arquivo nesta pasta. Envie o primeiro acima.</p>
          </div>
        )}
        {filtrados.map((a: ProcessoAnexo) => {
          const cat = CATEGORIAS.find(c => c.value === a.categoria);
          return (
            <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.nome_arquivo}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${cat?.color}`}>{cat?.label}</Badge>
                  <span>{formatBytes(a.tamanho_bytes)}</span>
                  <span>·</span>
                  <span>{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                  {a.origem !== 'upload' && <Badge variant="outline" className="text-xs">Gerado</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => downloadAnexo(a)} className="h-8 w-8 p-0">
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Excluir "${a.nome_arquivo}"?`)) deleteAnexo(a); }} className="h-8 w-8 p-0 text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
