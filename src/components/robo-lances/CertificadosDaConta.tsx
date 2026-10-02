import { useState } from 'react';
import { Loader2, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AvisoDeFalha, ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { useCertificadosDaConta } from '@/hooks/useCertificadosDaConta';
import { formatCNPJ } from '@/lib/financeiro/formatters';
import type { SituacaoDoCertificado, SlotDeCertificado } from '@/lib/robo/certificados-da-conta';

/**
 * Os certificados registrados, uma linha por empresa — os "slots" (02/10/2026).
 *
 * Pedido do Ian: *"ter slots no Praefectus pra ficar registrado"*, para a
 * Izabelle disputar com contas diferentes. O que esta lista resolve é a pergunta
 * que ninguém conseguia responder — *"o certificado de qual empresa está no
 * robô?"* —, e que em 02/10 só foi respondida lendo o código.
 *
 * ── Por que uma linha por EMPRESA, e não por certificado ────────────────────
 *
 * O robô entra no portal em nome de um CNPJ, e o Compras.gov associa a empresa
 * pelo vínculo no SICAF. Um e-CNPJ A1 por empresa atende ao robô e à busca de
 * XML na SEFAZ — é o mesmo arquivo, no mesmo cofre, com usos diferentes. Então
 * "quantos certificados tenho" é uma pergunta menos útil que "de quais empresas
 * o robô consegue ser".
 *
 * ── O que esta tela NÃO afirma ──────────────────────────────────────────────
 *
 * Que o certificado é válido. A validade está dentro do arquivo, que o sistema
 * não abre — então a linha diz desde quando está instalado e deixa a inferência
 * a quem opera. Afirmar validade que não se leu é o defeito que o dia inteiro
 * de 02/10 corrigiu em outros avisos.
 */

const SELO: Record<SituacaoDoCertificado, { texto: string; variante: 'success' | 'warning' | 'danger' | 'muted' }> = {
  'em-uso': { texto: 'No robô', variante: 'success' },
  'enviado-nao-instalado': { texto: 'Falta instalar', variante: 'warning' },
  'enviado-sem-senha': { texto: 'Enviar de novo', variante: 'danger' },
  'sem-certificado': { texto: 'Sem certificado', variante: 'muted' },
};

type Props = {
  /** Sem permissão para alterar, a lista fica legível e os botões saem. */
  somenteLeitura?: boolean;
};

export default function CertificadosDaConta({ somenteLeitura = false }: Props) {
  const { slots, resumo, carregando, erro, recarregar } = useCertificadosDaConta();
  // Por empresa, não global: um botão travado não pode travar os outros.
  const [ocupada, setOcupada] = useState<string | null>(null);

  /**
   * Gera o link de envio DAQUELA empresa.
   *
   * O link vai por e-mail e WhatsApp a quem tem o arquivo e a senha — que não é
   * necessariamente quem está nesta tela. Por isso o link também é mostrado:
   * quem registra muitas vezes é a mesma pessoa, e esperar o e-mail é atrito.
   */
  const pedirEnvio = async (slot: SlotDeCertificado) => {
    setOcupada(slot.empresa_id);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-link-certificado', {
        body: { empresa_id: slot.empresa_id },
      });
      if (error) throw error;
      const url = (data as { upload_url?: string } | null)?.upload_url;
      if (url) {
        await navigator.clipboard.writeText(url).catch(() => { /* sem permissão: o e-mail basta */ });
        toast.success('Link de envio criado e copiado. Também foi enviado por e-mail.');
      } else {
        toast.success('Link de envio criado e enviado por e-mail.');
      }
      recarregar();
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível criar o link de envio.');
    } finally {
      setOcupada(null);
    }
  };

  /** Repete a entrega ao robô — o caso do agente que estava fora do ar. */
  const instalarNoRobo = async (slot: SlotDeCertificado) => {
    setOcupada(slot.empresa_id);
    try {
      const { data, error } = await supabase.functions.invoke(
        'robo-lances-webhook/instalar-certificado',
        { body: { empresa_id: slot.empresa_id } },
      );
      let motivo = (data as { motivo?: string } | null)?.motivo;
      if (!motivo && error) {
        const contexto = (error as { context?: Response }).context;
        if (contexto && typeof contexto.json === 'function') {
          const corpo = await contexto.json().catch(() => null);
          motivo = (corpo as { motivo?: string } | null)?.motivo;
        }
        motivo = motivo || error.message;
      }
      if ((data as { instalado?: boolean } | null)?.instalado) {
        toast.success('Certificado instalado no robô.');
      } else {
        toast.error(motivo || 'Não foi possível instalar o certificado no robô.', { duration: 15000 });
      }
      recarregar();
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao instalar o certificado.');
    } finally {
      setOcupada(null);
    }
  };

  if (carregando) {
    return (
      <div className="g-cartao flex items-center gap-2 px-4 py-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="g-corpo">Lendo os certificados…</span>
      </div>
    );
  }

  if (erro) {
    return <AvisoDeFalha aoTentarNovamente={recarregar}>{erro}</AvisoDeFalha>;
  }

  return (
    <section aria-label="Certificados digitais das empresas" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h4 className="g-corpo font-semibold text-foreground">Certificado digital por empresa</h4>
        </div>
        {/*
          Sem empresa, o resumo diria "Nenhuma empresa nesta conta" — a mesma
          frase que o bloco abaixo já diz, e com explicação. Repetir não informa
          duas vezes: faz a pessoa procurar a diferença entre as duas.
        */}
        {resumo.total > 0 && <p className="g-meta text-muted-foreground">{resumo.frase}</p>}
      </header>

      {slots.length === 0 ? (
        <p className="g-corpo rounded-md border border-dashed border-border px-3 py-2 text-muted-foreground">
          Nenhuma empresa nesta conta. O certificado digital é da empresa — para registrar
          um, a conta precisa estar vinculada a ela.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {slots.map((slot) => {
            const selo = SELO[slot.situacao];
            const trabalhando = ocupada === slot.empresa_id;
            return (
              <li
                key={slot.empresa_id}
                className="g-cartao flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="g-corpo min-w-0 truncate font-medium text-foreground">
                      {slot.razao_social?.trim() || <ValorIndisponivel razao="Empresa sem razão social cadastrada" />}
                    </p>
                    <Badge variant={selo.variante}>{selo.texto}</Badge>
                  </div>
                  <p className="g-meta text-muted-foreground">
                    {slot.cnpj ? (
                      <span className="tabular-nums">{formatCNPJ(slot.cnpj)}</span>
                    ) : (
                      <ValorIndisponivel razao="CNPJ não cadastrado — o robô precisa dele para achar o certificado" />
                    )}
                    {' · '}
                    {slot.frase}
                  </p>
                </div>

                {!somenteLeitura && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {slot.situacao === 'enviado-nao-instalado' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={trabalhando}
                        onClick={() => instalarNoRobo(slot)}
                      >
                        {trabalhando ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        Instalar no robô
                      </Button>
                    )}
                    <Button
                      variant={slot.pedeAcao ? 'default' : 'outline'}
                      size="sm"
                      disabled={trabalhando}
                      onClick={() => pedirEnvio(slot)}
                    >
                      {trabalhando ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden="true" />
                      )}
                      {slot.situacao === 'sem-certificado' ? 'Registrar certificado' : 'Enviar outro'}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {somenteLeitura && (
        <p className="g-meta text-muted-foreground">
          Só o administrador da empresa registra ou troca o certificado digital — é a
          credencial dela. Para mudar, peça a um administrador em Equipe → Permissões.
        </p>
      )}
    </section>
  );
}
