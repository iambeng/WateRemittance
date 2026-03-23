import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Settings } from '../types';
import { Save, Info } from 'lucide-react';

export default function AdminSettings({ settings }: { settings: Settings | null }) {
  const [formData, setFormData] = useState<Settings>(settings || {
    baseRate: 100,
    excessRate: 30,
    fixedDues: 10
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), formData);
      alert('Settings updated successfully!');
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-[#141414] p-2 text-white">
            <Save size={24} />
          </div>
          <h2 className="text-2xl font-bold font-serif italic uppercase tracking-tight">Billing Configuration</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Base Rate (0-3 m³)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-gray-400">₱</span>
                <input
                  required
                  type="number"
                  value={isNaN(formData.baseRate) ? '' : formData.baseRate}
                  onChange={(e) => setFormData({ ...formData, baseRate: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                  className="w-full pl-8 pr-4 py-3 border border-[#141414] font-mono text-lg focus:ring-2 focus:ring-[#141414] outline-none"
                />
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-1 italic">Minimum charge applied to consumption up to 3 cubic meters.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Excess Rate (per m³)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-gray-400">₱</span>
                <input
                  required
                  type="number"
                  value={isNaN(formData.excessRate) ? '' : formData.excessRate}
                  onChange={(e) => setFormData({ ...formData, excessRate: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                  className="w-full pl-8 pr-4 py-3 border border-[#141414] font-mono text-lg focus:ring-2 focus:ring-[#141414] outline-none"
                />
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-1 italic">Charge for every cubic meter consumed beyond the initial 3m³.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Fixed Monthly Dues</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-gray-400">₱</span>
                <input
                  required
                  type="number"
                  value={isNaN(formData.fixedDues) ? '' : formData.fixedDues}
                  onChange={(e) => setFormData({ ...formData, fixedDues: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                  className="w-full pl-8 pr-4 py-3 border border-[#141414] font-mono text-lg focus:ring-2 focus:ring-[#141414] outline-none"
                />
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-1 italic">Standard maintenance fee applied to every bill.</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 flex gap-3">
            <Info className="text-blue-500 shrink-0" size={20} />
            <div className="text-xs text-blue-800 font-mono leading-relaxed">
              <strong>Calculation Rule:</strong><br />
              Total = Base Rate + (Excess Consumption × Excess Rate) + Monthly Dues + Penalties (if applicable).
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#141414] text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving Changes...' : 'Save Configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}
