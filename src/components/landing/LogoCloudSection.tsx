import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, ExternalLink } from 'lucide-react';

import comprasnetLogo from '@/assets/portais/comprasnet.png';
import bllLogo from '@/assets/portais/bll.png';
import becLogo from '@/assets/portais/bec.png';
import bncLogo from '@/assets/portais/bnc.png';
import licitacoesELogo from '@/assets/portais/licitacoes-e.png';
import comprasbrLogo from '@/assets/portais/comprasbr.png';
import portalComprasLogo from '@/assets/portais/portal-compras-publicas.png';
import licitanetLogo from '@/assets/portais/licitanet.png';
import comprasnetBahiaLogo from '@/assets/portais/comprasnet-bahia.png';
import banparanetLogo from '@/assets/portais/banparanet.png';
import comprasGovLogo from '@/assets/portais/compras-gov.png';

type PortalEntry = { name: string; logo?: string; url: string; desc: string };

const portaisComLogo: PortalEntry[] = [
  { name: 'PNCP', logo: comprasnetLogo, url: 'https://pncp.gov.br', desc: 'Portal Nacional de Contratações Públicas' },
  { name: 'Compras Gov', logo: comprasGovLogo, url: 'https://www.gov.br/compras', desc: 'Portal de Compras do Governo Federal' },
  { name: 'BLL Compras', logo: bllLogo, url: 'https://bll.org.br', desc: 'Maior plataforma privada de licitações' },
  { name: 'BEC/SP', logo: becLogo, url: 'https://www.bec.sp.gov.br', desc: 'Bolsa Eletrônica de Compras de São Paulo' },
  { name: 'BNC', logo: bncLogo, url: 'https://bnc.org.br', desc: 'Bolsa Nacional de Compras' },
  { name: 'Licitações-e', logo: licitacoesELogo, url: 'https://licitacoes-e2.bb.com.br', desc: 'Plataforma do Banco do Brasil' },
  { name: 'ComprasBR', logo: comprasbrLogo, url: 'https://comprasbr.com.br', desc: 'Plataforma de compras públicas eletrônicas' },
  { name: 'Portal de Compras', logo: portalComprasLogo, url: 'https://www.portaldecompraspublicas.com.br', desc: 'Portal de Compras Públicas' },
  { name: 'LicitaNet', logo: licitanetLogo, url: 'https://www.licitanet.com.br', desc: 'Plataforma de licitações eletrônicas' },
  { name: 'ComprasNet BA', logo: comprasnetBahiaLogo, url: 'https://www.comprasnet.ba.gov.br', desc: 'Portal de Compras da Bahia' },
  { name: 'Banparanet', logo: banparanetLogo, url: 'https://cotacao.banpara.b.br', desc: 'Portal do Estado do Pará' },
];

const duplicated = [...portaisComLogo, ...portaisComLogo];

export default function LogoCloudSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <section id="portais" className="py-20 md:py-24 px-6 bg-card border-y border-border/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="section-label">Integrações Nativas</p>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Conectado com <span className="text-accent">38 portais</span> de compras públicas
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Monitoramento automatizado em portais federais, estaduais e plataformas privadas homologadas.
          </p>
        </div>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => { setIsPaused(false); setHoveredIndex(null); }}
      >
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-r from-card to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-l from-card to-transparent" />

        <motion.div
          className="flex gap-6 md:gap-8 py-6"
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            x: {
              duration: 45,
              repeat: Infinity,
              ease: 'linear',
              ...(isPaused && { duration: 0 }),
            },
          }}
          style={{
            width: 'max-content',
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {duplicated.map((portal, i) => {
            const isHovered = hoveredIndex === i;

            return (
              <div
                key={`${portal.name}-${i}`}
                className="flex flex-col items-center gap-2 flex-shrink-0 relative"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Card */}
                <motion.div
                  animate={{
                    scale: isHovered ? 1.25 : 1,
                    y: isHovered ? -8 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-xl bg-background border-2 flex items-center justify-center p-3 cursor-pointer transition-all duration-200 ${
                    isHovered
                      ? 'border-accent shadow-xl z-20'
                      : 'border-border/40 shadow-sm hover:shadow-md'
                  }`}
                >
                  {portal.logo ? (
                    <img
                      src={portal.logo}
                      alt={portal.name}
                      className="max-w-full max-h-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <Globe className="w-8 h-8 text-muted-foreground" />
                  )}
                </motion.div>

                {/* Name */}
                <span className={`text-[10px] font-semibold text-center max-w-[100px] transition-colors duration-200 ${
                  isHovered ? 'text-accent' : 'text-muted-foreground/60'
                }`}>
                  {portal.name}
                </span>

                {/* Hover tooltip */}
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute top-full mt-2 z-30 bg-card border border-border rounded-lg shadow-xl p-3.5 w-56 pointer-events-auto"
                  >
                    <p className="text-xs font-bold text-foreground mb-1">{portal.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5">{portal.desc}</p>
                    <a
                      href={portal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent/80 transition-colors"
                    >
                      Visitar portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </motion.div>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Counter badge */}
      <div className="text-center mt-8">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold">
          <Globe className="w-3.5 h-3.5" />
          + 28 portais estaduais e municipais integrados
        </span>
      </div>
    </section>
  );
}
