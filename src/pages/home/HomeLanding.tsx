import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import './landing.css';

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, Menu, X } from 'lucide-react';
import FloatingChat from '@/components/chat/FloatingChat';
import { storeUtmParams } from '@/lib/tracking';
import { BULLETS_HERO, GRUPOS_FUNCIONALIDADES, FOOTER_COLUNAS } from './dados';
import { TrioValor, GridFuncionalidades, FaixaIA, Processo } from './SecoesConteudo';
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
        <a href="/" className="lp-header__brand">PRAEFECTUS</a>

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
          <Link to="/auth" className="lp-btn lp-btn--ghost">Entrar</Link>
          <Link to="/cadastro" className="lp-btn lp-btn--solid">Começar grátis</Link>
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
        </nav>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

/**
 * Mockup do Kanban em CSS puro dentro de moldura de browser.
 * 0 KB de imagem, nítido em qualquer densidade e sem layout shift
 * (o aspect-ratio reserva a área antes da pintura).
 */
function MockupKanban() {
  const colunas: { nome: string; qtd: number; cards: { chip?: 'disputa' | 'ok' | 'neutro'; chipTexto?: string; valor: string }[] }[] = [
    {
      nome: 'Proposta Enviada',
      qtd: 4,
      cards: [
        { valor: 'R$ 300.000' },
        { chip: 'neutro', chipTexto: 'PNCP', valor: 'R$ 92.400' },
      ],
    },
    {
      nome: 'Em Disputa',
      qtd: 2,
      cards: [
        { chip: 'disputa', chipTexto: 'ROBÔ ATIVO', valor: 'R$ 148.700' },
        { valor: 'R$ 61.000' },
      ],
    },
    {
      nome: 'Vencida',
      qtd: 3,
      cards: [
        { chip: 'ok', chipTexto: 'HOMOLOGADA', valor: 'R$ 512.300' },
        { valor: 'R$ 87.150' },
      ],
    },
  ];

  return (
    <div className="lp-browser" role="img" aria-label="Ilustração do Kanban de licitações do Praefectus, com processos em Proposta Enviada, Em Disputa e Vencida">
      <div className="lp-browser__bar" aria-hidden="true">
        <span className="lp-browser__dots"><span /><span /><span /></span>
        <span className="lp-browser__url">app.praefectus.com.br/kanban</span>
      </div>
      <div className="lp-browser__body" aria-hidden="true">
        {colunas.map((col) => (
          <div key={col.nome} className="lp-kb-col">
            <span className="lp-kb-col__head">
              {col.nome} <em>{col.qtd}</em>
            </span>
            {col.cards.map((card, i) => (
              <div key={i} className="lp-kb-card">
                <span className="lp-kb-card__linha" />
                <span className="lp-kb-card__linha lp-kb-card__linha--curta" />
                <span className="lp-kb-card__meta">
                  <span className="lp-kb-card__valor">{card.valor}</span>
                  {card.chipTexto && (
                    <span className={`lp-kb-chip${card.chip === 'ok' ? ' lp-kb-chip--ok' : card.chip === 'neutro' ? ' lp-kb-chip--neutro' : ''}`}>
                      {card.chipTexto}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="hero-titulo">
      <div className="lp-container lp-hero__grid">
        <div className="lp-hero__col">
          <span className="lp-tag">Plataforma completa · Lei 14.133/2021</span>
          <h1 id="hero-titulo" className="lp-h1">
            <span className="lp-destaque">Licitações com IA</span>, do edital ao faturamento
          </h1>
          <p className="lp-lead">
            Monitore, analise, dispute e fature em uma única plataforma — com metas que
            mostram se o mês fecha antes de ele acabar.
          </p>
          <ul className="lp-hero__bullets">
            {BULLETS_HERO.map((b) => (
              <li key={b.texto}>
                <CheckCircle2 size={16} aria-hidden="true" />
                {b.texto}
              </li>
            ))}
          </ul>
          <div className="lp-hero__acoes">
            <Link to="/cadastro" className="lp-btn lp-btn--solid lp-btn--lg">
              Começar grátis <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="#funcionalidades" className="lp-btn lp-btn--ghost lp-btn--lg">
              Ver funcionalidades
            </a>
          </div>
        </div>
        <MockupKanban />
      </div>
    </section>
  );
}

// ─── CTA final + Footer ───────────────────────────────────────────────────────

function CtaFinal() {
  return (
    <section className="lp-section lp-section--alt" aria-labelledby="cta-titulo">
      <div className="lp-container lp-cta-final">
        <h2 id="cta-titulo" className="lp-h2" style={{ maxWidth: '22ch' }}>
          Sua próxima licitação começa <span className="lp-destaque">monitorada</span>
        </h2>
        <p className="lp-lead" style={{ maxWidth: '46ch' }}>
          Crie a conta, cadastre o perfil da sua empresa e receba os editais certos
          já no primeiro boletim.
        </p>
        <Link to="/cadastro" className="lp-btn lp-btn--solid lp-btn--lg">
          Começar grátis <ArrowRight size={16} aria-hidden="true" />
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
            <a href="/" className="lp-header__brand">PRAEFECTUS</a>
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
        <GridFuncionalidades />
        <FaixaIA />
        <Numeros />
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
