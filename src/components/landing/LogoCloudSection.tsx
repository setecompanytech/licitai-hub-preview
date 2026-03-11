import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Wifi, CheckCircle2 } from 'lucide-react';

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

type PortalEntry = { name: string; logo: string; desc: string };

const portais: PortalEntry[] = [
  { name: 'PNCP', logo: comprasnetLogo, desc: 'Portal Nacional de Contratações Públicas' },
  { name: 'Compras Gov', logo: comprasGovLogo, desc: 'Portal de Compras do Governo Federal' },
  { name: 'BLL Compras', logo: bllLogo, desc: 'Maior plataforma privada de licitações' },
  { name: 'BEC/SP', logo: becLogo, desc: 'Bolsa Eletrônica de Compras de São Paulo' },
  { name: 'BNC', logo: bncLogo, desc: 'Bolsa Nacional de Compras' },
  { name: 'Licitações-e', logo: licitacoesELogo, desc: 'Plataforma do Banco do Brasil' },
  { name: 'ComprasBR', logo: comprasbrLogo, desc: 'Plataforma de compras públicas eletrônicas' },
  { name: 'Portal de Compras', logo: portalComprasLogo, desc: 'Portal de Compras Públicas' },
  { name: 'LicitaNet', logo: licitanetLogo, desc: 'Plataforma de licitações eletrônicas' },
  { name: 'ComprasNet BA', logo: comprasnetBahiaLogo, desc: 'Portal de Compras da Bahia' },
  { name: 'Banparanet', logo: banparanetLogo, desc: 'Portal do Estado do Pará' },
];

export default function LogoCloudSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="portais" className="py-16 md:py-20 px-6 bg-[hsl(215,50%,8%)] overflow-hidden relative">
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent)) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Scan line animation */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent pointer-events-none"
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-[11px] font-bold mb-4 tracking-widest uppercase">
            <Wifi className="w-3 h-3" />
            Integrações Ativas
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Conectado com <span className="text-accent">38 portais</span> de compras públicas
          </h2>
          <p className="text-sm text-white/40 mt-2 max-w-lg mx-auto">
            Monitoramento automatizado em portais federais, estaduais e plataformas privadas homologadas.
          </p>
        </div>

        {/* Tech grid of portals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {portais.map((portal, i) => {
            const isHovered = hoveredIndex === i;

            return (
              <motion.div
                key={portal.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="relative group cursor-default"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className={`relative flex flex-col items-center justify-center gap-2.5 rounded-xl border p-4 h-[100px] transition-all duration-300 ${
                    isHovered
                      ? 'border-accent/50 bg-accent/5 shadow-[0_0_20px_hsl(var(--accent)/0.15)]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  {/* Status dot */}
                  <div className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                    isHovered ? 'bg-accent animate-pulse' : 'bg-emerald-500/60'
                  }`} />

                  <img
                    src={portal.logo}
                    alt={portal.name}
                    className={`w-9 h-9 object-contain transition-all duration-300 ${
                      isHovered ? 'brightness-110 scale-110' : 'brightness-90 opacity-70'
                    }`}
                    draggable={false}
                  />

                  <span className={`text-[10px] font-semibold text-center leading-tight transition-colors duration-300 ${
                    isHovered ? 'text-white' : 'text-white/50'
                  }`}>
                    {portal.name}
                  </span>

                  {/* Hover tooltip */}
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap px-3 py-1.5 rounded-md bg-foreground text-background text-[10px] font-medium shadow-lg"
                    >
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {portal.desc}
                      </div>
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Counter badge */}
        <div className="text-center mt-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold">
            <Zap className="w-3.5 h-3.5" />
            + 28 portais estaduais e municipais integrados
          </span>
        </div>
      </div>
    </section>
  );
}
