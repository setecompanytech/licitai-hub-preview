import { useEffect } from 'react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import HeroSection from '@/components/landing/HeroSection';
import LogoCloudSection from '@/components/landing/LogoCloudSection';
import ComoFuncionaSection from '@/components/landing/ComoFuncionaSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import StatsSection from '@/components/landing/StatsSection';
import SegmentosSection from '@/components/landing/SegmentosSection';
import SecurityTrustSection from '@/components/landing/SecurityTrustSection';
import DiferenciaisSection from '@/components/landing/DiferenciaisSection';
import TreinamentosSection from '@/components/landing/TreinamentosSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PlanosSection from '@/components/landing/PlanosSection';
import FaqSection from '@/components/landing/FaqSection';
import CtaSection from '@/components/landing/CtaSection';
import LeadCaptureForm from '@/components/landing/LeadCaptureForm';
import LandingFooter from '@/components/landing/LandingFooter';
import FloatingChat from '@/components/chat/FloatingChat';
import { storeUtmParams } from '@/lib/tracking';
import { Helmet } from 'react-helmet-async';

export default function LandingPage() {
  useEffect(() => { storeUtmParams(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>PRAEFECTUS — Inteligência Operacional para Licitações Públicas</title>
        <meta name="description" content="Plataforma SaaS de monitoramento, precificação, geração de propostas e automação de lances para contratações públicas. Cobertura nacional em 38+ portais." />
        <meta property="og:title" content="PRAEFECTUS — Inteligência Operacional para Licitações Públicas" />
        <meta property="og:description" content="Monitoramento inteligente, precificação automatizada e gestão completa do ciclo licitatório." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://praefectus.com.br" />
      </Helmet>
      <LandingNavbar />
      <HeroSection />
      <LogoCloudSection />
      <StatsSection />
      <ComoFuncionaSection />
      <FeaturesSection />
      <SegmentosSection />
      <SecurityTrustSection />
      <DiferenciaisSection />
      <TreinamentosSection />
      <TestimonialsSection />
      <PlanosSection />
      <LeadCaptureForm />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
      <FloatingChat isLanding />
    </div>
  );
}
