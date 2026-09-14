import { Bell, Building2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { AvisoDeFalha, ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import CredenciaisPortalForm from '@/components/robo-lances/CredenciaisPortalForm';
import AtivacaoChecklist from '@/components/robo-lances/AtivacaoChecklist';
import { formatCNPJ } from '@/lib/financeiro/formatters';
// A mesma peça da faixa de avisos e da prévia do Admin — ver `AvisosDosPortais`.
import AvisoAoCliente from '@/components/admin-robo/AvisoAoCliente';
import type { AvisoDoPortal } from './robo-do-cliente';

/**
 * A faixa da empresa: de QUEM é este robô, e os dois atalhos da empresa.
 *
 * Quem administra várias empresas troca a ativa no topo do app — e disputar
 * pelo CNPJ errado é o erro mais caro que esta tela permite. Por isso CNPJ e
 * razão social ficam visíveis aqui, sem clique.
 *
 * "Gerenciar portais" reúne o que é da empresa: o acesso a cada portal e o
 * certificado digital. Substitui a antiga aba Portais, que misturava isso com o
 * healthcheck dos endereços — assunto da operação Praefectus, não do cliente.
 *
 * "Avisos" lista tudo o que a operação publicou e está vigente, inclusive dos
 * portais em que a empresa ainda não disputa. A faixa acima do painel mostra só
 * os que se aplicam às disputas dela.
 */
type EmpresaDaFaixa = {
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
} | null;

type Props = {
  empresa: EmpresaDaFaixa;
  isAdmin: boolean;
  avisos: AvisoDoPortal[];
  erroDosAvisos: string | null;
  aoRecarregarAvisos: () => void;
};

export default function FaixaDaEmpresa({ empresa, isAdmin, avisos, erroDosAvisos, aoRecarregarAvisos }: Props) {
  const nome = empresa?.razao_social?.trim() || empresa?.nome_fantasia?.trim() || null;

  return (
    <section
      aria-label="Empresa do robô"
      data-faixa="empresa"
      className="g-cartao flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--g-raio)] bg-primary-tint text-primary"
        >
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="g-corpo truncate font-semibold text-foreground">
            {empresa ? nome ?? <ValorIndisponivel razao="Empresa sem razão social cadastrada" /> : (
              <ValorIndisponivel razao="Nenhuma empresa ativa selecionada" />
            )}
          </p>
          <p className="g-meta tabular-nums text-muted-foreground">
            CNPJ{' '}
            {empresa?.cnpj ? formatCNPJ(empresa.cnpj) : <ValorIndisponivel razao="CNPJ não cadastrado" />}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={!empresa} className="max-sm:flex-1">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Gerenciar portais
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Acesso da empresa aos portais</DialogTitle>
              <DialogDescription>
                O login de cada portal e o certificado digital que o robô usa para entrar em nome
                de {nome ?? 'sua empresa'}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {isAdmin ? (
                <CredenciaisPortalForm />
              ) : (
                <p className="g-corpo rounded-md border border-dashed border-border px-3 py-2 text-muted-foreground">
                  Só o administrador da empresa cadastra ou altera o acesso aos portais e o
                  certificado digital — são credenciais da empresa. Você vê a situação abaixo; para
                  mudar, peça a um administrador em Equipe → Permissões.
                </p>
              )}
              <AtivacaoChecklist modo="cliente" somenteLeitura={!isAdmin} />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="max-sm:flex-1">
              <Bell className="h-4 w-4" aria-hidden="true" />
              Avisos
              {avisos.length > 0 && (
                <Badge variant="warning" className="ml-0.5 tabular-nums">
                  {avisos.length}
                  <span className="sr-only"> {avisos.length === 1 ? 'aviso ativo' : 'avisos ativos'}</span>
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Avisos da operação</DialogTitle>
              <DialogDescription>
                Publicados pela equipe Praefectus sobre os portais e o robô. Somem sozinhos quando
                a situação se normaliza.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {erroDosAvisos && <AvisoDeFalha aoTentarNovamente={aoRecarregarAvisos}>{erroDosAvisos}</AvisoDeFalha>}
              {!erroDosAvisos && avisos.length === 0 && (
                <p className="g-corpo text-muted-foreground">Nenhum aviso ativo no momento.</p>
              )}
              {avisos.map((aviso) => (
                <AvisoAoCliente
                  key={aviso.id}
                  severidade={aviso.severidade}
                  titulo={aviso.titulo}
                  mensagem={aviso.mensagem}
                  portalId={aviso.portal_id}
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
