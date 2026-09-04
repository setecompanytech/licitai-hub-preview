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
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden max-h-[88vh] flex flex-col">
        {/* O cabeçalho é navy nos dois temas, como a barra do topo: é a moldura
            da marca, e é sobre ele que o dourado do nome da empresa lê. */}
        <div className="bg-navy px-6 py-5 flex items-center gap-4 flex-shrink-0">
          <span className="w-12 h-12 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center text-base font-bold shrink-0 overflow-hidden">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : iniciais}
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-white text-base font-bold truncate">{nome}</DialogTitle>
            <p className="text-sm text-white/70 truncate">{email}</p>
            {empresaAtiva && (
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-logo mt-1 truncate">
                <Building2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                {empresaAtiva.nome_fantasia || empresaAtiva.razao_social}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid md:grid-cols-[236px_1fr]">
          <nav className="border-b md:border-b-0 md:border-r border-border bg-muted/40 p-3 overflow-y-auto">
            {GRUPOS.map(grupo => (
              <div key={grupo.titulo} className="mb-4 last:mb-0">
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {grupo.titulo}
                </p>
                {grupo.secoes.map(s => {
                  const Icone = s.icone;
                  const selecionada = s.chave === ativa && !s.rota;
                  return (
                    <button
                      key={s.chave}
                      onClick={() => escolher(s)}
                      aria-current={selecionada ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
                        selecionada
                          ? 'bg-card text-accent font-semibold shadow-sm'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <Icone className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate flex-1">{s.rotulo}</span>
                      {/* A seta avisa, antes do clique, que esta sai do modal. */}
                      {s.rota && <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="p-6 overflow-y-auto min-w-0">
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
