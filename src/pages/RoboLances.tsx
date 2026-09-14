import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import { Button } from '@/components/ui/button';
import ConfigurarLanceDialog, { type LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import ExportarResultados from '@/components/robo-lances/ExportarResultados';
import AceiteTermosDialog from '@/components/robo-lances/AceiteTermosDialog';
import PedidoDoRobo from '@/components/robo-lances/PedidoDoRobo';
import PainelDeParticipacoes from '@/components/robo-lances/painel/PainelDeParticipacoes';
import CabecalhoDoRobo from '@/components/robo-lances/cliente/CabecalhoDoRobo';
import FaixaDaEmpresa from '@/components/robo-lances/cliente/FaixaDaEmpresa';
import AvisosDosPortais from '@/components/robo-lances/cliente/AvisosDosPortais';
import DialogoModoDeOperacao from '@/components/robo-lances/cliente/DialogoModoDeOperacao';
import { useRoboDaEmpresa, type LinhaDoRoboDaEmpresa } from '@/components/robo-lances/cliente/useRoboDaEmpresa';
import { useSituacaoDoRobo } from '@/components/robo-lances/cliente/useSituacaoDoRobo';
import { useAvisosDosPortais } from '@/components/robo-lances/cliente/useAvisosDosPortais';
import { useModoDeOperacao } from '@/components/robo-lances/cliente/useModoDeOperacao';
import { linhaParaLance } from '@/components/robo-lances/disputa/disputa-do-robo';
import { useSalvarDisputa } from '@/components/robo-lances/disputa/useSalvarDisputa';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Robô de lances — a LISTA das participações da empresa.
 *
 * ─── A LISTA É SÓ LISTA (14/09/2026) ────────────────────────────────────────
 *
 * Abaixo do painel de participações, esta página desenhava um bloco
 * "Ferramentas da disputa" em três colunas: a lista de sessões (repetindo a
 * tabela de cima), a disputa selecionada espremida numa coluna estreita e uma
 * coluna de controle com estado, ações, limites, checklist e eventos. O bloco
 * era o mesmo embaixo de QUALQUER aba, e o dono do produto viu na produção o
 * resultado: "as abas Configuradas e Em disputa repetem as mesmas
 * informações", a tabela de itens quebrando uma letra por linha, a página
 * "pequena, de difícil compreensão".
 *
 * Agora cada linha abre a disputa em página própria
 * (`/robo-lances/disputa/:id`, `pages/RoboLancesDisputa.tsx`), com a largura
 * inteira. O que ficou aqui é o que é da EMPRESA e da lista, na ordem em que
 * ela pergunta: o robô está ligado e disponível? (cabeçalho) · há um pedido do
 * robô esperando alguém? · de qual empresa é este robô, e o acesso aos portais?
 * (faixa — o checklist de acesso mora em "Gerenciar portais") · há aviso da
 * operação? · em que fase está cada participação? (painel).
 *
 * As regras que a lista e a página da disputa dividem — gravar a disputa,
 * trocar o modo de operação — moram em `components/robo-lances/disputa/` e em
 * `cliente/useModoDeOperacao.ts`, uma vez só.
 *
 * As abas Agente, Portais e Configurações saíram antes (14/09/2026): mostravam
 * ao administrador da EMPRESA o que é da operação da PLATAFORMA, hoje no Admin
 * Praefectus › Robô de Lances.
 */
export default function RoboLances() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isAdmin, podeOperar } = usePapelEmpresa();
  const navigate = useNavigate();
  const { search } = useLocation();
  // O limite financeiro é lido na aba Estratégia da disputa; aqui só o nível.
  const modo = useModoDeOperacao({ lerLimite: false });
  const salvarDisputa = useSalvarDisputa();

  // ── O que é da EMPRESA ──
  // Ligado/desligado (`robo_empresa_config`), disponibilidade respondida pelo
  // servidor (`situacao-do-robo`) e avisos da operação (`robo_avisos_portal`).
  const roboDaEmpresa = useRoboDaEmpresa(empresaAtiva?.id);
  const { recarregar: relerSituacaoDoRobo } = useSituacaoDoRobo(empresaAtiva?.id);
  const avisosDosPortais = useAvisosDosPortais();
  // Abrindo pelo prontuário, a lista mostra as disputas DESTA pasta.
  const { processoId } = useProcessoAtivo();

  const [lances, setLances] = useState<LanceConfig[]>([]);
  // Contador de gravações que afetam as participações. O painel tem a própria
  // leitura; quando algo muda aqui, ele relê em vez de esperar 30 s.
  const [versaoDasDisputas, setVersaoDasDisputas] = useState(0);

  // As disputas da lista servem à exportação e aos avisos de portal. Com
  // processo aberto, as dele; sem processo, as da empresa.
  useEffect(() => {
    if (!user || !empresaAtiva?.id) return;
    let q = supabase
      .from('robo_lances_disputas' as never)
      .select('*')
      .eq('empresa_id', empresaAtiva.id);
    if (processoId) q = q.eq('licitacao_id', processoId);
    q.order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) {
        // Lista vazia sem explicação é indistinguível de "não há disputa" — e a
        // pessoa conclui que perdeu o trabalho. O erro tem que aparecer na tela.
        console.error('[robo-lances] carregar disputas', error.message);
        toast.error(`Não foi possível carregar as disputas: ${error.message}`, { duration: 12000 });
        return;
      }
      setLances(((data || []) as unknown as Record<string, unknown>[]).map(linhaParaLance));
    });
  }, [user, empresaAtiva?.id, processoId]);

  /**
   * O robô foi ligado ou desligado. O servidor pode mudar a disponibilidade
   * por isso, e o painel pode ter sessões paradas — os dois releem na hora.
   */
  const aoAlterarLigado = (linha: LinhaDoRoboDaEmpresa) => {
    roboDaEmpresa.aplicar(linha);
    relerSituacaoDoRobo();
    setVersaoDasDisputas((v) => v + 1);
  };

  /** Portais das disputas desta tela — decide quais avisos de portal se aplicam. */
  const portaisDasDisputas = useMemo(() => lances.map((l) => l.portal), [lances]);

  /**
   * "Nova sessão": grava e abre a página da disputa nova. Só abre com a
   * disputa gravada — abrir antes levaria a um "Disputa não encontrada".
   * Salvar não inicia o robô.
   */
  const criarDisputa = async (lance: LanceConfig) => {
    if (!(await salvarDisputa(lance, { nova: true }))) return;
    navigate(`/robo-lances/disputa/${lance.id}`, { state: { daLista: search } });
  };

  return (
    <AppLayout>
      {/* Declara a pasta de origem e devolve o caminho de volta. */}
      <div className="mb-3">
        <ProcessoContextoBanner />
      </div>

      <CabecalhoDoRobo
        empresaId={empresaAtiva?.id}
        estado={roboDaEmpresa.estado}
        podeOperar={podeOperar}
        aoAlterarLigado={aoAlterarLigado}
        aoRelerLigado={roboDaEmpresa.recarregar}
        modo={<DialogoModoDeOperacao nivel={modo.nivel} podeAlterar={modo.podeAlterar} aoAlterar={modo.alterarNivel} />}
        acoes={
          <>
            <ExportarResultados lances={lances} />
            {podeOperar && (
              <ConfigurarLanceDialog
                processoAtivoId={processoId}
                onSave={criarDisputa}
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" aria-hidden="true" /> Nova sessão
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="flex min-w-0 flex-col gap-6">
        {/* Primeiro de tudo quando existe: o robô parado esperando um código que
            o portal mandou à empresa. O código vale segundos. Sem pedido, não
            desenha nada. */}
        <PedidoDoRobo />

        <div className="flex min-w-0 flex-col gap-3">
          <FaixaDaEmpresa
            empresa={empresaAtiva}
            isAdmin={isAdmin}
            avisos={avisosDosPortais.avisos}
            erroDosAvisos={avisosDosPortais.erro}
            aoRecarregarAvisos={() => {
              avisosDosPortais.recarregar();
            }}
          />
          <AvisosDosPortais avisos={avisosDosPortais.avisos} portaisDasDisputas={portaisDasDisputas} />
        </div>

        {/* Ausência de "Nova sessão" sem explicação é indistinguível de defeito. */}
        {!podeOperar && (
          <p className="g-corpo rounded-[var(--g-raio)] border border-dashed border-border px-3 py-2 text-muted-foreground">
            Você acompanha as disputas em modo leitura. Para configurar ou enviar ao robô, peça o papel de operador em
            Equipe → Permissões.
          </p>
        )}

        {/* O corpo da página: cada participação por fase, e o que o robô faz
            nela. A linha abre a disputa em página própria. */}
        <PainelDeParticipacoes
          empresaId={empresaAtiva?.id ?? null}
          licitacaoId={processoId}
          sinalDeRecarga={versaoDasDisputas}
        />
      </div>

      {/* A troca para os níveis 2 e 3, feita no botão do modo, pede o aceite. */}
      <AceiteTermosDialog
        open={modo.aceiteAberto}
        onOpenChange={modo.definirAceiteAberto}
        nivel={modo.nivel}
        sessaoId={undefined}
        licitacaoId={undefined}
        onAceite={modo.aoAceitar}
      />
    </AppLayout>
  );
}
