import {
  Download,
  Eye,
  History,
  Loader2,
  PencilLine,
  Repeat,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import SeloDocumento, { ValidadeDoDocumento } from './SeloDocumento';
import { nomeDoArquivo, tamanhoLegivel, type ItemDoCofre } from './item-do-cofre';

/** Formatos que o navegador abre dentro da tela; o resto se confere baixando. */
const EXTENSOES_VISUALIZAVEIS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

function podeVisualizar(caminho?: string): boolean {
  if (!caminho) return false;
  const ext = caminho.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSOES_VISUALIZAVEIS.includes(ext);
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export interface AcoesDoPainel {
  aoVisualizar: () => void;
  aoBaixar: () => void;
  /** Anexar (vaga vazia) e substituir são o MESMO fluxo com rótulos diferentes. */
  aoAnexar: () => void;
  aoEditarValidade: () => void;
  aoExcluir: () => void;
  aoCompartilhar: () => void;
  aoAbrirHistorico: () => void;
}

interface Props extends AcoesDoPainel {
  item: ItemDoCofre;
  /** Operação em curso nesta linha — desliga os botões e mostra o giro. */
  ocupado?: 'enviando' | 'removendo' | null;
  /** Histórico é trilha de auditoria: só o Admin da empresa alcança. */
  podeVerHistorico: boolean;
  /** Nome da empresa ativa, para o texto de compartilhamento. */
  nomeDaEmpresa?: string | null;
}

/**
 * O painel de detalhes de um documento do cofre.
 *
 * Regra que o comando repete e que é fácil quebrar sem perceber: abrir este
 * painel NÃO pode custar a busca, os filtros nem a posição da lista. Por isso
 * ele recebe o item já resolvido e devolve ações por callback — nada aqui
 * navega, recarrega ou mexe em filtro. Quem seleciona é a tabela; quem guarda o
 * estado é a tela.
 *
 * As ações aparecem CONFORME O ESTADO, e não todas cinzentas: numa vaga sem
 * arquivo, "Baixar" e "Substituir" não existem — oferecer um botão que só sabe
 * dizer "não dá" é pior que não oferecer.
 */
export default function PainelDocumento({
  item,
  ocupado,
  podeVerHistorico,
  nomeDaEmpresa,
  aoVisualizar,
  aoBaixar,
  aoAnexar,
  aoEditarValidade,
  aoExcluir,
  aoCompartilhar,
  aoAbrirHistorico,
}: Props) {
  const temArquivo = Boolean(item.arquivoPath);
  const enviando = ocupado === 'enviando';
  const removendo = ocupado === 'removendo';
  const tamanho = tamanhoLegivel(item.tamanhoBytes);

  const campos: Campo[] = [
    { rotulo: 'Categoria', valor: item.categoria },
    { rotulo: 'Exigência', valor: item.artigo },
    {
      rotulo: 'Arquivo',
      largo: true,
      valor: item.arquivoPath ? (
        <span className="break-all">{nomeDoArquivo(item.arquivoPath)}</span>
      ) : (
        <ValorIndisponivel razao="Nenhum arquivo anexado" />
      ),
    },
    {
      /* O comando pede a emissão "se houver" — e aqui ela NÃO há: a tabela
         `documentos` guarda validade, não data de emissão. Dizer isso é melhor
         que omitir a linha (parece esquecimento) e muito melhor que mostrar a
         data do upload no lugar dela, que seria informação falsa num documento
         que pode ter sido emitido meses antes de ser anexado. */
      rotulo: 'Emissão',
      valor: <ValorIndisponivel razao="Não registrada — o cofre guarda a validade" />,
    },
    {
      rotulo: 'Validade',
      valor: <ValidadeDoDocumento validade={item.validade} situacao={item.situacao} />,
    },
    {
      rotulo: 'Anexado em',
      numerico: true,
      valor: item.criadoEm ? dataHora(item.criadoEm) : <ValorIndisponivel razao="Sem registro" />,
    },
    {
      rotulo: 'Última atualização',
      numerico: true,
      valor: item.atualizadoEm
        ? dataHora(item.atualizadoEm)
        : <ValorIndisponivel razao="Sem registro" />,
    },
    {
      rotulo: 'Tamanho',
      numerico: true,
      valor: tamanho ?? <ValorIndisponivel razao="Não registrado" />,
    },
    {
      rotulo: 'Visibilidade',
      valor: !temArquivo
        ? <ValorIndisponivel razao="Sem arquivo" />
        : item.legadoPrivado
          ? 'Só você vê'
          : 'Toda a equipe da empresa',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2 className="g-titulo-secao text-foreground">{item.nome}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SeloDocumento situacao={item.situacao} />
        </div>
      </header>

      <BlocoDoPainel titulo="Identificação">
        <ListaDeCampos campos={campos} />
      </BlocoDoPainel>

      {temArquivo && (
        <BlocoDoPainel titulo="Conferência">
          {podeVisualizar(item.arquivoPath) ? (
            <p className="g-meta text-muted-foreground">
              Abre em tela cheia dentro do sistema — não precisa baixar para conferir validade e
              assinatura.
            </p>
          ) : (
            <p className="g-meta text-warning-ink">
              Formato sem visualização em tela. Baixe o arquivo para conferir.
            </p>
          )}
        </BlocoDoPainel>
      )}

      <BlocoDoPainel titulo="Ações">
        <div className="flex flex-wrap gap-2">
          {temArquivo && podeVisualizar(item.arquivoPath) && (
            <Button size="sm" variant="outline" onClick={aoVisualizar}>
              <Eye aria-hidden="true" /> Visualizar
            </Button>
          )}
          {temArquivo && (
            <Button size="sm" variant="outline" onClick={aoBaixar}>
              <Download aria-hidden="true" /> Baixar
            </Button>
          )}
          {/* Anexar × Substituir: o rótulo muda porque a consequência muda —
              substituir descarta o arquivo que está lá. */}
          <Button size="sm" variant={temArquivo ? 'outline' : 'default'} onClick={aoAnexar} disabled={enviando}>
            {enviando ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : temArquivo ? (
              <Repeat aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            {temArquivo ? 'Substituir arquivo' : 'Anexar documento'}
          </Button>
          {/* Editar metadados = editar a VALIDADE. Nome, categoria e artigo vêm
              do checklist da lei e não são campo de digitação: mudá-los aqui
              órfãnaria o casamento por nome de que o kit de faturamento e o
              histórico dependem. */}
          {item.dbId && item.vencePorNatureza && (
            <Button size="sm" variant="outline" onClick={aoEditarValidade} disabled={enviando}>
              <PencilLine aria-hidden="true" /> Editar validade
            </Button>
          )}
          {item.legadoPrivado && nomeDaEmpresa && (
            <Button
              size="sm"
              variant="outline"
              className="text-warning-ink hover:text-warning-ink"
              onClick={aoCompartilhar}
              title={`Hoje só você vê este documento — compartilhar libera para a equipe de ${nomeDaEmpresa}`}
            >
              <Users aria-hidden="true" /> Compartilhar com a equipe
            </Button>
          )}
        </div>

        {(temArquivo || podeVerHistorico) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {podeVerHistorico && (
              <Button size="sm" variant="ghost" onClick={aoAbrirHistorico}>
                <History aria-hidden="true" /> Histórico de alterações
              </Button>
            )}
            {temArquivo && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                onClick={aoExcluir}
                disabled={removendo}
              >
                {removendo ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                Excluir
              </Button>
            )}
          </div>
        )}

        {item.legadoPrivado && !nomeDaEmpresa && (
          <p className="g-meta mt-2 text-muted-foreground">
            Documento pessoal — para compartilhar com a equipe, escolha uma empresa na faixa
            superior.
          </p>
        )}
      </BlocoDoPainel>
    </div>
  );
}
