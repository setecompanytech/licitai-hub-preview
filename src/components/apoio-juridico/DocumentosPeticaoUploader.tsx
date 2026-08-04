import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Upload, FileText, X, Plus, Trash2, Users,
  AlertTriangle, Scale, ChevronLeft, ChevronRight, FileArchive,
  Sparkles, Search, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Types ──────────────────────────────────────────────────────────
export interface FatoPeticao {
  id: string;
  descricao: string;
  fundamentacao: string;
  gravidade: 'alta' | 'media' | 'baixa';
  categoria: string;
  selecionado: boolean;
  origem: 'ia' | 'manual' | 'concorrente';
}

interface DocumentosPeticaoUploaderProps {
  tipoDoc: string;
  onFinish: (fatos: FatoPeticao[], documentosTexto: string, editalNum: string) => void;
  editalNum: string;
  setEditalNum: (v: string) => void;
}

type ArquivoUpload = { id: string; nome: string; tamanho: number; file: File };
type Concorrente = { id: string; razao_social: string; cnpj: string; situacao: string | null };

// ── Config per petition type ────────────────────────────────────────
const PETICAO_CONFIG: Record<string, {
  label: string;
  uploadLabel: string;
  uploadDesc: string;
  uploadPlaceholder: string;
  aiPrompt: string;
  categorias: string[];
}> = {
  'Recurso Administrativo': {
    label: 'Recurso Administrativo',
    uploadLabel: 'Decisão da CPL / Ata de Julgamento',
    uploadDesc: 'Anexe a decisão da Comissão Permanente de Licitações que motivou o recurso (ata de habilitação, ata de julgamento de propostas, decisão de inabilitação/desclassificação, etc.)',
    uploadPlaceholder: 'Cole aqui o texto da decisão da CPL, ata de julgamento ou documento que fundamenta o recurso...',
    aiPrompt: `Você é um advogado especialista em licitações públicas (Lei 14.133/2021).

Analise a DECISÃO DA CPL / ATA DE JULGAMENTO abaixo e extraia TODOS os fatos jurídicos relevantes para fundamentar um RECURSO ADMINISTRATIVO.

Para cada fato, retorne um JSON array (SEM markdown, APENAS JSON):
[
  {
    "descricao": "Descrição detalhada do fato jurídico identificado na decisão",
    "fundamentacao": "Fundamentação legal completa (Lei 14.133/2021, jurisprudência TCU)",
    "gravidade": "alta|media|baixa",
    "categoria": "categoria do fato"
  }
]

CATEGORIAS DE ANÁLISE:
1. Habilitação irregular do concorrente (Art. 62-70)
2. Aceitação indevida de proposta (Art. 59, Art. 33-39)
3. Desclassificação/inabilitação injusta do recorrente (Art. 64, §1º)
4. Vício no julgamento das propostas (Art. 33-39)
5. Descumprimento de exigência editalícia
6. Cerceamento de defesa ou contraditório (Art. 165)
7. Erro material ou de cálculo
8. Não observância de tratamento diferenciado ME/EPP (LC 123/2006)
9. Irregularidade documental do concorrente habilitado
10. Falha na análise da qualificação técnica (Art. 67)
11. Falha na análise econômico-financeira (Art. 69)

REGRAS:
- Identifique irregularidades na DECISÃO da CPL
- Aponte falhas na habilitação/proposta do concorrente que foi indevidamente aceito
- Identifique vícios no julgamento que prejudicaram o recorrente
- Se houver dados de documentos de concorrente, cruze com as exigências legais`,
    categorias: ['Habilitação irregular', 'Proposta irregular', 'Desclassificação injusta', 'Vício de julgamento', 'Exigência editalícia', 'Cerceamento de defesa', 'Erro material', 'ME/EPP', 'Qualificação técnica', 'Econômico-financeira'],
  },
  'Contrarrazões': {
    label: 'Contrarrazões ao Recurso',
    uploadLabel: 'Recurso Administrativo do Concorrente',
    uploadDesc: 'Anexe o recurso administrativo postulado pelo concorrente para extrair os argumentos a serem rebatidos na contrarrazão.',
    uploadPlaceholder: 'Cole aqui o texto do recurso administrativo do concorrente...',
    aiPrompt: `Você é um advogado especialista em licitações públicas (Lei 14.133/2021).

Analise o RECURSO ADMINISTRATIVO DO CONCORRENTE abaixo e extraia TODOS os argumentos e alegações que precisam ser rebatidos nas CONTRARRAZÕES.

Para cada argumento do recorrente, retorne um JSON array (SEM markdown, APENAS JSON):
[
  {
    "descricao": "Argumento/alegação do recorrente que precisa ser rebatido",
    "fundamentacao": "Contra-argumentação jurídica (Lei 14.133/2021, jurisprudência TCU) para refutar",
    "gravidade": "alta|media|baixa",
    "categoria": "categoria do argumento"
  }
]

CATEGORIAS DE ANÁLISE:
1. Alegação de irregularidade na habilitação (para rebater)
2. Alegação de vícios na proposta (para rebater)
3. Pedido de desclassificação/inabilitação do contrarrazoante
4. Alegação de cerceamento de defesa
5. Argumento sobre tratamento diferenciado ME/EPP
6. Alegação de erro na documentação
7. Questionamento de qualificação técnica
8. Questionamento econômico-financeiro
9. Argumento sobre ilegalidade editalícia
10. Pedido de anulação/revisão do certame

REGRAS:
- Identifique CADA argumento do recurso
- Para cada um, forneça a tese de defesa/contra-argumentação
- Classifique gravidade: "alta" = argumento forte que precisa de refutação robusta
- Aponte fragilidades na tese recursal`,
    categorias: ['Habilitação', 'Proposta', 'Desclassificação', 'Cerceamento', 'ME/EPP', 'Documentação', 'Qualificação técnica', 'Econômico-financeira', 'Edital', 'Anulação'],
  },
  'Pedido de Reconsideração': {
    label: 'Pedido de Reconsideração',
    uploadLabel: 'Decisão Administrativa / Ato Impugnado',
    uploadDesc: 'Anexe a decisão administrativa, despacho ou ato que se pretende reconsiderar (decisão de inabilitação, desclassificação, sanção, etc.)',
    uploadPlaceholder: 'Cole aqui o texto da decisão administrativa, despacho ou ato a ser reconsiderado...',
    aiPrompt: `Você é um advogado especialista em licitações públicas (Lei 14.133/2021).

Analise a DECISÃO ADMINISTRATIVA abaixo e extraia TODOS os fatos e fundamentos relevantes para um PEDIDO DE RECONSIDERAÇÃO.

Para cada fato, retorne um JSON array (SEM markdown, APENAS JSON):
[
  {
    "descricao": "Fato ou fundamento para o pedido de reconsideração",
    "fundamentacao": "Fundamentação legal (Lei 14.133/2021, Art. 165-168, jurisprudência TCU)",
    "gravidade": "alta|media|baixa",
    "categoria": "categoria do fato"
  }
]

CATEGORIAS DE ANÁLISE:
1. Erro de fato na decisão
2. Erro de direito na decisão
3. Fato novo / documento novo
4. Desproporcionalidade da decisão/sanção
5. Cerceamento de defesa (Art. 165, §2º)
6. Inobservância do devido processo legal
7. Vício de motivação (Art. 71)
8. Ausência de diligência (Art. 64, §1º)
9. Desconsideração de documentos/argumentos
10. Divergência jurisprudencial

REGRAS:
- Identifique falhas na decisão que justificam reconsideração
- Aponte erros de fato e de direito
- Identifique se houve cerceamento de defesa
- Verifique proporcionalidade de eventual sanção`,
    categorias: ['Erro de fato', 'Erro de direito', 'Fato novo', 'Desproporcionalidade', 'Cerceamento', 'Processo legal', 'Motivação', 'Diligência', 'Desconsideração', 'Jurisprudência'],
  },
  'Recurso Hierárquico': {
    label: 'Recurso Hierárquico',
    uploadLabel: 'Decisão do Pedido de Reconsideração Indeferido + Edital',
    uploadDesc: 'Anexe a decisão que indeferiu o pedido de reconsideração, o edital e demais peças processuais relevantes para fundamentar o recurso à autoridade superior.',
    uploadPlaceholder: 'Cole aqui o texto da decisão que indeferiu o pedido de reconsideração, a decisão originária e/ou outros documentos relevantes...',
    aiPrompt: `Você é um advogado especialista em licitações públicas (Lei 14.133/2021).

Analise a DECISÃO QUE INDEFERIU O PEDIDO DE RECONSIDERAÇÃO e demais documentos abaixo, e extraia TODOS os fatos e fundamentos relevantes para um RECURSO HIERÁRQUICO à autoridade superior.

Para cada fato, retorne um JSON array (SEM markdown, APENAS JSON):
[
  {
    "descricao": "Fato ou fundamento para o recurso hierárquico",
    "fundamentacao": "Fundamentação legal (Lei 14.133/2021, Art. 167, jurisprudência TCU)",
    "gravidade": "alta|media|baixa",
    "categoria": "categoria do fato"
  }
]

CATEGORIAS DE ANÁLISE:
1. Manutenção indevida da decisão originária
2. Erro na apreciação do pedido de reconsideração
3. Fato novo não considerado
4. Desproporcionalidade da sanção mantida
5. Cerceamento de defesa na instância inferior
6. Inobservância do devido processo legal
7. Vício de motivação na decisão recorrida
8. Divergência com jurisprudência TCU/Tribunais
9. Ilegalidade na decisão originária não corrigida
10. Ausência de fundamentação adequada

REGRAS:
- Identifique as falhas da decisão que indeferiu a reconsideração
- Aponte vícios que persistem desde a decisão originária
- Demonstre que a autoridade inferior não apreciou corretamente os argumentos
- Verifique se houve inovação ou fato novo desconsiderado`,
    categorias: ['Manutenção indevida', 'Erro de apreciação', 'Fato novo', 'Desproporcionalidade', 'Cerceamento', 'Processo legal', 'Motivação', 'Jurisprudência', 'Ilegalidade', 'Fundamentação'],
  },
  'Impugnação ao Edital': {
    label: 'Impugnação ao Edital',
    uploadLabel: 'Edital / Instrumento Convocatório',
    uploadDesc: 'Anexe o edital ou instrumento convocatório completo para que a IA identifique cláusulas restritivas, desproporcionais ou ilegais que fundamentem a impugnação.',
    uploadPlaceholder: 'Cole aqui o texto do edital ou instrumento convocatório...',
    aiPrompt: `Você é um advogado especialista em licitações públicas (Lei 14.133/2021).

Analise o EDITAL / INSTRUMENTO CONVOCATÓRIO abaixo e extraia TODAS as irregularidades, cláusulas restritivas, desproporcionais ou ilegais que possam fundamentar uma IMPUGNAÇÃO AO EDITAL.

Para cada irregularidade, retorne um JSON array (SEM markdown, APENAS JSON):
[
  {
    "descricao": "Descrição detalhada da irregularidade ou cláusula restritiva identificada",
    "fundamentacao": "Fundamentação legal (Lei 14.133/2021, jurisprudência TCU, doutrina)",
    "gravidade": "alta|media|baixa",
    "categoria": "categoria da irregularidade"
  }
]

CATEGORIAS DE ANÁLISE:
1. Restrição indevida à competitividade (Art. 9º)
2. Exigência de habilitação desproporcional (Art. 62-70)
3. Descrição direcionada do objeto (Art. 40-47)
4. Prazo inadequado (Art. 55)
5. Critério de julgamento inadequado (Art. 33-39)
6. Exigência de qualificação técnica excessiva (Art. 67)
7. Exigência econômico-financeira desproporcional (Art. 69)
8. Ausência de tratamento diferenciado ME/EPP (LC 123/2006)
9. Vício na fase interna / planejamento (Art. 18-27)
10. Cláusula contratual abusiva (Art. 89-92)
11. Irregularidade no modo de disputa (Art. 56)
12. Exigência de amostra/demonstração irregular (Art. 17, §3º)

REGRAS:
- Identifique CADA cláusula ou exigência irregular
- Cite o artigo/inciso específico da Lei 14.133/2021 violado
- Referencie Súmulas do TCU quando aplicável (247, 248, 269, etc.)
- Classifique gravidade: "alta" = restrição direta à competitividade`,
    categorias: ['Restrição competitividade', 'Habilitação desproporcional', 'Direcionamento', 'Prazo inadequado', 'Critério julgamento', 'Qualificação técnica', 'Econômico-financeira', 'ME/EPP', 'Planejamento', 'Cláusula abusiva', 'Modo disputa', 'Amostra/demonstração'],
  },
  'Pedido de Esclarecimento': {
    label: 'Pedido de Esclarecimento',
    uploadLabel: 'Edital / Instrumento Convocatório',
    uploadDesc: 'Anexe o edital para que a IA identifique termos ambíguos, contradições ou pontos obscuros que justifiquem pedido de esclarecimento.',
    uploadPlaceholder: 'Cole aqui o texto do edital ou instrumento convocatório...',
    aiPrompt: `Você é um advogado especialista em licitações públicas (Lei 14.133/2021).

Analise o EDITAL abaixo e identifique TODOS os pontos que necessitam de esclarecimento — termos ambíguos, contradições, omissões ou cláusulas que possam gerar interpretações divergentes.

Para cada ponto, retorne um JSON array (SEM markdown, APENAS JSON):
[
  {
    "descricao": "Descrição do ponto que necessita esclarecimento",
    "fundamentacao": "Fundamentação legal e justificativa para o pedido (Art. 164 da Lei 14.133/2021)",
    "gravidade": "alta|media|baixa",
    "categoria": "categoria do ponto"
  }
]

CATEGORIAS DE ANÁLISE:
1. Ambiguidade na descrição do objeto
2. Contradição entre cláusulas
3. Omissão de informação essencial
4. Critério de julgamento impreciso
5. Exigência de habilitação obscura
6. Prazo ou condição indefinida
7. Especificação técnica vaga
8. Condição contratual ambígua

REGRAS:
- Identifique CADA ponto de ambiguidade ou obscuridade
- Formule a pergunta de esclarecimento implícita
- Classifique gravidade: "alta" = pode inviabilizar participação`,
    categorias: ['Ambiguidade objeto', 'Contradição', 'Omissão', 'Critério impreciso', 'Habilitação obscura', 'Prazo indefinido', 'Especificação vaga', 'Cláusula ambígua'],
  },
};

const GRAVIDADE_COLORS: Record<string, string> = {
  alta: 'bg-destructive/10 text-destructive border-destructive/30',
  media: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  baixa: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
};

const GRAVIDADE_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

// ── Component ──────────────────────────────────────────────────────
export default function DocumentosPeticaoUploader({ tipoDoc, onFinish, editalNum, setEditalNum }: DocumentosPeticaoUploaderProps) {
  const { user } = useAuth();
  const config = PETICAO_CONFIG[tipoDoc];

  const [step, setStep] = useState<1 | 2>(1);
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [textoColado, setTextoColado] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState('');
  const [fatos, setFatos] = useState<FatoPeticao[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Concorrentes integration
  const [concorrentes, setConcorrentes] = useState<Concorrente[]>([]);
  const [concorrenteSelecionado, setConcorrenteSelecionado] = useState<string>('');
  const [loadingConcorrentes, setLoadingConcorrentes] = useState(false);
  const [concorrenteAnalise, setConcorrenteAnalise] = useState('');

  // Manual add
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDesc, setManualDesc] = useState('');
  const [manualFund, setManualFund] = useState('');
  const [manualGrav, setManualGrav] = useState<'alta' | 'media' | 'baixa'>('media');

  // Load concorrentes from DB
  useEffect(() => {
    if (!user) return;
    setLoadingConcorrentes(true);
    supabase
      .from('concorrentes')
      .select('id, razao_social, cnpj, situacao')
      .eq('user_id', user.id)
      .order('razao_social')
      .then(({ data }) => {
        if (data) setConcorrentes(data);
        setLoadingConcorrentes(false);
      });
  }, [user]);

  // Load concorrente analysis when selected
  useEffect(() => {
    if (!concorrenteSelecionado || concorrenteSelecionado === 'none') {
      setConcorrenteAnalise('');
      return;
    }
    const c = concorrentes.find(x => x.id === concorrenteSelecionado);
    if (c) {
      setConcorrenteAnalise(
        `DADOS DO CONCORRENTE (da base de inteligência):\n- Razão Social: ${c.razao_social}\n- CNPJ: ${c.cnpj}\n- Situação: ${c.situacao || 'N/I'}`
      );
    }
  }, [concorrenteSelecionado, concorrentes]);

  if (!config) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const novos: ArquivoUpload[] = [];
    for (const f of Array.from(files)) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!['.pdf', '.doc', '.docx', '.txt', '.zip'].includes(ext)) {
        toast.error(`Formato não suportado: ${f.name}. Use PDF, DOC, DOCX, TXT ou ZIP.`);
        continue;
      }
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`Arquivo muito grande: ${f.name}. Máximo 50MB.`);
        continue;
      }
      novos.push({ id: crypto.randomUUID(), nome: f.name, tamanho: f.size, file: f });
    }
    setArquivos(prev => [...prev, ...novos]);
    e.target.value = '';
  };

  const removeFile = (id: string) => setArquivos(prev => prev.filter(a => a.id !== id));

  const extractFileText = async (file: File, nome: string): Promise<string> => {
    try {
      if (nome.toLowerCase().endsWith('.zip')) {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(file);
        const parts: string[] = [];
        for (const [name, entry] of Object.entries(zip.files)) {
          if (!entry.dir) {
            try {
              const text = await entry.async('text');
              if (text && text.length > 50) parts.push(`[ZIP > ${name}]:\n${text.slice(0, 8000)}`);
            } catch {
              parts.push(`[ZIP > ${name}]: Arquivo binário.`);
            }
          }
        }
        return parts.join('\n\n');
      }
      const text = await file.text();
      return `[${nome}]:\n${text.slice(0, 15000)}`;
    } catch {
      return `[${nome}]: Não foi possível ler o conteúdo.`;
    }
  };

  const handleExtract = async () => {
    const allTexts: string[] = [];

    // Extract from uploaded files
    for (const arq of arquivos) {
      const text = await extractFileText(arq.file, arq.nome);
      allTexts.push(text);
    }

    // Add pasted text
    if (textoColado.trim()) {
      allTexts.push(`[Texto colado pelo usuário]:\n${textoColado}`);
    }

    if (allTexts.length === 0 && !concorrenteAnalise) {
      toast.error('Anexe documentos, cole o texto ou selecione um concorrente da base.');
      return;
    }

    setExtracting(true);
    setProgress('Extraindo fatos jurídicos com IA...');
    setFatos([]);

    const fullText = allTexts.join('\n\n---\n\n');
    const truncated = fullText.slice(0, 25000);

    let content = '';
    await streamAIChat({
      messages: [{
        role: 'user',
        content: `${config.aiPrompt}

${concorrenteAnalise ? `\n${concorrenteAnalise}\n` : ''}
DOCUMENTO PARA ANÁLISE:
${truncated}`
      }],
      action: 'analise_peticao',
      onDelta: (chunk) => {
        content += chunk;
        setProgress('Identificando fatos jurídicos...');
      },
      onDone: () => {
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            toast.warning('Não foram identificados fatos relevantes no documento.');
            setFatos([]);
            setStep(2);
            setExtracting(false);
            setProgress('');
            return;
          }
          const parsed = JSON.parse(jsonMatch[0]) as Array<{
            descricao: string;
            fundamentacao: string;
            gravidade: string;
            categoria: string;
          }>;

          const items: FatoPeticao[] = parsed.map((p, idx) => ({
            id: `ia-${idx}`,
            descricao: p.descricao,
            fundamentacao: p.fundamentacao,
            gravidade: (['alta', 'media', 'baixa'].includes(p.gravidade) ? p.gravidade : 'media') as 'alta' | 'media' | 'baixa',
            categoria: p.categoria || 'Geral',
            selecionado: true,
            origem: 'ia' as const,
          }));

          setFatos(items);
          setStep(2);
          toast.success(`${items.length} fato(s) jurídico(s) identificado(s)!`);
        } catch {
          toast.error('Erro ao processar análise do documento.');
        }
        setExtracting(false);
        setProgress('');
      },
      onError: (err) => {
        toast.error(err);
        setExtracting(false);
        setProgress('');
      },
    });
  };

  const toggleFato = (id: string) => {
    setFatos(prev => prev.map(f => f.id === id ? { ...f, selecionado: !f.selecionado } : f));
  };

  const removeFato = (id: string) => {
    setFatos(prev => prev.filter(f => f.id !== id));
  };

  const addManual = () => {
    if (!manualDesc.trim()) {
      toast.error('Descreva o fato jurídico.');
      return;
    }
    const newItem: FatoPeticao = {
      id: `manual-${Date.now()}`,
      descricao: manualDesc,
      fundamentacao: manualFund || 'Fundamentação a ser complementada',
      gravidade: manualGrav,
      categoria: 'Manual',
      selecionado: true,
      origem: 'manual',
    };
    setFatos(prev => [...prev, newItem]);
    setManualDesc('');
    setManualFund('');
    setManualGrav('media');
    setShowManualForm(false);
    toast.success('Fato jurídico adicionado manualmente!');
  };

  const selectedCount = fatos.filter(f => f.selecionado).length;

  const handleFinish = () => {
    const selected = fatos.filter(f => f.selecionado);
    if (selected.length === 0) {
      toast.error('Selecione ao menos um fato jurídico.');
      return;
    }

    // Build full text context from uploaded documents
    const docsContext = arquivos.map(a => a.nome).join(', ');
    const fullContext = [
      docsContext ? `Documentos anexados: ${docsContext}` : '',
      concorrenteAnalise,
      textoColado ? 'Texto adicional fornecido pelo usuário.' : '',
    ].filter(Boolean).join('\n');

    onFinish(selected, fullContext, editalNum);
  };

  // ── STEP 1: Upload documents ──────────────────────────────────
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">1</div>
          <h4 className="text-sm font-semibold">Etapa 1 — Anexar Documentos para {config.label}</h4>
        </div>

        <p className="text-xs text-muted-foreground">
          {config.uploadDesc}
        </p>

        {/* Edital number */}
        <div>
          <label className="text-xs text-muted-foreground">Nº do Edital / Processo</label>
          <Input value={editalNum} onChange={e => setEditalNum(e.target.value)} placeholder="PE-001/2026" className="mt-1" />
        </div>

        {/* File upload */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {config.uploadLabel}
          </label>

          {arquivos.length > 0 && (
            <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/30">
              {arquivos.map((arq) => (
                <div key={arq.id} className="flex items-center gap-3 px-4 py-2.5">
                  {arq.nome.endsWith('.zip') ? (
                    <FileArchive className="w-4 h-4 text-accent shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-accent shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{arq.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(arq.tamanho)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(arq.id)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-border/60 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all"
          >
            <Upload className="w-6 h-6 text-accent" />
            <span className="text-xs font-medium">Anexar documentos</span>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs">PDF</Badge>
              <Badge variant="outline" className="text-xs">DOC</Badge>
              <Badge variant="outline" className="text-xs">TXT</Badge>
              <Badge variant="outline" className="text-xs">ZIP</Badge>
            </div>
          </button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.zip" className="hidden" onChange={handleAddFiles} />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className="bg-card px-2 text-xs text-muted-foreground">ou cole o texto</span>
          </div>
          <div className="border-t border-border/40 my-3" />
        </div>

        {/* Paste area */}
        <Textarea
          value={textoColado}
          onChange={e => setTextoColado(e.target.value)}
          placeholder={config.uploadPlaceholder}
          className="min-h-[150px] text-xs"
        />

        {/* Concorrentes integration */}
        <div className="bg-muted/30 rounded-lg border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold">Dados da Inteligência de Concorrentes</span>
            <Badge variant="outline" className="text-xs">Opcional</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione um concorrente da base para enriquecer a análise com dados já coletados (CNPJ, situação cadastral, etc.).
          </p>
          {loadingConcorrentes ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando concorrentes...
            </p>
          ) : concorrentes.length > 0 ? (
            <Select value={concorrenteSelecionado} onValueChange={setConcorrenteSelecionado}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Selecionar concorrente da base..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {concorrentes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="w-3 h-3" />
                      {c.razao_social} — {c.cnpj}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Nenhum concorrente cadastrado. Acesse Inteligência → Concorrentes para adicionar.
            </p>
          )}
        </div>

        {/* Extract button */}
        <Button
          onClick={handleExtract}
          disabled={extracting || (arquivos.length === 0 && !textoColado.trim() && !concorrenteAnalise)}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {extracting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {progress || 'Analisando...'}</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Extrair Fatos Jurídicos com IA</>
          )}
        </Button>
      </div>
    );
  }

  // ── STEP 2: Review + manual add ───────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">2</div>
          <h4 className="text-sm font-semibold">Etapa 2 — Revisão dos Fatos Jurídicos</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
          <ChevronLeft className="w-3 h-3 mr-1" /> Voltar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Revise os fatos extraídos pela IA. Desmarque os que não deseja incluir e adicione fatos manualmente.
      </p>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs">{fatos.length} identificado(s)</Badge>
        <Badge className="bg-accent/10 text-accent border-accent/20 text-xs">{selectedCount} selecionado(s)</Badge>
        <Badge variant="outline" className="text-xs">{fatos.filter(f => f.origem === 'manual').length} manual(is)</Badge>
      </div>

      {/* Fatos list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {fatos.map(item => (
          <div
            key={item.id}
            className={`rounded-lg border p-3 space-y-2 transition-all ${
              item.selecionado ? 'bg-card border-border' : 'bg-muted/20 border-border/30 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox checked={item.selecionado} onCheckedChange={() => toggleFato(item.id)} className="mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs border ${GRAVIDADE_COLORS[item.gravidade]}`}>
                    <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                    {GRAVIDADE_LABELS[item.gravidade]}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {item.origem === 'ia' ? '🤖 IA' : item.origem === 'concorrente' ? '🏢 Concorrente' : '✏️ Manual'}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-primary/5">{item.categoria}</Badge>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{item.descricao}</p>
                <p className="text-xs text-muted-foreground leading-relaxed italic">📖 {item.fundamentacao}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeFato(item.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}

        {fatos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhum fato identificado. Adicione manualmente abaixo.</p>
          </div>
        )}
      </div>

      {/* Manual add */}
      {showManualForm ? (
        <div className="bg-muted/30 rounded-lg border border-border/50 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h5 className="text-xs font-semibold flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Fato Jurídico Manual
            </h5>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowManualForm(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição do fato *</label>
            <Textarea
              value={manualDesc}
              onChange={e => setManualDesc(e.target.value)}
              placeholder="Descreva o fato jurídico, irregularidade ou argumento..."
              className="mt-1 min-h-[80px] text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fundamentação jurídica</label>
            <Textarea
              value={manualFund}
              onChange={e => setManualFund(e.target.value)}
              placeholder="Cite artigos da Lei 14.133/2021, jurisprudência TCU..."
              className="mt-1 min-h-[60px] text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Gravidade</label>
            <select
              value={manualGrav}
              onChange={e => setManualGrav(e.target.value as 'alta' | 'media' | 'baixa')}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
            >
              <option value="alta">🔴 Alta — Ilegalidade clara</option>
              <option value="media">🟡 Média — Vício relevante</option>
              <option value="baixa">🔵 Baixa — Irregularidade menor</option>
            </select>
          </div>
          <Button size="sm" onClick={addManual} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowManualForm(true)} className="w-full border-dashed">
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar fato jurídico manual
        </Button>
      )}

      {/* Proceed */}
      <Button
        onClick={handleFinish}
        disabled={selectedCount === 0}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        <ChevronRight className="w-4 h-4 mr-1" />
        Prosseguir com {selectedCount} fato(s) para geração do documento
      </Button>
    </div>
  );
}
