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

const portais = [
  { name: 'Comprasnet', logo: comprasnetLogo },
  { name: 'BLL Compras', logo: bllLogo },
  { name: 'BEC/SP', logo: becLogo },
  { name: 'BNC', logo: bncLogo },
  { name: 'Licitações-E', logo: licitacoesELogo },
  { name: 'ComprasBR', logo: comprasbrLogo },
  { name: 'Portal de Compras Públicas', logo: portalComprasLogo },
  { name: 'LicitaNet', logo: licitanetLogo },
  { name: 'Comprasnet Bahia', logo: comprasnetBahiaLogo },
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
              className="group flex flex-col items-center gap-2"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-card border border-border/40 flex items-center justify-center p-3 shadow-sm group-hover:shadow-md group-hover:border-accent/40 transition-all duration-300">
                <img
                  src={portal.logo}
                  alt={portal.name}
                  className="max-w-full max-h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground/60 group-hover:text-muted-foreground transition-colors text-center leading-tight max-w-[90px]">
                {portal.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
