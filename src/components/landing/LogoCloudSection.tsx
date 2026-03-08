import { motion } from 'framer-motion';
import { Globe, Building2, MapPin } from 'lucide-react';

import comprasnetLogo from '@/assets/portais/comprasnet.png';
import bllLogo from '@/assets/portais/bll.png';
import becLogo from '@/assets/portais/bec.png';
import bncLogo from '@/assets/portais/bnc.png';
import licitacoesELogo from '@/assets/portais/licitacoes-e.png';
import comprasbrLogo from '@/assets/portais/comprasbr.png';
import portalComprasLogo from '@/assets/portais/portal-compras-publicas.png';
import licitanetLogo from '@/assets/portais/licitanet.png';
import comprasnetBahiaLogo from '@/assets/portais/comprasnet-bahia.png';

type PortalEntry = {
  name: string;
  logo?: string;
  color: string;
  glow: string;
};

// Portais com logo real (carrossel principal)
const portaisComLogo: PortalEntry[] = [
  { name: 'PNCP', logo: comprasnetLogo, color: '#003E7E', glow: 'rgba(0,62,126,0.3)' },
  { name: 'BLL Compras', logo: bllLogo, color: '#0D6B5E', glow: 'rgba(13,107,94,0.3)' },
  { name: 'BEC/SP', logo: becLogo, color: '#007B9E', glow: 'rgba(0,123,158,0.3)' },
  { name: 'BNC', logo: bncLogo, color: '#1A0A7A', glow: 'rgba(26,10,122,0.3)' },
  { name: 'Licitações-E', logo: licitacoesELogo, color: '#F5C518', glow: 'rgba(245,197,24,0.3)' },
  { name: 'ComprasBR', logo: comprasbrLogo, color: '#7AB929', glow: 'rgba(122,185,41,0.3)' },
  { name: 'Portal de Compras', logo: portalComprasLogo, color: '#F5A623', glow: 'rgba(245,166,35,0.3)' },
  { name: 'LicitaNet', logo: licitanetLogo, color: '#2563EB', glow: 'rgba(37,99,235,0.3)' },
  { name: 'ComprasNet BA', logo: comprasnetBahiaLogo, color: '#D32F2F', glow: 'rgba(211,47,47,0.3)' },
];

// Todos os portais estaduais + plataformas sem logo (badges)
const portaisEstaduais = [
  { name: 'Compras MG', uf: 'MG' },
  { name: 'Compras RJ', uf: 'RJ' },
  { name: 'PE Integrado', uf: 'PE' },
  { name: 'Compras CE', uf: 'CE' },
  { name: 'ComprasNet GO', uf: 'GO' },
  { name: 'Compras PR', uf: 'PR' },
  { name: 'Compras RS', uf: 'RS' },
  { name: 'Compras SC', uf: 'SC' },
  { name: 'Banparanet', uf: 'PA' },
  { name: 'e-Compras AM', uf: 'AM' },
  { name: 'Compras ES', uf: 'ES' },
  { name: 'e-Compras DF', uf: 'DF' },
  { name: 'Compras MT', uf: 'MT' },
  { name: 'Compras MS', uf: 'MS' },
  { name: 'Compras TO', uf: 'TO' },
  { name: 'Compras MA', uf: 'MA' },
  { name: 'ComprasNet RO', uf: 'RO' },
];

const plataformasExtras = [
  'BBMNet', 'Licitar Digital', 'Compras Gov.br',
];

const duplicated = [...portaisComLogo, ...portaisComLogo];

function PortalCard({ portal }: { portal: PortalEntry }) {
  return (
    <motion.div
      whileHover={{ scale: 1.12, y: -6, boxShadow: `0 12px 28px -4px ${portal.glow}, 0 0 0 2px ${portal.color}40` }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className="group flex flex-col items-center gap-2 cursor-pointer flex-shrink-0"
    >
      <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-card border border-border/40 flex items-center justify-center p-3 shadow-sm overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-1.5"
          style={{ backgroundColor: portal.color }}
        />
        {portal.logo ? (
          <img
            src={portal.logo}
            alt={portal.name}
            className="max-w-full max-h-full object-contain transition-all duration-300 group-hover:brightness-110 group-hover:contrast-110"
          />
        ) : (
          <Globe className="w-8 h-8 text-muted-foreground group-hover:text-accent transition-colors" />
        )}
      </div>
      <span className="text-[11px] font-medium text-muted-foreground/60 transition-colors duration-300 text-center leading-tight max-w-[90px] group-hover:font-semibold">
        <span className="group-hover:hidden">{portal.name}</span>
        <span className="hidden group-hover:inline" style={{ color: portal.color }}>{portal.name}</span>
      </span>
    </motion.div>
  );
}

export default function LogoCloudSection() {
  return (
    <section className="py-14 border-y border-border/40 bg-muted/20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
            Integrado com os principais portais de licitação do Brasil
          </p>
          <p className="text-3xl md:text-4xl font-extrabold gradient-text">
            31 portais conectados
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cobertura nacional com busca automatizada via IA em todos os 27 estados
          </p>
        </div>
      </div>

      {/* Infinite carousel — portais com logo */}
      <div className="relative mb-10">
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, hsl(var(--muted) / 0.2), transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, hsl(var(--muted) / 0.2), transparent)' }} />

        <motion.div
          className="flex gap-8 md:gap-12 py-2"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { duration: 35, repeat: Infinity, ease: 'linear' } }}
          style={{ width: 'max-content' }}
        >
          {duplicated.map((portal, i) => (
            <PortalCard key={`${portal.name}-${i}`} portal={portal} />
          ))}
        </motion.div>
      </div>

      {/* Portais estaduais — badges grid */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-2 justify-center mb-4">
          <MapPin className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Portais Estaduais
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {portaisEstaduais.map((p) => (
            <motion.span
              key={p.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.08 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-card text-[11px] font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors cursor-default"
            >
              <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent">
                {p.uf}
              </span>
              {p.name}
            </motion.span>
          ))}
        </div>

        <div className="flex items-center gap-2 justify-center mb-3">
          <Building2 className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            + Plataformas
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {plataformasExtras.map((name) => (
            <motion.span
              key={name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.08 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-[11px] font-medium text-accent cursor-default"
            >
              <Globe className="w-3 h-3" />
              {name}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
