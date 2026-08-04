import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { NUMEROS, DEPOIMENTOS, FAQ } from './dados';

const reduzMovimento = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Números com contadores animados ─────────────────────────────────────────

function Contador({ valor, sufixo = '', ativo }: { valor: number; sufixo?: string; ativo: boolean }) {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (!ativo) return;
    // Com movimento reduzido (ou re-visita), o valor final entra direto.
    if (reduzMovimento()) {
      setAtual(valor);
      return;
    }
    const duracao = 1200;
    let inicio: number | null = null;
    let quadro: number;
    const passo = (t: number) => {
      if (inicio === null) inicio = t;
      const progresso = Math.min(1, (t - inicio) / duracao);
      const suave = 1 - Math.pow(1 - progresso, 3); // easeOutCubic
      setAtual(Math.round(valor * suave));
      if (progresso < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [ativo, valor]);

  return (
    <span className="lp-numero__valor">
      {/* O número animado é decorativo: leitor de tela recebe sempre o valor final. */}
      <span aria-hidden="true">
        {atual.toLocaleString('pt-BR')}
        {sufixo}
      </span>
      <span className="sr-only">
        {valor.toLocaleString('pt-BR')}
        {sufixo}
      </span>
    </span>
  );
}

export function Numeros() {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const alvo = ref.current;
    if (!alvo) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true);
          observador.disconnect(); // anima uma vez só
        }
      },
      { threshold: 0.3 },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  return (
    <section className="lp-section" aria-labelledby="numeros-titulo">
      <div className="lp-container">
        <h2 id="numeros-titulo" className="sr-only">Praefectus em números</h2>
        <div ref={ref} className="lp-numeros">
          {NUMEROS.map((n) => (
            <div key={n.rotulo}>
              <Contador valor={n.valor} sufixo={n.sufixo} ativo={visivel} />
              <p className="lp-numero__rotulo">{n.rotulo}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Depoimentos — carrossel acessível ────────────────────────────────────────

const INTERVALO_MS = 7000;

export function Depoimentos() {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  // WCAG 2.2.2: hover/foco são pausas transitórias; este estado é a pausa
  // PERSISTENTE — botão dedicado, e qualquer interação também desliga.
  const [autoplayLigado, setAutoplayLigado] = useState(true);
  const total = DEPOIMENTOS.length;

  const irPara = useCallback((i: number) => setIndice(((i % total) + total) % total), [total]);

  /** Navegação manual assume o controle: a rotação automática não volta. */
  const irManual = useCallback((i: number) => {
    setAutoplayLigado(false);
    irPara(i);
  }, [irPara]);

  useEffect(() => {
    if (!autoplayLigado || pausado || reduzMovimento()) return;
    const id = window.setInterval(() => setIndice((i) => (i + 1) % total), INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [autoplayLigado, pausado, total]);

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); irManual(indice - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); irManual(indice + 1); }
  };

  const girando = autoplayLigado && !pausado && !reduzMovimento();

  return (
    <section className="lp-section lp-section--alt" aria-labelledby="depo-titulo">
      <div className="lp-container">
        <div className="lp-sec-head" style={{ marginInline: 'auto', textAlign: 'center' }}>
          <span className="lp-tag">Quem usa</span>
          <h2 id="depo-titulo" className="lp-h2">O dia a dia de quem licita com o Praefectus</h2>
        </div>

        <div
          className="lp-carrossel"
          role="group"
          aria-roledescription="carrossel"
          aria-label="Depoimentos de clientes"
          tabIndex={0}
          onKeyDown={aoTeclar}
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
          onFocus={() => setPausado(true)}
          onBlur={() => setPausado(false)}
        >
          {/* live=off enquanto gira sozinho (APG): anunciar cada troca automática
              interromperia a leitura do resto da página a cada 7s. */}
          <div className="lp-carrossel__viewport" aria-live={girando ? 'off' : 'polite'}>
            {DEPOIMENTOS.map((d, i) => (
              <figure
                key={d.texto}
                className="lp-depoimento"
                data-ativo={i === indice}
                aria-hidden={i !== indice}
              >
                <blockquote className="lp-depoimento__texto">{d.texto}</blockquote>
                <figcaption className="lp-depoimento__autor">
                  <span className="lp-depoimento__avatar" aria-hidden="true">{d.iniciais}</span>
                  <span style={{ textAlign: 'left' }}>
                    <span className="lp-body" style={{ display: 'block', color: 'var(--lp-text-1)', fontWeight: 600 }}>
                      {d.nome}
                    </span>
                    <span className="lp-small">{d.cargo}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="lp-carrossel__controles">
            <button
              type="button"
              className="lp-carrossel__seta"
              onClick={() => irManual(indice - 1)}
              aria-label="Depoimento anterior"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <div className="lp-carrossel__pontos">
              {DEPOIMENTOS.map((d, i) => (
                <button
                  key={d.texto}
                  type="button"
                  aria-label={`Ir para depoimento ${i + 1} de ${total}`}
                  aria-current={i === indice}
                  className="lp-carrossel__ponto"
                  data-ativo={i === indice}
                  onClick={() => irManual(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="lp-carrossel__seta"
              onClick={() => irManual(indice + 1)}
              aria-label="Próximo depoimento"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lp-carrossel__seta"
              onClick={() => setAutoplayLigado((v) => !v)}
              aria-label={autoplayLigado ? 'Pausar a rotação automática' : 'Retomar a rotação automática'}
            >
              {autoplayLigado
                ? <Pause size={16} aria-hidden="true" />
                : <Play size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ — acordeão com um item aberto por vez + JSON-LD ─────────────────────

export function Faq() {
  const [aberta, setAberta] = useState<number>(0);

  // schema.org FAQPage — gerado dos mesmos dados exibidos, nunca divergem.
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  });

  return (
    <section id="faq" className="lp-section" aria-labelledby="faq-titulo">
      <div className="lp-container">
        <div className="lp-sec-head" style={{ marginInline: 'auto', textAlign: 'center' }}>
          <span className="lp-tag">Dúvidas</span>
          <h2 id="faq-titulo" className="lp-h2">Perguntas frequentes</h2>
        </div>
        <div className="lp-faq">
          {FAQ.map((f, i) => {
            const abertaAgora = aberta === i;
            return (
              <div key={f.pergunta} className="lp-faq__item">
                <h3 style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="lp-faq__pergunta"
                    aria-expanded={abertaAgora}
                    aria-controls={`faq-resposta-${i}`}
                    id={`faq-pergunta-${i}`}
                    onClick={() => setAberta(abertaAgora ? -1 : i)}
                  >
                    {f.pergunta}
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                </h3>
                <div
                  id={`faq-resposta-${i}`}
                  // region só no painel aberto: 7 landmarks permanentes poluiriam
                  // a navegação por regiões do leitor de tela (nota do APG).
                  role={abertaAgora ? 'region' : undefined}
                  aria-labelledby={`faq-pergunta-${i}`}
                  className="lp-faq__resposta"
                  data-aberta={abertaAgora}
                >
                  <div>
                    <p>{f.resposta}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </section>
  );
}
