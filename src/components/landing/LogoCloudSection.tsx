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
    <section id="portais" className="py-16 px-6 bg-card border-y border-border/40 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <span className="section-label">Integrações</span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Conectado com <span className="gradient-text">38 portais</span> de compras públicas
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Monitoramento automatizado em portais federais, estaduais e plataformas privadas de todos os 27 estados.
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none bg-gradient-to-r from-card to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none bg-gradient-to-l from-card to-transparent" />

        <motion.div
          className="flex gap-6 md:gap-10 py-4"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { duration: 40, repeat: Infinity, ease: 'linear' } }}
          style={{ width: 'max-content' }}
        >
          {duplicated.map((portal, i) => (
            <div key={`${portal.name}-${i}`} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-background border border-border/40 flex items-center justify-center p-2.5 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-all group-hover:h-[3px]" style={{ backgroundColor: portal.color }} />
                {portal.logo ? (
                  <img src={portal.logo} alt={portal.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <Globe className="w-7 h-7 text-muted-foreground" />
                )}
              </div>
              <span className="text-[9px] font-medium text-muted-foreground/50 text-center max-w-[80px]">{portal.name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
