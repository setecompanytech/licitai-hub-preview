import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { AvisoDeContexto, AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { BellRing, Building2, Clock, Loader2, Mail, Plus, Trash2, Users } from 'lucide-react';
import {
  ANTECEDENCIA_MAXIMA, ANTECEDENCIA_MINIMA, ANTECEDENCIA_PADRAO, HORA_UTC_DO_DISPARO,
  antecedenciaValida, horarioLocalDoDisparo, marcosPorExtenso,
} from '@/lib/documentos/alertas';

/* ═══════════════════════════════════════════════════════════════════════════
   Alertas de vencimento por E-MAIL — o braço externo do lembrete in-app.

   O sistema já sabia avisar quem está logado; a assessoria contábil não loga.
   Aqui cadastram-se os e-mails e liga-se o digest diário.

   A tela foi reorganizada em DOIS BLOCOS (Configuração · Destinatários) e três
   afirmações erradas saíram dela:

   1. "Disparo diário (7h)" — o cron é `'0 10 * * *'`, ou seja 10:00 **UTC**.
      Em Belém (UTC−3) isso é 07:00 e a frase estava certa por acidente: o app
      é multiempresa, e quem estiver em UTC−4 recebe às 06:00. O horário agora
      é declarado na âncora real (UTC) e traduzido para o fuso de quem lê.

   2. "um e-mail de antecedência" — a edge dispara nos MARCOS
      (antecedência, 15, 7, 3, 2, 1, 0 dias) e TODO DIA enquanto houver
      documento vencido. Quem esperava um aviso só recebia sete e achava que
      era defeito.

   3. WhatsApp — a coluna `destinatarios.whatsapp` existe, mas NADA a lê, e a
      função `whatsapp-envio` é literalmente simulada (`console.log`,
      `status:'simulado'`). Prometer o canal na tela é anunciar entrega que
      não acontece: a menção foi REMOVIDA.

   BUG corrigido: a antecedência só era gravada no `onBlur` **se o alerta já
   estivesse ativo** (`ativo && salvarConfig(true)`). Mudar de 30 para 60 com o
   alerta desligado não persistia nada, e ao ligar depois voltava 30. Agora há
   um botão "Salvar configuração" explícito, que grava os dois campos
   independentemente do estado do interruptor.

   BUG corrigido: sem empresa ativa, `carregar()` retornava ANTES de
   `setCarregando(false)` e a tela ficava presa no spinner para sempre.
   ═══════════════════════════════════════════════════════════════════════════ */

type Destinatario = {
  id: string;
  nome: string;
  email: string;
  tipo: 'assessoria_contabil' | 'interno' | 'outro';
  ativo: boolean;
};
type LinhaDeDisparo = {
  destinatario_email: string;
  docs_no_digest: number;
  vencidos: number;
  enviado_em: string;
};

const TIPO_LABEL: Record<Destinatario['tipo'], string> = {
  assessoria_contabil: 'Assessoria contábil',
  interno: 'Setor interno',
  outro: 'Outro',
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * As três tabelas de alertas ainda não estão no `types.ts` gerado do Supabase
 * (migration 20260910000001, aplicada à mão no SQL Editor). O cast fica em UM
 * lugar, com o motivo escrito, em vez de espalhar `as any` por dez chamadas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (nome: string): any => (supabase.from as any)(nome);

export default function AlertasVencimentoEmail() {
  const { empresaAtiva } = useEmpresa();

  // Estado EDITÁVEL da configuração. `salvo` guarda o que está no banco, para
  // a tela saber dizer que há alteração pendente — sem isso, o botão "Salvar"
  // fica sempre igual e ninguém percebe que esqueceu de clicar.
  const [ativo, setAtivo] = useState(false);
  const [antecedencia, setAntecedencia] = useState(String(ANTECEDENCIA_PADRAO));
  const [salvo, setSalvo] = useState({ ativo: false, antecedencia: String(ANTECEDENCIA_PADRAO) });

  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [trilha, setTrilha] = useState<LinhaDeDisparo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({
    nome: '',
    email: '',
    tipo: 'assessoria_contabil' as Destinatario['tipo'],
  });

  const carregar = useCallback(async () => {
    // ⚠️ O `return` daqui vinha ANTES do `setCarregando(false)`: sem empresa
    // ativa, a tela girava para sempre. Agora encerra a carga e o corpo mostra
    // o estado "escolha uma empresa".
    if (!empresaAtiva?.id) {
      setCarregando(false);
      setErro(null);
      return;
    }
    setCarregando(true);
    setErro(null);

    const [cfgRes, destRes, logRes] = await Promise.all([
      tabela('documentos_alertas_config')
        .select('ativo, antecedencia_dias')
        .eq('empresa_id', empresaAtiva.id)
        .maybeSingle(),
      tabela('documentos_alertas_destinatarios')
        .select('id, nome, email, tipo, ativo')
        .eq('empresa_id', empresaAtiva.id)
        .order('created_at'),
      tabela('documentos_alertas_log')
        .select('destinatario_email, docs_no_digest, vencidos, enviado_em')
        .eq('empresa_id', empresaAtiva.id)
        .order('enviado_em', { ascending: false })
        .limit(8),
    ]);

    // Princípio 3: mensagem REAL do banco, não "erro ao carregar".
    const falha = cfgRes.error ?? destRes.error ?? logRes.error;
    if (falha) {
      setErro(falha.message);
      setCarregando(false);
      return;
    }

    const cfg = cfgRes.data as { ativo: boolean; antecedencia_dias: number } | null;
    const dias = String(cfg?.antecedencia_dias ?? ANTECEDENCIA_PADRAO);
    setAtivo(!!cfg?.ativo);
    setAntecedencia(dias);
    setSalvo({ ativo: !!cfg?.ativo, antecedencia: dias });
    setDestinatarios((destRes.data as unknown as Destinatario[]) ?? []);
    setTrilha((logRes.data as unknown as LinhaDeDisparo[]) ?? []);
    setCarregando(false);
  }, [empresaAtiva?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const antecedenciaNumero = antecedenciaValida(antecedencia);
  const antecedenciaForaDaFaixa =
    antecedencia.trim() !== '' && String(antecedenciaNumero) !== antecedencia.trim();
  const pendente = ativo !== salvo.ativo || antecedencia !== salvo.antecedencia;
  const ativosCadastrados = destinatarios.filter((d) => d.ativo).length;

  /**
   * Grava ativo + antecedência JUNTOS. A separação anterior era a origem do
   * bug: o interruptor salvava, o número só pegava carona quando o
   * interruptor já estava ligado.
   */
  const salvarConfig = async () => {
    if (!empresaAtiva?.id) return;
    // Ligar sem ninguém para receber é um alerta que não alerta.
    if (ativo && ativosCadastrados === 0) {
      toast.error('Cadastre ao menos um destinatário ativo antes de ligar os alertas.');
      return;
    }
    setSalvando(true);
    const { error } = await tabela('documentos_alertas_config').upsert(
      {
        empresa_id: empresaAtiva.id,
        ativo,
        antecedencia_dias: antecedenciaNumero,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'empresa_id' },
    );
    setSalvando(false);
    if (error) {
      toast.error('Não foi possível salvar', { description: error.message });
      return;
    }
    // O campo passa a exibir o valor que REALMENTE foi para o banco — se
    // alguém digitou 300, a tela mostra 120, não a mentira digitada.
    setAntecedencia(String(antecedenciaNumero));
    setSalvo({ ativo, antecedencia: String(antecedenciaNumero) });
    toast.success(
      ativo
        ? `Configuração salva. Alertas ligados, janela de ${antecedenciaNumero} dias.`
        : `Configuração salva. Alertas continuam desligados (janela de ${antecedenciaNumero} dias guardada).`,
    );
  };

  const adicionar = async () => {
    if (!empresaAtiva?.id) return;
    const email = novo.email.trim().toLowerCase();
    if (!novo.nome.trim()) {
      toast.error('Informe o nome.');
      return;
    }
    if (!EMAIL_VALIDO.test(email)) {
      toast.error('E-mail inválido.');
      return;
    }
    setSalvando(true);
    const { error } = await tabela('documentos_alertas_destinatarios').insert({
      empresa_id: empresaAtiva.id,
      nome: novo.nome.trim(),
      email,
      tipo: novo.tipo,
    });
    setSalvando(false);
    if (error) {
      // O UNIQUE (empresa_id, email) é o que impede o mesmo e-mail receber
      // dois digests; traduzir a violação evita que pareça falha do sistema.
      toast.error('Não foi possível cadastrar', {
        description: error.message.includes('duplicate')
          ? 'Este e-mail já está cadastrado para esta empresa.'
          : error.message,
      });
      return;
    }
    toast.success(`${email} passará a receber os alertas.`);
    setNovo({ nome: '', email: '', tipo: 'assessoria_contabil' });
    carregar();
  };

  const alternarDestinatario = async (d: Destinatario) => {
    const { error } = await tabela('documentos_alertas_destinatarios')
      .update({ ativo: !d.ativo })
      .eq('id', d.id);
    if (error) {
      toast.error('Não foi possível alterar', { description: error.message });
      return;
    }
    carregar();
  };

  const remover = async (d: Destinatario) => {
    const { error } = await tabela('documentos_alertas_destinatarios')
      .delete()
      .eq('id', d.id);
    if (error) {
      toast.error('Não foi possível remover', { description: error.message });
      return;
    }
    toast.success(`${d.email} removido dos alertas.`);
    carregar();
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="g-corpo text-muted-foreground">Carregando alertas de vencimento…</span>
      </div>
    );
  }

  if (!empresaAtiva?.id) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EstadoVazio
          icone={<Building2 />}
          titulo="Escolha uma empresa"
          descricao="Os alertas por e-mail são configurados por empresa. Selecione a empresa ativa no topo da tela para ver e editar a configuração."
        />
      </div>
    );
  }

  if (erro) {
    return <AvisoDeFalha aoTentarNovamente={carregar}>Não foi possível carregar: {erro}</AvisoDeFalha>;
  }

  const { hora, fuso } = horarioLocalDoDisparo();

  return (
    <div className="flex flex-col gap-4">
      {/* ══ BLOCO 1 — CONFIGURAÇÃO ═════════════════════════════════════ */}
      <section
        aria-labelledby="alertas-docs-config-titulo"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h3 id="alertas-docs-config-titulo" className="g-titulo-secao text-foreground">
              Configuração
            </h3>
            <p className="g-corpo mt-1 text-muted-foreground">
              Digest de vencimentos enviado <b className="text-foreground">por e-mail</b> aos
              destinatários ativos do bloco abaixo.
            </p>
          </div>
        </div>

        {/* Horário: a âncora é UTC. Dizer só "7h" mente para quem está em
            outro fuso — e o app é multiempresa. */}
        <p className="g-corpo flex items-start gap-2 rounded-[var(--g-raio)] bg-muted/50 px-3 py-2 text-muted-foreground">
          <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Disparo diário às{' '}
            <b className="text-foreground tabular-nums">
              {String(HORA_UTC_DO_DISPARO).padStart(2, '0')}:00 UTC
            </b>{' '}
            — <b className="text-foreground tabular-nums">{hora}</b> no seu fuso
            {fuso ? ` (${fuso})` : ''}. O horário é fixo em UTC: em fusos mais a oeste o e-mail
            chega proporcionalmente mais cedo.
          </span>
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Label htmlFor="alertas-docs-antecedencia" className="g-corpo">
              Antecedência (dias)
            </Label>
            <Input
              id="alertas-docs-antecedencia"
              type="number"
              inputMode="numeric"
              min={ANTECEDENCIA_MINIMA}
              max={ANTECEDENCIA_MAXIMA}
              value={antecedencia}
              onChange={(e) => setAntecedencia(e.target.value)}
              aria-describedby="alertas-docs-antecedencia-ajuda"
              className="g-controle w-32 rounded-[var(--g-raio)] tabular-nums"
            />
            <p id="alertas-docs-antecedencia-ajuda" className="g-meta text-muted-foreground">
              Entre {ANTECEDENCIA_MINIMA} e {ANTECEDENCIA_MAXIMA} dias — a faixa é validada também
              no banco.
              {antecedenciaForaDaFaixa && (
                <b className="ml-1 text-warning-ink">Será salvo como {antecedenciaNumero}.</b>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="alertas-docs-ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
              disabled={salvando}
            />
            <Label htmlFor="alertas-docs-ativo" className="g-corpo">
              {ativo ? 'Alertas ligados' : 'Alertas desligados'}
            </Label>
          </div>
        </div>

        {/* O que REALMENTE acontece — não é "um e-mail X dias antes". */}
        <div className="g-corpo flex flex-col gap-1 rounded-[var(--g-raio)] border border-border px-3 py-2 text-muted-foreground">
          <p>
            <b className="text-foreground">Frequência.</b> O e-mail sai nos marcos de{' '}
            <b className="text-foreground tabular-nums">{marcosPorExtenso(antecedenciaNumero)}</b>{' '}
            dias antes do vencimento — e <b className="text-foreground">todos os dias</b> enquanto
            houver documento vencido. No máximo um e-mail por destinatário por dia. Documento sem
            nada na janela de {antecedenciaNumero} dias não gera e-mail nenhum.
          </p>
          <p>
            <b className="text-foreground">Destinatários.</b> Só os marcados como ativos abaixo
            {ativosCadastrados > 0
              ? ` (${ativosCadastrados} no momento)`
              : ' — nenhum ativo no momento'}
            . O alerta cessa sozinho quando o documento renovado é anexado: a validade nova o tira
            da janela.
          </p>
        </div>

        {/* Lacuna real da edge: ela lê `documentos` por `empresa_id` estrito
            (`index.ts:71-72`), enquanto a tela de Documentos usa um `.or()`
            que também alcança o legado privado (`user_id` + `empresa_id IS
            NULL`). O documento privado aparece na tela e NUNCA é alertado. */}
        <AvisoDeContexto titulo="Documento privado antigo não entra no alerta">
          O disparo lê apenas documentos vinculados à empresa. Documento legado que ainda esteja
          privado (sem empresa) aparece na aba Documentos, mas nunca é alertado por e-mail —
          compartilhe-o com a empresa para que passe a ser coberto.
        </AvisoDeContexto>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={salvarConfig}
            disabled={salvando || !pendente}
            className="min-h-[var(--g-linha)]"
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando…
              </>
            ) : (
              'Salvar configuração'
            )}
          </Button>
          {/* O botão desabilitado sem explicação faz a pessoa achar que a tela
              travou; e a alteração pendente precisa ser visível — era esse
              silêncio que fazia a antecedência "não gravar". */}
          <p role="status" className="g-corpo text-muted-foreground">
            {pendente ? 'Há alterações não salvas.' : 'Tudo salvo.'}
          </p>
        </div>
      </section>

      {/* ══ BLOCO 2 — DESTINATÁRIOS ════════════════════════════════════ */}
      <section
        aria-labelledby="alertas-docs-dest-titulo"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h3 id="alertas-docs-dest-titulo" className="g-titulo-secao text-foreground">
              Destinatários
            </h3>
            <p className="g-corpo mt-1 text-muted-foreground">
              Quem recebe o digest. Cada e-mail entra uma única vez por empresa; desativar mantém o
              cadastro sem enviar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="alertas-docs-nome" className="g-corpo">Nome</Label>
            <Input
              id="alertas-docs-nome"
              value={novo.nome}
              onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
              placeholder="Ex.: Contabilidade XYZ"
              className="g-controle rounded-[var(--g-raio)]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="alertas-docs-email" className="g-corpo">E-mail</Label>
            <Input
              id="alertas-docs-email"
              type="email"
              value={novo.email}
              onChange={(e) => setNovo((n) => ({ ...n, email: e.target.value }))}
              placeholder="alertas@contabilidade.com.br"
              className="g-controle rounded-[var(--g-raio)]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="alertas-docs-tipo" className="g-corpo">Tipo</Label>
            <Select
              value={novo.tipo}
              onValueChange={(v: Destinatario['tipo']) => setNovo((n) => ({ ...n, tipo: v }))}
            >
              <SelectTrigger id="alertas-docs-tipo" className="g-controle rounded-[var(--g-raio)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assessoria_contabil">Assessoria contábil</SelectItem>
                <SelectItem value="interno">Setor interno</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={adicionar} disabled={salvando} className="min-h-[var(--g-linha)]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
          </Button>
        </div>

        {destinatarios.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Mail />}
            titulo="Nenhum destinatário"
            descricao="Cadastre o e-mail da assessoria e dos setores que devem ser avisados."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {destinatarios.map((d) => (
              <li
                key={d.id}
                className={`flex min-h-[var(--g-linha)] flex-wrap items-center gap-3 rounded-[var(--g-raio)] border border-border px-3 py-2 ${d.ativo ? '' : 'opacity-60'}`}
              >
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="g-corpo truncate font-medium text-foreground">{d.nome}</p>
                  <p className="g-meta truncate text-muted-foreground">{d.email}</p>
                </div>
                <Badge variant="muted">{TIPO_LABEL[d.tipo]}</Badge>
                <span className="g-meta w-16 shrink-0 text-muted-foreground">
                  {d.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <Switch
                  checked={d.ativo}
                  onCheckedChange={() => alternarDestinatario(d)}
                  aria-label={`${d.ativo ? 'Desativar' : 'Ativar'} os alertas para ${d.email}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remover(d)}
                  className="h-11 w-11 text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                  title="Remover destinatário"
                  aria-label={`Remover ${d.email} dos alertas`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ══ Trilha de disparos ═════════════════════════════════════════
          Só ENVIOS CONCLUÍDOS entram aqui: a edge acumula as falhas em
          `resultado.erros`, que vive apenas na resposta HTTP do cron e não é
          gravada em lugar nenhum. Dizer isso evita a leitura errada de que
          "não está na lista" = "não havia o que enviar". */}
      <section
        aria-labelledby="alertas-docs-trilha-titulo"
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:p-6"
      >
        <h3 id="alertas-docs-trilha-titulo" className="g-titulo-secao text-foreground">
          Últimos disparos
        </h3>
        {trilha.length === 0 ? (
          <p className="g-corpo text-muted-foreground">
            Nenhum envio registrado ainda para esta empresa.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {trilha.map((t, i) => (
              <li key={`${t.destinatario_email}-${t.enviado_em}-${i}`} className="g-meta truncate text-muted-foreground">
                <span className="tabular-nums">
                  {new Date(t.enviado_em).toLocaleString('pt-BR')}
                </span>{' '}
                · {t.destinatario_email} · {t.docs_no_digest} doc
                {t.docs_no_digest === 1 ? '' : 's'}
                {t.vencidos > 0 && (
                  <span className="font-medium text-destructive-ink">
                    {' '}
                    ({t.vencidos} vencido{t.vencidos === 1 ? '' : 's'})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="g-meta text-muted-foreground">
          A trilha registra apenas envios concluídos. Falha de entrega não é gravada hoje: se um
          destinatário ativo não aparecer no dia em que houve digest, o envio pode ter falhado.
        </p>
      </section>
    </div>
  );
}
