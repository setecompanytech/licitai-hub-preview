import type { ElementType } from 'react';
import {
  Bell,
  Brain,
  CalendarDays,
  Crosshair,
  DollarSign,
  FileText,
  Search,
  Shield,
} from 'lucide-react';
import type { TomSituacao } from '@/components/gestao/SeloSituacao';

/**
 * O vocabulário do Workflow IA, num módulo só — a página, a lista de etapas, o
 * painel do meio e o resumo da direita leem todos daqui.
 *
 * Por que fora do `.tsx` da página: a composição de três colunas do comando de
 * 13/09 quebra a tela em três componentes, e os três precisam da MESMA lista e
 * do MESMO mapa de situação. Duplicar a lista em dois arquivos é o começo de
 * duas listas divergentes — foi assim que o vocabulário de status de licitação
 * virou três cópias que discordavam entre si.
 */
export type EtapaWorkflow = {
  key: string;
  label: string;
  icon: ElementType;
  desc: string;
};

/**
 * As oito etapas, nesta ordem, com estes rótulos e estas descrições.
 *
 * IMPORTANTE: cada `key` também é a chave dos resultados e das falhas em
 * memória. Renomear uma quebra o vínculo silenciosamente — a etapa passa a
 * aparecer sempre "não analisada" mesmo depois de rodar.
 */
export const WORKFLOW_STEPS: EtapaWorkflow[] = [
  { key: 'pesquisa', label: 'Pesquisa de Editais', icon: Search, desc: 'Busca automática em portais por CNAEs e palavras-chave' },
  { key: 'selecao', label: 'Seleção & Score', icon: Brain, desc: 'IA analisa viabilidade e compatibilidade com a empresa' },
  { key: 'agendamento', label: 'Agendamento', icon: CalendarDays, desc: 'Adiciona prazos ao calendário com alertas 7/3/1 dias' },
  { key: 'alertas', label: 'Alertas Multicanal', icon: Bell, desc: 'Notificações via sistema, e-mail e WhatsApp' },
  { key: 'precificacao', label: 'Validação de Preços', icon: DollarSign, desc: 'Pesquisa mercadológica e análise de margem' },
  { key: 'documentacao', label: 'Documentação', icon: FileText, desc: 'Verificação de certidões e habilitação' },
  { key: 'proposta', label: 'Proposta Comercial', icon: Shield, desc: 'Montagem automática da proposta de preços' },
  { key: 'lances', label: 'Robô de Lances', icon: Crosshair, desc: 'Configuração e execução de lances automáticos' },
];

/**
 * Situação de UMA etapa.
 *
 * Os nomes são deliberadamente de análise, não de execução: esta tela não
 * grava nada em lugar nenhum. Cada etapa é uma chamada de texto ao modelo
 * (`action: 'workflow_ia_step'` → edge function `ai-chat`), cujo único efeito
 * colateral no banco é o cache de resposta da própria IA. Não existe edge
 * function `workflow-ia`, não há INSERT nem UPDATE em processo, compromisso,
 * alerta, proposta ou lance, e o resultado vive só em memória — recarregar a
 * página apaga tudo.
 *
 * Por isso NÃO existe o estado "executado". Chamar de execução o que é
 * sugestão faria a pessoa acreditar que o prazo já está no calendário e que o
 * lance já está configurado. A aprovação e a execução de verdade acontecem em
 * Compromissos.
 */
export type SituacaoEtapa = 'pendente' | 'analisando' | 'analisada' | 'falhou';

export const ROTULO_SITUACAO: Record<SituacaoEtapa, string> = {
  pendente: 'Não analisada',
  analisando: 'Analisando',
  analisada: 'Análise pronta',
  falhou: 'Falhou',
};

export const TOM_SITUACAO: Record<SituacaoEtapa, TomSituacao> = {
  pendente: 'indisponivel',
  analisando: 'atencao',
  analisada: 'sucesso',
  falhou: 'critico',
};

/**
 * Tipografia do Markdown devolvido pela IA, em tokens. Cobre TODOS os blocos
 * que o modelo pode emitir: sem a regra de `h1` um "# Título" herdaria o h1
 * global (28px, index.css) e competiria com o título da página; sem a regra de
 * `a` o preflight do Tailwind zera cor e sublinhado e o link some no corpo.
 */
export const MARKDOWN_ETAPA =
  'text-sm leading-6 text-foreground ' +
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground ' +
  '[&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs ' +
  '[&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold ' +
  '[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold ' +
  '[&_h3]:mt-3 [&_h3]:font-semibold ' +
  '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_p]:mb-2 ' +
  '[&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background [&_pre]:p-3 ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_strong]:text-foreground ' +
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5';
