import React, { useState, useEffect } from 'react';
import { LayoutDashboard, History as HistoryIcon, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo, CreditLine } from './components/Branding';
import { Dashboard } from './components/Dashboard';
import { History } from './components/History';
import { LandRecord } from './services/geminiService';
import { cn } from './lib/utils';

type Tab = 'dashboard' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [history, setHistory] = useState<LandRecord[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('uli_ai_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const handleRecordProcessed = (record: LandRecord) => {
    const newHistory = [record, ...history];
    setHistory(newHistory);
    localStorage.setItem('uli_ai_history', JSON.stringify(newHistory));
  };

  return (
    <div className="min-h-screen flex bg-slate-100 w-full">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-white text-slate-900 border-r border-slate-200 shadow-sm z-50 flex flex-col",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-200">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
            </div>
          ) : (
            <Logo />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
            collapsed={sidebarCollapsed}
          />
          <NavItem 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<HistoryIcon className="w-5 h-5" />}
            label="History"
            collapsed={sidebarCollapsed}
          />
        </nav>

        {/* Collapse Button */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-4 border-t border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <ChevronLeft className="w-5 h-5" />
              <span>Collapse</span>
            </div>
          )}
        </button>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex flex-col min-h-screen w-full",
        sidebarCollapsed ? "pl-20" : "pl-64"
      )}>
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 flex-shrink-0">
          <div className="flex justify-between items-center h-[73px] px-6 w-full">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-slate-900">
                {activeTab === 'dashboard' ? 'Dashboard' : 'Processing History'}
              </h2>
            </div>
            
            <div className="flex items-center gap-3 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Secure AI</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 p-6 w-full">
          {activeTab === 'dashboard' ? (
            <Dashboard onRecordProcessed={handleRecordProcessed} history={history} />
          ) : (
            <History records={history} />
          )}
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 flex-shrink-0 w-full">
          <div className="px-6 py-[15px]">
            <div className="flex flex-col md:flex-row justify-between items-center gap-2">
              <p className="text-xs text-slate-400">
                © {new Date().getFullYear()} Udayam AI Labs. All rights reserved.
              </p>
              <CreditLine />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

const NavItem = ({ active, onClick, icon, label, collapsed }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, collapsed: boolean }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
      active 
        ? "bg-udayam-purple text-white" 
        : "text-slate-600 hover:text-udayam-purple hover:bg-slate-50"
    )}
  >
    {icon}
    {!collapsed && <span className="font-medium">{label}</span>}
  </button>
);
