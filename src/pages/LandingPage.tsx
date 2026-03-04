import LandingNavbar from '@/components/landing/LandingNavbar';
import HeroSection from '@/components/landing/HeroSection';
import LogoCloudSection from '@/components/landing/LogoCloudSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import StatsSection from '@/components/landing/StatsSection';
import TreinamentosSection from '@/components/landing/TreinamentosSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PlanosSection from '@/components/landing/PlanosSection';
import FaqSection from '@/components/landing/FaqSection';
import CtaSection from '@/components/landing/CtaSection';
import LandingFooter from '@/components/landing/LandingFooter';
import FloatingChat from '@/components/chat/FloatingChat';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <HeroSection />
      <LogoCloudSection />
      <StatsSection />
      <FeaturesSection />
      <TreinamentosSection />
      <TestimonialsSection />
      <PlanosSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
      <FloatingChat isLanding />
    </div>
  );
}
