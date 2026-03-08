import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

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

type PortalEntry = { name: string; logo?: string; color: string };

const portaisComLogo: PortalEntry[] = [
  { name: 'PNCP', logo: comprasnetLogo, color: '#003E7E' },
  { name: 'BLL Compras', logo: bllLogo, color: '#0D6B5E' },
  { name: 'BEC/SP', logo: becLogo, color: '#007B9E' },
  { name: 'BNC', logo: bncLogo, color: '#1A0A7A' },
  { name: 'Licitações-E', logo: licitacoesELogo, color: '#F5C518' },
  { name: 'ComprasBR', logo: comprasbrLogo, color: '#7AB929' },
  { name: 'Portal de Compras', logo: portalComprasLogo, color: '#F5A623' },
  { name: 'LicitaNet', logo: licitanetLogo, color: '#2563EB' },
  { name: 'ComprasNet BA', logo: comprasnetBahiaLogo, color: '#D32F2F' },
  { name: 'Banparanet', logo: banparanetLogo, color: '#1B7A3D' },
];

const duplicated = [...portaisComLogo, ...portaisComLogo];

export default function LogoCloudSection() {
  return (
    <section id="portais" className="landing-section bg-muted/30 border-y border-border/30 overflow-hidden">
      <div className="landing-container">
        <div className="text-center mb-14">
          <span className="section-label">Integrações</span>
          <h2 className="section-title">
            Conectado com <span className="gradient-text">31 portais</span> de licitações e dispensas
          </h2>
          <p className="section-subtitle mx-auto">
            Monitoramento automatizado via IA em portais federais, estaduais e plataformas privadas de todos os 27 estados.
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-r from-muted/30 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-l from-muted/30 to-transparent" />

        <motion.div
          className="flex gap-8 md:gap-12 py-4"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { duration: 40, repeat: Infinity, ease: 'linear' } }}
          style={{ width: 'max-content' }}
        >
          {duplicated.map((portal, i) => (
            <div key={`${portal.name}-${i}`} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-card border border-border/30 flex items-center justify-center p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute bottom-0 left-0 right-0 h-[3px] transition-all group-hover:h-1" style={{ backgroundColor: portal.color }} />
                {portal.logo ? (
                  <img src={portal.logo} alt={portal.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <Globe className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground/50 text-center max-w-[90px]">{portal.name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
