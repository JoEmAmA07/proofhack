import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { WorkflowSection } from './components/WorkflowSection';
import { DashboardPlaceholder } from './components/DashboardPlaceholder';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');

  const scrollToWorkflow = () => {
    const el = document.getElementById('workflow-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070b12] text-slate-100 bg-grid-pattern">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      <main className="flex-1">
        {currentView === 'landing' ? (
          <>
            <Hero
              onStartVerification={() => setCurrentView('dashboard')}
              onExploreWorkflow={scrollToWorkflow}
            />
            <WorkflowSection />
          </>
        ) : (
          <DashboardPlaceholder
            onBackToLanding={() => setCurrentView('landing')}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;

