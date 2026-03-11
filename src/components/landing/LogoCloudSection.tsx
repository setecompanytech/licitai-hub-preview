import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, CheckCircle2, Zap } from 'lucide-react';

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

type PortalEntry = { name: string; logo?: string; url: string; desc: string; status: string };

const portaisComLogo: PortalEntry[] = [
  { name: 'PNCP', logo: comprasnetLogo, url: 'https://pncp.gov.br', desc: 'Portal Nacional de Contratações Públicas', status: 'Integração ativa' },
  { name: 'Compras Gov', logo: comprasGovLogo, url: 'https://www.gov.br/compras', desc: 'Portal de Compras do Governo Federal', status: 'Integração ativa' },
  { name: 'BLL Compras', logo: bllLogo, url: 'https://bll.org.br', desc: 'Maior plataforma privada de licitações', status: 'Integração ativa' },
  { name: 'BEC/SP', logo: becLogo, url: 'https://www.bec.sp.gov.br', desc: 'Bolsa Eletrônica de Compras de São Paulo', status: 'Integração ativa' },
  { name: 'BNC', logo: bncLogo, url: 'https://bnc.org.br', desc: 'Bolsa Nacional de Compras', status: 'Integração ativa' },
  { name: 'Licitações-e', logo: licitacoesELogo, url: 'https://licitacoes-e2.bb.com.br', desc: 'Plataforma do Banco do Brasil', status: 'Integração ativa' },
  { name: 'ComprasBR', logo: comprasbrLogo, url: 'https://comprasbr.com.br', desc: 'Plataforma de compras públicas eletrônicas', status: 'Integração ativa' },
  { name: 'Portal de Compras', logo: portalComprasLogo, url: 'https://www.portaldecompraspublicas.com.br', desc: 'Portal de Compras Públicas', status: 'Integração ativa' },
  { name: 'LicitaNet', logo: licitanetLogo, url: 'https://www.licitanet.com.br', desc: 'Plataforma de licitações eletrônicas', status: 'Integração ativa' },
  { name: 'ComprasNet BA', logo: comprasnetBahiaLogo, url: 'https://www.comprasnet.ba.gov.br', desc: 'Portal de Compras da Bahia', status: 'Integração ativa' },
  { name: 'Banparanet', logo: banparanetLogo, url: 'https://cotacao.banpara.b.br', desc: 'Portal do Estado do Pará', status: 'Integração ativa' },
];

const duplicated = [...portaisComLogo, ...portaisComLogo];

export default function LogoCloudSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section id="portais" className="py-16 md:py-20 px-6 bg-card border-y border-border/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="section-label">Integrações Nativas</p>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Conectado com <span className="text-accent">38 portais</span> de compras públicas
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Monitoramento automatizado em portais federais, estaduais e plataformas privadas homologadas.
          </p>
        </div>
      </div>

      <div ref={containerRef} className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none bg-gradient-to-r from-card to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none bg-gradient-to-l from-card to-transparent" />

        <div
          className="flex gap-5 md:gap-6 py-4 animate-marquee hover:[animation-play-state:paused]"
          style={{ width: 'max-content' }}
        >
          {duplicated.map((portal, i) => {
            const isHovered = hoveredIndex === i;

            return (
              <a
                key={`${portal.name}-${i}`}
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 group relative"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <motion.div
                  layout
                  className={`relative flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all duration-300 cursor-pointer ${
                    isHovered
                      ? 'border-accent/50 shadow-lg ring-1 ring-accent/20'
                      : 'border-border/40 shadow-sm'
                  }`}
                  style={{ minWidth: isHovered ? 220 : 56 }}
                >
                  {/* Logo */}
                  <div className={`flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
                    isHovered ? 'w-10 h-10' : 'w-10 h-10'
                  }`}>
                    {portal.logo ? (
                      <img
                        src={portal.logo}
                        alt={portal.name}
                        className={`object-contain transition-all duration-300 ${
                          isHovered ? 'w-10 h-10' : 'w-9 h-9 opacity-70 group-hover:opacity-100'
                        }`}
                        draggable={false}
                      />
                    ) : (
                      <Globe className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>

                  {/* Expanded info — slides in */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        <div className="flex flex-col pr-2">
                          <span className="text-xs font-bold text-foreground leading-tight">
                            {portal.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            {portal.desc}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent mt-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {portal.status}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Subtle glow on hover */}
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 rounded-xl bg-accent/[0.03] pointer-events-none"
                    />
                  )}
                </motion.div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Counter badge */}
      <div className="text-center mt-8">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold">
          <Zap className="w-3.5 h-3.5" />
          + 28 portais estaduais e municipais integrados
        </span>
      </div>
    </section>
  );
}
