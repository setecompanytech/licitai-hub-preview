import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, BookOpen, Copy, TrendingUp, Download, FileText } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import IrregularidadesExtractor, { type Irregularidade } from './IrregularidadesExtractor';
import DocumentosPeticaoUploader, { type FatoPeticao } from './DocumentosPeticaoUploader';
import { exportLegalPDF, exportLegalWord } from '@/lib/legal-document-export';

type DocRef = { id: string; titulo: string; tipo: string; ementa: string | null; texto_integral: string | null };
type Indice = { id: string; nome: string; sigla: string; valor: number; variacao_mensal: number | null; acumulado_12m: number | null; periodo: string; fonte: string };
type CCT = { id: string; categoria_profissional: string; piso_salarial: number | null; reajuste_percentual: number | null; indice_reajuste: string | null; vigencia_inicio: string | null; vigencia_fim: string | null; sindicato_laboral: string | null; abrangencia_uf: string | null };

const TIPOS_REEQUILIBRIO = ['Reajuste Contratual', 'Repactuação (MO/CCT)', 'Revisão / Reequilíbrio'];
const TIPOS_COM_ANALISE_EDITAL = ['Impugnação ao Edital', 'Pedido de Esclarecimento'];
const TIPOS_COM_UPLOAD_DOCS = ['Recurso Administrativo', 'Contrarrazões', 'Pedido de Reconsideração'];
const fmtPerc = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

export default function GeradorIAComBase() {
  const { user } = useAuth();
  const { empresas, empresaAtiva } = useEmpresa();
  const activeEmpresa = empresaAtiva || empresas[0]?.empresa;
  const [tipoDoc, setTipoDoc] = useState('Impugnação ao Edital');
  const [editalNum, setEditalNum] = useState('');
  const [contexto, setContexto] = useState('');
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [docsBase, setDocsBase] = useState<DocRef[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Irregularidades flow (Impugnação/Esclarecimento)
  const [showExtractor, setShowExtractor] = useState(false);
  const [irregularidades, setIrregularidades] = useState<Irregularidade[]>([]);
  const [editalTexto, setEditalTexto] = useState('');

  // Fatos peticao flow (Recurso/Contrarrazões/Reconsideração)
  const [showPeticaoUploader, setShowPeticaoUploader] = useState(false);
  const [fatosPeticao, setFatosPeticao] = useState<FatoPeticao[]>([]);
  const [docsTexto, setDocsTexto] = useState('');

  // Indices & CCTs for reequilíbrio
  const [indices, setIndices] = useState<Indice[]>([]);
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [loadingIndices, setLoadingIndices] = useState(false);
  const isReequilibrio = TIPOS_REEQUILIBRIO.includes(tipoDoc);
  const isAnaliseEdital = TIPOS_COM_ANALISE_EDITAL.includes(tipoDoc);
  const isUploadDocs = TIPOS_COM_UPLOAD_DOCS.includes(tipoDoc);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('base_juridica')
      .select('id, titulo, tipo, ementa, texto_integral')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setDocsBase(data as DocRef[]);
      });
  }, [user]);

  useEffect(() => {
    if (isReequilibrio && indices.length === 0) {
      setLoadingIndices(true);
      Promise.all([
        supabase.from('indices_economicos').select('id, nome, sigla, valor, variacao_mensal, acumulado_12m, periodo, fonte').order('sigla'),
        supabase.from('convencoes_coletivas').select('id, categoria_profissional, piso_salarial, reajuste_percentual, indice_reajuste, vigencia_inicio, vigencia_fim, sindicato_laboral, abrangencia_uf').eq('status', 'vigente'),
      ]).then(([indRes, cctRes]) => {
        setIndices((indRes.data as Indice[]) || []);
        setCcts((cctRes.data as CCT[]) || []);
        setLoadingIndices(false);
      });
    }
  }, [isReequilibrio]);

  // Reset state when changing doc type
  useEffect(() => {
    setShowExtractor(false);
    setShowPeticaoUploader(false);
    setIrregularidades([]);
    setFatosPeticao([]);
    setEditalTexto('');
    setDocsTexto('');
    setResultado('');
  }, [tipoDoc]);

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  // ── Irregularidades handlers (Impugnação/Esclarecimento) ──
  const handleIrregularidadesFinish = (selected: Irregularidade[], textoEdital: string, numEdital: string) => {
    setIrregularidades(selected);
    setEditalTexto(textoEdital);
    setEditalNum(numEdital);
    setShowExtractor(false);
    toast.success(`${selected.length} irregularidade(s) prontas para geração do documento.`);
  };

  // ── Fatos peticao handlers (Recurso/Contrarrazões/Reconsideração) ──
  const handleFatosPeticaoFinish = (fatos: FatoPeticao[], documentosTexto: string, numEdital: string) => {
    setFatosPeticao(fatos);
    setDocsTexto(documentosTexto);
    setEditalNum(numEdital);
    setShowPeticaoUploader(false);
    toast.success(`${fatos.length} fato(s) jurídico(s) prontos para geração do documento.`);
  };

  const buildIrregularidadesContext = (): string => {
    if (irregularidades.length === 0) return '';
    let ctx = '\n\n--- IRREGULARIDADES IDENTIFICADAS NO EDITAL ---\n';
    irregularidades.forEach((irr, idx) => {
      ctx += `\n${idx + 1}. [${irr.gravidade.toUpperCase()}] ${irr.origem === 'ia' ? '(IA)' : '(Manual)'}\n`;
      ctx += `   Descrição: ${irr.descricao}\n`;
      ctx += `   Fundamentação: ${irr.fundamentacao}\n`;
      if (irr.artigos.length > 0) ctx += `   Artigos: ${irr.artigos.join(', ')}\n`;
    });
    return ctx;
  };

  const buildFatosContext = (): string => {
    if (fatosPeticao.length === 0) return '';
    let ctx = '\n\n--- FATOS JURÍDICOS EXTRAÍDOS DOS DOCUMENTOS ---\n';
    fatosPeticao.forEach((fato, idx) => {
      ctx += `\n${idx + 1}. [${fato.gravidade.toUpperCase()}] [${fato.categoria}] ${fato.origem === 'ia' ? '(IA)' : fato.origem === 'concorrente' ? '(Inteligência Concorrente)' : '(Manual)'}\n`;
      ctx += `   Descrição: ${fato.descricao}\n`;
      ctx += `   Fundamentação: ${fato.fundamentacao}\n`;
    });
    if (docsTexto) {
      ctx += `\n--- INFORMAÇÕES COMPLEMENTARES ---\n${docsTexto}\n`;
    }
    return ctx;
  };

  const buildPeticaoInstructions = (): string => {
    if (tipoDoc === 'Recurso Administrativo') {
      return `\n\nINSTRUÇÃO ESPECÍFICA: Gere um RECURSO ADMINISTRATIVO completo e profissional com base nos ${fatosPeticao.length} fatos jurídicos identificados.
O documento deve seguir a estrutura formal:
- Endereçamento à autoridade competente (Pregoeiro/CPL)
- Qualificação do recorrente
- Da Tempestividade (Art. 165, §1º da Lei 14.133/2021)
- Dos Fatos (para cada fato, descrição clara e objetiva)
- Do Direito (fundamentação jurídica consolidada com Lei 14.133/2021 e jurisprudência TCU)
- Da Irregularidade na Habilitação/Proposta do Concorrente (quando aplicável)
- Dos Pedidos (específicos e fundamentados)
- Dos Documentos Anexos
- Fecho e assinatura

Linguagem técnica, formal, objetiva e impessoal. Cite artigos, incisos e parágrafos da Lei 14.133/2021.\n`;
    }
    if (tipoDoc === 'Contrarrazões') {
      return `\n\nINSTRUÇÃO ESPECÍFICA: Gere CONTRARRAZÕES AO RECURSO ADMINISTRATIVO completas e profissionais, rebatendo os ${fatosPeticao.length} argumentos/fatos identificados no recurso do concorrente.
O documento deve seguir a estrutura formal:
- Endereçamento à autoridade competente
- Qualificação do contrarrazoante
- Da Tempestividade
- Dos Fatos (síntese do recurso do concorrente)
- Da Refutação dos Argumentos (para CADA argumento do recorrente, apresentar contra-argumentação fundamentada)
- Da Regularidade da Habilitação/Proposta do Contrarrazoante
- Da Improcedência do Recurso
- Dos Pedidos (manutenção da decisão recorrida, não provimento do recurso)
- Fecho e assinatura

Linguagem técnica, formal, objetiva e impessoal. Rebata CADA argumento do recurso com fundamentação na Lei 14.133/2021 e jurisprudência TCU.\n`;
    }
    if (tipoDoc === 'Pedido de Reconsideração') {
      return `\n\nINSTRUÇÃO ESPECÍFICA: Gere um PEDIDO DE RECONSIDERAÇÃO completo e profissional com base nos ${fatosPeticao.length} fatos identificados na decisão impugnada.
O documento deve seguir a estrutura formal:
- Endereçamento à autoridade que proferiu a decisão
- Qualificação do requerente
- Do Cabimento (Art. 165, §2º da Lei 14.133/2021)
- Da Decisão Recorrida (síntese)
- Dos Fatos Novos e/ou Erros Identificados (para cada fato)
- Do Direito (fundamentação jurídica)
- Da Desproporcionalidade (quando aplicável)
- Dos Pedidos (reconsideração da decisão, com especificação)
- Fecho e assinatura

Linguagem técnica, formal, objetiva e impessoal.\n`;
    }
    return '';
  };

  const handleGerar = async () => {
    // Validate inputs based on type
    if (isAnaliseEdital && irregularidades.length === 0 && !contexto) {
      toast.error('Analise o edital primeiro ou descreva o contexto manualmente.');
      return;
    }
    if (isUploadDocs && fatosPeticao.length === 0 && !contexto) {
      toast.error('Anexe documentos e extraia os fatos jurídicos, ou descreva o contexto manualmente.');
      return;
    }
    if (!isAnaliseEdital && !isUploadDocs && !contexto) {
      toast.error('Descreva o contexto e fundamentação');
      return;
    }
    setGerando(true);
    setResultado('');

    // Build context from selected base juridica documents
    let baseContext = '';
    if (selectedDocs.length > 0) {
      const selected = docsBase.filter(d => selectedDocs.includes(d.id));
      baseContext = '\n\n--- DOCUMENTOS DE REFERÊNCIA DA BASE JURÍDICA ---\n';
      for (const doc of selected) {
        baseContext += `\n### ${doc.titulo} (${doc.tipo})\n`;
        if (doc.ementa) baseContext += `Ementa: ${doc.ementa}\n`;
        if (doc.texto_integral) baseContext += `Texto: ${doc.texto_integral.slice(0, 5000)}\n`;
      }
    }

    const irregContext = buildIrregularidadesContext();
    const fatosContext = buildFatosContext();

    // Build indices/CCT context for reequilíbrio types
    let indicesContext = '';
    if (isReequilibrio && (indices.length > 0 || ccts.length > 0)) {
      indicesContext = '\n\n--- DADOS ECONÔMICOS ATUALIZADOS (FONTE OFICIAL) ---\n';
      if (indices.length > 0) {
        indicesContext += '\nÍNDICES ECONÔMICOS:\n';
        for (const i of indices) {
          indicesContext += `- ${i.sigla} (${i.nome}): Valor ${i.valor}, Variação mensal ${fmtPerc(i.variacao_mensal)}, Acumulado 12m ${fmtPerc(i.acumulado_12m)}, Período: ${i.periodo}, Fonte: ${i.fonte}\n`;
        }
      }
      if (ccts.length > 0) {
        indicesContext += '\nCONVENÇÕES COLETIVAS VIGENTES:\n';
        for (const c of ccts) {
          indicesContext += `- ${c.categoria_profissional}: Piso ${c.piso_salarial ? `R$ ${c.piso_salarial}` : 'N/I'}, Reajuste ${c.reajuste_percentual ? `${c.reajuste_percentual}%` : 'N/I'}, Índice ${c.indice_reajuste || 'N/I'}, Vigência ${c.vigencia_inicio || '?'} a ${c.vigencia_fim || '?'}, UF: ${c.abrangencia_uf || 'N/I'}\n`;
        }
      }
      if (tipoDoc === 'Reajuste Contratual') {
        indicesContext += '\nINSTRUÇÃO: Gere pedido de REAJUSTE por índice contratual (Art. 92, §3º e Art. 135, I da Lei 14.133/2021). Automático, anual, por apostilamento. Demonstre cálculo com o índice selecionado.\n';
      } else if (tipoDoc === 'Repactuação (MO/CCT)') {
        indicesContext += '\nINSTRUÇÃO: Gere pedido de REPACTUAÇÃO por dissídio/CCT (Art. 135, I da Lei 14.133/2021). Exclusivo para serviços com dedicação exclusiva de MO. Demonstre variação via planilha de custos (antes/depois). Não automático, respeita anualidade.\n';
      } else {
        indicesContext += '\nINSTRUÇÃO: Gere pedido de REVISÃO/REEQUILÍBRIO STRICTO SENSU (Art. 124, II, "d" da Lei 14.133/2021). Aplique Teoria da Imprevisão. Pode ocorrer a qualquer tempo. Demonstre nexo causal e onerosidade excessiva.\n';
      }
      indicesContext += 'Linguagem técnica, objetiva, impessoal e auditável. Cite fontes e períodos dos dados numéricos.\n';
    }

    // Specific instructions for edital analysis types
    let specificInstructions = '';
    if (isAnaliseEdital && irregularidades.length > 0) {
      specificInstructions = `\n\nINSTRUÇÃO ESPECÍFICA: Gere um documento de "${tipoDoc}" completo e profissional com base nas ${irregularidades.length} irregularidades identificadas abaixo. 
Para CADA irregularidade:
1. Descreva os fatos de forma clara e objetiva
2. Apresente a fundamentação jurídica completa (Lei 14.133/2021, jurisprudência TCU)
3. Demonstre o prejuízo à competitividade ou à legalidade
4. Formule o pedido específico

O documento deve seguir a estrutura formal:
- Endereçamento ao pregoeiro/comissão
- Qualificação do impugnante/recorrente
- Dos Fatos (para cada irregularidade)
- Do Direito (fundamentação jurídica consolidada)
- Dos Pedidos (específicos para cada irregularidade)
- Fecho e assinatura

Linguagem técnica, formal, objetiva e impessoal. Cite artigos, incisos e parágrafos da Lei 14.133/2021.\n`;
    }

    // Instructions for petition types with document upload
    if (isUploadDocs && fatosPeticao.length > 0) {
      specificInstructions = buildPeticaoInstructions();
    }

    const prompt = `Tipo: ${tipoDoc}\nEdital: ${editalNum}\n${contexto ? `Contexto adicional: ${contexto}` : ''}${irregContext}${fatosContext}${specificInstructions}${baseContext}${indicesContext}`;

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'gerador_juridico',
      context: baseContext + indicesContext + irregContext + fatosContext,
      onDelta: (text) => setResultado(prev => prev + text),
      onDone: () => setGerando(false),
      onError: (err) => {
        toast.error(err);
        setGerando(false);
      },
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultado);
    toast.success('Copiado!');
  };

  const isShowingUploader = showExtractor || showPeticaoUploader;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Gerador de Documentos com IA</h3>
        </div>

        {/* Doc type selector */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Tipo de Documento</label>
            <select
              value={tipoDoc}
              onChange={e => setTipoDoc(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option>Impugnação ao Edital</option>
              <option>Pedido de Esclarecimento</option>
              <option>Recurso Administrativo</option>
              <option>Contrarrazões</option>
              <option>Pedido de Reconsideração</option>
              <option>Reajuste Contratual</option>
              <option>Repactuação (MO/CCT)</option>
              <option>Revisão / Reequilíbrio</option>
            </select>
          </div>
          {!isAnaliseEdital && !isUploadDocs && (
            <div>
              <label className="text-xs text-muted-foreground">Nº do Edital / Contrato</label>
              <Input value={editalNum} onChange={e => setEditalNum(e.target.value)} placeholder="PE-001/2026 ou CT-001/2026" className="mt-1" />
            </div>
          )}
        </div>

        {/* ── Irregularidades flow (Impugnação/Esclarecimento) ── */}
        {isAnaliseEdital && (
          <>
            {showExtractor ? (
              <IrregularidadesExtractor
                onFinish={handleIrregularidadesFinish}
                editalNum={editalNum}
                setEditalNum={setEditalNum}
              />
            ) : (
              <>
                {irregularidades.length > 0 ? (
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">3</div>
                        <h4 className="text-sm font-semibold">Etapa 3 — Geração do Documento</h4>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowExtractor(true)} className="text-xs text-accent">
                        Reanalisar edital
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {irregularidades.map((irr, idx) => (
                        <Badge
                          key={irr.id}
                          variant="outline"
                          className={`text-[10px] ${irr.gravidade === 'alta' ? 'border-destructive/40 text-destructive' : irr.gravidade === 'media' ? 'border-yellow-500/40 text-yellow-700 dark:text-yellow-400' : 'border-blue-500/40 text-blue-700 dark:text-blue-400'}`}
                        >
                          {idx + 1}. {irr.descricao.slice(0, 50)}{irr.descricao.length > 50 ? '...' : ''}
                          {irr.origem === 'manual' && ' ✏️'}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {irregularidades.length} irregularidade(s) selecionada(s) • Edital: {editalNum || 'N/I'}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowExtractor(true)}
                    className="w-full border-dashed border-2 py-6 hover:border-accent/50 hover:bg-accent/5"
                  >
                    <FileText className="w-5 h-5 mr-2 text-accent" />
                    <span className="text-sm">Analisar edital e extrair irregularidades</span>
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {/* ── Document upload flow (Recurso/Contrarrazões/Reconsideração) ── */}
        {isUploadDocs && (
          <>
            {showPeticaoUploader ? (
              <DocumentosPeticaoUploader
                tipoDoc={tipoDoc}
                onFinish={handleFatosPeticaoFinish}
                editalNum={editalNum}
                setEditalNum={setEditalNum}
              />
            ) : (
              <>
                {fatosPeticao.length > 0 ? (
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">3</div>
                        <h4 className="text-sm font-semibold">Etapa 3 — Geração do {tipoDoc}</h4>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowPeticaoUploader(true)} className="text-xs text-accent">
                        Reanalisar documentos
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {fatosPeticao.map((fato, idx) => (
                        <Badge
                          key={fato.id}
                          variant="outline"
                          className={`text-[10px] ${fato.gravidade === 'alta' ? 'border-destructive/40 text-destructive' : fato.gravidade === 'media' ? 'border-yellow-500/40 text-yellow-700 dark:text-yellow-400' : 'border-blue-500/40 text-blue-700 dark:text-blue-400'}`}
                        >
                          {idx + 1}. {fato.descricao.slice(0, 50)}{fato.descricao.length > 50 ? '...' : ''}
                          {fato.origem === 'manual' && ' ✏️'}
                          {fato.origem === 'concorrente' && ' 🏢'}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {fatosPeticao.length} fato(s) jurídico(s) selecionado(s) • Edital: {editalNum || 'N/I'}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowPeticaoUploader(true)}
                    className="w-full border-dashed border-2 py-6 hover:border-accent/50 hover:bg-accent/5"
                  >
                    <FileText className="w-5 h-5 mr-2 text-accent" />
                    <span className="text-sm">
                      {tipoDoc === 'Recurso Administrativo' && 'Anexar decisão da CPL e extrair fatos'}
                      {tipoDoc === 'Contrarrazões' && 'Anexar recurso do concorrente e extrair argumentos'}
                      {tipoDoc === 'Pedido de Reconsideração' && 'Anexar decisão administrativa e extrair fatos'}
                    </span>
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {/* Reequilibrio indices */}
        {isReequilibrio && (
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-foreground">Dados econômicos sincronizados automaticamente</span>
            </div>
            {loadingIndices ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Carregando índices e CCTs...
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {indices.slice(0, 6).map(i => (
                  <Badge key={i.id} variant="outline" className="text-[10px]">
                    📊 {i.sigla}: {fmtPerc(i.acumulado_12m)} (12m)
                  </Badge>
                ))}
                {indices.length > 6 && <Badge variant="outline" className="text-[10px]">+{indices.length - 6} índices</Badge>}
                {ccts.map(c => (
                  <Badge key={c.id} variant="outline" className="text-[10px]">
                    👷 {c.categoria_profissional}: {c.reajuste_percentual ? `+${c.reajuste_percentual}%` : 'N/I'}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Estes dados serão injetados automaticamente como contexto para a IA gerar o documento com fundamentação numérica.
            </p>
          </div>
        )}

        {/* Context field */}
        {!isShowingUploader && (
          <div>
            <label className="text-xs text-muted-foreground">
              {(isAnaliseEdital && irregularidades.length > 0) || (isUploadDocs && fatosPeticao.length > 0)
                ? 'Contexto adicional (opcional — complementa os fatos extraídos)'
                : 'Fundamentação / Contexto'
              }
            </label>
            <Textarea
              value={contexto}
              onChange={e => setContexto(e.target.value)}
              placeholder={isReequilibrio
                ? "Descreva o contrato, itens afetados, valores originais e atuais, e impacto financeiro..."
                : (isAnaliseEdital && irregularidades.length > 0) || (isUploadDocs && fatosPeticao.length > 0)
                ? "Adicione contexto extra, como dados da empresa, fatos relevantes ou observações complementares..."
                : isUploadDocs
                ? "Descreva os fatos, a decisão contestada e os fundamentos jurídicos para a peça..."
                : "Descreva os fatos, a cláusula contestada e os fundamentos jurídicos..."
              }
              className="mt-1 min-h-[100px]"
            />
          </div>
        )}

        {/* Document selection */}
        {!isShowingUploader && docsBase.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <BookOpen className="w-3 h-3" />
              Documentos da Base Jurídica como referência ({selectedDocs.length} selecionados)
            </label>
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 rounded-md bg-muted/30">
              {docsBase.map(doc => (
                <Badge
                  key={doc.id}
                  variant={selectedDocs.includes(doc.id) ? 'default' : 'outline'}
                  className="cursor-pointer text-[11px] transition-colors"
                  onClick={() => toggleDoc(doc.id)}
                >
                  {doc.titulo.slice(0, 40)}{doc.titulo.length > 40 ? '...' : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!isShowingUploader && (
          <Button onClick={handleGerar} disabled={gerando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Gerar Documento
          </Button>
        )}
      </div>

      {/* Result */}
      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Documento Gerado</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
              <Button size="sm" variant="outline" onClick={async () => {
                const meta = {
                  empresa: activeEmpresa?.razao_social,
                  cnpj: activeEmpresa?.cnpj,
                  edital: editalNum || undefined,
                  timbradoUrl: activeEmpresa?.timbrado_url,
                  certificado_nome: activeEmpresa?.certificado_nome,
                  certificado_tipo: activeEmpresa?.certificado_tipo,
                  rep_nome: activeEmpresa?.rep_nome || undefined,
                  rep_cpf: activeEmpresa?.rep_cpf || undefined,
                  rep_cargo: activeEmpresa?.rep_cargo || undefined,
                };
                await exportLegalPDF(resultado, tipoDoc, meta);
                toast.success('PDF ABNT gerado com sucesso!');
              }}>
                <Download className="w-3 h-3 mr-1" /> PDF (ABNT)
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const meta = {
                  empresa: activeEmpresa?.razao_social,
                  cnpj: activeEmpresa?.cnpj,
                  edital: editalNum || undefined,
                  timbradoUrl: activeEmpresa?.timbrado_url,
                  certificado_nome: activeEmpresa?.certificado_nome,
                  certificado_tipo: activeEmpresa?.certificado_tipo,
                  rep_nome: activeEmpresa?.rep_nome || undefined,
                  rep_cpf: activeEmpresa?.rep_cpf || undefined,
                  rep_cargo: activeEmpresa?.rep_cargo || undefined,
                };
                exportLegalWord(resultado, tipoDoc, meta);
                toast.success('Word ABNT gerado com sucesso!');
              }}>
                <Download className="w-3 h-3 mr-1" /> Word (ABNT)
              </Button>
            </div>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
