import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { TRIO_VALOR, FUNCIONALIDADES, PONTOS_IA, ETAPAS } from './dados';

/** Trio de proposta de valor logo abaixo do hero. */
export function TrioValor() {
  return (
    <section className="lp-section" aria-labelledby="trio-titulo">
      <div className="lp-container">
        <div className="lp-sec-head">
          <span className="lp-tag">Por que Praefectus</span>
          <h2 id="trio-titulo" className="lp-h2">
            Menos abas abertas, mais licitações <span className="lp-destaque">ganhas</span>
          </h2>
        </div>
        <div className="lp-trio">
          {TRIO_VALOR.map((item) => (
            <article key={item.titulo} className="lp-card">
              <div className="lp-card__icone" aria-hidden="true">
                <item.icone size={20} />
              </div>
              <h3 className="lp-h4">{item.titulo}</h3>
              <p className="lp-body">{item.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Grid de funcionalidades — cards uniformes, 3 colunas no desktop. */
export function GridFuncionalidades() {
  return (
    <section id="funcionalidades" className="lp-section lp-section--alt" aria-labelledby="func-titulo">
      <div className="lp-container">
        <div className="lp-sec-head">
          <span className="lp-tag">Funcionalidades</span>
          <h2 id="func-titulo" className="lp-h2">Tudo que o licitante usa, em um só lugar</h2>
          <p className="lp-lead">
            Cada módulo conversa com o seguinte: o edital monitorado vira disputa, a vitória
            vira contrato, o contrato vira faturamento — e a meta mede o caminho inteiro.
          </p>
        </div>
        <div className="lp-features">
          {FUNCIONALIDADES.map((f) => (
            <article key={f.titulo} className="lp-card lp-feature">
              <div className="lp-card__icone" aria-hidden="true">
                <f.icone size={20} />
              </div>
              <h3 className="lp-h4">{f.titulo}</h3>
              <p className="lp-body lp-feature__desc">{f.texto}</p>
              <Link
                to="/cadastro"
                className="lp-feature__link"
                aria-label={`Saiba mais sobre ${f.titulo} — criar conta gratuita`}
              >
                saiba mais <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Faixa de destaque da IA, com CTA próprio. */
export function FaixaIA() {
  return (
    <section id="ia" className="lp-section" aria-labelledby="ia-titulo">
      <div className="lp-container">
        <div className="lp-ia">
          <span className="lp-tag">
            <Sparkles size={12} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-1px', marginRight: 6 }} />
            Inteligência artificial
          </span>
          <h2 id="ia-titulo" className="lp-h2" style={{ maxWidth: '18ch' }}>
            A AURÉLIA lê o edital <span className="lp-destaque">antes de você</span>
          </h2>
          <ul className="lp-ia__lista">
            {PONTOS_IA.map((ponto) => (
              <li key={ponto}>{ponto}</li>
            ))}
          </ul>
          <Link to="/cadastro" className="lp-btn lp-btn--solid">
            Analisar meu primeiro edital <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Jornada do licitante em 6 etapas numeradas. */
export function Processo() {
  return (
    <section id="processo" className="lp-section lp-section--alt" aria-labelledby="processo-titulo">
      <div className="lp-container">
        <div className="lp-sec-head">
          <span className="lp-tag">Como funciona</span>
          <h2 id="processo-titulo" className="lp-h2">A jornada completa, em seis etapas</h2>
        </div>
        <ol className="lp-processo" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {ETAPAS.map((etapa, i) => (
            <li key={etapa.titulo} className="lp-card lp-etapa">
              <span className="lp-etapa__num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="lp-h4">{etapa.titulo}</h3>
              <p className="lp-body">{etapa.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
