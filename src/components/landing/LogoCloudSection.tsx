import { motion } from 'framer-motion';
import { Globe, MapPin, Building2 } from 'lucide-react';

import comprasnetLogo from '@/assets/portais/comprasnet.png';
import bllLogo from '@/assets/portais/bll.png';
import becLogo from '@/assets/portais/bec.png';
import bncLogo from '@/assets/portais/bnc.png';
import licitacoesELogo from '@/assets/portais/licitacoes-e.png';
import comprasbrLogo from '@/assets/portais/comprasbr.png';
import portalComprasLogo from '@/assets/portais/portal-compras-publicas.png';
import licitanetLogo from '@/assets/portais/licitanet.png';
import comprasnetBahiaLogo from '@/assets/portais/comprasnet-bahia.png';

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
];

const portaisEstaduais = [
  { name: 'Compras MG', uf: 'MG' }, { name: 'Compras RJ', uf: 'RJ' },
  { name: 'PE Integrado', uf: 'PE' }, { name: 'Compras CE', uf: 'CE' },
  { name: 'ComprasNet GO', uf: 'GO' }, { name: 'Compras PR', uf: 'PR' },
  { name: 'Compras RS', uf: 'RS' }, { name: 'Compras SC', uf: 'SC' },
  { name: 'Banparanet', uf: 'PA' }, { name: 'e-Compras AM', uf: 'AM' },
  { name: 'Compras ES', uf: 'ES' }, { name: 'e-Compras DF', uf: 'DF' },
  { name: 'Compras MT', uf: 'MT' }, { name: 'Compras MS', uf: 'MS' },
  { name: 'Compras TO', uf: 'TO' }, { name: 'Compras MA', uf: 'MA' },
  { name: 'ComprasNet RO', uf: 'RO' },
];

const plataformasExtras = ['BBMNet', 'Licitar Digital', 'Compras Gov.br'];

const duplicated = [...portaisComLogo, ...portaisComLogo];

export default function LogoCloudSection() {
  return (
    <section id="portais" className="landing-section bg-muted/30 border-y border-border/30 overflow-hidden">
      <div className="landing-container">
        <div className="text-center mb-14">
          <span className="section-label">Integrações</span>
          <h2 className="section-title">
            Conectado com <span className="gradient-text">31 portais</span> de compras
          </h2>
          <p className="section-subtitle mx-auto">
            Monitoramento automatizado via IA em portais federais, estaduais e plataformas privadas de todos os 27 estados.
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative mb-14">
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

      {/* State + Private portals */}
      <div className="max-w-4xl mx-auto px-6 space-y-8">
        <div>
          <div className="flex items-center gap-2 justify-center mb-4">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">17 Portais Estaduais</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {portaisEstaduais.map((p) => (
              <span key={p.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/30 bg-card text-[11px] font-medium text-muted-foreground hover:border-accent/30 hover:text-accent transition-colors">
                <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent">{p.uf}</span>
                {p.name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 justify-center mb-3">
            <Building2 className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">+ Plataformas Privadas</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {plataformasExtras.map((name) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-[11px] font-semibold text-accent">
                <Globe className="w-3 h-3" /> {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
