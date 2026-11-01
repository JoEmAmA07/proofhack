
import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  Home,
} from 'lucide-react';
import {
  checkBackendHealth,
  type HealthResponse,
} from '../api/health';

interface NavbarProps {
  currentView: 'landing' | 'dashboard';
  setCurrentView: (view: 'landing' | 'dashboard') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
}) => {
  const [backendHealth, setBackendHealth] = useState<{
    loading: boolean;
    online: boolean;
    data?: HealthResponse;
    error?: string;
  }>({
    loading: true,
    online: false,
  });

  useEffect(() => {
    let mounted = true;

    const runHealthCheck = async () => {
      try {
        const result = await checkBackendHealth();

        if (!mounted) return;

        setBackendHealth({
          loading: false,
          online: result.ok,
          data: result.data,
          error: result.error,
        });
      } catch {
        if (!mounted) return;

        setBackendHealth({
          loading: false,
          online: false,
          error: 'Server unreachable',
        });
      }
    };

    runHealthCheck();

    const interval = setInterval(runHealthCheck, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#080d18]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">

        {/* Brand */}
        <button
          type="button"
          onClick={() => setCurrentView('landing')}
          className="group flex shrink-0 items-center gap-3 text-left"
          aria-label="ProofStack home"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/30 bg-gradient-to-br from-teal-400 to-cyan-500 shadow-[0_4px_20px_rgba(20,184,166,0.18)] transition-transform group-hover:scale-105">
            <ShieldCheck className="h-6 w-6 text-[#062b2b]" strokeWidth={2.5} />
          </div>

          <div>
            <p className="text-xl font-extrabold tracking-[-0.04em] text-white">
              Proof<span className="text-teal-300">Stack</span>
            </p>
            <p className="hidden text-[10px] font-medium tracking-wide text-slate-500 sm:block">
              PROJECT REALITY ENGINE
            </p>
          </div>
        </button>

        {/* Navigation */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-1 rounded-xl border border-slate-800/70 bg-[#101a2a]/80 p-1"
          >
            <button
              type="button"
              onClick={() => setCurrentView('landing')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${currentView === 'landing'
                ? 'bg-slate-700/60 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${currentView === 'dashboard'
                ? 'bg-slate-700/60 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Studio</span>
            </button>
          </nav>

          {/* Live backend status */}
          <div
            title={
              backendHealth.loading
                ? 'Checking backend connection'
                : backendHealth.online
                  ? `Backend connected${backendHealth.data?.uptimeSeconds !== undefined
                    ? ` - Uptime: ${backendHealth.data.uptimeSeconds}s`
                    : ''
                  }`
                  : `Backend offline: ${backendHealth.error || 'Server unreachable'
                  }`
            }
            className="flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/70 px-3 py-2"
            role="status"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${backendHealth.loading
                ? 'bg-slate-400 animate-pulse'
                : backendHealth.online
                  ? 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.65)]'
                  : 'bg-amber-400'
                }`}
            />

            <span className="hidden whitespace-nowrap text-[11px] font-semibold text-slate-300 md:inline">
              {backendHealth.loading
                ? 'Checking'
                : backendHealth.online
                  ? 'System Online'
                  : 'System Offline'}
            </span>
          </div>

          {/* Primary action */}
          {currentView === 'landing' && (
            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className="hidden items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-[0_5px_22px_rgba(20,184,166,0.18)] transition-all hover:brightness-110 lg:inline-flex"
            >
              Launch Studio
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
