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
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
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
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Listen to settings
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
        setDoc(doc(db, 'settings', 'global'), defaultSettings).catch(console.error);
        setSettings(defaultSettings);
      }
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
      <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Droplets className="w-12 h-12 text-[#141414]" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] p-4">
        <div className="max-w-md w-full bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex items-center gap-3 mb-6">
            <Droplets className="w-10 h-10 text-[#141414]" />
            <h1 className="text-3xl font-bold tracking-tighter uppercase italic font-serif">Aquaflow</h1>
          </div>
          <p className="text-sm text-gray-600 mb-8 font-mono">
            Secure water management system. Please sign in to access the dashboard.
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#141414] text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
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
    <div className="min-h-screen bg-[#E4E3E0] flex">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-[#141414] text-white transition-all duration-300 flex flex-col border-r border-[#141414]`}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <div className="flex items-center gap-2">
              <Droplets className="w-6 h-6 text-white" />
              <span className="font-serif italic font-bold text-xl">Aquaflow</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-2">
          <NavItem 
            icon={<Users size={20} />} 
            label="Members" 
            active={activeTab === 'members'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('members')}
          />
          <NavItem 
            icon={<Receipt size={20} />} 
            label="Billing" 
            active={activeTab === 'billing'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('billing')}
          />
          {isAdmin && (
            <NavItem 
              icon={<SettingsIcon size={20} />} 
              label="Settings" 
              active={activeTab === 'settings'} 
              collapsed={!isSidebarOpen}
              onClick={() => setActiveTab('settings')}
            />
          )}
          <NavItem 
            icon={<FileText size={20} />} 
            label="Reports" 
            active={activeTab === 'reports'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('reports')}
          />
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-mono text-xs uppercase tracking-widest">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-[#141414] p-6 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight uppercase italic font-serif">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-mono uppercase text-gray-500">Logged in as</p>
                <p className="text-sm font-bold">{user.displayName}</p>
              </div>
              <img 
                src={user.photoURL || ''} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border border-[#141414]"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'members' && <MemberManagement isAdmin={isAdmin} />}
              {activeTab === 'billing' && <BillingDashboard isAdmin={isAdmin} settings={settings} />}
              {activeTab === 'settings' && isAdmin && <AdminSettings settings={settings} />}
              {activeTab === 'reports' && <Reporting />}
            </motion.div>
          </AnimatePresence>
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
      className={`w-full flex items-center gap-3 p-3 rounded transition-all ${
        active 
          ? 'bg-white text-[#141414] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]' 
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {icon}
      {!collapsed && <span className="font-mono text-xs uppercase tracking-widest font-bold">{label}</span>}
    </button>
  );
}

