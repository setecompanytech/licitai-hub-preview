import { motion } from 'framer-motion';

import comprasnetLogo from '@/assets/portais/comprasnet.png';
import bllLogo from '@/assets/portais/bll.png';
import becLogo from '@/assets/portais/bec.png';
import bncLogo from '@/assets/portais/bnc.png';
import licitacoesELogo from '@/assets/portais/licitacoes-e.png';
import comprasbrLogo from '@/assets/portais/comprasbr.png';
import portalComprasLogo from '@/assets/portais/portal-compras-publicas.png';
import licitanetLogo from '@/assets/portais/licitanet.png';

const portais = [
  { name: 'Comprasnet', logo: comprasnetLogo, color: '#003E7E', glow: 'rgba(0,62,126,0.3)' },
  { name: 'BLL Compras', logo: bllLogo, color: '#0D6B5E', glow: 'rgba(13,107,94,0.3)' },
  { name: 'BEC/SP', logo: becLogo, color: '#007B9E', glow: 'rgba(0,123,158,0.3)' },
  { name: 'BNC', logo: bncLogo, color: '#1A0A7A', glow: 'rgba(26,10,122,0.3)' },
  { name: 'Licitações-E', logo: licitacoesELogo, color: '#F5C518', glow: 'rgba(245,197,24,0.3)' },
  { name: 'ComprasBR', logo: comprasbrLogo, color: '#7AB929', glow: 'rgba(122,185,41,0.3)' },
  { name: 'Portal de Compras Públicas', logo: portalComprasLogo, color: '#F5A623', glow: 'rgba(245,166,35,0.3)' },
  { name: 'LicitaNet', logo: licitanetLogo, color: '#2563EB', glow: 'rgba(37,99,235,0.3)' },
];

export default function LogoCloudSection() {
  return (
    <section className="py-14 border-y border-border/40 bg-muted/20">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mb-10">
          Integrado com os principais portais de licitação do Brasil
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          {portais.map((portal, i) => (
            <motion.div
              key={portal.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group flex flex-col items-center gap-2 cursor-pointer"
            >
              <motion.div
                whileHover={{
                  scale: 1.12,
                  y: -6,
                  boxShadow: `0 12px 28px -4px ${portal.glow}, 0 0 0 2px ${portal.color}40`,
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-card border border-border/40 flex items-center justify-center p-3 shadow-sm overflow-hidden"
                style={{ willChange: 'transform' }}
              >
                {/* Colored bottom accent bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-1.5"
                  style={{ backgroundColor: portal.color }}
                />
                <img
                  src={portal.logo}
                  alt={portal.name}
                  className="max-w-full max-h-full object-contain transition-all duration-300 group-hover:brightness-110 group-hover:contrast-110"
                />
              </motion.div>
              <span
                className="text-[11px] font-medium text-muted-foreground/60 transition-colors duration-300 text-center leading-tight max-w-[90px] group-hover:font-semibold"
                style={{ color: undefined }}
              >
                <span className="group-hover:hidden">{portal.name}</span>
                <span className="hidden group-hover:inline" style={{ color: portal.color }}>
                  {portal.name}
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
