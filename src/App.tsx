/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Receipt, 
  Settings as SettingsIcon, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  Droplets,
  User
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import MemberManagement from './components/MemberManagement';
import BillingDashboard from './components/BillingDashboard';
import AdminSettings from './components/AdminSettings';
import Reporting from './components/Reporting';
import { Settings as AppSettings } from './types';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'billing' | 'settings' | 'reports'>('members');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Listen to settings
    const settingsPath = 'settings/global';
    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as AppSettings);
      } else {
        // Initialize default settings if not exists
        const defaultSettings: AppSettings = {
          baseRate: 100,
          excessRate: 30,
          fixedDues: 10
        };
        setDoc(doc(db, 'settings', 'global'), defaultSettings).catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, settingsPath);
        });
        setSettings(defaultSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, settingsPath);
    });

    return () => {
      unsubscribe();
      settingsUnsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECFEFF]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Droplets className="w-12 h-12 text-[#0891B2]" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            {settings?.companyLogo ? (
              <img src={settings.companyLogo} alt="Logo" className="w-12 h-12 object-contain rounded-lg" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                <Droplets className="w-8 h-8 text-[#0891B2]" />
              </div>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {settings?.companyName || 'Aquaflow'}
            </h1>
          </div>
          {settings?.tagline && (
            <p className="text-sm text-slate-500 font-medium -mt-4 mb-6">
              {settings.tagline}
            </p>
          )}
          <p className="text-slate-600 mb-8 leading-relaxed">
            Secure water management system. Please sign in to access your dashboard.
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#0891B2] text-white py-4 rounded-xl font-bold tracking-wide hover:bg-[#06B6D4] transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <User className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = user.email === "lobingco.juvelyn7@gmail.com";

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      <Toaster position="top-right" richColors closeButton />
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-[110] lg:static lg:flex
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarOpen ? 'w-72' : 'w-24'}
          bg-[#0891B2] text-white transition-all duration-300 flex flex-col m-0 lg:m-4 lg:rounded-[2rem] shadow-2xl overflow-hidden border-r lg:border border-cyan-800/50
        `}
      >
        <div className={`p-8 flex flex-col ${isSidebarOpen ? 'gap-4' : 'gap-6 items-center'}`}>
          <div className={`flex ${isSidebarOpen ? 'items-center justify-between' : 'flex-col items-center gap-6'} w-full`}>
            <div className="flex items-center gap-3">
              {settings?.companyLogo ? (
                <div className="w-10 h-10 bg-white rounded-2xl p-1.5 shadow-lg shadow-cyan-900/20">
                  <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-900/20">
                  <Droplets className="w-6 h-6 text-white" />
                </div>
              )}
              {isSidebarOpen && (
                <span className="font-display font-bold text-xl tracking-tight truncate max-w-[160px]">
                  {settings?.companyName || 'Aquaflow'}
                </span>
              )}
            </div>
            <button 
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsMobileMenuOpen(false);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }}
              className="p-2.5 hover:bg-cyan-700/50 rounded-2xl transition-all active:scale-90"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          {isSidebarOpen && settings?.tagline && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-1"
            >
              <p className="text-[10px] font-bold text-cyan-300/80 uppercase tracking-[0.2em] leading-relaxed">
                {settings.tagline}
              </p>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 mt-4 px-4 space-y-2 custom-scrollbar overflow-y-auto">
          <NavItem 
            icon={<Users size={20} />} 
            label="Members" 
            active={activeTab === 'members'} 
            collapsed={!isSidebarOpen}
            onClick={() => {
              setActiveTab('members');
              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
            }}
          />
          <NavItem 
            icon={<Receipt size={20} />} 
            label="Billing" 
            active={activeTab === 'billing'} 
            collapsed={!isSidebarOpen}
            onClick={() => {
              setActiveTab('billing');
              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
            }}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="Reports" 
            active={activeTab === 'reports'} 
            collapsed={!isSidebarOpen}
            onClick={() => {
              setActiveTab('reports');
              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
            }}
          />
          {isAdmin && (
            <NavItem 
              icon={<SettingsIcon size={20} />} 
              label="Settings" 
              active={activeTab === 'settings'} 
              collapsed={!isSidebarOpen}
              onClick={() => {
                setActiveTab('settings');
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
            />
          )}
        </nav>

        <div className="p-4 border-t border-cyan-700/30">
          <div className={`flex ${isSidebarOpen ? 'flex-row gap-2' : 'flex-col gap-4'} items-center justify-center`}>
            <button 
              onClick={handleLogout}
              className={`flex-1 flex items-center justify-center gap-2 p-3 text-cyan-100 hover:text-white hover:bg-rose-500/10 hover:text-rose-100 rounded-2xl transition-all group`}
              title="Logout"
            >
              <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              {isSidebarOpen && <span className="text-xs font-bold tracking-wide">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 p-3 sm:p-4 sticky top-0 z-10 m-2 sm:m-3 mb-0 rounded-2xl sm:rounded-[1.5rem] shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Menu size={20} className="text-slate-600" />
            </button>
            <div className="w-1 h-6 sm:w-1.5 sm:h-8 bg-cyan-500 rounded-full shadow-sm shadow-cyan-200"></div>
            <h2 className="text-lg sm:text-2xl font-display font-bold text-slate-800 tracking-tight truncate">
              {activeTab === 'members' ? 'Member Directory' : 
               activeTab === 'billing' ? 'Billing Dashboard' : 
               activeTab === 'reports' ? 'System Reports' : 'Admin Settings'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-800 leading-none mb-1">{user.displayName}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Administrator</p>
            </div>
            <div className="p-0.5 sm:p-1 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 shadow-inner">
              <img 
                src={user.photoURL || ''} 
                alt="Profile" 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border-2 border-white shadow-sm object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {activeTab === 'members' && <MemberManagement isAdmin={isAdmin} settings={settings} />}
                {activeTab === 'billing' && <BillingDashboard isAdmin={isAdmin} settings={settings} />}
                {activeTab === 'settings' && isAdmin && <AdminSettings settings={settings} />}
                {activeTab === 'reports' && <Reporting settings={settings} isAdmin={isAdmin} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ 
  icon, 
  label, 
  active, 
  collapsed, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 group ${
        active 
          ? 'bg-white text-[#0891B2] shadow-lg scale-[1.02]' 
          : 'text-cyan-100 hover:text-white hover:bg-cyan-700/50'
      }`}
    >
      <div className={`${active ? 'text-[#0891B2]' : 'text-cyan-200 group-hover:text-white'} transition-colors`}>
        {icon}
      </div>
      {!collapsed && <span className="text-sm font-bold tracking-wide">{label}</span>}
    </button>
  );
}

