import AIFloatingChat from "@/components/AIFloatingChat";
import ComparisonSection from "@/components/ComparisonSection";
import ControlCenterSection from "@/components/ControlCenterSection";
import DiagnosticRadarSection from "@/components/DiagnosticRadarSection";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import Navbar from "@/components/Navbar";
import PortfolioSection from "@/components/PortfolioSection";
import Reveal from "@/components/Reveal";
import ServicesBentoGrid from "@/components/ServicesBentoGrid";
import SiteActionsProvider from "@/components/SiteActionsProvider";
import TeamSection from "@/components/TeamSection";
import WhyUsSection from "@/components/WhyUsSection";

export default function HomePage() {
  return (
    <SiteActionsProvider>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Reveal>
          <HeroSection />
        </Reveal>
        <Reveal>
          <ControlCenterSection />
        </Reveal>
        <Reveal>
          <DiagnosticRadarSection />
        </Reveal>
        <Reveal>
          <ServicesBentoGrid />
        </Reveal>
        <Reveal>
          <ComparisonSection />
        </Reveal>
        <WhyUsSection />
        <Reveal>
          <PortfolioSection />
        </Reveal>
        <Reveal>
          <TeamSection />
        </Reveal>
      </main>
      <Footer />
      <AIFloatingChat />
    </SiteActionsProvider>
  );
}
