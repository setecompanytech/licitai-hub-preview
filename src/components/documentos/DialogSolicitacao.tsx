import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { modeloDeSolicitacao, type CertidaoDoCatalogo } from '@/data/certidoes-catalogo';
import { validarSolicitacao, type DadosDaSolicitacao } from '@/lib/documentos/solicitacoes';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** A vaga do cofre a que a certidão pertence. */
  nomeDoDocumento: string;
  certidao: CertidaoDoCatalogo;
  razaoSocial: string;
  cnpj: string;
  /**
   * Quando a tabela de solicitações ainda não existe: o texto que explica, e
   * o botão passa a só abrir o e-mail, sem registrar.
   */
  indisponivel?: string | null;
  salvando: boolean;
  /** Erro da última tentativa de gravar — fica no diálogo, com o botão para tentar de novo. */
  erro?: string | null;
  aoConfirmar: (dados: DadosDaSolicitacao, mailto: string) => void;
}

/**
 * O diálogo de solicitação ao órgão.
 *
 * Duas coisas acontecem ao confirmar, nesta ordem: a solicitação é GRAVADA
 * (órgão, e-mail, prazo, observação — o protocolo vem depois, quando o
 * órgão responde) e o e-mail abre no programa de e-mail da pessoa, já
 * endereçado e com o modelo pronto. Se a gravação falhar, o e-mail não abre:
 * tentar de novo não pode mandar dois pedidos ao órgão.
 */
export default function DialogSolicitacao({
  aberto, aoFechar, nomeDoDocumento, certidao, razaoSocial, cnpj, indisponivel, salvando, erro, aoConfirmar,
}: Props) {
  const [orgao, setOrgao] = useState('');
  const [email, setEmail] = useState('');
  const [prazo, setPrazo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState<string[]>([]);

  // Reabre sempre com os dados da certidão CLICADA — o órgão da vaga anterior
  // não pode ficar no campo e ir parar no pedido seguinte.
  useEffect(() => {
    if (!aberto) return;
    setOrgao(certidao.emissor);
    setEmail('');
    setPrazo('');
    setObservacao('');
    setErros([]);
  }, [aberto, certidao]);

  const modelo = useMemo(
    () => modeloDeSolicitacao({ certidao: certidao.nome, orgao: orgao || certidao.emissor, razaoSocial, cnpj, para: email }),
    [certidao, orgao, razaoSocial, cnpj, email],
  );

  const confirmar = () => {
    const dados: DadosDaSolicitacao = { orgao, emailDestino: email, prazoResposta: prazo, observacao };
    const encontrados = validarSolicitacao(dados);
    setErros(encontrados);
    if (encontrados.length) return;
    aoConfirmar(dados, modelo.mailto);
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !salvando) aoFechar(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Solicitar ao órgão
          </DialogTitle>
          <DialogDescription>{nomeDoDocumento}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="solicitacao-orgao">Órgão</Label>
              <Input
                id="solicitacao-orgao"
                className="g-controle rounded-[var(--g-raio)]"
                value={orgao}
                onChange={(e) => setOrgao(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="solicitacao-email">E-mail do órgão</Label>
              <Input
                id="solicitacao-email"
                type="email"
                inputMode="email"
                placeholder="Opcional — o e-mail abre sem destinatário se ficar vazio"
                className="g-controle rounded-[var(--g-raio)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="solicitacao-prazo">Prazo de resposta</Label>
              <Input
                id="solicitacao-prazo"
                type="date"
                className="g-controle rounded-[var(--g-raio)]"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
              <p className="g-meta text-muted-foreground">Até quando esperar o PDF. Opcional.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="solicitacao-observacao">Observação</Label>
              <Textarea
                id="solicitacao-observacao"
                rows={2}
                placeholder="Ex.: pedido também por telefone; exercício de 2026"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          {/* O que vai no e-mail, à vista: assunto e a primeira linha do corpo. */}
          <div className="rounded-[var(--g-raio)] border border-border bg-secondary p-3">
            <p className="g-meta text-muted-foreground">Assunto do e-mail</p>
            <p className="g-corpo break-words text-foreground">{modelo.assunto}</p>
            <p className="g-meta mt-2 text-muted-foreground">
              O corpo pede o PDF com o código de autenticidade, em nome de {razaoSocial}. O protocolo se informa depois, no painel da vaga.
            </p>
          </div>

          {erros.length > 0 && (
            <ul role="alert" className="g-corpo list-disc space-y-1 pl-5 text-destructive-ink">
              {erros.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}

          {indisponivel && <p className="g-meta text-warning-ink">{indisponivel}</p>}

          {erro && (
            <AvisoDeFalha aoTentarNovamente={confirmar}>
              Não foi possível registrar a solicitação: {erro}
            </AvisoDeFalha>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
            {indisponivel ? 'Abrir e-mail' : 'Abrir e-mail e registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
