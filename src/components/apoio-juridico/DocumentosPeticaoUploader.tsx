import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// Status sempre com texto (GRAVIDADE_LABELS); a cor é reforço via família semântica.
const GRAVIDADE_VARIANTE: Record<FatoPeticao['gravidade'], 'danger' | 'warning' | 'info'> = {
  alta: 'danger',
  media: 'warning',
  baixa: 'info',
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
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-tint text-primary text-xs font-bold" aria-hidden="true">1</span>
          <h4 className="text-base font-semibold">Etapa 1 — Anexar Documentos para {config.label}</h4>
        </div>

        <p className="text-sm text-muted-foreground">
          {config.uploadDesc}
        </p>

        {/* Edital number */}
        <div className="space-y-2">
          <Label htmlFor="peticao-edital-num">Nº do Edital / Processo</Label>
          <Input id="peticao-edital-num" value={editalNum} onChange={e => setEditalNum(e.target.value)} placeholder="PE-001/2026" />
        </div>

        {/* File upload */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            {config.uploadLabel}
          </p>

          {arquivos.length > 0 && (
            <ul className="rounded-md border border-border bg-card divide-y divide-border">
              {arquivos.map((arq) => (
                <li key={arq.id} className="flex items-center gap-3 px-4 py-2">
                  {arq.nome.endsWith('.zip') ? (
                    <FileArchive className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{arq.nome}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatSize(arq.tamanho)}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeFile(arq.id)} aria-label={`Remover ${arq.nome}`}>
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="w-full h-auto min-h-11 flex-col gap-2 rounded-lg border-2 border-dashed p-6 whitespace-normal hover:border-primary/40 hover:bg-primary-tint"
          >
            <Upload className="text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Anexar documentos</span>
            <span className="flex gap-1">
              <Badge variant="muted">PDF</Badge>
              <Badge variant="muted">DOC</Badge>
              <Badge variant="muted">TXT</Badge>
              <Badge variant="muted">ZIP</Badge>
            </span>
          </Button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.zip" className="hidden" onChange={handleAddFiles} aria-hidden="true" tabIndex={-1} />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className="bg-card px-2 text-xs text-muted-foreground">ou cole o texto</span>
          </div>
          <div className="border-t border-border my-3" />
        </div>

        {/* Paste area */}
        <div className="space-y-2">
          <Label htmlFor="peticao-texto-colado" className="sr-only">Texto do documento</Label>
          <Textarea
            id="peticao-texto-colado"
            value={textoColado}
            onChange={e => setTextoColado(e.target.value)}
            placeholder={config.uploadPlaceholder}
            className="min-h-[150px]"
          />
        </div>

        {/* Concorrentes integration */}
        <div className="rounded-md border border-border bg-muted/50 p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold">Dados da Inteligência de Concorrentes</span>
            <Badge variant="muted">Opcional</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Selecione um concorrente da base para enriquecer a análise com dados já coletados (CNPJ, situação cadastral, etc.).
          </p>
          {loadingConcorrentes ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Carregando concorrentes...
            </p>
          ) : concorrentes.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="peticao-concorrente" className="sr-only">Concorrente da base</Label>
              <Select value={concorrenteSelecionado} onValueChange={setConcorrenteSelecionado}>
                <SelectTrigger id="peticao-concorrente">
                  <SelectValue placeholder="Selecionar concorrente da base..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {concorrentes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" aria-hidden="true" />
                        {c.razao_social} — {c.cnpj}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nenhum concorrente cadastrado. Acesse Inteligência → Concorrentes para adicionar.
            </p>
          )}
        </div>

        {/* Extract button */}
        <Button
          onClick={handleExtract}
          disabled={extracting || (arquivos.length === 0 && !textoColado.trim() && !concorrenteAnalise)}
          className="w-full"
        >
          {extracting ? (
            <><Loader2 className="animate-spin" aria-hidden="true" /> {progress || 'Analisando...'}</>
          ) : (
            <><Sparkles aria-hidden="true" /> Extrair Fatos Jurídicos com IA</>
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
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-tint text-primary text-xs font-bold" aria-hidden="true">2</span>
          <h4 className="text-base font-semibold">Etapa 2 — Revisão dos Fatos Jurídicos</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
          <ChevronLeft aria-hidden="true" /> Voltar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Revise os fatos extraídos pela IA. Desmarque os que não deseja incluir e adicione fatos manualmente.
      </p>

      {/* Stats */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="info" className="tabular-nums">{fatos.length} identificado(s)</Badge>
        <Badge variant="success" className="tabular-nums">{selectedCount} selecionado(s)</Badge>
        <Badge variant="muted" className="tabular-nums">{fatos.filter(f => f.origem === 'manual').length} manual(is)</Badge>
      </div>

      {/* Fatos list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {fatos.map(item => (
          <div
            key={item.id}
            className={`rounded-md border p-3 space-y-2 transition-colors ${
              item.selecionado ? 'bg-card border-border' : 'bg-muted/50 border-border opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={item.selecionado}
                onCheckedChange={() => toggleFato(item.id)}
                className="mt-0.5"
                aria-label={`Incluir fato: ${item.descricao.slice(0, 60)}`}
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={GRAVIDADE_VARIANTE[item.gravidade]} className="gap-1">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    {GRAVIDADE_LABELS[item.gravidade]}
                  </Badge>
                  <Badge variant="muted">
                    {item.origem === 'ia' ? 'IA' : item.origem === 'concorrente' ? 'Concorrente' : 'Manual'}
                  </Badge>
                  <Badge variant="info">{item.categoria}</Badge>
                </div>
                <p className="text-sm text-foreground">{item.descricao}</p>
                <p className="text-sm text-muted-foreground italic">{item.fundamentacao}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive-tint"
                onClick={() => removeFato(item.id)}
                aria-label="Remover fato"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}

        {fatos.length === 0 && (
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold">Nenhum fato identificado</p>
            <p className="text-sm text-muted-foreground">Adicione manualmente abaixo.</p>
          </div>
        )}
      </div>

      {/* Manual add */}
      {showManualForm ? (
        <div className="rounded-md border border-border bg-muted/50 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h5 className="text-base font-semibold flex items-center gap-1">
              <Plus className="w-4 h-4" aria-hidden="true" /> Adicionar Fato Jurídico Manual
            </h5>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowManualForm(false)} aria-label="Fechar formulário manual">
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="peticao-manual-desc">Descrição do fato *</Label>
            <Textarea
              id="peticao-manual-desc"
              value={manualDesc}
              onChange={e => setManualDesc(e.target.value)}
              placeholder="Descreva o fato jurídico, irregularidade ou argumento..."
              className="min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="peticao-manual-fund">Fundamentação jurídica</Label>
            <Textarea
              id="peticao-manual-fund"
              value={manualFund}
              onChange={e => setManualFund(e.target.value)}
              placeholder="Cite artigos da Lei 14.133/2021, jurisprudência TCU..."
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="peticao-manual-grav">Gravidade</Label>
            <Select value={manualGrav} onValueChange={v => setManualGrav(v as 'alta' | 'media' | 'baixa')}>
              <SelectTrigger id="peticao-manual-grav">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta — Ilegalidade clara</SelectItem>
                <SelectItem value="media">Média — Vício relevante</SelectItem>
                <SelectItem value="baixa">Baixa — Irregularidade menor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addManual}>
            <Plus aria-hidden="true" /> Adicionar
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowManualForm(true)} className="w-full border-dashed">
          <Plus aria-hidden="true" /> Adicionar fato jurídico manual
        </Button>
      )}

      {/* Proceed */}
      <Button
        onClick={handleFinish}
        disabled={selectedCount === 0}
        className="w-full"
      >
        <ChevronRight aria-hidden="true" />
        Prosseguir com {selectedCount} fato(s) para geração do documento
      </Button>
    </div>
  );
}
