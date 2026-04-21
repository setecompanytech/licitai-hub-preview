import { useState } from 'react';
import { useProcessoWorkspace, type ProcessoDocumento } from '@/hooks/useProcessoWorkspace';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import RichEditor from './RichEditor';
import { Plus, FileText, Trash2, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const TIPOS = [
  { value: 'declaracao', label: 'Declaração' },
  { value: 'proposta', label: 'Proposta Comercial' },
  { value: 'recurso', label: 'Recurso' },
  { value: 'impugnacao', label: 'Impugnação' },
  { value: 'esclarecimento', label: 'Pedido de Esclarecimento' },
  { value: 'oficio', label: 'Ofício' },
  { value: 'outros', label: 'Outros' },
];

export default function DocumentosManager({ licitacaoId }: { licitacaoId: string }) {
  const { documentos, criarDocumento, salvarDocumento, deleteDocumento } = useProcessoWorkspace(licitacaoId);
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState('declaracao');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [editando, setEditando] = useState<ProcessoDocumento | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [titulo, setTitulo] = useState('');

  const abrir = (d: ProcessoDocumento) => {
    setEditando(d);
    setConteudo(d.conteudo_html || '');
    setTitulo(d.titulo);
  };

  const handleSalvar = async () => {
    if (!editando) return;
    await salvarDocumento(editando.id, conteudo, titulo);
    setEditando(null);
  };

  const handleNovo = async () => {
    if (!novoTitulo.trim()) { toast.error('Informe o título'); return; }
    const d = await criarDocumento(novoTipo, novoTitulo);
    setNovoOpen(false);
    setNovoTitulo('');
    if (d) abrir(d);
  };

  const exportarPDF = (d: ProcessoDocumento) => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(14);
    pdf.text(d.titulo, 20, 20);
    pdf.setFontSize(10);
    // Strip HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = d.conteudo_html || '';
    const text = tmp.innerText;
    const lines = pdf.splitTextToSize(text, 170);
    pdf.text(lines, 20, 35);
    pdf.save(`${d.titulo.replace(/[^\w]/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Documentos Editáveis</h3>
          <p className="text-xs text-muted-foreground">Crie, edite e versione documentos diretamente no sistema.</p>
        </div>
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Documento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Tipo</label>
                <Select value={novoTipo} onValueChange={setNovoTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Título</label>
                <Input value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} placeholder="Ex: Declaração de ME/EPP" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleNovo}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {documentos.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum documento criado. Comece pelo botão "Novo Documento".</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {documentos.map(d => {
            const tipo = TIPOS.find(t => t.value === d.tipo);
            return (
              <div key={d.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                <FileText className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.titulo}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{tipo?.label || d.tipo}</Badge>
                    <Badge variant="outline" className="text-[10px]">v{d.versao}</Badge>
                    <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                    <span>· atualizado em {new Date(d.updated_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => abrir(d)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => exportarPDF(d)} className="h-8 w-8 p-0"><Download className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Excluir "${d.titulo}"?`)) deleteDocumento(d.id); }} className="h-8 w-8 p-0 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} className="text-base font-semibold" />
            </DialogTitle>
          </DialogHeader>
          <RichEditor value={conteudo} onChange={setConteudo} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={handleSalvar} className="gap-2"><Save className="w-4 h-4" /> Salvar (nova versão)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
