import { useMemo } from 'react';
import AvisoAoCliente from '@/components/admin-robo/AvisoAoCliente';
import { avisosQueSeAplicam, type AvisoDoPortal } from './robo-do-cliente';

/**
 * A faixa de avisos acima do painel de participações.
 *
 * Mostra os avisos gerais e os dos portais em que a empresa TEM disputa — ver
 * `avisosQueSeAplicam`. Sem aviso que se aplique, não desenha nada: faixa
 * permanente "nenhum aviso" viraria paisagem, e a lista completa já mora no
 * botão "Avisos" da faixa da empresa.
 *
 * Cada aviso é desenhado por `AvisoAoCliente`, a MESMA peça que o editor de
 * avisos do Admin usa como prévia. Não é uma cópia de propósito: duas versões
 * do banner fariam a prévia mentir na primeira vez em que uma delas mudasse, e
 * quem escreve o aviso precisa ver exatamente o que o cliente vai ler.
 *
 * O texto é escrito por gente da Praefectus, em linguagem de negócio. Erro
 * técnico nunca chega aqui.
 */
export default function AvisosDosPortais({
  avisos,
  portaisDasDisputas,
}: {
  avisos: AvisoDoPortal[];
  portaisDasDisputas: Array<string | null | undefined>;
}) {
  const aplicaveis = useMemo(
    () => avisosQueSeAplicam(avisos, portaisDasDisputas),
    [avisos, portaisDasDisputas],
  );

  if (aplicaveis.length === 0) return null;

  return (
    <section aria-label="Avisos da operação sobre os portais" className="flex flex-col gap-2" data-faixa="avisos">
      {aplicaveis.map((aviso) => (
        <AvisoAoCliente
          key={aviso.id}
          severidade={aviso.severidade}
          titulo={aviso.titulo}
          mensagem={aviso.mensagem}
          portalId={aviso.portal_id}
        />
      ))}
    </section>
  );
}
