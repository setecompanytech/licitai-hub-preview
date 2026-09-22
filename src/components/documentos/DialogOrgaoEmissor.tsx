import { useEffect, useState } from 'react';
import { Building2, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import type { OrgaoCadastradoPelaEmpresa } from '@/data/certidoes-catalogo';
import {
  VALIDADE_MAXIMA_DIAS, dadosDoOrgao, validarOrgao, type DadosDoOrgao,
} from '@/lib/documentos/orgaos-da-empresa';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** O município a que o cadastro pertence — vem do domicílio, não se digita aqui. */
  uf: string;
  municipio: string;
  /** Cadastro existente, para corrigir. */
  existente?: OrgaoCadastradoPelaEmpresa | null;
  salvando: boolean;
  /** Erro da última tentativa de gravar — fica no diálogo, com o botão para tentar de novo. */
  erro?: string | null;
  /** Texto quando a tabela ainda não existe: o formulário abre, mas não grava. */
  indisponivel?: string | null;
  aoConfirmar: (dados: DadosDoOrgao) => void;
  /** Só o Admin da empresa remove; sem o callback, o botão não aparece. */
  aoRemover?: () => void;
}

const VAZIO: DadosDoOrgao = { nomeDoOrgao: '', site: '', email: '', instrucoes: '', validadeDias: '' };

/**
 * O cadastro do órgão municipal da empresa — para município fora do mapa.
 *
 * O município não se escolhe aqui: é o do domicílio fiscal (cadastro da
 * empresa) ou o selecionado na aba Certidões. O que a pessoa informa é o
 * órgão: nome, site e/ou e-mail, instruções e validade usual. Nada disso
 * emite certidão — é o endereço para onde ir buscá-la.
 */
export default function DialogOrgaoEmissor({
  aberto, aoFechar, uf, municipio, existente, salvando, erro, indisponivel, aoConfirmar, aoRemover,
}: Props) {
  const [dados, setDados] = useState<DadosDoOrgao>(VAZIO);
  const [erros, setErros] = useState<string[]>([]);

  // Reabre com o cadastro CLICADO (ou vazio): o órgão do município anterior
  // não pode ficar no campo e ir parar no cadastro seguinte.
  useEffect(() => {
    if (!aberto) return;
    setDados(existente ? dadosDoOrgao(existente) : VAZIO);
    setErros([]);
  }, [aberto, existente]);

  const campo = (chave: keyof DadosDoOrgao) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDados((d) => ({ ...d, [chave]: e.target.value }));

  const confirmar = () => {
    const encontrados = validarOrgao(dados);
    setErros(encontrados);
    if (encontrados.length) return;
    aoConfirmar(dados);
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !salvando) aoFechar(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {existente ? 'Corrigir o órgão municipal' : 'Cadastrar o órgão municipal'}
          </DialogTitle>
          <DialogDescription>
            {municipio}/{uf.toUpperCase()} — o órgão que emite as certidões municipais deste município.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="orgao-nome">Nome do órgão</Label>
              <Input
                id="orgao-nome"
                className="g-controle rounded-[var(--g-raio)]"
                placeholder={`Ex.: Prefeitura Municipal de ${municipio} · Secretaria de Finanças`}
                value={dados.nomeDoOrgao}
                onChange={campo('nomeDoOrgao')}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="orgao-site">Site de emissão</Label>
              <Input
                id="orgao-site"
                inputMode="url"
                className="g-controle rounded-[var(--g-raio)]"
                placeholder="Ex.: prefeitura.pa.gov.br/certidoes"
                value={dados.site}
                onChange={campo('site')}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="orgao-email">E-mail para solicitação</Label>
              <Input
                id="orgao-email"
                type="email"
                inputMode="email"
                className="g-controle rounded-[var(--g-raio)]"
                placeholder="Ex.: tributos@prefeitura.pa.gov.br"
                value={dados.email}
                onChange={campo('email')}
              />
              <p className="g-meta text-muted-foreground">Informe o site, o e-mail, ou os dois.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgao-validade">Validade usual (dias)</Label>
              <Input
                id="orgao-validade"
                inputMode="numeric"
                className="g-controle rounded-[var(--g-raio)]"
                placeholder={`1 a ${VALIDADE_MAXIMA_DIAS}`}
                value={dados.validadeDias}
                onChange={campo('validadeDias')}
              />
              <p className="g-meta text-muted-foreground">Vazio: conforme o documento ou o edital.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="orgao-instrucoes">Instruções</Label>
              <Textarea
                id="orgao-instrucoes"
                rows={3}
                placeholder="Ex.: a certidão sai na hora pelo CNPJ; a inscrição municipal é retirada no balcão."
                value={dados.instrucoes}
                onChange={campo('instrucoes')}
              />
            </div>
          </div>

          {erros.length > 0 && (
            <ul role="alert" className="g-corpo list-disc space-y-1 pl-5 text-destructive-ink">
              {erros.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}

          {indisponivel && <p className="g-meta text-warning-ink">{indisponivel}</p>}

          {erro && (
            <AvisoDeFalha aoTentarNovamente={confirmar}>
              Não foi possível gravar o órgão: {erro}
            </AvisoDeFalha>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          {existente && aoRemover && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
              onClick={aoRemover}
              disabled={salvando}
            >
              <Trash2 aria-hidden="true" /> Remover cadastro
            </Button>
          )}
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando || Boolean(indisponivel)}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {existente ? 'Salvar correção' : 'Salvar órgão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
