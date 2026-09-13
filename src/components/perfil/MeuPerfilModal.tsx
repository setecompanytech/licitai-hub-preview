import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAvatarUrl } from '@/hooks/useAvatarPerfil';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Bell, Building2, CreditCard, KeyRound, ShieldCheck, User, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TituloHub } from './PerfilPrimitivos';
import SecaoPerfil from './secoes/SecaoPerfil';
import SecaoEmpresa from './secoes/SecaoEmpresa';
import SecaoRepresentante from './secoes/SecaoRepresentante';
import SecaoUsuarios from './secoes/SecaoUsuarios';
import SegurancaConta from '@/components/configuracoes/SegurancaConta';
import PlanoAssinatura from '@/components/configuracoes/PlanoAssinatura';

/**
 * Hub de perfil — o desenho do protótipo (index.html:13700-13760).
 *
 * Era um modal de três campos. Virou o painel de sete seções que o protótipo
 * desenhou: identidade, empresa, quem assina, quem tem acesso, preferências,
 * segurança e assinatura.
 *
 * A REGRA QUE MANTÉM ISTO HONESTO: nenhuma seção reimplementa fluxo que já
 * existe em tela própria.
 *
 *   Segurança e Assinatura  → montam os MESMOS componentes das Configurações
 *   Usuários de acesso      → lista, e manda para a Equipe para conceder acesso
 *   Notificações            → leva para a tela de alertas
 *
 * Copiar esses fluxos para dentro do modal daria duas verdades sobre os mesmos
 * dados — e no caso de permissão de acesso, dois lugares para conceder o que
 * só deveria ser concedido num.
 *
 * Nenhuma coluna nova de banco: tudo aqui lê e escreve o que já existia.
 * "Celular" do protótipo ficou de fora — `profiles` tem `telefone`, e campo
 * que aceita digitação sem ter onde guardar é mentira na cara do usuário.
 */

type Chave = 'perfil' | 'empresa' | 'representante' | 'usuarios' | 'notificacoes' | 'seguranca' | 'assinatura';

type Secao = {
  chave: Chave;
  rotulo: string;
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  /** Seção que não vive aqui dentro: o clique leva para a tela dela. */
  rota?: string;
};

const GRUPOS: { titulo: string; secoes: Secao[] }[] = [
  {
    titulo: 'Minha conta',
    secoes: [
      { chave: 'perfil', rotulo: 'Meu perfil', icone: ShieldCheck,
        titulo: 'Meu perfil', descricao: 'Dados usados nas propostas, nos documentos gerados e no login.' },
      { chave: 'empresa', rotulo: 'Dados da empresa', icone: Building2,
        titulo: 'Dados da empresa', descricao: 'Identificação, contato e endereço da empresa ativa.' },
      { chave: 'representante', rotulo: 'Representante legal', icone: User,
        titulo: 'Representante legal', descricao: 'Quem assina pela empresa nas declarações e procurações.' },
      { chave: 'usuarios', rotulo: 'Usuários de acesso', icone: Users,
        titulo: 'Usuários de acesso', descricao: 'Quem entra nesta empresa e com que papel.' },
    ],
  },
  {
    titulo: 'Preferências',
    secoes: [
      { chave: 'notificacoes', rotulo: 'Notificações', icone: Bell,
        titulo: 'Notificações', descricao: 'Quais alertas você recebe e por onde.',
        rota: '/configuracoes/alertas' },
      { chave: 'seguranca', rotulo: 'Segurança', icone: KeyRound,
        titulo: 'Segurança', descricao: 'Senha, verificação em duas etapas e sessões ativas.' },
    ],
  },
  {
    titulo: 'Assinatura',
    secoes: [
      { chave: 'assinatura', rotulo: 'Minha assinatura', icone: CreditCard,
        titulo: 'Minha assinatura', descricao: 'Plano atual, limites e cobrança.' },
    ],
  },
];

const TODAS = GRUPOS.flatMap(g => g.secoes);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function MeuPerfilModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [ativa, setAtiva] = useState<Chave>('perfil');
  const avatarUrl = useAvatarUrl();

  // Reabrir sempre no perfil: quem clica no avatar quer os próprios dados, não
  // a última aba onde parou há três dias.
  useEffect(() => { if (open) setAtiva('perfil'); }, [open]);

  const nome = user?.user_metadata?.nome_completo || user?.email || '';
  const email = user?.email ?? '';
  const iniciais = (nome || email).split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const secao = TODAS.find(s => s.chave === ativa) ?? TODAS[0];

  function escolher(s: Secao) {
    if (s.rota) { onOpenChange(false); navigate(s.rota); return; }
    setAtiva(s.chave);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {/* Cabeçalho claro (identidade 12/09): navy só no texto, verde só no
            ladrilho do avatar. A empresa ativa lê em verde por ser o contexto
            que muda o que as seções abaixo editam. */}
        <div className="flex flex-shrink-0 items-center gap-4 border-b border-border bg-card px-6 py-4 pr-14">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-tint text-base font-bold text-primary">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : iniciais}
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg font-semibold text-foreground">{nome}</DialogTitle>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            {empresaAtiva && (
              <p className="mt-1 flex items-center gap-2 truncate text-xs font-semibold uppercase tracking-wider text-primary">
                <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {empresaAtiva.nome_fantasia || empresaAtiva.razao_social}
              </p>
            )}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[236px_1fr]">
          <nav className="overflow-y-auto border-b border-border bg-muted p-3 md:border-b-0 md:border-r" aria-label="Seções do perfil">
            {GRUPOS.map(grupo => (
              <div key={grupo.titulo} className="mb-4 last:mb-0">
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {grupo.titulo}
                </p>
                {grupo.secoes.map(s => {
                  const Icone = s.icone;
                  const selecionada = s.chave === ativa && !s.rota;
                  return (
                    <button
                      key={s.chave}
                      type="button"
                      onClick={() => escolher(s)}
                      aria-current={selecionada ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        selecionada
                          ? 'bg-primary-tint font-semibold text-primary'
                          : 'text-foreground hover:bg-background',
                      )}
                    >
                      <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{s.rotulo}</span>
                      {/* A seta avisa, antes do clique, que esta sai do modal. */}
                      {s.rota && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="min-w-0 overflow-y-auto bg-card p-6">
            <TituloHub titulo={secao.titulo} descricao={secao.descricao} />

            {ativa === 'perfil' && <SecaoPerfil />}
            {ativa === 'empresa' && <SecaoEmpresa />}
            {ativa === 'representante' && <SecaoRepresentante />}
            {ativa === 'usuarios' && <SecaoUsuarios />}
            {ativa === 'seguranca' && <SegurancaConta />}
            {ativa === 'assinatura' && <PlanoAssinatura />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
