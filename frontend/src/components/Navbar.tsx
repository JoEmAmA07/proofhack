import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { checkBackendHealth, HealthResponse } from '../api/health';

interface NavbarProps {
  currentView: 'landing' | 'dashboard';
  setCurrentView: (view: 'landing' | 'dashboard') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const [backendHealth, setBackendHealth] = useState<{
    loading: boolean;
    online: boolean;
    data?: HealthResponse;
    error?: string;
  }>({
    loading: true,
    online: false,
  });

  const runHealthCheck = async () => {
    setBackendHealth((prev) => ({ ...prev, loading: true }));
    const result = await checkBackendHealth();
    setBackendHealth({
      loading: false,
      online: result.ok,
      data: result.data,
      error: result.error,
    });
  };

  useEffect(() => {
    runHealthCheck();
    const interval = setInterval(runHealthCheck, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border/60 bg-[#070b12]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => setCurrentView('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-glow-cyan/50 group-hover:scale-105 transition-transform duration-200">
            <ShieldCheck className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-200 bg-clip-text text-transparent">
                ProofStack
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 font-semibold tracking-wider">
                PHASE 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Project Reality Verification
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex items-center gap-3 sm:gap-6">
          <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
            <button
              onClick={() => setCurrentView('landing')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                currentView === 'landing'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === 'dashboard'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Dashboard
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400"></span>
            </button>
          </nav>

          {/* Backend Status Badge */}
          <div 
            title={backendHealth.online 
              ? `Backend Connected (Uptime: ${backendHealth.data?.uptimeSeconds}s)` 
              : `Backend Offline: ${backendHealth.error || 'Server unreachable'}`}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-800 bg-slate-900/80 text-xs text-slate-300 cursor-help"
          >
            <span className="relative flex h-2 w-2">
              {backendHealth.online ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              )}
            </span>
            <span className="font-mono text-[11px] hidden md:inline">API:</span>
            <span className={`font-mono text-[11px] font-semibold ${backendHealth.online ? 'text-teal-300' : 'text-amber-400'}`}>
              {backendHealth.loading && !backendHealth.data
                ? 'checking...'
                : backendHealth.online
                ? '200 OK'
                : 'offline'}
            </span>
          </div>

          {/* Start Verification Action Button */}
          {currentView === 'landing' && (
            <button
              onClick={() => setCurrentView('dashboard')}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 hover:brightness-110 shadow-glow-cyan/40 transition-all active:scale-95"
            >
              Start Verification
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
};

