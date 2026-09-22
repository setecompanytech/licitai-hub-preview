import { Building2, ExternalLink, Mail, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import { ROTULO_DA_OBTENCAO, modeloDeSolicitacao, validadeLegivel } from '@/data/certidoes-catalogo';
import {
  MOTIVO_SEM_MUNICIPIO, MOTIVO_SEM_UF, ROTULO_DA_ACAO, type AcaoNoOrgao, type OrgaoDaVaga,
} from '@/lib/documentos/orgao-emissor';

interface Props {
  orgao: OrgaoDaVaga;
  /** Para o e-mail de solicitação sair em nome da empresa. */
  razaoSocial: string;
  cnpj: string;
  /**
   * Quando informado, "Solicitar por e-mail" chama isto — e a solicitação
   * fica registrada (protocolo, prazo). Sem ele, é só o e-mail pronto.
   */
  aoSolicitar?: () => void;
  /** Município fora do mapa: abre o cadastro do órgão da empresa. Sem ele, o botão não aparece. */
  aoCadastrarOrgao?: () => void;
}

/**
 * O bloco "Órgão emissor" do painel do cofre — quem emite a certidão desta
 * vaga, como se obtém, quanto vale em regra, e o botão que leva até lá.
 *
 * O que ele NUNCA faz: emitir, raspar ou resumir certidão. A certidão válida
 * é o PDF do órgão; daqui a pessoa vai ao site do órgão (com a verificação
 * "sou humano" dele) ou manda o e-mail de solicitação, e traz o PDF de volta
 * para a vaga. Sem domicílio no cadastro da empresa, o bloco diz o que falta
 * — não escolhe uma cidade.
 */
export default function OrgaoEmissorDaVaga({
  orgao, razaoSocial, cnpj, aoSolicitar, aoCadastrarOrgao,
}: Props) {
  // Vaga que o catálogo de certidões não cobre (CREA, balanço, declarações
  // próprias sem órgão): não há o que apontar, e inventar um órgão é pior que
  // não mostrar o bloco.
  if (!orgao.esfera) return null;

  const c = orgao.certidao;
  if (!c) {
    const pedeCadastro = orgao.motivo === MOTIVO_SEM_UF || orgao.motivo === MOTIVO_SEM_MUNICIPIO;
    return (
      <BlocoDoPainel titulo="Órgão emissor">
        <p className="g-meta text-warning-ink">{orgao.motivo ?? 'Órgão não identificado para esta vaga.'}</p>
        {pedeCadastro && (
          <Button asChild size="sm" variant="outline" className="w-fit">
            <Link to="/configuracoes">
              <Settings2 aria-hidden="true" /> Abrir o cadastro da empresa
            </Link>
          </Button>
        )}
      </BlocoDoPainel>
    );
  }

  const campos: Campo[] = [
    { rotulo: 'Emissor', largo: true, valor: c.emissor },
    { rotulo: 'Como se obtém', largo: true, valor: ROTULO_DA_OBTENCAO[c.obtencao] },
    { rotulo: 'Validade usual', valor: validadeLegivel(c.validadeDias) },
    { rotulo: 'Fundamento', valor: c.fundamento },
  ];

  const solicitacao = orgao.acoes.includes('solicitar')
    ? modeloDeSolicitacao({ certidao: c.nome, orgao: c.emissor, razaoSocial, cnpj })
    : null;

  // A primeira ação que a tela consegue oferecer é a principal (botão cheio);
  // as demais ficam em contorno. "Cadastrar" só existe quando há para onde ir.
  const acoesVisiveis = orgao.acoes.filter((a) => a !== 'cadastrar' || Boolean(aoCadastrarOrgao));

  const botao = (acao: AcaoNoOrgao, principal: boolean) => {
    const variant = principal ? 'default' : 'outline';
    if (acao === 'emitir' && c.urlEmissao) {
      return (
        <Button key={acao} asChild size="sm" variant={variant}>
          <a href={c.urlEmissao} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" /> {ROTULO_DA_ACAO.emitir}
          </a>
        </Button>
      );
    }
    if (acao === 'solicitar' && solicitacao) {
      return aoSolicitar ? (
        <Button key={acao} size="sm" variant={variant} onClick={aoSolicitar}>
          <Mail aria-hidden="true" /> {ROTULO_DA_ACAO.solicitar}
        </Button>
      ) : (
        <Button key={acao} asChild size="sm" variant={variant}>
          <a href={solicitacao.mailto}>
            <Mail aria-hidden="true" /> {ROTULO_DA_ACAO.solicitar}
          </a>
        </Button>
      );
    }
    if (acao === 'cadastrar' && aoCadastrarOrgao) {
      return (
        <Button key={acao} size="sm" variant={variant} onClick={aoCadastrarOrgao}>
          <Building2 aria-hidden="true" /> {ROTULO_DA_ACAO.cadastrar}
        </Button>
      );
    }
    return null;
  };

  return (
    <BlocoDoPainel titulo="Órgão emissor">
      <ListaDeCampos campos={campos} />
      {c.observacao && <p className="g-meta text-muted-foreground">{c.observacao}</p>}
      {acoesVisiveis.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {acoesVisiveis.map((a, i) => botao(a, i === 0))}
        </div>
      ) : (
        orgao.motivo && <p className="g-meta text-warning-ink">{orgao.motivo}</p>
      )}
    </BlocoDoPainel>
  );
}
