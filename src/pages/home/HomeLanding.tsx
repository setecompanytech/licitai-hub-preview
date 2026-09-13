import './landing.css';

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, Menu, X, ShieldCheck, Zap, Lock, Award } from 'lucide-react';
import BrandLogo from '@/components/shared/BrandLogo';
import FloatingChat from '@/components/chat/FloatingChat';
import { storeUtmParams } from '@/lib/tracking';
import { GRUPOS_FUNCIONALIDADES, FOOTER_COLUNAS } from './dados';
import { TrioValor, GridFuncionalidades, FaixaIA, Processo } from './SecoesConteudo';
import HeroIlustracao from './HeroIlustracao';
import { Numeros, Depoimentos, Faq } from './SecoesInterativas';

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const botaoDropdownRef = useRef<HTMLButtonElement>(null);

  // Fecha o dropdown com clique fora ou Escape.
  useEffect(() => {
    if (!dropdownAberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Se o foco estava dentro do painel, devolvê-lo ao botão — fechar
      // desmontando o painel jogaria o foco do teclado para o body.
      if (dropdownRef.current?.contains(document.activeElement)) {
        botaoDropdownRef.current?.focus();
      }
      setDropdownAberto(false);
    };
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [dropdownAberto]);

  return (
    <header className="lp-header">
      <div className="lp-container lp-header__in">
        <a href="/" className="lp-header__brand" aria-label="Praefectus — página inicial">
          <BrandLogo className="lp-header__logo" />
        </a>

        <nav className="lp-header__nav" aria-label="Navegação principal">
          <div className="lp-dropdown" ref={dropdownRef}>
            <button
              ref={botaoDropdownRef}
              type="button"
              className="lp-navlink"
              aria-expanded={dropdownAberto}
              onClick={() => setDropdownAberto((v) => !v)}
            >
              Funcionalidades <ChevronDown size={14} aria-hidden="true" />
            </button>
            {dropdownAberto && (
              <div className="lp-dropdown__panel">
                {GRUPOS_FUNCIONALIDADES.map((grupo, gi) => (
                  <div
                    key={grupo.titulo}
                    className="lp-dropdown__grupo"
                    role="group"
                    aria-labelledby={`lp-grupo-${gi}`}
                  >
                    <p id={`lp-grupo-${gi}`} className="lp-dropdown__titulo">{grupo.titulo}</p>
                    {grupo.itens.map((item) => (
                      <a
                        key={item.rotulo}
                        href={item.href}
                        className="lp-dropdown__item"
                        onClick={() => setDropdownAberto(false)}
                      >
                        <item.icone size={15} aria-hidden="true" />
                        {item.rotulo}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link to="/solucoes" className="lp-navlink">Soluções</Link>
          <Link to="/sobre" className="lp-navlink">Sobre</Link>
          <a href="#faq" className="lp-navlink">FAQ</a>
        </nav>

        <div className="lp-header__cta">
          <Link to="/auth" className="lp-btn lp-btn--ghost lp-header__entrar">Entrar</Link>
          <Link to="/contato" className="lp-btn lp-btn--solid lp-header__demo">Ver demonstração</Link>
          <button
            type="button"
            className="lp-menu-btn"
            aria-expanded={menuAberto}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuAberto((v) => !v)}
          >
            {menuAberto ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuAberto && (
        <nav className="lp-menu-mobile" aria-label="Navegação móvel">
          <a href="#funcionalidades" onClick={() => setMenuAberto(false)}>Funcionalidades</a>
          <a href="#ia" onClick={() => setMenuAberto(false)}>Inteligência artificial</a>
          <a href="#processo" onClick={() => setMenuAberto(false)}>Como funciona</a>
          <a href="#faq" onClick={() => setMenuAberto(false)}>FAQ</a>
          <Link to="/sobre" onClick={() => setMenuAberto(false)}>Sobre</Link>
          <Link to="/solucoes" onClick={() => setMenuAberto(false)}>Soluções</Link>
          <Link to="/auth" onClick={() => setMenuAberto(false)}>Entrar</Link>
          <Link to="/contato" onClick={() => setMenuAberto(false)}>Ver demonstração</Link>
        </nav>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <>
      <section className="lp-hero" aria-labelledby="hero-titulo">
        <div className="lp-orb lp-orb--hero-a" aria-hidden="true" />
        <div className="lp-orb lp-orb--hero-b" aria-hidden="true" />
        <div className="lp-container lp-hero__grid">
          <div className="lp-hero__col">
            <p className="lp-eyebrow">Gestão pública, mais oportunidades</p>
            <h1 id="hero-titulo" className="lp-h1">
              Sua próxima<br />
              oportunidade<br />
              <span className="lp-destaque">começa aqui.</span>
            </h1>
            <p className="lp-lead" style={{ maxWidth: '48ch' }}>
              Encontre editais, organize propostas e acompanhe resultados em um
              só lugar.
            </p>
            <div className="lp-hero__acoes">
              <Link to="/auth" className="lp-btn lp-btn--solid lp-btn--lg">
                Explorar plataforma <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/solucoes" className="lp-btn lp-btn--ghost lp-btn--lg">
                Conhecer soluções
              </Link>
            </div>
          </div>
          <HeroIlustracao />
        </div>
      </section>
    </>
  );
}

function Comparativo() {
  const antes = [
    'Verificar 13 portais manualmente todo dia',
    'Planilhas soltas e processos sem rastreamento',
    'Perder prazos por falta de alerta',
    'Propostas calculadas no instinto',
    'Lance manual — usuário precisa ficar na tela',
  ];
  const depois = [
    'Monitoramento automático de 13 portais',
    'Kanban completo do edital ao faturamento',
    'Alertas instantâneos por e-mail e app',
    'Score de aderência por IA antes de entrar',
    'Robô de lances opera 24h sem intervenção',
  ];
  return (
    <section className="lp-section" aria-labelledby="comp-titulo">
      <div className="lp-container">
        <div className="lp-sec-head lp-sec-head--center">
          <span className="lp-tag">Por que mudar</span>
          <h2 id="comp-titulo" className="lp-h2">Antes x Depois do Praefectus</h2>
          <p className="lp-lead">
            A diferença entre quem perde oportunidades e quem fecha contratos é, quase sempre, processo.
          </p>
        </div>
        <div className="lp-comparativo">
          <div className="lp-comp-card lp-comp-card--antes">
            <p className="lp-comp-card__titulo">❌ Sem o Praefectus</p>
            {antes.map(item => (
              <div key={item} className="lp-comp-item">
                <span className="lp-comp-item__ic" aria-hidden="true">✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="lp-comp-card lp-comp-card--depois">
            <p className="lp-comp-card__titulo">✓ Com o Praefectus</p>
            {depois.map(item => (
              <div key={item} className="lp-comp-item">
                <span className="lp-comp-item__ic" aria-hidden="true">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaixaGarantia() {
  return (
    <div className="lp-section" style={{ paddingBlock: '44px', background: 'linear-gradient(180deg, hsl(220 30% 97%) 0%, hsl(220 20% 99%) 100%)', borderBlock: '1px solid var(--lp-border-1)' }}>
      <div className="lp-container">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p className="lp-small" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--lp-text-3)' }}>
            Confiança e segurança em cada etapa
          </p>
        </div>
        <div className="lp-selos">
          <span className="lp-selo"><ShieldCheck size={18} aria-hidden="true" /> LGPD compliance</span>
          <span className="lp-selo"><Lock size={18} aria-hidden="true" /> Dados criptografados</span>
          <span className="lp-selo"><Zap size={18} aria-hidden="true" /> Uptime 99,9%</span>
          <span className="lp-selo"><CheckCircle2 size={18} aria-hidden="true" /> Lei 14.133/2021</span>
          <span className="lp-selo"><Award size={18} aria-hidden="true" /> Suporte dedicado</span>
        </div>
      </div>
    </div>
  );
}

// ─── CTA final + Footer ───────────────────────────────────────────────────────

function CtaFinal() {
  return (
    <section className="lp-cta-dark" aria-labelledby="cta-titulo">
      <div className="lp-cta-dark__orb" aria-hidden="true" />
      <div className="lp-container lp-cta-final">
        <span className="lp-tag">Comece agora</span>
        <h2 id="cta-titulo" className="lp-h2" style={{ color: 'white', maxWidth: '22ch' }}>
          A próxima licitação que você vencer começa{' '}
          <span style={{ color: 'var(--lp-accent-bright)' }}>aqui</span>
        </h2>
        <p className="lp-lead" style={{ color: 'rgba(255,255,255,0.68)', maxWidth: '48ch' }}>
          Configure o perfil da sua empresa, ative o monitoramento e receba
          os editais certos já no primeiro boletim.
        </p>
        <Link to="/auth" className="lp-btn lp-btn--solid lp-btn--lg">
          Entrar na plataforma <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div className="lp-footer__col">
            <a href="/" aria-label="Praefectus — página inicial">
              <BrandLogo variant="dark" width={180} />
            </a>
            <p className="lp-body lp-body--compacto" style={{ maxWidth: '32ch' }}>
              Gestão de licitações com inteligência artificial, do monitoramento
              do edital ao faturamento do contrato.
            </p>
          </div>
          {FOOTER_COLUNAS.map((col) => (
            <nav key={col.titulo} className="lp-footer__col" aria-label={col.titulo}>
              <p className="lp-footer__titulo">{col.titulo}</p>
              {col.links.map((l) =>
                l.href.startsWith('#') ? (
                  <a key={l.rotulo} href={l.href}>{l.rotulo}</a>
                ) : (
                  <Link key={l.rotulo} to={l.href}>{l.rotulo}</Link>
                ),
              )}
            </nav>
          ))}
        </div>
        <div className="lp-footer__base">
          <p className="lp-small">© {new Date().getFullYear()} Praefectus. Todos os direitos reservados.</p>
          <p className="lp-small">Feito para quem vive de licitação.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function HomeLanding() {
  useEffect(() => {
    // A landing antiga gravava as UTMs de campanha na entrada; manter o
    // comportamento para a atribuição de origem não se perder na troca.
    storeUtmParams();
    const anterior = document.title;
    document.title = 'Praefectus — Gestão de Licitações com IA';
    return () => {
      document.title = anterior;
    };
  }, []);

  return (
    <div className="lp">
      <a href="#conteudo" className="lp-skip">Pular para o conteúdo</a>
      <Header />
      <main id="conteudo">
        <Hero />
        <TrioValor />
        <Comparativo />
        <GridFuncionalidades />
        <FaixaIA />
        <Numeros />
        <FaixaGarantia />
        <Processo />
        <Depoimentos />
        <Faq />
        <CtaFinal />
      </main>
      <Footer />
      <FloatingChat isLanding />
    </div>
  );
}
