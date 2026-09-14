import { useMemo, useState, type ElementType } from 'react';
import { Activity, CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import SeloSituacao, { AvisoDeContexto, AvisoDeFalha, type TomSituacao } from '@/components/gestao/SeloSituacao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import { dataHoraDeBrasilia } from '@/components/workspace/precificacao/formato';
import { resumirErroParaCliente } from '@/lib/robo/situacao-da-participacao';
import MigracaoPendente from './MigracaoPendente';
import { mensagemDoErro, useLeituraDaPlataforma, type RespostaDoBanco } from './leitura';

/**
 * Diagnóstico das sessões do robô, de todas as empresas.
 *
 * A tela do cliente passou a mostrar só a tradução do erro
 * (`resumirErroParaCliente`): "O portal não respondeu a tempo." no lugar de
 * "Signal timed out." e do parágrafo do agente sobre a conta usada no portal.
 * A tradução é boa para o cliente e insuficiente para quem conserta — então
 * aqui as duas ficam lado a lado: o erro EXATAMENTE como o robô gravou e a
 * frase que o cliente leu. É também onde se nota tradução errada: erro de
 * certificado lido como "falhou a operação" aparece de cara.
 *
 * ─── Por que o nome da empresa vem numa segunda leitura ─────────────────────
 *
 * `empresa_id` entrou em `sessoes_lance_real` pela 20260914000002. Um embed
 * `empresas(...)` no mesmo select derrubaria a leitura inteira onde aquela
 * migration não rodou — e o diagnóstico sumiria justamente quando mais se
 * precisa dele. Separado, a falha nos nomes vira um aviso e as sessões
 * continuam na tela, com o identificador no lugar do nome.
 */

interface SessaoDiagnostico {
  id: string;
  empresa_id?: string | null;
  user_id?: string | null;
  edital: string | null;
  portal_nome: string | null;
  portal_id?: string | null;
  status: string | null;
  modo: string | null;
  erro: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Diagnostico {
  sessoes: SessaoDiagnostico[];
  /** empresa_id → nome de exibição. */
  nomes: Record<string, string>;
  falhaNosNomes: string | null;
}

const TODAS = '__todas__';
const SEM_EMPRESA = '__sem_empresa__';
const LIMITE = 200;

// `types.ts` é anterior a 14/09: não conhece `empresa_id` em sessoes_lance_real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (nome: string): any => (supabase as any).from(nome);

/** Função de módulo: identidade estável para o efeito de leitura. */
async function lerDiagnostico(): Promise<RespostaDoBanco> {
  const { data, error } = await tabela('sessoes_lance_real')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIMITE);
  if (error) return { data: null, error };

  const sessoes = (data ?? []) as SessaoDiagnostico[];
  const ids = [...new Set(sessoes.map((s) => s.empresa_id).filter((id): id is string => !!id))];
  const nomes: Record<string, string> = {};
  let falhaNosNomes: string | null = null;

  if (ids.length > 0) {
    // Por função, e não SELECT em `empresas`: a tabela guarda CPF, RG e dados do
    // representante legal de cada cliente, e o diagnóstico só precisa do nome.
    // A função (20260914000004) devolve id e nomes, só para a plataforma.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resposta = await (supabase as any).rpc('nomes_de_empresas_para_plataforma', { p_ids: ids });
    if (resposta.error) {
      falhaNosNomes = mensagemDoErro(resposta.error);
    } else {
      for (const e of (resposta.data ?? []) as Array<{ id: string; razao_social: string | null; nome_fantasia: string | null }>) {
        nomes[e.id] = e.nome_fantasia?.trim() || e.razao_social?.trim() || e.id;
      }
    }
  }

  const diagnostico: Diagnostico = { sessoes, nomes, falhaNosNomes };
  return { data: diagnostico, error: null };
}

/** Mesmo vocabulário de `robo-lances/SessoesDoRobo`, para as duas telas não divergirem na palavra. */
const APARENCIA_DO_STATUS: Record<string, { rotulo: string; tom: TomSituacao; icone: ElementType }> = {
  ativo: { rotulo: 'Em operação', tom: 'ativo', icone: Activity },
  enviando: { rotulo: 'Entrando no portal', tom: 'neutro', icone: Loader2 },
  pausado: { rotulo: 'Pausada', tom: 'atencao', icone: Clock },
  encerrado: { rotulo: 'Encerrada', tom: 'neutro', icone: CheckCircle2 },
  erro: { rotulo: 'Falhou', tom: 'critico', icone: XCircle },
};

const SEM_SESSOES: SessaoDiagnostico[] = [];
const SEM_NOMES: Record<string, string> = {};

function temFalha(s: SessaoDiagnostico): boolean {
  return s.status === 'erro' || !!s.erro?.trim();
}

function nomeDaEmpresa(empresaId: string, nomes: Record<string, string>): string {
  return nomes[empresaId] ?? `Empresa ${empresaId.slice(0, 8)}`;
}

export default function DiagnosticoDeSessoes() {
  const leitura = useLeituraDaPlataforma<Diagnostico>(lerDiagnostico);
  const { recarregar } = leitura;
  const [empresa, setEmpresa] = useState(TODAS);
  const [soComErro, setSoComErro] = useState(false);

  const sessoes = leitura.dados?.sessoes ?? SEM_SESSOES;
  const nomes = leitura.dados?.nomes ?? SEM_NOMES;

  const opcoesDeEmpresa = useMemo(() => {
    const vistas = new Map<string, string>();
    let haSemEmpresa = false;
    for (const s of sessoes) {
      if (!s.empresa_id) haSemEmpresa = true;
      else if (!vistas.has(s.empresa_id)) vistas.set(s.empresa_id, nomeDaEmpresa(s.empresa_id, nomes));
    }
    const lista = [...vistas.entries()]
      .map(([valor, rotulo]) => ({ valor, rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    if (haSemEmpresa) lista.push({ valor: SEM_EMPRESA, rotulo: 'Sem empresa (sessão antiga)' });
    return lista;
  }, [sessoes, nomes]);

  const filtradas = useMemo(
    () =>
      sessoes.filter((s) => {
        if (soComErro && !temFalha(s)) return false;
        if (empresa === TODAS) return true;
        if (empresa === SEM_EMPRESA) return !s.empresa_id;
        return s.empresa_id === empresa;
      }),
    [sessoes, empresa, soComErro],
  );

  const colunas: ColunaGestao<SessaoDiagnostico>[] = [
    {
      chave: 'empresa',
      titulo: 'Empresa',
      prioridade: 'sempre',
      render: (s) =>
        s.empresa_id ? (
          <span className="block min-w-[10rem]" title={s.empresa_id}>
            {nomeDaEmpresa(s.empresa_id, nomes)}
          </span>
        ) : (
          <span className="flex min-w-[10rem] flex-col">
            <span className="text-muted-foreground">Sem empresa</span>
            {s.user_id && (
              <span className="g-meta font-mono text-muted-foreground" title={s.user_id}>
                usuário {s.user_id.slice(0, 8)}
              </span>
            )}
          </span>
        ),
    },
    {
      chave: 'edital',
      titulo: 'Edital',
      prioridade: 'sempre',
      render: (s) => <span className="whitespace-nowrap">{s.edital || '—'}</span>,
    },
    {
      chave: 'portal',
      titulo: 'Portal',
      prioridade: 'desktop',
      // Largura mínima: com o erro técnico em 24rem e a frase do cliente em
      // 16rem, a tabela automática espremia o nome do portal a uma letra por linha.
      render: (s) => <span className="block min-w-[8rem]">{s.portal_nome || s.portal_id || '—'}</span>,
    },
    {
      chave: 'status',
      titulo: 'Situação',
      prioridade: 'sempre',
      render: (s) => {
        const ap = APARENCIA_DO_STATUS[s.status ?? ''];
        return ap ? (
          <SeloSituacao tom={ap.tom} icone={ap.icone} explicacao={`status = ${s.status}`}>
            {ap.rotulo}
          </SeloSituacao>
        ) : (
          <SeloSituacao explicacao="Status fora do vocabulário conhecido">{s.status || 'sem status'}</SeloSituacao>
        );
      },
    },
    {
      chave: 'modo',
      titulo: 'Modo',
      prioridade: 'desktop',
      render: (s) => <span className="block min-w-[3.5rem] whitespace-nowrap font-mono">{s.modo || '—'}</span>,
    },
    {
      chave: 'atualizada',
      titulo: 'Atualizada (Brasília)',
      tituloCurto: 'Atualizada',
      prioridade: 'desktop',
      render: (s) => (
        <span className="whitespace-nowrap">{dataHoraDeBrasilia(s.updated_at ?? s.created_at)}</span>
      ),
    },
    {
      chave: 'erro',
      titulo: 'Erro técnico (completo)',
      tituloCurto: 'Erro técnico',
      prioridade: 'sempre',
      largura: '24rem',
      render: (s) =>
        s.erro?.trim() ? (
          <TextoExpansivel
            texto={s.erro}
            linhas={2}
            className="whitespace-pre-wrap break-words font-mono"
            rotuloAbrir="Ver erro completo"
            rotuloFechar="Recolher erro"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      chave: 'cliente',
      titulo: 'O que o cliente vê',
      tituloCurto: 'Cliente vê',
      prioridade: 'sempre',
      largura: '16rem',
      render: (s) => {
        if (!temFalha(s)) return <span className="text-muted-foreground">—</span>;
        const traducao = resumirErroParaCliente(s.erro);
        return (
          <span className="flex flex-col gap-0.5">
            <span>{traducao.texto}</span>
            <span className="g-meta text-muted-foreground">Ação sugerida: {traducao.acao}</span>
          </span>
        );
      },
    },
  ];

  return (
    <SecaoGestao
      titulo="Sessões de todas as empresas"
      contagem={leitura.estado === 'pronta' ? sessoes.length : undefined}
      acoes={
        <Button variant="outline" size="sm" onClick={recarregar} disabled={leitura.estado === 'carregando'}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
        </Button>
      }
    >
      <p className="g-corpo text-muted-foreground">
        As {LIMITE} sessões mais recentes, com o erro exatamente como o robô gravou e, ao lado, a frase
        que o cliente lê no lugar dele. Sem a migration 20260914000004 aplicada, o banco devolve só as
        sessões das empresas de que você é membro — sem erro nenhum, por isso fica dito aqui.
      </p>

      {leitura.estado === 'migracao_pendente' ? (
        <MigracaoPendente assunto="A leitura de diagnóstico (sessoes_lance_real)" detalhe={leitura.erro} />
      ) : leitura.estado === 'erro' ? (
        <AvisoDeFalha aoTentarNovamente={recarregar}>
          Não foi possível carregar as sessões: {leitura.erro}
        </AvisoDeFalha>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="diagnostico-empresa">Empresa</Label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger id="diagnostico-empresa" className="w-72 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as empresas</SelectItem>
                  {opcoesDeEmpresa.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="g-controle flex items-center gap-2">
              <Switch id="diagnostico-so-erro" checked={soComErro} onCheckedChange={setSoComErro} />
              <Label htmlFor="diagnostico-so-erro">Só com erro</Label>
            </div>
          </div>

          {leitura.dados?.falhaNosNomes && (
            <AvisoDeContexto titulo="Nomes das empresas indisponíveis">
              A leitura de empresas falhou ({leitura.dados.falhaNosNomes}); as sessões aparecem com o
              identificador da empresa.
            </AvisoDeContexto>
          )}

          <TabelaGestao
            colunas={colunas}
            itens={filtradas}
            chaveDoItem={(s) => s.id}
            carregando={leitura.estado === 'carregando'}
            descricao="Sessões recentes do robô de lances, de todas as empresas, com o erro técnico e a tradução para o cliente"
            vazio={
              <p className="g-corpo px-4 py-8 text-center text-muted-foreground">
                {sessoes.length === 0
                  ? 'Nenhuma sessão registrada.'
                  : 'Nenhuma sessão com estes filtros.'}
              </p>
            }
            rodape={
              leitura.estado === 'pronta' && sessoes.length > 0 ? (
                <span>
                  {filtradas.length} de {sessoes.length} sessões carregadas (as {LIMITE} mais recentes)
                </span>
              ) : undefined
            }
          />
        </>
      )}
    </SecaoGestao>
  );
}
