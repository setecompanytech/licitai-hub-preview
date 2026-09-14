import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, FileText, DollarSign, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { NivelAutomacao } from './NivelAutomacaoSelector';

const POLITICA_USO = `
POLÍTICA DE USO — ROBÔ DE LANCES PRAEFECTUS

1. RESPONSABILIDADE DO OPERADOR
O operador é o único responsável pelos lances enviados, sejam eles executados manualmente ou por meio de automação. O sistema atua como ferramenta de apoio à decisão.

2. LIMITES FINANCEIROS
Todo lance automatizado está sujeito ao limite financeiro definido pelo operador. O sistema não excederá este valor em nenhuma circunstância.

3. TRILHA DE AUDITORIA
Todas as ações são registradas em trilha imutável de auditoria, incluindo: horário, valor, rodada, nível de automação e identificação do operador.

4. PARADA EMERGENCIAL
O operador pode acionar a parada emergencial a qualquer momento, interrompendo imediatamente todas as operações automatizadas em curso. Lances já aceitos pelo portal não são cancelados pela parada.

5. NÍVEIS DE AUTOMAÇÃO
- Nível 1 (Assistente): Apenas leitura e cálculos. Nenhum lance é enviado.
- Nível 2 (Semiautomático): Operador autoriza a estratégia previamente. Sistema executa dentro de limites estritos.
- Nível 3 (Automação Controlada): Requer confirmação por digitação, base contratual/técnica/jurídica e aceite expresso desta política.

6. CONFIRMAÇÃO POR DIGITAÇÃO (NÍVEL 3)
O Nível 3 exige que o operador digite um código exibido nesta tela antes de prosseguir. ATENÇÃO: esse código é gerado e conferido no próprio navegador e NÃO é enviado por e-mail nem por SMS — ele confirma a intenção de quem está na tela, mas não comprova identidade e não é autenticação de dois fatores. Não conte com ele como barreira de segurança.

7. REVOGAÇÃO
O aceite pode ser revogado a qualquer momento, cessando imediatamente qualquer automação ativa.

8. CONFORMIDADE
Esta política atende aos requisitos da Lei 14.133/2021 (Nova Lei de Licitações) e da LGPD (Lei 13.709/2018).

Ao aceitar, você declara ter lido e compreendido integralmente esta política.
`;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nivel: NivelAutomacao;
  sessaoId?: string;
  licitacaoId?: string;
  onAceite: (aceiteId: string) => void;
};

/** Seis dígitos para digitar. Não é segredo: aparece na própria tela. */
function gerarCodigoDeConfirmacao(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function AceiteTermosDialog({ open, onOpenChange, nivel, sessaoId, licitacaoId, onAceite }: Props) {
  const { user } = useAuth();
  const { registrar } = useAuditLog();

  const [aceitePolitica, setAceitePolitica] = useState(false);
  const [aceiteResponsabilidade, setAceiteResponsabilidade] = useState(false);
  const [limiteFinanceiro, setLimiteFinanceiro] = useState('');
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [codigoConfirmacao, setCodigoConfirmacao] = useState(gerarCodigoDeConfirmacao);
  const [saving, setSaving] = useState(false);

  /**
   * ─── ISTO NÃO É 2FA — E O BANCO TAMBÉM NÃO PODE DIZER QUE É ──────────────
   *
   * O código é sorteado AQUI, no navegador, e mostrado à mesma pessoa que vai
   * digitá-lo. Não há segundo canal, não há segundo fator e não há nada que um
   * atacante com a sessão aberta não veja. É uma confirmação de intenção, como
   * digitar "AUTORIZO" — e é para isso que continua sendo pedido: uma pausa
   * deliberada antes do nível que envia lance sem confirmação humana.
   *
   * Em 13/09/2026 a tela parou de anunciar um e-mail que nunca saía. Faltava
   * o banco: o aceite do Nível 3 seguia gravando
   * `dupla_autenticacao_verificada: true` em `robo_aceite_termos`, que é trilha
   * de auditoria. Registrar ali uma verificação que não aconteceu é produzir
   * prova falsa — e qualquer regra futura que confiasse na coluna herdaria a
   * mentira. Desde 14/09/2026 a coluna é gravada `false` até existir
   * verificação de verdade (código gerado e conferido no servidor, entregue
   * por outro canal), e o código aparece na própria tela, sem o teatro de
   * "gerar e enviar".
   */
  const precisaConfirmacao = nivel === 3;
  const confirmacaoOk = !precisaConfirmacao || codigoDigitado.trim() === codigoConfirmacao;

  const handleAceitar = async () => {
    if (!user) return;

    if (!aceitePolitica || !aceiteResponsabilidade) {
      toast.error('Você precisa aceitar todos os termos.');
      return;
    }

    const limite = parseFloat(limiteFinanceiro);
    if (!limite || limite <= 0) {
      toast.error('Defina um limite financeiro válido.');
      return;
    }

    if (!confirmacaoOk) {
      toast.error('O código digitado não confere com o exibido.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        // `as never` (e não `as any`) é o padrão do repo para tabela que o
        // `types.ts` gerado ainda não expõe — mantém a checagem ligada no
        // resto da cadeia em vez de desligá-la.
        .from('robo_aceite_termos' as never)
        .insert({
          user_id: user.id,
          nivel_automacao: nivel,
          sessao_id: sessaoId || null,
          licitacao_id: licitacaoId || null,
          limite_financeiro: limite,
          aceite_politica_uso: true,
          aceite_responsabilidade: true,
          // Sempre false: nada neste fluxo verifica um segundo fator (ver acima).
          dupla_autenticacao_verificada: false,
          ip_aceite: null,
          user_agent_aceite: navigator.userAgent,
        } as never)
        .select('id')
        .single();

      if (error) throw error;

      await registrar('aceite_termos', {
        nivel,
        limite_financeiro: limite,
        dupla_autenticacao: false,
        confirmacao_digitada: precisaConfirmacao,
      }, {
        sessaoId,
        licitacaoId,
        nivelAutomacao: nivel,
      });

      toast.success('Termos aceitos com sucesso!');
      onAceite((data as unknown as { id: string }).id);
      onOpenChange(false);

      // Reset — com código novo: o anterior já foi usado.
      setAceitePolitica(false);
      setAceiteResponsabilidade(false);
      setLimiteFinanceiro('');
      setCodigoDigitado('');
      setCodigoConfirmacao(gerarCodigoDeConfirmacao());
    } catch (err) {
      console.error(err);
      // A mensagem real do banco, não um "erro" genérico (princípio 3).
      toast.error(`Erro ao registrar aceite: ${(err as { message?: string })?.message || 'sem detalhe do servidor'}`);
    } finally {
      setSaving(false);
    }
  };

  const nivelLabel = nivel === 1 ? 'Assistente' : nivel === 2 ? 'Semiautomático' : 'Automação Controlada';
  const nivelVariant = nivel === 1 ? 'info' : nivel === 2 ? 'warning' : 'danger';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Shield className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Aceite de Termos — Nível {nivel}
            <Badge variant={nivelVariant}>{nivelLabel}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Política de uso */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold">Política de Uso do Robô de Lances</span>
            </div>
            <ScrollArea className="h-40 border border-border rounded-md p-3">
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                {POLITICA_USO}
              </pre>
            </ScrollArea>
          </div>

          {/* Limite financeiro */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-warning" aria-hidden="true" />
              <Label htmlFor="aceite-limite-financeiro">Limite Financeiro Máximo (R$) *</Label>
            </div>
            <MoneyInput
              id="aceite-limite-financeiro"
              value={parseFloat(limiteFinanceiro) || 0}
              onValueChange={(v) => setLimiteFinanceiro(String(v))}
              className="tabular-nums"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Valor máximo total que o sistema poderá comprometer em lances. Nenhuma operação excederá este limite.
            </p>
          </div>

          {/* Confirmação por digitação — Nível 3 */}
          {precisaConfirmacao && (
            <div className="border border-destructive-line rounded-lg p-4 bg-destructive-tint space-y-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-destructive-ink" aria-hidden="true" />
                <span className="text-sm font-semibold text-destructive-ink">
                  Confirmação por digitação (não é autenticação de dois fatores)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Para confirmar o Nível 3, digite o código{' '}
                <strong data-testid="codigo-confirmacao" className="font-mono tracking-widest text-foreground">
                  {codigoConfirmacao}
                </strong>{' '}
                no campo abaixo. Ele é gerado e conferido neste navegador — nada é enviado
                para {user?.email} nem para nenhum outro canal. Registra que você confirmou
                aqui; não comprova identidade.
              </p>
              <div>
                <Label htmlFor="aceite-codigo-confirmacao" className="mb-1 block">Código de confirmação</Label>
                <Input
                  id="aceite-codigo-confirmacao"
                  value={codigoDigitado}
                  onChange={(e) => setCodigoDigitado(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-36 text-center tracking-widest tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="aceite-politica"
                checked={aceitePolitica}
                onCheckedChange={(v) => setAceitePolitica(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="aceite-politica" className="text-sm text-muted-foreground cursor-pointer">
                Li e aceito integralmente a <strong className="text-foreground">Política de Uso do Robô de Lances</strong>, incluindo os termos de responsabilidade e limites de automação.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="aceite-responsabilidade"
                checked={aceiteResponsabilidade}
                onCheckedChange={(v) => setAceiteResponsabilidade(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="aceite-responsabilidade" className="text-sm text-muted-foreground cursor-pointer">
                Declaro que sou o <strong className="text-foreground">responsável legal</strong> pela empresa e que os lances executados pelo sistema são de minha inteira responsabilidade, conforme a Lei 14.133/2021.
              </label>
            </div>
          </div>

          {nivel >= 2 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-warning-tint rounded-lg border border-warning-line">
              <AlertTriangle className="w-4 h-4 text-warning-ink shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-warning-ink">
                {nivel === 2
                  ? 'No modo semiautomático, cada lance requer sua autorização prévia. O sistema não agirá sem confirmação.'
                  : 'A automação controlada enviará lances dentro dos limites definidos. Use o botão de parada emergencial se necessário.'
                }
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleAceitar}
            disabled={!aceitePolitica || !aceiteResponsabilidade || !limiteFinanceiro || saving || !confirmacaoOk}
          >
            <Shield className="w-4 h-4" aria-hidden="true" />
            {saving ? 'Registrando...' : 'Aceitar e Prosseguir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
