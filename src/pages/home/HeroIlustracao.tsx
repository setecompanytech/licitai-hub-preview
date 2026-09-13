import { Check, Home, Search, FileText, CalendarDays, BarChart3, Settings } from 'lucide-react';
import BrandLogo from '@/components/shared/BrandLogo';

/**
 * Ilustração do hero (prancha aprovada 12/09): documentos de edital, check
 * verde e uma prévia do painel com a sidebar navy — em CSS puro, PLANA (sem
 * moldura de navegador, celular ou perspectiva: isso era apresentação do
 * conceito, não estrutura da página). Todo número aqui é decorativo, e o
 * painel carrega o selo "Demonstração" para ninguém ler como dado real.
 */
export default function HeroIlustracao() {
  const nav = [
    { icone: Home, rotulo: 'Visão geral', ativo: true },
    { icone: Search, rotulo: 'Oportunidades' },
    { icone: FileText, rotulo: 'Propostas' },
    { icone: CalendarDays, rotulo: 'Prazos' },
    { icone: BarChart3, rotulo: 'Relatórios' },
    { icone: Settings, rotulo: 'Configurações' },
  ];

  return (
    <div
      className="lp-ilu"
      role="img"
      aria-label="Ilustração: documentos de edital com um check verde e uma prévia demonstrativa do painel do Praefectus"
    >
      <div className="lp-ilu__brilho" aria-hidden="true" />

      <div className="lp-ilu__docs" aria-hidden="true">
        {['lp-ilu__doc--a', 'lp-ilu__doc--b', 'lp-ilu__doc--c'].map((k) => (
          <div key={k} className={`lp-ilu__doc ${k}`}>
            <span className="lp-ilu__doc-titulo">Edital</span>
            <span className="lp-ilu__linha" />
            <span className="lp-ilu__linha lp-ilu__linha--m" />
            <span className="lp-ilu__linha" />
            <span className="lp-ilu__linha lp-ilu__linha--c" />
          </div>
        ))}
        <span className="lp-ilu__check">
          <Check size={30} strokeWidth={3.2} />
        </span>
      </div>

      <div className="lp-ilu__painel" aria-hidden="true">
        <aside className="lp-ilu__side">
          <BrandLogo variant="dark" width={92} />
          <ul>
            {nav.map((n) => (
              <li key={n.rotulo} className={n.ativo ? 'is-ativo' : undefined}>
                <n.icone size={12} />
                <span>{n.rotulo}</span>
              </li>
            ))}
          </ul>
        </aside>
        <div className="lp-ilu__conteudo">
          <div className="lp-ilu__topo">
            <strong>Visão geral</strong>
            <span className="lp-ilu__selo">Demonstração</span>
          </div>
          <div className="lp-ilu__kpis">
            {['Oportunidades', 'Propostas', 'Prazos'].map((t) => (
              <div key={t} className="lp-ilu__kpi">
                <span className="lp-ilu__kpi-ic" />
                <span className="lp-ilu__kpi-rotulo">{t}</span>
                <span className="lp-ilu__linha lp-ilu__linha--c" />
              </div>
            ))}
          </div>
          <div className="lp-ilu__blocos">
            <div className="lp-ilu__lista">
              <span className="lp-ilu__bloco-titulo">Oportunidades recentes</span>
              {['a', 'b', 'c'].map((k) => (
                <span key={k} className={`lp-ilu__item lp-ilu__item--${k}`}>
                  <i />
                  <span className="lp-ilu__linha" />
                </span>
              ))}
            </div>
            <div className="lp-ilu__donut-card">
              <span className="lp-ilu__bloco-titulo">Status das propostas</span>
              <span className="lp-ilu__donut" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
