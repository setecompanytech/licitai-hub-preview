import { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import SeloSituacao, { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { dataHoraDeBrasilia } from '@/components/workspace/precificacao/formato';
import MigracaoPendente from './MigracaoPendente';
import { useLeituraDaPlataforma } from './leitura';

/**
 * Registro de chamadas entre o servidor e o agente do robô (`webhook_log`).
 *
 * É a caixa-preta: o que o agente mandou e o que o servidor respondeu, com o
 * conteúdo bruto. Quando a sessão diz "Falhou" e o erro gravado não explica,
 * a resposta costuma estar aqui — num payload que chegou sem o campo esperado
 * ou numa chamada que nunca chegou.
 *
 * O conteúdo vem recolhido: payload de agente tem centenas de linhas, e
 * duzentas delas abertas fariam a tabela ilegível.
 */

interface Chamada {
  id: string;
  direcao: string | null;
  tipo: string | null;
  created_at: string;
  payload: unknown;
  resposta?: unknown;
  status_code?: number | null;
  erro?: string | null;
}

const LIMITE = 200;
const SEM_CHAMADAS: Chamada[] = [];

/** Função de módulo: identidade estável para o efeito de leitura. */
const lerChamadas = () =>
  supabase.from('webhook_log').select('*').order('created_at', { ascending: false }).limit(LIMITE);

function formatarJson(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  let conteudo = valor;
  if (typeof conteudo === 'string') {
    // `strict: false` não estreita `unknown` pelo typeof: o texto fica nomeado.
    const texto = conteudo as string;
    try {
      conteudo = JSON.parse(texto);
    } catch {
      return texto;
    }
  }
  try {
    return JSON.stringify(conteudo, null, 2);
  } catch {
    return String(conteudo);
  }
}

function ConteudoRecolhivel({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const texto = useMemo(() => formatarJson(valor), [valor]);
  const Icone = aberto ? ChevronDown : ChevronRight;
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={id}
        className="g-meta inline-flex items-center gap-1 rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icone aria-hidden="true" className="h-3.5 w-3.5" />
        {rotulo}
      </button>
      <pre
        id={id}
        hidden={!aberto}
        className="g-meta mt-2 max-h-80 max-w-[40rem] overflow-auto whitespace-pre-wrap break-words rounded-[var(--g-raio)] border border-border bg-muted/40 p-3 font-mono text-foreground"
      >
        {texto}
      </pre>
    </div>
  );
}

export default function RegistroDeChamadas() {
  const leitura = useLeituraDaPlataforma<Chamada[]>(lerChamadas);
  const { recarregar } = leitura;
  const chamadas = leitura.dados ?? SEM_CHAMADAS;

  const colunas: ColunaGestao<Chamada>[] = [
    {
      chave: 'quando',
      titulo: 'Quando (Brasília)',
      tituloCurto: 'Quando',
      prioridade: 'sempre',
      render: (c) => <span className="whitespace-nowrap">{dataHoraDeBrasilia(c.created_at)}</span>,
    },
    {
      chave: 'direcao',
      titulo: 'Direção',
      prioridade: 'sempre',
      render: (c) => <SeloSituacao>{c.direcao || '—'}</SeloSituacao>,
    },
    {
      chave: 'tipo',
      titulo: 'Tipo',
      prioridade: 'sempre',
      render: (c) => <span className="font-mono">{c.tipo || '—'}</span>,
    },
    {
      chave: 'resultado',
      titulo: 'Resultado',
      prioridade: 'desktop',
      render: (c) => {
        const falhou = !!c.erro || (typeof c.status_code === 'number' && c.status_code >= 400);
        const codigo = typeof c.status_code === 'number' ? `HTTP ${c.status_code}` : 'Sem código';
        return (
          <span className="flex max-w-[20rem] flex-col gap-1">
            <SeloSituacao tom={falhou ? 'critico' : typeof c.status_code === 'number' ? 'sucesso' : 'neutro'}>
              {codigo}
            </SeloSituacao>
            {c.erro && <span className="g-meta break-words font-mono text-destructive-ink">{c.erro}</span>}
          </span>
        );
      },
    },
    {
      chave: 'conteudo',
      titulo: 'Conteúdo',
      prioridade: 'sempre',
      render: (c) => (
        <div className="flex flex-col gap-1">
          <ConteudoRecolhivel rotulo="Payload" valor={c.payload} />
          {c.resposta !== null && c.resposta !== undefined && (
            <ConteudoRecolhivel rotulo="Resposta" valor={c.resposta} />
          )}
        </div>
      ),
    },
  ];

  return (
    <SecaoGestao
      titulo="Registro de chamadas"
      contagem={leitura.estado === 'pronta' ? chamadas.length : undefined}
      acoes={
        <Button variant="outline" size="sm" onClick={recarregar} disabled={leitura.estado === 'carregando'}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
        </Button>
      }
    >
      <p className="g-corpo text-muted-foreground">
        As {LIMITE} chamadas mais recentes entre o servidor e o agente, com o conteúdo bruto. A mesma
        ressalva do diagnóstico: sem a migration 20260914000004, o banco devolve só as da sua conta.
      </p>

      {leitura.estado === 'migracao_pendente' ? (
        <MigracaoPendente assunto="O registro de chamadas (webhook_log)" detalhe={leitura.erro} />
      ) : leitura.estado === 'erro' ? (
        <AvisoDeFalha aoTentarNovamente={recarregar}>
          Não foi possível carregar o registro de chamadas: {leitura.erro}
        </AvisoDeFalha>
      ) : (
        <TabelaGestao
          colunas={colunas}
          itens={chamadas}
          chaveDoItem={(c) => c.id}
          carregando={leitura.estado === 'carregando'}
          descricao="Chamadas recentes entre o servidor e o agente do robô de lances"
          vazio={
            <p className="g-corpo px-4 py-8 text-center text-muted-foreground">
              Nenhuma chamada registrada.
            </p>
          }
        />
      )}
    </SecaoGestao>
  );
}
