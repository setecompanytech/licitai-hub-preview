import { useEffect, useState } from 'react';
import { useProcessoWorkspace, type ProcessoDocumento } from '@/hooks/useProcessoWorkspace';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
        .select('*')
        .limit(1).maybeSingle();
      if (data) {
        const d = data as any;
        setEmpresa({
          razao_social: d.razao_social,
          cnpj: d.cnpj,
          endereco: [d.endereco, d.numero, d.bairro, d.cidade, d.uf].filter(Boolean).join(', '),
        });
        setRepresentante({
          nome: d.representante_nome || d.responsavel_nome || d.contato_nome,
          cpf: d.representante_cpf || d.responsavel_cpf,
          cargo: d.representante_cargo || d.responsavel_cargo || 'Representante Legal',
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Documentos Editáveis</h2>
          <p className="text-sm text-muted-foreground">Crie do zero, use modelos prontos ou exporte com assinatura eletrônica.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={modelosOpen} onOpenChange={setModelosOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Sparkles className="w-4 h-4" aria-hidden="true" /> Modelos Prontos</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" aria-hidden="true" /> Modelos de Declarações</DialogTitle>
                <DialogDescription>
                  Modelos pré-formatados conforme a Lei nº 14.133/2021 e legislação correlata. Os campos da empresa serão preenchidos automaticamente quando disponíveis.
                </DialogDescription>
              </DialogHeader>
              {(!empresa.razao_social || !empresa.cnpj) && (
                <Alert variant="warning">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Cadastre os dados da sua empresa em <strong>Configurações → Empresa</strong> para preencher automaticamente os modelos.
                    Você poderá editar os placeholders manualmente após criar.
                  </AlertDescription>
                </Alert>
              )}
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                {MODELOS_DECLARACOES.map(m => (
                  <Card
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => criarDoModelo(m.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); criarDoModelo(m.id); } }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
                        <FileText className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold">{m.titulo}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{m.descricao}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="muted">{m.categoria}</Badge>
                          <span className="text-xs text-muted-foreground">{m.fundamento}</span>
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
              <Button><Plus className="w-4 h-4" aria-hidden="true" /> Novo Documento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Documento (em branco)</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="novo-doc-tipo">Tipo</Label>
                  <Select value={novoTipo} onValueChange={setNovoTipo}>
                    <SelectTrigger id="novo-doc-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="novo-doc-titulo">Título</Label>
                  <Input id="novo-doc-titulo" value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} placeholder="Ex: Declaração específica" />
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
        <Card className="p-6">
          <EstadoVazio
            icone={<FileText />}
            titulo="Nenhum documento criado ainda"
            descricao="Crie do zero ou comece com um modelo pronto."
            acao={
              <Button variant="outline" onClick={() => setModelosOpen(true)}>
                <Sparkles className="w-4 h-4" aria-hidden="true" /> Começar com um modelo pronto
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {documentos.map(d => {
            const tipo = TIPOS.find(t => t.value === d.tipo);
            return (
              <div key={d.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
                <FileText className="w-5 h-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.titulo}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="muted">{tipo?.label || d.tipo}</Badge>
                    <Badge variant="outline">v{d.versao}</Badge>
                    <Badge variant="info">{d.status}</Badge>
                    <span>· atualizado em {new Date(d.updated_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => abrir(d)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => setPdfDialog(d)} className="w-9 px-0" title="Exportar PDF" aria-label={`Exportar PDF de ${d.titulo}`}>
                  <Download className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Excluir "${d.titulo}"?`)) deleteDocumento(d.id); }} className="w-9 px-0 text-destructive" title="Excluir" aria-label={`Excluir ${d.titulo}`}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Editor */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} className="text-base font-semibold" aria-label="Título do documento" />
            </DialogTitle>
          </DialogHeader>
          <RichEditor value={conteudo} onChange={setConteudo} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={handleSalvar}><Save className="w-4 h-4" aria-hidden="true" /> Salvar (nova versão)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF / Assinatura */}
      <Dialog open={!!pdfDialog} onOpenChange={(o) => !o && setPdfDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5" aria-hidden="true" /> Exportar PDF</DialogTitle>
            <DialogDescription>{pdfDialog?.titulo}</DialogDescription>
          </DialogHeader>
          <Card className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 w-5 h-5 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="assinar" className="cursor-pointer text-sm font-semibold">Assinatura eletrônica</Label>
                  <Switch id="assinar" checked={assinar} onCheckedChange={setAssinar} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adiciona selo de autenticação ao final do documento com identificação do signatário, data, hash de integridade e fundamento legal (MP 2.200-2/2001 e Lei 14.063/2020).
                </p>
              </div>
            </div>
            {assinar && (
              <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
                <div><strong>Signatário:</strong> {representante.nome || <span className="text-destructive">— não cadastrado —</span>}</div>
                <div><strong>Empresa:</strong> {empresa.razao_social || <span className="text-destructive">— não cadastrada —</span>}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Cadastre estes dados em <strong>Configurações → Empresa</strong> para que o selo seja completo.
                </div>
              </div>
            )}
          </Card>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfDialog(null)}>Cancelar</Button>
            <Button onClick={() => pdfDialog && exportarPDF(pdfDialog, assinar)}>
              <Download className="w-4 h-4" aria-hidden="true" /> Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
