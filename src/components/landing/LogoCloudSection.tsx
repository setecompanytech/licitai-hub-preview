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

type PortalEntry = { name: string; logo?: string };

const portaisComLogo: PortalEntry[] = [
  { name: 'PNCP', logo: comprasnetLogo },
  { name: 'BLL Compras', logo: bllLogo },
  { name: 'BEC/SP', logo: becLogo },
  { name: 'BNC', logo: bncLogo },
  { name: 'Licitações-E', logo: licitacoesELogo },
  { name: 'ComprasBR', logo: comprasbrLogo },
  { name: 'Portal de Compras', logo: portalComprasLogo },
  { name: 'LicitaNet', logo: licitanetLogo },
  { name: 'ComprasNet BA', logo: comprasnetBahiaLogo },
  { name: 'Banparanet', logo: banparanetLogo },
];

const duplicated = [...portaisComLogo, ...portaisComLogo];

export default function LogoCloudSection() {
  return (
    <section id="portais" className="py-14 px-6 bg-background border-y border-border/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">Integrações</p>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Conectado com <span className="text-accent">38 portais</span> de compras públicas
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Monitoramento automatizado em portais federais, estaduais e plataformas privadas.
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none bg-gradient-to-r from-background to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 z-10 pointer-events-none bg-gradient-to-l from-background to-transparent" />

        <motion.div
          className="flex gap-8 md:gap-12 py-4"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { duration: 40, repeat: Infinity, ease: 'linear' } }}
          style={{ width: 'max-content' }}
        >
          {duplicated.map((portal, i) => (
            <div key={`${portal.name}-${i}`} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-card border border-border/40 flex items-center justify-center p-2.5 hover:shadow-sm transition-shadow">
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
