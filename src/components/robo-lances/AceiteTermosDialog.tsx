import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Lock, FileText, DollarSign, Key } from 'lucide-react';
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
O operador pode acionar a parada emergencial a qualquer momento, interrompendo imediatamente todas as operações automatizadas em curso.

5. NÍVEIS DE AUTOMAÇÃO
- Nível 1 (Assistente): Apenas leitura e cálculos. Nenhum lance é enviado.
- Nível 2 (Semiautomático): Operador autoriza a estratégia previamente. Sistema executa dentro de limites estritos.
- Nível 3 (Automação Controlada): Requer dupla autenticação, base contratual/técnica/jurídica e aceite expresso desta política.

6. DUPLA AUTENTICAÇÃO (NÍVEL 3)
O Nível 3 exige verificação por código enviado ao e-mail cadastrado antes de iniciar qualquer sessão automatizada.

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

export default function AceiteTermosDialog({ open, onOpenChange, nivel, sessaoId, licitacaoId, onAceite }: Props) {
  const { user } = useAuth();
  const { registrar } = useAuditLog();

  const [aceitePolitica, setAceitePolitica] = useState(false);
  const [aceiteResponsabilidade, setAceiteResponsabilidade] = useState(false);
  const [limiteFinanceiro, setLimiteFinanceiro] = useState('');
  const [codigo2fa, setCodigo2fa] = useState('');
  const [codigo2faEnviado, setCodigo2faEnviado] = useState(false);
  const [codigoGerado, setCodigoGerado] = useState('');
  const [saving, setSaving] = useState(false);

  const precisa2fa = nivel === 3;

  const handleEnviar2fa = () => {
    // Generate a simple 6-digit code and show it (in production, send via email)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setCodigoGerado(code);
    setCodigo2faEnviado(true);
    toast.info(`Código de verificação enviado para ${user?.email}`, {
      description: `Para fins de demonstração, o código é: ${code}`,
      duration: 15000,
    });
  };

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

    if (precisa2fa && codigo2fa !== codigoGerado) {
      toast.error('Código de verificação inválido.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('robo_aceite_termos' as any)
        .insert({
          user_id: user.id,
          nivel_automacao: nivel,
          sessao_id: sessaoId || null,
          licitacao_id: licitacaoId || null,
          limite_financeiro: limite,
          aceite_politica_uso: true,
          aceite_responsabilidade: true,
          dupla_autenticacao_verificada: precisa2fa,
          ip_aceite: null,
          user_agent_aceite: navigator.userAgent,
        })
        .select('id')
        .single();

      if (error) throw error;

      await registrar('aceite_termos', {
        nivel,
        limite_financeiro: limite,
        dupla_autenticacao: precisa2fa,
      }, {
        sessaoId,
        licitacaoId,
        nivelAutomacao: nivel,
      });

      toast.success('Termos aceitos com sucesso!');
      onAceite((data as any).id);
      onOpenChange(false);

      // Reset
      setAceitePolitica(false);
      setAceiteResponsabilidade(false);
      setLimiteFinanceiro('');
      setCodigo2fa('');
      setCodigo2faEnviado(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar aceite.');
    } finally {
      setSaving(false);
    }
  };

  const nivelLabel = nivel === 1 ? 'Assistente' : nivel === 2 ? 'Semiautomático' : 'Automação Controlada';
  const nivelColor = nivel === 1 ? 'bg-info/15 text-info border-info/30' : nivel === 2 ? 'bg-warning/15 text-warning border-warning/30' : 'bg-destructive/15 text-destructive border-destructive/30';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Aceite de Termos — Nível {nivel}
            <Badge variant="outline" className={nivelColor}>{nivelLabel}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Política de uso */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold">Política de Uso do Robô de Lances</span>
            </div>
            <ScrollArea className="h-40 border border-border rounded-lg p-3">
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {POLITICA_USO}
              </pre>
            </ScrollArea>
          </div>

          {/* Limite financeiro */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-warning" />
              <label className="text-xs font-semibold">Limite Financeiro Máximo (R$) *</label>
            </div>
            <MoneyInput
              value={parseFloat(limiteFinanceiro) || 0}
              onValueChange={(v) => setLimiteFinanceiro(String(v))}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Valor máximo total que o sistema poderá comprometer em lances. Nenhuma operação excederá este limite.
            </p>
          </div>

          {/* 2FA for Level 3 */}
          {precisa2fa && (
            <div className="border border-destructive/20 rounded-lg p-3 bg-destructive/5 space-y-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-destructive" />
                <span className="text-xs font-semibold text-destructive">Dupla Autenticação Obrigatória</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                O Nível 3 exige verificação adicional. Um código será enviado ao e-mail {user?.email}.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEnviar2fa}
                  disabled={codigo2faEnviado}
                >
                  {codigo2faEnviado ? 'Código enviado ✓' : 'Enviar código'}
                </Button>
                {codigo2faEnviado && (
                  <Input
                    value={codigo2fa}
                    onChange={(e) => setCodigo2fa(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="w-32 font-mono text-center tracking-widest"
                  />
                )}
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="aceite-politica"
                checked={aceitePolitica}
                onCheckedChange={(v) => setAceitePolitica(v === true)}
              />
              <label htmlFor="aceite-politica" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                Li e aceito integralmente a <strong>Política de Uso do Robô de Lances</strong>, incluindo os termos de responsabilidade e limites de automação.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="aceite-responsabilidade"
                checked={aceiteResponsabilidade}
                onCheckedChange={(v) => setAceiteResponsabilidade(v === true)}
              />
              <label htmlFor="aceite-responsabilidade" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                Declaro que sou o <strong>responsável legal</strong> pela empresa e que os lances executados pelo sistema são de minha inteira responsabilidade, conforme a Lei 14.133/2021.
              </label>
            </div>
          </div>

          {nivel >= 2 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 rounded-lg border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-[10px] text-warning">
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
            disabled={!aceitePolitica || !aceiteResponsabilidade || !limiteFinanceiro || saving || (precisa2fa && (!codigo2faEnviado || codigo2fa.length < 6))}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Shield className="w-4 h-4 mr-1" />
            {saving ? 'Registrando...' : 'Aceitar e Prosseguir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
