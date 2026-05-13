'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { Features } from './features';
import { Benefits } from './benefits';
import { InteractiveDemo } from './interactive-demo';
import { DashboardPreview } from './dashboard-preview';
import { SocialProof } from './social-proof';
import { Contact } from './contact';
import { Footer } from './footer';
import { Header } from './header';

export function Landing() {
  const { scrollY } = useScroll();
  const gridY = useTransform(scrollY, [0, 600], [0, 20]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-grid opacity-30 dark:opacity-50"
          style={{ y: gridY }}
        />
        <div
          className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent dark:via-primary-500/20"
          style={{ animation: 'flow 28s linear infinite' }}
        />
        <div
          className="absolute top-2/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent dark:via-primary-500/15"
          style={{ animation: 'flow 32s linear infinite', animationDelay: '-5s' }}
        />
        <div
          className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/15 to-transparent dark:via-amber-500/10"
          style={{ animation: 'flow 30s linear infinite', animationDelay: '-12s' }}
        />
      </div>
      <div className="relative z-10">
        <Header />
        <main>
          <Hero />
          <HowItWorks />
          <Features />
          <Benefits />
          <InteractiveDemo />
          <DashboardPreview />
          <SocialProof />
          <Contact />
          <Footer />
        </main>
      </div>
    </div>
  );
}
