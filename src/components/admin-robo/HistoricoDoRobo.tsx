import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import SeloSituacao, { AvisoDeContexto, AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import {
  HORAS_DO_AVISO_NO_SININHO, LINHAS_POR_PAGINA, MESES_DO_HISTORICO, PERIODOS_DO_HISTORICO, filtroDaBusca, inicioDoPeriodo,
  quandoEmBrasilia, seloDaLinha, tituloDaLinha, type LinhaDoHistorico, type OrigemDoHistorico, type PeriodoDoHistorico,
} from '@/lib/robo/historico-do-robo';
import MigracaoPendente from './MigracaoPendente';
import { mensagemDoErro, useLeituraDaPlataforma, type RespostaDoBanco } from './leitura';

const MIGRATION_DO_HISTORICO = 'supabase/migrations/20260917000004_historico_do_robo.sql';
const TODAS = '__todas__';

type Leitura = { linhas: LinhaDoHistorico[]; total: number | null; nomes: Record<string, string>; falhaNosNomes: string | null };

// `types.ts` não conhece `robo_historico` (tabela de 17/09/2026).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const historico = (): any => (supabase as any).from('robo_historico');

/**
 * "Histórico do robô" — o que o robô fez e avisou, em todas as empresas
 * (17/09/2026, pedido do Ian).
 *
 * O sininho guarda o aviso do robô por 24 horas e apaga; aqui ele continua,
 * junto com a linha do tempo das sessões, por 12 meses — para alguém verificar
 * depois. Lê `robo_historico`, que só o admin da plataforma enxerga: há avisos
 * que só a equipe recebe (o pedido de captcha traz a tela remota, compartilhada
 * entre as empresas). Regras de leitura em `lib/robo/historico-do-robo.ts`.
 */
export default function HistoricoDoRobo() {
  const [periodo, setPeriodo] = useState<PeriodoDoHistorico>('7d');
  const [empresa, setEmpresa] = useState(TODAS);
  const [origem, setOrigem] = useState<OrigemDoHistorico | typeof TODAS>(TODAS);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(LINHAS_POR_PAGINA);
  // Nomes já vistos, para o filtro de empresa não sumir ao filtrar por uma.
  const [nomesConhecidos, setNomesConhecidos] = useState<Record<string, string>>({});

  const ler = useCallback(async (): Promise<RespostaDoBanco> => {
    let q = historico()
      .select('*', { count: 'exact' })
      .gte('ocorreu_em', inicioDoPeriodo(periodo, new Date()))
      .order('ocorreu_em', { ascending: false })
      .range(0, limite - 1);
    if (empresa !== TODAS) q = q.eq('empresa_id', empresa);
    if (origem !== TODAS) q = q.eq('origem', origem);
    const filtro = filtroDaBusca(busca);
    if (filtro) q = q.or(filtro);

    const { data, error, count } = await q;
    if (error) return { data: null, error };

    const linhas = (data ?? []) as LinhaDoHistorico[];
    const ids = [...new Set(linhas.map((l) => l.empresa_id).filter((id): id is string => !!id))];
    const nomes: Record<string, string> = {};
    let falhaNosNomes: string | null = null;
    if (ids.length) {
      // Por função, e não SELECT em `empresas` (CPF e dados do representante):
      // a mesma leitura da aba Diagnóstico.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('nomes_de_empresas_para_plataforma', { p_ids: ids });
      if (r.error) falhaNosNomes = mensagemDoErro(r.error);
      for (const e of (r.data ?? []) as Array<{ id: string; razao_social: string | null; nome_fantasia: string | null }>) {
        nomes[e.id] = e.nome_fantasia?.trim() || e.razao_social?.trim() || e.id;
      }
      setNomesConhecidos((antes) => ({ ...antes, ...nomes }));
    }
    const leitura: Leitura = { linhas, total: typeof count === 'number' ? count : null, nomes, falhaNosNomes };
    return { data: leitura, error: null };
  }, [periodo, empresa, origem, busca, limite]);

  const leitura = useLeituraDaPlataforma<Leitura>(ler);
  const linhas = leitura.dados?.linhas ?? [];
  const nomes = { ...nomesConhecidos, ...(leitura.dados?.nomes ?? {}) };

  const aplicarBusca = () => {
    setLimite(LINHAS_POR_PAGINA);
    setBusca(buscaDigitada);
  };

  const colunas: ColunaGestao<LinhaDoHistorico>[] = [
    {
      chave: 'quando',
      titulo: 'Data e hora',
      tituloCurto: 'Quando',
      largura: 'w-40',
      render: (l) => <span className="whitespace-nowrap tabular-nums">{quandoEmBrasilia(l.ocorreu_em)}</span>,
    },
    {
      chave: 'empresa',
      titulo: 'Empresa',
      prioridade: 'desktop',
      render: (l) => (l.empresa_id ? nomes[l.empresa_id] ?? l.empresa_id : <span className="text-muted-foreground">Plataforma</span>),
    },
    {
      chave: 'disputa',
      titulo: 'Disputa',
      render: (l) => {
        const texto = [l.edital, l.portal].filter(Boolean).join(' · ') || '—';
        return l.disputa_id ? (
          <Link to={`/robo-lances/disputa/${l.disputa_id}`} className="text-primary underline-offset-2 hover:underline">
            {texto}
          </Link>
        ) : (
          <span>{texto}</span>
        );
      },
    },
    {
      chave: 'o-que',
      titulo: 'O que aconteceu',
      render: (l) => {
        const selo = seloDaLinha(l);
        return (
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <SeloSituacao tom={selo.tom}>{selo.rotulo}</SeloSituacao>
              <span className="font-medium text-foreground">{tituloDaLinha(l)}</span>
              {l.destinatarios > 1 && (
                <span className="g-meta text-muted-foreground">para {l.destinatarios} pessoas</span>
              )}
            </span>
            {l.mensagem && <TextoExpansivel texto={l.mensagem} linhas={2} modo="texto" className="g-corpo text-muted-foreground" />}
          </span>
        );
      },
    },
  ];

  return (
    <SecaoGestao
      titulo="Histórico do robô"
      contagem={leitura.estado === 'pronta' ? leitura.dados?.total ?? linhas.length : undefined}
      acoes={
        <Button variant="outline" size="sm" onClick={leitura.recarregar} disabled={leitura.estado === 'carregando'}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
        </Button>
      }
    >
      <p className="g-corpo text-muted-foreground">
        O que o robô fez e avisou, em todas as empresas: os avisos do sininho e a linha do tempo das sessões (entrou,
        lances, recusas, saída). O sininho guarda o aviso do robô por {HORAS_DO_AVISO_NO_SININHO} horas; aqui ele fica{' '}
        {MESES_DO_HISTORICO} meses. Só a equipe Praefectus vê esta lista.
      </p>

      {leitura.estado === 'migracao_pendente' ? (
        <MigracaoPendente assunto="O histórico do robô (robo_historico)" detalhe={leitura.erro} arquivo={MIGRATION_DO_HISTORICO} />
      ) : leitura.estado === 'erro' ? (
        <AvisoDeFalha aoTentarNovamente={leitura.recarregar}>Não foi possível carregar o histórico: {leitura.erro}</AvisoDeFalha>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="historico-periodo">Período</Label>
              <Select value={periodo} onValueChange={(v) => { setPeriodo(v as PeriodoDoHistorico); setLimite(LINHAS_POR_PAGINA); }}>
                <SelectTrigger id="historico-periodo" className="w-48 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODOS_DO_HISTORICO.map((p) => (
                    <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="historico-empresa">Empresa</Label>
              <Select value={empresa} onValueChange={(v) => { setEmpresa(v); setLimite(LINHAS_POR_PAGINA); }}>
                <SelectTrigger id="historico-empresa" className="w-64 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as empresas</SelectItem>
                  {Object.entries(nomesConhecidos)
                    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
                    .map(([id, nome]) => (
                      <SelectItem key={id} value={id}>{nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="historico-origem">O quê</Label>
              <Select value={origem} onValueChange={(v) => { setOrigem(v as OrigemDoHistorico | typeof TODAS); setLimite(LINHAS_POR_PAGINA); }}>
                <SelectTrigger id="historico-origem" className="w-56 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Avisos e eventos</SelectItem>
                  <SelectItem value="aviso">Só avisos do sininho</SelectItem>
                  <SelectItem value="evento">Só eventos das sessões</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <form
              className="grid gap-1.5"
              onSubmit={(e) => { e.preventDefault(); aplicarBusca(); }}
            >
              <Label htmlFor="historico-busca">Buscar</Label>
              <div className="flex gap-2">
                <Input
                  id="historico-busca"
                  value={buscaDigitada}
                  onChange={(e) => setBuscaDigitada(e.target.value)}
                  placeholder="Edital, título ou mensagem"
                  className="w-64 max-w-full"
                />
                <Button type="submit" variant="outline" className="g-controle" aria-label="Buscar no histórico">
                  <Search className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          </div>

          {leitura.dados?.falhaNosNomes && (
            <AvisoDeContexto titulo="Nomes das empresas indisponíveis">
              A leitura de empresas falhou ({leitura.dados.falhaNosNomes}); as linhas aparecem com o identificador da empresa.
            </AvisoDeContexto>
          )}

          <TabelaGestao
            colunas={colunas}
            itens={linhas}
            chaveDoItem={(l) => l.id}
            carregando={leitura.estado === 'carregando'}
            descricao="Histórico do robô de lances: avisos e eventos das sessões, de todas as empresas"
            vazio={
              <p className="g-corpo px-4 py-8 text-center text-muted-foreground">
                Nada no histórico com estes filtros neste período.
              </p>
            }
            rodape={
              leitura.estado === 'pronta' && linhas.length > 0 ? (
                <span className="flex flex-wrap items-center gap-3">
                  <span>
                    {linhas.length}
                    {leitura.dados?.total !== null && leitura.dados?.total !== undefined ? ` de ${leitura.dados.total}` : ''} registros
                  </span>
                  {leitura.dados?.total !== null && leitura.dados?.total !== undefined && linhas.length < leitura.dados.total && (
                    <Button variant="outline" size="sm" onClick={() => setLimite((n) => n + LINHAS_POR_PAGINA)}>
                      Carregar mais {LINHAS_POR_PAGINA}
                    </Button>
                  )}
                </span>
              ) : undefined
            }
          />
        </>
      )}
    </SecaoGestao>
  );
}
