import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

type PortalEntry = { name: string; logo: string };

const portais: PortalEntry[] = [
  { name: 'PNCP', logo: comprasnetLogo },
  { name: 'Compras Gov', logo: comprasGovLogo },
  { name: 'BLL Compras', logo: bllLogo },
  { name: 'BEC/SP', logo: becLogo },
  { name: 'BNC', logo: bncLogo },
  { name: 'Licitações-e', logo: licitacoesELogo },
  { name: 'ComprasBR', logo: comprasbrLogo },
  { name: 'Portal de Compras', logo: portalComprasLogo },
  { name: 'LicitaNet', logo: licitanetLogo },
  { name: 'ComprasNet BA', logo: comprasnetBahiaLogo },
  { name: 'Banparanet', logo: banparanetLogo },
];

export default function LogoCloudSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Infinite scroll via CSS animation — speed controlled by hover state
  const speed = isHovering ? 60 : 25; // seconds for one full cycle

  // We duplicate items 3x for seamless loop
  const items = [...portais, ...portais, ...portais];

  return (
    <section id="portais" className="py-14 md:py-18 px-6 bg-muted/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="section-label">Integrações</p>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Conectado com <span className="text-accent">38+ portais</span> de compras públicas
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Monitoramento automatizado em portais federais, estaduais e plataformas privadas.
          </p>
        </div>

        {/* Carousel container */}
        <div
          className="relative"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          <div className="overflow-hidden">
            <div
              ref={trackRef}
              className="flex gap-6 md:gap-8 w-max"
              style={{
                animation: `scroll-logos ${speed}s linear infinite`,
              }}
            >
              {items.map((portal, i) => (
                <CarouselLogo key={`${portal.name}-${i}`} portal={portal} />
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold">
            + 28 portais estaduais e municipais integrados
          </span>
        </div>
      </div>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes scroll-logos {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </section>
  );
}

function CarouselLogo({ portal }: { portal: PortalEntry }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex flex-col items-center justify-center gap-2 flex-shrink-0 w-[100px] md:w-[120px] cursor-default select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`w-14 h-14 md:w-16 md:h-16 rounded-xl border flex items-center justify-center transition-all duration-300 ${
          hovered
            ? 'border-accent/30 bg-accent/5 scale-110 shadow-md'
            : 'border-border bg-card scale-100'
        }`}
      >
        <img
          src={portal.logo}
          alt={portal.name}
          className="w-9 h-9 md:w-10 md:h-10 object-contain"
          draggable={false}
        />
      </div>
      <span className={`text-xs md:text-xs font-medium text-center leading-tight transition-colors duration-200 ${
        hovered ? 'text-foreground' : 'text-muted-foreground'
      }`}>
        {portal.name}
      </span>
    </div>
  );
}
