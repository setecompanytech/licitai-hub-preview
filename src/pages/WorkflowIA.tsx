import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Building2, CheckCircle2, Info, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import ListaEtapas from '@/components/workflow-ia/ListaEtapas';
import PainelEtapa from '@/components/workflow-ia/PainelEtapa';
import ResumoExecucao from '@/components/workflow-ia/ResumoExecucao';
import { WORKFLOW_STEPS, type SituacaoEtapa } from '@/components/workflow-ia/etapas';

/**
 * Workflow IA — composição de três colunas do comando de 13/09: etapas à
 * esquerda, conteúdo da etapa no centro, resumo à direita.
 *
 * A decisão que atravessa a tela inteira: SEPARAR SUGESTÃO DE EXECUÇÃO.
 *
 * O que a tela faz, de fato, é oito chamadas de texto ao modelo
 * (`streamAIChat` com `action: 'workflow_ia_step'`, que cai na edge function
 * `ai-chat`). Não existe edge function `workflow-ia`; nenhuma linha daqui faz
 * INSERT ou UPDATE em processo, compromisso, alerta, precificação, proposta ou
 * sessão de lance; o resultado vive num `useState` e desaparece no F5. Ou
 * seja: NADA é executado — tudo é sugestão.
 *
 * A tela antiga dizia o contrário em cada peça: "Iniciar esteira",
 * "Executando...", "Em execução", "Concluído", "Esteira concluída". Lida por
 * quem não conhece o código, ela afirmava que o prazo foi para o calendário,
 * que o alerta saiu no WhatsApp e que o robô de lances ficou configurado.
 * Nenhuma das três coisas aconteceu. Aqui o vocabulário é de análise, o aviso
 * de topo diz isso em uma frase, o resumo da direita carrega a linha
 * "Registros criados no sistema: Nenhum", e o caminho para a decisão de
 * verdade — Meus compromissos — está sempre à vista.
 *
 * Nenhuma autorização de automação foi ampliada: a tela continua sem poder
 * gravar nada, e passou a dizer isso.
 */

/** Só o que o prompt consome da empresa — evita depender do tipo do contexto. */
type DadosEmpresa = {
  nome_fantasia: string | null;
  razao_social: string;
  cnpj: string;
  cnae_principal: string | null;
  uf: string | null;
  municipio: string | null;
};

export default function WorkflowIA() {
  const { user } = useAuth();
  const { empresas, empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [empresaId, setEmpresaId] = useState(empresaAtiva?.id || '');
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepResults, setStepResults] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  /** Mensagem REAL da falha, por etapa. Antes isso não existia. */
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  /** Etapa aberta na coluna do meio. */
  const [etapaAberta, setEtapaAberta] = useState<string>(WORKFLOW_STEPS[0].key);
  /** Etapa em retentativa isolada — separada de `running` (as oito em fila). */
  const [retentando, setRetentando] = useState<string | null>(null);

  const membroSelecionado = empresas.find((e) => e.empresa_id === empresaId);
  const empresaNome = membroSelecionado
    ? membroSelecionado.empresa.nome_fantasia || membroSelecionado.empresa.razao_social
    : null;
  const ocupado = running || retentando !== null;
  const quantidadeFalhas = Object.keys(falhas).length;

  /**
   * O prompt é EXATAMENTE o que a tela já enviava — parâmetros da empresa,
   * rótulo e descrição da etapa, e 500 caracteres do resultado anterior.
   *
   * NOTA para o dono do produto, não corrigida aqui de propósito: numa análise
   * das oito etapas em sequência, `stepResults` é o valor do render em que
   * `runWorkflow` foi criada, então o "resultado da etapa anterior" chega ao
   * modelo como "N/A" — o encadeamento só funciona na retentativa de uma etapa
   * isolada, que roda num render novo. Consertar isso muda o TEXTO enviado ao
   * modelo, e o comando desta mudança é de composição visual ("não altere o
   * prompt nem a lógica de streaming"). Fica registrado, não alterado.
   */
  const montarPrompt = (i: number, empresa: DadosEmpresa) => {
    const step = WORKFLOW_STEPS[i];
    return `Você é o assistente de workflow autônomo da PRAEFECTUS. Execute a etapa "${step.label}" para a empresa:

**Empresa**: ${empresa.nome_fantasia || empresa.razao_social}
**CNPJ**: ${empresa.cnpj}
**CNAE Principal**: ${empresa.cnae_principal || 'Não informado'}
**UF**: ${empresa.uf || 'N/I'}
**Município**: ${empresa.municipio || 'N/I'}

**Etapa**: ${step.label}
**Descrição**: ${step.desc}

${i > 0 ? `**Resultado da etapa anterior (${WORKFLOW_STEPS[i - 1].label})**: ${stepResults[WORKFLOW_STEPS[i - 1].key]?.substring(0, 500) || 'N/A'}` : ''}

Forneça:
1. Ações executadas nesta etapa
2. Resultados encontrados (dados concretos)
3. Recomendações para o usuário
4. Próximos passos sugeridos

Seja objetivo e formate em Markdown limpo com seções numeradas. NÃO utilize emojis, emoticons ou caracteres decorativos.`;
  };

  /**
   * Uma etapa, do zero ao fim. Devolve a mensagem do erro, ou `null`.
   *
   * É a unidade da recuperação: a fila das oito chama isto oito vezes, e o
   * "Tentar novamente esta etapa" chama isto uma vez só — sem repetir as
   * outras sete nem gastar oito chamadas de IA por causa de um 429.
   */
  const executarEtapa = async (i: number, empresa: DadosEmpresa): Promise<string | null> => {
    const step = WORKFLOW_STEPS[i];

    // Limpa o rastro anterior DESTA etapa. Sem isso, retentar deixaria a falha
    // velha marcada mesmo depois de a etapa dar certo, e o texto novo apareceria
    // emendado no antigo.
    setFalhas((prev) => {
      if (!(step.key in prev)) return prev;
      const copia = { ...prev };
      delete copia[step.key];
      return copia;
    });
    setCompleted((prev) => {
      if (!prev.has(step.key)) return prev;
      const copia = new Set(prev);
      copia.delete(step.key);
      return copia;
    });
    setStepResults((prev) => ({ ...prev, [step.key]: '' }));

    let content = '';
    // Objeto, e não `let` solto, porque quem escreve é um callback: assim o
    // valor lido depois do `await` é o que o callback gravou.
    const falha: { mensagem: string | null } = { mensagem: null };

    await streamAIChat({
      messages: [{ role: 'user', content: montarPrompt(i, empresa) }],
      action: 'workflow_ia_step',
      onDelta: (chunk) => {
        content += chunk;
        setStepResults((prev) => ({ ...prev, [step.key]: content }));
      },
      onDone: () => {
        // `ai-stream.ts` chama onError E DEPOIS onDone — sempre os dois. Era
        // exatamente aqui que a etapa quebrada virava "Concluído": o onDone
        // marcava concluída sem saber que o onError já tinha disparado. A
        // guarda abaixo é o que separa análise pronta de falha.
        if (falha.mensagem) return;
        setCompleted((prev) => new Set(prev).add(step.key));
      },
      onError: (mensagem) => {
        // A mensagem real do servidor (401, 402, 403, 429, 500, 502, 503, 504)
        // é a única coisa que diz o que fazer a seguir — recarregar a página,
        // olhar o plano, esperar alguns segundos. A tela antiga jogava essa
        // string fora e gravava "Erro ao executar esta etapa." no lugar.
        falha.mensagem = mensagem;
        setFalhas((prev) => ({ ...prev, [step.key]: mensagem }));
      },
    });

    return falha.mensagem;
  };

  /** As oito etapas, em sequência, na ordem de `WORKFLOW_STEPS`. */
  const runWorkflow = async () => {
    if (!user || !empresaId) {
      toast.error('Selecione uma empresa para gerar a análise.');
      return;
    }

    const membro = empresas.find((e) => e.empresa_id === empresaId);
    if (!membro) {
      // Antes isto era um `return` mudo: clicar no botão não produzia nada —
      // nem aviso, nem mudança na tela — e parecia que o botão estava quebrado.
      // Acontece de verdade quando a empresa sai da lista (troca de conta,
      // perda de acesso) e o id antigo continua no `select`. Limpar a seleção
      // deixa a causa visível: o botão desabilita e o campo pede uma escolha.
      toast.error('A empresa escolhida não está mais na sua lista. Selecione outra para continuar.');
      setEmpresaId('');
      return;
    }
    const empresa = membro.empresa;

    setRunning(true);
    setCompleted(new Set());
    setStepResults({});
    setFalhas({});
    setEtapaAberta(WORKFLOW_STEPS[0].key);

    const quebradas: string[] = [];
    try {
      for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
        setCurrentStep(i);
        // A coluna do meio acompanha a etapa que está sendo analisada.
        setEtapaAberta(WORKFLOW_STEPS[i].key);
        const erro = await executarEtapa(i, empresa);
        if (erro) quebradas.push(WORKFLOW_STEPS[i].key);
      }
    } finally {
      // `finally` porque qualquer exceção fora do `streamAIChat` deixaria
      // `running` preso em `true`: botão desabilitado para sempre e a tela
      // travada até o F5.
      setRunning(false);
      setCurrentStep(-1);
    }

    if (quebradas.length > 0) {
      // Abre a primeira falha: pendência escondida atrás de uma aba fechada é
      // pendência que ninguém vê.
      setEtapaAberta(quebradas[0]);
      toast.error(
        `${quebradas.length} de ${WORKFLOW_STEPS.length} etapas falharam. Abra cada uma para ler o erro e tentar de novo.`,
      );
    } else {
      toast.success('Análise das oito etapas concluída. São sugestões — a aprovação é em Compromissos.');
    }
  };

  /** Recuperação: refaz UMA etapa, sem mexer nas outras. */
  const retentarEtapa = async (key: string) => {
    const i = WORKFLOW_STEPS.findIndex((e) => e.key === key);
    const membro = empresas.find((e) => e.empresa_id === empresaId);
    if (i < 0 || !user || !membro) {
      toast.error('Selecione uma empresa para refazer esta etapa.');
      return;
    }

    setEtapaAberta(key);
    setRetentando(key);
    try {
      const erro = await executarEtapa(i, membro.empresa);
      if (erro) toast.error(`"${WORKFLOW_STEPS[i].label}" falhou de novo: ${erro}`);
      else toast.success(`Análise de "${WORKFLOW_STEPS[i].label}" refeita.`);
    } finally {
      setRetentando(null);
    }
  };

  /** Recuperação em lote, na ordem das etapas. */
  const retentarFalhas = async () => {
    const pendentes = WORKFLOW_STEPS.filter((e) => falhas[e.key]).map((e) => e.key);
    for (const key of pendentes) {
      await retentarEtapa(key);
    }
  };

  const situacaoDaEtapa = (key: string): SituacaoEtapa => {
    if (falhas[key]) return 'falhou';
    if (completed.has(key)) return 'analisada';
    if (retentando === key) return 'analisando';
    if (running && WORKFLOW_STEPS[currentStep]?.key === key) return 'analisando';
    return 'pendente';
  };

  const etapaSelecionada =
    WORKFLOW_STEPS.find((e) => e.key === etapaAberta) ?? WORKFLOW_STEPS[0];

  return (
    <AppLayout>
      <CabecalhoPagina
        // `denso` põe o cabeçalho na escala de sistema (`g-titulo-pagina`,
        // 26/34) que o padrão de 13/09 fixa para as telas de Gestão — três
        // colunas na mesma dobra não cabem na escala de leitura de 28/36.
        denso
        // O registro em `paginas.ts` descreve o módulo como "a esteira que leva
        // o edital da leitura à proposta pronta". Descrever assim a TELA seria
        // prometer execução; aqui ela é sobrescrita pelo que a tela realmente faz.
        descricao="A IA analisa as oito etapas da esteira e sugere o que fazer em cada uma. Nada é executado por esta tela."
        acoes={
          <Button onClick={runWorkflow} disabled={ocupado || !empresaId} className="g-controle">
            {running ? (
              <><Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> Analisando...</>
            ) : (
              <><Sparkles aria-hidden="true" className="w-4 h-4" /> Gerar análise das 8 etapas</>
            )}
          </Button>
        }
        filtros={
          <div className="flex flex-col gap-1">
            <label htmlFor="workflow-empresa" className="text-sm font-medium text-foreground">Empresa</label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger id="workflow-empresa" className="w-full sm:w-64">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(e => (
                  <SelectItem key={e.empresa_id} value={e.empresa_id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" aria-hidden="true" />
                      {e.empresa.nome_fantasia || e.empresa.razao_social}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {/* A frase que a tela antiga não dizia, no lugar mais alto possível. */}
        <Alert variant="info">
          <Info className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Esta tela sugere; quem executa é você</AlertTitle>
          <AlertDescription>
            <p>
              As oito etapas abaixo são análises geradas pela IA sobre a empresa selecionada.
              Nenhuma delas busca edital, cria compromisso, agenda prazo, dispara alerta, monta
              proposta ou configura lance — nada é gravado no sistema. A aprovação e a execução
              acontecem em Meus compromissos.
            </p>
          </AlertDescription>
        </Alert>

        {/* Alerta de conclusão: só quando as oito etapas têm análise pronta. */}
        {!running && completed.size === WORKFLOW_STEPS.length && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <AlertTitle className="text-lg font-semibold">Análise das oito etapas concluída</AlertTitle>
            <AlertDescription>
              <p>
                As oito etapas produziram <strong>sugestões</strong>. Nada foi executado nem gravado:
                leve as decisões para <strong>Meus compromissos</strong>, onde elas são aprovadas ou
                rejeitadas.
              </p>
              {/* `navigate` no lugar de `window.location.href`: recarregar o app
                  inteiro derruba o estado da sessão e joga fora a análise que
                  acabou de ser gerada — ela só existe em memória. */}
              <Button className="mt-4 g-controle" onClick={() => navigate('/meus-compromissos')}>
                <ArrowRight className="w-4 h-4" aria-hidden="true" /> Ver meus compromissos
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/*
          Três colunas a partir de 1280px: etapas · conteúdo · resumo.
          Entre 1024 e 1279 o resumo desce inteiro para baixo das duas outras
          (`lg:col-span-2`) em vez de espremer as três — a coluna do meio
          carrega texto corrido de IA e não sobrevive a 300px. Abaixo de 1024
          tudo empilha na ordem de leitura: escolher a etapa, ler a etapa,
          conferir o placar.
        */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(300px,340px)]">
          <div className="min-w-0 xl:sticky xl:top-[calc(var(--g-topo)+1rem)]">
            <ListaEtapas
              situacaoDaEtapa={situacaoDaEtapa}
              selecionada={etapaSelecionada.key}
              aoSelecionar={setEtapaAberta}
            />
          </div>

          <div className="min-w-0">
            <PainelEtapa
              etapa={etapaSelecionada}
              situacao={situacaoDaEtapa(etapaSelecionada.key)}
              resultado={stepResults[etapaSelecionada.key] ?? ''}
              erro={falhas[etapaSelecionada.key]}
              ocupado={ocupado}
              aoRetentar={() => retentarEtapa(etapaSelecionada.key)}
              podeIniciar={Boolean(empresaId)}
            />
          </div>

          <div className="min-w-0 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-[calc(var(--g-topo)+1rem)]">
            <ResumoExecucao
              prontas={completed.size}
              falhas={quantidadeFalhas}
              empresaNome={empresaNome}
              ocupado={ocupado}
              aoRetentarFalhas={retentarFalhas}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
