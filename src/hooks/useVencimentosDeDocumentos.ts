import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { situacaoDaValidade, type SituacaoValidade } from '@/lib/documentos/situacao';

/**
 * Os vencimentos reais de documento e certificado, numa consulta só.
 *
 * A leitura das três fontes morava dentro de `CalendarioLicitacoes`. O painel
 * precisa dos MESMOS vencimentos em dois lugares (a faixa de pendências do topo
 * e a agenda), e copiar a consulta para lá criaria duas contagens de "documento
 * vencido" que divergiriam no primeiro ajuste — o defeito que o registro de
 * navegação e o vocabulário de status já pagaram caro.
 *
 * A `queryKey` é a mesma de antes ('calendario-docs-validade'), então painel e
 * calendário compartilham o cache do react-query: a tela que abrir depois não
 * refaz as três consultas.
 *
 * ESCOPO: as três fontes são pessoais (`user_id` / `created_by`), como já
 * eram. Não virou escopo de empresa aqui porque isso mudaria O QUE a agenda
 * mostra, e não é a reforma desta leva.
 */

export interface DocValidade {
  id: string;
  nome: string;
  /** Como veio do banco — `date` ou `timestamptz`. Sempre formatar com `diaDaValidade`. */
  validade: string;
  tipo: string;
  origem: 'documento' | 'certificado_empresa' | 'certificado_portal';
  situacao: SituacaoValidade;
}

/* Todo vencimento tem que alcançar o registro que o gerou — é a diferença
   entre avisar e ajudar. Quem decide o destino é a FONTE da data. */
export const ROTA_DA_ORIGEM: Record<DocValidade['origem'], string> = {
  documento: '/documentos',
  certificado_empresa: '/empresas',
  certificado_portal: '/robo-lances',
};

export const ROTULO_DA_ORIGEM: Record<DocValidade['origem'], string> = {
  documento: 'Abrir em Documentos',
  certificado_empresa: 'Abrir em Empresas',
  certificado_portal: 'Abrir em Robô de lances',
};

export const CHAVE_VENCIMENTOS = 'calendario-docs-validade';

/**
 * Acrescenta um vencimento à lista, classificado.
 *
 * Validade que não vira data conhecida NÃO entra: "não sei quando vence" não
 * pode ser exibido como regular nem como vencido. Na prática as três colunas
 * são `date`/`timestamptz` e isso não acontece — a guarda existe para o dia em
 * que alguém trocar o tipo da coluna, e para esse dia não virar alerta falso.
 */
function acrescentar(lista: DocValidade[], doc: Omit<DocValidade, 'situacao'>): void {
  const situacao = situacaoDaValidade(doc.validade);
  if (!situacao) return;
  lista.push({ ...doc, situacao });
}

export function useVencimentosDeDocumentos() {
  const { user } = useAuth();

  const consulta = useQuery({
    queryKey: [CHAVE_VENCIMENTOS, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const docs: DocValidade[] = [];
      // As três fontes são independentes, então as falhas são acumuladas e
      // nomeadas: "não consegui ler X" é acionável, "deu erro" não é.
      const falhas: string[] = [];

      const { data: documentos, error: erroDocumentos } = await supabase
        .from('documentos')
        .select('id, nome, tipo, validade')
        .eq('user_id', user.id)
        .not('validade', 'is', null);
      if (erroDocumentos) falhas.push('documentos de habilitação');
      (documentos || []).forEach((d) => {
        if (d.validade) {
          acrescentar(docs, {
            id: d.id, nome: d.nome, validade: d.validade, tipo: d.tipo, origem: 'documento',
          });
        }
      });

      const { data: empresas, error: erroEmpresas } = await supabase
        .from('empresas')
        .select('id, razao_social, certificado_validade')
        .eq('created_by', user.id)
        .not('certificado_validade', 'is', null);
      if (erroEmpresas) falhas.push('certificados das empresas');
      (empresas || []).forEach((e) => {
        if (e.certificado_validade) {
          acrescentar(docs, {
            id: `cert-emp-${e.id}`,
            nome: `Certificado Digital — ${e.razao_social}`,
            validade: e.certificado_validade,
            tipo: 'certificado',
            origem: 'certificado_empresa',
          });
        }
      });

      const { data: creds, error: erroCreds } = await supabase
        .from('credenciais_portais_safe')
        .select('id, portal_nome, validade_certificado')
        .eq('user_id', user.id)
        .not('validade_certificado', 'is', null);
      if (erroCreds) falhas.push('certificados dos portais');
      (creds || []).forEach((c) => {
        if (c.validade_certificado) {
          acrescentar(docs, {
            id: `cert-portal-${c.id}`,
            nome: `Certificado ${c.portal_nome}`,
            validade: c.validade_certificado,
            tipo: 'certificado_portal',
            origem: 'certificado_portal',
          });
        }
      });

      // Lista parcial de vencimentos é pior do que lista nenhuma: quem olha e
      // não vê a certidão conclui que ela está em dia. Falhou uma fonte, a
      // leitura inteira vira erro com retentativa (princípio 3 do CLAUDE.md).
      if (falhas.length > 0) {
        throw new Error(`Não foi possível ler ${falhas.join(', ')}.`);
      }

      return docs;
    },
    enabled: !!user,
  });

  return {
    documentos: (consulta.data ?? []) as DocValidade[],
    carregando: consulta.isLoading,
    erro: (consulta.error as Error | null) ?? null,
    recarregar: () => void consulta.refetch(),
  };
}
