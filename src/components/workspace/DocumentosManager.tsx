import { useEffect, useState } from 'react';
import { useProcessoWorkspace, type ProcessoDocumento } from '@/hooks/useProcessoWorkspace';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription
} from '@/components/ui/dialog';
import RichEditor from './RichEditor';
import { Plus, FileText, Trash2, Save, Download, Sparkles, ShieldCheck, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { MODELOS_DECLARACOES, type ContextoDeclaracao } from './modelosDeclaracoes';
import { gerarPdfDocumento } from './exportarPasta';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const TIPOS = [
  { value: 'declaracao', label: 'Declaração' },
  { value: 'proposta', label: 'Proposta Comercial' },
  { value: 'recurso', label: 'Recurso' },
  { value: 'impugnacao', label: 'Impugnação' },
  { value: 'esclarecimento', label: 'Pedido de Esclarecimento' },
  { value: 'oficio', label: 'Ofício' },
  { value: 'outros', label: 'Outros' },
];

interface Props {
  licitacaoId: string;
  numeroProcesso?: string | null;
  orgao?: string | null;
  objeto?: string | null;
  cidade?: string | null;
}

export default function DocumentosManager({ licitacaoId, numeroProcesso, orgao, objeto, cidade }: Props) {
  const { user } = useAuth();
  const { documentos, criarDocumento, salvarDocumento, deleteDocumento } = useProcessoWorkspace(licitacaoId);
  const [novoOpen, setNovoOpen] = useState(false);
  const [modelosOpen, setModelosOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState('declaracao');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [editando, setEditando] = useState<ProcessoDocumento | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [titulo, setTitulo] = useState('');

  // Empresa do usuário (para preencher placeholders)
  const [empresa, setEmpresa] = useState<{ razao_social?: string; cnpj?: string; endereco?: string }>({});
  const [representante, setRepresentante] = useState<{ nome?: string; cpf?: string; cargo?: string }>({});

  // PDF / assinatura
  const [pdfDialog, setPdfDialog] = useState<ProcessoDocumento | null>(null);
  const [assinar, setAssinar] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Pega primeira empresa do usuário
      const { data } = await supabase
        .from('empresas')
        .select('razao_social, cnpj, endereco, representante_nome, representante_cpf, representante_cargo')
        .limit(1).maybeSingle();
      if (data) {
        setEmpresa({ razao_social: data.razao_social, cnpj: data.cnpj, endereco: data.endereco });
        setRepresentante({
          nome: (data as any).representante_nome,
          cpf: (data as any).representante_cpf,
          cargo: (data as any).representante_cargo,
        });
      }
    })();
  }, [user]);

  const ctx = (): ContextoDeclaracao => ({
    empresaRazao: empresa.razao_social || '',
    empresaCnpj: empresa.cnpj || '',
    empresaEndereco: empresa.endereco || '',
    representanteNome: representante.nome || '',
    representanteCpf: representante.cpf || '',
    representanteCargo: representante.cargo || '',
    numeroLicitacao: numeroProcesso || '',
    orgao: orgao || '',
    objeto: objeto || '',
    cidade: cidade || '',
    data: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
  });

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

  const criarDoModelo = async (modeloId: string) => {
    const modelo = MODELOS_DECLARACOES.find(m => m.id === modeloId);
    if (!modelo) return;
    const html = modelo.template(ctx());
    const d = await criarDocumento('declaracao', modelo.titulo, html);
    setModelosOpen(false);
    if (d) abrir(d);
  };

  const exportarPDF = (d: ProcessoDocumento, comAssinatura: boolean) => {
    const blob = gerarPdfDocumento(d, {
      numeroProcesso,
      orgao,
      assinatura: comAssinatura ? {
        habilitar: true,
        nome: representante.nome,
        cpf: representante.cpf,
        cargo: representante.cargo,
        empresaRazao: empresa.razao_social,
        empresaCnpj: empresa.cnpj,
      } : undefined,
    });
    saveAs(blob, `${d.titulo.replace(/[^\w]/g, '_')}_v${d.versao}${comAssinatura ? '_assinado' : ''}.pdf`);
    setPdfDialog(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-base">Documentos Editáveis</h3>
          <p className="text-xs text-muted-foreground">Crie do zero, use modelos prontos ou exporte com assinatura eletrônica.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={modelosOpen} onOpenChange={setModelosOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Sparkles className="w-4 h-4" /> Modelos Prontos</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> Modelos de Declarações</DialogTitle>
                <DialogDescription>
                  Modelos pré-formatados conforme a Lei nº 14.133/2021 e legislação correlata. Os campos da empresa serão preenchidos automaticamente quando disponíveis.
                </DialogDescription>
              </DialogHeader>
              {(!empresa.razao_social || !empresa.cnpj) && (
                <div className="text-xs p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-700 flex items-start gap-2">
                  <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    Cadastre os dados da sua empresa em <strong>Configurações → Empresa</strong> para preencher automaticamente os modelos.
                    Você poderá editar os placeholders manualmente após criar.
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {MODELOS_DECLARACOES.map(m => (
                  <Card key={m.id} className="p-3 hover:border-accent transition cursor-pointer" onClick={() => criarDoModelo(m.id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{m.titulo}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{m.descricao}</p>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{m.categoria}</Badge>
                          <span className="text-[10px] text-muted-foreground">{m.fundamento}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Documento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Documento (em branco)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={novoTipo} onValueChange={setNovoTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} placeholder="Ex: Declaração específica" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleNovo}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {documentos.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Nenhum documento criado ainda.</p>
          <Button variant="outline" className="gap-2" onClick={() => setModelosOpen(true)}>
            <Sparkles className="w-4 h-4" /> Começar com um modelo pronto
          </Button>
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
                <Button variant="ghost" size="sm" onClick={() => setPdfDialog(d)} className="h-8 w-8 p-0" title="Exportar PDF">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Excluir "${d.titulo}"?`)) deleteDocumento(d.id); }} className="h-8 w-8 p-0 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Editor */}
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

      {/* PDF / Assinatura */}
      <Dialog open={!!pdfDialog} onOpenChange={(o) => !o && setPdfDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5" /> Exportar PDF</DialogTitle>
            <DialogDescription>{pdfDialog?.titulo}</DialogDescription>
          </DialogHeader>
          <Card className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-accent mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="assinar" className="font-semibold text-sm cursor-pointer">Assinatura eletrônica</Label>
                  <Switch id="assinar" checked={assinar} onCheckedChange={setAssinar} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Adiciona selo de autenticação ao final do documento com identificação do signatário, data, hash de integridade e fundamento legal (MP 2.200-2/2001 e Lei 14.063/2020).
                </p>
              </div>
            </div>
            {assinar && (
              <div className="text-xs p-2 bg-muted/50 rounded space-y-0.5">
                <div><strong>Signatário:</strong> {representante.nome || <span className="text-destructive">— não cadastrado —</span>}</div>
                <div><strong>Empresa:</strong> {empresa.razao_social || <span className="text-destructive">— não cadastrada —</span>}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Cadastre estes dados em <strong>Configurações → Empresa</strong> para que o selo seja completo.
                </div>
              </div>
            )}
          </Card>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfDialog(null)}>Cancelar</Button>
            <Button onClick={() => pdfDialog && exportarPDF(pdfDialog, assinar)} className="gap-2">
              <Download className="w-4 h-4" /> Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
